// node client.js [host] [port]
// Sends a scripted series of commands to the kv server and prints each reply.
const net = require("net");

const host = process.argv[2] || "127.0.0.1";
const port = Number(process.argv[3]) || 6100;
const commands = ["SET course networking", "SET layer 4", "GET course", "GET missing", "KEYS"];

const socket = net.createConnection({ host, port }, () => {
  console.log(`connected: local ${socket.localAddress}:${socket.localPort} (ephemeral port picked by the OS)`);
  console.log(`           remote ${socket.remoteAddress}:${socket.remotePort}\n`);
  for (const cmd of commands) socket.write(cmd + "\n");
});

let received = "";
socket.on("data", (chunk) => {
  received += chunk;
  const lines = received.split("\n").filter(Boolean);
  if (lines.length === commands.length) {
    lines.forEach((reply, i) => console.log(`> ${commands[i].padEnd(24)} ${reply}`));
    socket.end();
  }
});
