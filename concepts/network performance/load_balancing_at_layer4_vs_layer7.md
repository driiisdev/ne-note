# Load Balancing at Layer 4 vs Layer 7

A load balancer spreads traffic across backends. The layer it works at (from the OSI model)
decides **what it can see**, and therefore **how smart and how expensive** its decisions are.

## Layer 4 - transport

Sees only **IPs, ports and TCP/UDP** - never the payload.

- Picks a backend **once per connection** (round robin, least connections, hash of the 4-tuple),
  then forwards packets or bytes for that connection's lifetime.
- Works for **any protocol** - HTTP, TLS passthrough, Postgres, SMTP, gaming UDP.
- **Fast and cheap**: no parsing, no TLS. Can be done in the kernel or hardware (IPVS, ECMP), even
  with **Direct Server Return** (backends reply straight to clients).
- **Can't** route by URL, header or cookie, retry a failed request, or balance individual requests
  on a long-lived multiplexed connection - one HTTP/2 or gRPC connection pins all its requests to
  one backend.
- Two implementation styles: **packet-level NAT/DSR** (one TCP connection, client ↔ backend), or a
  **TCP proxy** that splices two connections without reading them.

## Layer 7 - application

Terminates the protocol (usually HTTP, so also TLS) and sees **every request**.

- Decides **per request**: path-based (`/api` → API pool), host-based (virtual hosts), header/cookie
  (canary, A/B, sticky sessions), method.
- Can **retry** on another backend, return 502/503 itself, cache, compress, rewrite headers, add
  `X-Forwarded-For`, rate-limit, authenticate, apply WAF rules.
- **Costs more**: parses everything, holds **two connections** per flow, needs the TLS certificate
  and private key, adds latency and CPU.

## Comparison

| | Layer 4 | Layer 7 |
| --- | --- | --- |
| Sees | IP, port, transport flags | full request: method, path, headers, body |
| Granularity | per connection | per request |
| Protocols | any TCP/UDP | the ones it understands (HTTP, gRPC...) |
| TLS | passes it through (or SNI-peeks) | terminates it |
| Features | balance, NAT | routing, retries, caching, auth, observability |
| Examples | AWS NLB, HAProxy `mode tcp`, IPVS | AWS ALB, Nginx, Envoy, HAProxy `mode http` |

## In practice: both

A typical edge: **L4** (NLB / anycast / ECMP) spreads connections across a fleet of **L7** proxies,
which route each request to the right service.

🖼️ **l4 (one pipe from client to a backend) vs l7 (client connection ends at the proxy, separate backend connections per request)**
![l4 vs l7 load balancing](<../../assets/img/l4-vs-l7-load-balancing.png>)

## Practice project

[`practice/network-performance/proxy-l4-l7`](../../practice/network-performance/proxy-l4-l7) -
the same 6 requests over one connection: the L4 proxy sends all to `web1`; the L7 proxy routes by
path, rotates backends, and blocks `/admin`.

## Related

- [The importance of proxies and reverse proxies](<the_importance_of_proxy_and_reverse_proxies.md>).
- [OSI model](<../fundamentals of networking/osi_model.md>).
- [What is SNI](<../miscellaneous/what_is_sni_(server_name_indication_tls_extension).md>) - an L4 balancer
  that peeks at one L7-ish field.
