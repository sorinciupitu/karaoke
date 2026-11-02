#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi

PORT="${PORT:-7777}"

plan() {
  echo "Plan de instalare Karaoke:"
  echo "  1. Verific / instalez Docker (dacă lipsește)"
  echo "  2. Generez .env cu un SECRET_KEY aleator (dacă lipsește)"
  echo "  3. Rulez: docker compose up -d --build"
  echo "  4. Aplicația va fi disponibilă pe portul ${PORT}"
}

if [ "$DRY_RUN" = true ]; then
  plan
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  OS="$(uname -s)"
  if [ "$OS" = "Linux" ]; then
    echo "Docker lipsește — îl instalez automat…"
    curl -fsSL https://get.docker.com | sh
  elif [ "$OS" = "Darwin" ]; then
    echo "Docker nu este instalat." >&2
    echo "Instalează Docker Desktop (https://www.docker.com/products/docker-desktop/)" >&2
    echo "sau Colima:  brew install colima docker && colima start" >&2
    echo "apoi rulează din nou acest script." >&2
    exit 1
  else
    echo "Sistem de operare nerecunoscut: $OS" >&2
    exit 1
  fi
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Comanda 'docker compose' lipsește; actualizează Docker." >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  sed -i.bak "s|^SECRET_KEY=.*|SECRET_KEY=${SECRET}|" .env
  rm -f .env.bak
  echo "Am generat .env cu un SECRET_KEY aleator."
  echo "Editează .env pentru a schimba ADMIN_USERNAME / ADMIN_PASSWORD înainte de prima pornire."
fi

docker compose up -d --build

echo ""
echo "✓ Karaoke rulează pe http://localhost:${PORT}"
echo "  Contul de administrator: vezi ADMIN_USERNAME / ADMIN_PASSWORD în .env"
