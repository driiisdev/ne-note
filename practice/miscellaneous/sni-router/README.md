# Practice: SNI Router (Server Name Indication)

Concept notes: [`what_is_sni_(server_name_indication_tls_extension).md`](<../../../concepts/miscellaneous/what_is_sni_(server_name_indication_tls_extension).md>) ·
related: [`tls.md`](<../../../concepts/overview of popular networking protocols/tls.md>) ·
[`load_balancing_at_layer4_vs_layer7.md`](<../../../concepts/network performance/load_balancing_at_layer4_vs_layer7.md>)

## What this demonstrates

One IP and one port, with two HTTPS sites behind it, each holding its own certificate. How does
the server know which certificate to present *before* any HTTP request (and its `Host` header)
has been decrypted? The client says which host it wants in the very first TLS message, in
plaintext, through the **SNI** extension.

`sni-proxy.js` uses that. It parses just enough of the ClientHello to read the hostname, picks a
backend, and then pipes encrypted bytes it can't read. It's L4-style passthrough with one L7-ish
peek, which is how many Kubernetes ingress controllers and multi-tenant edges route TLS without
holding anyone's private keys.

## Folder structure

```text
sni-router/
  generate-certs.sh   <- bash generate-certs.sh   -> alpha.key/.pem (CN=alpha.test), beta.key/.pem (CN=beta.test)
  backend.js          <- node backend.js <alpha|beta> <port>   HTTPS, terminates its own TLS
  sni-proxy.js        <- node sni-proxy.js [port]              :5940, routes by SNI, never decrypts
  client.js           <- node client.js [port]                 same IP:port, three different SNI names
```

## Run it

```bash
bash generate-certs.sh
node backend.js alpha 5941      # terminal 1
node backend.js beta 5942       # terminal 2
node sni-proxy.js               # terminal 3
node client.js                  # terminal 4
curl -k --resolve beta.test:5940:127.0.0.1 https://beta.test:5940/
```

`--resolve` makes curl send SNI `beta.test` while connecting to `127.0.0.1`, without editing
your hosts file.

## What you'll see

```text
127.0.0.1:5940 with SNI alpha.test    -> cert CN=alpha.test | hello from alpha.test (TLS terminated by the backend, not the router)
127.0.0.1:5940 with SNI beta.test     -> cert CN=beta.test | hello from beta.test (TLS terminated by the backend, not the router)
127.0.0.1:5940 with SNI unknown.test  -> failed: ECONNRESET
```

```text
[sni] 53717 asked for "alpha.test" -> :5941
[sni] 53720 asked for "beta.test" -> :5942
[sni] 53723 asked for "unknown.test" -> no route, closing
```

The router never had a certificate or private key, yet each client got the right site's
certificate.

> 🖼️ **Image suggestion:** the ClientHello drawn as a byte layout (record header → handshake
> header → version → random → session id → cipher suites → compression → extensions), with the
> `server_name` extension highlighted and an arrow labelled "readable by anyone on the path."

## Code walkthrough

**Wait for the whole record.** A ClientHello can be split across TCP segments, so the parser
reports `complete: false` until it has all `recordLen` bytes:

```js
const recordLen = buf.readUInt16BE(3);
if (buf.length < 5 + recordLen) return { complete: false };
```

**Then skip the fixed and variable-length fields to the extensions.** Every variable-length
field is prefixed by its own length, so the parser hops over each one:

```js
p += 2 + 32;                  // client_version + random
p += 1 + buf[p];              // session_id
p += 2 + buf.readUInt16BE(p); // cipher_suites
p += 1 + buf[p];              // compression_methods
```

**Extension type `0x0000` is `server_name`.** Inside it is a list (in practice one entry) of
`name_type` + length + hostname.

**Replay what you peeked at.** The backend has to receive the exact ClientHello the client sent,
or the handshake transcript won't match and TLS fails:

```js
upstream.write(buffered);
client.pipe(upstream).pipe(client);
```

## Why SNI exists, and its catch

- **Before SNI**, one IP could serve only one HTTPS certificate, because the server had to pick
  the certificate before it knew which site you wanted. Virtual hosting (many sites per IP),
  which HTTP had always had through the `Host` header, didn't work for HTTPS. SNI fixed that,
  and today virtually every TLS client sends it.
- **Privacy catch:** SNI is plaintext, even in TLS 1.3 (which encrypts the certificate itself).
  Anyone on the path (ISPs, corporate firewalls, censors) can see *which site* you're visiting
  without breaking encryption, and many filters work exactly this way. **ECH (Encrypted Client
  Hello)** encrypts the real SNI under a key published in DNS, leaving only a generic outer name
  visible. Support is growing (Cloudflare, Chrome, Firefox).

## Try this yourself

- Capture the handshake (`sudo tcpdump -i lo -w sni.pcap port 5940`, or the Wireshark loopback
  adapter) and apply the filter `tls.handshake.extensions_server_name`. You'll see the hostname
  in plaintext, in an otherwise encrypted connection.
- Connect with **no** SNI: `openssl s_client -connect 127.0.0.1:5940 -noservername`. The router
  logs `asked for "null"` and has to pick a default or refuse.
- Add a `default` route to `ROUTES` that serves a generic certificate for unknown or missing SNI.
  That's what most real servers do.
- Compare with an L7 approach: terminate TLS at the proxy with *both* certificates, using
  `tls.createServer` with the `SNICallback` option, then route on the decrypted `Host` header.
  It's more powerful, but now the proxy holds every site's private keys.

## Real-world equivalent

HAProxy (`req.ssl_sni` in `mode tcp`), Nginx `stream` with `ssl_preread`, Traefik and Istio's TLS
passthrough routes, Kubernetes ingress with `ssl-passthrough`, and shared-IP CDNs and hosting
platforms serving millions of domains from a few IPs all rely on SNI. It's also what firewalls
read to block sites without decrypting traffic.
