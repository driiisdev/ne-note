// A router's forwarding decision: longest prefix match against a routing table.
//
//   node route-lookup.js                    # runs the built-in example destinations
//   node route-lookup.js 10.1.2.3 1.1.1.1   # look up your own
//
// Every route whose prefix contains the destination is a candidate; the MOST SPECIFIC one
// (longest prefix) wins. 0.0.0.0/0 matches everything, so it only wins when nothing else does.
const { toInt, parseCidr, networkOf } = require("./ip-utils");

// A small office router's table: two LAN subnets, a VPN to HQ, a more specific
// HQ route that overrides part of the VPN range, and a default route to the ISP.
const ROUTES = [
  { prefix: "192.168.10.0/24", nextHop: "directly connected", iface: "lan0" },
  { prefix: "192.168.20.0/24", nextHop: "directly connected", iface: "lan1" },
  { prefix: "10.0.0.0/8", nextHop: "172.16.0.1 (VPN to HQ)", iface: "tun0" },
  { prefix: "10.50.0.0/16", nextHop: "172.16.0.9 (HQ datacenter link)", iface: "tun1" },
  { prefix: "0.0.0.0/0", nextHop: "203.0.113.1 (ISP gateway)", iface: "wan0" },
];

function lookup(dest) {
  const destInt = toInt(dest);
  const candidates = ROUTES.map((route) => ({ ...route, net: parseCidr(route.prefix) })).filter(
    ({ net }) => networkOf(destInt, net.mask) === networkOf(toInt(net.ip), net.mask)
  );
  candidates.sort((a, b) => b.net.prefix - a.net.prefix); // longest prefix first
  return { winner: candidates[0], candidates };
}

console.log("routing table:");
for (const r of ROUTES) console.log(`  ${r.prefix.padEnd(18)} via ${r.nextHop.padEnd(34)} dev ${r.iface}`);
console.log();

const destinations = process.argv.slice(2);
if (destinations.length === 0) destinations.push("192.168.20.15", "10.9.8.7", "10.50.3.4", "142.250.80.46");

for (const dest of destinations) {
  const { winner, candidates } = lookup(dest);
  console.log(`${dest}`);
  console.log(`  matches : ${candidates.map((c) => c.prefix).join(", ")}`);
  console.log(`  chosen  : ${winner.prefix} -> ${winner.nextHop} (dev ${winner.iface})`);
  console.log();
}
