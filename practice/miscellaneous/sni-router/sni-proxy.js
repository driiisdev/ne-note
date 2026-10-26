// Routes TLS connections by hostname WITHOUT decrypting them.
// It reads just far enough into the client's first message (the ClientHello, which is sent
// in plaintext) to find the SNI extension, picks a backend, then becomes a dumb byte pipe.
//
//   node sni-proxy.js [port]
const net = require("net");

const PORT = Number(process.argv[2]) || 5940;
const ROUTES = { "alpha.test": 5941, "beta.test": 5942 };

// Returns { complete: false } until a whole TLS record has arrived, then { complete: true, sni }.
function parseSni(buf) {
  if (buf.length < 5) return { complete: false };
  if (buf[0] !== 0x16) return { complete: true, sni: null }; // 0x16 = handshake record; anything else isn't TLS
  const recordLen = buf.readUInt16BE(3);
  if (buf.length < 5 + recordLen) return { complete: false }; // ClientHello split across TCP segments: keep reading

  let p = 5;
  if (buf[p] !== 0x01) return { complete: true, sni: null }; // 0x01 = ClientHello
  p += 4; //                                  handshake type (1) + length (3)
  p += 2 + 32; //                             client_version + random
  p += 1 + buf[p]; //                         session_id
  p += 2 + buf.readUInt16BE(p); //            cipher_suites
  p += 1 + buf[p]; //                         compression_methods
  const extensionsEnd = p + 2 + buf.readUInt16BE(p);
  p += 2;

  while (p + 4 <= extensionsEnd) {
    const type = buf.readUInt16BE(p);
    const len = buf.readUInt16BE(p + 2);
    p += 4;
    if (type === 0x0000) {
      // server_name: list length (2) | name_type (1, 0 = host_name) | name length (2) | name
      const nameLen = buf.readUInt16BE(p + 3);
      return { complete: true, sni: buf.toString("ascii", p + 5, p + 5 + nameLen) };
    }
    p += len;
  }
  return { complete: true, sni: null }; // valid ClientHello without SNI (e.g. connecting by IP)
}

net
  .createServer((client) => {
    let buffered = Buffer.alloc(0);

    const onData = (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      let result;
      try {
        result = parseSni(buffered);
      } catch {
        result = { complete: true, sni: null }; // malformed hello
      }
      if (!result.complete) return;
      client.off("data", onData);

      const port = ROUTES[result.sni];
      console.log(`[sni] ${client.remotePort} asked for "${result.sni}" -> ${port ? ":" + port : "no route, closing"}`);
      if (!port) return client.destroy();

      const upstream = net.createConnection({ port, host: "127.0.0.1" }, () => {
        upstream.write(buffered); // replay the ClientHello we peeked at
        client.pipe(upstream).pipe(client); // from here on: opaque encrypted bytes
      });
      upstream.on("error", () => client.destroy());
      client.on("error", () => upstream.destroy());
    };
    client.on("data", onData);
    client.on("error", () => {});
  })
  .listen(PORT, () => console.log(`SNI router on :${PORT}  ${Object.entries(ROUTES).map(([h, p]) => `${h} -> :${p}`).join(", ")}`));
