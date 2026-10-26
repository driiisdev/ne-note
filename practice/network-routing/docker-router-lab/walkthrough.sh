#!/usr/bin/env bash
# Guided tour of the lab. Each step prints what it's about to show, then runs it.
#   docker compose up -d && bash walkthrough.sh
set -uo pipefail
cd "$(dirname "$0")"

run() { echo "\$ $*"; "$@"; echo; }
step() { echo; echo "=================== $1"; echo "$2"; echo; }
x() { docker compose exec -T "$@"; }

step "1. each host's routing table" \
  "host_a: on-link route for its own subnet, a specific route to net_b via the router, and a default via Docker's gateway (.1)"
run x host_a ip route
run x host_b ip route
run x router ip route

step "2. host_a -> host_b, across the router" \
  "TTL drops by one at the router: replies arrive with ttl=63 instead of 64"
run x host_a ping -c 3 10.10.2.20

step "3. traceroute shows the hop" \
  "hop 1 is the router's net_a address, hop 2 is host_b itself"
run x host_a traceroute -n -q 1 -w 1 10.10.2.20

step "4. ARP: host_a only ever learns the ROUTER's MAC" \
  "host_b is on another subnet, so host_a never ARPs for it - it sends frames to the gateway's MAC"
run x host_a ip neigh
run x router ip -br link

step "5. watch the router forward (tcpdump on both of the router's interfaces)" \
  "same IP packet seen twice: arriving on net_a's interface, leaving on net_b's. Source/dest IPs unchanged; MACs rewritten per hop"
x router sh -c "timeout 4 tcpdump -n -e -i any icmp 2>/dev/null" &
sleep 1
x host_a ping -c 1 10.10.2.20 >/dev/null
wait
echo

step "6. break it: a firewall rule on the router that drops forwarded traffic" \
  "the router still answers pings to ITSELF (INPUT chain), but stops forwarding (FORWARD chain)"
run x router iptables -A FORWARD -j DROP
run x host_a ping -c 2 -W 1 10.10.1.254
run x host_a ping -c 2 -W 1 10.10.2.20
run x router iptables -D FORWARD -j DROP

step "7. break it differently: remove host_b's return route" \
  "requests still reach host_b, but its replies go to Docker's default gateway instead of our router"
run x host_b ip route del 10.10.1.0/24
run x host_a ping -c 2 -W 1 10.10.2.20
run x host_b ip route add 10.10.1.0/24 via 10.10.2.254
echo "(return route restored)"
