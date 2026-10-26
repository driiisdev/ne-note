# Practice: Subnets and Routing

Concept notes: [`the_ip_building_blocks.md`](<../../../concepts/internet protocol/the_ip_building_blocks.md>) ·
[`routing.md`](<../../../concepts/internet protocol/routing.md>) ·
[`private_ip_addresses.md`](<../../../concepts/internet protocol/private_ip_addresses.md>)

## What this demonstrates

The arithmetic behind IP addressing, so that "/26" or "longest prefix match" become something you
can compute instead of something you look up:

- **`subnet-calc.js`**: from one `address/prefix`, derives the netmask, wildcard mask, network
  address, broadcast address, usable host range and host count. It also says whether the address
  is private (RFC 1918), CGNAT, loopback, link-local or public.
- **`route-lookup.js`**: a router's forwarding decision. Given a small routing table, it finds
  every route that contains the destination and picks the **longest prefix**.

## Folder structure

```text
subnet-and-routing/
  ip-utils.js       <- IPv4 <-> 32-bit integer, prefix -> mask, special-range classification
  subnet-calc.js    <- node subnet-calc.js <cidr> [<cidr> ...]
  route-lookup.js   <- node route-lookup.js [<dest-ip> ...]
```

## Run it

```bash
node subnet-calc.js                        # built-in examples
node subnet-calc.js 192.168.1.130/26       # your own
node route-lookup.js                       # built-in destinations
node route-lookup.js 10.50.9.9 192.168.10.4
```

## What you'll see

```text
192.168.1.130/26
  netmask     : 255.255.255.192
  network     : 192.168.1.128/26
  broadcast   : 192.168.1.191
  host range  : 192.168.1.129 - 192.168.1.190
  usable hosts: 62
  address kind: private (RFC 1918)
  binary mask : 11111111.11111111.11111111.11000000
```

```text
10.50.3.4
  matches : 10.50.0.0/16, 10.0.0.0/8, 0.0.0.0/0
  chosen  : 10.50.0.0/16 -> 172.16.0.9 (HQ datacenter link) (dev tun1)
```

## Code walkthrough

**An IPv4 address is a 32-bit number.** Dotted-quad notation is only for humans. Once the
address is an integer, "which network is this in?" is a single bitwise AND with the mask:

```js
const networkOf = (ipInt, mask) => (ipInt & mask) >>> 0;
```

(`>>> 0` forces JavaScript back to an *unsigned* 32-bit result. Without it, any address above
`128.0.0.0` would come out negative.)

**Two addresses per subnet are reserved:** the all-zeros host part (the network itself) and the
all-ones host part (broadcast). That's why a /24 has 254 usable hosts, not 256. The exceptions
are /31 (point-to-point links, RFC 3021) and /32 (a single host):

```js
const usable = prefix >= 31 ? total : total - 2;
```

**Longest prefix match** is just "filter the routes that contain the destination, then sort by
prefix length descending." `10.50.3.4` matches the /8 VPN route *and* the /16 datacenter route.
The /16 wins because it's more specific:

```js
candidates.sort((a, b) => b.net.prefix - a.net.prefix); // longest prefix first
```

> 🖼️ **Image suggestion:** a routing-table lookup diagram that shows the destination's bits lined
> up against each route's prefix bits, with the matching portion highlighted. The /16 visibly
> matches more bits than the /8.

## Private addresses and why they exist

| Range | Size | Typical use |
| --- | --- | --- |
| `10.0.0.0/8` | ~16.7M | large corporate networks, cloud VPCs |
| `172.16.0.0/12` | ~1M | Docker's default bridge networks (`172.17.0.0/16` and up) |
| `192.168.0.0/16` | ~65K | home and small-office routers |
| `100.64.0.0/10` | ~4M | carrier-grade NAT, between your router and your ISP (not RFC 1918) |

Public routers don't forward these ranges, so millions of networks can reuse the same addresses
privately. NAT (see `practice/transmission-control-protocol/nat-simulator`) rewrites them to a
public address at the edge.

## Try this yourself

- Run `ipconfig` (Windows) or `ip addr` (Linux), paste your own address/prefix into
  `subnet-calc.js`, and check that the network matches what your router's admin page says.
- Look at your real routing table with `route print` (Windows) or `ip route` (Linux). Find the
  `0.0.0.0/0` default route and your LAN's on-link route, then add them to `ROUTES` in
  `route-lookup.js` and test destinations against your actual table.
- Add a `/32` host route for `10.50.3.4` that points somewhere else, and confirm it beats the /16.
  This is how traffic for one specific host gets steered, for example around a broken link.
- Split `192.168.1.0/24` into four /26 subnets by hand, then check each one with
  `subnet-calc.js`.

## Real-world equivalent

`route-lookup.js` is a simplified version of the Forwarding Information Base every router and OS
kernel keeps. Real routers do the same longest-prefix match in hardware (with TCAM or tries) for
millions of packets per second. `subnet-calc.js` is the calculation you'll do when you size a
cloud VPC or carve up subnets for Docker or Kubernetes networks.
