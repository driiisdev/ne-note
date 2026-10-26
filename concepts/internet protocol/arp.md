# ARP (Address Resolution Protocol)

The glue between layer 3 and layer 2. A host knows the **IP** it wants to reach, but Ethernet
frames are delivered by **MAC address**. ARP answers the question "who on this local network has
IP X, and what's your MAC?"

## How it works

1. Host A (`192.168.1.10`) needs to send to `192.168.1.1` (its gateway) and has no ARP cache entry.
2. A broadcasts an **ARP request** to `ff:ff:ff:ff:ff:ff`: *"who has 192.168.1.1? tell
   192.168.1.10"* - including A's own IP and MAC.
3. Every host on the segment receives it; only the owner of `192.168.1.1` answers, with a
   **unicast ARP reply**: *"192.168.1.1 is at 3c:52:82:aa:bb:01"*.
4. A caches the mapping (typically for seconds to minutes) and sends the frame. The target also
   learns A's mapping from the request, so it doesn't need to ARP back.

ARP runs directly on Ethernet (EtherType `0x0806`) - there's no IP header, because finding the
MAC is a prerequisite for sending IP in the first place.

## ARP only works locally

ARP requests are broadcasts, and routers don't forward broadcasts. So a host **only ever ARPs for
addresses on its own subnet** - for a remote destination it ARPs for the *gateway* instead. You
will never see the MAC of `8.8.8.8` in your ARP cache.

## Variations

- **Gratuitous ARP**: a host announces its own IP→MAC mapping unprompted - used when an IP moves
  to a new machine (failover, VRRP/keepalived), so everyone updates their caches immediately.
- **Proxy ARP**: a router answers ARP on behalf of hosts on another network.
- **IPv6**: replaced by Neighbor Discovery Protocol (ICMPv6 Neighbor Solicitation/Advertisement).

## Security: ARP spoofing

ARP has no authentication - hosts believe any reply. An attacker on the same LAN can claim to be
the gateway, receive everyone's traffic, and forward it (man in the middle). Mitigations: Dynamic
ARP Inspection on managed switches, static entries for critical hosts, and encryption (TLS) so
intercepted traffic is useless.

🖼️ **arp request broadcast to all hosts, unicast reply from the owner, cache entry created**
![arp](<../../assets/img/arp.png>)

## Practice project

[`practice/internet-protocol/ip-packet-inspector`](../../practice/internet-protocol/ip-packet-inspector) -
`parse-packet.js sample-arp` decodes an ARP request; `capture.sh arp` shows a live
request/reply after flushing the cache.

## Related

- [Host to host communication](<../fundamentals of networking/host_to_host_communication.md>) -
  where ARP fits in sending a packet.
- [Capturing IP, ARP, ICMP packets with tcpdump](<capturing_ip_arp_icmp_packet_with_tcpdump.md>).
- [Routing](<routing.md>) - why remote destinations mean ARPing for the gateway.
