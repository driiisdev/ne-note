# Client-Server Architecture

The model almost all networked software is built on: one side (the **server**) owns resources,
state and logic and waits for requests; the other side (the **client**) initiates contact, asks
for something, and renders the result. Networking exists, in large part, to carry those requests
and responses.

## Why split work this way

Before networks, programs ran entirely on one machine. Splitting them across a network lets you:

- **Centralize what's expensive or shared**: a database, a large model, business rules, files
  everyone needs, kept in one place and managed once.
- **Keep clients thin and cheap**: a browser or phone app doesn't need the data or the compute,
  just enough logic to ask and display.
- **Update once, affect everyone**: change the server and every client gets the new behaviour on
  the next request.
- **Control access**: the server decides who may read or change what.

## How it works on the network

1. The server **listens** on a well-known address and port (e.g. `0.0.0.0:443`).
2. The client opens a connection to that address, from an **ephemeral port** the OS picks.
3. The client sends a request in an agreed **protocol** (HTTP, SQL wire protocol, Redis protocol,
   gRPC...), the server processes it, and sends a response.
4. The connection is closed, or kept alive for the next request.

The roles are about **who initiates**, not about machine size. A laptop running a dev server is a
server; a backend service calling a database is that database's client.

## Variations

- **Two-tier**: client ↔ server (an app talking directly to a database).
- **Three-tier / n-tier**: client ↔ web/app server ↔ database, often with caches, queues and
  proxies in between. Each hop is itself a client-server pair.
- **Peer-to-peer**: every node is both client and server (BitTorrent, WebRTC media). Exists
  precisely because pure client-server puts all the load and trust on one side.

## Pros / Cons

**Pros:** central control of data and security, simple clients, one place to scale, update and
monitor; easy to reason about (one side asks, one side answers).

**Cons:** the server is a bottleneck and a single point of failure unless replicated; every
interaction costs at least one network round trip; servers need to be reachable (public IPs,
DNS, open ports), which is exactly what NAT and firewalls make hard for clients.

🖼️ **client-server request/response diagram (clients, network, server with its listening port)**
![client server architecture](<../../assets/img/client-server-architecture.png>)

## Practice project

[`practice/fundamentals-of-networking/host-to-host`](../../practice/fundamentals-of-networking/host-to-host) -
a tiny key-value server over raw TCP that owns all the state, and a thin client that only sends
commands and prints replies.

## Related

- [OSI model](<osi_model.md>) - the layers that carry each request and response.
- [Host to host communication](<host_to_host_communication.md>) - how the bytes actually get
  from the client's machine to the server's.
- [Listening server](<../network performance/listening_server.md>) - why *where* a server
  listens matters as much as *that* it listens.
