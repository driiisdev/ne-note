# The Importance of Proxies and Reverse Proxies

A **proxy** is an intermediary that terminates a connection from one side and opens another to the
other side. Which side it represents is the whole difference between the two kinds - and between
them, they sit in front of nearly every client and server in production.

## Forward proxy - acts for clients

Clients are configured to use it (`HTTPS_PROXY`, browser settings, PAC files) and ask it to reach
**any** destination.

- **Uses**: corporate egress control and logging, content filtering, caching (Squid), anonymity /
  geo-shifting, getting out of restricted networks.
- **HTTP**: the request line carries the full URL (`GET http://example.com/ HTTP/1.1`), so the proxy
  sees everything.
- **HTTPS**: the client sends `CONNECT example.com:443` and the proxy opens a raw tunnel - it sees
  only the hostname and byte counts, unless it does TLS interception with a CA installed on every
  client.
- The **server** sees the proxy's IP, not the client's.

## Reverse proxy - acts for servers

Clients think it **is** the server (DNS points at it); it decides which backend handles each
request.

- **Load balancing** across instances, **health checks** and failover.
- **TLS termination** - certificates and crypto in one place.
- **Caching**, compression, request/response buffering (shielding backends from slow clients).
- **Routing**: by path, host, header - one public endpoint, many internal services (API gateway).
- **Security**: hides backend topology, WAF rules, rate limiting, auth.
- **Zero-downtime deploys**: drain and swap backends behind a stable address.
- The **backend** sees the proxy's IP, so the proxy adds `X-Forwarded-For` / `Forwarded` headers
  (or the PROXY protocol at L4) to pass on the real client address.

## Costs

An extra hop (latency), another component to scale and keep available, and **two TCP connections
per flow** to manage (timeouts, keep-alive pools, buffering).

## Examples

Nginx, HAProxy, Envoy, Traefik, Caddy, AWS ALB/NLB, Cloudflare (reverse proxies / CDNs); Squid,
corporate secure web gateways (forward proxies). A **service mesh sidecar** is both: a forward proxy
for its app's outbound calls and a reverse proxy for inbound ones.

🖼️ **forward proxy (clients → proxy → internet) vs reverse proxy (internet → proxy → backend pool)**
![forward vs reverse proxy](<../../assets/img/forward-vs-reverse-proxy.png>)

## Practice project

[`practice/network-performance/proxy-l4-l7`](../../practice/network-performance/proxy-l4-l7) -
`forward-proxy.js` (HTTP + CONNECT tunnelling) and `l7-proxy.js` (reverse proxy with path routing,
`X-Forwarded-For`, 403 policy and 502 handling).

## Related

- [Load balancing at layer 4 vs layer 7](<load_balancing_at_layer4_vs_layer7.md>).
- [Should layer 4 proxies buffer segments](<../miscellaneous/should_layer_4_proxies_buffer_segments.md>).
- [What is SNI](<../miscellaneous/what_is_sni_(server_name_indication_tls_extension).md>) - routing TLS without terminating it.
