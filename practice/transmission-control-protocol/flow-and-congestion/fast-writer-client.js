// node fast-writer-client.js [port] [totalMB]
// Writes as fast as it's allowed to, and respects backpressure: when write() returns false,
// it stops and waits for 'drain'. Logs how often the receiver's slowness pushed back on it.
const net = require("net");

const PORT = Number(process.argv[2]) || 5200;
const TOTAL = (Number(process.argv[3]) || 8) * 1048576;
const CHUNK = Buffer.alloc(64 * 1024, "x");

let sent = 0;
let stalls = 0;
let stalledMs = 0;
const started = Date.now();

const socket = net.createConnection({ port: PORT, host: "127.0.0.1" }, writeMore);

function writeMore() {
  while (sent < TOTAL) {
    sent += CHUNK.length;
    // write() returns false once Node's own user-space buffer is over highWaterMark. That
    // happens because the kernel send buffer is full, because the receiver's window is 0.
    if (!socket.write(CHUNK)) {
      stalls++;
      const stallStart = Date.now();
      socket.once("drain", () => {
        stalledMs += Date.now() - stallStart;
        writeMore();
      });
      return;
    }
  }
  socket.end(() => {
    clearInterval(progress);
    const secs = (Date.now() - started) / 1000;
    console.log(`\n\nsent ${(TOTAL / 1048576).toFixed(0)} MB in ${secs.toFixed(1)}s`);
    console.log(`backpressure stalls: ${stalls}, total time waiting for 'drain': ${(stalledMs / 1000).toFixed(1)}s`);
    console.log(`=> the sender ran at the RECEIVER's pace, not its own`);
  });
}

const progress = setInterval(() => {
  process.stdout.write(`\r[write ] ${(sent / 1048576).toFixed(1)} MB handed to the socket, ${stalls} stalls so far`);
}, 250);

socket.on("error", (err) => {
  clearInterval(progress);
  console.log(`\nerror: ${err.code} - is slow-reader-server.js running on :${PORT}?`);
});
