// Asks the OS (not Node) which TCP sockets touch a given port, and in which state.
// Shared by state-tour.js and usable on its own:  node os-sockets.js <port>
const { execSync } = require("child_process");

const STATES = new Set([
  "LISTEN", "LISTENING", "SYN_SENT", "SYN-SENT", "SYN_RECEIVED", "SYN_RCVD", "SYN-RECV",
  "ESTABLISHED", "ESTAB", "FIN_WAIT_1", "FIN-WAIT-1", "FIN_WAIT_2", "FIN-WAIT-2",
  "CLOSE_WAIT", "CLOSE-WAIT", "CLOSING", "LAST_ACK", "LAST-ACK", "TIME_WAIT", "TIME-WAIT",
]);

function command() {
  if (process.platform === "win32") return "netstat -an -p tcp";
  if (process.platform === "darwin") return "netstat -an -p tcp";
  return "ss -tan"; // Linux: netstat may not be installed, ss always is
}

// Returns [{ local, remote, state }] for sockets whose local or remote port is `port`.
function socketsOn(port) {
  const out = execSync(command(), { encoding: "utf8" });
  const portRe = new RegExp(`[:.]${port}$`);
  const rows = [];
  for (const line of out.split("\n")) {
    const tokens = line.trim().split(/\s+/);
    const state = tokens.find((t) => STATES.has(t.toUpperCase()));
    const addrs = tokens.filter((t) => /[:.]\d+$/.test(t) && /\d/.test(t[0] === "[" ? t[1] : t[0]));
    if (!state || addrs.length < 2) continue;
    const [local, remote] = addrs;
    if (portRe.test(local) || portRe.test(remote)) rows.push({ local, remote, state: state.toUpperCase().replace(/-/g, "_") });
  }
  return rows;
}

function printSockets(port) {
  const rows = socketsOn(port);
  if (rows.length === 0) console.log("   (no sockets on this port)");
  for (const r of rows) console.log(`   ${r.local.padEnd(24)} ${r.remote.padEnd(24)} ${r.state}`);
}

module.exports = { socketsOn, printSockets };

if (require.main === module) {
  const port = Number(process.argv[2]);
  if (!port) {
    console.error("usage: node os-sockets.js <port>");
    process.exit(1);
  }
  printSockets(port);
}
