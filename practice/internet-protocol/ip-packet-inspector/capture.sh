#!/usr/bin/env bash
# Capture recipes for IP, ARP and ICMP with tcpdump (Linux / WSL / macOS - needs sudo).
#
#   bash capture.sh icmp      # ping something in another terminal
#   bash capture.sh arp       # then force an ARP lookup (see README)
#   bash capture.sh ttl       # traceroute in another terminal, watch Time Exceeded come back
#   bash capture.sh hex       # one ICMP packet as hex, ready for parse-packet.js
#   bash capture.sh pcap      # save to a file to open in Wireshark later
#
# Override the interface with IFACE=wlan0 bash capture.sh icmp
set -euo pipefail

IFACE="${IFACE:-any}"

case "${1:-}" in
  icmp)
    # -n: don't resolve names (faster, and shows raw IPs)  -v: show TTL, id, length
    sudo tcpdump -i "$IFACE" -n -v icmp
    ;;
  arp)
    # -e: print the link-level (Ethernet) header, so you see the MACs ARP is resolving
    sudo tcpdump -i "$IFACE" -n -e arp
    ;;
  ttl)
    # ICMP type 11 = Time Exceeded: what each router sends back when TTL hits 0
    sudo tcpdump -i "$IFACE" -n -v 'icmp[icmptype] == icmp-timxceed or icmp[icmptype] == icmp-echo'
    ;;
  hex)
    # -xx: hex dump including the Ethernet header  -c 1: stop after one packet
    # (use a real interface here, not "any" - "any" replaces the Ethernet header with a
    # Linux "cooked" header that parse-packet.js doesn't decode)
    sudo tcpdump -i "${IFACE/any/eth0}" -n -xx -c 1 icmp | node parse-packet.js
    ;;
  pcap)
    sudo tcpdump -i "$IFACE" -n -w ip-arp-icmp.pcap 'icmp or arp'
    ;;
  *)
    echo "usage: bash capture.sh icmp | arp | ttl | hex | pcap"
    exit 1
    ;;
esac
