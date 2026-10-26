# TCP Server with C

A TCP server written directly against POSIX sockets. Compared with UDP, two extra calls appear -
**`listen()`** and **`accept()`** - and they're where the connection-oriented nature of TCP shows up
in code.

## The lifecycle

```c
int listen_fd = socket(AF_INET, SOCK_STREAM, 0);         // 1. TCP socket

int yes = 1;                                             //    allow quick restarts despite
setsockopt(listen_fd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes)); // TIME_WAIT leftovers

bind(listen_fd, (struct sockaddr *)&addr, sizeof(addr)); // 2. claim IP:port
listen(listen_fd, 16);                                   // 3. kernel now completes handshakes
                                                         //    by itself; backlog = accept queue
for (;;) {
    int conn_fd = accept(listen_fd, ...);                // 4. pop an ESTABLISHED connection;
                                                         //    NEW fd per connection
    ssize_t n;
    while ((n = read(conn_fd, buf, sizeof(buf))) > 0)    // 5. read what's available...
        write(conn_fd, buf, n);                          //    ...echo it
                                                         //    n == 0  -> peer sent FIN
    close(conn_fd);                                      // 6. send our FIN
}
```

## Details that matter

- **`listen_fd` vs `conn_fd`**: the listening socket only produces connections; data flows on the
  per-connection fd. Closing `conn_fd` doesn't stop the server.
- **`read()` returns whatever is in the receive buffer** - part of a message or several. `0` means
  the peer closed its side (FIN); `-1` with `ECONNRESET` means it reset.
- **`write()` may write fewer bytes than asked** on non-blocking sockets - real code loops until
  everything is sent.
- **`SO_REUSEADDR`** avoids "Address already in use" when restarting while old connections sit in
  `TIME_WAIT`.
- **`SIGPIPE`**: writing to a socket the peer has closed raises SIGPIPE, which kills the process by
  default - ignore it (`signal(SIGPIPE, SIG_IGN)`) or use `MSG_NOSIGNAL`.

## Serving many clients

The loop above is **iterative**: one client at a time, everyone else waits in the accept queue.
Real servers use one of:

- **process per connection** (`fork()` - classic Apache, Postgres),
- **thread per connection** (simple, but memory-heavy at scale),
- **event loop** (`epoll`/`kqueue` + non-blocking sockets - Nginx, Redis, Node),
- **thread pool + event loops**, or `SO_REUSEPORT` with one listener per worker.

🖼️ **socket → bind → listen → accept → read/write → close flow, with listen_fd and conn_fd drawn separately**
![tcp server c](<../../assets/img/tcp-server-c.png>)

## Practice project

[`practice/transmission-control-protocol/tcp-echo`](../../practice/transmission-control-protocol/tcp-echo) -
`server.c` logs each `accept()` and the size of every `read()`.

## Related

- [TCP server with JavaScript](<tcp_server_with_javascript_using_nodejs.md>).
- [UDP server with C](<../user datagram protocol/udp_server_with_c.md>) - no `listen`/`accept`.
- [Sockets, connections and kernel queues](<sockets_connection_and_kernel_queues.md>) - what
  `listen()` and `accept()` do in the kernel.
