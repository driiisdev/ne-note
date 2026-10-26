#!/usr/bin/env bash
# Two self-signed certificates, one per "site" behind the SNI router.
# Needs openssl (macOS/Linux/WSL, or Git Bash on Windows).
#   bash generate-certs.sh   ->  alpha.key alpha.pem  beta.key beta.pem
set -euo pipefail
cd "$(dirname "$0")"
for name in alpha beta; do
  openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -keyout "$name.key" -out "$name.pem" -subj "/CN=$name.test" \
    -addext "subjectAltName=DNS:$name.test" 2>/dev/null
  echo "created $name.key $name.pem  (CN=$name.test)"
done
