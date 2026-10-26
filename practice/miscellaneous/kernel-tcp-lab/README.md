# Practice: Kernel TCP Lab

Concept notes: [`how_does_the_kernel_manage_tcp_connections.md`](<../../../concepts/miscellaneous/how_does_the_kernel_manage_tcp_connections.md>) ·
[`running_out_of_tcp_source_ports.md`](<../../../concepts/miscellaneous/running_out_of_tcp_source_ports.md>) ·
[`postgres_failure_caused_by_a_cisco_router_(tcp_issue).md`](<../../../concepts/miscellaneous/postgres_failure_caused_by_a_cisco_router_(tcp_issue).md>)

## What this demonstrates

Two production failures that come from TCP state the application never sees:

1. **Running out of source ports.** Every outbound connection to the *same* destination needs a
   unique source port, and every client-closed connection keeps its port in `TIME_WAIT` for 30
   to 120 seconds. `ephemeral-ports.js` measures your OS's range, creates 300 `TIME_WAIT`
   entries, and works out the connection rate that would exhaust it.
2. **The silent middlebox.** A router or firewall tracks connections in a state table and
   *silently* evicts idle ones. Both endpoints still think the connection is `ESTABLISHED`.
   The next query on that pooled connection hangs with no error and no RST.
   `idle-killer-proxy.js` plays the router.

For the kernel's queues (SYN queue, accept queue, backlog) and the full state machine, see
`practice/transmission-control-protocol/sockets-and-queues`. That project covers the first half
of "how does the kernel manage TCP connections."

## Folder structure

```text
kernel-tcp-lab/
  ephemeral-ports.js     <- node ephemeral-ports.js [connections]
  db-server.js           <- node db-server.js [port]                      fake DB (:5920)
  idle-killer-proxy.js   <- node idle-killer-proxy.js [listen] [target] [idleMs]
  db-client.js           <- node db-client.js [port] [idleSeconds] [--heartbeat=ms]
```

## Run it

```bash
node ephemeral-ports.js 300

node db-server.js                                  # terminal 1
node idle-killer-proxy.js 5921 5920 5000           # terminal 2: evicts after 5s idle
node db-client.js 5921 8                           # idle 8s -> second query hangs
node db-client.js 5921 8 --heartbeat=2000          # PING every 2s -> survives
```

## What you'll see

```text
ephemeral port range : 49152-65535  (16,384 ports)
TIME_WAIT duration   : ~120s on win32

opened and closed 300 connections in 0.5s (600/s)
sockets in TIME_WAIT for :5910: 0 before -> 300 after

sustainable new connections to ONE destination: ~136/s  (16384 ports / 120s)
at this script's rate (600/s) the range would run out in ~27s
```

```text
### no heartbeat
[  0.0s] query 1 -> RESULT for "SELECT * FROM orders LIMIT 1"
[  0.0s] idle for 8s (connection still ESTABLISHED as far as both kernels know)
[ 13.0s] query 2 -> NO RESPONSE after 5s. No error, no RST - it just hangs.

### heartbeat
[  8.0s] query 2 -> RESULT for "SELECT * FROM orders LIMIT 1"

[middlebox] :58696 idle 5000ms -> entry evicted from state table (nobody is told)
[middlebox] client->db 29 bytes for an unknown connection -> dropped
```

On Linux the range is usually `32768-60999` (28,232 ports) with a 60 s `TIME_WAIT`, so about
470 new connections per second to one destination is the ceiling.

> 🖼️ **Image suggestion:** a timeline for the silent-middlebox failure. The client and DB both
> show `ESTABLISHED` throughout. The router's state table entry disappears at t=5s, and the
> query at t=8s hits a ✗ at the router. In a real stack, the client's TCP then retransmits with
> exponential backoff for ~15 minutes before giving up.

## Code walkthrough

**Who closes first gets `TIME_WAIT`.** The client calls `end()` first, so the *client's* ports
pile up, and the client is the side that runs out:

```js
const s = net.createConnection({ port: PORT, host: "127.0.0.1" }, () => s.end());
```

**Ports are per destination.** The constraint is the 4-tuple, so 16K ports means 16K concurrent
or `TIME_WAIT` connections *to one IP:port*. A client talking to many different backends rarely
hits it. A proxy or app hammering *one* database or API endpoint with a new connection per
request hits it quickly.

**The middlebox drops instead of resetting:**

```js
if (evicted) return console.log(`... for an unknown connection -> dropped`);
```

Because nothing comes back, not even a RST, the client's TCP stack keeps retransmitting the
query. On Linux that's about 15 minutes (`net.ipv4.tcp_retries2 = 15`) before the socket finally
errors. The demo cuts that short with a 5 s application timeout.

**Keeping the connection from going idle is the fix:**

```js
heartbeat = setInterval(() => socket.write("PING\n"), HEARTBEAT_MS); // app-level
socket.setKeepAlive(true, 2000);                                      // kernel-level
```

In production, **TCP keepalive** is the standard fix. The kernel sends tiny probe segments
on an idle connection, a real router sees them as traffic, and its state entry stays fresh.
Postgres exposes this as `tcp_keepalives_idle`, `tcp_keepalives_interval` and
`tcp_keepalives_count`, which must be set *lower* than the middlebox's idle timeout. The Linux
default of 2 hours (7200 s) is far longer than most firewall timeouts.

*Why the demo uses PING instead:* `idle-killer-proxy.js` is a user-space program. It only sees
application bytes, and keepalive probes carry no new data, so the kernel absorbs them below the
proxy. A hardware router or a kernel conntrack table *does* see them. App-level heartbeats work
either way, which is why many connection pools also run a validation query before handing out an
idle connection.

## Fixes for each failure

| Failure | Fix |
| --- | --- |
| Source port exhaustion | connection pooling / keep-alive (the real fix); `net.ipv4.tcp_tw_reuse=1`; widen `ip_local_port_range`; more source IPs |
| Silent middlebox eviction | TCP keepalive shorter than the firewall timeout; pool max-idle-time shorter than it too; validation queries |
| Both | understand that "the connection is open" is a belief held separately by two kernels and every box in between |

## Try this yourself

- Run `ephemeral-ports.js` twice back to back. The "before" count is now 300, because the first
  run's `TIME_WAIT` entries haven't expired yet. Wait 2 minutes and they're gone.
- Make the *server* close first (call `s.end()` in the server callback instead of the client's)
  and re-run. The `TIME_WAIT` entries move to the server side (local port 5910) and stop costing
  the client ports.
- Set `--heartbeat=6000`, longer than the 5000 ms eviction timeout. It fails again, because
  heartbeats only help if they're more frequent than the middlebox's timeout.
- On Linux, check your keepalive defaults with `sysctl net.ipv4.tcp_keepalive_time` (7200) and
  compare them with your cloud provider's NAT gateway idle timeout (AWS: 350 s).

## Real-world equivalent

The AWS NAT Gateway 350-second idle timeout, Azure Load Balancer's 4-minute default, and
corporate firewalls dropping idle database connections all produce the same silent-hang
failure. "Cannot assign requested address" (`EADDRNOTAVAIL`) under load, from services that open
a fresh HTTP connection per call, is the port-exhaustion failure.
