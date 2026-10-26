# Practice: DNS From Scratch

Concept notes: [`dns.md`](<../../../concepts/overview of popular networking protocols/dns.md>) ·
[`networking_protocols_introduction.md`](<../../../concepts/overview of popular networking protocols/networking_protocols_introduction.md>)

## What this demonstrates

DNS without a library: the query is built byte by byte, sent as a single UDP datagram, and the
answer is decoded byte by byte. There are two tools:

- **`dns-query.js`**: a tiny `dig`. It sends one *recursive* query (RD=1) to a resolver like
  `1.1.1.1` and prints the answer, authority and additional sections.
- **`dns-trace.js`**: does what that resolver does on a cache miss. It starts at a **root
  server** and follows **referrals** down the tree (`.` → `com` → `github.com`), one non-recursive
  query at a time.

## Folder structure

```text
dns-from-scratch/
  dns-wire.js    <- buildQuery / parseResponse / ask: the RFC 1035 wire format
  dns-query.js   <- node dns-query.js <name> [type] [server] [--hex]
  dns-trace.js   <- node dns-trace.js <name> [type]
```

Supported record types: `A`, `AAAA`, `CNAME`, `NS`, `MX`, `TXT`, `SOA`.

## Run it

```bash
node dns-query.js www.github.com
node dns-query.js gmail.com MX 8.8.8.8
node dns-query.js example.com A 1.1.1.1 --hex
node dns-query.js doesnotexist-xyz123.com      # NXDOMAIN + the zone's SOA

node dns-trace.js www.github.com
node dns-trace.js en.wikipedia.org             # follows a CNAME and restarts the walk
```

These need internet access. UDP port 53 must be allowed outbound, which some corporate networks
block.

## What you'll see

```text
;; www.github.com A @1.1.1.1
;; status: NOERROR, id: 58219
;; flags: qr=1 aa=0 tc=0 rd=1 ra=1

;; ANSWER SECTION:
www.github.com                 2841  IN  CNAME github.com
github.com                       38  IN  A     140.82.112.4

;; query 32 bytes, response 62 bytes, 29.8 ms over UDP
```

```text
[1] ask a.root-servers.net (198.41.0.4) for www.github.com A  ->  NOERROR, 50ms
    referral: zone "com" is served by l.gtld-servers.net, j.gtld-servers.net, ...
[2] ask l.gtld-servers.net (192.41.162.30) for www.github.com A  ->  NOERROR, 180ms
    referral: zone "github.com" is served by ns-520.awsdns-01.net, ns-421.awsdns-52.com, ...
[3] ask ns-421.awsdns-52.com (205.251.193.165) for www.github.com A  ->  NOERROR, 25ms
    www.github.com                 3600  IN  CNAME github.com
    github.com                       60  IN  A     140.82.112.4
```

Look at the TTLs. The authoritative server says `3600` for the CNAME, while `1.1.1.1` said
`2841`. The resolver had cached it 759 seconds earlier and is counting down.

> 🖼️ **Image suggestion:** the DNS resolution tree. A client asks a recursive resolver, which
> asks root → TLD (`.com`) → authoritative (`github.com`) and caches each step. Number the arrows
> to match `dns-trace.js`'s `[1] [2] [3]`.

## Code walkthrough

**A name on the wire is length-prefixed labels**, with no dots:

```text
www.github.com  ->  03 77 77 77  06 67 69 74 68 75 62  03 63 6f 6d  00
                     3  w  w  w   6  g  i  t  h  u  b   3  c  o  m  (end)
```

**Compression pointers.** In `--hex` output, the answer section uses `c0 0c` where the name
should be. A byte with the top two bits set means "the name continues at offset `0x00c`," which
is where the question's name starts. Every repeated name in a response shrinks to 2 bytes:

```js
if ((len & 0xc0) === 0xc0) {
  offset = buf.readUInt16BE(offset) & 0x3fff; // jump to the earlier copy
  ...
}
```

**RD (Recursion Desired) is the difference between the two tools.** `dns-query.js` sets RD=1,
which means "resolver, do the whole walk for me." `dns-trace.js` sends RD=0 to each server,
which means "just tell me what *you* know." Root and TLD servers only ever answer with
**referrals**: an empty answer section plus NS records in the authority section.

**Glue records.** The `.com` servers refer you to `ns-421.awsdns-52.com`, but to ask that server
you need its IP, which is itself a DNS lookup. The referral's *additional* section usually
includes the IP (the "glue"), and the trace uses it to skip that lookup.

**ID matching is a (weak) security check.** The client picks a random 16-bit ID and ignores any
answer without it. Cache-poisoning attacks work by guessing it, which is why resolvers also
randomize the source port.

## DNS on the wire, in brief

| | |
| --- | --- |
| Transport | UDP port 53, with a TCP fallback when the answer is too big (`tc=1`) and for zone transfers |
| Header | 12 bytes: ID, flags (QR, AA, TC, RD, RA, RCODE), 4 section counts |
| Caching | every record has a TTL; resolvers cache and count down |
| Encrypted variants | DoT (DNS over TLS, port 853) and DoH (DNS over HTTPS). Plain DNS is visible to everyone on the path |

## Try this yourself

- Run `dns-query.js` with `--hex` and find each header field in the raw bytes. `8180` in the
  response flags means QR=1, RD=1, RA=1.
- Capture while you query: `sudo tcpdump -i any -n -X udp port 53`, or filter on `dns` in
  Wireshark. Your hand-built packet should decode cleanly in Wireshark's DNS dissector, which
  proves the bytes are right.
- Query the same name twice against `1.1.1.1` and compare TTLs and timing. The second answer
  comes from cache and is often faster.
- Add `PTR` support (reverse DNS): query `4.112.82.140.in-addr.arpa` for the IP
  `140.82.112.4`.

## Real-world equivalent

Every connection to a hostname starts with this exchange, usually through your OS's stub
resolver to your router or ISP's resolver. When "the site is down," the cause is often stale
DNS: a cached TTL pointing at an old IP, or an NXDOMAIN from a misconfigured zone. `dig` and
`dns-trace.js` are how you tell those apart from a real outage.
