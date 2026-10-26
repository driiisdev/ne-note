# Replacing TCP for Data Centers

TCP was designed for the wide-area internet of the 1980s: unknown paths, long and variable RTTs,
long-lived byte streams. Inside a modern data center the conditions are almost the opposite - and
researchers (notably John Ousterhout's paper *"It's Time to Replace TCP in the Datacenter"*, 2022,
proposing **Homa**) argue TCP's core design choices now cost latency and efficiency there.

## Why the data center is different

- RTTs of **a few microseconds** and 100-400 Gbit/s links - software overhead dominates, not distance.
- Traffic is mostly **RPCs**: huge numbers of small, short messages between services, plus some
  large transfers.
- One operator controls every host and switch, so new protocols *can* actually be deployed.

## TCP's problems there

- **Stream orientation**: TCP carries byte streams, not messages. RPC systems rebuild message
  boundaries on top, and one connection's messages suffer **head-of-line blocking** behind each other.
- **Connection orientation**: per-connection state and handshakes; servers talking to thousands of
  peers keep thousands of connections.
- **Sender-driven congestion control**: senders ramp up until queues fill and packets drop; switch
  buffers build up, and short messages get stuck behind long ones - large **tail latency**.
- **Fair sharing**: TCP splits bandwidth evenly between flows, but finishing short messages first
  (SRPT - shortest remaining processing time) gives much lower average and tail latency.
- **Load balancing**: per-connection ordering prevents spraying packets across all network paths.
- **NIC offload is hard** for a protocol this complex.

## What replacements do differently (Homa as the example)

- **Message-based**, connectionless RPC transport - no handshake, no per-pair connection state.
- **Receiver-driven**: the receiver grants permission to send ("grants"), so it controls incoming
  load and switch queues stay short.
- **Priorities**: uses switch priority queues to send short messages first (approximating SRPT).
- **Packet spraying**: no ordering per connection, so packets can use every path.

Other directions: **RDMA / RoCE** (kernel-bypass, hardware transport), **QUIC**-style user-space
transports, Google's **Snap/Pony Express**, AWS's **SRD** (used by EFA), and Linux's **Homa**
module. Counter-argument: TCP is everywhere, well-understood, and continuously improved (DCTCP,
BBR, offloads), so replacing it carries large ecosystem costs.

🖼️ **sender-driven tcp (queues build at the switch) vs receiver-driven homa (receiver grants, short messages prioritised)**
![datacenter transport](<../../assets/img/datacenter-transport.png>)

## Practice project

No runnable project: datacenter transports need custom kernels, NICs or switch priority queues.
Revisit [`practice/network-performance/hol-blocking-sim`](../../practice/network-performance/hol-blocking-sim)
and [`practice/transmission-control-protocol/flow-and-congestion`](../../practice/transmission-control-protocol/flow-and-congestion)
for the TCP behaviours these designs replace.

## Related

- [TCP pros and cons](<../transmission control protocol/tcp_pros_n_cons.md>).
- [TCP head-of-line blocking](<../network performance/tcp_head_of_line_blocking.md>).
- [Congestion control](<../transmission control protocol/congestion_control.md>).
