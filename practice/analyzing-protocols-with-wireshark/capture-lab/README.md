# Practice: Wireshark Capture Lab

Concept notes: [`wiresharking_udp.md`](<../../../concepts/analyzing protocols with wireshark/wiresharking_udp.md>) ·
[`wiresharking_tcp-http.md`](<../../../concepts/analyzing protocols with wireshark/wiresharking_tcp-http.md>) ·
[`wiresharking_http-2(decrypting_tls).md`](<../../../concepts/analyzing protocols with wireshark/wiresharking_http-2(decrypting_tls).md>) ·
[`wiresharking_mongodb.md`](<../../../concepts/analyzing protocols with wireshark/wiresharking_mongodb.md>) ·
[`wiresharking_server_sent_events.md`](<../../../concepts/analyzing protocols with wireshark/wiresharking_server_sent_events.md>)

## What this demonstrates

One traffic generator per lecture, each built so it produces something specific to look for in
Wireshark:

| Generator | Port | What to look for |
| --- | --- | --- |
| `udp-traffic.js` | 5801 | datagrams with no handshake; the 1200-byte one in the Length column |
| `http-server.js` + `curl` | 5802 | the full TCP lifecycle, and **plaintext** HTTP: a password readable in Follow TCP Stream |
| `h2-server.js` + `h2-client.js` | 5803 | TLS 1.3 "Application Data" blobs, then the **decrypted** HTTP/2 frames once you load `keys.log` |
| `mongo-wire-client.js` + MongoDB | 27017 | MongoDB's OP_MSG wire protocol, decoded by Wireshark's `mongo` dissector |
| `sse-server.js` + `curl -N` | 5804 | one HTTP response that keeps arriving, event by event, in separate TCP segments |

## Setup: capturing loopback traffic

All of this runs on `127.0.0.1`, so capture the **loopback** interface:

- **Windows**: install Wireshark with **Npcap** (the default), then pick *"Adapter for loopback
  traffic capture"*.
- **Linux / WSL**: interface `lo` (or `sudo tcpdump -i lo -w lab.pcap` and open the file later).
- **macOS**: interface `lo0`.

## Folder structure

```text
capture-lab/
  udp-traffic.js          <- node udp-traffic.js
  http-server.js          <- node http-server.js           + curl
  generate-cert.sh        <- bash generate-cert.sh         -> key.pem cert.pem (for h2)
  h2-server.js            <- node h2-server.js
  h2-client.js            <- node --tls-keylog=keys.log h2-client.js
  mongo-wire-client.js    <- node mongo-wire-client.js     (needs MongoDB, e.g. in Docker)
  sse-server.js           <- node sse-server.js            + curl -N
```

## Lab 1: UDP (`udp.port == 5801`)

```bash
node udp-traffic.js
```

- There are no SYN or FIN packets: the first packet already carries data.
- Expand **User Datagram Protocol**. The whole header is 4 fields: source port, destination port,
  length and checksum.
- Find the 1200-byte datagram. On loopback, the "length" in the UDP header and the frame length
  differ by exactly the IP header plus the loopback/link header.

## Lab 2: TCP + HTTP/1.1 (`tcp.port == 5802`)

```bash
node http-server.js
curl http://127.0.0.1:5802/hello
curl -X POST -d '{"user":"ada","password":"hunter2"}' http://127.0.0.1:5802/login
```

- Mark the **3-way handshake** (`[SYN]`, `[SYN, ACK]`, `[ACK]`), the request and response, and
  the **FIN** teardown.
- Right-click a packet → **Follow → TCP Stream**. The password is right there in plaintext.
  This is the whole argument for HTTPS, in one window.
- **Statistics → Flow Graph** draws the sequence diagram for you.
- Turn on **relative sequence numbers** (the default) vs. absolute
  (*Edit → Preferences → Protocols → TCP*) and compare them with the raw ISN.

## Lab 3: HTTP/2 over TLS, then decrypt it (`tcp.port == 5803`)

```bash
bash generate-cert.sh
node h2-server.js
node --tls-keylog=keys.log h2-client.js
```

1. Without keys you'll see the TLS handshake (ClientHello with **SNI** `localhost` and the
   **ALPN** extension offering `h2`), and then only *Application Data* records.
2. Load the keys: **Edit → Preferences → Protocols → TLS → (Pre)-Master-Secret log filename**,
   then pick `keys.log`.
3. The same packets now decode as **HTTP2**: `HEADERS` and `DATA` frames on **streams 1, 3 and
   5**, interleaved on one TCP connection. That's multiplexing, made visible.

`keys.log` holds TLS 1.3's per-connection secrets (`CLIENT_TRAFFIC_SECRET_0`,
`SERVER_HANDSHAKE_TRAFFIC_SECRET`, and so on). Browsers write the same file when you set the
`SSLKEYLOGFILE` environment variable, which is how you decrypt real browser traffic you own.
**Delete it afterwards:** anyone with the file and the capture can read everything.

> 🖼️ **Image suggestion:** a screenshot pair of the same packet before and after loading
> `keys.log`. On the left it says "Application Data." On the right is an HTTP2 HEADERS frame
> showing `:path: /orders`.

## Lab 4: MongoDB wire protocol (`mongo` or `tcp.port == 27017`)

```bash
docker run -d --name mongo-lab -p 27017:27017 mongo:7
node mongo-wire-client.js
docker rm -f mongo-lab
```

`mongo-wire-client.js` uses **no driver**. It hand-encodes BSON and hand-builds each OP_MSG
frame, so every field Wireshark shows (message length, request ID, `responseTo`, opcode
`2013`, the BSON command document) maps to a line in the script:

```js
header.writeInt32LE(16 + 4 + 1 + doc.length, 0); // messageLength
header.writeInt32LE(++requestId, 4);             // requestID  -> the reply's responseTo matches it
header.writeInt32LE(OP_MSG, 12);                 // opCode 2013
```

- Match each request's `requestID` to the response's `responseTo`.
- Find the `insert` command's documents array, then the `find` reply's `cursor.firstBatch` with
  server-generated `_id`s.
- Notice that MongoDB, like HTTP, frames messages itself on top of TCP: the first 4 bytes say how
  long the message is.

*(The BSON encoding was checked byte-for-byte against the BSON spec's reference example, but this
client was not run against a live MongoDB while writing this. Report back if the server rejects
anything.)*

## Lab 5: Server-Sent Events (`tcp.port == 5804`)

```bash
node sse-server.js
curl -N http://127.0.0.1:5804/events
```

- One request, one response with `Content-Type: text/event-stream` and **no Content-Length**.
  Node uses `Transfer-Encoding: chunked`, so each event arrives as its own chunk about a second
  apart, in its own TCP segment.
- Follow TCP Stream shows the SSE text format: `id:`, `event:`, `data:` lines, with a blank line
  between events.
- Compare it with Lab 2. SSE is plain HTTP that just doesn't end, which is why it passes through
  proxies and firewalls that would block WebSockets.

## Display filters cheat sheet

```text
udp.port == 5801                      tcp.flags.syn == 1 && tcp.flags.ack == 0   (new connections)
tcp.port == 5802 && http              tcp.flags.reset == 1                       (resets)
tls.handshake.type == 1               tcp.analysis.retransmission                (retransmits)
tls.handshake.extensions_server_name  tcp.analysis.zero_window                   (flow control stalls)
http2.streamid == 3                   mongo.opcode == 2013
```

## Real-world equivalent

The same workflow covers most "the network is broken" tickets: capture on the right interface,
filter down to one conversation, Follow Stream, and read the protocol. TLS key logging is how
teams debug HTTPS services they own without disabling encryption.
