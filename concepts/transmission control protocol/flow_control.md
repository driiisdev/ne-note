# Flow Control

TCP's mechanism for protecting the **receiver**: a sender must never have more unacknowledged data
in flight than the receiver has buffer space for. The receiver controls this by advertising a
**receive window (rwnd)** in every segment it sends back.

## How it works

1. Each side has a kernel **receive buffer**. Data sits there until the application reads it.
2. Every ACK carries the **window** field: "I have this many bytes of free space."
3. The sender keeps `bytes in flight ≤ advertised window`. As the receiver's app reads, space
   frees up, and later ACKs advertise a bigger window ("window update").
4. If the app stops reading, the buffer fills and the receiver advertises a **zero window**. The
   sender stops and periodically sends tiny **zero-window probes** to learn when space opens up.

## Backpressure all the way up

When the receiver's window is 0, the sender's kernel can't send, so its **send buffer** fills; then
the sending application's `write()` blocks (or, in Node, returns `false` until `'drain'`). A slow
consumer thus automatically slows down a fast producer, end to end, without either app
coordinating explicitly.

```text
writer app -> [send buffer] ==network==> [receive buffer] -> slow reader app
     ^ blocks when full        ^ stops when rwnd = 0      ^ rwnd shrinks as this fills
```

## Window scaling and the bandwidth-delay product

The 16-bit window field caps at 65,535 bytes. On a 100 Mbit/s path with 100 ms RTT, you need
`bandwidth × RTT` = 1.25 MB in flight to fill the pipe. The **window scale** option (negotiated in
the SYN) multiplies the window by up to 2^14, and modern OSes **auto-tune** buffer sizes. Too small
a window caps throughput regardless of link speed.

## Flow control vs congestion control

| | Flow control | Congestion control |
| --- | --- | --- |
| Protects | the receiver's buffer | the network |
| Window | `rwnd`, advertised by the receiver | `cwnd`, computed by the sender |
| Signal | receiver's free space | loss, delay, ECN |

The sender obeys both: in flight ≤ `min(rwnd, cwnd)`.

🖼️ **sliding window: sent+acked / sent-not-acked / can-send / can't-send regions, with rwnd marked**
![flow control](<../../assets/img/flow-control-window.png>)

## Practice project

[`practice/transmission-control-protocol/flow-and-congestion`](../../practice/transmission-control-protocol/flow-and-congestion) -
a slow reader throttles a fast writer to its own pace; capture shows `win 0` segments.

## Related

- [Congestion control](<congestion_control.md>) - the other window.
- [TCP segment](<tcp_segment.md>) - the window field and scale option.
- [Sockets, connections and kernel queues](<sockets_connection_and_kernel_queues.md>) - the buffers.
