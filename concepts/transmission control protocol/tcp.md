# TCP (Transmission Control Protocol)

The layer 4 protocol that turns IP's best-effort packet delivery into a **reliable, ordered,
full-duplex byte stream** between two processes. Most of the internet's traffic - HTTP/1.1 and 2,
TLS, SSH, database protocols, email - runs on it.

## Connection setup: the 3-way handshake

```text
client -> server : SYN            seq = x            "I want to talk; my numbers start at x"
server -> client : SYN-ACK        seq = y, ack = x+1 "OK; mine start at y; I got your SYN"
client -> server : ACK            ack = y+1          "got yours"
```

Both sides pick a random **initial sequence number (ISN)** and agree on options (MSS, window
scaling, SACK, timestamps). Cost: **one full round trip before any data**.

## How it delivers reliably and in order

- Every byte has a **sequence number**; the receiver sends cumulative **ACKs** ("I have everything
  up to byte N").
- Unacknowledged data is **retransmitted** after a timeout (RTO, adapted from measured RTT), or
  sooner after **3 duplicate ACKs** (fast retransmit). **SACK** tells the sender exactly which
  ranges arrived.
- The receiver **reorders** segments and hands the app a contiguous stream; duplicates are dropped.
- A **checksum** on every segment catches corruption.

## Controlling the rate

- **Flow control**: the receiver advertises a **window** (free buffer space) in every ACK, so a
  fast sender can't overrun a slow receiver.
- **Congestion control**: the sender limits itself with a **congestion window** that grows (slow
  start, then congestion avoidance) and shrinks on loss, so it doesn't overrun the *network*.

## Closing

Each direction closes independently: `FIN` → `ACK` from one side, then `FIN` → `ACK` from the other
(often combined). The side that closes first waits in **TIME_WAIT** for 2×MSL before the 4-tuple
can be reused. `RST` aborts a connection immediately.

## It's a byte stream, not messages

TCP preserves bytes and their order, **not write boundaries**. Five `write()`s can arrive as one
`read()`, or one as two. Every protocol on TCP must frame its own messages (newlines,
`Content-Length`, length prefixes).

## The costs

Handshake latency, per-connection state in the kernel (and in every NAT/firewall), head-of-line
blocking when a segment is lost, and slow start making new connections slow to reach full speed.

🖼️ **tcp lifecycle: 3-way handshake, data with seq/ack, 4-way close**
![tcp](<../../assets/img/tcp-handshake.png>)

## Practice project

[`practice/transmission-control-protocol/tcp-echo`](../../practice/transmission-control-protocol/tcp-echo) -
echo server in Node and C; 5 writes from the client arrive in fewer chunks, and `capture.sh`
shows the whole lifecycle on the wire.

## Related

- [TCP segment](<tcp_segment.md>) - the header fields behind all of this.
- [TCP connection states](<tcp_connection_states.md>).
- [Flow control](<flow_control.md>) and [congestion control](<congestion_control.md>).
- [UDP](<../user datagram protocol/udp.md>) - the protocol that skips all of it.
