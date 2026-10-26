# Capturing UDP Traffic with tcpdump

UDP captures are the easiest to read: no handshake, no ACKs, no teardown - every line is one
application message. That makes them a good first exercise in reading tcpdump output, and the
quickest way to answer "did my datagram actually leave / arrive?"

## Filters

```bash
sudo tcpdump -i lo -n udp port 5001              # one port, loopback (lo0 on macOS)
sudo tcpdump -i any -n 'udp and (port 5001 or port 5002)'
sudo tcpdump -i any -n -v udp port 53            # DNS: tcpdump decodes queries and answers
sudo tcpdump -i lo -n -X udp port 5001           # hex + ASCII of every datagram
sudo tcpdump -i any -n 'udp and greater 1000'    # only big datagrams
sudo tcpdump -i any -n -w udp.pcap udp           # save for Wireshark
```

## Reading the output

```text
12:00:00.100 IP 127.0.0.1.49971 > 127.0.0.1.5001: UDP, length 5
12:00:00.101 IP 127.0.0.1.5001 > 127.0.0.1.49971: UDP, length 9
12:00:00.200 IP 192.168.1.10.53412 > 1.1.1.1.53: 41022+ A? example.com. (29)
12:00:00.225 IP 1.1.1.1.53 > 192.168.1.10.53412: 41022 2/0/0 A 93.184.215.14, A ... (61)
```

- `length 5` is the **UDP payload** length (not including the 8-byte header).
- For DNS, tcpdump decodes the protocol: `41022+` is the query ID with RD set, `A?` the question,
  `2/0/0` the answer/authority/additional counts.
- With `-X`, after 20 bytes of IP header you'll find the 8-byte UDP header (ports, length,
  checksum), then the data in ASCII on the right.

## What to look for

- **Requests with no response** - loss, a firewall, or nothing listening. A closed port usually
  triggers an **ICMP port unreachable** (`sudo tcpdump -n icmp` to see it).
- **Fragments** - large datagrams appear as multiple IP fragments; one lost fragment loses all.
- **Bursts and gaps** in timestamps - pacing, jitter, application stalls.
- On loopback you'll rarely see loss; capture on a real interface to see real behaviour.

🖼️ **annotated udp tcpdump line plus a -X hex dump with the udp header bytes highlighted**
![tcpdump udp](<../../assets/img/tcpdump-udp.png>)

## Practice project

[`practice/user-datagram-protocol/udp-echo`](../../practice/user-datagram-protocol/udp-echo) -
`capture.sh` (default, `hex`, `dns`, `pcap`) watches the echo traffic and real DNS.

## Related

- [Capturing IP, ARP, ICMP packets with tcpdump](<../internet protocol/capturing_ip_arp_icmp_packet_with_tcpdump.md>) -
  flags and basics.
- [Wiresharking UDP](<../analyzing protocols with wireshark/wiresharking_udp.md>) - the same in a GUI.
- [User datagram structure](<user_datagram_structure.md>).
