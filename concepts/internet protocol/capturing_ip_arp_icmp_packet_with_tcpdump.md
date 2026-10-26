# Capturing IP, ARP and ICMP Packets with tcpdump

`tcpdump` is the command-line packet analyzer: it puts an interface into capture mode, applies a
**BPF filter** in the kernel so only matching packets are copied out, and prints a one-line summary
(or full bytes) of each. It's on almost every Linux/macOS box and server, which makes it the tool
you can rely on when there's no GUI.

## Essential flags

| Flag | Meaning |
| --- | --- |
| `-i eth0` / `-i any` | which interface (`any` = all, on Linux) |
| `-n` | don't resolve IPs/ports to names (faster, unambiguous) |
| `-v`, `-vv` | more header detail (TTL, IP id, length, options) |
| `-e` | print the link-level header (MAC addresses) |
| `-x` / `-xx` / `-X` | hex dump from IP header / from link header / hex + ASCII |
| `-c 10` | stop after 10 packets |
| `-w file.pcap` / `-r file.pcap` | write / read a capture (open it in Wireshark later) |
| `-s 0` | capture full packets (the default on modern versions) |

## Filters for this module

```bash
sudo tcpdump -i any -n icmp                          # ping, traceroute replies, unreachables
sudo tcpdump -i eth0 -n -e arp                       # ARP requests and replies, with MACs
sudo tcpdump -i any -n 'icmp[icmptype] == icmp-timxceed'   # only Time Exceeded
sudo tcpdump -i any -n host 8.8.8.8                  # everything to/from one IP
sudo tcpdump -i any -n 'ip[6:2] & 0x1fff != 0 or ip[6] & 0x20 != 0'   # IP fragments
```

## Reading the output

```text
12:00:01.000 IP 192.168.1.10 > 8.8.8.8: ICMP echo request, id 1, seq 7, length 64
12:00:01.012 IP 8.8.8.8 > 192.168.1.10: ICMP echo reply, id 1, seq 7, length 64
12:00:05.000 ARP, Request who-has 192.168.1.1 tell 192.168.1.10, length 28
12:00:05.001 ARP, Reply 192.168.1.1 is-at 3c:52:82:aa:bb:01, length 46
```

Timestamp, protocol, source > destination, then protocol-specific detail. The reply arriving 12 ms
after the request *is* the round-trip time.

## Tips

- Capture to a file with `-w` on a server, copy it back, and analyze in Wireshark.
- On `-i any` (Linux) the link header is a synthetic "cooked" header, so use a real interface
  when you need MAC addresses.
- Filters run in the kernel, so tight filters keep the capture cheap even on busy hosts.
- On Windows, use Wireshark (with Npcap) or `pktmon`; tcpdump runs inside WSL.

🖼️ **annotated tcpdump output: each part of an icmp line labelled (time, src, dst, type, id, seq, length)**
![tcpdump capture](<../../assets/img/tcpdump-ip-arp-icmp.png>)

## Practice project

[`practice/internet-protocol/ip-packet-inspector`](../../practice/internet-protocol/ip-packet-inspector) -
`capture.sh` has recipes for icmp, arp, ttl, hex and pcap, and `capture.sh hex` pipes a live
packet straight into the decoder.

## Related

- [ICMP, ping, traceroute](<icmp_ping_traceroute.md>) and [ARP](<arp.md>) - what you're capturing.
- [Capturing UDP traffic with tcpdump](<../user datagram protocol/capturing_udp_traffic_with_tcpdump.md>)
  and [capturing TCP segments with tcpdump](<../transmission control protocol/capturing_tcp_segment_with_tcpdump.md>).
- [Wiresharking UDP](<../analyzing protocols with wireshark/wiresharking_udp.md>) - the GUI equivalent.
