# TLS (Transport Layer Security)

The protocol that makes a connection **confidential** (encrypted), **integral** (tamper-evident)
and **authenticated** (you're talking to who you think). It runs on top of TCP (QUIC embeds TLS
1.3 itself) and underneath HTTP, SMTP, database protocols and more - HTTPS is simply HTTP over TLS.

## The TLS 1.3 handshake (1 round trip)

```text
client                                           server
ClientHello  ------------------------------------>
  supported versions, cipher suites,
  key_share (client's ephemeral public key),
  SNI (hostname), ALPN (h2 / http/1.1)
             <------------------------------------  ServerHello (server's key_share)
                                                    {EncryptedExtensions}
                                                    {Certificate}
                                                    {CertificateVerify}  signature over the handshake
                                                    {Finished}
{Finished}   ------------------------------------>
[application data, encrypted]  <================>
```

1. Both sides do an **(EC)DHE key exchange** from the key shares → a shared secret that never
   crossed the wire.
2. Keys for the rest of the handshake and for application data are derived from it (HKDF).
3. The server proves it owns its certificate's private key by **signing** the handshake
   transcript (CertificateVerify). The client verifies the certificate chain and hostname.
4. Bulk data is encrypted with a fast **AEAD** cipher (AES-GCM, ChaCha20-Poly1305).

## TLS 1.2 vs 1.3

| | TLS 1.2 | TLS 1.3 |
| --- | --- | --- |
| Handshake | 2 RTT | 1 RTT (0-RTT on resumption) |
| Key exchange | RSA or (EC)DHE | (EC)DHE only → always forward secret |
| Certificate | sent in clear | encrypted |
| Cipher suites | many, some weak | 5, all AEAD |

## Resumption and 0-RTT

A returning client can use a **session ticket** (PSK) to skip the certificate exchange, and with
**0-RTT** send its first request in the very first flight. 0-RTT data can be **replayed**, so it's
only safe for idempotent requests.

## What TLS does not hide

The server IP and port, packet sizes and timing, and - unless Encrypted Client Hello is used - the
**SNI hostname** in the ClientHello.

🖼️ **tls 1.3 handshake sequence diagram, next to tls 1.2's two round trips**
![tls 1.3 handshake](<../../assets/img/tls13-handshake.png>)

## Practice project

[`practice/overview-of-popular-networking-protocols/tls-handshake-lab`](../../practice/overview-of-popular-networking-protocols/tls-handshake-lab) -
`key-exchange.js` runs the TLS building blocks by hand; `client.js` connects with TLS 1.3 and 1.2
and shows when verification fails.

## Related

- [HTTPS, TLS keys and certificates](<https_tls_keys_n_certificate.md>) - the trust side.
- [What is SNI](<../miscellaneous/what_is_sni_(server_name_indication_tls_extension).md>).
- [Wiresharking HTTP/2 (decrypting TLS)](<../analyzing protocols with wireshark/wiresharking_http-2(decrypting_tls).md>).
- [Cost of connection establishment](<../network performance/cost_of_connection_establishment.md>) - TLS's round trips.
