# UDP Server with JavaScript (Node.js)

Node's built-in **`dgram`** module wraps the OS's UDP sockets. A UDP server is strikingly small:
create a socket, bind it to a port, and react to `message` events. There's no `listen()`, no
`accept()` and no per-client socket - just datagrams, each carrying its sender's address.

## Minimal echo server

```js
const dgram = require("dgram");
const server = dgram.createSocket("udp4"); // "udp6" for IPv6

server.on("message", (msg, rinfo) => {
  // msg: a Buffer with exactly one datagram
  // rinfo: { address, port, family, size } of the sender
  console.log(`${rinfo.address}:${rinfo.port} sent ${msg}`);
  server.send(msg, rinfo.port, rinfo.address); // reply to that sender
});

server.on("error", (err) => { console.error(err); server.close(); });
server.bind(5001, () => console.log("listening on :5001"));
```

## Client

```js
const client = dgram.createSocket("udp4");
client.on("message", (msg) => { console.log(`got ${msg}`); client.close(); });
client.send("hello", 5001, "127.0.0.1"); // no connect, no handshake: just fire it
```

## Things worth knowing

- **One `message` event = one datagram**, always whole - no framing needed (contrast with TCP's
  `data` events, which can split or merge writes).
- `send()`'s callback fires when the datagram **left**, not when it **arrived**.
- `bind()` with no address listens on all interfaces; `bind(5001, "127.0.0.1")` is loopback only.
- `socket.connect(port, host)` exists, but only fixes the default destination and filters incoming
  datagrams to that peer - it doesn't create a connection on the wire.
- Extras: `setBroadcast(true)`, `addMembership()` for multicast, `setTTL()`,
  `setRecvBufferSize()` (to reduce drops under bursts).
- An unhandled `error` event crashes the process, as with every Node event emitter.

## Under the hood

`createSocket` → `socket(AF_INET, SOCK_DGRAM)`, `bind` → `bind()`, `message` → libuv calls
`recvfrom()` when the socket is readable, `send` → `sendto()`. The C version of this server makes
each of those calls explicit.

🖼️ **node dgram flow: createSocket → bind → message events → send back to rinfo**
![udp server node](<../../assets/img/udp-server-node.png>)

## Practice project

[`practice/user-datagram-protocol/udp-echo`](../../practice/user-datagram-protocol/udp-echo) -
`server.js` is this server; `client.js` adds sequence numbers to detect loss and reordering.

## Related

- [UDP server with C](<udp_server_with_c.md>) - the same server with raw syscalls.
- [TCP server with JavaScript](<../transmission control protocol/tcp_server_with_javascript_using_nodejs.md>) -
  how different a connection-oriented server looks.
- [UDP](<udp.md>).
