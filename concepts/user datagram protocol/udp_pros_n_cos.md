# UDP Pros and Cons

UDP's trade-off in one line: it gives you **speed, simplicity and control**, and takes away
**every delivery guarantee**. Whether that's a good deal depends entirely on what the application
does with a late or missing packet.

## Pros

- **No handshake** - data flows from the first packet. A one-question/one-answer exchange (DNS)
  costs one round trip instead of two-plus.
- **Small header** - 8 bytes vs TCP's 20-60.
- **Stateless server** - no per-client connection state, so one socket can serve huge numbers of
  clients cheaply.
- **Message boundaries preserved** - one send = one receive, no framing code.
- **No head-of-line blocking** - a lost datagram doesn't hold up the ones behind it.
- **Broadcast and multicast** - one packet to many receivers (TCP is strictly one-to-one).
- **Full control** - the app decides what to retransmit, in what order, and how fast to send;
  QUIC uses this to build a better transport in user space.

## Cons

- **No delivery guarantee** - lost datagrams vanish silently; `send()` succeeding means nothing.
- **No ordering** - datagrams can arrive out of order or duplicated.
- **No flow control** - a fast sender can overflow the receiver's socket buffer (drops).
- **No congestion control** - a careless UDP app can flood a network and hurt everyone else on it.
- **Firewalls and NAT** are less friendly: there's no connection setup to track, so NAT mappings
  time out quickly (often ~30 seconds) and need keepalives.
- **Easy to spoof** - with no handshake, the source address isn't verified, which enables
  **amplification attacks** (small spoofed request, big response sent to the victim, e.g. DNS/NTP
  reflection).

## When to choose UDP

| Choose UDP when... | Choose TCP when... |
| --- | --- |
| a late packet is worthless (live audio/video, games) | every byte must arrive (files, APIs, DB queries) |
| exchanges fit in one packet (DNS, NTP) | messages are large or a long stream |
| you need multicast/broadcast | you want the OS to handle reliability for you |
| you're building your own transport (QUIC) | you want to go through every firewall without thinking |

🖼️ **udp vs tcp trade-off chart (latency, reliability, overhead, state)**
![udp pros and cons](<../../assets/img/udp-pros-cons.png>)

## Practice project

[`practice/user-datagram-protocol/udp-echo`](../../practice/user-datagram-protocol/udp-echo) -
run the client directly (everything arrives on loopback), then through `lossy-relay.js` (20% loss,
jitter) and see every "con" happen.

## Related

- [UDP](<udp.md>).
- [TCP pros and cons](<../transmission control protocol/tcp_pros_n_cons.md>) - the mirror image.
- [TCP head-of-line blocking](<../network performance/tcp_head_of_line_blocking.md>) - the TCP con
  UDP-based QUIC was built to avoid.
