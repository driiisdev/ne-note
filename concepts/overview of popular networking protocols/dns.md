# DNS (Domain Name System)

The internet's distributed, hierarchical, heavily cached phonebook: it turns names like
`www.github.com` into records such as IP addresses. Almost every connection starts with a DNS
lookup, so DNS latency and failures show up everywhere.

## The hierarchy

```text
.                      root (13 named root server identities, anycast worldwide)
└── com                TLD servers (run by the registry)
    └── github.com     authoritative servers (run by the domain owner / DNS provider)
        └── www.github.com
```

Each level **delegates** the next level down with NS records.

## Resolution

1. Your app asks the OS **stub resolver**, which checks its cache and then asks a **recursive
   resolver** (your router, ISP, `1.1.1.1`, `8.8.8.8`) with **RD=1** ("recursion desired").
2. On a cache miss, the recursive resolver walks the tree **iteratively** (RD=0):
   - asks a **root** server → referral to the `.com` servers,
   - asks a **TLD** server → referral to `github.com`'s name servers (with **glue** IPs),
   - asks the **authoritative** server → the answer.
3. Every answer carries a **TTL**; each level caches it for that long. Most lookups are cache hits.

## Common record types

| Type | Holds |
| --- | --- |
| `A` / `AAAA` | IPv4 / IPv6 address |
| `CNAME` | alias to another name |
| `NS` | name servers for a zone (delegation) |
| `MX` | mail servers, with priority |
| `TXT` | free text - SPF, DKIM, domain verification |
| `SOA` | zone metadata; also returned with NXDOMAIN for negative caching |
| `PTR` | reverse lookup (IP → name) |

## On the wire

- **UDP port 53**, one query and one answer per datagram - no handshake. Falls back to **TCP** when
  the answer is truncated (`TC` flag) and for zone transfers.
- 12-byte header: ID (matches answer to query), flags (QR, AA, TC, RD, RA, RCODE), section counts;
  then question, answer, authority, additional sections. Names are length-prefixed labels with
  **compression pointers**.
- Plain DNS is unencrypted and spoofable: **DoT** (TLS, port 853), **DoH** (HTTPS) and **DNSSEC**
  (signed records) address privacy and integrity.

## Operational gotchas

Stale caches after changing a record (lower TTLs before migrations), negative caching of NXDOMAIN,
DNS-based load balancing returning different IPs per query, and resolver outages taking "the
whole internet" down.

🖼️ **dns resolution tree: client → recursive resolver → root → tld → authoritative, with numbered steps and caches**
![dns resolution](<../../assets/img/dns-resolution.png>)

## Practice project

[`practice/overview-of-popular-networking-protocols/dns-from-scratch`](../../practice/overview-of-popular-networking-protocols/dns-from-scratch) -
`dns-query.js` (a tiny `dig`, hand-built packets) and `dns-trace.js` (iterative resolution from a root server).

## Related

- [UDP](<../user datagram protocol/udp.md>) - DNS's transport.
- [The networking behind clicking a link](<../miscellaneous/the_networking_behind_clicking_a_link.md>) - DNS as step one.
- [Capturing UDP traffic with tcpdump](<../user datagram protocol/capturing_udp_traffic_with_tcpdump.md>).
