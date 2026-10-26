# Capturing TCP Segments with tcpdump

TCP captures show the whole conversation the applications never see: handshakes, ACKs, window
updates, retransmissions, resets. Being able to read them is the difference between guessing and
knowing why a connection is slow, hangs, or drops.

## Filters

```bash
sudo tcpdump -i lo -n tcp port 5100                                  # one service
sudo tcpdump -i any -n -S tcp port 5100                              # absolute seq numbers
sudo tcpdump -i any -n 'tcp[tcpflags] & (tcp-syn|tcp-fin|tcp-rst) != 0'  # opens/closes/resets only
sudo tcpdump -i any -n 'tcp[tcpflags] & tcp-rst != 0'                # just resets
sudo tcpdump -i any -n 'tcp[14:2] = 0'                               # zero-window advertisements
sudo tcpdump -i any -n -ttt tcp port 5100                            # time BETWEEN packets
sudo tcpdump -i any -n -w tcp.pcap tcp port 5100                     # save for Wireshark
```

## Reading a line

```text
IP 127.0.0.1.49672 > 127.0.0.1.5100: Flags [P.], seq 1:6, ack 1, win 6379, length 5
```

| Part | Meaning |
| --- | --- |
| `49672 > 5100` | source port > destination port |
| `Flags [P.]` | `S` SYN, `.` ACK, `P` PSH, `F` FIN, `R` RST - combined, e.g. `[S.]` = SYN-ACK |
| `seq 1:6` | this segment carries bytes 1 to 5 (relative to the ISN unless `-S`) |
| `ack 1` | next byte expected from the other side |
| `win 6379` | advertised receive window (scaled) |
| `length 5` | payload bytes |
| `options [mss 1460,...]` | appear on SYNs: MSS, window scale, SACK, timestamps |

## Patterns to recognise

- **Handshake**: `[S]`, `[S.]`, `[.]`.
- **Graceful close**: `[F.]` from each side and ACKs (often 3 segments: FIN, FIN-ACK, ACK).
- **Refused**: `[S]` answered immediately by `[R.]` - nothing listening.
- **Retransmission**: the same `seq` range sent twice; gaps of ~200 ms, 400 ms, 800 ms... (RTO backoff).
- **Zero window**: `win 0`, followed by small zero-window probes from the sender.
- **Delayed ACK / Nagle stalls**: a consistent ~40 ms (Linux) or ~200 ms gap before an ACK - use `-ttt`.

🖼️ **a captured tcp conversation annotated: handshake, data with seq/ack arithmetic, fin teardown**
![tcpdump tcp](<../../assets/img/tcpdump-tcp.png>)

## Practice project

[`practice/transmission-control-protocol/tcp-echo`](../../practice/transmission-control-protocol/tcp-echo) -
`capture.sh` (default, `handshake`, `hex`, `pcap`) against the echo server.

## Related

- [TCP segment](<tcp_segment.md>) - every field you'll see.
- [Capturing IP, ARP, ICMP packets with tcpdump](<../internet protocol/capturing_ip_arp_icmp_packet_with_tcpdump.md>) - tcpdump basics.
- [Wiresharking TCP/HTTP](<../analyzing protocols with wireshark/wiresharking_tcp-http.md>) - the same in Wireshark.
