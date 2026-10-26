// Iterative resolution, the way a recursive resolver (1.1.1.1, your ISP's DNS) does it
// on a cache miss: start at a root server and follow referrals down the tree.
//
//   node dns-trace.js www.github.com
//   node dns-trace.js en.wikipedia.org AAAA
//
// Every query here has RD=0 ("don't recurse for me, just tell me what YOU know").
const { TYPES, ask, formatRecord } = require("./dns-wire");

const name = process.argv[2] || "www.example.com";
const type = (process.argv[3] || "A").toUpperCase();
const ROOT = { host: "a.root-servers.net", ip: "198.41.0.4" };

if (!TYPES[type]) {
  console.error(`unsupported type; try one of ${Object.keys(TYPES).join(", ")}`);
  process.exit(1);
}

async function resolveIterative(qname, qtype, depth = 0) {
  const indent = "  ".repeat(depth);
  let server = ROOT;

  for (let step = 1; step <= 15; step++) {
    const { res, ms } = await ask(server.ip, qname, qtype, { recursionDesired: false });
    console.log(`${indent}[${step}] ask ${server.host} (${server.ip}) for ${qname} ${qtype}  ->  ${res.flags.rcode}, ${ms.toFixed(0)}ms`);

    if (res.flags.rcode !== "NOERROR") return [];

    if (res.answer.length) {
      res.answer.forEach((r) => console.log(`${indent}    ${formatRecord(r)}`));
      const final = res.answer.filter((r) => r.type === qtype);
      if (final.length) return final;
      // only a CNAME came back: restart the whole walk for the alias target
      const cname = res.answer.find((r) => r.type === "CNAME");
      if (cname) {
        console.log(`${indent}    CNAME -> restart the walk for ${cname.data}`);
        return resolveIterative(cname.data, qtype, depth);
      }
      return [];
    }

    // No answer: a REFERRAL. The authority section names the servers for the next zone down.
    const nsRecords = res.authority.filter((r) => r.type === "NS");
    if (!nsRecords.length) {
      console.log(`${indent}    no answer and no referral (the name exists but has no ${qtype} record)`);
      return [];
    }
    console.log(`${indent}    referral: zone "${nsRecords[0].name}" is served by ${nsRecords.map((r) => r.data).slice(0, 3).join(", ")}${nsRecords.length > 3 ? ", ..." : ""}`);

    // "Glue": the additional section often includes the NS servers' own IPs, saving a lookup
    const glue = res.additional.find((r) => r.type === "A" && nsRecords.some((ns) => ns.data === r.name));
    if (glue) {
      server = { host: glue.name, ip: glue.data };
    } else {
      // No glue (the NS lives in a different zone): resolve the NS name itself, from the root
      const nsName = nsRecords[0].data;
      console.log(`${indent}    no glue for ${nsName} - resolving it first:`);
      const nsAddrs = await resolveIterative(nsName, "A", depth + 1);
      if (!nsAddrs.length) return [];
      server = { host: nsName, ip: nsAddrs[0].data };
    }
  }
  return [];
}

resolveIterative(name, type)
  .then((answers) => {
    console.log(answers.length ? `\nresolved: ${answers.map((a) => a.data).join(", ")}` : "\nno answer");
  })
  .catch((err) => console.error(err.message));
