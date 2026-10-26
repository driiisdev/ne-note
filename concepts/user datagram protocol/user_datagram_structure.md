# User Datagram Structure

A UDP datagram is an **8-byte header** plus data, carried as the payload of an IP packet
(protocol number 17). Four fields, each 16 bits. Its smallness is the point: everything TCP adds
(sequence numbers, ACKs, windows, flags) is simply absent.

## The header

```text
 0               16              32
+---------------+---------------+
|  Source Port  |   Dest Port   |
+---------------+---------------+
|    Length     |   Checksum    |
+---------------+---------------+
|          Data ...             |
+-------------------------------+
```

| Field | Meaning |
| --- | --- |
| **Source port** | the sender's port, so replies can come back. Optional in theory (0 = none), always set in practice |
| **Destination port** | which process on the receiver gets it (53 = DNS, 123 = NTP, 443 = QUIC) |
| **Length** | header + data, in bytes. Minimum 8 |
| **Checksum** | over a **pseudo-header** (src/dst IP, protocol, length) + UDP header + data. Optional in IPv4 (0 = not computed), mandatory in IPv6 |

The pseudo-header means the checksum also catches packets delivered to the wrong IP address, even
though those IPs aren't in the UDP header itself.

## Sizes and limits

- Maximum length field: 65,535 bytes → max data **65,507** bytes over IPv4 (65,535 − 20 IP − 8 UDP).
- Practical limit: anything above the path MTU minus headers (**1,472 bytes** of data on a
  1500-byte Ethernet path) gets fragmented at the IP layer. One lost fragment loses the whole
  datagram, so protocols keep datagrams small (DNS historically ≤ 512 bytes, QUIC ≈ 1,200-1,350).

## On the wire

Where to find it in a hex dump: the IP header (usually 20 bytes) first, then the UDP header. A
datagram to port 5001 starts its UDP header with `xxxx 1389` - `0x1389` is 5001.

🖼️ **udp header next to the tcp header at the same scale (8 bytes vs 20+)**
![udp header](<../../assets/img/udp-header.png>)

## Practice project

[`practice/user-datagram-protocol/udp-echo`](../../practice/user-datagram-protocol/udp-echo) -
`capture.sh hex` shows the raw bytes so you can find each header field yourself.

## Related

- [UDP](<udp.md>) - the protocol's behaviour.
- [IP packet](<../internet protocol/ip_packet.md>) - the header around it.
- [TCP segment](<../transmission control protocol/tcp_segment.md>) - the much larger alternative header.
