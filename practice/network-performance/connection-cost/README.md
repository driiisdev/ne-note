# Practice: The Cost of Connection Establishment

Concept notes: [`cost_of_connection_establishment.md`](<../../../concepts/network performance/cost_of_connection_establishment.md>) ·
[`tcp_fast_open.md`](<../../../concepts/network performance/tcp_fast_open.md>)

## What this demonstrates

A new TCP connection costs **one full round trip before the first byte of data** can be sent.
On localhost that's invisible. Across the world (100-300 ms RTT) it can double the latency of
every request. This project makes localhost behave like a long link and measures:

1. **A new connection per request**: handshake (1 RTT) + request/response (1 RTT) = **2 RTT**
2. **One reused keep-alive connection**: the handshake is paid once, then **1 RTT** per request
3. **TCP Fast Open (simulated)**: request data rides in the SYN, so even a *new* connection
   costs **1 RTT**

## Folder structure

```text
connection-cost/
  server.js          <- node server.js [port]                              tiny HTTP server (:5500)
  latency-proxy.js   <- node latency-proxy.js [listen] [target] [rttMs] [--tfo]
  client.js          <- node client.js [proxyPort] [requests] [rttMs]
```

## Run it

```bash
node server.js                               # terminal 1
node latency-proxy.js 5501 5500 100          # terminal 2: a 100 ms RTT link
node latency-proxy.js 5502 5500 100 --tfo    # terminal 3: same link, simulated TFO
node client.js 5501 10 100                   # terminal 4
node client.js 5502 10 100
```

## What you'll see

```text
10 sequential GETs through a link with RTT 100ms

new connection per request       2232 ms total,  223 ms/request   (expected ~2 RTT = 200 ms/request)
one reused keep-alive conn       1340 ms total,  134 ms/request   (expected ~1 RTT = 100 ms/request)

--- through the --tfo proxy ---
new connection per request       1268 ms total,  127 ms/request   (expected ~2 RTT = 200 ms/request)
one reused keep-alive conn       1248 ms total,  125 ms/request   (expected ~1 RTT = 100 ms/request)
```

The measured numbers run 20-35 ms above the expected ones. That's `setTimeout` granularity
(about 15 ms per timer on Windows), not the network model. The ratios are what matter: a fresh
connection costs nearly **double**, and with TFO it costs about the same as a reused one.

Add TLS on top and the gap widens. TLS 1.3 adds 1 RTT per new connection and TLS 1.2 adds 2, so
a new HTTPS connection over TLS 1.2 costs **4 RTT** before the response arrives. (See
`practice/overview-of-popular-networking-protocols/tls-handshake-lab`.)

> 🖼️ **Image suggestion:** two timelines stacked on one time axis. The top one is new-connection
> (SYN, SYN-ACK, ACK+request, response: 2 RTT). The bottom one is keep-alive (request, response:
> 1 RTT). Add a third row for TLS 1.2 to show 4 RTT.

## Code walkthrough

**The proxy has to model the handshake explicitly.** The real SYN between the client and the proxy
is local, so it's instant. To simulate a long link, the proxy holds each **new** connection's
first data for one RTT, which is what a real SYN/SYN-ACK exchange would cost:

```js
const handshakeDone = Date.now() + (TFO ? 0 : RTT);
...
delayed(client, upstream, handshakeDone); // request can't leave before the "handshake"
```

Every chunk is then delayed by RTT/2 in each direction. The FIN is delayed the same way, so it
can't overtake data that's still "in flight":

```js
from.on("data", (chunk) => later(() => to.write(chunk)));
from.on("end", () => later(() => to.end()));
```

**The only difference between the two client runs is the agent:**

```js
new http.Agent({ keepAlive: false })              // fresh TCP connection for every request
new http.Agent({ keepAlive: true, maxSockets: 1 }) // reuse one connection for all of them
```

## TCP Fast Open (TFO)

- On the **first** connection, the client asks for a TFO cookie in its SYN and the server
  returns one in its SYN-ACK. This connection is still a normal 1-RTT handshake.
- On **later** connections to the same server, the client puts the cookie *and the request data*
  in the SYN. The server validates the cookie and passes the data to the app immediately, so the
  response can come back with the SYN-ACK.
- **Catches:** data in the SYN may be **replayed** (a duplicated SYN delivers the request
  twice), so it's only safe for idempotent requests. Middleboxes sometimes drop SYNs that carry
  data, and support is uneven: Linux has it, Windows has partial support, and browsers mostly
  disabled it. TLS 1.3 0-RTT and QUIC solve the same problem at a higher layer and are more
  widely used.
- **Real TFO on Linux:** `sysctl net.ipv4.tcp_fastopen` (`3` = client + server), and
  `curl --tcp-fastopen http://...` to try it. Node has no portable TFO socket option, which is
  why this project simulates it.

## Try this yourself

- Change the RTT to 20 (same city), 100 (cross-continent) and 300 (satellite) and watch the
  absolute cost of a new connection scale with it.
- Run 10 *concurrent* requests instead of sequential ones (`Promise.all`) with
  `keepAlive: true, maxSockets: 10`. You pay 10 handshakes in parallel. Then compare a single
  HTTP/2 connection multiplexing all 10.
- Count connections: stop the proxy with `Ctrl+C` after each client run, and it prints how many
  TCP connections were opened (10 vs. 1).

## Real-world equivalent

This is why HTTP keep-alive is the default, why databases use connection pools (Postgres also
has an expensive per-connection backend process to start), why CDNs terminate TCP and TLS close
to users, and why HTTP/2, HTTP/3, TLS 1.3 and 0-RTT all exist. Each one removes round trips from
connection setup.
