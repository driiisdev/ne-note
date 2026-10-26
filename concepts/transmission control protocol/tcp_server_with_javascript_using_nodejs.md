# TCP Server with JavaScript (Node.js)

Node's built-in **`net`** module gives you TCP servers and clients on top of libuv's event loop.
One thread handles thousands of connections: the kernel queues and buffers data, and Node calls
your callbacks when a socket has something to do.

## Minimal echo server

```js
const net = require("net");

const server = net.createServer((socket) => {
  // runs once per ACCEPTED connection - the handshake already happened in the kernel
  console.log(`client ${socket.remoteAddress}:${socket.remotePort}`);

  socket.on("data", (chunk) => socket.write(chunk)); // a chunk = whatever bytes were available
  socket.on("end", () => console.log("peer sent FIN"));  // half-close from the peer
  socket.on("close", () => console.log("fully closed"));
  socket.on("error", (err) => console.log(err.code));     // e.g. ECONNRESET on RST
});

server.listen(5100, () => console.log("listening on :5100"));
```

## Client

```js
const socket = net.createConnection({ host: "127.0.0.1", port: 5100 }, () => {
  socket.write("hello");  // only after the handshake completes
  socket.end();           // send FIN after pending data is flushed
});
socket.on("data", (d) => console.log(`echo: ${d}`));
```

## Things that trip people up

- **`data` is not a message.** Several writes can arrive as one chunk, or one write as several.
  Frame messages yourself (newline, length prefix) and buffer until a full message arrives.
- **`write()` returns `false`** when Node's buffer exceeds `highWaterMark` - stop writing and wait
  for `'drain'` (or use `pipe()`/streams). Ignoring it buffers everything in memory.
- **Half-close**: by default Node ends your side automatically when the peer sends FIN; set
  `allowHalfOpen: true` to keep writing after the peer's `end`.
- **Always handle `'error'`** on sockets - an unhandled `ECONNRESET` crashes the process.
- **`listen(port)` with no host** binds to all interfaces (`::`); pass `"127.0.0.1"` to stay local.
- **`setNoDelay(true)`** disables Nagle's algorithm; **`setKeepAlive(true, ms)`** enables TCP
  keepalive probes; **`setTimeout(ms)`** emits `'timeout'` after inactivity.
- `listen(port, host, backlog)` sets the accept-queue size (default 511).

## Under the hood

`createServer` + `listen` → `socket()`, `bind()`, `listen()`; libuv watches the listening fd with
epoll/kqueue/IOCP and calls `accept()` as connections arrive; each `data` event is a `read()` that
returned bytes.

🖼️ **node event loop serving many sockets: kernel buffers → libuv → data callbacks**
![tcp server node](<../../assets/img/tcp-server-node.png>)

## Practice project

[`practice/transmission-control-protocol/tcp-echo`](../../practice/transmission-control-protocol/tcp-echo) -
`server.js` logs every raw chunk so the byte-stream behaviour is visible.

## Related

- [TCP server with C](<tcp_server_with_c.md>) - the syscalls behind `net`.
- [UDP server with JavaScript](<../user datagram protocol/udp_server_with_javascript_using_nodejs.md>).
- [Flow control](<flow_control.md>) - what `write()` returning `false` really means.
