# Should Layer 4 Proxies Buffer Segments?

An L4 proxy receives TCP segments from a client and writes them to a backend. It's tempting to
buffer - collect small segments and send fewer, larger writes - to save packets and syscalls. The
answer to the question is **no**: an L4 proxy doesn't know where application messages begin or end,
so any buffering policy is a guess, and wrong guesses cost latency.

## Why buffering at L4 backfires

- **It doesn't know message boundaries.** To an L4 proxy, the stream is opaque bytes (possibly
  TLS). It can't tell "end of request" from "client paused".
- **Timer-based buffering adds latency to every small exchange.** Holding bytes "until 16 KB or
  200 ms" adds up to 200 ms to every interactive request/response - the same failure mode as
  Nagle + delayed ACK, but now in the middle of the path.
- **It doesn't even protect the backend.** A slow client's partial message still reaches the backend
  in pieces; the timer can't know when the message is complete.
- **Ordering and correctness are fine** either way - TCP guarantees order - so buffering only ever
  trades latency for efficiency, and L4 has no information to make that trade well.

The right L4 behaviour: forward data **as it arrives**, and set `TCP_NODELAY` on both sides so the
proxy doesn't add Nagle delays of its own. Let the endpoints' TCP stacks coalesce as they see fit.

## Where buffering is right: layer 7

A proxy that understands the protocol knows what a complete message is:

- **Request buffering** (Nginx `proxy_request_buffering`): read the whole HTTP request - even a slow
  upload - before opening a backend connection. Backends never get tied up by slow clients
  (a defence against slowloris).
- **Response buffering** (`proxy_buffering`): read the backend's response fast, free the backend,
  trickle it to the slow client from the proxy's memory/disk.
- **Turn it off for streams**: SSE, long polling, LLM token streaming and gRPC streaming must not be
  buffered, or the client gets nothing until the buffer fills (`X-Accel-Buffering: no`).

## Summary

| Proxy type | Buffer? | Why |
| --- | --- | --- |
| L4 (TCP passthrough) | no - stream through | no knowledge of message boundaries |
| L7, normal request/response | yes, usually | protects backends from slow clients |
| L7, streaming responses | no | buffering breaks streaming |

🖼️ **three timelines for one trickled message: stream / timer-buffer / message-aware buffer, with the backend's busy window shaded**
![l4 proxy buffering](<../../assets/img/l4-proxy-buffering.png>)

## Practice project

[`practice/miscellaneous/l4-proxy-buffering`](../../practice/miscellaneous/l4-proxy-buffering) -
three proxy modes: `stream` (~1 ms round trips), `timer` (~200 ms each and still no backend
protection), `newline` (fast *and* protective - but now it's L7).

## Related

- [Load balancing at layer 4 vs layer 7](<../network performance/load_balancing_at_layer4_vs_layer7.md>).
- [Nagle's algorithm](<../network performance/nagles_algorithms_effect_on_performance.md>) - the same trade-off in TCP.
- [Wiresharking server-sent events](<../analyzing protocols with wireshark/wiresharking_server_sent_events.md>) -
  what buffering does to streams.
