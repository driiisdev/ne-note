# MSS, MTU and PMTUD

Three related limits on how big a packet can be. Getting them wrong causes fragmentation (slow,
fragile) or, worse, connections that work for small requests and silently hang on large ones.

## MTU (Maximum Transmission Unit)

The largest **IP packet** a link can carry in one frame. Ethernet: **1500 bytes**. Others: PPPoE
1492, many VPN tunnels ~1400-1420, VXLAN overlays 1450, jumbo frames 9000, loopback 65536.
The **path MTU** is the smallest MTU of any link between two hosts - the only number that matters
end to end.

## MSS (Maximum Segment Size)

The largest **TCP payload** in one segment: `MTU − 20 (IP) − 20 (TCP)` = **1460** on Ethernet
(less with TCP options like timestamps). Each side announces its MSS in its **SYN**; the sender
uses the smaller. MSS is how TCP avoids creating packets bigger than the MTU in the first place.

```text
|<------------------------- MTU 1500 ------------------------->|
| IP 20 | TCP 20 |<----------------- MSS 1460 ---------------->|
```

## Fragmentation, and why it's avoided

An oversized IPv4 packet without the DF bit is split by a router into fragments, reassembled only
at the destination. Costs: one lost fragment loses the whole packet, extra router work, and many
firewalls/NATs drop fragments. IPv6 routers never fragment.

## PMTUD (Path MTU Discovery)

1. The sender sets **DF (Don't Fragment)** on its packets.
2. A router whose next link is too small drops the packet and returns **ICMP "Fragmentation
   Needed" (type 3 code 4)** containing the next-hop MTU (ICMPv6 "Packet Too Big" for IPv6).
3. The sender lowers its packet size for that destination and retransmits.

## PMTUD black holes

If a firewall blocks those ICMP messages, the sender never learns. Small packets (handshake, small
requests) work; the first full-size segment vanishes; the connection hangs. Classic symptoms: "SSH
connects but large output freezes", "page loads but big images don't" - often only over a VPN.

Fixes: allow ICMP type 3; **MSS clamping** on routers/VPN gateways (rewrite the MSS option in SYNs
to fit the tunnel); **PLPMTUD** / `net.ipv4.tcp_mtu_probing=1` (probe with packet sizes instead of
relying on ICMP).

🖼️ **a path with links of different mtus, a df packet rejected with icmp frag-needed, and the smaller retry succeeding**
![mtu mss pmtud](<../../assets/img/mtu-mss-pmtud.png>)

## Practice project

[`practice/network-performance/mtu-pmtud`](../../practice/network-performance/mtu-pmtud) -
`pmtud.js` binary-searches the largest DF ping that gets through (found 1500 → MSS 1460 on a
normal connection).

## Related

- [IP packet](<../internet protocol/ip_packet.md>) - DF/MF flags and fragmentation fields.
- [ICMP, ping, traceroute](<../internet protocol/icmp_ping_traceroute.md>) - the message PMTUD needs.
- [TCP segment](<../transmission control protocol/tcp_segment.md>) - the MSS option.
