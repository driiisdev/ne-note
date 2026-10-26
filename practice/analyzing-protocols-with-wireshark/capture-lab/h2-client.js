// Three concurrent requests multiplexed over ONE HTTP/2 connection (streams 1, 3, 5).
// Run it with Node's key logging so Wireshark can decrypt the capture:
//
//   node --tls-keylog=keys.log h2-client.js
//
// keys.log gets one line per secret in the NSS key log format that Wireshark reads
// (same thing browsers write when you set SSLKEYLOGFILE).
const http2 = require("http2");
const fs = require("fs");
const path = require("path");

const session = http2.connect("https://localhost:5803", {
  ca: fs.readFileSync(path.join(__dirname, "cert.pem")), // trust our self-signed cert
});

const paths = ["/users", "/orders", "/inventory"];
let done = 0;

for (const p of paths) {
  const req = session.request({ ":path": p });
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    console.log(`stream ${req.id} ${p}: ${body.trim()}`);
    if (++done === paths.length) session.close();
  });
  req.end();
}
