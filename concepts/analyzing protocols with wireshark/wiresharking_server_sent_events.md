# Wiresharking Server-Sent Events

**Server-Sent Events (SSE)** let a server push a stream of events to a browser over a plain HTTP
response that simply never ends. In a capture, SSE looks almost boring - one request, one response -
which is exactly the point: it's ordinary HTTP, so it passes through proxies, load balancers and
firewalls that might block other push mechanisms.

## The protocol

Request: `GET /events` with `Accept: text/event-stream`.

Response headers:

```text
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Transfer-Encoding: chunked        (no Content-Length - the body has no known end)
```

Body: UTF-8 text events, each ended by a **blank line**:

```text
id: 1
event: price
data: {"symbol":"NET","price":104.03}

```

Fields: `data:` (repeatable), `event:` (event type), `id:` (resume point - the browser sends
`Last-Event-ID` on reconnect), `retry:` (reconnect delay), lines starting with `:` are comments
(used as heartbeats).

## What to see in Wireshark

- One TCP connection, one HTTP request, a response header - then **DATA keeps arriving** in separate
  TCP segments, roughly one per event, spaced by the server's timing.
- **Follow → TCP Stream** shows the event text exactly as above (with chunk-size lines in hex
  between events when chunked encoding is used).
- The HTTP response is never "complete" until the server ends it - Wireshark may show it only when
  the stream closes, so look at the TCP segments.
- With HTTP/2, each event is DATA frames on one stream, and many SSE streams can share a connection.

## Things SSE captures reveal

- **Buffering**: events arriving in clumps instead of individually means a proxy is buffering the
  response (fix with `X-Accel-Buffering: no` / `proxy_buffering off`).
- **Idle timeouts**: a connection reset after N seconds of silence → add heartbeat comments.
- **Reconnects** with `Last-Event-ID` after drops.

🖼️ **wireshark: one http request, then a column of tcp segments one second apart, each carrying one event**
![wireshark sse](<../../assets/img/wireshark-sse.png>)

## Practice project

[`practice/analyzing-protocols-with-wireshark/capture-lab`](../../practice/analyzing-protocols-with-wireshark/capture-lab) -
lab 5: `sse-server.js` sends five `price` events one second apart; read them with `curl -N`.

## Related

- [Wiresharking TCP/HTTP](<wiresharking_tcp-http.md>) - the HTTP/1.1 basics.
- [Should layer 4 proxies buffer segments](<../miscellaneous/should_layer_4_proxies_buffer_segments.md>) -
  why SSE breaks behind buffering proxies.
- [Nagle's algorithm](<../network performance/nagles_algorithms_effect_on_performance.md>) - small
  event writes and latency.
