// The first decision every host makes before sending a packet:
// "is the destination on my own subnet, or do I need to hand it to the gateway?"
//
//   node next-hop.js <destination-ip> [gateway-ip]
//
// Same subnet  -> ARP for the destination's own MAC and send the frame straight to it.
// Other subnet -> ARP for the GATEWAY's MAC; the frame goes to the router, while the IP
//                 header still carries the final destination IP.
const os = require("os");

const [dest, gateway = "<your default gateway>"] = process.argv.slice(2);
if (!dest) {
  console.error("usage: node next-hop.js <destination-ip> [gateway-ip]");
  process.exit(1);
}

const toInt = (ip) => ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;

const candidates = Object.entries(os.networkInterfaces())
  .flatMap(([name, addrs]) => addrs.map((a) => ({ name, ...a })))
  .filter((a) => (a.family === "IPv4" || a.family === 4) && !a.internal);

if (candidates.length === 0) {
  console.error("no non-loopback IPv4 interface found");
  process.exit(1);
}

for (const iface of candidates) {
  const mask = toInt(iface.netmask);
  const sameSubnet = (toInt(iface.address) & mask) === (toInt(dest) & mask);

  console.log(`interface ${iface.name} (${iface.address} / ${iface.netmask})`);
  if (sameSubnet) {
    console.log(`  ${dest} is ON-LINK (same subnet)`);
    console.log(`  -> ARP "who has ${dest}?" and send the frame directly to its MAC`);
  } else {
    console.log(`  ${dest} is REMOTE (different subnet)`);
    console.log(`  -> ARP "who has ${gateway}?" and send the frame to the gateway's MAC`);
    console.log(`     (IP header destination stays ${dest}; only the L2 destination changes)`);
  }
  console.log();
}
