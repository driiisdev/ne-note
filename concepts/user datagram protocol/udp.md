# UDP (User Datagram Protocol)

The minimal layer 4 protocol: it adds **ports** (so a packet reaches the right process) and a
**checksum** to IP, and nothing else. No connection, no handshake, no acknowledgments, no
retransmission, no ordering, no flow or congestion control. Each `send` becomes one independent
**datagram** that arrives once, or not at all.

## What "connectionless" means in practice

- The first packet already carries data - there's no round trip spent setting anything up.
- The server keeps no per-client state: one socket receives datagrams from everyone, each tagged
  with its sender's address.
- `send()` succeeds as long as the datagram left your machine. Whether anyone received it, the
  sender never learns (unless the application builds that in).
- **Message boundaries are preserved**: one `send` of 100 bytes is one `recv` of 100 bytes - unlike
  TCP's byte stream.

## Why use something that unreliable

Because some applications are better served by building exactly the reliability they need, or
none at all:

- **Real-time media** (voice, video calls, games): a packet that arrives late is useless; resending
  it would only add delay. Better to skip it and keep going.
- **Request/response that fits in one packet** (DNS, NTP, DHCP): a lost query is just retried by the
  app after a timeout - cheaper than a TCP handshake for a single exchange.
- **Broadcast/multicast** (DHCP discovery, service discovery): TCP can't do one-to-many at all.
- **New transports built in user space**: QUIC (HTTP/3) runs over UDP so it can implement its own
  reliability, per-stream ordering and congestion control without waiting for OS kernels to change.

## What the application must handle itself

Loss, duplication, reordering, pacing (don't flood the network), and message size (stay under the
path MTU, ~1472 bytes of payload on Ethernet, to avoid IP fragmentation).

🖼️ **udp: independent datagrams, some lost and some reordered, with no acks flowing back**
![udp](<../../assets/img/udp.png>)

## Practice project

[`practice/user-datagram-protocol/udp-echo`](../../practice/user-datagram-protocol/udp-echo) -
an echo server in Node and C, a client that numbers its datagrams, and a lossy relay that drops
and reorders them so the missing guarantees become visible.

## Related

- [User datagram structure](<user_datagram_structure.md>) - the 8-byte header.
- [UDP pros and cons](<udp_pros_n_cos.md>).
- [TCP](<../transmission control protocol/tcp.md>) - the reliable alternative.
- [DNS](<../overview of popular networking protocols/dns.md>) - the most common UDP protocol.
