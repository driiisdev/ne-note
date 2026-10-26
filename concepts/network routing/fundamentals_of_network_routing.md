# Fundamentals of Network Routing

Routing is how packets cross from one network to another. Any device with interfaces on more than
one network and **IP forwarding** enabled can be a router - a home router, a Linux box, a container.
Each one makes a local decision per packet; together they deliver traffic across the internet.

## What turns a host into a router

- **Interfaces on multiple networks** (e.g. `10.10.1.254` on net A, `10.10.2.254` on net B).
- **IP forwarding on**: normally a host drops packets not addressed to itself; with forwarding
  (`net.ipv4.ip_forward=1`) it looks them up and sends them on.
- **Routes** telling it where each destination network is.

## The forwarding decision

1. Packet arrives; destination IP isn't one of mine.
2. Longest-prefix match in the routing table → outgoing interface and next hop.
3. Decrement TTL (drop + ICMP Time Exceeded at 0), recompute the header checksum.
4. ARP for the next hop's MAC, send a new frame. IPs unchanged; MACs rewritten per hop.

## Routes in both directions

Every host on the path needs a route **to** the destination, and the destination needs a route
**back**. A missing return route is the classic failure: requests arrive, replies go to the wrong
gateway and vanish. `tcpdump` on the destination makes it obvious.

## Static vs dynamic routing

- **Static**: configured by hand. Simple, predictable, doesn't adapt to failures. Fine for small
  networks and default routes.
- **Dynamic**: routers exchange reachability with protocols and recompute on failure:
  - **Interior (IGP)** inside one organization - **OSPF**, **IS-IS** (link-state, shortest path by
    cost), RIP (legacy distance-vector).
  - **Exterior** between organizations - **BGP**: each Autonomous System announces the prefixes it
    can reach; selection is policy-driven. BGP misconfigurations cause most large internet outages.

## Firewalls and routing

Routers often filter while forwarding. On Linux, `iptables`/`nftables` has an `INPUT` chain
(traffic **to** the router itself) and a `FORWARD` chain (traffic **through** it) - blocking FORWARD
stops routing while the router itself still answers pings.

## Debugging tools

`ip route` / `route print` (routing table), `ip route get <ip>` (which route wins), `traceroute`
(the path), `ip neigh` / `arp -a` (next-hop MACs), `tcpdump -e` on each interface (watch a packet
cross the router).

🖼️ **two subnets joined by a router: one packet's journey with ip unchanged, macs rewritten, ttl 64 → 63**
![network routing](<../../assets/img/network-routing.png>)

## Practice project

[`practice/network-routing/docker-router-lab`](../../practice/network-routing/docker-router-lab) -
two subnets and a Linux router container: ping across, traceroute the hop, watch ARP and tcpdump,
then break forwarding and the return route on purpose.

## Related

- [Routing](<../internet protocol/routing.md>) - longest prefix match.
- [Networking with Docker](<networking_with_docker.md>).
- [ICMP, ping, traceroute](<../internet protocol/icmp_ping_traceroute.md>).
- [Host to host communication](<../fundamentals of networking/host_to_host_communication.md>).
