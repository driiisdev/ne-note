// The app you want to show the world. Bound to 127.0.0.1, so nothing outside this machine can
// reach it directly, which is exactly the situation tunnels exist for.
//   node local-app.js [port]
const http = require("http");

const PORT = Number(process.argv[2]) || 5933;

http
  .createServer((req, res) => {
    console.log(`[app] ${req.method} ${req.url} (tcp peer ${req.socket.remoteAddress}:${req.socket.remotePort})`);
    res.setHeader("content-type", "text/plain");
    res.end(`hello from a server running on someone's laptop, path ${req.url}\n`);
  })
  .listen(PORT, "127.0.0.1", () => console.log(`local app on 127.0.0.1:${PORT} (loopback only)`));
