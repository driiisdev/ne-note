# Practice: Listening Addresses

Concept notes: [`listening_server.md`](<../../../concepts/network performance/listening_server.md>)

## What this demonstrates

When a server "listens on port 5602," the more important question is **on which address**. A
listening socket is bound to an `(IP, port)` pair, and that IP decides who can reach it. That
makes the bind address both a security decision and a common source of "works on my machine"
bugs. `server.js` runs the same service bound three ways, and `probe.js` checks which ones
answer through each local address.

## Folder structure

```text
listening-addresses/
  server.js   <- node server.js     binds :5601 to 127.0.0.1, :5602 to 0.0.0.0, :5603 to your LAN IP
  probe.js    <- node probe.js [ip...]   connect to all 3 ports via every local IPv4 address
```

## Run it

```bash
node server.js                         # terminal 1
node probe.js                          # terminal 2
node probe.js <server-lan-ip>          # from ANOTHER machine on the same network
```

## What you'll see

Captured on Windows, with a Wi-Fi interface plus two Hyper-V/WSL virtual interfaces:

```text
connect to        :5601 (127.0.0.1)       :5602 (0.0.0.0)         :5603 (LAN IP)
------------------------------------------------------------------------------------------
10.0.0.53         timeout                 reachable               reachable
127.0.0.1         reachable               reachable               refused
172.24.160.1      timeout                 reachable               timeout
172.26.32.1       timeout                 reachable               timeout
```

Read it column by column:

- **`127.0.0.1`**: only reachable *via* `127.0.0.1`. Nothing off the machine can ever reach it,
  not even another process that connects to your LAN IP.
- **`0.0.0.0`**: reachable via *every* address the machine has, including virtual adapters you
  may not know exist (Docker, WSL, VPN, Hyper-V).
- **The LAN IP**: only via that one interface. Note that even `127.0.0.1` is refused.

"refused" vs. "timeout" depends on the OS. Linux answers a connection to an unbound address/port
with an immediate RST (refused). Windows' firewall often silently drops it instead (timeout).

> 🖼️ **Image suggestion:** a machine drawn as a box with three network interfaces on its edge
> (lo, Wi-Fi, docker0) and three listening sockets inside. Draw arrows from each interface to
> the sockets it can reach: lo reaches all of them, Wi-Fi reaches only `0.0.0.0` and the LAN-IP
> socket, and docker0 reaches only `0.0.0.0`.

## Code walkthrough

**The second argument to `listen()` is the bind address:**

```js
server.listen(5601, "127.0.0.1"); // loopback only
server.listen(5602, "0.0.0.0");   // every IPv4 interface ("INADDR_ANY")
server.listen(5603, lanIp);       // one interface
```

**Leaving it out is not the same as `127.0.0.1`.** `server.listen(3000)` with no host binds to
`::` (all IPv6 addresses, and IPv4 too on dual-stack systems), so the service is exposed on every
interface. Many frameworks' defaults differ here. Some bind to localhost, and some bind to
everything.

## Why it matters

- **Security.** A database, admin panel or debug endpoint bound to `0.0.0.0` on a machine with a
  public IP is on the internet. Exposed Redis, MongoDB and Elasticsearch instances (bound to all
  interfaces, no auth) are a classic source of data breaches. Bind internal services to
  `127.0.0.1` or a private interface, *and* firewall them.
- **Containers flip the default.** Inside a Docker container, a server bound to `127.0.0.1`
  is unreachable from outside the container, even with `-p 8080:8080`, because port publishing
  arrives on the container's `eth0`, not on its loopback. Servers in containers must bind to
  `0.0.0.0`. ("It works locally but not in Docker" is very often this.)
- **Multi-homed hosts.** A server with a public NIC and a private NIC can expose its API on the
  public interface and its metrics or admin port on the private one only.

## Try this yourself

- Run `node probe.js <your-lan-ip>` from your phone (Termux) or another laptop. Only `:5602` and
  `:5603` should answer.
- List what's actually listening on your machine, and on which address:
  `netstat -an | findstr LISTENING` (Windows) or `ss -ltnp` (Linux). Look for anything on
  `0.0.0.0` or `[::]` that you didn't expect.
- Change `:5601` to bind `localhost` instead of `127.0.0.1`. On some systems `localhost`
  resolves to `::1` (IPv6) first, and an IPv4 client connecting to `127.0.0.1` gets refused, a
  common Node 17+ surprise.
- Run a container with a server bound to `127.0.0.1` and publish its port. It won't answer.
  Rebind it to `0.0.0.0` and it will.

## Real-world equivalent

`bind-address = 127.0.0.1` in MySQL's config, `listen_addresses = 'localhost'` in Postgres,
`bind 127.0.0.1` in Redis, `--host 0.0.0.0` on a dev server so your phone can reach it, and
Kubernetes pods that must listen on `0.0.0.0` to receive Service traffic. They all come down to
this one argument to `listen()`.
