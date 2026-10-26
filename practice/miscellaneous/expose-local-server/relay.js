// The PUBLIC side of the tunnel (in real life: a VPS or ngrok/Cloudflare's edge).
//
//   node relay.js
//
//   :5930 control - the agent connects here OUTBOUND and stays connected
//   :5931 data    - the agent opens one connection here per visitor
//   :5932 public  - visitors connect here
//
// Visitors can't reach the laptop (NAT, firewall, loopback bind), but the laptop can reach the
// relay. So the relay asks the agent, over the control connection, to dial back for each visitor.
const net = require("net");

const CONTROL = 5930;
const DATA = 5931;
const PUBLIC = 5932;

let agent = null;
let nextId = 1;
const waiting = new Map(); // id -> visitor socket, parked until the agent dials back

net
  .createServer((socket) => {
    agent = socket;
    console.log(`[relay] agent connected from ${socket.remoteAddress}:${socket.remotePort}`);
    socket.on("close", () => {
      if (agent === socket) agent = null;
      console.log("[relay] agent disconnected");
    });
    socket.on("error", () => {});
  })
  .listen(CONTROL, () => console.log(`[relay] control :${CONTROL}`));

net
  .createServer((visitor) => {
    if (!agent) {
      visitor.end("HTTP/1.1 502 Bad Gateway\r\ncontent-length: 15\r\n\r\ntunnel offline\n");
      return;
    }
    const id = nextId++;
    visitor.pause(); // hold the visitor's bytes until we have somewhere to send them
    waiting.set(id, visitor);
    console.log(`[relay] visitor #${id} from ${visitor.remoteAddress}:${visitor.remotePort} -> asking agent to OPEN ${id}`);
    agent.write(`OPEN ${id}\n`);
    visitor.on("error", () => {});
    setTimeout(() => {
      if (waiting.delete(id)) visitor.destroy(); // agent never dialled back
    }, 10000);
  })
  .listen(PUBLIC, () => console.log(`[relay] public :${PUBLIC}  <- share this one`));

net
  .createServer((dataConn) => {
    let header = Buffer.alloc(0);
    const onData = (chunk) => {
      header = Buffer.concat([header, chunk]);
      const nl = header.indexOf("\n");
      if (nl === -1) return;
      dataConn.off("data", onData);

      const id = Number(header.subarray(0, nl).toString().replace("DATA ", ""));
      const visitor = waiting.get(id);
      if (!visitor) return dataConn.destroy();
      waiting.delete(id);

      const rest = header.subarray(nl + 1); // anything that arrived right after the header line
      if (rest.length) visitor.write(rest);
      visitor.pipe(dataConn).pipe(visitor); // from here on it's a dumb byte pipe (L4)
      visitor.resume();
      console.log(`[relay] visitor #${id} spliced to agent data connection`);
    };
    dataConn.on("data", onData);
    dataConn.on("error", () => {});
  })
  .listen(DATA, () => console.log(`[relay] data :${DATA}`));
