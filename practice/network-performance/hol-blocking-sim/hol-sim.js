// Simulates TCP head-of-line blocking: three independent streams (think: three HTTP/2
// requests) share ONE connection, and a single packet is lost.
//
//   node hol-sim.js
//   node hol-sim.js --lose=B1 --delay=50 --rto=200 --gap=10
//
// Compares two ways the receiver can hand data to the application:
//   TCP-like  : one ordered byte stream. Nothing after a gap can be delivered until the gap is filled.
//   QUIC-like : ordering is per stream. A gap only blocks the stream it belongs to.

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};
const LOST = arg("lose", "B1"); //            which packet the network drops (first transmission)
const DELAY = Number(arg("delay", 50)); //    one-way network delay, ms
const RTO = Number(arg("rto", 200)); //       when the sender retransmits the lost packet, ms after the first send
const GAP = Number(arg("gap", 10)); //        ms between packets leaving the sender

// Interleaved send order, the way HTTP/2 frames from different streams share one connection
const packets = [];
for (let n = 1; n <= 3; n++) for (const s of ["A", "B", "C"]) packets.push({ id: `${s}${n}`, stream: s, n });
packets.forEach((p, i) => {
  p.sentAt = i * GAP;
  p.arrivesAt = p.id === LOST ? p.sentAt + RTO + DELAY : p.sentAt + DELAY; // lost -> retransmitted copy arrives later
});

// TCP-like: deliver in global send order; each packet waits for everything before it
let tcpReady = 0;
for (const p of packets) {
  tcpReady = Math.max(tcpReady, p.arrivesAt);
  p.tcpDelivered = tcpReady;
}

// QUIC-like: deliver in per-stream order only
const streamReady = {};
for (const p of packets) {
  streamReady[p.stream] = Math.max(streamReady[p.stream] || 0, p.arrivesAt);
  p.quicDelivered = streamReady[p.stream];
}

console.log(`one-way delay ${DELAY}ms, packet ${LOST} lost and retransmitted at +${RTO}ms\n`);
console.log("packet  sent  arrives   delivered to app (TCP)   delivered to app (QUIC)");
for (const p of packets) {
  const blockedTcp = p.tcpDelivered > p.arrivesAt ? `  <- blocked ${p.tcpDelivered - p.arrivesAt}ms` : "";
  console.log(
    `${p.id.padEnd(6)}  ${String(p.sentAt).padStart(4)}  ${String(p.arrivesAt).padStart(7)}${p.id === LOST ? "*" : " "}  ` +
      `${String(p.tcpDelivered).padStart(8)}${blockedTcp.padEnd(18)}` +
      `${String(p.quicDelivered).padStart(10)}${p.quicDelivered > p.arrivesAt ? `  <- blocked ${p.quicDelivered - p.arrivesAt}ms` : ""}`
  );
}
console.log("* = retransmitted copy\n");

console.log("stream finished at:      TCP-like   QUIC-like");
for (const s of ["A", "B", "C"]) {
  const mine = packets.filter((p) => p.stream === s);
  const tcp = Math.max(...mine.map((p) => p.tcpDelivered));
  const quic = Math.max(...mine.map((p) => p.quicDelivered));
  const note = s === LOST[0] ? "(the stream that actually lost a packet)" : tcp > quic ? "(innocent bystander, delayed anyway)" : "";
  console.log(`  stream ${s}             ${String(tcp).padStart(6)}ms   ${String(quic).padStart(7)}ms   ${note}`);
}
