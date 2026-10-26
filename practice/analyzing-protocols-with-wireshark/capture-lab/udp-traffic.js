// UDP traffic to capture: a receiver and a sender in one process, on loopback.
//   node udp-traffic.js            Wireshark filter:  udp.port == 5801
const dgram = require("dgram");

const PORT = 5801;
const short = (msg) => (msg.length > 24 ? `${msg.toString().slice(0, 12)}... (${msg.length} bytes)` : String(msg));
const receiver = dgram.createSocket("udp4");
const sender = dgram.createSocket("udp4");

receiver.on("message", (msg, rinfo) => {
  console.log(`received ${rinfo.size} bytes from :${rinfo.port}: ${short(msg)}`);
  receiver.send(`ack ${msg}`, rinfo.port, rinfo.address);
});
sender.on("message", (msg) => console.log(`sender got: ${short(msg)}`));

receiver.bind(PORT, () => {
  const messages = ["hello", "wireshark", "x".repeat(1200)]; // the last one is big enough to notice in the length column
  messages.forEach((m, i) => setTimeout(() => sender.send(m, PORT, "127.0.0.1"), i * 500));
  setTimeout(() => {
    receiver.close();
    sender.close();
  }, messages.length * 500 + 500);
});
