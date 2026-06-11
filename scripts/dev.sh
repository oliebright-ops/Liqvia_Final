#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Use: ./scripts/docker-node.sh install"
  exit 1
fi

if [ ! -f backend/.env ]; then
  echo "Copy backend/.env.example to backend/.env first."
  exit 1
fi
docker compose up -d
pnpm db:generate
pnpm --filter @liqvia2/backend run prisma:seed:demo 2>/dev/null || true
pnpm dev
