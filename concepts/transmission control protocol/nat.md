# NAT (Network Address Translation)

A router feature that **rewrites IP addresses (and usually ports) in packets as they pass
through**. Its main use is letting many devices with private addresses share a single public IP.
It's covered alongside TCP because the common form, **PAT/NAPT**, works by tracking transport-layer
ports and connections.

## How PAT works (the home router case)

1. Laptop `192.168.1.10:51000` sends to `93.184.216.34:443`.
2. The router rewrites the **source** to its public address and a free port:
   `203.0.113.7:40000`, and records the mapping in its **NAT table**.
3. The server replies to `203.0.113.7:40000`. The router looks up port 40000, rewrites the
   **destination** back to `192.168.1.10:51000`, and forwards it inside.
4. A second laptop also using source port 51000 gets public port 40001 - the public port is what
   keeps flows apart.

Checksums (IP and TCP/UDP) are recalculated after every rewrite.

## Types

- **SNAT / masquerade**: rewrite the source on the way out (home routers, cloud NAT gateways,
  Docker containers reaching the internet).
- **DNAT / port forwarding**: rewrite the destination on the way in - `public:8080 → 192.168.1.20:80`
  (Docker `-p`, router port forwards, many load balancers).
- **CGNAT**: the ISP NATs many customers behind a few public IPs (`100.64.0.0/10` between you and
  the ISP) - double NAT.

## Consequences

- **Inbound connections are dropped** unless a mapping or port forward exists - which is why
  hosting from home needs port forwarding or a tunnel, and why peer-to-peer apps need STUN/TURN
  and hole punching.
- **NAT is stateful**: every flow uses table memory, and **idle mappings are evicted**, often
  silently (minutes for TCP, ~30 s for UDP). Long-idle connections die without either end knowing
  - keepalives prevent this.
- **Port exhaustion**: one public IP has ~64K ports per destination; heavy CGNAT can run out.
- Breaks protocols that embed IP addresses in their payload (FTP active mode, SIP) without
  application-level helpers.

🖼️ **nat table diagram: two laptops, router rewriting source ip:port, replies mapped back**
![nat](<../../assets/img/nat.png>)

## Practice project

[`practice/transmission-control-protocol/nat-simulator`](../../practice/transmission-control-protocol/nat-simulator) -
a scripted PAT router: port allocation, reply translation, dropped unsolicited traffic, port
forwarding, and silent idle eviction.

## Related

- [Private IP addresses](<../internet protocol/private_ip_addresses.md>) - why NAT is needed.
- [Postgres failure caused by a Cisco router](<../miscellaneous/postgres_failure_caused_by_a_cisco_router_(tcp_issue).md>) -
  silent idle eviction in production.
- [Exposing local servers publicly](<../miscellaneous/exposing_local_servers_publicly.md>) - getting through NAT inbound.
- [Networking with Docker](<../network routing/networking_with_docker.md>) - NAT in every container host.
