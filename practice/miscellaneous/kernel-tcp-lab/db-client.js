// node db-client.js [port] [idleSeconds] [--heartbeat=ms]
// Like a connection-pool member: runs a query, sits idle, then runs another on the SAME connection.
// Through idle-killer-proxy.js, the second query hangs forever unless something keeps the
// connection from going idle.
const net = require("net");

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const PORT = Number(args[0]) || 5921;
const IDLE_S = Number(args[1]) || 8;
const hb = process.argv.find((a) => a.startsWith("--heartbeat="));
const HEARTBEAT_MS = hb ? Number(hb.split("=")[1]) : 0;
const QUERY_TIMEOUT_MS = 5000;

const socket = net.createConnection({ port: PORT, host: "127.0.0.1" });
// The kernel-level version of a heartbeat. Real routers DO see these probe packets, but our
// user-space middlebox only sees application bytes, so the demo uses an app-level PING instead.
socket.setKeepAlive(true, 2000);

let pending = null;
let buf = "";
socket.on("data", (c) => {
  buf += c;
  let nl;
  while ((nl = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, nl);
    buf = buf.slice(nl + 1);
    if (line === "PONG") continue;
    if (pending) pending(line);
  }
});

function query(sql) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending = null;
      resolve(null);
    }, QUERY_TIMEOUT_MS);
    pending = (line) => {
      clearTimeout(timer);
      pending = null;
      resolve(line);
    };
    socket.write(sql + "\n");
  });
}

socket.on("connect", async () => {
  const t0 = Date.now();
  const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s] ${msg}`);

  log(`query 1 -> ${await query("SELECT * FROM orders LIMIT 1")}`);

  let heartbeat;
  if (HEARTBEAT_MS) {
    log(`idle for ${IDLE_S}s, but sending PING every ${HEARTBEAT_MS}ms`);
    heartbeat = setInterval(() => socket.write("PING\n"), HEARTBEAT_MS);
  } else {
    log(`idle for ${IDLE_S}s (connection still ESTABLISHED as far as both kernels know)`);
  }
  await new Promise((r) => setTimeout(r, IDLE_S * 1000));
  clearInterval(heartbeat);

  const r2 = await query("SELECT * FROM orders LIMIT 1");
  if (r2) log(`query 2 -> ${r2}`);
  else log(`query 2 -> NO RESPONSE after ${QUERY_TIMEOUT_MS / 1000}s. No error, no RST - it just hangs.`);
  socket.destroy();
});

socket.on("error", (err) => console.error(`${err.code} - are db-server.js and idle-killer-proxy.js running?`));
