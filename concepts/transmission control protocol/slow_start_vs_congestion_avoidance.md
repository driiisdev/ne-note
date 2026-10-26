# Slow Start vs Congestion Avoidance

The two phases of TCP's congestion window growth. Both are about the same question - *how much
more can I send?* - but they answer it at different speeds, depending on whether the sender is
far below or near the last known safe limit (**ssthresh**).

## Slow start: find the limit quickly

- Used when `cwnd < ssthresh` - at the start of a connection, and after a timeout.
- cwnd grows by **1 MSS for every ACK** received. Since a full window's worth of ACKs comes back
  each RTT, cwnd **doubles every round trip**: 1 → 2 → 4 → 8 → 16 ...
- The name is historical: it's "slow" only compared with blasting a full window immediately. It's
  actually exponential.
- Initial window (IW): RFC 6928 raised it to **10 MSS** (~14 KB) - which is why keeping critical
  web responses under ~14 KB lets them arrive in the first round trip.

## Congestion avoidance: probe carefully

- Used when `cwnd ≥ ssthresh`.
- cwnd grows by about **1 MSS per RTT** (each ACK adds `MSS × MSS / cwnd`) - linear.
- The sender is near the capacity where loss happened last time, so it inches up instead of
  doubling into another loss.

## How ssthresh moves

- Starts very high (effectively unlimited), so the first slow start runs until the first loss.
- On loss: `ssthresh = cwnd / 2`.
  - After **3 duplicate ACKs**: cwnd drops to ssthresh → continue in congestion avoidance.
  - After a **timeout**: cwnd drops to 1 (or IW) → slow start again, up to the new ssthresh.

## Example (ssthresh = 32)

```text
RTT:   1  2  3  4   5   6   7   8 ...  14 | loss (dup ACKs) | 15  16
cwnd:  1  2  4  8  16  32  33  34 ...  40 |  ssthresh = 20  | 20  21
       <-- slow start --><-- congestion avoidance -->
```

## Practical consequences

- **Short connections live entirely in slow start** - a 50 KB response needs several RTTs no
  matter how fast the link is. Reusing warm connections (keep-alive, HTTP/2) avoids repeating it.
- Linux can reset cwnd after idle (`tcp_slow_start_after_idle`), so long-idle keep-alive
  connections restart slowly too.

🖼️ **cwnd per rtt chart with the slow start curve and the linear congestion avoidance line, ssthresh drawn across**
![slow start vs congestion avoidance](<../../assets/img/slow-start-vs-congestion-avoidance.png>)

## Practice project

[`practice/transmission-control-protocol/flow-and-congestion`](../../practice/transmission-control-protocol/flow-and-congestion) -
`node cwnd-sim.js --ssthresh=8` vs the default shows how the threshold shapes growth.

## Related

- [Congestion control](<congestion_control.md>) - the full picture.
- [Cost of connection establishment](<../network performance/cost_of_connection_establishment.md>).
- [TCP fast open](<../network performance/tcp_fast_open.md>) - shaves the handshake, not slow start.
