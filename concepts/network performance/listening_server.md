# Listening Server

A server doesn't just listen on a **port** - it listens on an **address and port**. The bind address
decides which network interfaces can reach the service, which makes it both a security decision and
a frequent cause of "works locally, unreachable elsewhere" bugs.

## The bind address options

| Bind to | Reachable via | Typical use |
| --- | --- | --- |
| `127.0.0.1` (or `::1`) | loopback only - this machine | databases, admin endpoints, local dev, sidecars |
| a specific IP (e.g. `10.0.0.53`) | that one interface | multi-homed hosts: public API on one NIC, metrics on a private one |
| `0.0.0.0` | every IPv4 interface | public services, anything inside a container |
| `::` | every IPv6 interface (and IPv4 on dual-stack systems) | the default in many runtimes |

A connection must arrive on an interface/address the socket is bound to - otherwise the OS answers
with a RST (connection refused), or a firewall silently drops it.

## Defaults vary - check them

- Node `server.listen(3000)` with no host binds to `::` - **every interface**.
- Many dev servers (Vite, Rails, Django) default to localhost; you pass `--host 0.0.0.0` to test
  from a phone.
- Databases: Postgres `listen_addresses = 'localhost'`, MySQL `bind-address = 127.0.0.1`, Redis
  `bind 127.0.0.1` (and protected mode) - deliberately local by default.

## Containers flip the intuition

Inside a Docker container, `127.0.0.1` is the **container's** loopback. Published ports
(`-p 8080:8080`) arrive on the container's `eth0`, so a server bound to `127.0.0.1` inside the
container is unreachable even with the port published. Containerized servers must bind `0.0.0.0`.
Conversely, `docker run -p 127.0.0.1:5432:5432` publishes only on the **host's** loopback.

## Security implications

Binding a database or admin panel to `0.0.0.0` on a host with a public IP puts it on the internet;
exposed Redis/MongoDB/Elasticsearch instances are a classic breach source. Bind narrowly **and**
firewall; defense in depth. Audit with `ss -ltnp` (Linux) or `netstat -an | findstr LISTENING`
(Windows) - look for unexpected `0.0.0.0` / `[::]` entries.

## Related socket options

`SO_REUSEADDR` (rebind while old connections linger in TIME_WAIT), `SO_REUSEPORT` (several
processes share one port, kernel load-balances), and the `listen()` backlog (accept-queue size).

🖼️ **a host with interfaces (lo, wi-fi, docker0) and three listening sockets; arrows show which interface reaches which socket**
![listening addresses](<../../assets/img/listening-addresses.png>)

## Practice project

[`practice/network-performance/listening-addresses`](../../practice/network-performance/listening-addresses) -
the same service bound to `127.0.0.1`, `0.0.0.0` and the LAN IP, probed from every local address.

## Related

- [Client-server architecture](<../fundamentals of networking/client_server_architecture.md>).
- [Network access control to database servers](<network_access_control_to_database_servers.md>).
- [Sockets, connections and kernel queues](<../transmission control protocol/sockets_connection_and_kernel_queues.md>).
- [Networking with Docker](<../network routing/networking_with_docker.md>).
