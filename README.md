# NE - Notes

Personal study notes for the **Fundamentals of Network Engineering** course: raw lecture notes
turned into proper write-ups, plus small hands-on projects for each concept, so the ideas stick
beyond reading about them. This is the companion to `be-note` (Fundamentals of Backend
Engineering) and follows the same layout. Where be-note asks "how does a backend use the
network?", this repo asks "what is the network actually doing?"

## How notes are organized

```text
concepts/
  <module name>/              <- matches a course section (e.g. "internet protocol")
    topic_name.txt            <- raw notes taken live, during the lecture
    topic_name.md             <- write-up: definition, how it works, where it's used,
                                 pros/cons, diagram callouts, links to related topics
practice/
  <module-name>/              <- kebab-case, these are project folders
    <project>/
      README.md               <- what it demonstrates, folder structure, code walkthrough
      ...code...
assets/
  img/                        <- diagrams and screenshots referenced from the .md write-ups
```

**Why a `.txt` *and* a `.md` for the same topic?** The `.txt` stays as the honest, messy,
in-the-moment note, which is good for review. The `.md` is the "I actually understand this now"
version, written after connecting the topic to how it's used in real networks. Each `.md` keeps
the same base name as its `.txt` (`osi_model.txt` → `osi_model.md`).

**Why do some `practice/` folders cover several topics at once?** Some concepts only make sense
next to each other. Flow control and congestion control are two answers to "when should a sender
slow down?" Nagle's algorithm and delayed ACK are only a problem *together*. All five Wireshark
lectures are the same skill applied to different protocols. Where that's true, one project covers
them side by side.

## Status

