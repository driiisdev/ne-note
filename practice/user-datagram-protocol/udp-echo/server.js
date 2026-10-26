// UDP echo server. No listen(), no accept(), no per-client socket:
// one socket receives datagrams from everyone, and each one carries its sender's address.
const dgram = require("dgram");

const PORT = Number(process.argv[2]) || 5001;
const server = dgram.createSocket("udp4");

server.on("message", (msg, rinfo) => {
  console.log(`[udp] ${rinfo.address}:${rinfo.port} sent ${rinfo.size} bytes: ${msg}`);
  server.send(msg, rinfo.port, rinfo.address); // reply to whoever this datagram came from
});

server.bind(PORT, () => console.log(`udp echo server (node) on :${PORT}`));
