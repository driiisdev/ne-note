// Connects to server.js four ways and explains each outcome.
//   node client.js [port]
const tls = require("tls");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.argv[2]) || 8443;
const CA = fs.readFileSync(path.join(__dirname, "ca.pem"));

function attempt(title, options) {
  return new Promise((resolve) => {
    console.log(`\n== ${title}`);
    const started = process.hrtime.bigint();
    const socket = tls.connect({ host: "127.0.0.1", port: PORT, ...options }, () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      const cert = socket.getPeerCertificate(true);
      console.log(`   OK in ${ms.toFixed(1)} ms: ${socket.getProtocol()}, cipher ${socket.getCipher().name}`);
      console.log(`   server cert : subject CN=${cert.subject.CN}, issued by CN=${cert.issuer.CN}`);
      console.log(`   valid       : ${cert.valid_from} -> ${cert.valid_to}`);
      console.log(`   names (SAN) : ${cert.subjectaltname}`);
      console.log(`   sha256      : ${cert.fingerprint256.slice(0, 47)}...`);
      const chain = [];
      for (let c = cert; c && !chain.includes(c.fingerprint256); c = c.issuerCertificate) chain.push(c.fingerprint256), console.log(`   chain       : ${c.subject.CN}`);
      socket.end();
      resolve();
    });
    socket.on("error", (err) => {
      console.log(`   FAILED: ${err.code}`);
      console.log(`   ${err.message}`);
      resolve();
    });
  });
}

(async () => {
  await attempt("1. no CA given - does the client trust whoever signed this cert?", {
    servername: "localhost",
  });
  console.log("   ^ the cert is fine, but it's signed by 'Local Dev CA', which isn't in Node's trusted root store");

  await attempt("2. trust our CA explicitly", {
    servername: "localhost",
    ca: CA,
  });

  await attempt("3. trusted CA, but we expected a different hostname", {
    servername: "bank.example.com",
    ca: CA,
  });
  console.log("   ^ a valid cert for the WRONG name is useless; this check is what stops impersonation");

  await attempt("4. same as 2, but cap the version at TLS 1.2", {
    servername: "localhost",
    ca: CA,
    maxVersion: "TLSv1.2",
  });
  console.log("   ^ different cipher suite naming; TLS 1.2 needs 2 round trips for the handshake vs 1 for TLS 1.3");
})();
