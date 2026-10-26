// Connects to the SAME ip:port three times, changing only the SNI hostname.
//   node client.js [routerPort]
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.argv[2]) || 5940;
const ca = ["alpha", "beta"].map((n) => fs.readFileSync(path.join(__dirname, `${n}.pem`)));

function get(servername) {
  return new Promise((resolve) => {
    const req = https.get(
      {
        host: "127.0.0.1", // always the same IP and port...
        port: PORT,
        servername, //        ...only the SNI differs (also what certificate validation checks against)
        headers: { host: servername },
        ca,
        agent: false,
      },
      (res) => {
        const cert = res.socket.getPeerCertificate();
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve(`cert CN=${cert.subject.CN} | ${body.trim()}`));
      }
    );
    req.on("error", (e) => resolve(`failed: ${e.code || e.message}`));
  });
}

(async () => {
  for (const name of ["alpha.test", "beta.test", "unknown.test"]) {
    console.log(`127.0.0.1:${PORT} with SNI ${name.padEnd(13)} -> ${await get(name)}`);
  }
})();
