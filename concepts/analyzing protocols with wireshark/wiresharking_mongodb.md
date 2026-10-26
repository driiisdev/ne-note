# Wiresharking MongoDB

Database protocols are just application protocols over TCP - and capturing one shows exactly what
a driver sends for each query, how many round trips an operation costs, and how messages are framed.
MongoDB's wire protocol is a good example: binary, length-prefixed, carrying **BSON** documents.

## The wire protocol

Every message starts with a 16-byte header (little-endian int32s):

```text
messageLength | requestID | responseTo | opCode
```

- **messageLength** frames the message on the TCP stream (includes the header itself).
- **requestID** / **responseTo** pair requests with replies.
- **opCode 2013 = OP_MSG** - the only opcode modern servers use for commands. (Legacy OP_QUERY = 2004,
  OP_REPLY = 1; OP_COMPRESSED = 2012 when compression is on.)

OP_MSG body: `flagBits` (uint32), then sections - kind 0 is one BSON document: the command itself,
e.g. `{ find: "notes", filter: { topic: "tcp" }, $db: "course" }`; kind 1 is a document sequence
(used for bulk inserts).

## BSON in one paragraph

Binary JSON: a document is `int32 total size`, then elements `type byte | key (C string) | value`,
then a `0` terminator. Types include double (0x01), string (0x02), embedded doc (0x03), array (0x04,
a doc keyed "0", "1", ...), ObjectId (0x07), bool (0x08), date (0x09), null (0x0A), int32 (0x10),
int64 (0x12).

## In Wireshark

- Filter: `mongo` (or `tcp.port == 27017`); fields like `mongo.opcode`, `mongo.request_id`,
  `mongo.response_to`.
- The dissector decodes each section's BSON into a tree - command name, filter, documents, and in
  replies `cursor.firstBatch`, `ok`, `n`.
- Typical connection start: a `hello` (formerly `isMaster`) handshake, then authentication (SCRAM
  messages), then your commands.
- Watch for: round trips per operation, `getMore` calls when results exceed a batch, and
  **OP_COMPRESSED** or **TLS** making payloads unreadable.

🖼️ **wireshark showing an op_msg find command with the bson tree expanded, and the reply's firstBatch**
![wireshark mongodb](<../../assets/img/wireshark-mongodb.png>)

## Practice project

[`practice/analyzing-protocols-with-wireshark/capture-lab`](../../practice/analyzing-protocols-with-wireshark/capture-lab) -
lab 4: `mongo-wire-client.js` speaks OP_MSG with hand-encoded BSON (no driver), so every field
Wireshark shows maps to a line of code. Needs MongoDB (e.g. `docker run -p 27017:27017 mongo:7`).

## Related

- [Networking protocols introduction](<../overview of popular networking protocols/networking_protocols_introduction.md>) -
  framing and message formats.
- [TCP](<../transmission control protocol/tcp.md>) - why the length prefix is needed.
- [Network access control to database servers](<../network performance/network_access_control_to_database_servers.md>).
