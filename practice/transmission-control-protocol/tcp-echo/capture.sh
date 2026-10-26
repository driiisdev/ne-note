#!/usr/bin/env bash
# Watch a TCP connection's full lifecycle on the wire (Linux / WSL / macOS - needs sudo).
#
#   bash capture.sh            # every segment: handshake, data, ACKs, FIN teardown
#   bash capture.sh handshake  # only segments with SYN or FIN or RST set
#   bash capture.sh hex        # full bytes, to find the TCP header fields yourself
#   bash capture.sh pcap       # write tcp-echo.pcap for Wireshark
set -euo pipefail

IFACE="${IFACE:-$( [ "$(uname)" = "Darwin" ] && echo lo0 || echo lo )}"
PORT="${PORT:-5100}"

case "${1:-}" in
  # -S: absolute sequence numbers (the default shows them relative to the ISN)
  "")        sudo tcpdump -i "$IFACE" -n -S "tcp port $PORT" ;;
  handshake) sudo tcpdump -i "$IFACE" -n "tcp port $PORT and (tcp[tcpflags] & (tcp-syn|tcp-fin|tcp-rst) != 0)" ;;
  hex)       sudo tcpdump -i "$IFACE" -n -X "tcp port $PORT" ;;
  pcap)      sudo tcpdump -i "$IFACE" -n -w tcp-echo.pcap "tcp port $PORT" ;;
  *)         echo "usage: bash capture.sh [handshake|hex|pcap]"; exit 1 ;;
esac
