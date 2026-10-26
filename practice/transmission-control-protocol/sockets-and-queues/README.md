# Practice: Sockets, Connection States and Kernel Queues

Concept notes: [`tcp_connection_states.md`](<../../../concepts/transmission control protocol/tcp_connection_states.md>) ·
[`sockets_connection_and_kernel_queues.md`](<../../../concepts/transmission control protocol/sockets_connection_and_kernel_queues.md>) ·
[`tcp_pros_n_cons.md`](<../../../concepts/transmission control protocol/tcp_pros_n_cons.md>)

## What this demonstrates

Two things that live inside the kernel, so applications never see them directly. This project
observes them from the outside with `netstat` and `ss`:

1. **TCP connection states.** `state-tour.js` walks one connection through `LISTENING →
   ESTABLISHED → FIN_WAIT_2 / CLOSE_WAIT → TIME_WAIT`, pausing at each step to ask the OS.
   It runs on Windows, Linux and macOS.
2. **The SYN queue and the accept queue.** `backlog-server.c` listens with a tiny backlog and
   refuses to call `accept()` for 20 seconds, so you can watch the queues fill, overflow, and
   push clients into SYN retransmits. It needs Linux or WSL.

## Folder structure

```text
sockets-and-queues/
  os-sockets.js       <- node os-sockets.js <port>   which sockets touch a port, per the OS
  state-tour.js       <- node state-tour.js [port]   one connection, every state, step by step
  backlog-server.c    <- ./backlog-server [port] [backlog] [delaySeconds]
  flood-client.js     <- node flood-client.js [port] [connections]
```

## Run it

```bash
# Part 1: states (any OS)
node state-tour.js

# Part 2: queues (Linux / WSL)
gcc backlog-server.c -o backlog-server
./backlog-server 5301 2 20                      # terminal 1
node flood-client.js 5301 8                      # terminal 2
watch -n 0.5 "ss -tan '( sport = :5301 or dport = :5301 )'"   # terminal 3
nstat -az TcpExtListenOverflows TcpExtListenDrops             # afterwards
```

## What you'll see

### Part 1: states (captured on Windows)

```text
== 2. connect() + accept()
   127.0.0.1:5300           0.0.0.0:0                LISTENING
   127.0.0.1:5300           127.0.0.1:53056          ESTABLISHED
   127.0.0.1:53056          127.0.0.1:5300           ESTABLISHED

== 3. client calls end() -> FIN
   127.0.0.1:5300           127.0.0.1:53056          CLOSE_WAIT
   127.0.0.1:53056          127.0.0.1:5300           FIN_WAIT_2

== 4. server calls end() -> FIN
   127.0.0.1:53056          127.0.0.1:5300           TIME_WAIT
```

### Part 2: queues (captured on WSL, backlog=2, 6 clients)

```text
State    Recv-Q Send-Q Local Address:Port  Peer Address:Port
LISTEN   3      2            0.0.0.0:5301       0.0.0.0:*        <- accept queue: 3 waiting, backlog 2
ESTAB    3      0          127.0.0.1:5301     127.0.0.1:56950    <- queued: handshake done, data waiting, never accept()ed
ESTAB    3      0          127.0.0.1:5301     127.0.0.1:56962
ESTAB    3      0          127.0.0.1:5301     127.0.0.1:56976
SYN-RECV 0      0          127.0.0.1:5301     127.0.0.1:56986    <- server side: stuck half-open...
ESTAB    0      3          127.0.0.1:56986    127.0.0.1:5301     <- ...while the client thinks it's connected!
SYN-SENT 0      1          127.0.0.1:56994    127.0.0.1:5301     <- SYN dropped, client retransmitting
SYN-SENT 0      1          127.0.0.1:57008    127.0.0.1:5301

TcpExtListenOverflows           10
TcpExtListenDrops               10
```

Once the server starts calling `accept()`, every client is eventually served. The ones that
were dropped got in through SYN retransmits, about 1s, 3s or 7s late, and that's the latency
spike users would see.

