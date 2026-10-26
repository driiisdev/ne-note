# IP Packet

The unit of data at layer 3: a **header** (at least 20 bytes in IPv4) followed by a **payload**
(usually a TCP segment, UDP datagram or ICMP message). Routers read only the header; everything
they do - forward, drop, fragment, send an error - is driven by its fields.

## The IPv4 header

```text
 0               8               16              24              32
+-------+-------+---------------+-------------------------------+
|Version|  IHL  |   DSCP / ECN  |         Total Length          |
+-------+-------+---------------+-----+-------------------------+
|        Identification         |Flags|     Fragment Offset     |
+---------------+---------------+-----+-------------------------+
|      TTL      |   Protocol    |        Header Checksum        |
+---------------+---------------+-------------------------------+
|                       Source IP Address                       |
+---------------------------------------------------------------+
|                    Destination IP Address                     |
+---------------------------------------------------------------+
|                    Options (rare, if IHL > 5)                 |
+---------------------------------------------------------------+
```

## The fields that matter most

- **Version**: 4 (or 6 for IPv6, which has a different header).
- **IHL** (Internet Header Length): header size in 32-bit words. `5` = 20 bytes, no options.
- **DSCP / ECN**: traffic class for QoS, and Explicit Congestion Notification bits that let
  routers signal congestion without dropping packets.
- **Total length**: header + payload, max 65,535 bytes - but the link's **MTU** (1500 on Ethernet)
  is the real limit.
- **Identification, flags, fragment offset**: fragmentation. `DF` (Don't Fragment) forbids
  routers from splitting the packet; `MF` (More Fragments) marks all fragments but the last.
- **TTL** (Time To Live): decremented by every router; at 0 the packet is dropped and an ICMP
  "Time Exceeded" is sent back. Stops routing loops from circulating packets forever - and is
  what `traceroute` exploits.
- **Protocol**: what the payload is - `1` ICMP, `6` TCP, `17` UDP.
- **Header checksum**: covers the header only; recomputed at every hop because TTL changes.
- **Source / destination IP**: stay the same end to end, unless a NAT rewrites them.

## Fragmentation

If a packet is larger than the next link's MTU and DF is not set, a router splits it into
fragments that are only reassembled at the destination. Losing one fragment loses the whole
packet, so modern stacks avoid it: TCP sizes segments with MSS, and sets DF to discover the path
MTU instead (PMTUD). IPv6 routers never fragment at all.

🖼️ **ipv4 header grid with a real packet's values filled into each field**
![ipv4 header](<../../assets/img/ipv4-header.png>)

## Practice project

[`practice/internet-protocol/ip-packet-inspector`](../../practice/internet-protocol/ip-packet-inspector) -
`parse-packet.js` decodes a raw frame from `tcpdump -xx` field by field and verifies the header
checksum.

## Related

- [The IP building blocks](<the_ip_building_blocks.md>) - addresses and subnets.
- [ICMP, ping, traceroute](<icmp_ping_traceroute.md>) - TTL and error messages in use.
- [MSS, MTU, PMTUD](<../network performance/mss_mtu_pmtud.md>) - sizing packets to avoid fragmentation.
- [TCP segment](<../transmission control protocol/tcp_segment.md>) and
  [user datagram structure](<../user datagram protocol/user_datagram_structure.md>) - what rides inside.
