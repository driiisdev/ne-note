# The IP Building Blocks

The Internet Protocol (IP) is layer 3: it gives every host an address and moves packets between
networks, **best effort** - no guarantee of delivery, order, or no duplicates. Everything else
(reliability, ports, encryption) is layered on top. Four building blocks make IP work: the
address, the subnet, the gateway, and the routing table.

## The IPv4 address

- A **32-bit number**, written as four octets for humans: `192.168.1.10` =
  `11000000.10101000.00000001.00001010`.
- About 4.3 billion addresses in total - not enough for every device, which is why private ranges
  and NAT exist (and why IPv6, with 128-bit addresses, was created).
- Split into a **network part** and a **host part**. Which bits are which is defined by the prefix.

## Subnet and prefix (CIDR)

`192.168.1.10/24` means the first 24 bits are the network, the last 8 the host.

| Notation | Mask | Hosts usable |
| --- | --- | --- |
| `/8` | `255.0.0.0` | 16,777,214 |
| `/16` | `255.255.0.0` | 65,534 |
| `/24` | `255.255.255.0` | 254 |
| `/26` | `255.255.255.192` | 62 |
| `/30` | `255.255.255.252` | 2 |

- **Network address** = all host bits 0 (`192.168.1.0`); **broadcast** = all host bits 1
  (`192.168.1.255`). Neither is usable by a host, hence "minus 2" (except /31 and /32).
- Same network ⇔ `(ipA & mask) == (ipB & mask)`. That one AND decides whether a host talks to a
  destination directly or through a gateway.

## Default gateway

The router address on your subnet that receives everything not destined for the local network.
Without it, you can reach your LAN and nothing else.

## Routing table

Every host (not just routers) has one. It maps destination prefixes to "deliver directly on this
interface" or "send to this next hop". The most specific matching prefix wins; `0.0.0.0/0` (the
default route) matches anything as a last resort.

## IPv6 in one paragraph

128-bit addresses written in hex (`2001:db8::1`), so many that NAT isn't needed; a `/64` per LAN;
ARP is replaced by Neighbor Discovery (ICMPv6); no broadcast (multicast instead); a simpler,
fixed 40-byte header with no in-network fragmentation.

🖼️ **an ip address split into network and host bits, with the mask underneath and the AND result**
![ip building blocks](<../../assets/img/ip-building-blocks.png>)

## Practice project

[`practice/internet-protocol/subnet-and-routing`](../../practice/internet-protocol/subnet-and-routing) -
`subnet-calc.js` derives mask, network, broadcast, host range and address kind from any CIDR.

## Related

- [IP packet](<ip_packet.md>) - what IP actually puts on the wire.
- [Routing](<routing.md>) - how routing tables are used hop by hop.
- [Private IP addresses](<private_ip_addresses.md>) - the reserved ranges and why they exist.
- [Host to host communication](<../fundamentals of networking/host_to_host_communication.md>) -
  the on-link vs gateway decision in action.
