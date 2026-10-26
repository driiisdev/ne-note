# OSI Model

A 7-layer reference model for how network communication is divided into responsibilities. Each
layer provides a service to the one above it and relies on the one below, so you can swap one
layer (Wi-Fi for Ethernet, HTTP/2 for HTTP/1.1) without rewriting the others. Real stacks don't
implement OSI exactly, but its vocabulary ("an L4 load balancer", "an L7 firewall") is used
everywhere.

## The seven layers

| # | Layer | Job | Unit | Examples | Address |
| --- | --- | --- | --- | --- | --- |
| 7 | Application | what the app actually says | message | HTTP, DNS, SMTP, gRPC | URL, hostname |
| 6 | Presentation | encoding, compression, encryption | - | TLS*, JSON, gzip | - |
| 5 | Session | conversation setup/teardown | - | TLS sessions*, RPC sessions | - |
| 4 | Transport | process-to-process delivery | segment / datagram | TCP, UDP, QUIC | **port** |
| 3 | Network | host-to-host delivery across networks | packet | IP, ICMP | **IP address** |
| 2 | Data link | delivery on one local link | frame | Ethernet, Wi-Fi, ARP | **MAC address** |
| 1 | Physical | bits as signals | bit | copper, fibre, radio | - |

\* TLS doesn't fit neatly; it's usually described as sitting between L4 and L7.

## Encapsulation

On the way down, each layer wraps the data from the layer above with its own header:

```text
L7  [ HTTP request ]
L4  [ TCP hdr | HTTP request ]
L3  [ IP hdr | TCP hdr | HTTP request ]
L2  [ Eth hdr | IP hdr | TCP hdr | HTTP request | Eth trailer ]
```

On the way up at the receiver, each layer strips its header and hands the rest up. A router only
unwraps to L3 (to read the destination IP) and re-wraps L2 for the next hop; a switch only looks at
L2; an L7 proxy unwraps everything.

## The TCP/IP model

What the internet actually runs is the simpler 4-layer TCP/IP model: **Link** (L1-2),
**Internet** (L3), **Transport** (L4), **Application** (L5-7). OSI remains the common vocabulary
for talking about *which layer* a device or problem lives at.

## Why it matters in practice

- **Debugging bottom-up**: no link → no IP → no route → port closed → TLS fails → app error. The
  first failing layer is the bug.
- **Device capabilities**: a switch (L2) can't route between subnets; an L4 load balancer can't
  route by URL path; an L7 proxy can, but must terminate TLS to do it.
- **Where each address lives**: MAC (L2) changes every hop, IP (L3) stays end to end (unless NAT),
  ports (L4) identify the process.

🖼️ **osi model layers with encapsulation (headers added on the way down, removed on the way up)**
![osi model](<../../assets/img/osi-model.png>)

## Practice project

[`practice/fundamentals-of-networking/host-to-host`](../../practice/fundamentals-of-networking/host-to-host) -
prints this machine's L2 (MAC) and L3 (IP/subnet) identity, and a TCP server that logs the L4
4-tuple and the L7 command of every request.

## Related

- [Host to host communication](<host_to_host_communication.md>) - L2 and L3 working together.
- [IP packet](<../internet protocol/ip_packet.md>) - the L3 header in detail.
- [TCP segment](<../transmission control protocol/tcp_segment.md>) - the L4 header in detail.
- [Load balancing at layer 4 vs layer 7](<../network performance/load_balancing_at_layer4_vs_layer7.md>) -
  the OSI layers as a real routing decision.
