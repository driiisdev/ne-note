# Networking with Docker

Docker builds real networks out of Linux kernel features: each container gets its own **network
namespace** (interfaces, routing table, ARP cache, firewall rules), connected through virtual
switches and NAT on the host. Understanding it is understanding routing, NAT and DNS in miniature.

## The building blocks

- **Network namespace** per container - its own `eth0`, `lo`, routes.
- **veth pair** - a virtual cable: one end is the container's `eth0`, the other plugs into a bridge.
- **Linux bridge** (`docker0`, or `br-xxxx` per user network) - a virtual switch; its IP (`.1`) is
  the containers' **default gateway**.
- **iptables/nftables** - NAT (MASQUERADE outbound, DNAT for published ports) and isolation rules
  between networks.
- **Embedded DNS** at `127.0.0.11` - resolves container and service names on user-defined networks.

## Network drivers

| Driver | What you get |
| --- | --- |
| `bridge` (default) | private subnet per network, NAT to the outside |
| user-defined bridge | same, plus name-based DNS and better isolation - prefer this over the default bridge |
| `host` | no namespace: shares the host's interfaces (Linux; no port mapping needed) |
| `none` | only loopback |
| `overlay` | spans multiple hosts (Swarm), VXLAN-encapsulated |
| `macvlan` / `ipvlan` | containers get addresses on the physical LAN |

## Traffic paths

- **Container → internet**: default route via the bridge gateway → host routes it → MASQUERADE
  rewrites the source to the host's IP (SNAT).
- **Internet → container** (`-p 8080:80`): DNAT rule on the host rewrites `host:8080` →
  `container:80` (plus a userland proxy for some cases).
- **Container → container, same network**: L2 across the bridge, by name via embedded DNS.
- **Different networks**: isolated by default (iptables drops traffic between bridges). Attach a
  container to both networks, or route through one that is.

## Compose specifics

Each Compose project gets its own default network; services reach each other by **service name**.
`networks:` with `internal: true` removes external routing; `ipam` pins subnets; `ipv4_address`
pins a container's IP.

## Common gotchas

- Server bound to `127.0.0.1` inside a container → unreachable from outside, even if published.
- `-p 5432:5432` publishes on **all** host interfaces (and Docker's iptables rules can bypass a host
  firewall like `ufw`) - use `127.0.0.1:5432:5432` for local-only.
- `localhost` inside a container is the container, not the host (`host.docker.internal` on Docker Desktop).
- Subnet overlaps between Docker networks and your LAN/VPN break routing.

🖼️ **docker host: containers with veth pairs into a bridge, gateway .1, nat to the host nic, published port dnat**
![docker networking](<../../assets/img/docker-networking.png>)

## Practice project

[`practice/network-routing/docker-router-lab`](../../practice/network-routing/docker-router-lab) -
two Docker networks and a router container you configure yourself;
[`practice/network-performance/db-access-control`](../../practice/network-performance/db-access-control)
uses networks as security boundaries.

## Related

- [Fundamentals of network routing](<fundamentals_of_network_routing.md>).
- [NAT](<../transmission control protocol/nat.md>) - what MASQUERADE and `-p` are.
- [Listening server](<../network performance/listening_server.md>) - why containers bind `0.0.0.0`.
