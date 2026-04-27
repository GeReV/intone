#!/usr/bin/env bash
set -euo pipefail

CERTS_DIR="$(cd "$(dirname "$0")/../certs" && pwd)"

if ! command -v mkcert &>/dev/null; then
  echo "Error: mkcert is not installed." >&2
  echo "Install it from https://github.com/FiloSottile/mkcert" >&2
  exit 1
fi

mkcert -install

mkdir -p "$CERTS_DIR"
mkcert -cert-file "$CERTS_DIR/cert.pem" -key-file "$CERTS_DIR/key.pem" localhost

echo "Certificates written to $CERTS_DIR"
