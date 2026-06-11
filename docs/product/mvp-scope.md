# MVP Scope

## Positioning

**AI Cash Flow & Treasury Platform for SMEs**

## Approved Decisions

| Area          | Decision                                                       |
| ------------- | -------------------------------------------------------------- |
| Input method  | Strict CSV/Excel templates and manual adjustments              |
| Forecast type | 13-week weekly cash forecast                                   |
| Architecture  | Monolith MVP with separate actuals and forecast layers         |
| AI tone       | Conversational executive-style CFO assistant                   |
| Languages     | Localization-ready: English now; Russian, French, Arabic later |

## In Scope

- [ ] Clerk authentication and company-scoped data
- [ ] Upload center (trial balance, AR/AP ageing, bank balances, budget)
- [ ] Treasury rules engine and KPI calculations
- [ ] 13-week forecast engine
- [ ] Liquidity risk and rule-based alerts
- [ ] Budget vs actual
- [ ] Scenario sliders (revenue, payroll, receivable delay, expense growth)
- [ ] Executive dashboard
- [ ] AI CFO assistant with audit logging
- [ ] Demo datasets under `/samples`

## Explicitly Post-MVP

See [roadmap-post-mvp.md](./roadmap-post-mvp.md).

## Acceptance Criteria (Beta)

<!-- From engineering execution guide §7 -->

- Tenant isolation enforced
- Valid uploads produce forecast; invalid uploads show clear errors
- Dashboard: current cash, forecast cash, runway, liquidity status
- Scenario sliders recalculate forecast and liquidity
- Treasury formulas covered by unit tests with known outputs
- All UI labels use translation keys
