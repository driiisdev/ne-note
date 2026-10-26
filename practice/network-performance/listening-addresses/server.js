// Starts the same tiny TCP service three times, each bound to a different address:
//   :5601 on 127.0.0.1   loopback only
//   :5602 on 0.0.0.0     every IPv4 interface
//   :5603 on <LAN IP>    one specific interface
// Then run probe.js to see who can reach which.
const net = require("net");
const os = require("os");

const lanIp = Object.values(os.networkInterfaces())
  .flat()
  .find((a) => (a.family === "IPv4" || a.family === 4) && !a.internal)?.address;

const listeners = [
  { port: 5601, host: "127.0.0.1", label: "loopback only" },
  { port: 5602, host: "0.0.0.0", label: "all interfaces" },
  { port: 5603, host: lanIp, label: "LAN interface only" },
];

for (const { port, host, label } of listeners) {
  if (!host) {
    console.log(`:${port} skipped - no non-loopback IPv4 interface found`);
    continue;
  }
  net
    .createServer((socket) => {
      socket.on("error", () => {}); // probe.js hangs up immediately; ignore the resulting reset
      socket.end(`hello from :${port} (bound to ${host})\n`);
    })
    .listen(port, host, () => console.log(`listening ${host}:${port}`.padEnd(30) + `(${label})`));
}

console.log("\nnow run: node probe.js           (and from another machine: node probe.js <this-machine-lan-ip>)\n");
