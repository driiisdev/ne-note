// node subnet-calc.js 192.168.1.130/26 [10.0.0.0/8 ...]
// Prints everything derivable from an address + prefix length.
const { toInt, toIp, parseCidr, networkOf, classify } = require("./ip-utils");

const inputs = process.argv.slice(2);
if (inputs.length === 0) inputs.push("192.168.1.130/26", "10.20.30.40/8", "172.31.255.1/12", "100.72.1.9/10", "8.8.8.8/32");

for (const cidr of inputs) {
  const { ip, prefix, mask } = parseCidr(cidr);
  const network = networkOf(toInt(ip), mask);
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  // /31 (point-to-point links, RFC 3021) and /32 (a single host) have no network/broadcast reservation
  const usable = prefix >= 31 ? total : total - 2;
  const first = prefix >= 31 ? network : network + 1;
  const last = prefix >= 31 ? broadcast : broadcast - 1;

  console.log(cidr);
  console.log(`  netmask     : ${toIp(mask)}`);
  console.log(`  wildcard    : ${toIp(~mask >>> 0)}   (inverse mask, used in ACLs)`);
  console.log(`  network     : ${toIp(network)}/${prefix}`);
  console.log(`  broadcast   : ${prefix >= 31 ? "none (/31 point-to-point or /32 single host)" : toIp(broadcast)}`);
  console.log(`  host range  : ${toIp(first)} - ${toIp(last)}`);
  console.log(`  usable hosts: ${usable.toLocaleString()}`);
  console.log(`  address kind: ${classify(ip)}`);
  console.log(`  binary mask : ${mask.toString(2).padStart(32, "0").match(/.{8}/g).join(".")}`);
  console.log();
}
