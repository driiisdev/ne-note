# The Networking Behind Clicking a Link

Clicking `https://example.com/page` uses nearly every concept in this course in about a quarter of a
second. Walking through it end to end is the best way to see how the layers fit together.

## Step by step

1. **URL parsing and policy**: scheme, host, path. HSTS may upgrade `http://` to `https://` before
   anything is sent; the HTTP cache may answer without any network at all.
2. **DNS**: browser cache → OS cache → the recursive resolver (router/ISP/`1.1.1.1`) → on a miss,
   root → `.com` → authoritative. Result: an IP (often an anycast CDN edge). ~0-100 ms.
3. **Next hop**: the destination isn't on the local subnet, so the OS ARPs for the **gateway's**
   MAC and sends frames to the router.
4. **NAT**: the home router rewrites the private source address/port to its public one.
5. **Routing**: each router on the path does a longest-prefix match, decrements TTL, and forwards.
6. **TCP handshake**: SYN, SYN-ACK, ACK - 1 RTT. MSS negotiated.
7. **TLS handshake**: ClientHello with **SNI** and **ALPN** (`h2`), certificate verification,
   key exchange - +1 RTT with TLS 1.3. (HTTP/3 does transport + TLS together over QUIC/UDP.)
8. **HTTP request**: `GET /page`, headers, cookies - encrypted.
9. **Server side**: CDN/reverse proxy terminates TLS, maybe serves from cache, or routes (L7) to an
   origin over a warm connection; the app may query databases.
10. **Response**: status, headers, body - delivered over several RTTs as TCP slow start ramps up
    for large pages. TTFB = network RTT + server think time.
11. **More fetches**: the HTML references CSS, JS, images, fonts - often on other hosts (CDNs,
    analytics), each needing its own DNS + TCP + TLS. Browsers reuse connections (HTTP/1.1 keep-alive,
    ~6 per host; HTTP/2/3 multiplex on one).
12. **Rendering** - no longer networking.

## Where the time goes

```text
DNS ██ | TCP ███ | TLS █████ | request → first byte ██████ | download ████
```

Every optimization targets a bar: DNS prefetch, `preconnect`, keep-alive, TLS 1.3 / 0-RTT, HTTP/2
and HTTP/3, CDNs close to users, compression, fewer redirects (each redirect repeats the bars).

🖼️ **browser devtools waterfall annotated with each phase, alongside the protocol layers involved**
![clicking a link](<../../assets/img/clicking-a-link-waterfall.png>)

## Practice project

[`practice/miscellaneous/clicking-a-link`](../../practice/miscellaneous/clicking-a-link) -
`link-timeline.js` does DNS, TCP, TLS and a raw HTTP/1.1 request by hand, timing each phase, follows
redirects, and lists the other hosts the page pulls from.

## Related

- [DNS](<../overview of popular networking protocols/dns.md>), [TLS](<../overview of popular networking protocols/tls.md>).
- [Host to host communication](<../fundamentals of networking/host_to_host_communication.md>), [NAT](<../transmission control protocol/nat.md>), [routing](<../internet protocol/routing.md>).
- [Cost of connection establishment](<../network performance/cost_of_connection_establishment.md>).
- [What is SNI](<what_is_sni_(server_name_indication_tls_extension).md>).
