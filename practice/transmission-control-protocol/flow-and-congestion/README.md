# Practice: Flow Control and Congestion Control

Concept notes: [`flow_control.md`](<../../../concepts/transmission control protocol/flow_control.md>) ·
[`congestion_control.md`](<../../../concepts/transmission control protocol/congestion_control.md>) ·
[`slow_start_vs_congestion_avoidance.md`](<../../../concepts/transmission control protocol/slow_start_vs_congestion_avoidance.md>)

## What this demonstrates

TCP has two different "slow down" mechanisms, and they protect two different things:

| | Flow control | Congestion control |
| --- | --- | --- |
| Protects | the **receiver** (its buffer) | the **network** (routers' queues) |
| Window | `rwnd`, advertised by the receiver in every ACK | `cwnd`, the sender's own estimate, never sent on the wire |
| Signal | receiver's window shrinks toward 0 | packet loss (dup ACKs, timeouts), or ECN marks |
| This project | **real**: a slow reader throttles a fast writer | **simulated**: `cwnd-sim.js` steps through Reno |

The sender may have at most `min(cwnd, rwnd)` unacknowledged bytes in flight.

## Folder structure

```text
flow-and-congestion/
  slow-reader-server.js   <- node slow-reader-server.js [port] [readKBps]   reads at a capped rate
  fast-writer-client.js   <- node fast-writer-client.js [port] [MB]         writes as fast as allowed
  cwnd-sim.js             <- node cwnd-sim.js [--ssthresh=32 --rtts=34 --dupack=14 --timeout=25]
```

## Run it

```bash
node slow-reader-server.js 5200 1024     # terminal 1: read at 1 MB/s
node fast-writer-client.js 5200 6        # terminal 2: try to push 6 MB

node cwnd-sim.js                         # no server needed
```

## What you'll see

The writer could produce gigabytes per second on loopback, but it finishes at the **reader's**
pace:

```text
sent 6 MB in 5.6s
backpressure stalls: 96, total time waiting for 'drain': 5.6s
=> the sender ran at the RECEIVER's pace, not its own
```

And the congestion window simulation:

```text
RTT  cwnd  phase                 window (each # = 1 MSS)
  1     1  slow start            #
  2     2  slow start            ##
  3     4  slow start            ####
  4     8  slow start            ########
  5    16  slow start            ################
  6    32  congestion avoid.     ################################
  7    33  congestion avoid.     #################################
 ...
 14    40  congestion avoid.     ########################################  <- 3 dup ACKs: ssthresh=20, cwnd halved
 15    20  congestion avoid.     ####################
 ...
 25    30  congestion avoid.     ##############################  <- TIMEOUT: ssthresh=15, cwnd reset to 1
 26     1  slow start            #
```

> 🖼️ **Image suggestion:** the classic "TCP sawtooth" graph (cwnd on the y-axis, RTT on the
> x-axis), with the slow start curve, the linear climb, the halving on 3 dup ACKs, and the drop
> to 1 on timeout. Plot `cwnd-sim.js`'s output to get it.

## Code walkthrough

### Flow control is a chain of full buffers

```text
fast-writer  ->  Node write buffer  ->  kernel send buffer  ==wire==>  kernel recv buffer  ->  slow-reader
   (app)          (highWaterMark)                                      (rwnd = free space)       (paused)
```

When the reader pauses, nothing drains the kernel receive buffer. As it fills, the receiver
advertises a smaller and smaller window, eventually **0**. The sender's kernel stops sending, its
send buffer fills, Node's buffer fills, and `write()` returns `false`:

```js
if (!socket.write(CHUNK)) {
  socket.once("drain", writeMore); // resume only when the pressure is released
  return;
}
```

Ignoring that `false` is a classic Node bug. The writes still "succeed," but every chunk queues
up in process memory, so a slow consumer can make a fast producer run out of memory.

On the reader side, `socket.pause()` is all it takes to apply backpressure, because the kernel
does the rest:

```js
socket.pause();
setTimeout(() => socket.resume(), processMs);
```

### Congestion control: slow start vs. congestion avoidance

```js
if (cwnd < ssthresh) cwnd = Math.min(cwnd * 2, ssthresh); // slow start: exponential
else cwnd += 1;                                            // congestion avoidance: linear
```

- **Slow start** isn't slow. It *starts* small (historically 1 MSS, 10 MSS on modern Linux) and
  doubles every RTT to find the available bandwidth quickly.
- **Congestion avoidance** takes over at `ssthresh` and probes carefully at +1 MSS per RTT,
  because the sender is now near the last-known safe limit.
- **3 duplicate ACKs** mean that later segments still arrive, so the network is congested but
  still working. Halve and continue (fast recovery).
- **A timeout** means nothing is getting through. Collapse to 1 and slow-start again.

This is **Reno**. Linux defaults to **CUBIC** (a cubic growth curve instead of linear), and some
networks use **BBR**, which models bandwidth and RTT instead of reacting to loss. They all share
the same core idea of probing for capacity and backing off on congestion signals.

## Try this yourself

- Capture the flow-control run with
  `sudo tcpdump -i lo -n 'tcp port 5200 and tcp[14:2] = 0'`, which filters on a window field of
  exactly 0. You'll see the receiver advertising **`win 0`** (a zero window), followed by
  zero-window probes from the sender.
- Change the reader's rate and watch the writer's total time track it exactly. Double the
  rate, halve the time.
- Remove the `if (!socket.write(...))` check in the writer and log `process.memoryUsage().rss`
  as it runs. That's the memory blow-up that backpressure prevents.
- Check your congestion control algorithm on Linux/WSL:
  `sysctl net.ipv4.tcp_congestion_control` (probably `cubic`), and
  `ss -ti dst 127.0.0.1` during a transfer shows live `cwnd`, `ssthresh` and `rtt` per connection.
- Run `node cwnd-sim.js --ssthresh=8` and compare it with the default. A lower threshold
  switches to linear growth sooner, so it takes longer to reach a big window.

## Real-world equivalent

Flow control is why a slow client downloading a large file doesn't make the server buffer the
whole file in memory. Node streams' `pipe()` handles `write()`/`drain` for you, using the same
logic as `fast-writer-client.js`. Congestion control is why a new connection starts slowly
(which hurts short-lived connections; see `practice/network-performance/connection-cost`), and
why one bulk download doesn't completely starve every other flow sharing your Wi-Fi.
