// The PRIVATE side of the tunnel, running next to the local app (in real life: the `ngrok` /
// `cloudflared` binary on your laptop). Every connection it makes is OUTBOUND, which NAT and
// firewalls allow by default.
//
//   node agent.js [relayHost] [localPort]
const net = require("net");

const RELAY = process.argv[2] || "127.0.0.1";
const LOCAL_PORT = Number(process.argv[3]) || 5933;
const CONTROL = 5930;
const DATA = 5931;

function connectControl() {
  const control = net.createConnection({ host: RELAY, port: CONTROL }, () =>
    console.log(`[agent] control connection up to ${RELAY}:${CONTROL}, forwarding to 127.0.0.1:${LOCAL_PORT}`)
  );

  let buf = "";
  control.on("data", (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.startsWith("OPEN ")) openTunnel(line.slice(5));
    }
  });

  control.on("close", () => {
    console.log("[agent] control connection lost, retrying in 2s");
    setTimeout(connectControl, 2000);
  });
  control.on("error", () => {});
}

function openTunnel(id) {
  // 1. dial OUT to the relay's data port and say which visitor this is for
  const data = net.createConnection({ host: RELAY, port: DATA }, () => {
    data.write(`DATA ${id}\n`);
    // 2. dial the local app
    const local = net.createConnection({ host: "127.0.0.1", port: LOCAL_PORT }, () => {
      console.log(`[agent] visitor #${id}: relay <-> 127.0.0.1:${LOCAL_PORT}`);
      data.pipe(local).pipe(data); // 3. splice them together
    });
    local.on("error", () => data.destroy());
  });
  data.on("error", () => {});
}

connectControl();
