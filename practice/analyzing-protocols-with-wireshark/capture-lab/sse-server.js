// Server-Sent Events: one long-lived HTTP response that never "finishes".
//   node sse-server.js
//   curl -N http://127.0.0.1:5804/events          (-N: don't buffer, print events as they arrive)
// Wireshark filter:  tcp.port == 5804
const http = require("http");

http
  .createServer((req, res) => {
    if (req.url !== "/events") return res.end("try /events\n");
    res.writeHead(200, {
      "content-type": "text/event-stream", // the whole protocol is this content type...
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    let n = 0;
    const timer = setInterval(() => {
      n++;
      // ...plus this text format: optional "id:" / "event:" lines, "data:" lines, blank line ends an event
      res.write(`id: ${n}\nevent: price\ndata: {"symbol":"NET","price":${(100 + Math.random() * 5).toFixed(2)}}\n\n`);
      if (n === 5) {
        clearInterval(timer);
        res.end();
      }
    }, 1000);
    req.on("close", () => clearInterval(timer));
  })
  .listen(5804, () => console.log("sse on :5804/events"));
