// Plain HTTP/1.1 over TCP: everything is readable on the wire.
//   node http-server.js
//   curl http://127.0.0.1:5802/hello
//   curl -X POST -d '{"user":"ada","password":"hunter2"}' http://127.0.0.1:5802/login
// Wireshark filter:  tcp.port == 5802     then right-click a packet > Follow > TCP Stream
const http = require("http");

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      console.log(`${req.method} ${req.url} ${body}`);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ path: req.url, youSent: body || null }) + "\n");
    });
  })
  .listen(5802, () => console.log("http on :5802"));
