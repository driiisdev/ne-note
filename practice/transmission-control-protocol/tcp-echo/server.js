// TCP echo server. Logs every raw `data` chunk, so you can see that TCP delivers a byte
// stream: the client's separate writes can arrive merged into one chunk (or split across two).
const net = require("net");

const PORT = Number(process.argv[2]) || 5100;

const server = net.createServer((socket) => {
  const peer = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[accept] ${peer}  (3-way handshake already done by the kernel)`);

  socket.on("data", (chunk) => {
    console.log(`[data  ] ${chunk.length} bytes in one chunk: ${JSON.stringify(chunk.toString())}`);
    socket.write(chunk); // echo the bytes back exactly as received
  });

  socket.on("end", () => console.log(`[FIN   ] ${peer} closed its side`)); // peer sent FIN
  socket.on("close", () => console.log(`[close ] ${peer}`));
  socket.on("error", (err) => console.log(`[error ] ${peer} ${err.code}`)); // e.g. ECONNRESET on RST
});

server.listen(PORT, () => console.log(`tcp echo server (node) on :${PORT}`));
