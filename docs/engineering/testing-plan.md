# Testing Plan

Financial logic **must** be tested with known expected outputs before moving to the next module.

## Unit Tests

- Weighted AR collection (70/20/10)
- AP priority ordering
- Runway and liquidity thresholds
- 13-week forecast line math
- Budget vs actual variance
- Scenario slider effects
- CSV validation schemas

## Integration Tests

- Upload → parse → persist → recalculate forecast
- Prisma relationships and company isolation
- API endpoints with test database

## E2E (Later)

- Clerk auth flow
- Upload center happy path
- Dashboard data load

## Fixtures

- `/samples` — template CSVs
- `/samples/demo-data` — four demo companies (Step 17)

## CI

GitHub Actions: lint, typecheck, unit tests, migration check (see `.github/workflows/ci.yml`).
