# Wiresharking TCP/HTTP

Plain HTTP/1.1 over TCP is the most instructive capture there is: you see the transport doing its
work (handshake, sequence numbers, ACKs, windows, teardown) **and** the application data in readable
text - including anything sensitive, which is the argument for HTTPS in one screenshot.

## Useful display filters

```text
tcp.port == 5802                    one service
tcp.stream == 3                     one connection (Wireshark numbers every TCP stream)
http                                HTTP messages only
http.request.method == "POST"
tcp.flags.syn == 1 && tcp.flags.ack == 0     new connection attempts
tcp.flags.reset == 1                resets
tcp.analysis.retransmission         retransmissions
tcp.analysis.flags                  anything Wireshark's TCP analysis thinks is odd
```

## Reading a conversation

1. **Handshake**: `[SYN]`, `[SYN, ACK]`, `[ACK]`. Expand the SYN's options: MSS, window scale, SACK.
2. **Request**: an `HTTP GET /hello` row - TCP segment with `[PSH, ACK]`, payload = the request text.
3. **Response**: `HTTP/1.1 200 OK`; a multi-segment response is reassembled and shown on the last
   segment ("[2 Reassembled TCP Segments]").
4. **Teardown**: `[FIN, ACK]` from each side and the final ACK.

Wireshark shows **relative sequence numbers** (starting at 0) by default; the raw ISN is in the
field details. `[TCP segment of a reassembled PDU]` means the payload continues in a later segment.

## Power tools

- **Follow → TCP Stream**: the whole conversation as text, client in one colour, server in another.
  A password in a POST body is right there.
- **Statistics → Flow Graph**: a sequence diagram of the conversation, built for you.
- **Statistics → Conversations**: bytes and duration per connection.
- **Expert Information**: retransmissions, duplicate ACKs, zero windows, resets in one list.
- **Time columns**: set "Seconds since previous displayed packet" to spot stalls (delayed ACK,
  server think time).
- **HTTP → Load Distribution / Request Sequences** for HTTP-level summaries.

🖼️ **wireshark flow graph of an http request: handshake, request, response, fin teardown**
![wireshark tcp http](<../../assets/img/wireshark-tcp-http.png>)

## Practice project

[`practice/analyzing-protocols-with-wireshark/capture-lab`](../../practice/analyzing-protocols-with-wireshark/capture-lab) -
lab 2: `http-server.js` + `curl` with a login POST to find in Follow TCP Stream.

## Related

- [TCP segment](<../transmission control protocol/tcp_segment.md>) - the fields in the details pane.
- [Capturing TCP segments with tcpdump](<../transmission control protocol/capturing_tcp_segment_with_tcpdump.md>).
- [Wiresharking HTTP/2 (decrypting TLS)](<wiresharking_http-2(decrypting_tls).md>) - the encrypted version.
