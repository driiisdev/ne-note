// Layer 7 load balancer / reverse proxy: terminates HTTP, reads each REQUEST, and decides per
// request: by path, round robin within a pool. It can rewrite headers, block paths, answer
// health checks itself, and so on.
//
//   node l7-proxy.js [port]
const http = require("http");

const PORT = Number(process.argv[2]) || 5720;
const POOLS = {
  api: { ports: [5703, 5704], next: 0 }, // /api/*  -> api servers
  web: { ports: [5701, 5702], next: 0 }, // anything else -> web servers
};
// Reuse connections to the backends: the client's connection and the backend connections are
// completely separate TCP connections. (Its own pool, independent of how clients connect.)
const agent = new http.Agent({ keepAlive: true });

http
  .createServer((req, res) => {
    if (req.url === "/healthz") return res.end("proxy ok\n"); // answered by the proxy itself
    if (req.url.startsWith("/admin")) {
      res.statusCode = 403; // a policy decision only possible because we read the request
      return res.end("blocked at the proxy\n");
    }

    const pool = req.url.startsWith("/api") ? POOLS.api : POOLS.web;
    const port = pool.ports[pool.next++ % pool.ports.length];
    console.log(`[L7] ${req.method} ${req.url} -> :${port}  (client conn ${req.socket.remotePort})`);

    const upstream = http.request(
      {
        host: "127.0.0.1",
        port,
        path: req.url,
        method: req.method,
        agent,
        headers: {
          ...req.headers,
          "x-forwarded-for": req.socket.remoteAddress, // the backend would otherwise only see the proxy
          "x-forwarded-proto": "http",
        },
      },
      (upRes) => {
        res.writeHead(upRes.statusCode, upRes.headers);
        upRes.pipe(res);
      }
    );
    upstream.on("error", () => {
      res.statusCode = 502; // Bad Gateway: the proxy is fine, the backend isn't
      res.end("backend unavailable\n");
    });
    req.pipe(upstream);
  })
  .listen(PORT, () => console.log(`L7 proxy on :${PORT}  /api/* -> :5703,:5704   else -> :5701,:5702`));
