// node proxy.js <mode> [listenPort] [backendPort]
//
// Three ways a proxy can move client bytes to the backend:
//   stream  - forward every segment the moment it arrives (what an L4 proxy should do)
//   timer   - blindly buffer, flush every 200ms or at 16KB (an L4 proxy "optimising" without
//             knowing the protocol)
//   newline - buffer until a complete "\n"-terminated message (protocol-aware: this is no
//             longer L4, it's L7 for a line protocol)
// Responses always stream straight back, so only the request direction differs.
const net = require("net");

const MODE = process.argv[2] || "stream";
const LISTEN = Number(process.argv[3]) || 5901;
const BACKEND = Number(process.argv[4]) || 5900;
const FLUSH_MS = 200;
const FLUSH_BYTES = 16 * 1024;

if (!["stream", "timer", "newline"].includes(MODE)) {
  console.error("mode must be one of: stream | timer | newline");
  process.exit(1);
}

net
  .createServer((client) => {
    const upstream = net.createConnection({ port: BACKEND, host: "127.0.0.1" });
    let buffer = Buffer.alloc(0);
    let timer = null;

    const flush = () => {
      clearTimeout(timer);
      timer = null;
      if (buffer.length) upstream.write(buffer);
      buffer = Buffer.alloc(0);
    };

    client.on("data", (chunk) => {
      if (MODE === "stream") return upstream.write(chunk);

      buffer = Buffer.concat([buffer, chunk]);
      if (MODE === "timer") {
        if (buffer.length >= FLUSH_BYTES) flush();
        else if (!timer) timer = setTimeout(flush, FLUSH_MS);
      } else {
        const lastNl = buffer.lastIndexOf("\n");
        if (lastNl !== -1) {
          upstream.write(buffer.subarray(0, lastNl + 1)); // only complete messages go through
          buffer = buffer.subarray(lastNl + 1);
        }
      }
    });

    upstream.pipe(client);
    client.on("end", () => {
      flush();
      upstream.end();
    });
    client.on("error", () => upstream.destroy());
    upstream.on("error", () => client.destroy());
  })
  .listen(LISTEN, () => console.log(`proxy (${MODE}) on :${LISTEN} -> :${BACKEND}`));
