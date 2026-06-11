# Liqvia2 — AI Treasury & Cash Flow Platform

SME-focused treasury intelligence: 13-week cash forecast, liquidity scoring, uploads, scenarios, and AI CFO insights.

## Monorepo Layout

```
liqvia2/
├── docs/           # Product, finance logic, engineering, templates
├── frontend/       # Next.js + Tailwind + shadcn/ui
├── backend/        # NestJS + Prisma + PostgreSQL
├── packages/shared # Shared TypeScript types
├── samples/        # CSV templates and demo data
└── docker-compose.yml
```

## Prerequisites

- Node.js 20+
- pnpm 9+ (recommended) or npm
- Docker (PostgreSQL local)

## Quick Start

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
docker compose up -d
```

If `pnpm` is on your PATH:

```bash
pnpm install
pnpm --filter @liqvia2/backend run prisma:seed:demo   # optional: 4 demo companies
pnpm dev   # backend auto-migrates on startup; reads backend/.env
```

If Node is not installed locally, use the Docker helper (used during initial setup):

```bash
./scripts/docker-node.sh install
./scripts/docker-node.sh "pnpm db:generate && cd backend && pnpm exec prisma migrate dev"
./scripts/docker-node.sh "cd backend && pnpm exec prisma db seed"
./scripts/docker-node.sh "pnpm dev"
```

- Frontend: http://localhost:3000
- Upload center: http://localhost:3000/uploads
- Backend API: http://localhost:3001/api
- Swagger docs: http://localhost:3001/api/docs

## Documentation

Start with [docs/product/mvp-scope.md](./docs/product/mvp-scope.md) and [docs/finance-logic/treasury-rules-engine.md](./docs/finance-logic/treasury-rules-engine.md).

Source engineering guide: `docs/engineering/engineering-execution-guide.docx`

## Build Order

Follow phased prompts in the engineering execution guide (Steps 1–18). Steps 1–2 are scaffolded in this repository.
