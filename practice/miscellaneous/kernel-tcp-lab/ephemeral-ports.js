// How fast can one client run out of source ports to ONE destination?
//
//   node ephemeral-ports.js [connections]
//
// 1. reads the OS's ephemeral port range
// 2. opens N short-lived connections to a local server, client closing first each time
// 3. asks the OS how many of them are now parked in TIME_WAIT
// 4. works out the sustained connection rate that would exhaust the range
const net = require("net");
const fs = require("fs");
const { execSync } = require("child_process");

const N = Number(process.argv[2]) || 300;
const PORT = 5910;

function ephemeralRange() {
  try {
    if (process.platform === "win32") {
      const out = execSync("netsh int ipv4 show dynamicport tcp", { encoding: "utf8" });
      const start = Number(out.match(/Start Port\s*:\s*(\d+)/i)[1]);
      const count = Number(out.match(/Number of Ports\s*:\s*(\d+)/i)[1]);
      return { first: start, last: start + count - 1, timeWaitSecs: 120 }; // TcpTimedWaitDelay default
    }
    if (process.platform === "darwin") {
      const first = Number(execSync("sysctl -n net.inet.ip.portrange.first", { encoding: "utf8" }));
      const last = Number(execSync("sysctl -n net.inet.ip.portrange.last", { encoding: "utf8" }));
      return { first, last, timeWaitSecs: 30 }; // 2 x MSL, MSL = 15s on macOS
    }
    const [first, last] = fs.readFileSync("/proc/sys/net/ipv4/ip_local_port_range", "utf8").trim().split(/\s+/).map(Number);
    return { first, last, timeWaitSecs: 60 }; // fixed at 60s in the Linux kernel
  } catch {
    return { first: 49152, last: 65535, timeWaitSecs: 120, guessed: true };
  }
}

function countTimeWait(port) {
  const cmd = process.platform === "linux" ? "ss -tan" : "netstat -an -p tcp";
  const out = execSync(cmd, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const re = new RegExp(`[:.]${port}\\s`);
  return out.split("\n").filter((l) => /TIME[_-]WAIT/i.test(l) && re.test(l + " ")).length;
}

function oneConnection() {
  return new Promise((resolve, reject) => {
    const s = net.createConnection({ port: PORT, host: "127.0.0.1" }, () => s.end()); // client closes first -> client gets TIME_WAIT
    s.on("close", resolve);
    s.on("error", reject);
  });
}

(async () => {
  const range = ephemeralRange();
  const size = range.last - range.first + 1;
  console.log(`ephemeral port range : ${range.first}-${range.last}  (${size.toLocaleString()} ports)${range.guessed ? "  [guessed]" : ""}`);
  console.log(`TIME_WAIT duration   : ~${range.timeWaitSecs}s on ${process.platform}`);

  const server = net.createServer((s) => s.on("error", () => {}).resume());
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

  const before = countTimeWait(PORT);
  const t = Date.now();
  for (let i = 0; i < N; i++) await oneConnection();
  const secs = (Date.now() - t) / 1000;
  const after = countTimeWait(PORT);
  server.close();

  console.log(`\nopened and closed ${N} connections in ${secs.toFixed(1)}s (${Math.round(N / secs)}/s)`);
  console.log(`sockets in TIME_WAIT for :${PORT}: ${before} before -> ${after} after`);
  console.log(`=> each one holds a (src port -> 127.0.0.1:${PORT}) pair hostage for ~${range.timeWaitSecs}s`);

  const maxRate = Math.floor(size / range.timeWaitSecs);
  console.log(`\nsustainable new connections to ONE destination: ~${maxRate}/s  (${size} ports / ${range.timeWaitSecs}s)`);
  console.log(`at this script's rate (${Math.round(N / secs)}/s) the range would run out in ~${Math.round(size / (N / secs))}s`);
  console.log("fix: reuse connections (keep-alive / pooling) so you stop burning a port per request");
})();
