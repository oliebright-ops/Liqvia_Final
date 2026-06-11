# Database Schema

Prisma schema: `backend/prisma/schema.prisma`. Migration: `backend/prisma/migrations/`.

## Models

| Model                       | Layer    | Notes                          |
| --------------------------- | -------- | ------------------------------ |
| Company                     | Tenant   | Soft delete                    |
| UserProfile                 | Auth     | Clerk ID, `UserRole` enum      |
| ChartOfAccount              | Actuals  | `externalSource`, `externalId` |
| JournalEntry / JournalLine  | Actuals  | Trial balance imports          |
| BankAccount / CashMovement  | Actuals  | Cash position                  |
| Receivable / Payable        | Actuals  | AR/AP uploads                  |
| Budget / BudgetLine         | Actuals  | Budget vs actual               |
| CashForecast / ForecastLine | Forecast | 13-week baseline               |
| Scenario / ScenarioLine     | Scenario | Slider assumptions             |
| UploadBatch / UploadError   | Ingest   | Per template type              |
| Alert                       | Treasury | Rule-based alerts              |
| AiLog / AiInsight           | AI       | Audit trail                    |
| AuditLog                    | Security | Entity changes                 |

## External integration fields

| Model          | Fields                         |
| -------------- | ------------------------------ |
| ChartOfAccount | `externalSource`, `externalId` |
| JournalEntry   | `externalSource`, `externalId` |
| BankAccount    | `externalSource`, `externalId` |

`ExternalSource` enum: `manual`, `xero`, `quickbooks`, `bank_feed`.

## Indexes

All tenant tables: `companyId`. Additional indexes on dates, status, `dueDate`, `supplierPriority`, forecast `weekIndex`.
