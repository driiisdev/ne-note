// What TLS does with keys, without TLS: two parties agree on a shared secret over a channel
// an eavesdropper can read, then use it for fast symmetric encryption.
//
//   node key-exchange.js
//
// 1. (EC)DHE key exchange -> both sides compute the SAME secret; it never crosses the wire
// 2. derive a symmetric key from it (TLS uses HKDF too)
// 3. AES-256-GCM encrypts the actual data (confidentiality + tamper detection)
// 4. a signature proves who you're talking to (in TLS: server signs with its cert's private key)
const crypto = require("crypto");

console.log("== 1. ephemeral key exchange (X25519, what TLS 1.3 uses by default)");
const client = crypto.generateKeyPairSync("x25519");
const server = crypto.generateKeyPairSync("x25519");
const pub = (k) => k.publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("hex");
console.log(`   client sends public key: ${pub(client).slice(0, 32)}...   (eavesdropper sees this)`);
console.log(`   server sends public key: ${pub(server).slice(0, 32)}...   (eavesdropper sees this)`);

const clientSecret = crypto.diffieHellman({ privateKey: client.privateKey, publicKey: server.publicKey });
const serverSecret = crypto.diffieHellman({ privateKey: server.privateKey, publicKey: client.publicKey });
console.log(`   client computes secret : ${clientSecret.toString("hex").slice(0, 32)}...`);
console.log(`   server computes secret : ${serverSecret.toString("hex").slice(0, 32)}...`);
console.log(`   identical? ${clientSecret.equals(serverSecret)}  (and the secret itself was never sent)`);

console.log("\n== 2. derive a symmetric session key (HKDF-SHA256)");
const sessionKey = Buffer.from(crypto.hkdfSync("sha256", clientSecret, Buffer.alloc(0), "demo session key", 32));
console.log(`   session key: ${sessionKey.toString("hex").slice(0, 32)}...`);

console.log("\n== 3. symmetric encryption of application data (AES-256-GCM)");
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv("aes-256-gcm", sessionKey, iv);
const ciphertext = Buffer.concat([cipher.update("GET /account HTTP/1.1"), cipher.final()]);
const tag = cipher.getAuthTag();
console.log(`   on the wire : ${ciphertext.toString("hex")}`);

const decipher = crypto.createDecipheriv("aes-256-gcm", sessionKey, iv);
decipher.setAuthTag(tag);
console.log(`   server reads: ${Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString()}`);

const tampered = Buffer.from(ciphertext);
tampered[0] ^= 0xff; // an attacker flips some bits in transit
try {
  const d = crypto.createDecipheriv("aes-256-gcm", sessionKey, iv);
  d.setAuthTag(tag);
  Buffer.concat([d.update(tampered), d.final()]);
} catch {
  console.log("   tampered copy rejected: auth tag mismatch (GCM detects modification)");
}

console.log("\n== 4. authentication: why the exchange above isn't enough on its own");
console.log("   A man-in-the-middle could do step 1 separately with EACH side, using the attacker's own keys.");
console.log("   So in TLS the server SIGNS the handshake with its certificate's private key:");
const certKeys = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const transcript = Buffer.concat([Buffer.from(pub(client), "hex"), Buffer.from(pub(server), "hex")]);
const signature = crypto.sign("sha256", transcript, certKeys.privateKey);
console.log(`   server signature over the handshake: ${signature.toString("hex").slice(0, 32)}...`);
console.log(`   client verifies with the PUBLIC key from the server's certificate: ${crypto.verify("sha256", transcript, certKeys.publicKey, signature)}`);
console.log("   ...and trusts that public key only because a CA it trusts signed the certificate.");
