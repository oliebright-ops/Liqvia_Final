# KPI Dictionary

Locked formulas for MVP. Implementation: `TreasuryKpiService` (`backend/src/treasury/treasury-kpi.service.ts`). Constants: `KPI_DEFAULTS` in `@liqvia2/shared`.

## Constants

| Constant               | Value | Usage                       |
| ---------------------- | ----- | --------------------------- |
| `burnLookbackWeeks`    | 4     | Weekly net burn average     |
| `upcomingPayablesDays` | 14    | Upcoming obligations window |
| `forecastHorizonWeeks` | 13    | Week-13 closing cash        |

## KPIs

### Current Cash

- **Definition:** Sum of bank balances on the latest `balanceDate` across all accounts.
- **Formula:** `Σ balance` where `balanceDate = max(balanceDate)`
- **Inputs:** Bank balance upload / `BankAccount` snapshots
- **Output:** `number` (currency from company)
- **Edge cases:** No accounts → `0`
- **Test:** 50k@Jan-15 + 30k@Jan-31 + 12k@Jan-31 → **42,000**

### 13-Week Forecast Closing Cash

- **Definition:** `closingCash` on forecast line where `weekIndex = 13`.
- **Formula:** `ForecastLine.closingCash` for week 13
- **Inputs:** `CashForecast`, `ForecastLine[]`
- **Output:** `number | null`
- **Edge cases:** Missing week 13 → `null`

### Weekly Net Burn

- **Definition:** Average weekly net cash outflow over the last 4 weeks.
- **Formula:** `avg(max(0, outflows - inflows))` for each of the 4 most recent weeks
- **Inputs:** Weekly cash movements or aggregated `WeeklyCashFlowInput[]`
- **Output:** `number` (0 if no positive-burn weeks)
- **Edge cases:** Net inflow weeks excluded from average; all inflow weeks → burn `0`, runway `null`
- **Test:** Four weeks each 10k net outflow → **10,000**

### Cash Runway

- **Definition:** Weeks until cash is exhausted at current burn rate.
- **Formula:** `currentCash / weeklyNetBurn` when `weeklyNetBurn > 0`, else `null`
- **Inputs:** Current cash, weekly net burn
- **Output:** `number | null` (weeks)
- **Test:** 80,000 cash / 10,000 burn → **8** weeks

### Liquidity Risk Score

- **Definition:** Categorical status from runway thresholds **and** 13-week cash projection stress.
- **Formula:** Worst of:
  1. Runway-based score (see [treasury-rules-engine.md](./treasury-rules-engine.md))
  2. `critical` if current cash &lt; 0, any projected week &lt; 0 within weeks 1–4, or week-13 closing &lt; 0
  3. `high_risk` if any later projected week &lt; 0
- **Per-week forecast status:** Forward-looking average net burn from that week through week 13; negative `closingCash` → `critical`
- **Null runway:** No positive net burn → `healthy` (not critical)
- **Output:** `healthy | moderate | high_risk | critical`

### Overdue Receivables

- **Definition:** Open AR past due.
- **Formula:** `Σ outstandingAmount` where `dueDate < asOfDate` and `outstandingAmount > 0`
- **Inputs:** `Receivable[]`, `asOfDate`
- **Test:** One overdue 15k, one future 5k → **15,000**

### Upcoming Payables

- **Definition:** AP due within the next 14 days (inclusive).
- **Formula:** `Σ outstandingAmount` where `asOfDate ≤ dueDate ≤ asOfDate + 14 days`
- **Inputs:** `Payable[]`, `asOfDate`
- **Test:** Due Feb-10 from Jan-31 → included; due Mar-1 → excluded

### Budget Variance

- **Definition:** Budget minus actual per period/category.
- **Formula:**
  - `varianceAmount = budgetAmount - actualAmount`
  - `variancePercent = (varianceAmount / budgetAmount) × 100` if `budgetAmount ≠ 0`, else `null`
- **Inputs:** Budget lines + trial balance actuals by category
- **Test:** Budget 100k, actual 92k → amount **8,000**, percent **8%**

### Forecast Variance

- **Definition:** How actual cash compares to week-13 forecast closing.
- **Formula:** `actualCash - forecastClosingCash` (positive = ahead of forecast)
- **Inputs:** Current/actual cash, week-13 forecast line
- **Test:** Actual 42k, forecast 38.5k → **3,500**

### Collection Days

- **Definition:** Weighted average days since invoice on open AR (DSO proxy).
- **Formula:** `Σ(outstanding × daysSinceInvoice) / Σ(outstanding)` where `daysSinceInvoice = asOfDate - invoiceDate`
- **Inputs:** Open receivables, `asOfDate`
- **Edge cases:** No open AR → `null`
- **Test:** 10k×30d + 5k×60d over 15k → **40** days

### Payables Days

- **Definition:** Weighted average days since bill on open AP (DPO proxy).
- **Formula:** `Σ(outstanding × daysSinceBill) / Σ(outstanding)` where `daysSinceBill = asOfDate - billDate`
- **Inputs:** Open payables, `asOfDate`
- **Edge cases:** No open AP → `null`

## API

- `GET /api/treasury/kpis/defaults` — returns `KPI_DEFAULTS`
- `POST /api/treasury/kpis/preview` — body matches `buildDashboard` input; returns `TreasuryKpiDashboard`

## Output Format

`TreasuryKpiDashboard` in `@liqvia2/shared` — used by dashboard and AI CFO context assembly.
