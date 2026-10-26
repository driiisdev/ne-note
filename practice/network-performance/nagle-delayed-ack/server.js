// A request/response server with a tiny framed protocol:
//   request  = 4-byte length header + body
//   response = "ok\n", sent only once the WHOLE request has arrived
// Waiting for the full request before replying is completely normal server behaviour,
// and it's exactly what makes the Nagle + delayed-ACK stall possible.
const net = require("net");

const PORT = Number(process.argv[2]) || 5400;

net
  .createServer((socket) => {
    let buf = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 4 && buf.length >= 4 + buf.readUInt32BE(0)) {
        buf = buf.subarray(4 + buf.readUInt32BE(0)); // consume one complete request
        socket.write("ok\n");
      }
      // Header arrived but body hasn't: we send nothing, so there's no reply segment for the
      // kernel to piggyback its ACK on. The ACK for the header waits for the delayed-ACK timer.
    });
    socket.on("error", () => {});
  })
  .listen(PORT, () => console.log(`framed request/response server on :${PORT}`));
