# Practice: TCP Head-of-Line Blocking

Concept notes: [`tcp_head_of_line_blocking.md`](<../../../concepts/network performance/tcp_head_of_line_blocking.md>)

## What this demonstrates

HTTP/2 sends many requests over **one** TCP connection, interleaving their frames. That fixed
HTTP/1.1's head-of-line blocking at the application layer, but it moved the problem down a
layer. TCP only knows about **one ordered byte stream**, so when a single packet is lost, every
byte after it is held back from the application until the retransmission arrives, even bytes
that belong to completely unrelated requests.

`hol-sim.js` replays the same loss twice and prints when each packet reaches the application:

- **TCP-like**: one ordering for the whole connection (HTTP/2 over TCP)
- **QUIC-like**: ordering per stream (HTTP/3 over QUIC)

This is a deterministic simulation, because real packet loss can't be produced reliably on
localhost, and because the point is the *delivery rule*, which is easier to see without noise.

## Folder structure

```text
hol-blocking-sim/
  hol-sim.js   <- node hol-sim.js [--lose=B1] [--delay=50] [--rto=200] [--gap=10]
```

## Run it

```bash
node hol-sim.js                    # B1 lost: the worst case, early in the connection
node hol-sim.js --lose=C3          # lose the LAST packet instead: nobody is behind it
node hol-sim.js --rto=600          # slower recovery = longer stall for everyone
```

## What you'll see

```text
one-way delay 50ms, packet B1 lost and retransmitted at +200ms

packet  sent  arrives   delivered to app (TCP)   delivered to app (QUIC)
A1         0       50         50                          50
B1        10      260*       260                         260
C1        20       70        260  <- blocked 190ms        70
A2        30       80        260  <- blocked 180ms        80
B2        40       90        260  <- blocked 170ms       260  <- blocked 170ms
C2        50      100        260  <- blocked 160ms       100
...

stream finished at:      TCP-like   QUIC-like
  stream A                260ms       110ms   (innocent bystander, delayed anyway)
  stream B                260ms       260ms   (the stream that actually lost a packet)
  stream C                260ms       130ms   (innocent bystander, delayed anyway)
```

Under TCP, streams A and C **had all their data at the receiver** by 110 ms and 130 ms. The
kernel simply wasn't allowed to hand it over. Under QUIC, only stream B waits for its own lost
packet.

> 🖼️ **Image suggestion:** two horizontal "pipes." In the top pipe (TCP), packets of three
> colors queue behind one missing red packet. In the bottom pipe (QUIC), three separate lanes
> are drawn and only the red lane is stuck.

## Code walkthrough

**The delivery rule is the entire difference.** In TCP, a packet becomes deliverable only once
*everything sent before it* has arrived:

```js
for (const p of packets) {           // global send order
  tcpReady = Math.max(tcpReady, p.arrivesAt);
  p.tcpDelivered = tcpReady;
}
```

In QUIC, the same rule applies, but **per stream**:

```js
streamReady[p.stream] = Math.max(streamReady[p.stream] || 0, p.arrivesAt);
p.quicDelivered = streamReady[p.stream];
```

That's the design choice behind HTTP/3. QUIC runs over UDP, so the kernel doesn't impose a
single order on the data, and QUIC tracks ordering itself, per stream.

## The three kinds of head-of-line blocking

| Where | Cause | Fixed by |
| --- | --- | --- |
| HTTP/1.1, app layer | one request at a time per connection; a slow response blocks the next | HTTP/2 multiplexing (or 6 parallel connections) |
| HTTP/2, transport layer | one lost TCP segment blocks all multiplexed streams | HTTP/3 / QUIC per-stream ordering |
| Anything on one TCP connection | Redis pipelines, DB multiplexing, WebSocket messages | multiple connections, or a different transport |

Under real loss rates (1-2% on mobile networks), HTTP/2 over a single connection can perform
*worse* than HTTP/1.1 with 6 connections, because one loss stalls everything instead of a sixth
of everything.

## Try this yourself

- `node hol-sim.js --lose=C3`: losing the *last* packet blocks nobody else, which shows that HOL
  blocking costs most when loss happens early.
- Add more streams (`["A", "B", "C", "D", "E"]`) and watch the number of innocent bystanders grow.
- Model **6 parallel TCP connections** (HTTP/1.1 style): give each stream its own `tcpReady`.
  You'll find it behaves exactly like the QUIC column, which is why browsers historically opened
  6 connections per host.
- Watch for real HOL blocking: load a page over HTTP/2 while simulating loss
  (`sudo tc qdisc add dev eth0 root netem loss 2%` on Linux), and compare it with the same page
  over HTTP/3 in Chrome's DevTools Network tab (Protocol column: `h2` vs `h3`).

## Real-world equivalent

This is the core motivation for QUIC and HTTP/3, now used by Google, Cloudflare, Meta and most
CDNs. The benefit shows up mostly on lossy networks: mobile, Wi-Fi, and long distances. On a
clean wired network, HTTP/2 over TCP and HTTP/3 perform about the same.
