# Data Templates

Strict CSV column specs for MVP uploads. Validation: `@liqvia2/shared` → `validateUpload()`.

| Template      | Doc                                                      | Sample                                                             |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| Trial Balance | [trial-balance-template.md](./trial-balance-template.md) | [trial-balance-sample.csv](../../samples/trial-balance-sample.csv) |
| AR Ageing     | [ar-ageing-template.md](./ar-ageing-template.md)         | [ar-ageing-sample.csv](../../samples/ar-ageing-sample.csv)         |
| AP Ageing     | [ap-ageing-template.md](./ap-ageing-template.md)         | [ap-ageing-sample.csv](../../samples/ap-ageing-sample.csv)         |
| Bank Balances | [bank-balances-template.md](./bank-balances-template.md) | [bank-balances-sample.csv](../../samples/bank-balances-sample.csv) |
| Bank Transactions | [bank-transactions-template.md](./bank-transactions-template.md) | [bank-transactions-sample.csv](../../samples/bank-transactions-sample.csv) |
| Budget        | [budget-template.md](./budget-template.md)               | [budget-sample.csv](../../samples/budget-sample.csv)               |

API: `GET /api/uploads/templates`, `POST /api/uploads/validate`
