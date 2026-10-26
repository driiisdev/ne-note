# Sockets, Connections and Kernel Queues

What actually exists inside the OS when a server "accepts connections". The application sees file
descriptors; the kernel maintains listening sockets, connection sockets, two queues per listener,
and two buffers per connection. Most "the server is slow under load" mysteries live here.

## Socket vs connection

- A **socket** is a kernel object referenced by a file descriptor. `socket()` creates one; `bind()`
  gives it a local address and port; `listen()` turns it into a **listening socket**.
- A listening socket never carries data. Each **accepted connection** gets its **own new socket**
  (and fd), identified by the 4-tuple `(src IP, src port, dst IP, dst port)`. That's why one server
  port can hold thousands of connections.

## The two queues on a listening socket

```text
SYN ──> [ SYN queue ]  ──final ACK──> [ accept queue ] ──accept()──> app
         (SYN_RECV,                    (ESTABLISHED,
          half-open)                    waiting for the app)
```

1. **SYN queue**: a SYN arrives, the kernel replies SYN-ACK and stores a half-open entry. Sized by
   `net.ipv4.tcp_max_syn_backlog`; **SYN cookies** let the kernel survive a full SYN queue (SYN
   floods) without storing state.
2. **Accept queue**: the final ACK completes the handshake **in the kernel** - the app isn't
   involved yet. The connection waits here until the app calls `accept()`. Its size is the
   **backlog** passed to `listen()`, capped by `net.core.somaxconn`.

If the accept queue is full, Linux drops new SYNs (clients retry after 1 s, 3 s, 7 s ... → latency
spikes) and may ignore final ACKs (the client thinks it's connected; the server doesn't).
`ss -ltn` shows it: for a listener, **Recv-Q** = current accept-queue length, **Send-Q** = backlog.

## The two buffers on a connection

- **Receive buffer**: data the kernel received and ACKed but the app hasn't `read()` yet. Its free
  space is the advertised TCP window.
- **Send buffer**: data the app `write()`-ed that hasn't been acknowledged yet. `write()` returns as
  soon as data is copied here - not when it's delivered. When full, `write()` blocks.

## Accepting at scale

`accept()` must keep up with the accept queue. Approaches: one acceptor thread with an event loop
(`epoll`/`kqueue` - Node, Nginx), multiple threads accepting on one socket, or **`SO_REUSEPORT`**
giving each worker its own listening socket and its own queues on the same port.

🖼️ **listening socket with syn queue and accept queue, then per-connection send/receive buffers**
![kernel socket queues](<../../assets/img/kernel-socket-queues.png>)

## Practice project

[`practice/transmission-control-protocol/sockets-and-queues`](../../practice/transmission-control-protocol/sockets-and-queues) -
`backlog-server.c` listens with backlog 2 and refuses to `accept()`, so you can watch the queue
overflow, clients stuck in SYN-SENT, and `TcpExtListenOverflows` climb.

## Related

- [TCP connection states](<tcp_connection_states.md>).
- [TCP server with C](<tcp_server_with_c.md>) - `listen()` and `accept()` in code.
- [Flow control](<flow_control.md>) - the receive buffer as the window.
- [How does the kernel manage TCP connections](<../miscellaneous/how_does_the_kernel_manage_tcp_connections.md>).
