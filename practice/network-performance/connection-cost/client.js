// node client.js [proxyPort] [requests] [rttMs]
// Sends the same N sequential requests twice through latency-proxy.js:
//   1. a brand-new TCP connection per request   (handshake + request/response = 2 RTT each)
//   2. one kept-alive connection reused for all (handshake once, then 1 RTT each)
const http = require("http");

const PORT = Number(process.argv[2]) || 5501;
const N = Number(process.argv[3]) || 10;
const RTT = Number(process.argv[4]) || 100; // only used to print the expected numbers

function get(agent) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port: PORT, path: "/", agent }, (res) => {
        res.resume();
        res.on("end", resolve);
      })
      .on("error", reject);
  });
}

async function run(label, agent, expectedRtts) {
  const start = Date.now();
  for (let i = 0; i < N; i++) await get(agent);
  const ms = Date.now() - start;
  agent.destroy();
  console.log(
    `${label.padEnd(30)} ${String(ms).padStart(6)} ms total, ${(ms / N).toFixed(0).padStart(4)} ms/request` +
      `   (expected ~${expectedRtts} RTT = ${expectedRtts * RTT} ms/request)`
  );
}

(async () => {
  console.log(`${N} sequential GETs through a link with RTT ${RTT}ms\n`);
  try {
    await run("new connection per request", new http.Agent({ keepAlive: false }), 2);
    await run("one reused keep-alive conn", new http.Agent({ keepAlive: true, maxSockets: 1 }), 1);
  } catch (err) {
    console.error(`${err.code} - are server.js and latency-proxy.js running?`);
  }
})();
