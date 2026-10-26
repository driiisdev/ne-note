// A tiny client-server key-value store over raw TCP.
// The server owns the state and the logic; clients only send commands and render replies -
// the defining split of client-server architecture.
//
// Protocol (one command per line):  SET <key> <value> | GET <key> | KEYS
const net = require("net");

const PORT = Number(process.argv[2]) || 6100;
const store = new Map();

function handle(line) {
  const [cmd, key, ...rest] = line.trim().split(" ");
  switch ((cmd || "").toUpperCase()) {
    case "SET":
      store.set(key, rest.join(" "));
      return "OK";
    case "GET":
      return store.has(key) ? store.get(key) : "(nil)";
    case "KEYS":
      return [...store.keys()].join(",") || "(empty)";
    default:
      return `ERR unknown command '${cmd}'`;
  }
}

const server = net.createServer((socket) => {
  // The 4-tuple that uniquely identifies this connection (L3 addresses + L4 ports)
  const tuple = `${socket.remoteAddress}:${socket.remotePort} -> ${socket.localAddress}:${socket.localPort}`;
  console.log(`[conn] ${tuple}`);

  let buffered = "";
  socket.on("data", (chunk) => {
    // TCP is a byte stream, not a message stream - frame on newlines ourselves
    buffered += chunk;
    let newline;
    while ((newline = buffered.indexOf("\n")) !== -1) {
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      const reply = handle(line);
      console.log(`[L7 ] ${line.trim()} => ${reply}`);
      socket.write(reply + "\n");
    }
  });

  socket.on("close", () => console.log(`[close] ${tuple}`));
  socket.on("error", () => {});
});

server.listen(PORT, () => console.log(`kv server listening on :${PORT}`));
