# API Spec

Base URL: `http://localhost:3001/api` (development). All routes require auth unless noted.

## Conventions

- JSON request/response
- `companyId` from session context — never trust client-supplied tenant id alone
- Errors: `{ "statusCode", "message", "errors"?: [] }`

## Planned Route Groups

<!-- TODO: Implement in NestJS modules -->

| Prefix                                   | Description                                                        |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `/health`                                | Health check                                                       |
| `/uploads/templates`                     | List templates with column headers                                 |
| `/uploads/templates/:type/sample`        | Download sample CSV                                                |
| `/uploads/validate`                      | POST JSON `{ templateType, csvContent, companyCurrency? }`         |
| `/uploads/validate/file`                 | POST multipart: `file`, `templateType`, optional `companyCurrency` |
| `/uploads/import`                        | POST JSON — validate and persist rows + `UploadBatch`              |
| `/uploads/batches`                       | GET — recent upload history (demo company by default)              |
| `/forecast`                              | Generate and fetch 13-week forecast                                |
| `/treasury`                              | Rules, KPI preview, liquidity preview, forecast, alerts            |
| `/treasury/forecast/preview`             | POST — 13-week baseline from AR/AP/cash inputs                     |
| `/treasury/forecast/:companyId`          | GET — generate from DB (`?persist=true` to save)                   |
| `/treasury/forecast/:companyId/generate` | POST — generate and persist                                        |
| `/treasury/alerts/:companyId`            | GET — rule-based alerts for company                                |
| `/treasury/alerts/preview`               | POST — evaluate alerts from forecast context                       |
| `/treasury/kpis/defaults`                | Locked KPI constants                                               |
| `/treasury/kpis/preview`                 | POST — full dashboard KPI snapshot                                 |
| `/alerts`                                | Active alerts                                                      |
| `/budget`                                | Budget vs actual                                                   |
| `/scenarios`                             | CRUD scenarios, recalculate                                        |
| `/ai`                                    | CFO assistant (streaming TBD)                                      |

## OpenAPI (Swagger)

Interactive docs are served by `@nestjs/swagger`:

| URL                                 | Description         |
| ----------------------------------- | ------------------- |
| http://localhost:3001/api/docs      | Swagger UI          |
| http://localhost:3001/api/docs/json | OpenAPI 3 JSON spec |

Regenerated automatically from controller decorators and DTOs in `backend/src/dto/`.
