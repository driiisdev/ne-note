# TCP Head-of-Line Blocking

TCP delivers one **ordered byte stream**. If a segment is lost, every byte after it - already
received, sitting in the kernel - is withheld from the application until the retransmission arrives.
When unrelated messages share that one stream, a single loss stalls all of them. That's
**head-of-line (HOL) blocking** at the transport layer.

## Why it matters most for HTTP/2

- **HTTP/1.1** had *application-layer* HOL blocking: one request at a time per connection, so a slow
  response blocked the next. Browsers worked around it with ~6 parallel connections per host.
- **HTTP/2** fixed that by **multiplexing** many requests as interleaved frames on **one** TCP
  connection. But TCP doesn't know about HTTP/2 streams: lose one packet carrying stream 3's frame,
  and streams 1, 5 and 7 - whose data arrived fine - wait too.
- Under packet loss (mobile, Wi-Fi), HTTP/2 over one connection can perform **worse** than HTTP/1.1
  over six, because one loss stalls everything instead of a sixth of everything.

## The fix: ordering per stream (QUIC / HTTP/3)

QUIC runs over UDP and implements its own reliability with **independent streams**. A lost packet
only blocks the stream it belongs to; other streams' data is delivered immediately. HTTP/3 is HTTP
semantics on top of QUIC.

## Other places it appears

- Anything multiplexed over a single TCP connection: database drivers that pipeline queries,
  Redis pipelining, WebSocket messages, SSH channels, gRPC streams.
- TLS records: a record can't be decrypted until all its bytes arrive - large records amplify the
  stall slightly.

## How much it costs

Roughly the time to detect and repair the loss: about one RTT with fast retransmit (3 duplicate
ACKs), or a full **RTO** (≥ 200 ms, often more) if the loss is at the tail and must wait for a
timeout. Every stream on the connection pays it.

🖼️ **two pipes: tcp (all colours queued behind one missing packet) vs quic (separate lanes, only one stalled)**
![tcp head of line blocking](<../../assets/img/tcp-hol-blocking.png>)

## Practice project

[`practice/network-performance/hol-blocking-sim`](../../practice/network-performance/hol-blocking-sim) -
replays one lost packet under TCP-like and QUIC-like delivery: innocent streams A and C finish at
260 ms vs 110/130 ms.

## Related

- [TCP](<../transmission control protocol/tcp.md>) - why ordering is per connection.
- [TCP pros and cons](<../transmission control protocol/tcp_pros_n_cons.md>).
- [UDP pros and cons](<../user datagram protocol/udp_pros_n_cos.md>) - why QUIC is built on UDP.
- [Wiresharking HTTP/2](<../analyzing protocols with wireshark/wiresharking_http-2(decrypting_tls).md>) -
  see the multiplexed streams.
