# TCP Segment

The unit TCP sends: a header of **20 bytes minimum (up to 60 with options)** followed by a chunk of
the byte stream, carried inside an IP packet (protocol number 6). Every TCP feature - reliability,
ordering, flow control, connection state - is driven by a field in this header.

## The header

```text
 0                   16                  32
+-------------------+-------------------+
|    Source Port    |  Destination Port |
+-------------------+-------------------+
|            Sequence Number            |
+---------------------------------------+
|         Acknowledgment Number         |
+------+------+---------+---------------+
| Data | Rsvd |  Flags  |  Window Size  |
| Off. |      |         |               |
+------+------+---------+---------------+
|     Checksum      |  Urgent Pointer   |
+-------------------+-------------------+
|        Options (0-40 bytes)           |
+---------------------------------------+
```

| Field | Purpose |
| --- | --- |
| **Ports** | identify the two processes; with the IPs they form the connection's 4-tuple |
| **Sequence number** | position of this segment's first byte in the stream (starts at a random ISN) |
| **Acknowledgment number** | next byte the sender expects to receive - "I have everything before this" |
| **Data offset** | header length in 32-bit words (5 = 20 bytes) |
| **Flags** | `SYN` open, `ACK` ack field valid, `FIN` done sending, `RST` abort, `PSH` deliver now, `URG`; plus `ECE`/`CWR` for ECN |
| **Window** | how many bytes the receiver can accept right now (flow control); scaled by the window-scale option |
| **Checksum** | over a pseudo-header (IPs, protocol, length) + header + data |

## Important options

- **MSS** (Maximum Segment Size): announced in the SYN - the largest payload this side can receive
  (1460 on Ethernet).
- **Window scale**: multiplies the 16-bit window (max 65,535) so windows can reach ~1 GB - needed
  for high bandwidth × latency paths.
- **SACK permitted / SACK blocks**: report exactly which out-of-order ranges arrived.
- **Timestamps**: RTT measurement and protection against wrapped sequence numbers (PAWS).

## Sequence numbers in action

A SYN and a FIN each consume **one** sequence number even though they carry no data - that's why
the SYN-ACK acknowledges `ISN + 1`. A segment carrying 100 bytes at `seq 1000` is acknowledged with
`ack 1100`.

🖼️ **tcp header grid with a real syn segment's values (flags, mss option, window) filled in**
![tcp segment](<../../assets/img/tcp-segment-header.png>)

## Practice project

[`practice/transmission-control-protocol/tcp-echo`](../../practice/transmission-control-protocol/tcp-echo) -
`capture.sh` (`-S` for absolute sequence numbers) and `capture.sh hex` to find every field in real segments.

## Related

- [TCP](<tcp.md>) - what the fields achieve together.
- [User datagram structure](<../user datagram protocol/user_datagram_structure.md>) - the 8-byte contrast.
- [MSS, MTU, PMTUD](<../network performance/mss_mtu_pmtud.md>) - where MSS comes from.
- [Capturing TCP segments with tcpdump](<capturing_tcp_segment_with_tcpdump.md>).
