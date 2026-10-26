// A server that listens but deliberately does NOT call accept() for a while, so you can watch
// the kernel's queues fill up from outside.
//
//   gcc backlog-server.c -o backlog-server && ./backlog-server [port] [backlog] [delaySeconds]
//   ./backlog-server 5301 2 20
//
// (Node can't do this demo: libuv calls accept() as soon as a connection is ready.)
// Linux / WSL / macOS.
#include <arpa/inet.h>
#include <netinet/in.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
    int port = argc > 1 ? atoi(argv[1]) : 5301;
    int backlog = argc > 2 ? atoi(argv[2]) : 2;
    int delay = argc > 3 ? atoi(argv[3]) : 20;
    setvbuf(stdout, NULL, _IOLBF, 0);

    int fd = socket(AF_INET, SOCK_STREAM, 0);
    int yes = 1;
    setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY);
    addr.sin_port = htons(port);
    if (bind(fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) { perror("bind"); return 1; }

    // backlog = the max size of the ACCEPT queue (fully established, not yet accept()ed).
    // On Linux the queue actually holds backlog + 1 connections before it counts as full.
    // The SYN queue (half-open, SYN_RECV) is separate, sized by net.ipv4.tcp_max_syn_backlog.
    if (listen(fd, backlog) < 0) { perror("listen"); return 1; }
    printf("listening on :%d with backlog=%d. NOT calling accept() for %ds...\n", port, backlog, delay);
    printf("now run: node flood-client.js %d 8     and in another terminal:\n", port);
    printf("         watch -n 0.5 \"ss -tan '( sport = :%d or dport = :%d )'\"\n\n", port, port);

    sleep(delay);

    printf("accepting now\n");
    for (;;) {
        struct sockaddr_in client;
        socklen_t len = sizeof(client);
        int conn = accept(fd, (struct sockaddr *)&client, &len);
        if (conn < 0) { perror("accept"); continue; }
        printf("[accept] %s:%d\n", inet_ntoa(client.sin_addr), ntohs(client.sin_port));

        char buf[256];
        ssize_t n = read(conn, buf, sizeof(buf));
        if (n > 0) write(conn, buf, n); // echo once, then hang up
        close(conn);
    }
}
