# Practice: NAT Simulator

Concept notes: [`nat.md`](<../../../concepts/transmission control protocol/nat.md>) ·
related: [`private_ip_addresses.md`](<../../../concepts/internet protocol/private_ip_addresses.md>) ·
[`postgres_failure_caused_by_a_cisco_router_(tcp_issue).md`](<../../../concepts/miscellaneous/postgres_failure_caused_by_a_cisco_router_(tcp_issue).md>)

## What this demonstrates

How one public IP serves a whole house of devices. This is a model of a home router's NAT table
(strictly, **PAT / NAPT**: Port Address Translation), run through a scripted scenario:

1. Two laptops both use private source port `51000`. The router gives each flow a different
   **public port**, which is what tells their replies apart.
2. Replies are translated back to the right laptop by looking up the public port.
3. Unsolicited inbound traffic is **dropped**, because nobody inside asked for it. This is why
   you can't host a server at home without a **port forward**.
4. Idle mappings are **evicted silently**. Neither end is told, so a long-idle TCP connection
   can be dead while both endpoints think it's still `ESTABLISHED`.

## Folder structure

```text
nat-simulator/
  nat.js   <- node nat.js   (NatRouter class + scripted scenario; no real packets)
```

## Run it

```bash
node nat.js
```

## What you'll see

```text
-- two laptops open HTTPS connections, both happen to pick source port 51000
   OUT  192.168.1.10:51000 -> 93.184.216.34:443      NEW mapping, rewrite src to 203.0.113.7:40000
   OUT  192.168.1.11:51000 -> 93.184.216.34:443      NEW mapping, rewrite src to 203.0.113.7:40001

-- someone on the internet tries to connect in
   IN   198.51.100.66:5555 -> 203.0.113.7:8080       DROP: no mapping (nobody inside asked for this)
...
-- 150s pass (clock: 350s)
   evicted idle mapping :40002 (192.168.1.10:52000 <-> 198.51.100.20:5432). Neither end is told.

-- the DB finally sends a result on the evicted connection
   IN   198.51.100.20:5432 -> 203.0.113.7:40002      DROP: no mapping (nobody inside asked for this)
```

> 🖼️ **Image suggestion:** a diagram with two laptops on the left (private IPs), the router in
> the middle with its NAT table drawn as a box, and a server on the right. Each packet's
> source address is rewritten as it crosses the router: `192.168.1.10:51000` on the left,
> `203.0.113.7:40000` on the right.

## Code walkthrough

**The table is keyed by public port.** That's the only part of an inbound packet's destination
that differs between internal hosts (they all share the public IP):

```js
this.table = new Map(); // publicPort -> { privIp, privPort, remote, lastSeen }
```

**Outbound creates state, inbound only consumes it.** That asymmetry is the whole reason NAT
acts like a firewall by accident:

```js
const e = this.table.get(dstPort);
if (!e) return log(..., "DROP: no mapping (nobody inside asked for this)");
```

**Idle eviction is silent.** The router just forgets. It sends no FIN and no RST to either side:

```js
if (this.now - e.lastSeen >= IDLE_TIMEOUT_S) this.table.delete(pubPort);
```

That's the setup for the "Postgres failure caused by a Cisco router" story in the miscellaneous
module. A connection pool's idle connection is quietly dropped by a middlebox, and the next
query on it hangs until TCP's retransmission timeout gives up, which can take many minutes. The
fix is to send traffic often enough that the mapping never goes idle: TCP keepalive
(`SO_KEEPALIVE`, with an idle time shorter than the middlebox's timeout) or an app-level
heartbeat.

## Why NAT exists, and what it costs

- ✅ **Saves IPv4 addresses.** A whole network uses one public IP, which is how IPv4 has
  survived far past its ~4.3 billion address limit.
- ✅ **Default-deny inbound** as a side effect (though NAT isn't a real firewall).
- ❌ **Breaks end-to-end addressing.** Peer-to-peer apps (video calls, games) need tricks like
  STUN, TURN, and UDP hole punching to connect two NATed peers.
- ❌ **Stateful middlebox.** Every flow costs memory in the router, and idle timeouts kill
  long-lived connections silently.
- ❌ **Port exhaustion.** One public IP has ~64K ports per destination. Carrier-grade NAT (ISPs
  NATing thousands of customers behind a few IPs, `100.64.0.0/10`) can run out.

## Try this yourself

- Find your own NAT: your machine's IP (`ipconfig` / `ip addr`) is probably `192.168.x.x` or
  `10.x.x.x`. Compare it with `curl https://ifconfig.me`. The difference is NAT in action. If
  your router's WAN IP is in `100.64.0.0/10`, your ISP is doing CGNAT on top.
- Set `IDLE_TIMEOUT_S` to 60 and add a "keepalive" `outbound()` call for the DB flow every 45s
  of simulated time. The mapping survives.
- Add an "endpoint-independent" mode where any remote may reply on an existing mapping (a "full
  cone" NAT). That's the behavior UDP hole punching depends on.
- On Linux/WSL, `sudo conntrack -L` (from the `conntrack` package) shows the kernel's real NAT
  and connection-tracking table, with the same columns as this simulation.

## Real-world equivalent

Your home router, AWS/GCP NAT gateways (outbound internet for private subnets), Docker's
`-p 8080:80` (a port forward, done with iptables DNAT; see
`practice/network-routing/docker-router-lab`), and Kubernetes Services all rewrite addresses with
the same table-lookup logic.
