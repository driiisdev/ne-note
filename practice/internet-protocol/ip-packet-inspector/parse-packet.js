// Decodes a raw Ethernet frame field by field: Ethernet -> ARP, or Ethernet -> IPv4 -> ICMP/UDP/TCP.
//
//   node parse-packet.js sample-icmp            # built-in ICMP echo request (a ping)
//   node parse-packet.js sample-arp             # built-in ARP "who has" broadcast
//   node parse-packet.js 3c52 82aa bb01 ...     # hex you copied from `tcpdump -xx`
//   tcpdump -xx -c 1 icmp | node parse-packet.js   # or pipe tcpdump straight in
//
// tcpdump -xx prints the Ethernet header too; tcpdump -x starts at the IP header.
// Pass --ip if your hex starts at the IP header instead of the Ethernet header.

const SAMPLES = {
  "sample-icmp":
    "3c52 82aa bb01 9cfc e878 f046 0800 4500 003c 1c46 4000 4001 4cb9 c0a8 010a 0808 0808 " +
    "0800 4d54 0001 0007 6162 6364 6566 6768 696a 6b6c 6d6e 6f70 7172 7374 7576 7761 6263 6465 6667 6869",
  "sample-arp":
    "ffff ffff ffff 9cfc e878 f046 0806 0001 0800 0604 0001 9cfc e878 f046 c0a8 010a 0000 0000 0000 c0a8 0101",
};

const IP_PROTOCOLS = { 1: "ICMP", 6: "TCP", 17: "UDP" };
const ICMP_TYPES = { 0: "Echo Reply", 3: "Destination Unreachable", 8: "Echo Request", 11: "Time Exceeded" };

const mac = (buf, off) => [...buf.subarray(off, off + 6)].map((b) => b.toString(16).padStart(2, "0")).join(":");
const ipv4 = (buf, off) => [...buf.subarray(off, off + 4)].join(".");
const hex16 = (n) => "0x" + n.toString(16).padStart(4, "0");

// Internet checksum (RFC 1071): one's-complement sum of 16-bit words.
// Run over a header that already contains its checksum, a valid header sums to 0.
function internetChecksum(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i += 2) sum += (buf[i] << 8) + (buf[i + 1] || 0);
  while (sum >> 16) sum = (sum & 0xffff) + (sum >> 16);
  return ~sum & 0xffff;
}

function parseEthernet(buf) {
  const etherType = buf.readUInt16BE(12);
  console.log("== Ethernet (L2) ==");
  console.log(`  dst MAC    : ${mac(buf, 0)}${mac(buf, 0) === "ff:ff:ff:ff:ff:ff" ? "  (broadcast)" : ""}`);
  console.log(`  src MAC    : ${mac(buf, 6)}`);
  console.log(`  EtherType  : ${hex16(etherType)}  (${{ 0x0800: "IPv4", 0x0806: "ARP", 0x86dd: "IPv6" }[etherType] || "?"})`);
  const rest = buf.subarray(14);
  if (etherType === 0x0806) parseArp(rest);
  else if (etherType === 0x0800) parseIpv4(rest);
  else console.log("  (payload type not decoded by this script)");
}

function parseArp(buf) {
  const op = buf.readUInt16BE(6);
  console.log("== ARP ==");
  console.log(`  operation  : ${op} (${op === 1 ? "request" : op === 2 ? "reply" : "?"})`);
  console.log(`  sender     : ${mac(buf, 8)}  ${ipv4(buf, 14)}`);
  console.log(`  target     : ${mac(buf, 18)}  ${ipv4(buf, 24)}`);
  if (op === 1) console.log(`  meaning    : "who has ${ipv4(buf, 24)}? tell ${ipv4(buf, 14)}"`);
  if (op === 2) console.log(`  meaning    : "${ipv4(buf, 14)} is at ${mac(buf, 8)}"`);
}

