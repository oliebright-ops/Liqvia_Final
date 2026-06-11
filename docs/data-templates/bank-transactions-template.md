# Bank Transactions Template

Manual bank statement lines until live bank feeds are integrated.

## Columns

| Column                | Required | Notes                                      |
| --------------------- | -------- | ------------------------------------------ |
| Bank Account Name     | Yes      | Must match an existing account or creates one |
| Account Number Masked | Yes      | Last 4 digits, e.g. `****4521`             |
| Transaction Date      | Yes      | ISO date `YYYY-MM-DD`                      |
| Description           | Yes      | Used for categorisation in dashboard views |
| Amount                | Yes      | Positive number                            |
| Direction             | Yes      | `IN` or `OUT`                              |

## Usage

- Feeds **Recent transactions** on the treasury dashboard
- Feeds **Bank Accounts → Recent transactions** table
- Re-upload replaces prior manual transactions (balance snapshots are preserved)

## Validation

- Duplicate rows in the same file are rejected
- Amount must be greater than zero; direction indicates flow

## Sample File

[samples/bank-transactions-sample.csv](../../samples/bank-transactions-sample.csv)
