# Practice: UDP Echo

Concept notes: [`udp.md`](<../../../concepts/user datagram protocol/udp.md>) ·
[`user_datagram_structure.md`](<../../../concepts/user datagram protocol/user_datagram_structure.md>) ·
[`udp_pros_n_cos.md`](<../../../concepts/user datagram protocol/udp_pros_n_cos.md>) ·
[`udp_server_with_javascript_using_nodejs.md`](<../../../concepts/user datagram protocol/udp_server_with_javascript_using_nodejs.md>) ·
[`udp_server_with_c.md`](<../../../concepts/user datagram protocol/udp_server_with_c.md>) ·
[`capturing_udp_traffic_with_tcpdump.md`](<../../../concepts/user datagram protocol/capturing_udp_traffic_with_tcpdump.md>)

## What this demonstrates

The whole UDP module in one project:

- **The same echo server twice**, in Node (`dgram`) and in C (raw POSIX sockets). Either one
  works with the same client, and the C version shows every syscall that Node hides.
- **What "no guarantees" means in practice.** The client numbers every datagram and checks what
  came back. Direct over loopback, everything arrives. Through `lossy-relay.js` (a simulated bad
  network), datagrams go missing and arrive out of order, and nothing tells the sender.
- **The datagram on the wire**, via `tcpdump`, so you can find the 8-byte UDP header yourself.

## Folder structure

```text
udp-echo/
  server.js        <- node server.js [port]           (default :5001)
  server.c         <- gcc server.c -o udp-server && ./udp-server [port]
  client.js        <- node client.js [port] [count]   sends numbered datagrams, reports loss/order
  lossy-relay.js   <- node lossy-relay.js 5002 5001 20 80   (20% loss, 0-80ms jitter)
  capture.sh       <- tcpdump recipes: (default) | hex | dns | pcap
```

## Run it

```bash
# 1. clean path
node server.js                 # terminal 1  (or: gcc server.c -o udp-server && ./udp-server)
node client.js 5001 10         # terminal 2

# 2. through a lossy network
node lossy-relay.js 5002 5001 20 80     # terminal 3
node client.js 5002 20                  # terminal 2
```

The C server builds on Linux, macOS, or WSL. On Windows, run it inside WSL, and run the client
inside WSL too. WSL2's default `localhost` forwarding only covers TCP, so a Windows-side UDP
client may not reach it.

## What you'll see

```text
--- direct ---
arrival order : 1 2 3 4 5 6 7 8 9 10
received      : 10/10
lost          : none

--- via relay ---
arrival order : 8 20 4 13 11 1 10 18 14 3 5 19
received      : 12/20
lost          : 2 6 7 9 12 15 16 17
out of order  : 5
```

The exact numbers change every run, because the relay rolls dice per datagram. The loss is
counted in both directions (request and echo), so 20% loss each way loses roughly 36% of round
trips.

## Code walkthrough

**No connection, so no per-client socket.** A TCP server gets a new socket per client from
`accept()`. A UDP server has one socket, and every datagram arrives with its sender's address
attached:

```js
server.on("message", (msg, rinfo) => {
  server.send(msg, rinfo.port, rinfo.address); // reply to whoever sent this one
});
```

The C version makes this explicit. `recvfrom()` fills in the sender, and `sendto()` names the
destination on every single call:

```c
ssize_t n = recvfrom(fd, buf, BUF_SIZE, 0, (struct sockaddr *)&client, &len);
sendto(fd, buf, n, 0, (struct sockaddr *)&client, len);
```

**Message boundaries are preserved.** Each `recvfrom()` returns exactly one datagram, never half
of one and never two glued together. Compare that with the TCP echo project, where the server
has to frame messages itself. This is one of UDP's real *advantages*.

**Sequence numbers are the app's job.** The `seq:N` payload is the client's own reliability
layer: the only way it can detect loss and reordering. Protocols built on UDP (QUIC, RTP for
video, game netcode) all carry their own sequence numbers for exactly this reason.

## The UDP header: 8 bytes, 4 fields

```text
 0               16              32
+---------------+---------------+
|  source port  |  dest port    |
+---------------+---------------+
|    length     |   checksum    |
+---------------+---------------+
|            data ...           |
```

That's all of it: no sequence numbers, no ACKs, no window. `bash capture.sh hex` shows the raw
bytes. After the 20-byte IP header you'll see `1389` (port 5001 in hex), then the length, then
the checksum, then `seq:1` in ASCII.

> 🖼️ **Image suggestion:** the UDP header next to the TCP header at the same scale. The size
> difference (8 bytes vs. 20+ bytes) is the visual summary of the whole UDP vs. TCP trade-off.

## Pros and cons, as seen in this project

| | Observed here |
| --- | --- |
| ✅ No handshake | the first datagram carries data immediately, no round trip first |
| ✅ Message boundaries | one `send` = one `message` event, no framing code needed |
| ✅ Tiny header, no per-client state | the server holds zero state between datagrams |
| ❌ No delivery guarantee | relay drops vanish silently, and `send()` still "succeeds" |
| ❌ No ordering | jitter reorders arrivals, and the app must sort them out |
| ❌ No congestion control | nothing slows the client down; it can flood a network |

## Try this yourself

- Stop the server and run the client directly against `:5001`. Every `send()` still succeeds,
  and you just get `received: 0/10`. (On some OSes, an ICMP "port unreachable" comes back and
  surfaces as an error on the *next* operation. Capture it with `sudo tcpdump -i lo icmp`.)
- Send a payload larger than your MTU (around 1472 bytes of data on Ethernet) and capture it.
  The IP layer fragments it, and if *any* fragment is lost, the whole datagram is lost.
- Run `bash capture.sh dns` and then `nslookup example.com` (or `dig example.com`). DNS is the
  most common UDP protocol you'll see on a real network.
- Add retransmission to `client.js`: resend any seq that isn't echoed within 200ms. You've just
  started reinventing TCP, which is a good way to appreciate what it does for you.

## Real-world equivalent

DNS, DHCP, NTP, VoIP and video calls (RTP), online games, and QUIC (HTTP/3) all run on UDP.
They're all cases where a late packet is worth less than a lost one, or where the protocol wants
to build its own reliability on top instead of inheriting TCP's.
