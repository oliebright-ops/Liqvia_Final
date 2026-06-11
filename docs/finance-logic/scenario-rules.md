# Scenario Rules

Scenarios are **separate** from baseline forecast records. Never overwrite baseline when applying sliders.

## Variables

| Variable         | Type      | Effect                         |
| ---------------- | --------- | ------------------------------ |
| Revenue decline  | % (0–100) | Reduces forecast inflows       |
| Payroll increase | %         | Increases payroll outflows     |
| Receivable delay | Days      | Shifts AR collection timing    |
| Expense growth   | %         | Increases non-payroll outflows |

## Calculation Flow

1. Load baseline `CashForecast` and lines
2. Clone assumptions into `Scenario` / `ScenarioLine`
3. Apply multipliers and day shifts per variable
4. Recalculate 13-week lines
5. Recompute runway and liquidity score
6. Expose baseline vs scenario comparison API

## Persistence

- `Scenario` — metadata, slider values, companyId
- `ScenarioLine` — weekly outputs linked to scenario

## Frontend

Sliders debounce recalculation; show side-by-side or delta vs baseline.

## Test Cases

<!-- TODO: Add numeric fixtures -->

- 10% revenue decline → lower closing cash week 13
- 14-day receivable delay → collections shift right one bucket
