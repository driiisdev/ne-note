# Wiresharking HTTP/2 (Decrypting TLS)

HTTP/2 in practice always runs over TLS, so a capture normally shows only the TLS handshake and
then opaque "Application Data". Wireshark can decrypt it if you give it the session secrets - the
standard way to debug HTTPS traffic **you own**.

## What's visible without keys

- The TCP handshake.
- **ClientHello**: supported versions and ciphers, **SNI** (`tls.handshake.extensions_server_name`)
  and **ALPN** offering `h2` / `http/1.1`.
- **ServerHello**: chosen version and cipher. In TLS 1.2 the certificate is also visible; in TLS
  1.3 everything after ServerHello is encrypted.
- Then only `Application Data` records with sizes and timings.

## Getting the keys: the key log file

Clients can write per-connection secrets to a file in the **NSS key log format**:

- Browsers and curl: set the **`SSLKEYLOGFILE`** environment variable before launching.
- Node: `node --tls-keylog=keys.log app.js`, or the TLS socket's `'keylog'` event.

For TLS 1.3 it contains lines like `CLIENT_HANDSHAKE_TRAFFIC_SECRET`, `SERVER_TRAFFIC_SECRET_0`, ...
Then in Wireshark: **Edit → Preferences → Protocols → TLS → (Pre)-Master-Secret log filename**.

(Decrypting with the server's RSA private key only worked for old RSA key exchange; with (EC)DHE -
all of TLS 1.3 - key logs are the only way.)

## What HTTP/2 looks like decrypted

- The **connection preface** (`PRI * HTTP/2.0`), then **SETTINGS** frames both ways.
- **HEADERS** frames (HPACK-compressed; Wireshark decodes `:method`, `:path`, `:status`) and **DATA**
  frames, each tagged with a **stream ID** - client streams are odd (1, 3, 5, ...).
- Frames from different streams **interleaved** on one TCP connection - multiplexing made visible.
- **WINDOW_UPDATE** (HTTP/2's own flow control), **PING**, **GOAWAY**, **RST_STREAM**.
- Filters: `http2`, `http2.streamid == 3`, `http2.type == 1` (HEADERS).

## Safety

Anyone with the key log file and the capture can read everything in it. Delete key logs after use,
never enable `SSLKEYLOGFILE` globally on a shared machine, and never collect them in production
without consent.

🖼️ **the same packet before and after loading the key log: "application data" vs an http2 headers frame with :path**
![wireshark tls decrypted](<../../assets/img/wireshark-tls-decrypted.png>)

## Practice project

[`practice/analyzing-protocols-with-wireshark/capture-lab`](../../practice/analyzing-protocols-with-wireshark/capture-lab) -
lab 3: `h2-server.js` + `node --tls-keylog=keys.log h2-client.js` sends three requests on streams 1, 3, 5.

## Related

- [TLS](<../overview of popular networking protocols/tls.md>) - what the secrets are for.
- [TCP head-of-line blocking](<../network performance/tcp_head_of_line_blocking.md>) - HTTP/2's weakness.
- [What is SNI](<../miscellaneous/what_is_sni_(server_name_indication_tls_extension).md>) - visible even when encrypted.
