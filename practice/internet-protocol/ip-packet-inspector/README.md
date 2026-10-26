# Practice: IP Packet Inspector

Concept notes: [`ip_packet.md`](<../../../concepts/internet protocol/ip_packet.md>) ·
[`icmp_ping_traceroute.md`](<../../../concepts/internet protocol/icmp_ping_traceroute.md>) ·
[`arp.md`](<../../../concepts/internet protocol/arp.md>) ·
[`capturing_ip_arp_icmp_packet_with_tcpdump.md`](<../../../concepts/internet protocol/capturing_ip_arp_icmp_packet_with_tcpdump.md>)

## What this demonstrates

A packet is just bytes at fixed offsets. `parse-packet.js` takes the raw hex that `tcpdump -xx`
prints and decodes it field by field, the same job Wireshark's dissectors do:

- **Ethernet**: destination/source MAC and the EtherType that says what comes next
- **ARP**: the "who has 192.168.1.1? tell 192.168.1.10" broadcast and its reply
- **IPv4**: version, header length, total length, DF/MF flags, **TTL**, protocol, header
  checksum (actually verified), source/destination IP
- **ICMP**: echo request/reply (`ping`) and Time Exceeded (`traceroute`)

## Folder structure

```text
ip-packet-inspector/
  parse-packet.js   <- hex in (args, stdin, or a built-in sample), decoded headers out
  capture.sh        <- tcpdump recipes: icmp | arp | ttl | hex | pcap
```

## Run it

No capture tools are needed to start. Use the built-in samples:

```bash
node parse-packet.js sample-icmp
node parse-packet.js sample-arp
```

With real traffic (Linux, WSL, or macOS with `tcpdump`):

```bash
bash capture.sh icmp     # terminal 1
ping -c 3 8.8.8.8        # terminal 2

bash capture.sh hex      # captures one ICMP packet and pipes it into parse-packet.js
```

## What you'll see

```text
== IPv4 (L3) ==
  header len : 20 bytes
  total len  : 60 bytes (header + payload)
  flags      : DF=1 MF=0  frag offset=0
  TTL        : 64
  protocol   : 1 (ICMP)
  checksum   : 0x4cb9  valid
  src IP     : 192.168.1.10
  dst IP     : 8.8.8.8
== ICMP ==
  type/code  : 8/0 (Echo Request)
  identifier : 1
  sequence   : 7
```

> 🖼️ **Image suggestion:** an IPv4 header diagram (the classic 32-bit-wide grid) with this exact
> sample's values written into each field. Drawing it yourself from the output above is a good
> exercise.

## Code walkthrough

**IHL is counted in 32-bit words, not bytes.** The low nibble of the first byte is `5` for a
header without options, which means 5 × 4 = 20 bytes:

```js
const ihl = (buf[0] & 0x0f) * 4;
```

This is why the parser can't just assume the payload starts at byte 20. With IP options it starts
later, and the IHL field is the only way to know.

**The header checksum covers the header only**, not the payload. That's why every router has to
recompute it: decrementing TTL changes the header. Verification is a one's-complement sum, and a
correct header sums to zero:

```js
internetChecksum(header) === 0 ? "valid" : "INVALID"
```

**ARP lives directly on Ethernet (EtherType `0x0806`) and has no IP header.** It can't have one,
because it exists to find the MAC address that sending an IP packet needs in the first place.
The request goes to the broadcast MAC `ff:ff:ff:ff:ff:ff`, and the reply comes back unicast.

## How ping and traceroute use these fields

- **`ping`** sends ICMP type 8 (Echo Request) and waits for type 0 (Echo Reply). The
  identifier and sequence number let it match replies to requests and spot loss.
- **`traceroute`** sends probes with TTL = 1, 2, 3, ... Each router decrements TTL. The router
  where it hits 0 drops the packet and sends back **ICMP type 11 (Time Exceeded)** from *its own*
  IP, which is how each hop reveals itself. (Linux `traceroute` probes with UDP by default,
  Windows `tracert` with ICMP echo, but the Time Exceeded replies are the same either way.)

```bash
bash capture.sh ttl          # terminal 1
traceroute -I 8.8.8.8        # terminal 2 (Linux; `tracert 8.8.8.8` on Windows)
```

## Try this yourself

- **Watch an ARP exchange happen.** Clear the entry first so the OS has to ask again:
  `sudo ip neigh flush all` (Linux), then `bash capture.sh arp` and ping your gateway. You'll
  see one broadcast request and one unicast reply, then nothing more until the cache entry expires.
- Ping with a large payload and DF set (`ping -M do -s 2000 8.8.8.8` on Linux) and watch it
  fail locally with "message too long". Then switch to `-M dont` and capture again: you'll see the
  packet fragmented, with `MF=1` on every fragment except the last one.
- Compare the TTL in a reply from `8.8.8.8` with the one in a reply from your gateway. Linux
  hosts usually start at 64, Windows at 128, and many network devices at 255. Subtracting tells
  you roughly how many hops away the sender is.
- Save a capture (`bash capture.sh pcap`), open it in Wireshark, and check that every field
  `parse-packet.js` printed matches Wireshark's packet details pane.

## Real-world equivalent

This is a hand-rolled version of what Wireshark and `tcpdump -v` do internally. You'll reach for
the same field knowledge when debugging real problems: a TTL that's too low, DF plus a small MTU
(see `practice/network-performance/mtu-pmtud`), or an ARP cache pointing at the wrong MAC (which
is also how ARP spoofing attacks work).
