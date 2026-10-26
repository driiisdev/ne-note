# Cost of Connection Establishment

Before the first byte of a request can be answered, a new connection pays in **round trips**,
**CPU** and **slow start**. On a 100 ms RTT link, a new HTTPS connection can easily cost 300 ms
before the response even begins - far more than the server takes to handle the request.

## Round trips before the response

| Setup | RTTs until the response arrives |
| --- | --- |
| reused keep-alive connection | 1 (request → response) |
| new TCP connection | 2 (handshake + request) |
| new TCP + TLS 1.3 | 3 |
| new TCP + TLS 1.2 | 4 |
| + DNS lookup (cache miss) | +1 or more |
| TLS 1.3 resumption with 0-RTT, or QUIC 0-RTT | 1-2 |
| TCP Fast Open + TLS 1.3 | 2 (request rides in the SYN for repeat visitors) |

Latency is set by distance (light in fibre ≈ 200 km/ms), so RTTs can't be engineered away - only
**avoided**.

## Other costs

- **CPU**: TLS handshakes need asymmetric crypto (ECDHE, signatures) - far more expensive than
  encrypting data afterwards.
- **Slow start**: a brand-new connection starts with a small congestion window and needs several
  RTTs to reach full speed. A warm, reused connection already has a large window (unless reset
  after idle).
- **Kernel and middlebox state**: socket buffers, NAT/firewall entries, `TIME_WAIT` after close,
  ephemeral ports.
- **Server-side work**: some servers do heavy per-connection setup (Postgres starts a backend
  process per connection).

## How systems avoid paying it

- **Keep-alive / persistent connections** (HTTP/1.1 default).
- **Connection pooling** in HTTP clients and database drivers.
- **Multiplexing** many requests on one connection (HTTP/2, HTTP/3, gRPC).
- **TLS session resumption** and **0-RTT**; **TLS 1.3** instead of 1.2.
- **TCP Fast Open**, **QUIC** (combined transport + crypto handshake).
- **CDNs / edge termination**: do the handshakes close to the user, keep warm connections to origin.
- **`preconnect` / DNS prefetch** hints in browsers.

🖼️ **stacked timelines: keep-alive (1 rtt), new tcp (2), new tcp+tls1.3 (3), new tcp+tls1.2 (4)**
![connection establishment cost](<../../assets/img/connection-establishment-cost.png>)

## Practice project

[`practice/network-performance/connection-cost`](../../practice/network-performance/connection-cost) -
a latency proxy turns localhost into a 100 ms link: ~223 ms per request with a new connection each
time vs ~134 ms reusing one.

## Related

- [TCP fast open](<tcp_fast_open.md>).
- [Slow start vs congestion avoidance](<../transmission control protocol/slow_start_vs_congestion_avoidance.md>).
- [TLS](<../overview of popular networking protocols/tls.md>).
- [Running out of TCP source ports](<../miscellaneous/running_out_of_tcp_source_ports.md>) - what
  happens when you don't reuse connections.
