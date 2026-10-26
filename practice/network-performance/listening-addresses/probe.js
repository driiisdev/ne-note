// node probe.js [extra-target-ip ...]
// Tries to connect to each of server.js's three ports via every local address
// (plus any IPs you pass in), and prints a reachability table.
const net = require("net");
const os = require("os");

const PORTS = { 5601: "127.0.0.1", 5602: "0.0.0.0", 5603: "LAN IP" };

const localTargets = Object.values(os.networkInterfaces())
  .flat()
  .filter((a) => a.family === "IPv4" || a.family === 4)
  .map((a) => a.address);
const targets = [...new Set([...localTargets, ...process.argv.slice(2)])];

function tryConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 1000 });
    socket.once("connect", () => {
      socket.destroy();
      resolve("reachable");
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve("timeout");
    });
    socket.once("error", (err) => resolve(err.code === "ECONNREFUSED" ? "refused" : err.code));
  });
}

(async () => {
  const header = "connect to".padEnd(18) + Object.entries(PORTS).map(([p, h]) => `:${p} (${h})`.padEnd(24)).join("");
  console.log(header);
  console.log("-".repeat(header.length));
  for (const host of targets) {
    const results = [];
    for (const port of Object.keys(PORTS)) results.push(await tryConnect(host, Number(port)));
    console.log(host.padEnd(18) + results.map((r) => r.padEnd(24)).join(""));
  }
})();
