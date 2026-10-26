#!/usr/bin/env bash
# Builds a tiny local PKI: our own Certificate Authority, and a server certificate it signs.
# Needs openssl (macOS/Linux/WSL have it; on Windows, Git Bash ships one).
#
#   bash generate-cert.sh
#
# Produces:
#   ca.key / ca.pem          the CA's private key and self-signed root certificate
#   server.key / server.pem  the server's private key and its CA-signed certificate
set -euo pipefail
cd "$(dirname "$0")"

# 1. The CA: a key pair plus a self-signed certificate that says "I am Local Dev CA"
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout ca.key -out ca.pem -subj "/CN=Local Dev CA" 2>/dev/null

# 2. The server's own key pair, plus a signing request (CSR) containing its public key
openssl req -newkey rsa:2048 -nodes \
  -keyout server.key -out server.csr -subj "/CN=localhost" 2>/dev/null

# 3. The CA signs the CSR. subjectAltName is what clients actually check the hostname against.
printf "subjectAltName=DNS:localhost,IP:127.0.0.1\n" > san.ext
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key -CAcreateserial \
  -days 365 -extfile san.ext -out server.pem 2>/dev/null

rm -f server.csr san.ext ca.srl
echo "created ca.key ca.pem server.key server.pem"
openssl x509 -in server.pem -noout -subject -issuer -ext subjectAltName
