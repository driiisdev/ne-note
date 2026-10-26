# TCP Pros and Cons

TCP's trade-off: the kernel gives you **correctness for free** - every byte, in order, exactly once,
at a rate the receiver and network can handle - and you pay for it in **latency, state, and loss of
control**.

## Pros

- **Reliable delivery** - retransmission until acknowledged (or the connection fails loudly).
- **Ordered, de-duplicated stream** - the app reads bytes exactly as they were written.
- **Flow control** - a slow receiver automatically slows the sender (backpressure).
- **Congestion control** - shares the network fairly and avoids congestion collapse.
- **Connection semantics** - you know when the peer is there, when it closed, and when something
  went wrong (RST, timeouts).
- **Universally supported** - every OS, language, firewall and load balancer handles it well.

## Cons

- **Handshake latency** - 1 RTT before data (plus 1-2 for TLS on top). Painful for short exchanges
  and long-distance links.
- **Head-of-line blocking** - one lost segment stalls everything behind it in the stream, even
  unrelated data multiplexed on the same connection (HTTP/2's weakness).
- **Kernel state per connection** - buffers, timers, queue entries; multiplied by every NAT,
  firewall and load balancer on the path. Limits how many connections a server can hold and leaves
  `TIME_WAIT`/`CLOSE_WAIT` residue.
- **Slow start** - new connections take several RTTs to reach full speed.
- **Byte stream, not messages** - apps must frame their own messages.
- **Ossified and in the kernel** - changing TCP behaviour means OS upgrades, and middleboxes break
  new options, so innovation moved to QUIC over UDP.
- **Unicast only** - no broadcast or multicast.

## Pros and cons compared with UDP

| | TCP | UDP |
| --- | --- | --- |
| Setup cost | 1 RTT handshake | none |
| Reliability / order | built in | app's job |
| Head-of-line blocking | yes | no |
| Per-connection state | yes (kernel + middleboxes) | none |
| Rate control | flow + congestion control | none (app's job) |
| Typical uses | web, APIs, DBs, SSH, file transfer | DNS, media, games, QUIC |

🖼️ **tcp vs udp comparison graphic: guarantees on one side, costs on the other**
![tcp pros and cons](<../../assets/img/tcp-pros-cons.png>)

## Practice project

[`practice/transmission-control-protocol/sockets-and-queues`](../../practice/transmission-control-protocol/sockets-and-queues) -
shows the state TCP leaves in the kernel; compare with
[`practice/user-datagram-protocol/udp-echo`](../../practice/user-datagram-protocol/udp-echo).

## Related

- [UDP pros and cons](<../user datagram protocol/udp_pros_n_cos.md>).
- [TCP head-of-line blocking](<../network performance/tcp_head_of_line_blocking.md>).
- [Cost of connection establishment](<../network performance/cost_of_connection_establishment.md>).
- [Replacing TCP for data centers](<../miscellaneous/replacing_tcp_for_data_centers.md>).
