# Practice: Should Layer 4 Proxies Buffer Segments?

Concept notes: [`should_layer_4_proxies_buffer_segments.md`](<../../../concepts/miscellaneous/should_layer_4_proxies_buffer_segments.md>) ·
related: [`load_balancing_at_layer4_vs_layer7.md`](<../../../concepts/network performance/load_balancing_at_layer4_vs_layer7.md>) ·
[`nagles_algorithms_effect_on_performance.md`](<../../../concepts/network performance/nagles_algorithms_effect_on_performance.md>)

## What this demonstrates

Buffering is tempting for a proxy: fewer, bigger writes to the backend, and protection from
slow clients. But an L4 proxy **doesn't know where messages end**. This project runs the same
two workloads through three proxy strategies:

| Mode | What it does | Layer |
| --- | --- | --- |
| `stream` | forwards every segment immediately | L4, done right |
| `timer` | blindly buffers, flushes every 200 ms or at 16 KB | L4 trying to be clever |
| `newline` | buffers until a complete message (`\n`) | L7: it had to learn the protocol |

## Folder structure

```text
l4-proxy-buffering/
  backend.js   <- node backend.js [port]                     line echo; reports how long it held a partial message
  proxy.js     <- node proxy.js <stream|timer|newline> [listen] [backend]
  client.js    <- node client.js [proxyPort]                 A: 5 small round trips, B: one slow trickled message
```

## Run it

```bash
node backend.js                        # terminal 1 (:5900)
node proxy.js stream  5901             # terminal 2
node proxy.js timer   5902             # terminal 3
node proxy.js newline 5903             # terminal 4
node client.js 5901
node client.js 5902
node client.js 5903
```

## What you'll see

```text
### stream
   round trips: 3ms, 1ms, 1ms, 0ms, 1ms
   reply after 1173ms, backend was tied up by a partial message for 1111ms
### timer
   round trips: 214ms, 203ms, 217ms, 214ms, 204ms
   reply after 1208ms, backend was tied up by a partial message for 1004ms
### newline
   round trips: 2ms, 1ms, 0ms, 1ms, 0ms
   reply after 1172ms, backend was tied up by a partial message for 0ms
```

- **`timer` is the worst of both worlds.** It adds its flush delay (200 ms) to every interactive
  round trip, which is the same failure mode as Nagle + delayed ACK, now in a proxy. And it
  *still* doesn't protect the backend from the slow client, because a 200 ms timer can't tell a
  pause from the end of a message.
- **`stream`** is as fast as possible, but the backend sees every byte of the slow client and
  holds that partial message, and its connection, for over a second.
- **`newline`** gets both. It's fast for complete messages, and the backend sees the slow message
  only once it's complete (`held=0ms`). But the proxy had to **parse the protocol**, which makes
  it an L7 proxy.

> 🖼️ **Image suggestion:** three timelines (stream, timer, newline) for the trickled message.
> Each shows bytes arriving at the proxy and when they're released to the backend, with the
> backend's "busy" window shaded.

## Code walkthrough

The whole difference is the proxy's `data` handler:

```js
if (MODE === "stream") return upstream.write(chunk);           // L4: bytes are opaque

if (MODE === "timer") { if (!timer) timer = setTimeout(flush, FLUSH_MS); }   // guessing

const lastNl = buffer.lastIndexOf("\n");                       // L7: knows message boundaries
if (lastNl !== -1) upstream.write(buffer.subarray(0, lastNl + 1));
```

**The answer to the lecture's question:** an L4 proxy should forward segments as they arrive
(and set `TCP_NODELAY` on both sides so it doesn't add Nagle delays either). Any buffering
policy that doesn't know message boundaries trades latency for nothing. Buffering is a job for
L7, where the proxy knows what a complete request is.

## Where buffering *does* belong

- **Nginx request buffering** (`proxy_request_buffering on`) reads the *whole HTTP request*,
  including slow uploads, before opening a connection to the backend. That's the `newline` mode
  for HTTP, and it's a big part of why Nginx in front of an app server defends against
  slowloris-style attacks.
- **Nginx response buffering** (`proxy_buffering on`) does the reverse. It reads the backend's
  response quickly, frees the backend, and then trickles the response to a slow client itself.
- **Turn it off** for streaming responses (SSE, LLM token streams, long polling) or the client
  receives nothing until the buffer fills. `X-Accel-Buffering: no` exists for exactly this.

## Try this yourself

- Lower `FLUSH_MS` to 10. Interactive latency improves, but there's still a floor, and the
  slow-client case is unchanged. No timer value fixes both.
- Point the `stream` proxy at the backend and open 200 slow clients at once. Count how many
  backend connections are tied up. That's the resource exhaustion a slowloris attack relies on.
- Put `practice/analyzing-protocols-with-wireshark/capture-lab/sse-server.js` behind the `timer`
  proxy (adjusting ports). Events now arrive in 200 ms clumps instead of individually.

## Real-world equivalent

HAProxy in `mode tcp` and AWS NLB stream bytes (L4). Nginx, Envoy and AWS ALB buffer
requests and responses according to HTTP semantics (L7). The "my SSE or streaming endpoint
doesn't stream in production" bug is almost always an L7 proxy's response buffering.
