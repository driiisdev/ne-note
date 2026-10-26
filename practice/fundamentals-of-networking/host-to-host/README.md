# Practice: Host to Host

Concept notes: [`client_server_architecture.md`](<../../../concepts/fundamentals of networking/client_server_architecture.md>) ·
[`osi_model.md`](<../../../concepts/fundamentals of networking/osi_model.md>) ·
[`host_to_host_communication.md`](<../../../concepts/fundamentals of networking/host_to_host_communication.md>)

## What this demonstrates

Three ideas from the first module, made concrete on your own machine:

1. **Client-server architecture**: a tiny key-value server that owns all the state and logic,
   and a thin client that only sends commands and prints replies.
2. **The OSI model as addresses**: every layer has its own way of naming things. `net-identity.js`
   prints them per interface (MAC for L2, IP + subnet for L3), and the server logs the L4 ports
   and L7 commands for each connection.
3. **Host-to-host communication**: `next-hop.js` makes the decision every host makes before it
   sends a packet. If the destination is on my subnet, it ARPs for the destination's MAC.
   Otherwise it ARPs for the gateway's MAC.

## Folder structure

```text
host-to-host/
  net-identity.js   <- prints MAC (L2), IP/prefix and subnet (L3) per interface
  next-hop.js       <- node next-hop.js <dest-ip> [gateway]: on-link vs via-gateway decision
  server.js         <- line-based KV server over TCP (SET/GET/KEYS), logs the 4-tuple
  client.js         <- sends a scripted command list, prints replies
```

## Run it

```bash
node net-identity.js
node next-hop.js 8.8.8.8 192.168.1.1        # a remote IP, plus your gateway
node next-hop.js <another-ip-on-your-lan>     # e.g. your phone's IP

node server.js        # terminal 1
node client.js        # terminal 2
```

## What you'll see

```text
connected: local 127.0.0.1:51166 (ephemeral port picked by the OS)
           remote 127.0.0.1:6100

> SET course networking    OK
> GET course               networking
> GET missing              (nil)
```

And on the server:

```text
[conn] ::ffff:127.0.0.1:51166 -> ::ffff:127.0.0.1:6100
[L7 ] SET course networking => OK
```

## Code walkthrough

**The on-link vs. remote decision** comes down to one bitwise AND. Mask both addresses with your
subnet mask and compare the results:

```js
const sameSubnet = (toInt(iface.address) & mask) === (toInt(dest) & mask);
```

This is the step that decides *which MAC address the Ethernet frame is addressed to*. For a
remote destination, the **IP** destination is the final host but the **MAC** destination is the
gateway. L3 addressing is end-to-end, while L2 addressing only covers one hop.

**TCP is a byte stream, not a message stream.** The server can't assume one `data` event equals
one command. Two commands may arrive in one chunk, or one command split across two chunks, so it
does its own framing on `\n`:

```js
buffered += chunk;
while ((newline = buffered.indexOf("\n")) !== -1) { ... }
```

Every L7 protocol built on TCP has to solve this somehow: HTTP/1.1 uses `Content-Length` or
chunked encoding, Redis uses `\r\n`, and gRPC uses a length prefix.

**The 4-tuple** `(src IP, src port, dst IP, dst port)` logged per connection is how the kernel
tells connections apart. Run `client.js` twice and the source port changes each time. The OS
picks a new **ephemeral port** for every outbound connection.

## Map it to the OSI model

| Layer | What it is here | Where you see it |
| --- | --- | --- |
| 7 Application | `SET course networking` | server's `[L7 ]` log lines |
| 4 Transport | TCP, ports `51166 -> 6100` | `[conn]` log line, `socket.remotePort` |
| 3 Network | IP `127.0.0.1` / `10.0.0.53/24` | `net-identity.js`, `next-hop.js` |
| 2 Data link | MAC `9c:fc:e8:...` | `net-identity.js` (loopback has an all-zero MAC: no real L2 hop) |
| 1 Physical | Wi-Fi radio / Ethernet cable | not visible from userland |

## Try this yourself

- Run the server on one machine and the client on another on the same Wi-Fi
  (`node client.js <server-lan-ip>`). Then run `arp -a` on the client and find the server's MAC
  in the ARP cache. That entry is there because the client had to resolve it to send the frame.
- Run `next-hop.js` against your phone's IP, then against `8.8.8.8`, and compare. Then run
  `arp -a` after pinging each one: the phone's MAC appears in the cache, but `8.8.8.8` never
  does. Only the gateway's MAC appears for it.
- Connect with `telnet localhost 6100` or `nc localhost 6100` and type commands by hand. The
  client is just a convenience; any program that can open a TCP socket can talk to the server.

## Real-world equivalent

The KV server is a stripped-down Redis (one line per command over TCP). The next-hop decision is
exactly what your OS's routing table does on every packet. You can see it with `route print`
(Windows) or `ip route` (Linux), where the `0.0.0.0/0` entry is the "otherwise, send it to the
gateway" branch.
