#!/usr/bin/env bash
# Self-signed certificate for the HTTP/2 + TLS server (needs openssl: macOS/Linux/WSL/Git Bash).
#   bash generate-cert.sh   ->  key.pem cert.pem
set -euo pipefail
cd "$(dirname "$0")"
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout key.pem -out cert.pem -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
echo "created key.pem cert.pem"
