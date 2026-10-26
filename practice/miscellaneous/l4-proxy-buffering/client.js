// node client.js [proxyPort]
// Two workloads through the proxy:
//   A. interactive: 5 small request/response round trips (think: Redis commands, game input)
//   B. slow client: one message trickled 1 byte every 50ms (think: mobile uplink, or slowloris)
const net = require("net");

const PORT = Number(process.argv[2]) || 5901;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect() {
  return new Promise((resolve, reject) => {
    const s = net.createConnection({ port: PORT, host: "127.0.0.1" }, () => resolve(s));
    s.setNoDelay(true); // so the CLIENT's own Nagle isn't what we're measuring
    s.on("error", reject);
  });
}

const nextLine = (s) =>
  new Promise((resolve) => {
    let buf = "";
    const onData = (c) => {
      buf += c;
      if (buf.includes("\n")) {
        s.off("data", onData);
        resolve(buf.trim());
      }
    };
    s.on("data", onData);
  });

(async () => {
  let s;
  try {
    s = await connect();
  } catch (e) {
    return console.error(`${e.code} - start backend.js and proxy.js first`);
  }

  console.log(`== A. interactive: 5 small round trips`);
  const rtts = [];
  for (let i = 1; i <= 5; i++) {
    const t = Date.now();
    s.write(`GET key${i}\n`);
    await nextLine(s);
    rtts.push(Date.now() - t);
  }
  console.log(`   round trips: ${rtts.map((ms) => ms + "ms").join(", ")}`);

  console.log(`== B. slow client: "SET greeting hello" trickled 1 byte / 50ms`);
  const msg = "SET greeting hello\n";
  const t = Date.now();
  const reply = nextLine(s);
  for (const ch of msg) {
    s.write(ch);
    await sleep(50);
  }
  const r = await reply;
  console.log(`   reply after ${Date.now() - t}ms, backend was tied up by a partial message for ${r.split("held=")[1]}ms`);
  s.end();
})();
