#!/usr/bin/env bash
# Run pnpm/node commands when host Node is unavailable
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CMD="${*:-pnpm install}"
docker run --rm \
  -v "$ROOT":/app \
  -w /app \
  --add-host=host.docker.internal:host-gateway \
  -e DATABASE_URL="${DATABASE_URL:-postgresql://liqvia:liqvia@host.docker.internal:5432/liqvia2?schema=public}" \
  node:20-alpine \
  sh -c "corepack enable && corepack prepare pnpm@9.15.0 --activate && $CMD"
