# Private IP Addresses

Address ranges reserved (RFC 1918) for use **inside** networks. Anyone may use them, any number of
networks can reuse the same ones, and public internet routers will not route them. They exist
because IPv4 has only ~4.3 billion addresses - far fewer than devices.

## The ranges

| Range | CIDR | Size | Typically seen in |
| --- | --- | --- | --- |
| `10.0.0.0` - `10.255.255.255` | `10.0.0.0/8` | ~16.7M | corporate networks, cloud VPCs, Kubernetes |
| `172.16.0.0` - `172.31.255.255` | `172.16.0.0/12` | ~1M | Docker bridge networks (`172.17.0.0/16`...) |
| `192.168.0.0` - `192.168.255.255` | `192.168.0.0/16` | ~65K | home and small-office routers |

Other special ranges often confused with them:

| Range | Purpose |
| --- | --- |
| `100.64.0.0/10` | **Carrier-grade NAT** shared space between your router and your ISP (RFC 6598) |
| `127.0.0.0/8` | loopback - never leaves the host |
| `169.254.0.0/16` | link-local - self-assigned when DHCP fails (APIPA); also cloud metadata (`169.254.169.254`) |

## How private hosts reach the internet

Through **NAT**: the router rewrites the private source address (and port) to its own public
address on the way out, and back on the way in. That's why your laptop's IP (`192.168.1.23`)
differs from what websites see (`curl ifconfig.me`).

## Consequences

- **Not reachable from outside** without a port forward, VPN or tunnel - a side benefit, but not
  real security.
- **Overlaps** are common: merging two companies that both use `10.0.0.0/8`, or a VPN to a network
  that uses the same range as your home LAN, causes routing conflicts. Plan cloud VPC ranges to
  avoid overlapping with offices and partners.
- Being on a private network does not make a service safe - anything else on that network can
  reach it.

🖼️ **a home network with private addresses behind a router doing nat to one public ip**
![private ip addresses](<../../assets/img/private-ip-addresses.png>)

## Practice project

[`practice/internet-protocol/subnet-and-routing`](../../practice/internet-protocol/subnet-and-routing) -
`subnet-calc.js` classifies any address as private, CGNAT, loopback, link-local or public.

## Related

- [NAT](<../transmission control protocol/nat.md>) - how private hosts share a public address.
- [The IP building blocks](<the_ip_building_blocks.md>) - CIDR notation.
- [Exposing local servers publicly](<../miscellaneous/exposing_local_servers_publicly.md>) - getting
  traffic *into* a private network.
