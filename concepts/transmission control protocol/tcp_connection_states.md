# TCP Connection States

A TCP connection is a small **state machine** kept by each endpoint's kernel. The states are what
`netstat` and `ss` show, and reading them is one of the fastest ways to diagnose connection
problems - leaks, overloaded servers, port exhaustion.

## Opening

| State | Side | Meaning |
| --- | --- | --- |
| `CLOSED` | - | no connection |
| `LISTEN` | server | waiting for SYNs on a port |
| `SYN_SENT` | client | SYN sent, waiting for SYN-ACK |
| `SYN_RECEIVED` | server | SYN-ACK sent, waiting for the final ACK (half-open) |
| `ESTABLISHED` | both | handshake done, data flows both ways |

## Closing

The side that calls `close()` first is the **active closer**:

```text
active closer                          passive closer
ESTABLISHED --FIN-->                    ESTABLISHED
FIN_WAIT_1   <--ACK--                   CLOSE_WAIT   (app hasn't closed yet)
FIN_WAIT_2                               ... app calls close()
             <--FIN--                   LAST_ACK
TIME_WAIT    --ACK-->                   CLOSED
  (wait 2 x MSL)
CLOSED
```

`CLOSING` appears when both sides send FIN simultaneously.

## The states that cause trouble

- **Many `CLOSE_WAIT`**: the peer closed, but **your application never called `close()`**. Almost
  always an app bug (a socket/connection leak). They never go away by themselves while the process
  lives.
- **Many `TIME_WAIT`**: lots of short-lived connections closed by this side. Each holds its 4-tuple
  for 2×MSL (60 s on Linux, up to 240 s on Windows). Harmless individually, but on the client side
  they can exhaust ephemeral ports to one destination.
- **Many `SYN_RECEIVED`**: a SYN flood, or a server whose accept queue is full.
- **Many `SYN_SENT`**: the destination is unreachable or dropping SYNs (firewall, overloaded server).
- **Stuck `FIN_WAIT_2`**: the peer never sends its FIN (Linux times this out via `tcp_fin_timeout`).

## Why TIME_WAIT exists

1. If the final ACK is lost, the peer resends its FIN; TIME_WAIT lets the closer ACK it again
   instead of answering with RST.
2. It prevents delayed segments from the old connection being accepted into a new connection that
   reuses the same 4-tuple.

## Inspecting states

```bash
ss -tan                              # Linux
ss -tan state time-wait | wc -l      # count one state
netstat -an -p tcp                   # Windows / macOS
```

🖼️ **the tcp state diagram (rfc 793 style), client path and server path highlighted in different colours**
![tcp state diagram](<../../assets/img/tcp-state-diagram.png>)

## Practice project

[`practice/transmission-control-protocol/sockets-and-queues`](../../practice/transmission-control-protocol/sockets-and-queues) -
`state-tour.js` walks one connection through LISTENING → ESTABLISHED → FIN_WAIT_2 / CLOSE_WAIT →
TIME_WAIT, asking the OS at each step.

## Related

- [TCP](<tcp.md>) - the handshake and teardown that drive these transitions.
- [Running out of TCP source ports](<../miscellaneous/running_out_of_tcp_source_ports.md>) - TIME_WAIT at scale.
- [Sockets, connections and kernel queues](<sockets_connection_and_kernel_queues.md>).
