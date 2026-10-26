# Running Out of TCP Source Ports

A failure that points at the wrong culprit: outbound connections start failing with
`EADDRNOTAVAIL` ("cannot assign requested address") while the destination is perfectly healthy. The
**client** has run out of a resource rarely thought about - source ports for that destination.

## Why ports run out

- A connection is unique by its **4-tuple** (src IP, src port, dst IP, dst port). To one destination
  IP:port, only the **source port** varies.
- Outbound connections get a source port from the **ephemeral range**: Linux `32768-60999` (~28K),
  Windows `49152-65535` (~16K).
- The side that closes first holds the 4-tuple in **TIME_WAIT** for 2×MSL - 60 s on Linux, up to
  120-240 s on Windows.
- So a client opening a **new connection per request** to one backend can sustain only about
  `range / TIME_WAIT` new connections per second: ~470/s on Linux, ~136/s on Windows defaults.
  Exceed that and the pool drains.

## Who hits it

- Services calling one API or database **without connection pooling / keep-alive**.
- **Proxies and load balancers** - every client connection becomes an outbound connection from the
  proxy's few IPs to the same backends.
- **NAT gateways** - many clients share one public IP's ports (AWS NAT Gateway limits connections
  per destination accordingly).

## Fixes, best first

1. **Reuse connections**: keep-alive, connection pools, HTTP/2 multiplexing. Nothing burns a port
   per request.
2. **Let the server close first** when you control the protocol, so `TIME_WAIT` lands on the server
   (which doesn't consume its ephemeral ports).
3. **`net.ipv4.tcp_tw_reuse = 1`** (Linux): reuse TIME_WAIT sockets for new outbound connections
   when timestamps make it safe. (Avoid the removed `tcp_tw_recycle`, which broke clients behind NAT.)
4. **Widen the range**: `net.ipv4.ip_local_port_range = 1024 65535`; on Windows,
   `netsh int ipv4 set dynamicport tcp start=... num=...`.
5. **More 4-tuples**: more source IPs, more destination IPs/ports.

## Diagnosing

`ss -tan state time-wait | wc -l`, `ss -tan dst <ip>` to group by destination, `EADDRNOTAVAIL` /
`connect: cannot assign requested address` in logs, and outbound failures that correlate with
request rate rather than with the destination's health.

🖼️ **ephemeral port pool draining: new connection per request, each closed one parked in time_wait for 60-120 s**
![ephemeral port exhaustion](<../../assets/img/ephemeral-port-exhaustion.png>)

## Practice project

[`practice/miscellaneous/kernel-tcp-lab`](../../practice/miscellaneous/kernel-tcp-lab) -
`ephemeral-ports.js` reads your OS's range, creates 300 TIME_WAIT entries, and computes the
connection rate that would exhaust it.

## Related

- [TCP connection states](<../transmission control protocol/tcp_connection_states.md>) - TIME_WAIT.
- [Cost of connection establishment](<../network performance/cost_of_connection_establishment.md>) -
  the other reason to reuse connections.
- [How does the kernel manage TCP connections](<how_does_the_kernel_manage_tcp_connections.md>).
