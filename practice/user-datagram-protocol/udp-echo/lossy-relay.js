// A "bad network" in the middle: forwards datagrams between client and server, but drops
// some and delays others by a random amount (which reorders them).
//
//   node lossy-relay.js [listenPort] [serverPort] [lossPercent] [maxJitterMs]
//   node lossy-relay.js 5002 5001 20 80
//
// Loopback never loses or reorders packets, so without this you'd never see UDP's lack of
// guarantees locally.
const dgram = require("dgram");

const LISTEN = Number(process.argv[2]) || 5002;
const SERVER = Number(process.argv[3]) || 5001;
const LOSS = (Number(process.argv[4]) || 20) / 100;
const JITTER = Number(process.argv[5]) || 80;

const front = dgram.createSocket("udp4"); // faces the client
const back = dgram.createSocket("udp4"); // faces the server
let clientAddr = null; // one client at a time keeps the demo simple

function impair(direction, msg, forward) {
  if (Math.random() < LOSS) return console.log(`[drop ] ${direction} ${msg}`);
  const delay = Math.floor(Math.random() * JITTER);
  setTimeout(forward, delay);
}

front.on("message", (msg, rinfo) => {
  clientAddr = rinfo;
  impair("client->server", msg, () => back.send(msg, SERVER, "127.0.0.1"));
});

back.on("message", (msg) => {
  if (!clientAddr) return;
  impair("server->client", msg, () => front.send(msg, clientAddr.port, clientAddr.address));
});

front.bind(LISTEN, () =>
  console.log(`lossy relay :${LISTEN} -> :${SERVER}  (loss ${LOSS * 100}%, jitter 0-${JITTER}ms)`)
);
