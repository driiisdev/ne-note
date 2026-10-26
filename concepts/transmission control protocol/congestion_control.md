# Congestion Control

TCP's mechanism for protecting the **network**. Routers have finite queues; if every sender
transmitted as fast as its receiver allowed, queues would overflow, packets would be dropped and
retransmitted, and throughput would collapse for everyone (this actually happened on the early
internet in 1986 - "congestion collapse"). So each sender limits itself with a **congestion window
(cwnd)** - its own estimate of what the path can handle.

## The core idea: probe, then back off

- cwnd is kept **by the sender only** - it never appears in a packet.
- Bytes in flight ≤ `min(cwnd, rwnd)`.
- **Increase** cwnd while things go well (ACKs arrive) to discover available bandwidth.
- **Decrease** cwnd when there's a congestion signal - loss, rising delay, or an ECN mark.

## Classic algorithm (Reno)

1. **Slow start**: start small (historically 1 MSS, 10 MSS on modern Linux), add 1 MSS per ACK →
   cwnd **doubles every RTT**.
2. At the **slow-start threshold (ssthresh)**, switch to **congestion avoidance**: +1 MSS per RTT
   (linear - "additive increase").
3. **3 duplicate ACKs** (one segment lost, later ones arriving): fast retransmit, then
   `ssthresh = cwnd / 2; cwnd = ssthresh` ("multiplicative decrease", fast recovery).
4. **Retransmission timeout** (nothing getting through): `ssthresh = cwnd / 2; cwnd = 1 MSS`, back
   to slow start.

This **AIMD** (additive increase, multiplicative decrease) pattern produces the classic sawtooth,
and makes competing flows converge toward a fair share.

## Modern algorithms

- **CUBIC** (Linux/Windows default): cwnd grows along a cubic curve based on time since the last
  loss - faster recovery on high-bandwidth, long-RTT paths.
- **BBR** (Google): models bottleneck bandwidth and minimum RTT instead of reacting to loss - keeps
  queues short and performs much better on lossy links.
- **ECN**: routers mark packets instead of dropping them, signalling congestion without loss.

## Why it matters

New connections start slow (short transfers never reach full speed), loss on a path drastically
cuts throughput, and bufferbloat (oversized router queues) adds latency for loss-based algorithms.

🖼️ **cwnd over time: slow start curve, linear climb, halving on dup acks, drop to 1 on timeout**
![congestion control](<../../assets/img/congestion-control-sawtooth.png>)

## Practice project

[`practice/transmission-control-protocol/flow-and-congestion`](../../practice/transmission-control-protocol/flow-and-congestion) -
`cwnd-sim.js` steps through Reno RTT by RTT, including a dup-ACK event and a timeout.

## Related

- [Slow start vs congestion avoidance](<slow_start_vs_congestion_avoidance.md>) - the two phases in depth.
- [Flow control](<flow_control.md>) - the receiver-side window.
- [Cost of connection establishment](<../network performance/cost_of_connection_establishment.md>) -
  slow start is part of why new connections are expensive.
