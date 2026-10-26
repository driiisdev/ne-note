# UDP Server with C

The same echo server as the Node version, written against the **POSIX sockets API** directly. Every
step that Node hides becomes a visible system call: `socket()`, `bind()`, `recvfrom()`,
`sendto()`. Builds on Linux, macOS and WSL (native Windows needs Winsock, a slightly different API).

## The syscalls, in order

```c
int fd = socket(AF_INET, SOCK_DGRAM, 0);          // 1. a UDP socket (SOCK_DGRAM)

struct sockaddr_in addr = {0};
addr.sin_family = AF_INET;
addr.sin_addr.s_addr = htonl(INADDR_ANY);         //    0.0.0.0 = all interfaces
addr.sin_port = htons(5001);                       //    network byte order!
bind(fd, (struct sockaddr *)&addr, sizeof(addr)); // 2. claim the port

for (;;) {
    struct sockaddr_in client; socklen_t len = sizeof(client);
    ssize_t n = recvfrom(fd, buf, sizeof(buf), 0,  // 3. block until ONE datagram arrives;
                         (struct sockaddr *)&client, &len); //    fills in who sent it
    sendto(fd, buf, n, 0,                          // 4. reply; destination named every call
           (struct sockaddr *)&client, len);
}
```

## Details that matter

- **`SOCK_DGRAM` vs `SOCK_STREAM`** is the entire UDP/TCP choice at the API level.
- **`htons` / `htonl`**: ports and addresses go on the wire in **big-endian** (network byte order);
  x86 is little-endian. Forgetting this binds you to the wrong port.
- **No `listen()` / `accept()`**: there are no connections to queue or accept.
- **`recvfrom` returns exactly one datagram.** If your buffer is smaller than the datagram, the
  rest is **silently truncated** (`MSG_TRUNC` tells you), so size buffers for the largest expected
  message (up to 65,507 bytes).
- **Iterative by nature**: one loop serves every client, interleaved datagram by datagram - no
  threads needed for basic UDP servers.
- **stdout buffering**: when output is redirected to a file, `printf` is block-buffered; use
  `setvbuf(stdout, NULL, _IOLBF, 0)` to see logs line by line.

## Build and run

```bash
gcc -Wall server.c -o udp-server
./udp-server 5001
```

🖼️ **udp socket syscall flow: socket → bind → recvfrom/sendto loop (no listen, no accept)**
![udp server c](<../../assets/img/udp-server-c.png>)

## Practice project

[`practice/user-datagram-protocol/udp-echo`](../../practice/user-datagram-protocol/udp-echo) -
`server.c` is this server, interchangeable with `server.js` against the same client.

## Related

- [UDP server with JavaScript](<udp_server_with_javascript_using_nodejs.md>).
- [TCP server with C](<../transmission control protocol/tcp_server_with_c.md>) - adds `listen()` and `accept()`.
- [User datagram structure](<user_datagram_structure.md>).
