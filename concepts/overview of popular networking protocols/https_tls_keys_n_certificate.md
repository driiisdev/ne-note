# HTTPS, TLS Keys and Certificates

HTTPS is HTTP sent over TLS. The encryption part is solved by key exchange; the hard part is
**trust** - knowing the public key you're exchanging with really belongs to `bank.com` and not to
someone in the middle. Certificates and Certificate Authorities solve that.

## Two kinds of cryptography, two jobs

| | Asymmetric (public/private key) | Symmetric (shared key) |
| --- | --- | --- |
| Examples | ECDHE, RSA, ECDSA, Ed25519 | AES-GCM, ChaCha20-Poly1305 |
| Used for | key exchange, signatures (authentication) | encrypting the actual data |
| Speed | slow | very fast (hardware-accelerated) |
| In TLS | only during the handshake | everything after it |

**Key exchange** (ECDHE): each side combines its own private key with the other's public key and
both get the same secret - which never travelled over the network. Fresh keys per connection give
**forward secrecy**: stealing the server's long-term key later can't decrypt past traffic.

## Certificates

An X.509 certificate binds a **public key** to an **identity**:

- **Subject / SAN** (Subject Alternative Name): the hostnames it's valid for - clients match the
  hostname against the **SAN**, not the CN.
- **Validity period** (`notBefore` / `notAfter`) - publicly trusted certs are capped at 200 days
  since March 2026, shrinking in phases toward 47 days by 2029, which makes automated renewal
  essential.
- **Issuer** and the issuer's **signature** over all of the above.
- Extensions: key usage, basic constraints (is this a CA?), OCSP/CRL locations.

The server keeps the matching **private key** secret and proves possession by signing the TLS
handshake.

## The chain of trust

```text
Root CA (self-signed, preinstalled in OS/browser trust store)
  └── signs Intermediate CA certificate
        └── signs leaf certificate for www.example.com  (sent by the server, with the intermediate)
```

The client checks each signature up to a root it already trusts, the validity dates, revocation,
and that the hostname matches the SAN. **Both** checks are essential: a trusted cert for the wrong
name is useless, and a matching name signed by an unknown CA proves nothing.

## Getting certificates

Let's Encrypt (free, automated via ACME, 90-day certs), commercial CAs, or a **private CA** for
internal services and mTLS. Self-signed certificates work only where you explicitly trust them.

## mTLS

Mutual TLS: the client also presents a certificate - common between microservices (service meshes).

🖼️ **certificate chain: root → intermediate → leaf, with the signature arrows and the client's checks**
![certificate chain](<../../assets/img/certificate-chain.png>)

## Practice project

[`practice/overview-of-popular-networking-protocols/tls-handshake-lab`](../../practice/overview-of-popular-networking-protocols/tls-handshake-lab) -
`generate-cert.sh` builds a local CA and a signed server cert; `client.js` fails without the CA,
succeeds with it, and fails again on the wrong hostname.

## Related

- [TLS](<tls.md>) - the handshake that uses these keys.
- [What is SNI](<../miscellaneous/what_is_sni_(server_name_indication_tls_extension).md>) - choosing which certificate to send.
- [Wiresharking HTTP/2 (decrypting TLS)](<../analyzing protocols with wireshark/wiresharking_http-2(decrypting_tls).md>).
