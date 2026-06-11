# Architecture Decisions

## ADR-001: Monolith MVP

Single deployable backend (NestJS) with Next.js frontend. Split services only when scale demands.

## ADR-002: Actual vs Forecast Layers

- **Actual layer:** Journal entries, trial balance imports, bank movements
- **Forecast layer:** `CashForecast`, `ForecastLine` — regenerated from rules engine
- **Scenario layer:** Parallel scenario records; never mutates actuals

## ADR-003: Multi-Tenancy

All domain tables scoped by `companyId`. Clerk user mapped to `UserProfile` with role per company.

## ADR-004: Localization

No hardcoded UI strings. Translation keys in JSON; locale-aware dates, numbers, currency. RTL-ready layout for Arabic (post-MVP UI pass).

## ADR-005: Authentication

Clerk for MVP auth; backend validates session / JWT and resolves company context.

## ADR-006: Database

PostgreSQL + Prisma. Migrations in `backend/prisma/migrations`.

## ADR-007: Post-MVP Integrations

Reserve `externalSource`, `externalId` on sync-relevant entities. Event/webhook placeholders documented in API spec.

## Stack

| Layer        | Technology                   |
| ------------ | ---------------------------- |
| Frontend     | Next.js, Tailwind, shadcn/ui |
| Backend      | NestJS, Prisma               |
| Auth         | Clerk                        |
| Shared types | `packages/shared`            |
