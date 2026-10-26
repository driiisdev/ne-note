# Delayed Acknowledgment and Its Effect on Performance

A receiver-side TCP optimization (RFC 1122): don't ACK every segment immediately - wait a little
in case the ACK can **ride along** on outgoing data, or in case a second segment arrives so one
ACK can cover both. It roughly halves pure-ACK traffic, but adds latency in specific patterns.

## The rules

- ACK at least **every second full-size segment** (so bulk transfers keep flowing).
- Otherwise wait up to a timer: about **40 ms** minimum on Linux (adaptive, up to 200 ms), **200 ms**
  on Windows by default, up to 500 ms allowed by the RFC.
- If the application sends data back before the timer fires, the ACK is **piggybacked** on it for
  free.
- Out-of-order segments are ACKed immediately (to trigger fast retransmit).

## Why it usually helps

Request/response traffic: the server receives a request and replies within milliseconds - the ACK
rides on the response, saving a packet. Bulk transfer: one ACK per two segments halves reverse
traffic.

## When it hurts

When the receiver **won't send anything until it gets more data**, and the sender **won't send
more until it gets an ACK**:

- **Nagle + delayed ACK** (the classic): sender holds a small segment waiting for an ACK; receiver
  holds the ACK waiting for something to piggyback on; both wait for the timer.
- **Small final segments / end of a transfer**: the last odd segment can wait for the timer.
- **Congestion window growth** during slow start is ACK-clocked; fewer ACKs slows growth slightly.

The signature is a suspiciously **constant** extra latency equal to the delayed-ACK timer.

## Fixes

- Fix the sender (one write per message, or `TCP_NODELAY`) - the usual answer.
- **`TCP_QUICKACK`** (Linux) on the receiver: ACK immediately for now (it's not sticky; the kernel
  can return to delayed mode, so apps reset it after reads).
- Windows: `TcpAckFrequency` registry setting (system-wide, a blunt instrument).

🖼️ **two timelines: ack piggybacked on a quick response (good) vs ack waiting for the 40ms timer (stall)**
![delayed ack](<../../assets/img/tcp-ack-timing.png>)

## Practice project

[`practice/network-performance/nagle-delayed-ack`](../../practice/network-performance/nagle-delayed-ack) -
the measured ~48 ms per request is Linux's delayed-ACK timer firing on every single request.

## Related

- [Nagle's algorithm's effect on performance](<nagles_algorithms_effect_on_performance.md>).
- [Capturing TCP segments with tcpdump](<../transmission control protocol/capturing_tcp_segment_with_tcpdump.md>) -
  `-ttt` makes the gaps visible.
- [Congestion control](<../transmission control protocol/congestion_control.md>) - ACK clocking.
