// Talks to MongoDB with NO driver: hand-encoded BSON inside hand-built OP_MSG frames over raw TCP.
// That way, every byte Wireshark's MongoDB dissector decodes is a byte you can find in this file.
//
//   docker run -d --name mongo-lab -p 27017:27017 mongo:7
//   node mongo-wire-client.js [host] [port]
//   Wireshark filter:  mongo        (or tcp.port == 27017)
const net = require("net");

const HOST = process.argv[2] || "127.0.0.1";
const PORT = Number(process.argv[3]) || 27017;
const OP_MSG = 2013;

// ---------- minimal BSON (just the types this demo needs) ----------
function encodeBson(doc) {
  const parts = [];
  for (const [key, value] of Object.entries(doc)) {
    const name = Buffer.concat([Buffer.from(key, "utf8"), Buffer.from([0])]); // keys are C strings
    if (typeof value === "string") {
      const str = Buffer.from(value, "utf8");
      const len = Buffer.alloc(4);
      len.writeInt32LE(str.length + 1);
      parts.push(Buffer.from([0x02]), name, len, str, Buffer.from([0])); // 0x02 string
    } else if (Number.isInteger(value) && Math.abs(value) < 2 ** 31) {
      const n = Buffer.alloc(4);
      n.writeInt32LE(value);
      parts.push(Buffer.from([0x10]), name, n); // 0x10 int32
    } else if (typeof value === "number") {
      const n = Buffer.alloc(8);
      n.writeDoubleLE(value);
      parts.push(Buffer.from([0x01]), name, n); // 0x01 double
    } else if (typeof value === "boolean") {
      parts.push(Buffer.from([0x08]), name, Buffer.from([value ? 1 : 0])); // 0x08 bool
    } else if (value === null) {
      parts.push(Buffer.from([0x0a]), name); // 0x0A null
    } else if (Array.isArray(value)) {
      parts.push(Buffer.from([0x04]), name, encodeBson(Object.fromEntries(value.map((v, i) => [String(i), v])))); // arrays = docs keyed "0","1",...
    } else {
      parts.push(Buffer.from([0x03]), name, encodeBson(value)); // 0x03 embedded document
    }
  }
  const body = Buffer.concat(parts);
  const size = Buffer.alloc(4);
  size.writeInt32LE(4 + body.length + 1); // total size includes itself and the trailing 0
  return Buffer.concat([size, body, Buffer.from([0])]);
}

function decodeBson(buf, offset = 0, asArray = false) {
  const end = offset + buf.readInt32LE(offset);
  const out = asArray ? [] : {};
  let i = offset + 4;
  while (i < end - 1) {
    const type = buf[i++];
    const keyEnd = buf.indexOf(0, i);
    const key = buf.toString("utf8", i, keyEnd);
    i = keyEnd + 1;
    let value;
    switch (type) {
      case 0x01: value = buf.readDoubleLE(i); i += 8; break;
      case 0x02: { const len = buf.readInt32LE(i); value = buf.toString("utf8", i + 4, i + 4 + len - 1); i += 4 + len; break; }
      case 0x03: value = decodeBson(buf, i); i += buf.readInt32LE(i); break;
      case 0x04: value = decodeBson(buf, i, true); i += buf.readInt32LE(i); break;
      case 0x05: { const len = buf.readInt32LE(i); value = `Binary(${buf.toString("hex", i + 5, i + 5 + len)})`; i += 5 + len; break; }
      case 0x07: value = `ObjectId(${buf.toString("hex", i, i + 12)})`; i += 12; break;
      case 0x08: value = buf[i] === 1; i += 1; break;
      case 0x09: value = new Date(Number(buf.readBigInt64LE(i))).toISOString(); i += 8; break;
      case 0x0a: value = null; break;
      case 0x10: value = buf.readInt32LE(i); i += 4; break;
      case 0x11: value = `Timestamp(${buf.readBigUInt64LE(i)})`; i += 8; break;
      case 0x12: value = Number(buf.readBigInt64LE(i)); i += 8; break;
      default: throw new Error(`BSON type 0x${type.toString(16)} not supported by this demo`);
    }
    asArray ? out.push(value) : (out[key] = value);
  }
  return out;
}

// ---------- OP_MSG framing ----------
// header: messageLength | requestID | responseTo | opCode   (4 x int32, little-endian)
// body:   flagBits (uint32) | section kind 0 (1 byte) | one BSON document (the command)
let requestId = 0;
function opMsg(command) {
  const doc = encodeBson(command);
  const header = Buffer.alloc(16);
  header.writeInt32LE(16 + 4 + 1 + doc.length, 0);
  header.writeInt32LE(++requestId, 4);
  header.writeInt32LE(0, 8);
  header.writeInt32LE(OP_MSG, 12);
  return Buffer.concat([header, Buffer.alloc(4), Buffer.from([0]), doc]);
}

// ---------- request/response over one TCP connection ----------
const socket = net.createConnection({ host: HOST, port: PORT });
let pending = Buffer.alloc(0);
let waiting = null;

socket.on("data", (chunk) => {
  pending = Buffer.concat([pending, chunk]);
  // TCP is a stream: wait until a whole message (messageLength bytes) has arrived
  if (pending.length >= 4 && pending.length >= pending.readInt32LE(0)) {
    const len = pending.readInt32LE(0);
    const msg = pending.subarray(0, len);
    pending = pending.subarray(len);
    waiting(decodeBson(msg, 21)); // skip 16-byte header + 4-byte flags + 1-byte section kind
  }
});

function run(command) {
  return new Promise((resolve) => {
    waiting = resolve;
    const frame = opMsg(command);
    console.log(`\n>> ${Object.keys(command)[0]}  (${frame.length} bytes, requestID ${requestId})`);
    socket.write(frame);
  });
}

socket.on("connect", async () => {
  const hello = await run({ hello: 1, $db: "admin" });
  console.log(`<< maxWireVersion ${hello.maxWireVersion}, isWritablePrimary ${hello.isWritablePrimary}`);

  const ins = await run({
    insert: "notes",
    documents: [
      { topic: "tcp", module: "transmission control protocol", minutes: 42 },
      { topic: "udp", module: "user datagram protocol", minutes: 18 },
    ],
    $db: "course",
  });
  console.log(`<< inserted ${ins.n}, ok ${ins.ok}`);

  const found = await run({ find: "notes", filter: { topic: "tcp" }, $db: "course" });
  console.log("<< firstBatch:", JSON.stringify(found.cursor.firstBatch));

  const dropped = await run({ drop: "notes", $db: "course" });
  console.log(`<< drop ok ${dropped.ok}`);
  socket.end();
});

socket.on("error", (err) => console.error(`${err.code} - is MongoDB running on ${HOST}:${PORT}? (see README)`));
