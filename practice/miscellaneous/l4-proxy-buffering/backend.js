// Line-based echo backend: replies to each "\n"-terminated message.
// The reply includes how long this backend was "holding" a half-received message,
// from its first byte arriving to its last, i.e. how long a slow client tied it up.
//   node backend.js [port]
const net = require("net");

const PORT = Number(process.argv[2]) || 5900;

net
  .createServer((socket) => {
    let partial = "";
    let firstByteAt = null;
    socket.on("data", (chunk) => {
      if (firstByteAt === null) firstByteAt = Date.now();
      partial += chunk;
      let nl;
      while ((nl = partial.indexOf("\n")) !== -1) {
        const msg = partial.slice(0, nl);
        partial = partial.slice(nl + 1);
        const heldMs = Date.now() - firstByteAt;
        socket.write(`echo:${msg}|held=${heldMs}\n`);
        firstByteAt = partial.length ? Date.now() : null;
      }
    });
    socket.on("error", () => {});
  })
  .listen(PORT, () => console.log(`line echo backend on :${PORT}`));
