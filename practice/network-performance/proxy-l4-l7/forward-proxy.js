// A FORWARD proxy: sits in front of CLIENTS (a reverse proxy sits in front of SERVERS).
// The client is configured to use it, and asks it to reach arbitrary destinations.
//
//   node forward-proxy.js [port]
//   curl -x http://127.0.0.1:5730 http://example.com/       # plain HTTP: proxy sees everything
//   curl -x http://127.0.0.1:5730 https://example.com/      # HTTPS: CONNECT tunnel, proxy sees only the host
const http = require("http");
const net = require("net");

const PORT = Number(process.argv[2]) || 5730;

const server = http.createServer((req, res) => {
  // Plain HTTP through a proxy: the request line carries the FULL URL ("GET http://example.com/ HTTP/1.1")
  const target = new URL(req.url);
  console.log(`[http   ] ${req.method} ${target.href}   <- full URL, headers and body visible to the proxy`);
  const upstream = http.request(
    { host: target.hostname, port: target.port || 80, path: target.pathname + target.search, method: req.method, headers: req.headers },
    (upRes) => {
      res.writeHead(upRes.statusCode, upRes.headers);
      upRes.pipe(res);
    }
  );
  upstream.on("error", () => {
    res.statusCode = 502;
    res.end();
  });
  req.pipe(upstream);
});

// HTTPS through a proxy: the client sends "CONNECT example.com:443", the proxy opens a raw TCP
// tunnel, and TLS happens end-to-end THROUGH it. The proxy sees the hostname and byte counts only.
server.on("connect", (req, clientSocket, head) => {
  const [host, port] = req.url.split(":");
  console.log(`[CONNECT] ${req.url}   <- only host:port visible; everything after is encrypted`);
  const upstream = net.createConnection({ host, port: Number(port) || 443 }, () => {
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    upstream.write(head);
    upstream.pipe(clientSocket).pipe(upstream);
  });
  let bytes = 0;
  upstream.on("data", (c) => (bytes += c.length));
  upstream.on("close", () => console.log(`[CONNECT] ${req.url} closed after ${bytes} encrypted bytes`));
  upstream.on("error", () => clientSocket.destroy());
  clientSocket.on("error", () => upstream.destroy());
});

server.listen(PORT, () => console.log(`forward proxy on :${PORT}`));
