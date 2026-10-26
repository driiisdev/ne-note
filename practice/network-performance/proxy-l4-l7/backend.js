// node backend.js <port> <name>
// Answers every request with who it is, which TCP connection the request came in on, and what
// the proxy told it about the original client.
const http = require("http");

const PORT = Number(process.argv[2]) || 5701;
const NAME = process.argv[3] || `backend-${PORT}`;

http
  .createServer((req, res) => {
    const conn = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        backend: NAME,
        path: req.url,
        tcpConnectionFrom: conn, // the PROXY's address, not the client's
        xForwardedFor: req.headers["x-forwarded-for"] || null, // the client, if an L7 proxy told us
      }) + "\n"
    );
  })
  .listen(PORT, () => console.log(`${NAME} on :${PORT}`));
