# Routing

How a packet finds its way across many networks. Every router (and every host) makes an
independent, **hop-by-hop** decision: look at the destination IP, find the best match in its own
routing table, and hand the packet to the next hop. No single device knows the whole path.

## The routing table

Each entry maps a destination prefix to where packets should go:

```text
destination        next hop         interface
192.168.10.0/24    (directly connected)  lan0
10.0.0.0/8         172.16.0.1        tun0
10.50.0.0/16       172.16.0.9        tun1
0.0.0.0/0          203.0.113.1       wan0     <- default route
```

## Longest prefix match

A destination often matches several entries. The **most specific** (longest prefix) wins:

- `10.50.3.4` matches `/8`, `/16` and `/0` → the `/16` wins.
- `10.9.8.7` matches `/8` and `/0` → the `/8` wins.
- `142.250.80.46` matches only `/0` → default route.

This lets broad routes be overridden by specific ones without rewriting the table.

## What a router does with each packet

1. Receive the frame, check it's addressed to its MAC, strip the L2 header.
2. Decrement **TTL**; if it hits 0, drop and send ICMP Time Exceeded.
3. Longest-prefix-match the destination IP; no match and no default → drop, ICMP Unreachable.
4. ARP for the next hop's MAC (if needed), re-wrap in a new frame, send out the chosen interface.

The IP addresses don't change (unless NAT is involved); the MAC addresses change every hop.

## Where routes come from

- **Connected**: automatically added for each interface's own subnet.
- **Static**: configured by hand (`ip route add 10.10.2.0/24 via 10.10.1.254`).
- **Dynamic**: learned from routing protocols - **OSPF/IS-IS** inside an organization (fastest
  path by link cost), **BGP** between organizations (the internet's routing protocol, policy-driven,
  between Autonomous Systems).

## Common failures

- **Missing return route**: the request arrives, the reply goes somewhere else. Routing is
  per direction; asymmetric routing also confuses stateful firewalls.
- **Routing loops**: two routers pointing at each other; TTL eventually kills the packet.
- **Black holes**: a route to a next hop that silently drops.

🖼️ **routing table lookup: destination bits lined up against each prefix, longest match highlighted**
![routing table lookup](<../../assets/img/routing-table-lookup.png>)

## Practice project

[`practice/internet-protocol/subnet-and-routing`](../../practice/internet-protocol/subnet-and-routing) -
`route-lookup.js` runs longest prefix match against a small office router's table.
[`practice/network-routing/docker-router-lab`](../../practice/network-routing/docker-router-lab)
builds a real routed network to break and fix.

## Related

- [The IP building blocks](<the_ip_building_blocks.md>) - prefixes and masks.
- [Fundamentals of network routing](<../network routing/fundamentals_of_network_routing.md>) - the deeper dive.
- [ICMP, ping, traceroute](<icmp_ping_traceroute.md>) - seeing the path hop by hop.
