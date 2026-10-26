# Nagle's Algorithm and Its Effect on Performance

A sender-side TCP optimization (RFC 896, 1984) that reduces the number of tiny packets on the
network - and, in combination with delayed ACKs, one of the most common causes of mysterious
fixed 40 ms / 200 ms latency.

## The problem it solves

Interactive apps like telnet sent one keystroke per packet: 1 byte of data in a 41-byte packet
(20 IP + 20 TCP). Many such "tinygrams" can congest a network.

## The rule

> If there is **unacknowledged data in flight**, buffer new **small** writes (less than one MSS)
> until either the outstanding data is ACKed, or enough has accumulated to fill a full segment.

So the first small write goes out immediately; the following small writes are coalesced and sent
when the ACK comes back. Full-size segments are never delayed.

## When it hurts

Nagle trades latency for efficiency. It hurts when an app does **write-write-read**:

1. Client writes a request header (small) → sent immediately.
2. Client writes the body (small) → **held**, because the header isn't ACKed yet.
3. The server won't respond until it has the body, so it has nothing to piggyback an ACK on;
   its **delayed ACK** timer holds the ACK for up to 40 ms (Linux) / 200 ms (Windows).
4. Only when that timer fires does the ACK arrive, releasing the body.

Result: every request pays a fixed extra delay - while CPU and network sit idle.

## Fixes

1. **Write the whole message at once** (one `write()` / `writev()`). Best fix - nothing to hold back.
2. **Disable Nagle**: `TCP_NODELAY` (`socket.setNoDelay(true)` in Node). Standard for
   latency-sensitive protocols: HTTP clients/servers, Redis, databases, gRPC, game servers. Node's
   `http` module sets it by default.
3. **`TCP_CORK`** (Linux): explicitly batch, then flush - full control for bulk senders.

Nagle is still beneficial for apps that do many small writes with no request/response pattern
(e.g. streaming logs) - it reduces packet count for free.

🖼️ **write-write-read timeline: first write sent, second held by nagle, ack held by delayed ack, stall until timer**
![nagle and delayed ack](<../../assets/img/nagle-delayed-ack.png>)

## Practice project

[`practice/network-performance/nagle-delayed-ack`](../../practice/network-performance/nagle-delayed-ack) -
header + body as two writes: ~47.6 ms per request with Nagle on vs ~0.46 ms with `setNoDelay`,
measured across a real hop (Windows → WSL).

## Related

- [Delayed acknowledgment's effect on performance](<delayed_acknowledgment_effect_on_performance.md>) - the other half.
- [Should layer 4 proxies buffer segments](<../miscellaneous/should_layer_4_proxies_buffer_segments.md>) -
  the same trade-off in a proxy.
- [MSS, MTU, PMTUD](<mss_mtu_pmtud.md>) - what "full-size segment" means.
