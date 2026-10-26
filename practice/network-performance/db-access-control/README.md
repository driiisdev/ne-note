# Practice: Network Access Control to Database Servers

Concept notes: [`network_access_control_to_database_servers.md`](<../../../concepts/network performance/network_access_control_to_database_servers.md>) ·
related: [`listening_server.md`](<../../../concepts/network performance/listening_server.md>)

## What this demonstrates

A database should be reachable by exactly the services that need it, and by nothing else. This
lab puts Postgres behind **three independent layers** and then tries to reach it from four places
to show which layer stops each attempt:

| Layer | Mechanism here | Real-world equivalent |
| --- | --- | --- |
| 1. Not exposed | no `ports:` mapping, so nothing on the host or internet can reach 5432 | no public IP, DB in a private subnet |
| 2. Network segmentation | DB only on the `backend` network (`internal: true`) | VPC subnets, security groups, firewall rules |
| 3. Host-based auth | `pg_hba.conf` only allows the app's exact IP | `pg_hba.conf`, MySQL `user@host`, DB firewall rules |

## Folder structure

```text
db-access-control/
  docker-compose.yml   <- db, app, rogue, outsider + frontend/backend networks
  pg_hba.conf          <- Postgres client authentication rules (mounted into the db)
  test.sh              <- tries to connect from each place, prints ALLOWED/BLOCKED + why
```

```text
                 frontend network                 backend network (internal: true)
            +--------------------------+     +------------------------------------+
 outsider --+                          |     |                                    |
            |          app ------------+-----+-- 172.30.0.10    db 172.30.0.5     |
            +--------------------------+     |   rogue 172.30.0.20                |
                                             +------------------------------------+
   host / internet: no published port -> nothing reaches 5432
```

## Run it

Needs Docker (Docker Desktop on Windows/macOS). Run `test.sh` from Git Bash, WSL, or any bash.

```bash
docker compose up -d
bash test.sh
docker compose down
```

## What you should see

*(Not run while this was written, because Docker was unavailable. `docker compose config`
validates the file. Each line is the expected outcome and the layer responsible for it.)*

```text
== app (backend network, allowed IP)
   ALLOWED: connected as app from 172.30.0.10

== rogue (backend network, wrong IP) -> stopped by pg_hba.conf
   BLOCKED: ... pg_hba.conf rejects connection for host "172.30.0.20", user "app", database "shop" ...

== outsider (frontend only) by name -> 'db' doesn't even resolve
   BLOCKED: ... could not translate host name "db" to address ...

== outsider (frontend only) by IP -> no route to the backend network
   BLOCKED: ... timeout expired

== host machine on localhost:5432 -> port was never published
   BLOCKED: ... Connection refused

== rogue -> internet (backend is internal: no egress either)
   BLOCKED: wget: bad address 'example.com'
```

(If something on your machine is already listening on `localhost:5432`, like a locally
installed Postgres, the host check will report that instead.)

> 🖼️ **Image suggestion:** the network diagram above as a proper figure, with a red ✗ at each
> point where an attempt is stopped, labelled with the layer that stopped it.

## Code walkthrough

**Layer 1: simply don't publish the port.** No `ports:` on the `db` service means Docker never
creates a host-side listener. The safest port is the one that isn't open.

**Layer 2: Docker networks are isolation boundaries.** Containers can only reach containers on
networks they share, and Docker's embedded DNS only resolves names on those networks. That's why
`outsider` can't even resolve `db`. `internal: true` also removes the route to the outside world,
so a compromised container on `backend` can't exfiltrate data directly to the internet.

```yaml
networks:
  backend:
    internal: true
```

**Layer 3: `pg_hba.conf`, first match wins:**

```text
host    shop      app   172.30.0.10/32   scram-sha-256   # the app, with a password
host    all       all   0.0.0.0/0        reject          # everyone else, no password prompt
```

`rogue` *can* reach port 5432 at the network level, which is what happens when segmentation
fails or is too coarse. Postgres still refuses it before asking for a password, based on its
source IP. That's **defense in depth**: any one layer can be misconfigured without the database
being exposed.

## Best practices this models

- Databases live in private subnets with **no public IP**, and admins reach them via a bastion,
  VPN or SSM rather than an open port.
- **Security groups reference other security groups** ("allow 5432 from the app tier's SG"),
  not wide CIDR ranges. That's the cloud equivalent of `pg_hba.conf`'s `/32`.
- **Least privilege at every layer**: a specific database, a specific user, a specific source,
  and a strong auth method (`scram-sha-256`, never `trust` over the network).
- **Encrypt anyway** (`hostssl` in `pg_hba.conf`). Network controls stop strangers, but TLS stops
  anyone already on the path.

## Try this yourself

- Change the last `pg_hba.conf` line from `reject` to `scram-sha-256` and re-run
  (`docker compose restart db`). `rogue` now gets a *password prompt* instead of an immediate
  rejection. With a leaked password it's in, which is why the IP restriction matters.
- Add `ports: ["5432:5432"]` to `db` and re-run. The host check flips to reachable. Then bind it
  to loopback only (`"127.0.0.1:5432:5432"`) and compare. See
  `practice/network-performance/listening-addresses`.
- Inside the db container, run `docker compose exec db psql -U app -d shop -c "select * from pg_hba_file_rules"`
  to see how Postgres parsed your rules.

## Real-world equivalent

AWS RDS in private subnets with security groups, GCP Cloud SQL with private IP and authorized
networks, and Kubernetes `NetworkPolicy` objects that only allow the `api` pods to reach the
`postgres` pods all apply the same three layers.
