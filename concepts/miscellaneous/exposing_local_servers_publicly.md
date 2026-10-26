# Exposing Local Servers Publicly

A server on your laptop is usually unreachable from the internet: it has a private IP behind NAT
(maybe CGNAT), a firewall blocks inbound connections, and it may only listen on `127.0.0.1`. Yet the
laptop can make **outbound** connections freely. Every way of exposing a local server either opens
an inbound path, or turns the problem around using that outbound freedom.

## Options

### 1. Port forwarding on your router

Router DNATs `public-ip:8080 → 192.168.1.20:3000`. Needs a real public IP (fails behind CGNAT),
exposes your home IP, and your app is directly on the internet. Dynamic DNS helps if the IP changes.

### 2. Reverse tunnel through a server you control

`ssh -R 8080:localhost:3000 user@vps` - the SSH client dials **out** to the VPS; the VPS listens on
8080 and forwards each incoming connection back down the SSH connection. Needs a VPS
(`GatewayPorts yes` to listen publicly).

### 3. Tunnel services

ngrok, Cloudflare Tunnel (`cloudflared`), Tailscale Funnel, VS Code / GitHub port forwarding. Same
principle at scale:

1. An **agent** on your machine opens an outbound, long-lived **control connection** to the
   provider's edge.
2. Visitors hit a public URL at the edge.
3. The edge sends the visitor's traffic down the agent's connection (multiplexed over HTTP/2, QUIC
   or a custom protocol), and the agent forwards it to `localhost:3000`.

Extras: automatic HTTPS, custom domains, auth in front of your app, request inspection/replay.

### 4. VPN / overlay networks

Tailscale, WireGuard, ZeroTier: devices join a private network, so they can reach each other
without exposing anything publicly.

## Why outbound works

NAT and firewalls create state for outbound connections and allow their replies. The tunnel keeps
one outbound connection open (with keepalives so NAT doesn't evict it), and all inbound traffic
rides it.

## Security

A tunnel bypasses every protection your network gave you. Add authentication, avoid exposing admin
or debug endpoints, prefer providers' access controls, and shut tunnels down when done. The app sees
connections from the agent (`127.0.0.1`), not visitors - use the provider's `X-Forwarded-For`.

🖼️ **laptop behind nat/firewall with every arrow pointing outward: agent → relay control, agent → relay data, visitor → relay**
![tunnel relay](<../../assets/img/tunnel-relay.png>)

## Practice project

[`practice/miscellaneous/expose-local-server`](../../practice/miscellaneous/expose-local-server) -
a mini ngrok: relay, agent and a loopback-only app; reachable through the relay, refused directly.

## Related

- [NAT](<../transmission control protocol/nat.md>) - why inbound fails.
- [Private IP addresses](<../internet protocol/private_ip_addresses.md>).
- [Listening server](<../network performance/listening_server.md>).
- [The importance of proxies and reverse proxies](<../network performance/the_importance_of_proxy_and_reverse_proxies.md>).
