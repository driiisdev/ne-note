// node client.js
// Sends the same 6 requests over ONE keep-alive connection, first through the L4 proxy,
// then through the L7 proxy, and shows which backend answered each one.
const http = require("http");

const PATHS = ["/", "/api/users", "/", "/api/orders", "/about", "/admin"];

function get(port, path, agent) {
  return new Promise((resolve) => {
    http
      .get({ host: "127.0.0.1", port, path, agent }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            const j = JSON.parse(body);
            resolve(`${res.statusCode} ${j.backend.padEnd(5)}  backend saw conn from ${j.tcpConnectionFrom}, X-Forwarded-For=${j.xForwardedFor}`);
          } catch {
            resolve(`${res.statusCode} ${body.trim()}`);
          }
        });
      })
      .on("error", (e) => resolve(`error ${e.code}`));
  });
}

(async () => {
  for (const [label, port] of [["L4 proxy :5710", 5710], ["L7 proxy :5720", 5720]]) {
    console.log(`\n== ${label} (6 requests, one client connection)`);
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    for (const path of PATHS) console.log(`  ${path.padEnd(12)} ${await get(port, path, agent)}`);
    agent.destroy();
  }
})();
