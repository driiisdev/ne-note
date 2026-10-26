// Prints this machine's network identity per interface - the addresses each OSI layer uses:
//   L2 (data link) -> MAC address, only meaningful on the local network segment
//   L3 (network)   -> IP address + subnet mask, routable beyond the local segment
const os = require("os");

function toCidrPrefix(netmask) {
  return netmask
    .split(".")
    .map((octet) => Number(octet).toString(2).split("1").length - 1)
    .reduce((a, b) => a + b, 0);
}

function networkAddress(ip, netmask) {
  const ipParts = ip.split(".").map(Number);
  const maskParts = netmask.split(".").map(Number);
  return ipParts.map((part, i) => part & maskParts[i]).join(".");
}

for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
  for (const addr of addrs) {
    if (addr.family !== "IPv4" && addr.family !== 4) continue;
    const prefix = toCidrPrefix(addr.netmask);
    console.log(`${name}${addr.internal ? " (loopback)" : ""}`);
    console.log(`  L2 MAC     : ${addr.mac}`);
    console.log(`  L3 IP      : ${addr.address}/${prefix}`);
    console.log(`  L3 subnet  : ${networkAddress(addr.address, addr.netmask)}/${prefix}`);
    console.log();
  }
}
