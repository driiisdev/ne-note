// Path MTU discovery by hand: binary-search the largest ping that gets through with the
// Don't Fragment (DF) bit set.
//
//   node pmtud.js [host]          (default 8.8.8.8)
//
// Uses the system `ping`, since Node has no raw ICMP sockets. Works on Windows, Linux, macOS.
// Path MTU = largest ICMP payload + 8 (ICMP header) + 20 (IPv4 header).
const { spawnSync } = require("child_process");

const host = process.argv[2] || "8.8.8.8";
const IP_ICMP_HEADERS = 28;

function pingWithDF(payload) {
  const args =
    process.platform === "win32"
      ? ["-n", "1", "-w", "1500", "-f", "-l", String(payload), host] //  -f = set DF
      : process.platform === "darwin"
      ? ["-c", "1", "-t", "2", "-D", "-s", String(payload), host] //     -D = set DF
      : ["-c", "1", "-W", "2", "-M", "do", "-s", String(payload), host]; // -M do = set DF, never fragment
  const r = spawnSync("ping", args, { encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  // Windows ping can exit 0 even on failure, so check the output too
  const ok = r.status === 0 && !/fragment|too long|unreachable|timed out|100% packet loss/i.test(out);
  return { ok, out };
}

console.log(`probing path MTU to ${host} with DF set...\n`);

if (!pingWithDF(64).ok) {
  console.log(`a small ping to ${host} failed - the host blocks ICMP or is unreachable, so this method can't measure it.`);
  process.exit(1);
}

let low = 64; // known good
let high = 9000 - IP_ICMP_HEADERS; // jumbo-frame ceiling; most paths fail well before this
let probes = 0;

while (low < high) {
  const mid = Math.ceil((low + high) / 2);
  const { ok } = pingWithDF(mid);
  probes++;
  console.log(`  payload ${String(mid).padStart(4)} (packet ${String(mid + IP_ICMP_HEADERS).padStart(4)} bytes)  ${ok ? "ok" : "too big / dropped"}`);
  if (ok) low = mid;
  else high = mid - 1;
}

const mtu = low + IP_ICMP_HEADERS;
console.log(`\npath MTU to ${host}: ${mtu} bytes  (found in ${probes} probes)`);
console.log(`=> TCP MSS on this path: ${mtu - 40} bytes  (MTU - 20 IP - 20 TCP)`);
if (mtu < 1500) console.log("   below 1500: something on the path (VPN, PPPoE, tunnel) adds its own headers");
