# Network Access Control to Database Servers

A database holds the most valuable data in a system, so it should be reachable by **exactly** the
services that need it and nothing else. Good setups don't rely on one control - they stack several
independent layers, so a single misconfiguration doesn't expose the data.

## Layer 1 - don't expose it

- No public IP; place the database in a **private subnet**.
- Don't publish its port (no Docker `-p`, no load balancer in front, no port forward).
- Bind it narrowly (`listen_addresses`, `bind-address`) to the interface the app uses.

## Layer 2 - network segmentation and firewalls

- Separate networks/subnets for public-facing services, app servers and data stores.
- **Security groups / firewall rules** that allow the DB port only from the app tier - ideally by
  referencing the app's security group or identity, not a wide CIDR.
- Deny egress from the DB network to the internet (limits data exfiltration).
- In Kubernetes: **NetworkPolicy** allowing only pods labelled `app=api` to reach `app=postgres`.

## Layer 3 - the database's own host-based rules

- **Postgres `pg_hba.conf`**: per database, user and source address, which auth method (or
  `reject`). First matching line wins.
- **MySQL**: accounts are `user@host`, so the same username from a different host is a different
  (or nonexistent) account.
- Managed services: "authorized networks" / IP allow-lists.

## Layer 4 - authentication and encryption

- Strong auth (`scram-sha-256`, IAM auth, client certificates) - never `trust` over the network.
- **TLS** (`hostssl` in `pg_hba.conf`, `require_secure_transport` in MySQL) so credentials and data
  can't be read on the path.
- Least privilege: per-service users with only the grants they need.

## Admin access

Not via an open port: through a **bastion/jump host**, a VPN, or cloud session tooling (AWS SSM,
IAP), with access logged.

## Why layers

If segmentation is too coarse (a compromised container lands on the DB network), host-based rules
still refuse it. If a password leaks, the network still won't route an outsider to the port.

🖼️ **network diagram: frontend network, internal backend network with the db, an allowed app and a rejected rogue host, each blocked attempt marked by the layer that stopped it**
![db network access control](<../../assets/img/db-network-access-control.png>)

## Practice project

[`practice/network-performance/db-access-control`](../../practice/network-performance/db-access-control) -
Docker Compose with Postgres on an internal network, a `pg_hba.conf` allowing one IP, and
`test.sh` trying to connect from four places.

## Related

- [Listening server](<listening_server.md>) - layer 1 in code.
- [Networking with Docker](<../network routing/networking_with_docker.md>) - networks as isolation boundaries.
- [Private IP addresses](<../internet protocol/private_ip_addresses.md>).
- [Postgres failure caused by a Cisco router](<../miscellaneous/postgres_failure_caused_by_a_cisco_router_(tcp_issue).md>) -
  what middleboxes between app and DB can do.
