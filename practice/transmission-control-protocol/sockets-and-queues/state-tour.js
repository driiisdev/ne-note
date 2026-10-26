// Walks one TCP connection through its states, pausing at each step to ask the OS what it sees.
//
//   node state-tour.js [port]
//
// The server uses allowHalfOpen so it does NOT automatically close when the client does.
// That lets the tour stop in the in-between states (FIN_WAIT_2 / CLOSE_WAIT) that normally
// flash by too fast to see.
const net = require("net");
const { printSockets } = require("./os-sockets");

const PORT = Number(process.argv[2]) || 5300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function step(title, explain) {
  console.log(`\n== ${title}`);
  console.log(`   ${explain}`);
  printSockets(PORT);
}

(async () => {
  let serverSide;
  const server = net.createServer({ allowHalfOpen: true }, (s) => (serverSide = s));
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  step("1. listen()", "server socket is LISTENING: kernel will complete handshakes for this port");

  const client = net.createConnection({ port: PORT, host: "127.0.0.1", allowHalfOpen: true });
  await new Promise((r) => client.on("connect", r));
  await sleep(200);
  step(
    "2. connect() + accept()",
    "SYN, SYN-ACK, ACK done: two ESTABLISHED rows, one for each end of the same connection"
  );

  client.end(); // client sends FIN
  await sleep(300);
  step(
    "3. client calls end() -> FIN",
    "client: FIN_WAIT_2 (waiting for the server's FIN). server: CLOSE_WAIT (got FIN, app hasn't closed yet)"
  );
  console.log("   ^ CLOSE_WAIT that never goes away = an app that forgot to close its sockets (a leak)");

  serverSide.end(); // server sends its FIN
  await sleep(300);
  step(
    "4. server calls end() -> FIN",
    "client (the side that closed FIRST) sits in TIME_WAIT; the server side is fully gone"
  );
  console.log("   ^ TIME_WAIT lasts 2 x MSL (60s on Linux, up to 240s on Windows) so stray old segments die out");

  await new Promise((r) => server.close(r));
  step("5. server.close()", "listening socket gone. The TIME_WAIT row outlives both programs' sockets");
})();
