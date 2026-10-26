# ICMP, Ping and Traceroute

**ICMP** (Internet Control Message Protocol) is IP's companion for **errors and diagnostics**. It
rides directly inside IP (protocol number 1, no ports) and is how the network tells a sender
"that didn't work, and here's why". `ping` and `traceroute` are both built on it.

## Common ICMP messages

| Type / code | Name | Sent when |
| --- | --- | --- |
| 8 / 0 | Echo Request | `ping` asks "are you there?" |
| 0 / 0 | Echo Reply | the answer |
| 3 / 0, 1, 3 | Destination Unreachable (net / host / port) | no route, host down, or nothing listening on a UDP port |
| 3 / 4 | Fragmentation Needed | packet too big for the next link and DF is set (drives PMTUD) |
| 11 / 0 | Time Exceeded | TTL reached 0 at a router (drives traceroute) |

## Ping

Sends Echo Requests with an **identifier** and **sequence number**, and measures how long each
Echo Reply takes.

- Tells you: reachability, **round-trip time**, packet loss, and (from the reply's TTL) roughly how
  many hops away the host is (Linux starts at 64, Windows at 128, many devices at 255).
- Doesn't tell you: whether a TCP service is up - a host can answer pings with its web server
  down, or block ICMP while serving traffic fine.

## Traceroute

Discovers the path by abusing TTL:

1. Send a probe with **TTL = 1**. The first router decrements it to 0, drops it, and sends back
   **Time Exceeded** from its own IP: hop 1 revealed.
2. Send with TTL = 2: hop 2 reveals itself. Repeat until the destination answers (Echo Reply, or
   Port Unreachable for UDP probes).

Linux `traceroute` uses UDP probes to high ports by default (`-I` for ICMP, `-T` for TCP);
Windows `tracert` uses ICMP Echo. `* * *` means a hop didn't answer - often a router that
deprioritizes or blocks ICMP, not necessarily a broken path.

## Why blocking all ICMP is a mistake

Firewalls often drop ICMP "for security", but Fragmentation Needed is essential: without it,
**Path MTU Discovery** breaks and large TCP packets silently disappear (a PMTUD black hole).
Allow at least type 3 (and ideally 0, 8, 11).

🖼️ **traceroute: probes with ttl 1, 2, 3 and the time exceeded replies coming back from each router**
![ping traceroute](<../../assets/img/ping-traceroute.png>)

## Practice project

[`practice/internet-protocol/ip-packet-inspector`](../../practice/internet-protocol/ip-packet-inspector) -
decodes an Echo Request byte by byte, and `capture.sh ttl` watches Time Exceeded replies arrive
while traceroute runs.

## Related

- [IP packet](<ip_packet.md>) - the TTL field traceroute depends on.
- [MSS, MTU, PMTUD](<../network performance/mss_mtu_pmtud.md>) - why ICMP type 3 code 4 matters.
- [Capturing IP, ARP, ICMP packets with tcpdump](<capturing_ip_arp_icmp_packet_with_tcpdump.md>).
