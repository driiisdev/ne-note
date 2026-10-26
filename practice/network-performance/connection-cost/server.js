// Plain HTTP server with a tiny response, so the timing is all network, no server work.
//   node server.js [port]
const http = require("http");

const PORT = Number(process.argv[2]) || 5500;

http
  .createServer((req, res) => res.end("ok"))
  .listen(PORT, () => console.log(`http server on :${PORT}`));
