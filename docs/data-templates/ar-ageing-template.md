# AR Ageing Template

## Columns

| Column             | Required | Notes                          |
| ------------------ | -------- | ------------------------------ |
| Customer Name      | Yes      |                                |
| Invoice Number     | Yes      | Unique per company recommended |
| Invoice Date       | Yes      | ISO date                       |
| Due Date           | Yes      | ISO date                       |
| Outstanding Amount | Yes      | > 0                            |
| Currency           | Yes      | ISO 4217                       |

## Validation

- Due Date ≥ Invoice Date
- Outstanding Amount numeric, positive
- Currency matches company default or supported list

## Collection Model

Imported AR feeds weighted collection forecast (see treasury rules engine).
