# Trial Balance Template

## Columns (strict order)

| Column       | Required | Notes                                      |
| ------------ | -------- | ------------------------------------------ |
| Period       | Yes      | e.g. `2026-01`                             |
| Account Code | Yes      |                                            |
| Account Name | Yes      |                                            |
| Account Type | Yes      | Asset, Liability, Equity, Revenue, Expense |
| Debit        | Yes      | Numeric ≥ 0                                |
| Credit       | Yes      | Numeric ≥ 0                                |

## Validation Rules

- Header row required; column names must match exactly
- Each row: Debit and Credit not both zero unless allowed by policy
- Account Type from allowed enum
- Reject file if unknown columns or empty required fields

## Validation

Implemented in `@liqvia2/shared` (`validateUpload`). API: `POST /api/uploads/validate`.

## Sample File

[samples/trial-balance-sample.csv](../../samples/trial-balance-sample.csv)
