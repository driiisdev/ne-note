// Makes localhost behave like a long-distance link: a TCP proxy that adds round-trip time.
//
//   node latency-proxy.js [listenPort] [targetPort] [rttMs] [--tfo]
//   node latency-proxy.js 5501 5500 100
//
// How it models the network:
//   - a NEW connection is held for 1 RTT before anything is forwarded. That's the cost of the
//     3-way handshake (SYN out, SYN-ACK back) that a real long link would impose. (The real
//     SYN between client and this proxy is local and instant, so the proxy has to add it.)
//   - every chunk is then delayed by RTT/2 in each direction (one-way latency)
//   - --tfo simulates TCP Fast Open: data rides in the SYN, so the handshake wait is skipped
//     for the request (the cookie-based "repeat visitor" case)
const net = require("net");

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const LISTEN = Number(args[0]) || 5501;
const TARGET = Number(args[1]) || 5500;
const RTT = Number(args[2]) || 100;
const TFO = process.argv.includes("--tfo");
const ONE_WAY = RTT / 2;

let connections = 0;

net
  .createServer((client) => {
    connections++;
    const upstream = net.createConnection({ port: TARGET, host: "127.0.0.1" });
    const handshakeDone = Date.now() + (TFO ? 0 : RTT);

    // Each direction keeps its own order: same fixed delay for every chunk = no reordering.
    // The FIN (`end`) is delayed the same way, so it can't overtake data still "in flight".
    const delayed = (from, to, extraUntil = 0) => {
      const later = (fn) => setTimeout(fn, Math.max(Date.now(), extraUntil) + ONE_WAY - Date.now());
      from.on("data", (chunk) => later(() => to.writable && to.write(chunk)));
      from.on("end", () => later(() => to.end()));
    };

    delayed(client, upstream, handshakeDone);
    delayed(upstream, client);

    const destroyBoth = () => {
      client.destroy();
      upstream.destroy();
    };
    client.on("error", destroyBoth);
    upstream.on("error", destroyBoth);
  })
  .listen(LISTEN, () =>
    console.log(`latency proxy :${LISTEN} -> :${TARGET}  RTT ${RTT}ms${TFO ? "  (simulated TCP Fast Open)" : ""}`)
  );

process.on("SIGINT", () => {
  console.log(`\n${connections} TCP connections were opened through the proxy`);
  process.exit(0);
});
