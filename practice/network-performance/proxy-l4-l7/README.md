# Practice: Proxies, Reverse Proxies, and L4 vs. L7 Load Balancing

Concept notes: [`the_importance_of_proxy_and_reverse_proxies.md`](<../../../concepts/network performance/the_importance_of_proxy_and_reverse_proxies.md>) ·
[`load_balancing_at_layer4_vs_layer7.md`](<../../../concepts/network performance/load_balancing_at_layer4_vs_layer7.md>) ·
related: [`should_layer_4_proxies_buffer_segments.md`](<../../../concepts/miscellaneous/should_layer_4_proxies_buffer_segments.md>)

## What this demonstrates

- **Forward proxy vs. reverse proxy.** A forward proxy acts for *clients* (they're configured to
  use it, and it reaches arbitrary sites). A reverse proxy acts for *servers* (clients think it
  *is* the server).
- **L4 vs. L7 load balancing**, side by side on the same backends with the same client:
  - **L4** picks a backend once per **TCP connection** and pipes bytes it never reads.
  - **L7** terminates HTTP, reads every **request**, and routes each one individually by path. It
    can also block, rewrite and answer requests itself.

## Folder structure

```text
proxy-l4-l7/
  backend.js         <- node backend.js <port> <name>   reports itself + what it knows about the client
  l4-proxy.js        <- node l4-proxy.js     :5710  round robin per connection, pipes bytes
  l7-proxy.js        <- node l7-proxy.js     :5720  /api/* -> api pool, else web pool; per request
  forward-proxy.js   <- node forward-proxy.js :5730 HTTP + CONNECT tunnelling
  client.js          <- node client.js       6 requests over ONE connection to each proxy
```

## Run it

```bash
node backend.js 5701 web1      # 4 backends, 4 terminals
node backend.js 5702 web2
node backend.js 5703 api1
node backend.js 5704 api2
node l4-proxy.js
node l7-proxy.js
node client.js

node forward-proxy.js
curl -x http://127.0.0.1:5730 http://example.com/      # proxy sees the full URL
curl -x http://127.0.0.1:5730 https://example.com/     # proxy sees only "example.com:443"
```

## What you'll see

```text
== L4 proxy :5710 (6 requests, one client connection)
  /            200 web1   backend saw conn from ::ffff:127.0.0.1:58141, X-Forwarded-For=null
  /api/users   200 web1   backend saw conn from ::ffff:127.0.0.1:58141, X-Forwarded-For=null
  /            200 web1   ...
  /admin       200 web1   ...

== L7 proxy :5720 (6 requests, one client connection)
  /            200 web1   backend saw conn from ::ffff:127.0.0.1:58143, X-Forwarded-For=::ffff:127.0.0.1
  /api/users   200 api1   backend saw conn from ::ffff:127.0.0.1:58144, ...
  /            200 web2   ...
  /api/orders  200 api2   ...
  /about       200 web1   backend saw conn from ::ffff:127.0.0.1:58143, ...   <- reused backend connection
  /admin       403 blocked at the proxy
```

And the forward proxy's log:

```text
[http   ] GET http://example.com/   <- full URL, headers and body visible to the proxy
[CONNECT] example.com:443   <- only host:port visible; everything after is encrypted
[CONNECT] example.com:443 closed after 5810 encrypted bytes
```

> 🖼️ **Image suggestion:** two diagrams side by side. **L4:** one client connection is a single
> pipe running through the proxy to web1. **L7:** the client connection ends at the proxy, and
> separate backend connections fan out to web1, web2, api1 and api2, with per-request arrows.

## Code walkthrough

**L4 decides before it sees a single byte:**

```js
const port = BACKENDS[next++ % BACKENDS.length]; // once per connection
client.pipe(upstream).pipe(client);              // then it's just a byte pipe
```

So all six requests, even `/api/users` and `/admin`, land on `web1`. They share one TCP
connection, and L4 balancing is per connection. With HTTP/2 or gRPC (one long-lived connection
carrying everything), L4 balancing can leave one backend doing all the work.

**L7 decides per request, after parsing it:**

```js
if (req.url.startsWith("/admin")) { res.statusCode = 403; ... }   // policy
const pool = req.url.startsWith("/api") ? POOLS.api : POOLS.web;  // content-based routing
headers: { ...req.headers, "x-forwarded-for": req.socket.remoteAddress } // client identity
```

**Two connections, not one.** Behind an L7 proxy, the backend's TCP peer is the *proxy*
(`tcpConnectionFrom`), which is why `X-Forwarded-For` exists. The proxy also keeps its own
keep-alive pool to the backends, independent of the clients. That's how web1's connection
`:58143` gets reused for `/about`.

**CONNECT is how HTTPS goes through a forward proxy.** The proxy opens a raw tunnel, and TLS
runs end to end through it, so it only learns the hostname. Corporate proxies that "see
everything" in HTTPS do so by doing TLS interception with their own CA, which has to be
installed on every laptop.

## L4 vs. L7 at a glance

| | L4 (TCP/UDP) | L7 (HTTP) |
| --- | --- | --- |
| Decides on | IP + port | method, path, headers, cookies, body |
| Granularity | per connection | per request |
| Sees TLS content? | no: passes it through | yes: terminates TLS (needs the cert) |
| Can do | balance, NAT, pass any protocol | route by path, cache, compress, auth, rate limit, retry, rewrite |
| Cost | cheap: no parsing, low latency | parses everything; more CPU; holds two connections per flow |
| Examples | AWS NLB, HAProxy `mode tcp`, LVS | AWS ALB, Nginx, Envoy, HAProxy `mode http`, Cloudflare |

## Try this yourself

- Stop `web1` and run `client.js` again. The L4 proxy's connection to web1 fails, so the client
  sees the connection drop. The L7 proxy returns a clean **502 Bad Gateway**. Add a retry on the
  next backend to `l7-proxy.js`, which only L7 can do because it knows where the request
  boundaries are.
- Point a TLS client at the L4 proxy (put `tls-handshake-lab`'s server behind it). It works
  untouched, because L4 doesn't care what the bytes are. The L7 proxy would need the certificate.
- Add a `/healthz` check loop to `l7-proxy.js` that removes dead backends from the pools. That's
  active health checking.
- Add sticky sessions to the L7 proxy: hash a cookie to pick the backend, so a user always lands
  on the same server.

## Real-world equivalent

A typical production edge stacks both: an L4 balancer (NLB) spreads connections across a fleet
of L7 proxies (Nginx or Envoy), and those route each request to the right microservice. Forward
proxies show up as corporate egress proxies, Squid caches, and the `HTTPS_PROXY` variable that
CLI tools honor.
