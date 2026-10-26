// Simulates the TCP Reno congestion window, one round trip (RTT) per line.
//
//   node cwnd-sim.js
//   node cwnd-sim.js --ssthresh=16 --rtts=30 --dupack=10 --timeout=20
//
// The congestion window (cwnd) is the SENDER's own limit on unacknowledged data, set by its
// guess about the NETWORK's capacity. (Flow control's window is the RECEIVER's limit.)
// The sender may have min(cwnd, receiver window) bytes in flight.
//
//   slow start           cwnd < ssthresh : cwnd doubles every RTT (+1 MSS per ACK)
//   congestion avoidance cwnd >= ssthresh: cwnd grows by 1 MSS per RTT
//   3 duplicate ACKs     (mild loss)     : ssthresh = cwnd/2, cwnd = ssthresh   (fast recovery)
//   retransmit timeout   (severe loss)   : ssthresh = cwnd/2, cwnd = 1          (back to slow start)

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : fallback;
};

let ssthresh = arg("ssthresh", 32);
const RTTS = arg("rtts", 34);
const events = { [arg("dupack", 14)]: "dupack", [arg("timeout", 25)]: "timeout" };

let cwnd = 1; // in MSS units (one MSS is roughly 1460 bytes on Ethernet)

console.log(`initial ssthresh = ${ssthresh} MSS\n`);
console.log("RTT  cwnd  phase                 window (each # = 1 MSS)");

for (let rtt = 1; rtt <= RTTS; rtt++) {
  const phase = cwnd < ssthresh ? "slow start" : "congestion avoid.";
  let note = "";

  if (events[rtt] === "dupack") {
    ssthresh = Math.max(Math.floor(cwnd / 2), 2);
    note = `  <- 3 dup ACKs: ssthresh=${ssthresh}, cwnd halved`;
  } else if (events[rtt] === "timeout") {
    ssthresh = Math.max(Math.floor(cwnd / 2), 2);
    note = `  <- TIMEOUT: ssthresh=${ssthresh}, cwnd reset to 1`;
  }

  console.log(`${String(rtt).padStart(3)}  ${String(cwnd).padStart(4)}  ${phase.padEnd(20)}  ${"#".repeat(cwnd)}${note}`);

  // apply this RTT's outcome to the next RTT's window
  if (events[rtt] === "dupack") cwnd = ssthresh;
  else if (events[rtt] === "timeout") cwnd = 1;
  else if (cwnd < ssthresh) cwnd = Math.min(cwnd * 2, ssthresh); // exponential, capped at the threshold
  else cwnd += 1; // linear
}
