# Architecture Decisions

## ADR-001: Monolith MVP

Single deployable backend (NestJS) with Next.js frontend. Split services only when scale demands.

## ADR-002: Actual vs Forecast Layers

- **Actual layer:** Journal entries, trial balance imports, bank movements
- **Forecast layer:** `CashForecast`, `ForecastLine` — regenerated from rules engine
- **Scenario layer:** Parallel scenario records; never mutates actuals

## ADR-003: Multi-Tenancy

All domain tables scoped by `companyId`. Each authenticated user maps to a `UserProfile` with a role per company.

## ADR-004: Localization

No hardcoded UI strings. Translation keys in JSON; locale-aware dates, numbers, currency. RTL-ready layout for Arabic (post-MVP UI pass).

## ADR-005: Authentication

**Custom, in-house.** No third-party identity provider is used. Passwords are hashed with
bcrypt (`bcryptjs`, cost 10) and stored as `UserProfile.passwordHash`; sessions are
stateless JWTs issued by `@nestjs/jwt` and verified by `passport-jwt`, from which the
backend resolves company context. See `backend/src/auth/`.

_Superseded ADR-005 (MVP draft) proposed Clerk. Clerk was never installed and no Clerk
code path has ever existed in this repository._

## ADR-006: Database

PostgreSQL + Prisma. Migrations in `backend/prisma/migrations`.

## ADR-007: Post-MVP Integrations

Reserve `externalSource`, `externalId` on sync-relevant entities. Event/webhook placeholders documented in API spec.

## Stack

| Layer        | Technology                   |
| ------------ | ---------------------------- |
| Frontend     | Next.js, Tailwind, shadcn/ui |
| Backend      | NestJS, Prisma               |
| Auth         | Custom bcrypt + JWT          |
| Shared types | `packages/shared`            |
