// DNS wire format (RFC 1035): building queries and parsing responses, byte by byte.
// Shared by dns-query.js (one recursive query) and dns-trace.js (iterative, from the root).
const dgram = require("dgram");

const TYPES = { A: 1, NS: 2, CNAME: 5, SOA: 6, MX: 15, TXT: 16, AAAA: 28 };
const TYPE_NAMES = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v, k]));
const RCODES = ["NOERROR", "FORMERR", "SERVFAIL", "NXDOMAIN", "NOTIMP", "REFUSED"];

function buildQuery(id, qname, qtype, recursionDesired = true) {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(id, 0); //                                  ID: matches the answer to this question
  header.writeUInt16BE(recursionDesired ? 0x0100 : 0x0000, 2); //  flags: RD=1 means "go find it for me"
  header.writeUInt16BE(1, 4); //                                   QDCOUNT: one question
  // ANCOUNT, NSCOUNT, ARCOUNT stay 0 in a query

  // "www.example.com" -> 3 www 7 example 3 com 0   (length-prefixed labels, no dots on the wire)
  const labels = qname
    .split(".")
    .filter(Boolean)
    .map((label) => Buffer.concat([Buffer.from([label.length]), Buffer.from(label)]));
  const tail = Buffer.alloc(4);
  tail.writeUInt16BE(qtype, 0); // QTYPE
  tail.writeUInt16BE(1, 2); //     QCLASS = IN (internet)
  return Buffer.concat([header, ...labels, Buffer.from([0]), tail]);
}

// Names can be compressed: a length byte with the top two bits set (0xC0) is a POINTER to an
// earlier offset in the packet where the rest of the name continues.
function readName(buf, offset) {
  const labels = [];
  let jumped = false;
  let next = offset;
  for (let hops = 0; hops < 50; hops++) {
    const len = buf[offset];
    if (len === 0) {
      if (!jumped) next = offset + 1;
      break;
    }
    if ((len & 0xc0) === 0xc0) {
      if (!jumped) next = offset + 2;
      offset = buf.readUInt16BE(offset) & 0x3fff;
      jumped = true;
      continue;
    }
    labels.push(buf.toString("ascii", offset + 1, offset + 1 + len));
    offset += 1 + len;
  }
  return { name: labels.join(".") || ".", next };
}

function readRecord(buf, offset) {
  const { name, next } = readName(buf, offset);
  const type = buf.readUInt16BE(next);
  const ttl = buf.readUInt32BE(next + 4);
  const rdlen = buf.readUInt16BE(next + 8);
  const rdStart = next + 10;
  const rd = buf.subarray(rdStart, rdStart + rdlen);

  let data;
  switch (type) {
    case TYPES.A:
      data = [...rd].join(".");
      break;
    case TYPES.AAAA:
      data = rd.toString("hex").match(/.{4}/g).map((group) => group.replace(/^0+(?=.)/, "")).join(":");
      break;
    case TYPES.CNAME:
    case TYPES.NS:
      data = readName(buf, rdStart).name;
      break;
    case TYPES.MX:
      data = `${rd.readUInt16BE(0)} ${readName(buf, rdStart + 2).name}`;
      break;
    case TYPES.TXT: {
      const parts = [];
      for (let i = 0; i < rd.length; i += 1 + rd[i]) parts.push(rd.toString("utf8", i + 1, i + 1 + rd[i]));
      data = parts.map((p) => JSON.stringify(p)).join(" ");
      break;
    }
    case TYPES.SOA: {
      const mname = readName(buf, rdStart);
      const rname = readName(buf, mname.next);
      data = `${mname.name} ${rname.name} serial=${buf.readUInt32BE(rname.next)}`;
      break;
    }
    default:
      data = `(${rdlen} bytes)`;
  }
  return { record: { name, type: TYPE_NAMES[type] || type, ttl, data }, next: rdStart + rdlen };
}

function parseResponse(buf) {
  const flags = buf.readUInt16BE(2);
  const counts = [4, 6, 8, 10].map((o) => buf.readUInt16BE(o));
  let offset = 12;
  for (let i = 0; i < counts[0]; i++) offset = readName(buf, offset).next + 4; // skip the echoed question

  const sections = { answer: [], authority: [], additional: [] };
  for (const [section, count] of [["answer", counts[1]], ["authority", counts[2]], ["additional", counts[3]]]) {
    for (let i = 0; i < count; i++) {
      const { record, next } = readRecord(buf, offset);
      sections[section].push(record);
      offset = next;
    }
  }
  return {
    id: buf.readUInt16BE(0),
    flags: {
      qr: flags >> 15,
      aa: (flags >> 10) & 1,
      tc: (flags >> 9) & 1,
      rd: (flags >> 8) & 1,
      ra: (flags >> 7) & 1,
      rcode: RCODES[flags & 0xf] || flags & 0xf,
    },
    ...sections,
  };
}

// Send one query over UDP; resolves with { res, raw, query, ms }.
function ask(server, qname, typeName, { recursionDesired = true, timeoutMs = 3000 } = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 0xffff);
    const query = buildQuery(id, qname, TYPES[typeName], recursionDesired);
    const socket = dgram.createSocket("udp4");
    const sentAt = process.hrtime.bigint();

    const timer = setTimeout(() => {
      socket.close();
      // UDP gives no error for a lost datagram; a timeout is the only signal
      reject(new Error(`no answer from ${server} within ${timeoutMs}ms`));
    }, timeoutMs);

    socket.on("message", (raw) => {
      const res = parseResponse(raw);
      if (res.id !== id) return; // not our answer: ignore it (basic spoofing defence)
      clearTimeout(timer);
      socket.close();
      resolve({ res, raw, query, ms: Number(process.hrtime.bigint() - sentAt) / 1e6 });
    });

    socket.send(query, 53, server);
  });
}

const formatRecord = (r) => `${r.name.padEnd(28)} ${String(r.ttl).padStart(6)}  IN  ${String(r.type).padEnd(5)} ${r.data}`;
const hex = (buf) => buf.toString("hex").match(/.{1,4}/g).join(" ");

module.exports = { TYPES, buildQuery, parseResponse, ask, formatRecord, hex };
