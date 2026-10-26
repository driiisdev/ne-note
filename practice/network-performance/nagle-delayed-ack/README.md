# Practice: Nagle's Algorithm + Delayed ACK

Concept notes: [`nagles_algorithms_effect_on_performance.md`](<../../../concepts/network performance/nagles_algorithms_effect_on_performance.md>) ·
[`delayed_acknowledgment_effect_on_performance.md`](<../../../concepts/network performance/delayed_acknowledgment_effect_on_performance.md>)

## What this demonstrates

Two TCP optimizations, each reasonable on its own, that together add a fixed ~40-200 ms stall to
every request:

- **Nagle's algorithm (sender side).** Don't send a small segment while earlier data is still
  unacknowledged. Buffer it until the ACK arrives. This saves the network from floods of tiny
  packets (the original problem was one keystroke per packet in telnet).
- **Delayed ACK (receiver side).** Don't ACK immediately. Wait up to ~40 ms (Linux) or 200 ms
  (Windows) in case there's a reply to piggyback the ACK on. This halves the number of pure-ACK
  packets.

The client sends each request as **two writes** (header, then body) and waits for the reply.
Nagle holds the body until the header is ACKed. The server won't reply until it has the body,
so it has no reply to piggyback an ACK on, and the ACK waits for the delayed-ACK timer. Both
sides end up waiting on each other until that timer fires.

## Folder structure

```text
nagle-delayed-ack/
  server.js   <- node server.js [port]                      length-prefixed request -> "ok"
  client.js   <- node client.js [port] [requests] [host]    runs Nagle ON, then OFF
```

## Run it

**This needs a real network hop.** On loopback the effect usually disappears (Windows
short-circuits loopback TCP, and Linux loopback ACK timing is different). Run the server on a
different machine or VM than the client:

```bash
node server.js                          # machine A (or inside WSL / a VM / a container)
node client.js 5400 20 <machine-A-ip>   # machine B
```

On Windows, WSL works as "another machine." Install Node inside WSL, run the server there, and
point the Windows-side client at the WSL IP from `wsl hostname -I`.

## What you'll see

Measured from Windows to a server inside WSL2 (a real TCP hop over a virtual switch):

```text
20 requests, each sent as header + body in two separate writes

Nagle ON  (default)        avg   47.56 ms   median   49.92 ms   max   50.92 ms   total 951 ms
Nagle OFF (setNoDelay)     avg    0.46 ms   median    0.41 ms   max    1.09 ms   total 9 ms
```

That's **about 100x slower** for the identical protocol, and the ~40-50 ms per request is
exactly Linux's delayed-ACK timer. On loopback you'll see both rows under 1 ms. That's the
loopback caveat, not a sign the effect isn't real.

> 🖼️ **Image suggestion:** a sequence diagram of one stalled request. The header goes out at
> t=0. The body sits in the client's buffer, labelled "Nagle: waiting for ACK." The server's
> ACK sits in its buffer, labelled "delayed ACK: waiting for something to piggyback on." The
> timer fires at t≈40 ms, the ACK goes out, and the body follows immediately.

## Code walkthrough

**The trigger is write-write-read**:

```js
socket.write(header); // sent immediately: nothing is unacknowledged yet
socket.write(body);   // Nagle: small segment + unACKed data in flight -> hold it
await replied;        // ...and the reply can't come until the body arrives
```

**The server is innocent.** Waiting for a complete request before replying is what every server
does:

```js
while (buf.length >= 4 && buf.length >= 4 + buf.readUInt32BE(0)) { ... socket.write("ok\n"); }
```

**The fixes, in order of preference:**

1. **Don't write in pieces.** Build the full message and call `write()` once, for example
   `socket.write(Buffer.concat([header, body]))`. That's one segment, so Nagle never has
   anything to hold back.
2. **Disable Nagle** with `socket.setNoDelay(true)` (`TCP_NODELAY`). Most latency-sensitive
   software does this: Node's `http` module, Redis clients, database drivers, gRPC and SSH
   interactive sessions all set it.
3. **Linux-only knobs**: `TCP_QUICKACK` on the receiver (ACK immediately, for now), or
   `TCP_CORK` on the sender (explicitly batch writes, then flush).

## When Nagle and delayed ACK *are* good

- Bulk transfers (file uploads, streaming) with many small writes: Nagle coalesces them into
  full segments, which means fewer packets and less header overhead.
- Busy request/response traffic: delayed ACKs ride along on the replies for free.

They only hurt in combination, and only with small writes that wait on a reply, which happens
to describe most RPC traffic.

## Try this yourself

- Change the client to send `Buffer.concat([header, body])` in a single write with Nagle **on**.
  The stall disappears, proving the problem was the split write and not Nagle by itself.
- Capture the stalled run: `sudo tcpdump -n -ttt port 5400` (`-ttt` prints the time *between*
  packets). Look for the ~40 ms gaps before each body segment.
- Run the server on Windows and the client inside WSL, the reverse direction. The stall becomes
  Windows' delayed-ACK timer instead, which can be up to 200 ms.
- Check what Node's `http` module does: in Node's source, the HTTP client and server sockets
  call `setNoDelay(true)` by default.

## Real-world equivalent

This exact combination has caused famous latency mysteries: "every request takes exactly 40 ms
(or 200 ms) longer than it should" in database drivers, Redis pipelines, HTTP clients that send
headers and body separately, and Git over SSH. A suspiciously *constant* extra latency, matching
a delayed-ACK timer, is the signature.
