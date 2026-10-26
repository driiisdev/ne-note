// HTTP/2 over TLS. Without the session keys, Wireshark shows only "Application Data".
//   node h2-server.js
const http2 = require("http2");
const fs = require("fs");
const path = require("path");

const server = http2.createSecureServer({
  key: fs.readFileSync(path.join(__dirname, "key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "cert.pem")),
});

server.on("stream", (stream, headers) => {
  console.log(`stream ${stream.id}: ${headers[":method"]} ${headers[":path"]}`);
  stream.respond({ ":status": 200, "content-type": "application/json" });
  stream.end(JSON.stringify({ path: headers[":path"], secret: "only visible after decryption" }) + "\n");
});

server.listen(5803, () => console.log("http/2 + tls on :5803"));
