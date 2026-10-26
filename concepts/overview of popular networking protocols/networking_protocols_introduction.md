# Networking Protocols Introduction

A **protocol** is an agreed format plus rules for a conversation: what bytes mean, who speaks
first, what a valid reply looks like, and what happens on errors. Networks work because every
device and program on the path agrees on the protocols at each layer - and because protocols are
stacked, each one only has to solve its own problem.

## What every protocol defines

- **Message format**: binary headers with fixed offsets (IP, TCP, DNS) or text (HTTP/1.1, SMTP).
- **Framing**: how the receiver knows where a message ends - fixed size, length prefix,
  delimiter (`\r\n\r\n`), or the transport's own boundaries (UDP datagrams).
- **Semantics**: request/response, streaming, push, pub/sub.
- **State**: stateless (every message stands alone, like DNS queries) or stateful (sessions,
  connections, handshakes).
- **Error handling and timeouts**: retries, status codes, error messages.
- **Transport choice**: TCP for reliability, UDP for latency or single-packet exchanges, QUIC for both.

## The stack you'll meet in this course

```text
Application   HTTP/1.1  HTTP/2  HTTP/3  DNS  gRPC  SSE  WebSocket  MongoDB wire  Postgres wire
Security      TLS (over TCP)                      QUIC has TLS 1.3 built in
Transport     TCP                     UDP         QUIC (over UDP)
Network       IP (v4 / v6) + ICMP
Link          Ethernet / Wi-Fi + ARP
```

## Properties worth comparing between protocols

| Property | Example question |
| --- | --- |
| Round trips to first useful byte | TCP 1, TLS 1.3 +1, DNS 1 (UDP), QUIC 1 (0 on resumption) |
| Head-of-line blocking | HTTP/1.1 per connection, HTTP/2 at the TCP layer, HTTP/3 none across streams |
| Text vs binary | HTTP/1.1 readable on the wire; HTTP/2 framed binary |
| Who can initiate | request/response (HTTP) vs server push (SSE, WebSocket) |
| Encryption | optional (HTTP), mandatory (HTTP/3, QUIC) |

## How to learn a new protocol quickly

1. Find its message format (RFC or spec) and how messages are framed.
2. Capture it (`tcpdump`/Wireshark) and map the bytes to the spec.
3. Write a tiny client by hand - it forces you to understand every field.

🖼️ **protocol stack diagram: application protocols over tls / tcp / udp / quic over ip**
![protocol stack](<../../assets/img/protocol-stack.png>)

## Practice project

[`practice/overview-of-popular-networking-protocols/dns-from-scratch`](../../practice/overview-of-popular-networking-protocols/dns-from-scratch) -
a real protocol implemented from raw bytes, end to end.

## Related

- [DNS](<dns.md>), [TLS](<tls.md>), [HTTPS, TLS keys and certificates](<https_tls_keys_n_certificate.md>).
- [OSI model](<../fundamentals of networking/osi_model.md>) - the layers protocols sit at.
- [Wiresharking MongoDB](<../analyzing protocols with wireshark/wiresharking_mongodb.md>) - another
  protocol decoded from the wire.
