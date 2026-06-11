# Deployment Readiness (Step 18)

This guide covers running the Liqvia MVP locally, in CI, and in production.

## 1. Architecture recap

- **frontend** — Next.js 15 (App Router), TailwindCSS, Clerk auth, i18n (en/es). Builds to a standalone server.
- **backend** — NestJS 11 REST API under the `/api` prefix, Prisma ORM.
- **packages/shared** — pure TypeScript domain types + treasury/KPI/scenario logic shared by both apps.
- **PostgreSQL** — single database, multi-tenant by `companyId`.

## 2. Environment variables

Each app has its own env file:

| App      | Template                | Local file (gitignored) |
| -------- | ----------------------- | ----------------------- |
| Backend  | `backend/.env.example`  | `backend/.env`          |
| Frontend | `frontend/.env.example` | `frontend/.env.local`   |

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

**Backend** (`backend/.env`) — loaded automatically on startup:

| Variable           | Notes                                                       |
| ------------------ | ----------------------------------------------------------- |
| `DATABASE_URL`     | Postgres connection string.                                 |
| `SKIP_DB_MIGRATE`  | Set `true` to skip auto-migration on startup.               |
| `PORT`             | Defaults to `3001`.                                         |
| `CORS_ORIGIN`      | Frontend origin allowed for CORS.                           |
| `CLERK_SECRET_KEY` | Optional for MVP.                                           |
| `OPENAI_API_KEY`   | Optional — AI CFO falls back to rule-based output if empty. |
| `OPENAI_MODEL`     | Defaults to `gpt-4o-mini`.                                  |

**Frontend** (`frontend/.env.local`) — loaded automatically by Next.js:

| Variable                            | Notes                                    |
| ----------------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_API_URL`               | e.g. `https://api.example.com/api`.      |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Optional — app builds & runs without it. |

Never put backend secrets (`DATABASE_URL`, `OPENAI_API_KEY`, `CLERK_SECRET_KEY`) in frontend env files.

## 3. Local development

```bash
pnpm install
docker compose up -d                      # Postgres
pnpm --filter @liqvia2/backend run prisma:seed:demo   # 4 demo companies
pnpm dev                                   # frontend + backend (migrations run on backend startup)
```

Pending migrations are applied automatically when the backend starts (`prisma migrate
deploy`). Set `SKIP_DB_MIGRATE=true` to disable this (e.g. in specialised test
harnesses). To author new migrations during development, still use
`pnpm --filter @liqvia2/backend exec prisma migrate dev`.

- Frontend: http://localhost:3000
- Backend health: http://localhost:3001/api/health
- Dashboard: http://localhost:3000/dashboard

## 4. Demo data

`pnpm --filter @liqvia2/backend run prisma:seed:demo` loads four companies that
exercise every liquidity tier (see `samples/demo-data/manifest.json`):

| Company                     | Currency | Profile                     |
| --------------------------- | -------- | --------------------------- |
| Demo Consulting Ltd         | USD      | Healthy runway              |
| Brightspark Retail Co       | USD      | Tight liquidity             |
| Nordwind Manufacturing GmbH | EUR      | Delayed receivables (watch) |
| CloudPeak SaaS Inc          | USD      | Critical runway             |

The seed is idempotent — it clears each company's transactional data before
re-importing the CSVs through the real upload/validation pipeline.

## 5. CI

`.github/workflows/ci.yml` spins up Postgres, generates the Prisma client, runs
`migrate deploy`, checks formatting and lint, builds all workspaces, runs the
backend test suite, and finally runs the demo seed as an end-to-end smoke test.

## 6. Production (Docker)

Both apps ship multi-stage Dockerfiles building from the repo root context:

```bash
# Backend (migrations run automatically on startup via dist/main.js)
docker build -f backend/Dockerfile -t liqvia2-backend .

# Frontend (standalone Next server)
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api \
  -t liqvia2-frontend .
```

### One-click Render blueprint

`render.yaml` provisions a managed Postgres instance plus the backend and
frontend web services. Set the `sync: false` secrets in the Render dashboard
after the first deploy.

## 7. Pre-launch checklist

- [ ] `DATABASE_URL` points at a managed Postgres with backups enabled.
- [ ] Backend has started at least once against production (applies pending migrations automatically).
- [ ] `CORS_ORIGIN` matches the deployed frontend origin.
- [ ] `NEXT_PUBLIC_API_URL` points at the deployed backend `/api`.
- [ ] Clerk keys configured (or auth intentionally disabled for the pilot).
- [ ] `OPENAI_API_KEY` set if live AI commentary is required.
- [ ] CI green on `main`.
- [ ] Demo seed verified against a staging database.
