# Practice: Docker Router Lab

Concept notes: [`fundamentals_of_network_routing.md`](<../../../concepts/network routing/fundamentals_of_network_routing.md>) ·
[`networking_with_docker.md`](<../../../concepts/network routing/networking_with_docker.md>) ·
related: [`routing.md`](<../../../concepts/internet protocol/routing.md>)

## What this demonstrates

A real routed network on your laptop: two subnets, two hosts, and a Linux container acting as the
router between them. Every container is a separate network namespace with its own interfaces,
routing table and ARP cache, so this behaves like real machines, just cheaper. It covers:

- **Routing tables** and the "more specific route beats the default" rule
- **IP forwarding**: the one setting that turns a host into a router
- **TTL decrementing** and **traceroute** across a hop
- **ARP across subnets**: hosts only ever learn the *router's* MAC for remote destinations
- **What breaks routing**: a firewall on the forward path, and a missing **return route**
- **How Docker networking works**: bridge networks, the default gateway, embedded DNS, published ports

## Folder structure

```text
docker-router-lab/
  docker-compose.yml   <- router (2 interfaces), host_a on net_a, host_b on net_b
  walkthrough.sh       <- 7 guided steps: inspect, ping, traceroute, ARP, tcpdump, break, fix
```

```text
   net_a 10.10.1.0/24                                  net_b 10.10.2.0/24
 +-------------------+        +--------------+       +-------------------+
 | host_a 10.10.1.10 |--------| .254  router |-------| host_b 10.10.2.20 |
 +-------------------+        |  .254        |       +-------------------+
   route: 10.10.2.0/24        | ip_forward=1 |         route: 10.10.1.0/24
          via 10.10.1.254     +--------------+                via 10.10.2.254
```

## Run it

Needs Docker. Run `walkthrough.sh` from Git Bash, WSL, or any bash.

```bash
docker compose up -d
bash walkthrough.sh
docker compose exec host_a sh     # explore by hand: ip route, ip neigh, ping, traceroute
docker compose down
```

## What you should see

*(Not run while this was written, because Docker was unavailable. `docker compose config`
validates the file. These are the expected results for each step.)*

- **Step 1, routing tables.** host_a has three routes: `10.10.1.0/24 dev eth0` (on-link),
  `10.10.2.0/24 via 10.10.1.254` (our route), and `default via 10.10.1.1` (Docker's gateway).
- **Step 2, ping.** Replies arrive with **`ttl=63`**. host_b sent them with 64, and the router
  decremented it once.
- **Step 3, traceroute.** Hop 1 is `10.10.1.254` (the router's net_a side) and hop 2 is
  `10.10.2.20`.
- **Step 4, ARP.** host_a's neighbour table contains `10.10.1.254` and maybe Docker's `.1`,
  **never** `10.10.2.20`.
- **Step 5, tcpdump on the router.** Each ICMP packet appears twice, once in on net_a's
  interface and once out on net_b's. The IPs stay the same, while the MAC addresses change at
  each hop.
- **Step 6, `iptables -A FORWARD -j DROP`.** host_a can still ping the router itself (INPUT
  chain), but host_b becomes unreachable (FORWARD chain).
- **Step 7, removing host_b's return route.** The pings fail even though the requests still
  arrive. host_b sends its replies to Docker's default gateway, not the router.

> 🖼️ **Image suggestion:** the topology above drawn as a figure, with one packet's journey
> annotated at each hop: src/dst IP (unchanged) and src/dst MAC (rewritten per hop), plus TTL
> 64 → 63.

## Code walkthrough

**`ip_forward` is the router switch.** A Linux host normally drops packets that aren't addressed
to one of its own IPs. With forwarding on, it looks the destination up in its routing table and
sends the packet out the matching interface:

```yaml
sysctls:
  net.ipv4.ip_forward: "1"
```

**Routes are needed in both directions.** host_a knows how to reach net_b, but the reply from
host_b needs its own route back:

```yaml
command: ["sh", "-c", "ip route add 10.10.1.0/24 via 10.10.2.254 && sleep infinity"]
```

Forgetting the return path is one of the most common real routing bugs. The symptom is
"requests arrive, but replies never come back," which tcpdump on the destination makes obvious.

**`cap_add: [NET_ADMIN]`** lets a container change its *own* namespace's routes and firewall.
Without it, `ip route add` fails with "Operation not permitted."

## How Docker networking works (what this lab sits on)

| Concept | What it is |
| --- | --- |
| **bridge network** | a virtual switch (a Linux bridge) on the Docker host; each container gets a veth "cable" plugged into it |
| **default gateway `.1`** | the Docker host itself on that bridge, which NATs traffic out to the internet (MASQUERADE) |
| **embedded DNS `127.0.0.11`** | resolves service and container names, only for networks the container is on |
| **`-p 8080:80`** | a DNAT rule (plus a userland proxy) mapping host port 8080 to the container's port 80 |
| **network isolation** | iptables rules drop traffic *between* different bridge networks on the host. That's why host_a must route through *our* router rather than Docker's gateway |
| **`--network host`** | no namespace at all: the container shares the host's interfaces (Linux only) |

## Try this yourself

- Delete host_a's route (`ip route del 10.10.2.0/24`) and ping host_b. The traffic now goes to
  Docker's gateway `.1`, where Docker's isolation rules drop it. The default route is the
  fallback, not a guarantee.
- Add a third network `net_c` with `host_c`, connect the router to it, and add the routes. Then
  remove the router's `net_c` leg and try routing through host_b instead (a two-hop path).
- Look at Docker's own plumbing on a Linux Docker host: `ip link` (veths and bridges),
  `sudo iptables -t nat -L -n` (MASQUERADE and DNAT rules for published ports).
- Replace the static routes with `ip route add default via 10.10.1.254` on host_a. That's what
  a typical office LAN does: one default gateway that knows everything else.

## Real-world equivalent

This is a home or office network in miniature (a router between a LAN and an upstream network),
and also how Kubernetes nodes route pod subnets, how VPC route tables steer traffic through
virtual appliances, and how VPN gateways join two private networks. The commands here
(`ip route`, `ip neigh`, `traceroute`, `tcpdump -e`, `iptables`) are the ones you'd use to debug
any of them.
