// node flood-client.js [port] [connections] [host]
// Opens N connections at once, sends one message on each, and times two things per connection:
//   connected : when the client's connect() completed (it got a SYN-ACK)
//   echoed    : when the server actually accept()ed it and answered
// Against backlog-server.c, the gap between those two columns is time spent in the kernel's
// queues, and late "connected" times are SYN retransmits after the server dropped a SYN.
const net = require("net");

const PORT = Number(process.argv[2]) || 5301;
const N = Number(process.argv[3]) || 8;
const HOST = process.argv[4] || "127.0.0.1";
const started = Date.now();
const t = () => ((Date.now() - started) / 1000).toFixed(1).padStart(5) + "s";

for (let i = 1; i <= N; i++) {
  const socket = net.createConnection({ port: PORT, host: HOST }, () => {
    console.log(`#${i} connected at ${t()}  (handshake done; sitting in the server's accept queue)`);
    socket.write(`hello ${i}`);
  });
  socket.on("data", () => {
    console.log(`#${i} echoed    at ${t()}  (server finally accept()ed and read it)`);
    socket.end();
  });
  socket.on("error", (err) => console.log(`#${i} ${err.code} at ${t()}`));
}
