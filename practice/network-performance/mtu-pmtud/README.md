# Practice: MTU, MSS and Path MTU Discovery

Concept notes: [`mss_mtu_pmtud.md`](<../../../concepts/network performance/mss_mtu_pmtud.md>)

## What this demonstrates

How big a packet can be on the path between you and some host, measured with a real probe
instead of assumed. `pmtud.js` binary-searches the largest `ping` that gets through with the
**Don't Fragment** bit set, which is the same idea the kernel's Path MTU Discovery uses.

## Folder structure

```text
mtu-pmtud/
  pmtud.js   <- node pmtud.js [host]   (wraps the system ping; Windows, Linux, macOS)
```

## Run it

```bash
node pmtud.js              # default 8.8.8.8
node pmtud.js 1.1.1.1
node pmtud.js <your-router-ip>
```

Then connect to a VPN and run it again.

## What you'll see

```text
probing path MTU to 8.8.8.8 with DF set...

  payload 4518 (packet 4546 bytes)  too big / dropped
  payload 2291 (packet 2319 bytes)  too big / dropped
  payload 1177 (packet 1205 bytes)  ok
  ...
  payload 1472 (packet 1500 bytes)  ok
  payload 1473 (packet 1501 bytes)  too big / dropped

path MTU to 8.8.8.8: 1500 bytes  (found in 13 probes)
=> TCP MSS on this path: 1460 bytes  (MTU - 20 IP - 20 TCP)
```

On a VPN or PPPoE link, expect something like 1400-1492 instead, because the tunnel's own
headers take up part of each packet.

## The three numbers

```text
|<------------------------- MTU: 1500 (max IP packet the link carries) ------------------------->|
|  IP header 20  |  TCP header 20  |<-------------------- MSS: 1460 (max TCP payload) ------------>|

|  IP header 20  | ICMP header 8   |<----------------- ping payload: 1472 ----------------------->|
```

- **MTU** (Maximum Transmission Unit): the largest IP packet a link can carry. Ethernet is
  1500. Every link has its own, and the **path MTU** is the smallest MTU along the route.
- **MSS** (Maximum Segment Size): the largest TCP *payload* per segment. Each side announces it
  in its SYN (you'll see `mss 1460` in `tcpdump` output), derived from its own interface MTU.
- **PMTUD** (Path MTU Discovery): send packets with DF set. If one is too big for some router's
  next link, that router drops it and sends back **ICMP "Fragmentation Needed"** (type 3, code
  4) with the MTU it can handle. The sender lowers its packet size and retries.

> 🖼️ **Image suggestion:** a path with three links (Ethernet 1500 → VPN tunnel 1420 → Ethernet
> 1500). A 1500-byte DF packet gets to the tunnel router, which sends an ICMP "frag needed,
> MTU 1420" back to the sender, and the retry at 1420 makes it all the way.

## Code walkthrough

**DF is the whole trick.** Without it, routers silently fragment oversized packets and every ping
"succeeds," so you'd learn nothing. Each OS spells the flag differently:

```js
["-n", "1", "-f", "-l", size, host]      // Windows: -f = DF, -l = payload size
["-c", "1", "-M", "do", "-s", size, host] // Linux:   -M do = DF, -s = payload size
["-c", "1", "-D", "-s", size, host]       // macOS:   -D = DF
```

**Binary search** finds the exact boundary in about 13 probes, instead of trying every size
from 64 to 9000.

**A sanity check comes first.** If even a 64-byte ping fails, the host blocks ICMP and every
probe would look "too big," so the script stops instead of reporting a nonsense MTU.

## Why this matters for performance

- **Fragmentation is expensive.** One lost fragment loses the whole packet, routers do more
  work, and many firewalls drop fragments outright. That's why TCP uses MSS and DF to avoid
  fragmentation entirely.
- **PMTUD black holes.** If a firewall on the path blocks *all* ICMP, the "Fragmentation
  Needed" message never arrives. Small packets (the handshake, small requests) work, but large
  ones vanish, and TCP connections hang as soon as a full-size segment is sent. The classic
  symptom is "SSH connects but `ls` on a big directory freezes," or "the page loads but images
  don't." Fixes include MSS clamping on the router, allowing ICMP type 3, and Linux's
  `net.ipv4.tcp_mtu_probing=1`.
- **Bigger isn't always reachable.** Jumbo frames (MTU 9000) speed up bulk transfers inside a
  datacenter, but every hop must support them.

## Try this yourself

- Check your interface MTU: `netsh interface ipv4 show subinterfaces` (Windows) or
  `ip link` (Linux, `mtu 1500`).
- Capture the handshake of any TCP connection and read the `mss` option in each SYN:
  `sudo tcpdump -n 'tcp[tcpflags] & tcp-syn != 0'`. On loopback it's huge (`mss 65495`),
  because loopback's MTU is 65536.
- Run `pmtud.js` on and off a VPN, and work out the overhead: 1500 minus the VPN result is
  roughly the size of the tunnel's headers (WireGuard adds 60-80 bytes, for example).
- On Linux, lower an interface's MTU temporarily (`sudo ip link set dev eth0 mtu 1400`), re-run,
  and confirm the script sees it. Restore it afterwards.

## Real-world equivalent

MSS clamping on VPN gateways, cloud provider docs telling you to set an MTU of 1460 or 8951,
Kubernetes overlay networks (VXLAN adds 50 bytes) lowering pod MTUs, and the "connection hangs
only for large responses" support tickets. They're all this one calculation.
