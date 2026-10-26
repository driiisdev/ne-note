// node client.js [port] [requests] [host]
// Sends requests as TWO writes each (header, then body) and waits for the reply before the
// next one: the "write-write-read" pattern. Runs the whole thing twice: Nagle on, then off.
const net = require("net");

const PORT = Number(process.argv[2]) || 5400;
const N = Number(process.argv[3]) || 20;
const HOST = process.argv[4] || "127.0.0.1";

function run(noDelay) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port: PORT, host: HOST }, async () => {
      socket.setNoDelay(noDelay); // true = disable Nagle's algorithm (TCP_NODELAY)
      const times = [];
      for (let i = 0; i < N; i++) {
        const body = Buffer.from(`request number ${i}`);
        const header = Buffer.alloc(4);
        header.writeUInt32BE(body.length);

        const start = process.hrtime.bigint();
        const replied = new Promise((r) => socket.once("data", r));
        socket.write(header); // write #1: sent immediately (nothing unacknowledged yet)
        socket.write(body); //   write #2: with Nagle ON, held back until write #1 is ACKed
        await replied;
        times.push(Number(process.hrtime.bigint() - start) / 1e6);
      }
      socket.end();
      resolve(times);
    });
    socket.on("error", (err) => {
      console.error(`${err.code} - is server.js running on :${PORT}?`);
      process.exit(1);
    });
  });
}

function report(label, times) {
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(
    `${label.padEnd(26)} avg ${avg.toFixed(2).padStart(7)} ms   median ${sorted[Math.floor(sorted.length / 2)].toFixed(2).padStart(7)} ms   max ${sorted[sorted.length - 1].toFixed(2).padStart(7)} ms   total ${times.reduce((a, b) => a + b, 0).toFixed(0)} ms`
  );
}

(async () => {
  console.log(`${N} requests, each sent as header + body in two separate writes\n`);
  report("Nagle ON  (default)", await run(false));
  report("Nagle OFF (setNoDelay)", await run(true));
})();
