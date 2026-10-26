# TCP Fast Open (TFO)

A TCP extension (RFC 7413) that lets a client send **data inside the SYN** on repeat connections, so
the server can start processing the request one round trip earlier. It removes the handshake RTT
from the critical path - but only for clients that have talked to the server before.

## How it works

**First connection (cookie request):**

1. Client sends `SYN` with an empty **TFO cookie request** option.
2. Server replies `SYN-ACK` with a **cookie** - a MAC of the client's IP, computed with a server
   secret.
3. Normal handshake; the client caches the cookie for that server.

**Later connections:**

1. Client sends `SYN` + **cookie** + **request data**.
2. Server validates the cookie (proving the client really owns that IP - this blocks SYN floods
   with spoofed data) and **hands the data to the application immediately**.
3. The server's `SYN-ACK` can be followed straight away by the response. Total: 1 RTT instead of 2.

## Why it isn't everywhere

- **Replay**: a duplicated or retransmitted SYN can deliver the same data twice to the app, so TFO
  data must be **idempotent** (a `GET`, not a payment).
- **Middleboxes**: some firewalls and NATs drop SYNs carrying data or unknown options, so clients
  need fallback logic, and failures are hard to diagnose.
- **Support**: good on Linux (`net.ipv4.tcp_fastopen`: 1 = client, 2 = server, 3 = both); patchy
  elsewhere; browsers largely disabled it. APIs differ per OS (`MSG_FASTOPEN`, `TCP_FASTOPEN_CONNECT`).
- **Better alternatives** solve the same problem higher up: **TLS 1.3 0-RTT** and **QUIC**
  (handshake and crypto combined, 0-RTT on resumption) are far more widely deployed.

## Combined with TLS

TFO + TLS 1.3: the ClientHello rides in the SYN → TCP and TLS handshakes overlap → 1 RTT before the
request can be sent, instead of 2.

🖼️ **tfo: first connection gets a cookie; second connection sends syn + cookie + data, response comes right after syn-ack**
![tcp fast open](<../../assets/img/tcp-fast-open.png>)

## Practice project

[`practice/network-performance/connection-cost`](../../practice/network-performance/connection-cost) -
the `--tfo` latency proxy simulates skipping the handshake wait: a new connection per request drops
to about the cost of a reused one. (Simulated - Node has no portable TFO socket API.)

## Related

- [Cost of connection establishment](<cost_of_connection_establishment.md>).
- [TCP](<../transmission control protocol/tcp.md>) - the handshake TFO shortcuts.
- [TLS](<../overview of popular networking protocols/tls.md>) - 0-RTT, the more common answer.
