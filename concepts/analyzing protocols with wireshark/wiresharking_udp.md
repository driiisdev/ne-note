# Wiresharking UDP

Wireshark is the graphical packet analyzer: it captures (or opens `.pcap` files from tcpdump) and
**dissects** every packet into a tree of protocol fields, with powerful display filters. UDP is the
ideal first protocol to analyze in it - every packet is a complete application message, with no
handshake or ACK noise.

## Capturing

- Pick the interface: a real NIC, or the **loopback** adapter for local tests (on Windows, Npcap's
  "Adapter for loopback traffic capture"; `lo` on Linux, `lo0` on macOS).
- **Capture filters** (BPF, applied while capturing, same syntax as tcpdump): `udp port 5801`.
- **Display filters** (applied afterwards, Wireshark syntax): `udp.port == 5801`, `udp.length > 1000`,
  `dns`, `udp && !dns`.

## The three panes

1. **Packet list** - one row per frame: time, source, destination, protocol, length, info.
2. **Packet details** - the dissector tree: Frame → Ethernet/Null → IPv4 → **User Datagram
   Protocol** (source port, destination port, length, checksum, stream index) → payload or a decoded
   application protocol (DNS, QUIC, ...).
3. **Packet bytes** - the hex; click a field in the tree and its bytes are highlighted.

## What to look for in UDP

- **No setup or teardown** - the first packet is data.
- **Lengths**: UDP length = 8 + payload; frame length adds IP and link headers.
- **Request/response pairing**: Wireshark matches DNS queries to responses (shows response time);
  for custom protocols, compare ports and timestamps yourself.
- **ICMP Port Unreachable** right after a datagram → nothing listening on that port.
- **Fragmented IP** for datagrams above the MTU.
- **Statistics → Conversations → UDP** for volumes per flow; **Statistics → I/O Graph** for rates.

## Decoding custom protocols

UDP on a non-standard port shows as raw "Data". Use **Decode As...** to apply a known dissector
(e.g. treat port 5801 as DNS), or write a Lua dissector for your own protocol.

🖼️ **wireshark screenshot of a udp datagram with the udp header fields expanded and their bytes highlighted**
![wireshark udp](<../../assets/img/wireshark-udp.png>)

## Practice project

[`practice/analyzing-protocols-with-wireshark/capture-lab`](../../practice/analyzing-protocols-with-wireshark/capture-lab) -
lab 1: `udp-traffic.js` sends three datagrams (one 1200 bytes) and gets acks on port 5801.

## Related

- [UDP](<../user datagram protocol/udp.md>) and [user datagram structure](<../user datagram protocol/user_datagram_structure.md>).
- [Capturing UDP traffic with tcpdump](<../user datagram protocol/capturing_udp_traffic_with_tcpdump.md>).
- [Wiresharking TCP/HTTP](<wiresharking_tcp-http.md>).
