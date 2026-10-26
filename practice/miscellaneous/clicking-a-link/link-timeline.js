// What happens between clicking a link and the page arriving, one phase at a time.
// Each phase is done by hand (dns -> net -> tls -> raw HTTP/1.1) so it can be timed separately.
//
//   node link-timeline.js https://example.com
//   node link-timeline.js http://github.com          # follows redirects, timing every hop
const dns = require("dns").promises;
const net = require("net");
const tls = require("tls");

const START_URL = process.argv[2] || "https://example.com/";
const MAX_REDIRECTS = 3;
const now = () => Number(process.hrtime.bigint()) / 1e6;

async function fetchTimed(url) {
  const u = new URL(url);
  const https = u.protocol === "https:";
  const port = Number(u.port) || (https ? 443 : 80);
  const t = { start: now() };
  const info = {};

  // 1. DNS: hostname -> IP (through the OS resolver and its cache)
  const { address, family } = await dns.lookup(u.hostname);
  t.dns = now();
  info.ip = `${address} (IPv${family})`;

  // 2. TCP: 3-way handshake
  const socket = await new Promise((resolve, reject) => {
    const s = net.createConnection({ host: address, port }, () => resolve(s));
    s.setTimeout(10000, () => s.destroy(new Error("timeout")));
    s.once("error", reject);
  });
  t.tcp = now();

  // 3. TLS: handshake + certificate verification (SNI = the hostname, not the IP)
  let stream = socket;
  if (https) {
    stream = await new Promise((resolve, reject) => {
      const s = tls.connect({ socket, servername: u.hostname, ALPNProtocols: ["http/1.1"] }, () => resolve(s));
      s.once("error", reject);
    });
    t.tls = now();
    const cert = stream.getPeerCertificate();
    info.tls = `${stream.getProtocol()}, ${stream.getCipher().name}, cert for ${cert.subject?.CN} issued by ${cert.issuer?.O || cert.issuer?.CN}`;
  }

  // 4. HTTP request: plain text, even when it's about to be encrypted
  stream.write(
    `GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\nUser-Agent: link-timeline/1.0\r\n` +
      `Accept: text/html\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n`
  );
  t.sent = now();

  // 5. first byte (TTFB), then 6. the rest of the response
  const chunks = [];
  await new Promise((resolve, reject) => {
    stream.on("data", (c) => {
      if (!t.firstByte) t.firstByte = now();
      chunks.push(c);
    });
    stream.on("end", resolve);
    stream.on("close", resolve);
    stream.on("error", reject);
  });
  t.done = now();

  const raw = Buffer.concat(chunks).toString("latin1");
  const [head, ...rest] = raw.split("\r\n\r\n");
  const [statusLine, ...headerLines] = head.split("\r\n");
  const headers = Object.fromEntries(headerLines.map((l) => [l.slice(0, l.indexOf(":")).toLowerCase(), l.slice(l.indexOf(":") + 1).trim()]));
  return { url, t, info, statusLine, headers, body: rest.join("\r\n\r\n"), bytes: raw.length };
}

function bar(from, to, total, width = 40) {
  const a = Math.round((from / total) * width);
  const b = Math.max(1, Math.round(((to - from) / total) * width));
  return " ".repeat(a) + "█".repeat(b);
}

function report(r) {
  const { t } = r;
  const total = t.done - t.start;
  const phases = [
    ["DNS lookup", t.start, t.dns],
    ["TCP connect", t.dns, t.tcp],
    ...(t.tls ? [["TLS handshake", t.tcp, t.tls]] : []),
    ["request -> first byte", t.sent, t.firstByte],
    ["download", t.firstByte, t.done],
  ];
  console.log(`\n${r.url}`);
  console.log(`  ${r.statusLine}   (${r.bytes.toLocaleString()} bytes)`);
  console.log(`  ip   ${r.info.ip}`);
  if (r.info.tls) console.log(`  tls  ${r.info.tls}`);
  for (const [name, from, to] of phases) {
    console.log(`  ${name.padEnd(22)} ${(to - from).toFixed(1).padStart(7)} ms  |${bar(from - t.start, to - t.start, total)}`);
  }
  console.log(`  ${"total".padEnd(22)} ${total.toFixed(1).padStart(7)} ms`);
}

function nextHosts(r) {
  // A browser now parses the HTML and finds MORE things to fetch on page load (scripts, images,
  // stylesheets, fonts, preconnects) - each new host repeats DNS+TCP+TLS. Plain <a href> links
  // aren't fetched until clicked, so they're ignored.
  const hosts = new Set();
  const patterns = [/\ssrc=["'](?:https?:)?\/\/([^/"'?#:]+)/gi, /<link[^>]*\shref=["'](?:https?:)?\/\/([^/"'?#:]+)/gi];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(r.body))) hosts.add(m[1].toLowerCase());
  }
  hosts.delete(new URL(r.url).hostname);
  return [...hosts];
}

(async () => {
  let url = START_URL;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const r = await fetchTimed(url);
      report(r);
      const status = Number(r.statusLine.split(" ")[1]);
      if (status >= 300 && status < 400 && r.headers.location) {
        url = new URL(r.headers.location, url).href;
        console.log(`  -> redirect to ${url}  (a whole new connection: every phase again)`);
        continue;
      }
      const others = nextHosts(r);
      if (others.length) {
        console.log(`\nthe HTML references ${others.length} other host(s); a browser would now repeat DNS+TCP+TLS for each:`);
        others.slice(0, 10).forEach((h) => console.log(`  - ${h}`));
      }
      break;
    }
  } catch (err) {
    console.error(`failed: ${err.code || err.message}`);
  }
})();
