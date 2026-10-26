// A tiny `dig`: one recursive DNS query, built and decoded by hand (see dns-wire.js).
//
//   node dns-query.js example.com
//   node dns-query.js gmail.com MX
//   node dns-query.js www.github.com A 8.8.8.8
//   node dns-query.js example.com A 1.1.1.1 --hex     # also dump the raw packets
const { TYPES, ask, formatRecord, hex } = require("./dns-wire");

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const [name = "example.com", typeArg = "A", server = "1.1.1.1"] = args;
const type = typeArg.toUpperCase();
const showHex = process.argv.includes("--hex");

if (!TYPES[type]) {
  console.error(`unsupported type ${typeArg}; try one of ${Object.keys(TYPES).join(", ")}`);
  process.exit(1);
}

ask(server, name, type)
  .then(({ res, raw, query, ms }) => {
    if (showHex) {
      console.log(`query    (${query.length} bytes): ${hex(query)}`);
      console.log(`response (${raw.length} bytes): ${hex(raw)}\n`);
    }
    const f = res.flags;
    console.log(`;; ${name} ${type} @${server}`);
    console.log(`;; status: ${f.rcode}, id: ${res.id}`);
    console.log(`;; flags: qr=${f.qr} aa=${f.aa} tc=${f.tc} rd=${f.rd} ra=${f.ra}${f.tc ? "  (TRUNCATED - real resolvers retry over TCP)" : ""}`);
    for (const section of ["answer", "authority", "additional"]) {
      if (!res[section].length) continue;
      console.log(`\n;; ${section.toUpperCase()} SECTION:`);
      res[section].forEach((r) => console.log(formatRecord(r)));
    }
    console.log(`\n;; query ${query.length} bytes, response ${raw.length} bytes, ${ms.toFixed(1)} ms over UDP`);
  })
  .catch((err) => console.error(err.message));