> 🖼️ **Image suggestion:** a diagram of a listening socket with two queues in front of it. SYNs
> come in on the left into the **SYN queue** (SYN-RECV), the final ACK moves them into the
> **accept queue** (ESTABLISHED), and `accept()` pulls them out on the right into the app. Mark
> the overflow points: a full accept queue makes the kernel drop SYNs and ignore final ACKs.

## Code walkthrough

**On a listening socket, `ss` reuses its two columns for the queue:** `Recv-Q` is the current
accept-queue length, and `Send-Q` is the backlog you passed to `listen()`. On Linux the queue
counts as full once it holds **backlog + 1**. That's why it shows `3` with a backlog of 2.

```c
listen(fd, backlog);   // capped by net.core.somaxconn (4096 on modern Linux)
sleep(delay);          // NOT calling accept(): the queue only drains when the app pulls
```

**The "connected but not really" row** (`ESTAB` on the client and `SYN-RECV` on the server) is a
Linux quirk worth knowing. The client got a SYN-ACK, so its `connect()` succeeded and it sent
data (`Send-Q 3`). But the server dropped the final ACK because the accept queue was full, so it
keeps retransmitting its SYN-ACK. A client can therefore believe it's connected while its
request goes nowhere.

**`allowHalfOpen` makes the half-closed states visible.** By default Node auto-closes the server
side when the client's FIN arrives, so `CLOSE_WAIT` disappears in microseconds. With
`allowHalfOpen: true` it stays there until `serverSide.end()`:

```js
const server = net.createServer({ allowHalfOpen: true }, (s) => (serverSide = s));
```

## The states, and what they mean in production

| State | Side | Means | If you see lots of it... |
| --- | --- | --- | --- |
| `LISTEN` | server | ready to complete handshakes | - |
| `SYN_SENT` | client | SYN sent, waiting for SYN-ACK | server unreachable, or its SYN queue is dropping |
| `SYN_RECV` | server | SYN-ACK sent, waiting for the final ACK | SYN flood, or an overflowing accept queue |
| `ESTABLISHED` | both | open, data can flow | - |
| `FIN_WAIT_2` | closer | my FIN was ACKed, waiting for theirs | the peer isn't closing its side |
| `CLOSE_WAIT` | other side | got FIN, **app hasn't called close()** | **a socket leak in your app** |
| `TIME_WAIT` | closer | done, waiting 2×MSL for stray segments | many short connections; see port exhaustion |

## Pros and cons of TCP, as seen here

- ✅ The kernel does the handshake, queuing, retransmits and ordering for you, which is a lot of
  correctness for free.
- ❌ That work is **state**: every connection costs kernel memory in some state, even
  half-dead ones (`CLOSE_WAIT`, `TIME_WAIT`).
- ❌ The handshake costs a round trip before any data (see
  `practice/network-performance/connection-cost`), and a full queue becomes a latency spike
  that's invisible to the app.

## Try this yourself

- Run `./backlog-server 5301 128 20` with the same 8 clients. There are no overflows and no
  SYN-SENT rows. Raising the backlog is the actual fix, up to `sysctl net.core.somaxconn`.
- Comment out `serverSide.end()` in `state-tour.js` and wait. The `CLOSE_WAIT` row stays as long
  as the process lives, which is exactly what a socket leak looks like on a production box.
- Run `node state-tour.js` twice quickly with the same port. It still works, because only the
  *client's* port is in `TIME_WAIT` (the client closed first). Then try making the server close
  first and restarting a C server without `SO_REUSEADDR`.

## Real-world equivalent

`ss -ltn` with `Recv-Q` approaching `Send-Q` is one of the first things to check when a service
"randomly" has 1-3 second latency spikes under load. That's the SYN-retransmit signature.
`TcpExtListenOverflows` going up in your metrics means the same thing. And lots of `CLOSE_WAIT`
on a server almost always means an app bug.
