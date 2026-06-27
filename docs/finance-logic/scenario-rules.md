# Scenario Rules

Scenarios are **separate** from baseline forecast records. Never overwrite baseline when applying sliders.

## When the forecast recalculates

- **In-app:** Sliders trigger a debounced preview (~700ms after the last change) via `POST /scenarios/preview`. No database write.
- **Save:** `POST /scenarios` persists slider values and stores stressed `ScenarioLine` rows for later comparison.
- **Baseline Cash Forecast** on the dashboard is unchanged.

## Variables

| Variable         | Type      | What it changes                                                                 | Timing        |
| ---------------- | --------- | ------------------------------------------------------------------------------- | ------------- |
| Revenue decline  | % (0–100) | Scales **outstanding amount** on every open receivable (including overdue AR)   | Prospective   |
| Revenue growth   | % (0–50)  | Scales **up** open receivable amounts (optimistic scenarios)                    | Prospective   |
| Payroll increase | %         | Scales **outstanding amount** on payables tagged `payroll` in AP upload         | Prospective   |
| Receivable delay | Days      | Shifts **invoice/due dates** forward (collections move to later weeks)          | Prospective   |
| Payable deferral | Days      | Shifts **AP due dates** forward (payments move to later weeks)                  | Prospective   |
| Expense growth   | %         | Scales **outstanding amount** on non-payroll, non-tax payables                  | Prospective   |
| Tax increase     | %         | Scales **outstanding amount** on payables tagged `tax`                          | Prospective   |
| One-off inflow   | Amount    | Lump-sum cash **inflow** in week N (1–13)                                       | Single event  |
| One-off outflow  | Amount    | Lump-sum cash **outflow** in week N (1–13)                                      | Single event  |

**Not changed by sliders:** uploaded weekly actuals, rolling inflows/outflows derived from actuals, opening cash from bank movements.

### Revenue decline and week 1–2

A revenue decline applies to **all open receivables at as-of date**, including overdue balances that flow into week 1 inflows. It does **not** retroactively edit past weekly actuals — it reduces the **volume** of collections scheduled from today’s AR ledger.

### Receivable delay

Delay shifts **when** collections land, not historical actuals. Combined with revenue decline, both amount and timing stress apply.

## Week-13 cash delta

- **Baseline week-13:** closing cash at end of horizon from current uploads with no stress.
- **Scenario week-13:** same engine with stressed AR/AP inputs.
- **Delta:** scenario minus baseline. Negative = less cash at the horizon under the stress test.

Runway delta uses the same weekly net-burn logic as the dashboard KPIs.

## Backtest (Cash Forecast page)

Historical backtest compares **past weekly net cash** to a rolling-average prediction. It measures forecast **accuracy**, not scenario outcomes. Scenarios are forward what-if only.

## Calculation flow

1. Load forecast input (opening cash, AR, AP, optional weekly actuals) via `TreasuryEngineService.getForecastInput`
2. Clone and apply `applyScenarioToInput()` multipliers and date shifts
3. Run `buildForecastModel` for baseline and stressed inputs (13-week horizon)
4. Return comparison API payload; on save, persist `ScenarioLine` rows

## Persistence

- `Scenario` — metadata, slider values, companyId
- `ScenarioLine` — weekly outputs linked to scenario

## API

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/scenarios` | List saved scenarios with week-13 summary vs current baseline |
| POST | `/scenarios/preview` | Live preview without save |
| POST | `/scenarios` | Create and persist |
| POST | `/scenarios/:id/recalculate` | Refresh stored lines after data upload |

## Test cases

- 10% revenue decline → lower receivable outstanding amounts; week-13 cash ≤ baseline
- 14-day receivable delay → invoice dates shift; collections move right
- 20% payroll increase → payroll-tagged payables only increase
- 10% expense growth → non-payroll payables only increase

See `backend/src/scenarios/scenario-math.spec.ts`.
