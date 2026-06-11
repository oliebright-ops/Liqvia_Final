# Treasury Rules Engine

Approved financial brain for the MVP. Implement as backend services with unit tests against known examples.

## 1. Forecast Model

```
Opening Cash + Forecast Inflows - Forecast Outflows = Closing Cash
```

- Granularity: **weekly only**, **13-week rolling** forecast
- Baseline forecast separate from scenario overlays

## 2. AR Collection Assumptions (Weighted)

| Bucket  | Share | Timing         |
| ------- | ----- | -------------- |
| Fast    | 70%   | Within 30 days |
| Medium  | 20%   | Within 60 days |
| Delayed | 10%   | Beyond 90 days |

**Engineering notes:** Apply weights to outstanding AR by invoice age; recalculate after each upload.

**Test example:** AR outstanding 100,000 → expected collections ~70k week 4–5, ~20k week 8–9, ~10k week 13+ (map to calendar weeks from invoice dates).

## 3. AP Payment Priority

Pay in order:

1. Payroll
2. Tax
3. Critical suppliers
4. Flexible suppliers
5. Non-essential suppliers

Use `Supplier Priority` from AP ageing template when scheduling outflows.

## 4. Cash Runway

```
Runway (weeks) = Cash / Weekly Net Burn
```

Weekly net burn = average net cash outflow over recent weeks (define window in KPI service).

**Edge cases:** Zero or negative burn → cap or flag as N/A; zero cash → runway 0.

## 5. Liquidity Score

| Runway (weeks) | Status        |
| -------------- | ------------- |
| > 16           | Healthy       |
| 8 – 16         | Moderate      |
| 4 – 8          | High Risk     |
| < 4            | Critical Risk |

**Projection overrides (take the worst status):**

- Current cash &lt; 0 → Critical
- Any projected week with negative closing cash in weeks 1–4 → Critical
- Any projected week with negative closing cash in weeks 5–13 → at least High Risk
- Week-13 closing cash &lt; 0 → Critical
- No net burn (runway N/A) with positive cash → Healthy

**Per-week forecast row:** forward average net burn from that week through week 13; negative closing cash on the row → Critical.

## 6. Rule-Based Alerts

- Runway below thresholds
- Projected negative cash in any week
- Delayed collections (overdue AR above threshold)
- Liquidity stress (score High / Critical)
- Large upcoming payables (obligation alert)

## 7. Scenario Variables

Manual sliders adjust assumptions (stored separately from baseline):

- Revenue decline %
- Payroll increase %
- Receivable delay (days)
- Expense growth %

Recalculate forecast, runway, liquidity score, and AI commentary context.

## 8. Service Mapping

| Service                      | Responsibility                   |
| ---------------------------- | -------------------------------- |
| `TreasuryRulesService`       | Rule configuration and retrieval |
| `ForecastCalculationService` | 13-week cash movement            |
| `LiquidityRiskService`       | Runway and score                 |
| `AlertRulesService`          | Threshold alerts                 |

## 9. Edge Cases Checklist

- [ ] Partial uploads / missing bank balance
- [ ] Multi-currency (MVP: single company currency with validation)
- [ ] Negative opening cash
- [ ] Scenario more pessimistic than baseline only
