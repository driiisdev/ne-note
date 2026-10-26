// HTTPS server using the CA-signed certificate from generate-cert.sh.
//   node server.js [port]
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.argv[2]) || 8443;
const read = (f) => fs.readFileSync(path.join(__dirname, f));

const server = https.createServer(
  {
    key: read("server.key"), //   private: proves we own the certificate. Never leaves this machine.
    cert: read("server.pem"), //  public: sent to every client during the handshake
    minVersion: "TLSv1.2",
  },
  (req, res) => {
    const tls = req.socket;
    res.end(
      JSON.stringify({ protocol: tls.getProtocol(), cipher: tls.getCipher().name, alpn: tls.alpnProtocol || null }, null, 2) + "\n"
    );
  }
);

server.on("secureConnection", (socket) => {
  console.log(`[tls] handshake done: ${socket.getProtocol()} ${socket.getCipher().name} (sni: ${socket.servername || "-"})`);
});

server.listen(PORT, () => console.log(`https server on :${PORT}`));
