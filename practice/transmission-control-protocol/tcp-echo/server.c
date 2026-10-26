// TCP echo server in C: socket -> bind -> listen -> accept -> read/write -> close.
// Iterative on purpose (one client at a time) so the lifecycle stays readable;
// see the comment at the bottom for how real servers handle many clients.
//
//   gcc server.c -o tcp-server && ./tcp-server [port]
//
// Builds on Linux, macOS and WSL (POSIX sockets).
#include <arpa/inet.h>
#include <netinet/in.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
    int port = argc > 1 ? atoi(argv[1]) : 5100;
    setvbuf(stdout, NULL, _IOLBF, 0);

    // SOCK_STREAM = TCP
    int listen_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (listen_fd < 0) { perror("socket"); return 1; }

    // Lets a restarted server re-bind immediately, instead of failing with "Address already in
    // use" while old connections from the previous run sit in TIME_WAIT.
    int yes = 1;
    setsockopt(listen_fd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY);
    addr.sin_port = htons(port);

    if (bind(listen_fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) { perror("bind"); return 1; }

    // listen() turns this into a LISTENING socket. The kernel now completes 3-way handshakes
    // on its own and parks finished connections in the accept queue (size ~ backlog).
    if (listen(listen_fd, 16) < 0) { perror("listen"); return 1; }
    printf("tcp echo server (c) on :%d\n", port);

    for (;;) {
        struct sockaddr_in client;
        socklen_t len = sizeof(client);

        // accept() pops an ALREADY-ESTABLISHED connection off the accept queue and returns a
        // brand-new file descriptor for it. listen_fd keeps listening.
        int conn_fd = accept(listen_fd, (struct sockaddr *)&client, &len);
        if (conn_fd < 0) { perror("accept"); continue; }
        printf("[accept] %s:%d\n", inet_ntoa(client.sin_addr), ntohs(client.sin_port));

        char buf[4096];
        ssize_t n;
        // read() returns whatever bytes are in the receive buffer right now: maybe part of a
        // message, maybe several. 0 means the peer sent FIN.
        while ((n = read(conn_fd, buf, sizeof(buf))) > 0) {
            printf("[data  ] %zd bytes in one read()\n", n);
            write(conn_fd, buf, n);
        }

        printf("[close ] %s\n", n == 0 ? "peer sent FIN" : "read error (RST?)");
        close(conn_fd); // sends our FIN
    }
    // Real servers don't block on one client like this. They fork/thread per connection, or
    // use one thread with epoll/kqueue to watch many sockets at once (which is what Node's
    // event loop does under the hood).
}
