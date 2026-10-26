# How Does the Kernel Manage TCP Connections?

Applications see a file descriptor and `read`/`write`. Underneath, the kernel runs the whole of TCP:
handshakes, queues, buffers, timers, retransmissions and state for every connection - most of it
without the application being involved at all.

## The data structures

- **Listening socket** per `listen()`ed port, with a **SYN queue** (half-open connections) and an
  **accept queue** (established, waiting for `accept()`).
- **Connection socket** per connection, found by a hash lookup on the **4-tuple** (src IP, src port,
  dst IP, dst port) for every incoming segment.
- Per connection: **send buffer**, **receive buffer**, sequence/ACK state, congestion window, RTT
  estimate, and **timers** (retransmission, delayed ACK, keepalive, TIME_WAIT, zero-window probe).
- A **file descriptor** in the process pointing at the socket.

## What happens without the app

- **Handshakes** complete in the kernel as soon as a socket is listening - `accept()` only hands
  over an already-established connection.
- **ACKs, retransmissions, window updates, keepalive probes** are all kernel work.
- **Incoming data** is ACKed and buffered even if the app never reads (until the buffer fills and
  the window drops to 0).
- **Closing**: `close()` returns immediately; the kernel sends remaining data and the FIN, and keeps
  the socket in `TIME_WAIT` long after the process has forgotten it - or even exited.

## Key limits

| Limit | Linux knob | Symptom when hit |
| --- | --- | --- |
| accept queue | `listen()` backlog, `net.core.somaxconn` | SYN drops, 1-3 s connect spikes |
| SYN queue | `net.ipv4.tcp_max_syn_backlog`, SYN cookies | half-open drops under floods |
| buffers | `net.ipv4.tcp_rmem` / `tcp_wmem` (auto-tuned) | throughput capped on long fat paths |
| ephemeral ports | `net.ipv4.ip_local_port_range` | `EADDRNOTAVAIL` on outbound connects |
| file descriptors | `ulimit -n`, `fs.file-max` | `EMFILE: too many open files` |
| TIME_WAIT reuse | `net.ipv4.tcp_tw_reuse` | port exhaustion on busy clients |
| retries | `net.ipv4.tcp_retries2` (≈15 min) | dead connections take ages to error |
| keepalive | `tcp_keepalive_time` (7200 s) | idle connections silently killed by middleboxes |

## Observing it

`ss -tanpi` (states, queues, cwnd, rtt per connection), `ss -ltn` (accept queues), `nstat -az`
(counters like `TcpExtListenOverflows`, `TcpRetransSegs`), `/proc/net/tcp`, and `netstat -s`.

🖼️ **kernel view: listening socket queues, per-connection buffers and timers, fds in the process above**
![kernel tcp connection management](<../../assets/img/kernel-tcp-connections.png>)

## Practice project

[`practice/miscellaneous/kernel-tcp-lab`](../../practice/miscellaneous/kernel-tcp-lab) -
TIME_WAIT counting and ephemeral ports, plus a silent middlebox; with
[`practice/transmission-control-protocol/sockets-and-queues`](../../practice/transmission-control-protocol/sockets-and-queues)
for the queues and state machine.

## Related

- [Sockets, connections and kernel queues](<../transmission control protocol/sockets_connection_and_kernel_queues.md>).
- [TCP connection states](<../transmission control protocol/tcp_connection_states.md>).
- [Running out of TCP source ports](<running_out_of_tcp_source_ports.md>).
