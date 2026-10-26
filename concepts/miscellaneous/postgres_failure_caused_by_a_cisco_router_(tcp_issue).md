# Postgres Failure Caused by a Cisco Router (TCP Issue)

A real-world class of outage: the application, the database and the network all look healthy, yet
queries on some database connections **hang** for many minutes and then fail. The cause is a
stateful device in the middle - a router/firewall (a Cisco in the story) - that silently forgot
idle connections.

## What happened

1. The app keeps a **connection pool** to Postgres. Some pooled connections sit idle for a long time
   (nights, quiet periods).
2. A router/firewall/NAT between them tracks every TCP connection in a **state table** with an
   **idle timeout** (often minutes to an hour).
3. When a connection is idle longer than that, the device **evicts** its entry - **silently**. No FIN,
   no RST. Both the app's and Postgres's kernels still show the connection as `ESTABLISHED`.
4. The pool hands that connection to a request; the app sends a query.
5. The device has no state for it and **drops** the packets (or, in some setups, the backend side is
   gone).
6. The client's TCP stack **retransmits** with exponential backoff - about **15 minutes** on Linux
   (`tcp_retries2 = 15`) - before declaring the connection dead. The request hangs the whole time.

## Why it's hard to diagnose

- Nothing logs an error until the very end.
- Both endpoints believe the connection is fine.
- It only affects connections that were idle, so it looks random and load-dependent.
- Captures on one side show only retransmissions with no answers.

## Fixes

- **TCP keepalive** shorter than the middlebox's idle timeout. Postgres server settings
  `tcp_keepalives_idle`, `tcp_keepalives_interval`, `tcp_keepalives_count`, and libpq client
  `keepalives_idle=...`. The Linux default (`tcp_keepalive_time = 7200` s) is far too long for most
  firewalls. Keepalive probes are real packets, so they refresh the middlebox's state.
- **Pool settings**: cap idle connection lifetime (`idleTimeout`, `maxLifetime`) below the firewall
  timeout, and validate connections before use (test query).
- **Application/statement timeouts** so a hung query fails fast instead of after 15 minutes;
  `tcp_user_timeout` to bound retransmission time.
- **Configure the middlebox**: longer idle timeouts for database traffic, or send RST on eviction.

## The general lesson

"The connection is open" is a belief held separately by two kernels and by every stateful device
between them (NAT gateways, firewalls, load balancers - e.g. AWS NAT Gateway's 350 s idle timeout).
Anything long-lived and idle must actively keep that shared belief fresh.

🖼️ **timeline: app and db both established throughout; router state entry expires; later query dropped at the router; retransmissions with backoff**
![middlebox idle timeout](<../../assets/img/middlebox-idle-timeout.png>)

## Practice project

[`practice/miscellaneous/kernel-tcp-lab`](../../practice/miscellaneous/kernel-tcp-lab) -
`idle-killer-proxy.js` plays the router: after 5 s idle, the next query hangs with no error; with a
heartbeat every 2 s it survives.

## Related

- [NAT](<../transmission control protocol/nat.md>) - stateful tables and idle eviction.
- [How does the kernel manage TCP connections](<how_does_the_kernel_manage_tcp_connections.md>) - retries and keepalive knobs.
- [Network access control to database servers](<../network performance/network_access_control_to_database_servers.md>).
