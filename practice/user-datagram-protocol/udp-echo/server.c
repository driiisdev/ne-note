// UDP echo server in C - the same server as server.js, minus the event loop,
// so every socket syscall is visible.
//
//   gcc server.c -o udp-server && ./udp-server [port]
//
// Builds on Linux, macOS and WSL (POSIX sockets). Not native Windows (that needs Winsock).
#include <arpa/inet.h>
#include <netinet/in.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

#define BUF_SIZE 65507 /* max UDP payload over IPv4: 65535 - 20 (IP) - 8 (UDP) */

int main(int argc, char *argv[]) {
    int port = argc > 1 ? atoi(argv[1]) : 5001;
    setvbuf(stdout, NULL, _IOLBF, 0); // flush logs per line, even when piped to a file

    // SOCK_DGRAM = UDP. (SOCK_STREAM would be TCP.)
    int fd = socket(AF_INET, SOCK_DGRAM, 0);
    if (fd < 0) { perror("socket"); return 1; }

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY); // 0.0.0.0: every interface
    addr.sin_port = htons(port);              // ports go on the wire in network byte order

    if (bind(fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) { perror("bind"); return 1; }
    printf("udp echo server (c) on :%d\n", port);

    // No listen(), no accept(): there are no connections, only datagrams.
    char buf[BUF_SIZE + 1];
    for (;;) {
        struct sockaddr_in client;
        socklen_t len = sizeof(client);

        // recvfrom() returns exactly ONE datagram, and fills in who sent it
        ssize_t n = recvfrom(fd, buf, BUF_SIZE, 0, (struct sockaddr *)&client, &len);
        if (n < 0) { perror("recvfrom"); continue; }
        buf[n] = '\0';

        printf("[udp] %s:%d sent %zd bytes: %s\n",
               inet_ntoa(client.sin_addr), ntohs(client.sin_port), n, buf);

        // sendto() names the destination on every call, because nothing is "connected"
        sendto(fd, buf, n, 0, (struct sockaddr *)&client, len);
    }

    close(fd);
    return 0;
}
