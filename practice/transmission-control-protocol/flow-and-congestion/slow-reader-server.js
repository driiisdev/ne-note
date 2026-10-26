// node slow-reader-server.js [port] [readKBps]
// Reads from each connection at a capped rate. When it stops reading, the kernel's receive
// buffer fills up, the advertised TCP window shrinks to 0, and the SENDER is forced to wait.
// That's flow control: the receiver protecting itself from a sender that's too fast.
const net = require("net");

const PORT = Number(process.argv[2]) || 5200;
const READ_KBPS = Number(process.argv[3]) || 512;

const server = net.createServer((socket) => {
  let total = 0;
  const started = Date.now();
  console.log(`[accept] reading at most ${READ_KBPS} KB/s`);

  socket.on("data", (chunk) => {
    total += chunk.length;
    // Stop reading, and "process" this chunk for as long as our rate limit says.
    // While paused, Node stops pulling bytes out of the kernel receive buffer.
    socket.pause();
    const processMs = (chunk.length / 1024 / READ_KBPS) * 1000;
    setTimeout(() => socket.resume(), processMs);
  });

  const timer = setInterval(() => {
    const secs = (Date.now() - started) / 1000;
    console.log(`[read  ] ${(total / 1048576).toFixed(1)} MB consumed, ${(total / 1024 / secs).toFixed(0)} KB/s average`);
  }, 1000);

  socket.on("close", () => {
    clearInterval(timer);
    console.log(`[close ] ${(total / 1048576).toFixed(1)} MB total`);
  });
  socket.on("error", () => {});
});

server.listen(PORT, () => console.log(`slow reader on :${PORT}`));
