// A simulated home router doing NAT (strictly, PAT / NAPT: many private hosts share one public
// IP, told apart by port). Walks through a scripted scenario and prints the translation table.
//
//   node nat.js
//
// No real packets: this models the router's decision logic, which is the part worth
// understanding. (Real NAT lives in the kernel - netfilter/conntrack on Linux.)

const PUBLIC_IP = "203.0.113.7";
const IDLE_TIMEOUT_S = 300; // many consumer routers/firewalls use 5 minutes or less for idle TCP

class NatRouter {
  constructor() {
    this.table = new Map(); // publicPort -> { privIp, privPort, remote, lastSeen }
    this.forwards = new Map(); // static port forwards: publicPort -> { privIp, privPort }
    this.nextPort = 40000;
    this.now = 0; // simulated clock, in seconds
  }

  outbound({ src, dst }) {
    const [privIp, privPort] = src.split(":");
    // Reuse the existing mapping for this exact private socket + destination, if there is one
    for (const [pubPort, e] of this.table) {
      if (e.privIp === privIp && e.privPort === privPort && e.remote === dst) {
        e.lastSeen = this.now;
        return log("OUT", `${src} -> ${dst}`, `rewrite src to ${PUBLIC_IP}:${pubPort} (existing mapping)`);
      }
    }
    // New flow: pick a free public port. Two hosts can both use private port 51000;
    // the public port is what keeps them apart.
    const pubPort = this.nextPort++;
    this.table.set(pubPort, { privIp, privPort, remote: dst, lastSeen: this.now });
    log("OUT", `${src} -> ${dst}`, `NEW mapping, rewrite src to ${PUBLIC_IP}:${pubPort}`);
  }

  inbound({ src, dstPort }) {
    const fwd = this.forwards.get(dstPort);
    if (fwd) {
      return log("IN ", `${src} -> ${PUBLIC_IP}:${dstPort}`, `port forward, rewrite dst to ${fwd.privIp}:${fwd.privPort}`);
    }
    const e = this.table.get(dstPort);
    if (!e) {
      return log("IN ", `${src} -> ${PUBLIC_IP}:${dstPort}`, "DROP: no mapping (nobody inside asked for this)");
    }
    if (e.remote !== src) {
      // "endpoint-dependent" filtering: only the host we contacted may answer on this port
      return log("IN ", `${src} -> ${PUBLIC_IP}:${dstPort}`, `DROP: mapping exists, but only for ${e.remote}`);
    }
    e.lastSeen = this.now;
    log("IN ", `${src} -> ${PUBLIC_IP}:${dstPort}`, `rewrite dst to ${e.privIp}:${e.privPort}`);
  }

  addPortForward(pubPort, target) {
    const [privIp, privPort] = target.split(":");
    this.forwards.set(pubPort, { privIp, privPort });
    console.log(`\n-- admin adds port forward ${PUBLIC_IP}:${pubPort} -> ${target}`);
  }

  advance(seconds) {
    this.now += seconds;
    console.log(`\n-- ${seconds}s pass (clock: ${this.now}s)`);
    for (const [pubPort, e] of this.table) {
      if (this.now - e.lastSeen >= IDLE_TIMEOUT_S) {
        this.table.delete(pubPort);
        console.log(`   evicted idle mapping :${pubPort} (${e.privIp}:${e.privPort} <-> ${e.remote}). Neither end is told.`);
      }
    }
  }

  print() {
    console.log("\n   NAT table:");
    console.log("   public              private               remote               idle");
    if (this.table.size === 0) console.log("   (empty)");
    for (const [pubPort, e] of this.table) {
      console.log(
        `   ${(PUBLIC_IP + ":" + pubPort).padEnd(20)}${(e.privIp + ":" + e.privPort).padEnd(22)}${e.remote.padEnd(21)}${this.now - e.lastSeen}s`
      );
    }
  }
}

function log(dir, packet, action) {
  console.log(`   ${dir}  ${packet.padEnd(44)} ${action}`);
}

const r = new NatRouter();

console.log("-- two laptops open HTTPS connections, both happen to pick source port 51000");
r.outbound({ src: "192.168.1.10:51000", dst: "93.184.216.34:443" });
r.outbound({ src: "192.168.1.11:51000", dst: "93.184.216.34:443" });
r.outbound({ src: "192.168.1.10:51000", dst: "93.184.216.34:443" });
r.print();

console.log("\n-- the server replies; the router maps each reply back to the right laptop");
r.inbound({ src: "93.184.216.34:443", dstPort: 40000 });
r.inbound({ src: "93.184.216.34:443", dstPort: 40001 });

console.log("\n-- someone on the internet tries to connect in");
r.inbound({ src: "198.51.100.66:5555", dstPort: 8080 });
r.inbound({ src: "198.51.100.66:5555", dstPort: 40000 });

r.addPortForward(8080, "192.168.1.20:80");
r.inbound({ src: "198.51.100.66:5555", dstPort: 8080 });

console.log("\n-- laptop .10 opens a long-lived connection to a cloud-hosted Postgres, then goes quiet");
r.outbound({ src: "192.168.1.10:52000", dst: "198.51.100.20:5432" });
r.advance(200);
r.outbound({ src: "192.168.1.11:51000", dst: "93.184.216.34:443" }); // .11 stays active
r.print();
r.advance(150);
r.print();

console.log("\n-- the DB finally sends a result on the evicted connection");
r.inbound({ src: "198.51.100.20:5432", dstPort: 40002 });
console.log("   ^ the laptop's TCP stack still thinks the connection is ESTABLISHED. It isn't anymore.");
