// Layer 4 load balancer: picks a backend per TCP CONNECTION, then just pipes bytes.
// It never parses HTTP; it can't, because for all it knows the bytes are TLS, Postgres or SSH.
//
//   node l4-proxy.js [port]
const net = require("net");

const PORT = Number(process.argv[2]) || 5710;
const BACKENDS = [5701, 5702];
let next = 0;

net
  .createServer((client) => {
    const port = BACKENDS[next++ % BACKENDS.length]; // round robin, once per connection
    const upstream = net.createConnection({ port, host: "127.0.0.1" });
    console.log(`[L4] new connection ${client.remotePort} -> backend :${port}  (decision made before seeing any bytes)`);

    client.pipe(upstream).pipe(client); // bytes in, bytes out. No idea what they mean.

    client.on("error", () => upstream.destroy());
    upstream.on("error", () => client.destroy());
  })
  .listen(PORT, () => console.log(`L4 proxy on :${PORT} -> ${BACKENDS.map((p) => ":" + p).join(", ")}`));
