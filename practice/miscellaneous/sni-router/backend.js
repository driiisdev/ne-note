// An HTTPS "site" with its own certificate. Each backend terminates TLS itself.
//   node backend.js <name> <port>       e.g.  node backend.js alpha 5941
const https = require("https");
const fs = require("fs");
const path = require("path");

const NAME = process.argv[2] || "alpha";
const PORT = Number(process.argv[3]) || 5941;
const read = (ext) => fs.readFileSync(path.join(__dirname, `${NAME}.${ext}`));

https
  .createServer({ key: read("key"), cert: read("pem") }, (req, res) => {
    res.end(`hello from ${NAME}.test (TLS terminated by the backend, not the router)\n`);
  })
  .listen(PORT, () => console.log(`${NAME}.test on :${PORT}`));