| Part | Status |
| --- | --- |
| `concepts/**/*.md` (write-ups) | **all 57 done**: written from scratch ahead of the lectures |
| `concepts/**/*.txt` (raw notes) | 57 files, **still empty**: filled in as lectures are watched |
| `practice/` | **24 projects across all 9 modules**: see the tables below |
| `assets/img/` | **empty**: the write-ups reference 56 diagram files to add (see [Images to add](#images-to-add)) |

The loop for each lecture: watch it with the `.md` open, drop your own raw notes into the matching
`.txt`, then fold anything the lecture added (or explained differently) back into the `.md`, and
run the linked practice project. The `practice/<module-name>` folder always matches its
`concepts/<module name>` folder, hyphenated instead of spaced, so the two are easy to find side by side.

## Modules

| # | Module | Topics | Practice projects |
| --- | --- | --- | --- |
| 1 | [Fundamentals of networking](<concepts/fundamentals of networking>) | 3 | 1 |
| 2 | [Internet protocol](<concepts/internet protocol>) | 7 | 2 |
| 3 | [User datagram protocol](<concepts/user datagram protocol>) | 6 | 1 |
| 4 | [Transmission control protocol](<concepts/transmission control protocol>) | 12 | 4 |
| 5 | [Overview of popular networking protocols](<concepts/overview of popular networking protocols>) | 4 | 2 |
| 6 | [Network performance](<concepts/network performance>) | 10 | 7 |
| 7 | [Network routing](<concepts/network routing>) | 2 | 1 |
| 8 | [Analyzing protocols with Wireshark](<concepts/analyzing protocols with wireshark>) | 5 | 1 |
| 9 | [Miscellaneous](<concepts/miscellaneous>) | 8 | 5 |

## Fundamentals of networking: topics

The vocabulary everything else uses: who talks to whom (client-server), how a conversation is
layered (OSI), and how one machine gets bytes to another (host to host).

| # | Topic | Note | Practice project |
| --- | --- | --- | --- |
| 1 | Client-server architecture | [client_server_architecture.md](<concepts/fundamentals of networking/client_server_architecture.md>) | [host-to-host](practice/fundamentals-of-networking/host-to-host) |
| 2 | OSI model | [osi_model.md](<concepts/fundamentals of networking/osi_model.md>) | [host-to-host](practice/fundamentals-of-networking/host-to-host) |
| 3 | Host to host communication | [host_to_host_communication.md](<concepts/fundamentals of networking/host_to_host_communication.md>) | [host-to-host](practice/fundamentals-of-networking/host-to-host) |

## Internet protocol: topics

Layer 3: addresses, subnets, the packet format, and the helper protocols (ARP, ICMP) that make
IP usable.

| # | Topic | Note | Practice project |
| --- | --- | --- | --- |
| 1 | The IP building blocks | [the_ip_building_blocks.md](<concepts/internet protocol/the_ip_building_blocks.md>) | [subnet-and-routing](practice/internet-protocol/subnet-and-routing) |
| 2 | IP packet | [ip_packet.md](<concepts/internet protocol/ip_packet.md>) | [ip-packet-inspector](practice/internet-protocol/ip-packet-inspector) |
| 3 | ICMP, ping, traceroute | [icmp_ping_traceroute.md](<concepts/internet protocol/icmp_ping_traceroute.md>) | [ip-packet-inspector](practice/internet-protocol/ip-packet-inspector) |
| 4 | ARP | [arp.md](<concepts/internet protocol/arp.md>) | [ip-packet-inspector](practice/internet-protocol/ip-packet-inspector) (+ [host-to-host](practice/fundamentals-of-networking/host-to-host)'s `next-hop.js`) |
| 5 | Capturing IP, ARP, ICMP with tcpdump | [capturing_ip_arp_icmp_packet_with_tcpdump.md](<concepts/internet protocol/capturing_ip_arp_icmp_packet_with_tcpdump.md>) | [ip-packet-inspector](practice/internet-protocol/ip-packet-inspector) (`capture.sh`) |
| 6 | Routing | [routing.md](<concepts/internet protocol/routing.md>) | [subnet-and-routing](practice/internet-protocol/subnet-and-routing) |
| 7 | Private IP addresses | [private_ip_addresses.md](<concepts/internet protocol/private_ip_addresses.md>) | [subnet-and-routing](practice/internet-protocol/subnet-and-routing) |

## User datagram protocol: topics

All six topics share one project, since the same echo server (in Node *and* C), the same client
and the same capture answer every one of them.

| # | Topic | Note | Practice project |
| --- | --- | --- | --- |
| 1 | UDP | [udp.md](<concepts/user datagram protocol/udp.md>) | [udp-echo](practice/user-datagram-protocol/udp-echo) |
| 2 | User datagram structure | [user_datagram_structure.md](<concepts/user datagram protocol/user_datagram_structure.md>) | [udp-echo](practice/user-datagram-protocol/udp-echo) |
| 3 | UDP pros & cons | [udp_pros_n_cos.md](<concepts/user datagram protocol/udp_pros_n_cos.md>) | [udp-echo](practice/user-datagram-protocol/udp-echo) (`lossy-relay.js`) |
| 4 | UDP server with JavaScript (Node.js) | [udp_server_with_javascript_using_nodejs.md](<concepts/user datagram protocol/udp_server_with_javascript_using_nodejs.md>) | [udp-echo](practice/user-datagram-protocol/udp-echo) (`server.js`) |
| 5 | UDP server with C | [udp_server_with_c.md](<concepts/user datagram protocol/udp_server_with_c.md>) | [udp-echo](practice/user-datagram-protocol/udp-echo) (`server.c`) |
| 6 | Capturing UDP traffic with tcpdump | [capturing_udp_traffic_with_tcpdump.md](<concepts/user datagram protocol/capturing_udp_traffic_with_tcpdump.md>) | [udp-echo](practice/user-datagram-protocol/udp-echo) (`capture.sh`) |

## Transmission control protocol: topics

The biggest module, split four ways: the basics and the wire format (`tcp-echo`), what the kernel
is doing (`sockets-and-queues`), how TCP decides how fast to send (`flow-and-congestion`), and the
middlebox that rewrites it all (`nat-simulator`).

| # | Topic | Note | Practice project |
| --- | --- | --- | --- |
| 1 | TCP | [tcp.md](<concepts/transmission control protocol/tcp.md>) | [tcp-echo](practice/transmission-control-protocol/tcp-echo) |
| 2 | TCP segment | [tcp_segment.md](<concepts/transmission control protocol/tcp_segment.md>) | [tcp-echo](practice/transmission-control-protocol/tcp-echo) |
| 3 | Flow control | [flow_control.md](<concepts/transmission control protocol/flow_control.md>) | [flow-and-congestion](practice/transmission-control-protocol/flow-and-congestion) |
| 4 | Congestion control | [congestion_control.md](<concepts/transmission control protocol/congestion_control.md>) | [flow-and-congestion](practice/transmission-control-protocol/flow-and-congestion) |
| 5 | Slow start vs congestion avoidance | [slow_start_vs_congestion_avoidance.md](<concepts/transmission control protocol/slow_start_vs_congestion_avoidance.md>) | [flow-and-congestion](practice/transmission-control-protocol/flow-and-congestion) (`cwnd-sim.js`) |
| 6 | NAT | [nat.md](<concepts/transmission control protocol/nat.md>) | [nat-simulator](practice/transmission-control-protocol/nat-simulator) |
| 7 | TCP connection states | [tcp_connection_states.md](<concepts/transmission control protocol/tcp_connection_states.md>) | [sockets-and-queues](practice/transmission-control-protocol/sockets-and-queues) (`state-tour.js`) |
| 8 | TCP pros & cons | [tcp_pros_n_cons.md](<concepts/transmission control protocol/tcp_pros_n_cons.md>) | [sockets-and-queues](practice/transmission-control-protocol/sockets-and-queues) (contrast with [udp-echo](practice/user-datagram-protocol/udp-echo)) |
| 9 | Sockets, connections & kernel queues | [sockets_connection_and_kernel_queues.md](<concepts/transmission control protocol/sockets_connection_and_kernel_queues.md>) | [sockets-and-queues](practice/transmission-control-protocol/sockets-and-queues) (`backlog-server.c`) |
| 10 | TCP server with JavaScript (Node.js) | [tcp_server_with_javascript_using_nodejs.md](<concepts/transmission control protocol/tcp_server_with_javascript_using_nodejs.md>) | [tcp-echo](practice/transmission-control-protocol/tcp-echo) (`server.js`) |
| 11 | TCP server with C | [tcp_server_with_c.md](<concepts/transmission control protocol/tcp_server_with_c.md>) | [tcp-echo](practice/transmission-control-protocol/tcp-echo) (`server.c`) |
| 12 | Capturing TCP segments with tcpdump | [capturing_tcp_segment_with_tcpdump.md](<concepts/transmission control protocol/capturing_tcp_segment_with_tcpdump.md>) | [tcp-echo](practice/transmission-control-protocol/tcp-echo) (`capture.sh`) |

## Overview of popular networking protocols: topics

The protocols every connection leans on before the "real" request is even sent: DNS to find the
server, and TLS to trust and encrypt it.

| # | Topic | Note | Practice project |
| --- | --- | --- | --- |
| 1 | Networking protocols introduction | [networking_protocols_introduction.md](<concepts/overview of popular networking protocols/networking_protocols_introduction.md>) | [dns-from-scratch](practice/overview-of-popular-networking-protocols/dns-from-scratch) (a protocol built from raw bytes) |
| 2 | DNS | [dns.md](<concepts/overview of popular networking protocols/dns.md>) | [dns-from-scratch](practice/overview-of-popular-networking-protocols/dns-from-scratch) |
| 3 | TLS | [tls.md](<concepts/overview of popular networking protocols/tls.md>) | [tls-handshake-lab](practice/overview-of-popular-networking-protocols/tls-handshake-lab) |
| 4 | HTTPS, TLS keys & certificates | [https_tls_keys_n_certificate.md](<concepts/overview of popular networking protocols/https_tls_keys_n_certificate.md>) | [tls-handshake-lab](practice/overview-of-popular-networking-protocols/tls-handshake-lab) (`key-exchange.js`) |

## Network performance: topics

Where milliseconds go: packet sizes, small-write stalls, round trips spent on setup, one lost
packet blocking everything, and the proxies and access rules that sit in every real path.

| # | Topic | Note | Practice project |
| --- | --- | --- | --- |
| 1 | MSS, MTU, PMTUD | [mss_mtu_pmtud.md](<concepts/network performance/mss_mtu_pmtud.md>) | [mtu-pmtud](practice/network-performance/mtu-pmtud) |
| 2 | Nagle's algorithm's effect on performance | [nagles_algorithms_effect_on_performance.md](<concepts/network performance/nagles_algorithms_effect_on_performance.md>) | [nagle-delayed-ack](practice/network-performance/nagle-delayed-ack) |
| 3 | Delayed acknowledgment's effect on performance | [delayed_acknowledgment_effect_on_performance.md](<concepts/network performance/delayed_acknowledgment_effect_on_performance.md>) | [nagle-delayed-ack](practice/network-performance/nagle-delayed-ack) |
| 4 | Cost of connection establishment | [cost_of_connection_establishment.md](<concepts/network performance/cost_of_connection_establishment.md>) | [connection-cost](practice/network-performance/connection-cost) |
| 5 | TCP Fast Open | [tcp_fast_open.md](<concepts/network performance/tcp_fast_open.md>) | [connection-cost](practice/network-performance/connection-cost) (simulated: `--tfo`) |
| 6 | Listening server | [listening_server.md](<concepts/network performance/listening_server.md>) | [listening-addresses](practice/network-performance/listening-addresses) |
| 7 | TCP head-of-line blocking | [tcp_head_of_line_blocking.md](<concepts/network performance/tcp_head_of_line_blocking.md>) | [hol-blocking-sim](practice/network-performance/hol-blocking-sim) (simulation) |
| 8 | The importance of proxies and reverse proxies | [the_importance_of_proxy_and_reverse_proxies.md](<concepts/network performance/the_importance_of_proxy_and_reverse_proxies.md>) | [proxy-l4-l7](practice/network-performance/proxy-l4-l7) (`forward-proxy.js`, `l7-proxy.js`) |
| 9 | Load balancing at layer 4 vs layer 7 | [load_balancing_at_layer4_vs_layer7.md](<concepts/network performance/load_balancing_at_layer4_vs_layer7.md>) | [proxy-l4-l7](practice/network-performance/proxy-l4-l7) |
| 10 | Network access control to database servers | [network_access_control_to_database_servers.md](<concepts/network performance/network_access_control_to_database_servers.md>) | [db-access-control](practice/network-performance/db-access-control) (Docker) |

## Network routing: topics

Both topics share one lab, because Docker is the cheapest way to build a real routed network on
a laptop, and building one is the best way to understand Docker's own networking.

| # | Topic | Note | Practice project |
| --- | --- | --- | --- |
| 1 | Fundamentals of network routing | [fundamentals_of_network_routing.md](<concepts/network routing/fundamentals_of_network_routing.md>) | [docker-router-lab](practice/network-routing/docker-router-lab) |
| 2 | Networking with Docker | [networking_with_docker.md](<concepts/network routing/networking_with_docker.md>) | [docker-router-lab](practice/network-routing/docker-router-lab) |

## Analyzing protocols with Wireshark: topics

One lab with five traffic generators, each built so there's something specific to find in the
capture.

| # | Topic | Note | Practice project |
| --- | --- | --- | --- |
| 1 | Wiresharking UDP | [wiresharking_udp.md](<concepts/analyzing protocols with wireshark/wiresharking_udp.md>) | [capture-lab](practice/analyzing-protocols-with-wireshark/capture-lab) (lab 1) |
| 2 | Wiresharking TCP/HTTP | [wiresharking_tcp-http.md](<concepts/analyzing protocols with wireshark/wiresharking_tcp-http.md>) | [capture-lab](practice/analyzing-protocols-with-wireshark/capture-lab) (lab 2) |
| 3 | Wiresharking HTTP/2 (decrypting TLS) | [wiresharking_http-2(decrypting_tls).md](<concepts/analyzing protocols with wireshark/wiresharking_http-2(decrypting_tls).md>) | [capture-lab](practice/analyzing-protocols-with-wireshark/capture-lab) (lab 3) |
| 4 | Wiresharking MongoDB | [wiresharking_mongodb.md](<concepts/analyzing protocols with wireshark/wiresharking_mongodb.md>) | [capture-lab](practice/analyzing-protocols-with-wireshark/capture-lab) (lab 4) |
| 5 | Wiresharking server-sent events | [wiresharking_server_sent_events.md](<concepts/analyzing protocols with wireshark/wiresharking_server_sent_events.md>) | [capture-lab](practice/analyzing-protocols-with-wireshark/capture-lab) (lab 5) |

## Miscellaneous: topics

Real-world case studies and "how does this actually work" questions. Each stands alone and is
best read once the module it leans on has clicked.

| # | Topic | Note | Practice project |
| --- | --- | --- | --- |
| 1 | Should layer 4 proxies buffer segments? | [should_layer_4_proxies_buffer_segments.md](<concepts/miscellaneous/should_layer_4_proxies_buffer_segments.md>) | [l4-proxy-buffering](practice/miscellaneous/l4-proxy-buffering) |
| 2 | How does the kernel manage TCP connections? | [how_does_the_kernel_manage_tcp_connections.md](<concepts/miscellaneous/how_does_the_kernel_manage_tcp_connections.md>) | [kernel-tcp-lab](practice/miscellaneous/kernel-tcp-lab) (+ [sockets-and-queues](practice/transmission-control-protocol/sockets-and-queues)) |
| 3 | Exposing local servers publicly | [exposing_local_servers_publicly.md](<concepts/miscellaneous/exposing_local_servers_publicly.md>) | [expose-local-server](practice/miscellaneous/expose-local-server) |
| 4 | The networking behind clicking a link | [the_networking_behind_clicking_a_link.md](<concepts/miscellaneous/the_networking_behind_clicking_a_link.md>) | [clicking-a-link](practice/miscellaneous/clicking-a-link) |
| 5 | What is SNI? (Server Name Indication) | [what_is_sni_(server_name_indication_tls_extension).md](<concepts/miscellaneous/what_is_sni_(server_name_indication_tls_extension).md>) | [sni-router](practice/miscellaneous/sni-router) |
| 6 | Replacing TCP for data centers | [replacing_tcp_for_data_centers.md](<concepts/miscellaneous/replacing_tcp_for_data_centers.md>) | - (conceptual: datacenter transports like Homa need custom kernels/NICs. Revisit [hol-blocking-sim](practice/network-performance/hol-blocking-sim) and [flow-and-congestion](practice/transmission-control-protocol/flow-and-congestion) for the TCP behaviors they replace) |
| 7 | Running out of TCP source ports | [running_out_of_tcp_source_ports.md](<concepts/miscellaneous/running_out_of_tcp_source_ports.md>) | [kernel-tcp-lab](practice/miscellaneous/kernel-tcp-lab) (`ephemeral-ports.js`) |
| 8 | Postgres failure caused by a Cisco router (TCP issue) | [postgres_failure_caused_by_a_cisco_router_(tcp_issue).md](<concepts/miscellaneous/postgres_failure_caused_by_a_cisco_router_(tcp_issue).md>) | [kernel-tcp-lab](practice/miscellaneous/kernel-tcp-lab) (`idle-killer-proxy.js`, + [nat-simulator](practice/transmission-control-protocol/nat-simulator)) |

## Learning roadmap

A suggested order, based on what depends on what rather than strictly the course's lecture
order. Each step links the write-ups to read and the project to run alongside them.

1. **The mental model**:
   [client-server architecture](<concepts/fundamentals of networking/client_server_architecture.md>) →
   [OSI model](<concepts/fundamentals of networking/osi_model.md>) →
   [host to host communication](<concepts/fundamentals of networking/host_to_host_communication.md>).
   Run [host-to-host](practice/fundamentals-of-networking/host-to-host) and see every layer's
   address on your own machine.
2. **Addressing before anything moves**:
   [IP building blocks](<concepts/internet protocol/the_ip_building_blocks.md>) →
   [private IP addresses](<concepts/internet protocol/private_ip_addresses.md>) →
   [routing](<concepts/internet protocol/routing.md>). Do the arithmetic by hand with
   [subnet-and-routing](practice/internet-protocol/subnet-and-routing) until a `/26` or a
   longest-prefix match is something you compute, not look up.
3. **What a packet really is**:
   [IP packet](<concepts/internet protocol/ip_packet.md>) →
   [ARP](<concepts/internet protocol/arp.md>) →
   [ICMP, ping, traceroute](<concepts/internet protocol/icmp_ping_traceroute.md>) →
   [capturing with tcpdump](<concepts/internet protocol/capturing_ip_arp_icmp_packet_with_tcpdump.md>).
   Decode real bytes with [ip-packet-inspector](practice/internet-protocol/ip-packet-inspector).
   **Start capturing now**: install Wireshark and keep it open for the rest of the course
   ([Wiresharking UDP](<concepts/analyzing protocols with wireshark/wiresharking_udp.md>) and labs
   1-2 of [capture-lab](practice/analyzing-protocols-with-wireshark/capture-lab) fit here).
4. **The simple transport**: [UDP](<concepts/user datagram protocol/udp.md>) →
   [its 8-byte header](<concepts/user datagram protocol/user_datagram_structure.md>) →
   [pros and cons](<concepts/user datagram protocol/udp_pros_n_cos.md>) → servers in
   [Node](<concepts/user datagram protocol/udp_server_with_javascript_using_nodejs.md>) and
   [C](<concepts/user datagram protocol/udp_server_with_c.md>). It's small enough to understand
   completely, and its *missing* guarantees are the best introduction to TCP. Run
   [udp-echo](practice/user-datagram-protocol/udp-echo) through the lossy relay.
5. **The reliable transport**: [TCP](<concepts/transmission control protocol/tcp.md>) →
   [TCP segment](<concepts/transmission control protocol/tcp_segment.md>) → servers in
   [Node](<concepts/transmission control protocol/tcp_server_with_javascript_using_nodejs.md>) and
   [C](<concepts/transmission control protocol/tcp_server_with_c.md>), with
   [tcp-echo](practice/transmission-control-protocol/tcp-echo). Then what the kernel does
   underneath: [connection states](<concepts/transmission control protocol/tcp_connection_states.md>)
   and [sockets and kernel queues](<concepts/transmission control protocol/sockets_connection_and_kernel_queues.md>),
   with [sockets-and-queues](practice/transmission-control-protocol/sockets-and-queues). Close with
   [TCP pros and cons](<concepts/transmission control protocol/tcp_pros_n_cons.md>).
6. **How fast to send**: [flow control](<concepts/transmission control protocol/flow_control.md>)
   (protecting the receiver) vs. [congestion control](<concepts/transmission control protocol/congestion_control.md>)
   (protecting the network), and [slow start vs. congestion avoidance](<concepts/transmission control protocol/slow_start_vs_congestion_avoidance.md>),
   in [flow-and-congestion](practice/transmission-control-protocol/flow-and-congestion).
7. **The box that rewrites everything**: [NAT](<concepts/transmission control protocol/nat.md>).
   It needs step 2's private ranges and step 5's ports, and it sets up the silent-failure stories
   in step 13. [nat-simulator](practice/transmission-control-protocol/nat-simulator).
8. **The protocols every connection needs first**:
   [protocols introduction](<concepts/overview of popular networking protocols/networking_protocols_introduction.md>) →
   [DNS](<concepts/overview of popular networking protocols/dns.md>) (over UDP, from step 4) →
   [TLS](<concepts/overview of popular networking protocols/tls.md>) →
   [keys and certificates](<concepts/overview of popular networking protocols/https_tls_keys_n_certificate.md>)
   (over TCP, from step 5).
   [dns-from-scratch](practice/overview-of-popular-networking-protocols/dns-from-scratch) →
   [tls-handshake-lab](practice/overview-of-popular-networking-protocols/tls-handshake-lab). Then
   [decrypt your own TLS](<concepts/analyzing protocols with wireshark/wiresharking_http-2(decrypting_tls).md>)
   in lab 3 of the capture lab.
9. **Where latency comes from**: [MTU/MSS/PMTUD](<concepts/network performance/mss_mtu_pmtud.md>) →
   [Nagle](<concepts/network performance/nagles_algorithms_effect_on_performance.md>) +
   [delayed ACK](<concepts/network performance/delayed_acknowledgment_effect_on_performance.md>) →
   [connection setup cost](<concepts/network performance/cost_of_connection_establishment.md>) and
   [TFO](<concepts/network performance/tcp_fast_open.md>) →
   [head-of-line blocking](<concepts/network performance/tcp_head_of_line_blocking.md>). Each one
   is a TCP mechanism from steps 5-6 seen from a performance angle:
   [mtu-pmtud](practice/network-performance/mtu-pmtud),
   [nagle-delayed-ack](practice/network-performance/nagle-delayed-ack),
   [connection-cost](practice/network-performance/connection-cost),
   [hol-blocking-sim](practice/network-performance/hol-blocking-sim).
10. **What sits between client and server**:
    [listening server](<concepts/network performance/listening_server.md>) →
    [proxies and reverse proxies](<concepts/network performance/the_importance_of_proxy_and_reverse_proxies.md>) →
    [L4 vs. L7 load balancing](<concepts/network performance/load_balancing_at_layer4_vs_layer7.md>) →
    [locking down the database](<concepts/network performance/network_access_control_to_database_servers.md>).
    [listening-addresses](practice/network-performance/listening-addresses) →
    [proxy-l4-l7](practice/network-performance/proxy-l4-l7) →
    [db-access-control](practice/network-performance/db-access-control).
11. **Routing for real**: [fundamentals of network routing](<concepts/network routing/fundamentals_of_network_routing.md>) and
    [networking with Docker](<concepts/network routing/networking_with_docker.md>). Build a
    two-subnet network with a router you control, then break it on purpose:
    [docker-router-lab](practice/network-routing/docker-router-lab).
12. **Protocol analysis as a skill**: [TCP/HTTP](<concepts/analyzing protocols with wireshark/wiresharking_tcp-http.md>),
    [MongoDB](<concepts/analyzing protocols with wireshark/wiresharking_mongodb.md>) and
    [SSE](<concepts/analyzing protocols with wireshark/wiresharking_server_sent_events.md>) in
    Wireshark, finishing the [capture-lab](practice/analyzing-protocols-with-wireshark/capture-lab).
    By now you should be able to point Wireshark at any protocol and explain each packet.
13. **Case studies, in any order**: each one ties several modules together.
    [Clicking a link](<concepts/miscellaneous/the_networking_behind_clicking_a_link.md>) uses all of
    them at once. [SNI](<concepts/miscellaneous/what_is_sni_(server_name_indication_tls_extension).md>)
    comes after step 8, [proxy buffering](<concepts/miscellaneous/should_layer_4_proxies_buffer_segments.md>)
    after step 10, [exposing local servers](<concepts/miscellaneous/exposing_local_servers_publicly.md>)
    after step 7, and [the kernel's view](<concepts/miscellaneous/how_does_the_kernel_manage_tcp_connections.md>),
    [port exhaustion](<concepts/miscellaneous/running_out_of_tcp_source_ports.md>) and
    [the Cisco-router story](<concepts/miscellaneous/postgres_failure_caused_by_a_cisco_router_(tcp_issue).md>)
    after steps 5 and 7. Finish with
    [replacing TCP for data centers](<concepts/miscellaneous/replacing_tcp_for_data_centers.md>),
    which questions everything steps 5-9 took for granted.

## Best practices for learning network engineering fundamentals

- **Think in layers, debug bottom-up.** "The site is down" becomes: is there a link? an IP? a
  route (`ping`, `traceroute`)? Does the name resolve (`dig`)? Does the port accept
  (`nc -vz`, `ss`)? Does TLS succeed (`openssl s_client`)? Does the app answer (`curl -v`)? The
  first layer that fails is your bug.
- **Capture before you guess.** A packet capture settles arguments that logs can't: who sent
  the RST, whether the SYN-ACK came back, how long the gap before the ACK was. Make
  `tcpdump`/Wireshark a habit, not a last resort.
- **Know the numbers by heart.** MTU 1500 / MSS 1460, ephemeral ports ~16-28K, `TIME_WAIT`
  60-120 s, delayed ACK 40 ms (Linux) / 200 ms (Windows), TCP keepalive 2 h default, 1 RTT per
  TCP handshake, 1-2 more for TLS, ~1 ms of RTT per 100 km of fibre. Most performance mysteries
  turn out to be one of these.
- **Every connection is state in many places.** Two kernels, every NAT, firewall and load
  balancer in between: each holds its own idea of the connection, and they can disagree
  silently (see `kernel-tcp-lab`).
- **Don't trust localhost.** Loopback has no loss, no latency, a 64 KB MTU, and on Windows a
  fast path that skips half of TCP. Whenever a concept depends on the real network, simulate it
  (`lossy-relay.js`, `latency-proxy.js`) or use a second machine or VM.
- **Ask the same three questions of every protocol:** what happens on loss, who holds state,
  and what does setup cost in round trips. They predict most of the trade-offs in this course.
- **Be secure by default.** Bind to the narrowest address, publish the fewest ports, allow the
  fewest sources, and encrypt anyway. Network controls and authentication are layers, not
  alternatives.
- **Write the note after you've seen it on the wire.** A write-up of "the three-way handshake"
  gets much sharper once you've looked at the actual SYN, SYN-ACK and ACK with their sequence
  numbers.

## Practice projects

Most projects use **plain Node.js core modules only** (`net`, `dgram`, `http`, `http2`, `https`,
`tls`, `dns`, `crypto`, `child_process`), so there's no `npm install` and nothing between you and
the concept. They require Node.js 18+. The course also covers C, tcpdump, Wireshark and Docker,
so some projects need extra tools:

| Tool | Needed by | On Windows |
| --- | --- | --- |
| Node.js 18+ | almost everything | native |
| `gcc` | `server.c` in [udp-echo](practice/user-datagram-protocol/udp-echo) and [tcp-echo](practice/transmission-control-protocol/tcp-echo), `backlog-server.c` in [sockets-and-queues](practice/transmission-control-protocol/sockets-and-queues) | WSL (POSIX sockets) |
| `tcpdump` | every `capture.sh` | WSL, or use Wireshark instead |
| Wireshark | [capture-lab](practice/analyzing-protocols-with-wireshark/capture-lab) | native, with Npcap for loopback |
| `openssl` | `generate-cert*.sh` in tls-handshake-lab, capture-lab, sni-router | WSL or Git Bash |
| Docker | [db-access-control](practice/network-performance/db-access-control), [docker-router-lab](practice/network-routing/docker-router-lab), capture-lab's MongoDB | Docker Desktop |
| Internet access | dns-from-scratch, mtu-pmtud, clicking-a-link | - |

```bash
cd practice/<module-name>/<project>
node server.js        # most projects: a server...
node client.js        # ...and a client in a second terminal
```

Projects that work differently (each README has the details):

- **Single-command demos** with no second terminal: `nat-simulator`, `cwnd-sim.js`,
  `hol-blocking-sim`, `state-tour.js`, `subnet-calc.js` / `route-lookup.js`, `parse-packet.js`,
  `dns-query.js` / `dns-trace.js`, `key-exchange.js`, `pmtud.js`, `ephemeral-ports.js`,
  `link-timeline.js`.
- **Simulations rather than the real thing**, where the real thing can't be reproduced on a
  laptop: `hol-blocking-sim` (deterministic loss), `cwnd-sim.js` (congestion window),
  `nat-simulator` (NAT table logic), and TCP Fast Open in `connection-cost` (no portable TFO
  socket API in Node). Each README says so explicitly.
- **Network simulators that make localhost honest**: `lossy-relay.js` (loss and reordering for
  UDP), `latency-proxy.js` (RTT, including handshake cost), `idle-killer-proxy.js` (a middlebox
  that silently evicts idle connections).
- **[nagle-delayed-ack](practice/network-performance/nagle-delayed-ack) needs a real network
  hop.** On loopback the stall doesn't appear. Windows → WSL showed **47.6 ms vs. 0.46 ms** per
  request (Nagle on vs. off).
- **Not run yet:** both Docker labs and the MongoDB part of the capture lab were written while
  Docker was unavailable. Their compose files pass `docker compose config`, and the MongoDB
  client's BSON encoding was checked byte-for-byte against the spec, but their "what you should
  see" sections describe *expected* output rather than a captured run.

Every other project was run while it was written, on Windows 11 with Node 18 (C servers in WSL
Ubuntu), and the output shown in its README is real.

Each project's `README.md` covers: what it demonstrates, the folder structure, how to run it,
real output, a code walkthrough with the concept called out inline, 🖼️ image suggestions for
diagrams worth drawing, "try this yourself" experiments, and the real-world technology it stands
in for.
