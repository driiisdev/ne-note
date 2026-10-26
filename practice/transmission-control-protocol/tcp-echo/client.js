// node client.js [port] [host]
// Makes 5 separate write() calls back to back, then closes. Compare the 5 writes here with
// how many `data` chunks the server logs - often fewer, because TCP only promises
// the same BYTES in the same ORDER, not the same message boundaries.
const net = require("net");

const PORT = Number(process.argv[2]) || 5100;
const HOST = process.argv[3] || "127.0.0.1";

const socket = net.createConnection({ port: PORT, host: HOST }, () => {
  // this callback only runs after SYN -> SYN/ACK -> ACK has completed
  console.log(`connected ${socket.localAddress}:${socket.localPort} -> ${HOST}:${PORT}`);
  for (let i = 1; i <= 5; i++) socket.write(`msg${i};`);
  setTimeout(() => socket.end(), 300); // end() sends FIN after pending data is flushed
});

let echoed = "";
socket.on("data", (chunk) => (echoed += chunk));
socket.on("close", () => {
  console.log(`5 writes sent, echo received intact: ${JSON.stringify(echoed)}`);
});
socket.on("error", (err) => console.log(`error: ${err.code}`));
