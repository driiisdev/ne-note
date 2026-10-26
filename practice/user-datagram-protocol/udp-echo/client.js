// node client.js [port] [count]
// Sends `count` numbered datagrams, then reports what came back: how many, which were lost,
// and whether they arrived in order. UDP itself tracks none of this - the app has to.
const dgram = require("dgram");

const PORT = Number(process.argv[2]) || 5001;
const COUNT = Number(process.argv[3]) || 20;
const WAIT_MS = 1500;

const client = dgram.createSocket("udp4");
const received = [];

client.on("message", (msg) => received.push(Number(String(msg).split(":")[1])));

for (let seq = 1; seq <= COUNT; seq++) {
  client.send(`seq:${seq}`, PORT, "127.0.0.1"); // fire and forget - no handshake, no ack
}
console.log(`sent ${COUNT} datagrams to :${PORT}, waiting ${WAIT_MS}ms for echoes...\n`);

setTimeout(() => {
  const lost = [];
  for (let seq = 1; seq <= COUNT; seq++) if (!received.includes(seq)) lost.push(seq);
  const outOfOrder = received.filter((seq, i) => i > 0 && seq < received[i - 1]).length;

  console.log(`arrival order : ${received.join(" ") || "(nothing)"}`);
  console.log(`received      : ${received.length}/${COUNT}`);
  console.log(`lost          : ${lost.length ? lost.join(" ") : "none"}`);
  console.log(`out of order  : ${outOfOrder}`);
  client.close();
}, WAIT_MS);
