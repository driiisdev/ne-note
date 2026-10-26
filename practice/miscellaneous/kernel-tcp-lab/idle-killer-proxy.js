// Plays the role of the router/firewall in the "Postgres failure caused by a Cisco router" story:
// forwards traffic normally, but once a connection has been idle for IDLE_MS it silently forgets it.
// No FIN, no RST: from then on, bytes in either direction just vanish.
//
//   node idle-killer-proxy.js [listenPort] [targetPort] [idleMs]
//   node idle-killer-proxy.js 5921 5920 5000
const net = require("net");

const LISTEN = Number(process.argv[2]) || 5921;
const TARGET = Number(process.argv[3]) || 5920;
const IDLE_MS = Number(process.argv[4]) || 5000;

net
  .createServer((client) => {
    const upstream = net.createConnection({ port: TARGET, host: "127.0.0.1" });
    let evicted = false;
    let idleTimer;

    const touch = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        evicted = true;
        console.log(`[middlebox] :${client.remotePort} idle ${IDLE_MS}ms -> entry evicted from state table (nobody is told)`);
      }, IDLE_MS);
    };
    touch();

    const forward = (from, to, label) =>
      from.on("data", (chunk) => {
        if (evicted) return console.log(`[middlebox] ${label} ${chunk.length} bytes for an unknown connection -> dropped`);
        touch();
        to.write(chunk);
      });
    forward(client, upstream, "client->db");
    forward(upstream, client, "db->client");

    // A real middlebox never sees the endpoints' sockets close; we only clean up our own.
    const cleanup = () => {
      clearTimeout(idleTimer);
      client.destroy();
      upstream.destroy();
    };
    client.on("close", cleanup).on("error", cleanup);
    upstream.on("close", cleanup).on("error", cleanup);
  })
  .listen(LISTEN, () => console.log(`idle-killer middlebox :${LISTEN} -> :${TARGET}, idle timeout ${IDLE_MS}ms`));
