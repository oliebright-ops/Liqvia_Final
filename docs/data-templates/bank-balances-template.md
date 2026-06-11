# Bank Balances Template

## Columns

| Column                | Required | Notes              |
| --------------------- | -------- | ------------------ |
| Bank Account Name     | Yes      |                    |
| Account Number Masked | Yes      | Last 4 only in MVP |
| Currency              | Yes      |                    |
| Balance Date          | Yes      | ISO date           |
| Current Balance       | Yes      | Numeric            |

## Validation

- One row per account per balance date
- Current Balance used as opening cash input for forecast
