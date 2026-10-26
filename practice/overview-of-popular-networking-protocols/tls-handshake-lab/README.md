# Practice: TLS Handshake Lab

Concept notes: [`tls.md`](<../../../concepts/overview of popular networking protocols/tls.md>) ·
[`https_tls_keys_n_certificate.md`](<../../../concepts/overview of popular networking protocols/https_tls_keys_n_certificate.md>)

## What this demonstrates

TLS has two jobs that are easy to blur together, so this project splits them apart:

1. **Encryption (the keys).** `key-exchange.js` runs the same building blocks TLS 1.3 uses:
   X25519 key exchange, an HKDF-derived session key, and AES-256-GCM encryption. It shows two
   parties ending up with the same secret even though the secret never crosses the wire.
2. **Authentication (the certificates).** `generate-cert.sh` builds a tiny local PKI: your own
   CA, and a server certificate it signs. `client.js` then connects four ways to show exactly
   when a client trusts a certificate and when it refuses to.

## Folder structure

```text
tls-handshake-lab/
  generate-cert.sh   <- bash generate-cert.sh  -> ca.key ca.pem server.key server.pem
  server.js          <- node server.js [port]  HTTPS on :8443 with the CA-signed cert
  client.js          <- node client.js [port]  4 connection attempts, each explained
  key-exchange.js    <- node key-exchange.js   ECDHE + HKDF + AES-GCM + signature, no TLS
```

## Run it

```bash
node key-exchange.js            # no setup needed

bash generate-cert.sh           # needs openssl (macOS/Linux/WSL, or Git Bash on Windows)
node server.js                  # terminal 1
node client.js                  # terminal 2
openssl s_client -connect localhost:8443 -CAfile ca.pem -servername localhost   # the raw view
```

## What you'll see

```text
== 1. no CA given - does the client trust whoever signed this cert?
   FAILED: UNABLE_TO_VERIFY_LEAF_SIGNATURE

== 2. trust our CA explicitly
   OK in 6.4 ms: TLSv1.3, cipher TLS_AES_256_GCM_SHA384
   server cert : subject CN=localhost, issued by CN=Local Dev CA
   names (SAN) : DNS:localhost, IP Address:127.0.0.1
   chain       : localhost
   chain       : Local Dev CA

== 3. trusted CA, but we expected a different hostname
   FAILED: ERR_TLS_CERT_ALTNAME_INVALID

== 4. same as 2, but cap the version at TLS 1.2
   OK in 6.8 ms: TLSv1.2, cipher ECDHE-RSA-AES128-GCM-SHA256
```

The two checks a client makes on every connection:

1. **Is the certificate signed by a CA I trust?** Attempt 1 fails this check, and attempt 2
   passes it.
2. **Is it for the host I meant to reach?** Attempt 3 fails this check.

Both checks must pass. Either one alone is worthless.

> 🖼️ **Image suggestion:** the TLS 1.3 handshake as a sequence diagram. ClientHello (with
> key_share) goes out, and ServerHello (key_share) + {Certificate, CertificateVerify, Finished}
> come back in ONE round trip, then encrypted app data flows. Next to it, TLS 1.2's two round
> trips for comparison.

## Code walkthrough

**Private key vs. certificate.** The server needs both, but only one is ever sent:

```js
key: read("server.key"),   // private: proves we own the certificate. Never leaves this machine.
cert: read("server.pem"),  // public: sent to every client during the handshake
```

A certificate is a public key plus an identity (`CN=localhost`, SAN `DNS:localhost`), **signed
by a CA**. Anyone can copy `server.pem`. Only the holder of `server.key` can produce the
handshake signature that matches it.

**Hostname checking uses the SAN, not the CN.** Modern clients ignore `CN` for hostname
matching. That's why `generate-cert.sh` adds `subjectAltName=DNS:localhost,IP:127.0.0.1`, and why
attempt 3's error lists the "altnames."

**Key exchange makes a secret nobody sent.** Each side combines *its own private* key with *the
other's public* key and gets the same result:

```js
const clientSecret = crypto.diffieHellman({ privateKey: client.privateKey, publicKey: server.publicKey });
const serverSecret = crypto.diffieHellman({ privateKey: server.privateKey, publicKey: client.publicKey });
// clientSecret.equals(serverSecret) === true
```

Fresh ("ephemeral") keys are generated per connection, which gives **forward secrecy**: stealing
the server's certificate key later doesn't decrypt past sessions. TLS 1.3 *requires* this. TLS
1.2 also allowed plain RSA key exchange, which didn't have it.

**Why both asymmetric and symmetric crypto?** Asymmetric operations (key exchange, signatures)
are slow and used only during the handshake. The bulk data uses AES-GCM, which is fast and
hardware-accelerated, and also detects tampering (step 3 of `key-exchange.js` flips one byte and
decryption is rejected).

## TLS 1.2 vs. TLS 1.3

| | TLS 1.2 | TLS 1.3 |
| --- | --- | --- |
| Handshake round trips | 2 | 1 (0 with resumption + 0-RTT early data) |
| Key exchange | RSA *or* (EC)DHE | (EC)DHE only, so always forward secret |
| Cipher suite names | `ECDHE-RSA-AES128-GCM-SHA256` (bundles key exchange + auth + cipher + hash) | `TLS_AES_256_GCM_SHA384` (cipher + hash only) |
| Certificate encrypted? | no, visible to observers | yes |

## Try this yourself

- Decode the certificate yourself: `openssl x509 -in server.pem -noout -text`. Find the public
  key, the signature algorithm, the validity dates and the SAN extension.
- Capture the handshake: `sudo tcpdump -i lo -w tls.pcap port 8443`, run the client, and open
  the file in Wireshark with the filter `tls.handshake`. In the TLS 1.2 run the Certificate
  message is readable. In TLS 1.3 it's encrypted. (See
  `practice/analyzing-protocols-with-wireshark/capture-lab` for decrypting it.)
- Trust the CA like a browser would: pass `NODE_EXTRA_CA_CERTS=ca.pem` and then attempt 1
  succeeds without the `ca` option. Corporate TLS-inspecting proxies work exactly this way,
  by installing their CA on every laptop.
- Swap `server.pem` for one signed by a *different* CA, generated with a copy of the script, and
  watch attempt 2 fail.

## Real-world equivalent

This is HTTPS for every website, with Let's Encrypt or DigiCert in place of "Local Dev CA" and
your OS or browser trust store in place of `ca: CA`. Internal service meshes (mTLS between
microservices) run the same setup with a private CA, and both sides present certificates.
