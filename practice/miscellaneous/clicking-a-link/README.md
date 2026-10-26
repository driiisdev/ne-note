# Practice: The Networking Behind Clicking a Link

Concept notes: [`the_networking_behind_clicking_a_link.md`](<../../../concepts/miscellaneous/the_networking_behind_clicking_a_link.md>) ·
related: [`dns.md`](<../../../concepts/overview of popular networking protocols/dns.md>) ·
[`tls.md`](<../../../concepts/overview of popular networking protocols/tls.md>) ·
[`cost_of_connection_establishment.md`](<../../../concepts/network performance/cost_of_connection_establishment.md>)

## What this demonstrates

The whole course, in the time it takes a page to load. `link-timeline.js` fetches a URL the long
way, with every phase done by hand so it can be timed on its own:

1. **DNS**: `dns.lookup` turns the hostname into an IP, through the OS resolver and its cache
2. **TCP**: `net.createConnection` does the 3-way handshake
3. **TLS**: `tls.connect` does the handshake, using the hostname as SNI, and verifies the
   certificate chain
4. **HTTP request**: a raw HTTP/1.1 `GET` written as text, encrypted by TLS on the way out
5. **Time to first byte (TTFB)**: network round trip plus the server's think time
6. **Download**: the rest of the response, which TCP slow start makes take several round trips
   for big pages
7. **Redirects** repeat everything on a new connection, and the HTML points to **more hosts**,
   each needing its own DNS, TCP and TLS

## Folder structure

```text
clicking-a-link/
  link-timeline.js   <- node link-timeline.js <url>
```

## Run it

```bash
node link-timeline.js https://example.com
node link-timeline.js http://github.com        # an http -> https redirect, timed hop by hop
node link-timeline.js https://www.bbc.com      # a page that pulls from many other hosts
```

## What you'll see

```text
http://github.com
  HTTP/1.1 301 Moved Permanently   (103 bytes)
  DNS lookup                34.1 ms  |███████████
  TCP connect               46.5 ms  |           ███████████████
  request -> first byte     39.7 ms  |                           █████████████
  total                    124.3 ms
  -> redirect to https://github.com/  (a whole new connection: every phase again)

https://github.com/
  HTTP/1.1 200 OK   (578,247 bytes)
  tls  TLSv1.3, TLS_AES_128_GCM_SHA256, cert for github.com issued by Sectigo Limited
  DNS lookup                 4.5 ms  |█
  TCP connect               44.9 ms  |███
  TLS handshake            116.6 ms  |    ████████
  request -> first byte    205.0 ms  |            ███████████████
  download                 185.7 ms  |                           █████████████
  total                    557.2 ms

the HTML references 5 other host(s); a browser would now repeat DNS+TCP+TLS for each:
  - github.githubassets.com
  - avatars.githubusercontent.com
  ...
```

How to read it:

- **TCP connect ≈ 1 RTT** (about 45 ms here), so the round trip to the server can be read straight
  off that line.
- **The second DNS lookup took 4.5 ms instead of 34 ms.** The OS cached the answer from the
  first hop, as the TTL allows.
- **The TLS handshake takes more than 1 RTT** even with TLS 1.3. The extra time is certificate
  chain verification and key-exchange CPU on both ends, not just network.
- **The redirect cost a full round of DNS, TCP and request**, about 124 ms, before the real page
  even started. HSTS preloading is how browsers skip it.
- **The download was 186 ms for 578 KB.** That's TCP slow start ramping the congestion window
  over several round trips (see `practice/transmission-control-protocol/flow-and-congestion`).

> 🖼️ **Image suggestion:** a browser DevTools Network-tab waterfall for the same URL next to this
> script's output. The browser's "Timing" tab uses the same phase names: DNS Lookup, Initial
> Connection, SSL, Waiting (TTFB), and Content Download.

## Code walkthrough

**TLS runs on top of the TCP socket that already exists.** That makes the layering visible:

```js
const s = net.createConnection({ host: address, port }, ...);                // L4: the TCP handshake
stream = tls.connect({ socket, servername: u.hostname, ... });               // TLS on top of that socket
stream.write(`GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}...`); // L7 on top of that
```

**`servername` is the SNI.** The script connects to an *IP*, but tells TLS the *hostname*, so the
server presents the right certificate and Node verifies it against that name.

**HTTP/1.1 is just text.** `Connection: close` asks the server to end the connection after the
response, so "download finished" equals "socket ended," which keeps the timing simple.
`Accept-Encoding: identity` turns off compression so the byte count is the real size.

## The full sequence, end to end

1. URL parsing, HSTS check (upgrade to https?), browser cache check
2. **DNS**: browser cache → OS cache → resolver (`1.1.1.1` / ISP) → root → TLD → authoritative
   (see `practice/overview-of-popular-networking-protocols/dns-from-scratch`)
3. **ARP / next hop**: the packet goes to your gateway's MAC
   (see `practice/fundamentals-of-networking/host-to-host`)
4. **NAT**: your router rewrites the source IP and port
   (see `practice/transmission-control-protocol/nat-simulator`)
5. **Routing**: each router does a longest-prefix match and decrements TTL
   (see `practice/internet-protocol/subnet-and-routing`)
6. **TCP handshake**, then the **TLS handshake** with SNI and ALPN (`h2` or `http/1.1`)
7. **HTTP request → response**, with the CDN or reverse proxy in between doing L7 routing
8. **HTML parse** → more hosts → steps 2 to 7 again (browsers keep about 6 connections per host
   for HTTP/1.1, one for HTTP/2)
9. Rendering, which is no longer networking

## Try this yourself

- Run the same URL twice. DNS is much faster the second time because of the cache. Then clear the
  OS cache (`ipconfig /flushdns` on Windows) and run it again.
- Compare a nearby site with a far-away one (`https://www.gov.au` from outside Australia). TCP
  connect tracks the distance, roughly 1 ms per 100 km of round-trip fibre.
- Add HTTP keep-alive: send *two* requests on the same TLS connection (drop
  `Connection: close` and parse `Content-Length`). The second request skips DNS, TCP and TLS
  entirely.
- Open DevTools → Network for the same page and compare its waterfall with this script's
  output. Then check the Protocol column (`h2` / `h3`) to see which requests a browser can
  multiplex.

## Real-world equivalent

This is `curl -w` with timing variables (`time_namelookup`, `time_connect`, `time_appconnect`,
`time_starttransfer`), the browser's Network waterfall, and every web-performance tool built on
them. The optimizations they inspire (DNS prefetch, `preconnect`, keep-alive, CDNs, TLS 1.3,
HTTP/2 and HTTP/3, fewer redirects) each remove one of the bars above.
