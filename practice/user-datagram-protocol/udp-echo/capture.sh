#!/usr/bin/env bash
# Watch UDP datagrams on the wire (Linux / WSL / macOS - needs sudo).
#
#   bash capture.sh        # summary line per datagram
#   bash capture.sh hex    # full bytes, so you can find the 8-byte UDP header yourself
#   bash capture.sh dns    # real-world UDP: DNS queries/answers on port 53
#   bash capture.sh pcap   # write udp-echo.pcap for Wireshark
set -euo pipefail

# loopback is "lo" on Linux, "lo0" on macOS
IFACE="${IFACE:-$( [ "$(uname)" = "Darwin" ] && echo lo0 || echo lo )}"
FILTER="udp and (port 5001 or port 5002)"

case "${1:-}" in
  "")   sudo tcpdump -i "$IFACE" -n "$FILTER" ;;
  hex)  sudo tcpdump -i "$IFACE" -n -X "$FILTER" ;;
  dns)  sudo tcpdump -i any -n -v udp port 53 ;;
  pcap) sudo tcpdump -i "$IFACE" -n -w udp-echo.pcap "$FILTER" ;;
  *)    echo "usage: bash capture.sh [hex|dns|pcap]"; exit 1 ;;
esac
