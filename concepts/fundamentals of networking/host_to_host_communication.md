# Host to Host Communication

How a packet actually gets from one machine to another. Two kinds of addresses cooperate: **IP
addresses** say who the packet is ultimately for, **MAC addresses** say which device on the
*current* local network should pick up the frame. The first decision every host makes before
sending anything is: *is the destination on my own subnet or not?*

## Same subnet: direct delivery

1. Host A (`192.168.1.10/24`) wants to reach host B (`192.168.1.20`).
2. A masks both addresses with `255.255.255.0`: same network (`192.168.1.0`), so B is **on-link**.
3. A needs B's MAC address. It checks its ARP cache; if missing, it broadcasts an **ARP request**
   ("who has 192.168.1.20?") and B replies with its MAC.
4. A sends an Ethernet frame addressed to B's MAC, containing the IP packet addressed to B's IP.
5. The switch forwards the frame by MAC address to B's port. No router involved.

## Different subnet: via the gateway

1. Host A wants to reach `8.8.8.8`. Masking shows it's **not** on `192.168.1.0/24`.
2. A looks at its routing table: the default route says "send everything else to the gateway
   `192.168.1.1`".
3. A ARPs for the **gateway's** MAC, not for 8.8.8.8's (which it could never reach directly).
4. The frame goes to the router's MAC, but the IP packet inside still says destination `8.8.8.8`.
5. The router strips the frame, looks up `8.8.8.8` in its own routing table, decrements TTL, and
   re-wraps the packet in a new frame for the next hop. Repeat until the destination network.

The key insight: **the IP destination stays the same end to end; the MAC destination changes at
every hop.**

## Switches vs routers

| | Switch | Router |
| --- | --- | --- |
| Layer | L2 | L3 |
| Forwards by | MAC address (MAC table) | IP address (routing table) |
| Scope | within one network / broadcast domain | between networks |
| Broadcasts (like ARP) | floods them | stops them |

## Where it goes wrong

- **Wrong subnet mask**: a host thinks a remote IP is on-link and ARPs for it forever.
- **Wrong/missing gateway**: local traffic works, nothing beyond the subnet does.
- **Stale or spoofed ARP entries**: frames go to the wrong MAC (the basis of ARP spoofing attacks).

🖼️ **two paths side by side: same-subnet (ARP for host, through switch) vs remote (ARP for gateway, through router)**
![host to host communication](<../../assets/img/host-to-host-communication.png>)

## Practice project

[`practice/fundamentals-of-networking/host-to-host`](../../practice/fundamentals-of-networking/host-to-host) -
`next-hop.js` makes exactly the on-link vs via-gateway decision for any destination IP, using
your real interfaces and subnet masks.

## Related

- [ARP](<../internet protocol/arp.md>) - how IP addresses get resolved to MAC addresses.
- [Routing](<../internet protocol/routing.md>) - what the router does with the packet next.
- [The IP building blocks](<../internet protocol/the_ip_building_blocks.md>) - subnets and masks.
- [OSI model](<osi_model.md>) - L2 vs L3 responsibilities.
