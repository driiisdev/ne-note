// A stand-in for a database: line protocol, answers "QUERY ..." with "RESULT ...", "PING" with "PONG".
//   node db-server.js [port]
const net = require("net");

const PORT = Number(process.argv[2]) || 5920;

net
  .createServer((socket) => {
    console.log(`[db] connection from :${socket.remotePort}`);
    let buf = "";
    socket.on("data", (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        socket.write(line === "PING" ? "PONG\n" : `RESULT for "${line}"\n`);
      }
    });
    socket.on("close", () => console.log(`[db] connection from :${socket.remotePort} closed`));
    socket.on("error", () => {});
  })
  .listen(PORT, () => console.log(`fake db on :${PORT}`));
