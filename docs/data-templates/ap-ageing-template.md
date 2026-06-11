# AP Ageing Template

## Columns

| Column             | Required | Notes                                           |
| ------------------ | -------- | ----------------------------------------------- |
| Supplier Name      | Yes      |                                                 |
| Bill Number        | Yes      |                                                 |
| Bill Date          | Yes      | ISO date                                        |
| Due Date           | Yes      | ISO date                                        |
| Outstanding Amount | Yes      | > 0                                             |
| Supplier Priority  | Yes      | payroll, tax, critical, flexible, non-essential |
| Currency           | Yes      | ISO 4217                                        |

## Validation

- Supplier Priority must match enum (case-insensitive normalize)
- Payment scheduling uses priority order in treasury engine
