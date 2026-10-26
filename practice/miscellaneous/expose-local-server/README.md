# Practice: Exposing Local Servers Publicly (a Mini ngrok)

Concept notes: [`exposing_local_servers_publicly.md`](<../../../concepts/miscellaneous/exposing_local_servers_publicly.md>) ·
related: [`nat.md`](<../../../concepts/transmission control protocol/nat.md>) ·
[`listening_server.md`](<../../../concepts/network performance/listening_server.md>)

## What this demonstrates

Your laptop's server usually can't be reached from the internet. It sits behind NAT, a firewall,
maybe CGNAT, and it may even be bound to `127.0.0.1`. But your laptop can make **outbound**
connections freely. Tunnels (ngrok, Cloudflare Tunnel, `ssh -R`, Tailscale Funnel) all exploit
that asymmetry:

1. The **agent** on your laptop dials **out** to a public **relay** and keeps that control
   connection open.
2. A **visitor** connects to the relay.
3. The relay tells the agent "a visitor arrived" over the control connection.
4. The agent dials **out** again (a data connection), and also dials the local app.
5. The relay splices visitor ↔ data connection, and the agent splices data connection ↔ local
   app.

No inbound connection ever reaches the laptop.

## Folder structure

```text
expose-local-server/
  local-app.js   <- node local-app.js [port]           HTTP on 127.0.0.1:5933 (loopback only!)
  relay.js       <- node relay.js                       public side: control :5930, data :5931, public :5932
  agent.js       <- node agent.js [relayHost] [localPort]   private side, outbound connections only
```

```text
 visitor ──► relay:5932 ═══════ (spliced) ═══════ relay:5931 ◄── agent ──► 127.0.0.1:5933 (local-app)
                                                                   │
                         relay:5930 ◄──── control: "OPEN 7" ───────┘   (agent connected OUT, stays open)
```

## Run it

```bash
node relay.js                 # terminal 1 (the "VPS")
node local-app.js             # terminal 2 (the "laptop")
node agent.js 127.0.0.1       # terminal 3 (the "laptop")
curl http://127.0.0.1:5932/hello
```

To make it real, run `relay.js` on a cheap VPS (open ports 5930-5932) and run
`node agent.js <vps-ip>` on your laptop. Anyone can then reach your laptop's app at
`http://<vps-ip>:5932`.

## What you'll see

```text
$ curl http://127.0.0.1:5932/     (agent not running yet)
tunnel offline

$ curl http://127.0.0.1:5932/first
hello from a server running on someone's laptop, path /first

$ curl http://10.0.0.53:5932/lan          # via the tunnel: works
hello from a server running on someone's laptop, path /lan
$ curl http://10.0.0.53:5933/             # straight at the app: connection refused (curl exit 7)
```

Relay log:

```text
[relay] agent connected from ::ffff:127.0.0.1:57677
[relay] visitor #1 from ::ffff:127.0.0.1:57683 -> asking agent to OPEN 1
[relay] visitor #1 spliced to agent data connection
```

The app logs every request as coming from `127.0.0.1`, which is the agent. Just like behind
any proxy, the app never sees the visitor's real address unless the tunnel adds an
`X-Forwarded-For` header. This one works at L4, so it can't.

> 🖼️ **Image suggestion:** the diagram above with a firewall/NAT wall drawn around the laptop.
> Every arrow crossing the wall points *outward*, which is the whole trick.

## Code walkthrough

**The visitor waits while the agent dials back.** The relay pauses the visitor's socket so no
bytes are lost while the data connection is being set up:

```js
visitor.pause();
waiting.set(id, visitor);
agent.write(`OPEN ${id}\n`);
```

**The data connection identifies itself with its first line**, and anything after that line is
real payload that must be forwarded, not dropped:

```js
const rest = header.subarray(nl + 1);
if (rest.length) visitor.write(rest);
visitor.pipe(dataConn).pipe(visitor);
```

**One data connection per visitor** keeps the code simple. Production tunnels multiplex every
visitor over a single connection (ngrok uses its own multiplexing protocol; Cloudflare Tunnel uses
HTTP/2 or QUIC), which saves a round trip per visitor and survives NATs that limit connection
counts.

## The options, compared

| Approach | How | Notes |
| --- | --- | --- |
| Port forwarding on your router | router DNATs public:port → laptop | needs a public IP; fails behind CGNAT; exposes your home IP |
| `ssh -R 8080:localhost:3000 vps` | SSH remote forward, same idea as this project | needs a VPS; `GatewayPorts yes` to listen publicly |
| ngrok / Cloudflare Tunnel / Tailscale Funnel | managed relay + agent | TLS, auth, custom domains, request inspection |
| This project | relay + agent, ~120 lines | no TLS, no auth: **anyone** who finds the port reaches your app |

**Security:** a tunnel punches a hole through every protection your network gave you. Anything
exposed this way should have its own authentication, and the tunnel should be shut down when
you're done.

## Try this yourself

- Kill the agent while the relay keeps running. Visitors get `tunnel offline`. Restart it, and
  it reconnects on its own (`retrying in 2s`).
- Use the real thing for comparison: `ssh -R 9000:localhost:5933 user@your-vps`, then
  `curl http://localhost:9000` on the VPS.
- Add a shared-secret check: the agent must send `AGENT <token>` first, or the relay drops it.
  Without that, anyone could connect as your agent and hijack your public URL.
- Put `l7-proxy.js` from `practice/network-performance/proxy-l4-l7` in front of the local app so
  that requests carry `X-Forwarded-For`.

## Real-world equivalent

ngrok, Cloudflare Tunnel (`cloudflared`), `ssh -R`, Tailscale Funnel, VS Code port forwarding,
and webhook-testing tools all work this way: an outbound control connection, a public relay, and
per-visitor splicing.
