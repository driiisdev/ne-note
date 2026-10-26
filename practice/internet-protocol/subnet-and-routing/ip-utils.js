// Shared IPv4 helpers: an IPv4 address is just a 32-bit unsigned integer written as 4 octets.

const toInt = (ip) => ip.split(".").reduce((acc, octet) => acc * 256 + Number(octet), 0);
const toIp = (n) => [24, 16, 8, 0].map((shift) => Math.floor(n / 2 ** shift) % 256).join(".");

// prefix length -> mask as an integer, e.g. 24 -> 0xffffff00
const maskOf = (prefix) => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);

function parseCidr(cidr) {
  const [ip, prefixStr = "32"] = cidr.split("/");
  const prefix = Number(prefixStr);
  const octets = ip.split(".");
  if (octets.length !== 4 || octets.some((o) => !/^\d+$/.test(o) || Number(o) > 255) || !(prefix >= 0 && prefix <= 32)) {
    throw new Error(`not a valid IPv4 CIDR: ${cidr}`);
  }
  return { ip, prefix, mask: maskOf(prefix) };
}

const networkOf = (ipInt, mask) => (ipInt & mask) >>> 0;
const inRange = (ip, cidr) => {
  const { ip: net, mask } = parseCidr(cidr);
  return networkOf(toInt(ip), mask) === networkOf(toInt(net), mask);
};

// Special-purpose ranges worth recognising on sight (RFC 1918, RFC 6598, RFC 3927, ...)
const SPECIAL_RANGES = [
  ["10.0.0.0/8", "private (RFC 1918)"],
  ["172.16.0.0/12", "private (RFC 1918)"],
  ["192.168.0.0/16", "private (RFC 1918)"],
  ["100.64.0.0/10", "carrier-grade NAT shared space (RFC 6598)"],
  ["127.0.0.0/8", "loopback"],
  ["169.254.0.0/16", "link-local (no DHCP answer - APIPA)"],
  ["224.0.0.0/4", "multicast"],
  ["0.0.0.0/8", "\"this network\" (unspecified)"],
];

function classify(ip) {
  const match = SPECIAL_RANGES.find(([cidr]) => inRange(ip, cidr));
  return match ? match[1] : "public (globally routable)";
}

module.exports = { toInt, toIp, maskOf, parseCidr, networkOf, inRange, classify };
