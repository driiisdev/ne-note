# Practice: TCP Echo

Concept notes: [`tcp.md`](<../../../concepts/transmission control protocol/tcp.md>) ·
[`tcp_segment.md`](<../../../concepts/transmission control protocol/tcp_segment.md>) ·
[`tcp_server_with_javascript_using_nodejs.md`](<../../../concepts/transmission control protocol/tcp_server_with_javascript_using_nodejs.md>) ·
[`tcp_server_with_c.md`](<../../../concepts/transmission control protocol/tcp_server_with_c.md>) ·
[`capturing_tcp_segment_with_tcpdump.md`](<../../../concepts/transmission control protocol/capturing_tcp_segment_with_tcpdump.md>)

## What this demonstrates

- **The same echo server in Node and in C.** The C version spells out the full server lifecycle
  (`socket → bind → listen → accept → read/write → close`) that `net.createServer` hides.
- **TCP is a byte stream.** The client makes 5 separate `write()` calls, and the server
  typically receives them in fewer chunks (2 in the run below). The bytes and their order are
  guaranteed, but the boundaries between writes are not.
- **A connection's full life on the wire**: SYN, SYN-ACK, ACK, data and ACKs, then FIN and ACK
  in each direction, captured with `tcpdump`.

## Folder structure

```text
tcp-echo/
  server.js    <- node server.js [port]            (default :5100), logs every raw chunk
  server.c     <- gcc server.c -o tcp-server && ./tcp-server [port]
  client.js    <- node client.js [port] [host]     5 writes, then FIN
  capture.sh   <- tcpdump recipes: (default) | handshake | hex | pcap
```

## Run it

```bash
node server.js           # terminal 1  (or the C one, in Linux/WSL/macOS)
node client.js           # terminal 2
bash capture.sh          # terminal 3, start it BEFORE running the client
```

## What you'll see

Server:

```text
[accept] ::ffff:127.0.0.1:49672  (3-way handshake already done by the kernel)
[data  ] 5 bytes in one chunk: "msg1;"
[data  ] 20 bytes in one chunk: "msg2;msg3;msg4;msg5;"
[FIN   ] ::ffff:127.0.0.1:49672 closed its side
[close ] ::ffff:127.0.0.1:49672
```

`tcpdump` (output shortened, and your numbers will differ):

```text
IP 127.0.0.1.49672 > 127.0.0.1.5100: Flags [S],  seq 1804289383, win 65495, options [mss 65495,...]
IP 127.0.0.1.5100 > 127.0.0.1.49672: Flags [S.], seq 846930886, ack 1804289384, ...
IP 127.0.0.1.49672 > 127.0.0.1.5100: Flags [.],  ack 846930887, ...
IP 127.0.0.1.49672 > 127.0.0.1.5100: Flags [P.], seq 1804289384:1804289389, ack ..., length 5
...
IP 127.0.0.1.49672 > 127.0.0.1.5100: Flags [F.], ...
IP 127.0.0.1.5100 > 127.0.0.1.49672: Flags [F.], ...
IP 127.0.0.1.49672 > 127.0.0.1.5100: Flags [.],  ...
```

Flag key: `S` = SYN, `.` = ACK, `P` = PSH, `F` = FIN, `R` = RST. Notice the SYN-ACK's `ack` is
the client's ISN **+ 1**. The SYN consumes one sequence number even though it carries no data,
and so does the FIN.

> 🖼️ **Image suggestion:** a sequence diagram (client and server lifelines) of this exact capture.
> The handshake, the data segments with their seq/ack numbers, and the four-segment close. The
> close here is usually three segments because the server's FIN and ACK get combined.

## Code walkthrough

**`listen()` vs. `accept()`.** Once `listen()` is called, the *kernel* answers SYNs and completes
handshakes on its own, even if the program never calls `accept()`. `accept()` just takes a
finished connection off the queue and returns a **new** file descriptor for it:

```c
listen(listen_fd, 16);                    // kernel starts completing handshakes
int conn_fd = accept(listen_fd, ...);     // a NEW fd per connection; listen_fd keeps listening
```

That's why Node's `[accept]` log says the handshake is already done. By the time JavaScript hears
about a connection, three segments have already gone back and forth.
(`practice/transmission-control-protocol/sockets-and-queues` shows what happens when a server
stops calling `accept()`.)

**`read()` returns what's available, not "a message."** The C server's loop logs each `read()`
size. A protocol on top of TCP must frame its own messages (newlines, length prefixes,
`Content-Length`). See `practice/fundamentals-of-networking/host-to-host` for a newline-framed
protocol.

```c
while ((n = read(conn_fd, buf, sizeof(buf))) > 0) { ... }  // 0 = peer sent FIN
```

**FIN is half-close.** `socket.end()` sends FIN, which means "I'm done sending" and nothing more.
The other side can keep writing until it sends its own FIN. That's why Node has separate `end`
(peer's FIN arrived) and `close` (both directions done) events.

## The TCP segment header

```text
 0                   16                  32
+-------------------+-------------------+
|    source port    |     dest port     |
+-------------------+-------------------+
|            sequence number            |
+---------------------------------------+
|        acknowledgment number          |
+------+------+-----+-------------------+
| hlen | rsvd |flags|    window size    |
+------+------+-----+-------------------+
|     checksum      |  urgent pointer   |
+-------------------+-------------------+
|          options (MSS, SACK, wscale, timestamps...)
+---------------------------------------+
```

20 bytes minimum, versus UDP's 8. Every extra field pays for a guarantee: seq/ack for
reliability and ordering, window for flow control, and flags for connection state.

## Try this yourself

- Kill the server (`Ctrl+C`) while a client is connected, then capture. You'll see the kernel
  send `FIN` on the process's behalf, because the OS cleans up sockets even when the program
  doesn't.
- Make the client call `socket.resetAndDestroy()` (Node 18+) instead of `end()`. Capture it and
  look for an `R` (RST) instead of a graceful FIN. The server logs `ECONNRESET`.
- Connect to a port where nothing is listening (`node client.js 5999`) and capture it. The
  answer to the SYN is an immediate `RST`, which surfaces as `ECONNREFUSED`.
- Add `socket.setNoDelay(true)` to the client and re-run it a few times. Watch whether the server
  starts seeing more, smaller chunks (see `practice/network-performance/nagle-delayed-ack`).

## Real-world equivalent

Every database driver, Redis client, and HTTP/1.1 and HTTP/2 connection is this echo server's
lifecycle with a real protocol on top. When something "hangs" or "resets" in production, a
capture like `capture.sh` is usually the fastest way to see which side sent the FIN or RST and when.