function parseIpv4(buf) {
  const version = buf[0] >> 4;
  const ihl = (buf[0] & 0x0f) * 4; // header length in bytes (IHL counts 32-bit words)
  const flagsFrag = buf.readUInt16BE(6);
  const protocol = buf[9];
  const header = buf.subarray(0, ihl);

  console.log("== IPv4 (L3) ==");
  console.log(`  version    : ${version}`);
  console.log(`  header len : ${ihl} bytes${ihl > 20 ? " (has options)" : ""}`);
  console.log(`  DSCP/ECN   : ${buf[1] >> 2} / ${buf[1] & 0x03}`);
  console.log(`  total len  : ${buf.readUInt16BE(2)} bytes (header + payload)`);
  console.log(`  id         : ${hex16(buf.readUInt16BE(4))}`);
  console.log(`  flags      : DF=${(flagsFrag >> 14) & 1} MF=${(flagsFrag >> 13) & 1}  frag offset=${(flagsFrag & 0x1fff) * 8}`);
  console.log(`  TTL        : ${buf[8]}`);
  console.log(`  protocol   : ${protocol} (${IP_PROTOCOLS[protocol] || "?"})`);
  console.log(`  checksum   : ${hex16(buf.readUInt16BE(10))}  ${internetChecksum(header) === 0 ? "valid" : "INVALID"}`);
  console.log(`  src IP     : ${ipv4(buf, 12)}`);
  console.log(`  dst IP     : ${ipv4(buf, 16)}`);

  const totalLen = buf.readUInt16BE(2);
  const truncated = buf.length < totalLen;
  if (truncated) console.log(`  (capture truncated: have ${buf.length} of ${totalLen} bytes - try tcpdump -s 0)`);

  const payload = buf.subarray(ihl, totalLen);
  if (protocol === 1) parseIcmp(payload, truncated);
  else if (protocol === 17) parseUdp(payload);
  else if (protocol === 6) parseTcp(payload);
}

function parseIcmp(buf, truncated) {
  const type = buf[0];
  // ICMP's checksum covers its whole message, so it can't be checked on a truncated capture
  const verdict = truncated ? "(can't verify, truncated)" : internetChecksum(buf) === 0 ? "valid" : "INVALID";
  console.log("== ICMP ==");
  console.log(`  type/code  : ${type}/${buf[1]} (${ICMP_TYPES[type] || "?"})`);
  console.log(`  checksum   : ${hex16(buf.readUInt16BE(2))}  ${verdict}`);
  if (type === 0 || type === 8) {
    console.log(`  identifier : ${buf.readUInt16BE(4)}`);
    console.log(`  sequence   : ${buf.readUInt16BE(6)}`);
    console.log(`  data       : ${JSON.stringify(buf.subarray(8).toString("latin1"))}`);
  }
}

function parseUdp(buf) {
  console.log("== UDP (L4) ==");
  console.log(`  ports      : ${buf.readUInt16BE(0)} -> ${buf.readUInt16BE(2)}`);
  console.log(`  length     : ${buf.readUInt16BE(4)} bytes (8-byte header + data)`);
}

function parseTcp(buf) {
  const flags = buf[13];
  const names = ["FIN", "SYN", "RST", "PSH", "ACK", "URG"].filter((_, i) => flags & (1 << i));
  console.log("== TCP (L4) ==");
  console.log(`  ports      : ${buf.readUInt16BE(0)} -> ${buf.readUInt16BE(2)}`);
  console.log(`  seq / ack  : ${buf.readUInt32BE(4)} / ${buf.readUInt32BE(8)}`);
  console.log(`  flags      : ${names.join(",")}`);
  console.log(`  window     : ${buf.readUInt16BE(14)}`);
}

function toBuffer(text) {
  const hex = text
    .split("\n")
    .map((line) => line.replace(/^\s*0x[0-9a-f]+:\s*/i, "")) // drop tcpdump's "0x0000:" offsets
    .join(" ")
    .replace(/[^0-9a-f]/gi, "");
  return Buffer.from(hex, "hex");
}

function run(text, ipOnly) {
  const buf = toBuffer(text);
  if (buf.length < 20) return console.error("not enough bytes to decode - paste the full hex dump");
  ipOnly ? parseIpv4(buf) : parseEthernet(buf);
}

const args = process.argv.slice(2);
const ipOnly = args.includes("--ip");
const rest = args.filter((a) => a !== "--ip");

if (rest.length) {
  run(SAMPLES[rest[0]] || rest.join(" "), ipOnly);
} else if (!process.stdin.isTTY) {
  let input = "";
  process.stdin.on("data", (c) => (input += c)).on("end", () => run(input, ipOnly));
} else {
  console.log("usage: node parse-packet.js sample-icmp | sample-arp | <hex...> [--ip]");
}
