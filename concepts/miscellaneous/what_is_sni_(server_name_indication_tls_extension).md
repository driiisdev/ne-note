# What Is SNI? (Server Name Indication TLS Extension)

**SNI** is a TLS extension in which the client puts the **hostname** it wants into its very first
handshake message (the ClientHello). It exists because a server hosting many HTTPS sites on one IP
must choose which certificate to present **before** it can decrypt anything - including the HTTP
`Host` header.

## The problem it solved

- HTTP/1.1 virtual hosting: many sites on one IP, distinguished by the `Host` header.
- With HTTPS, the TLS handshake (and the certificate) comes **before** any HTTP. Without a hint, the
  server can only present one certificate per IP:port.
- SNI (RFC 6066) adds `server_name` to the ClientHello, so the server picks the right certificate.
  Virtually every client sends it today; servers may refuse handshakes without it.

## Where it sits in the ClientHello

```text
TLS record header (type 0x16, version, length)
  Handshake header (type 0x01 ClientHello, length)
    client_version, random (32 bytes), session_id
    cipher_suites, compression_methods
    extensions:
      server_name (type 0x0000): host_name = "www.example.com"
      supported_versions, key_share, ALPN ("h2", "http/1.1"), ...
```

## What it enables

- **Shared hosting and CDNs**: millions of domains served from a few IP addresses.
- **SNI routing / TLS passthrough**: an L4 proxy peeks at SNI, picks a backend, and forwards the
  still-encrypted stream - the proxy never holds private keys (HAProxy `req.ssl_sni`, Nginx
  `ssl_preread`, Kubernetes ingress passthrough, Istio).
- **Certificate selection** on the server (e.g. Node's `SNICallback`).
- **Hostname verification**: the same name is what the client checks the certificate's SAN against.

## The privacy catch

SNI is sent **in plaintext**, even in TLS 1.3 (which encrypts the certificate). ISPs, corporate
firewalls and censors can see and block by hostname without breaking encryption. Fixes:

- **ECH (Encrypted Client Hello)**: the real ClientHello (with the true SNI) is encrypted under a
  public key published in DNS (HTTPS records); observers see only a generic outer name. Supported by
  Cloudflare, Chrome and Firefox.
- (ESNI was an earlier draft, superseded by ECH.)

## Without SNI

Connecting by IP (`https://1.2.3.4`) sends no SNI (IPs aren't allowed in it) - the server falls back
to a default certificate, usually causing a name mismatch.

🖼️ **clienthello byte layout with the server_name extension highlighted as "readable by anyone on the path"**
![sni clienthello](<../../assets/img/sni-clienthello.png>)

## Practice project

[`practice/miscellaneous/sni-router`](../../practice/miscellaneous/sni-router) -
`sni-proxy.js` parses the ClientHello by hand and routes `alpha.test` / `beta.test` to different TLS
backends on the same IP:port without decrypting anything.

## Related

- [TLS](<../overview of popular networking protocols/tls.md>) and [HTTPS, TLS keys and certificates](<../overview of popular networking protocols/https_tls_keys_n_certificate.md>).
- [Load balancing at layer 4 vs layer 7](<../network performance/load_balancing_at_layer4_vs_layer7.md>).
- [Wiresharking HTTP/2 (decrypting TLS)](<../analyzing protocols with wireshark/wiresharking_http-2(decrypting_tls).md>) - filter `tls.handshake.extensions_server_name`.
