# Post-MVP Roadmap

Architecture must preserve hooks for these integrations. Document external ID fields in schema and API contracts.

## Must-Add (Post-MVP)

| Priority | Item                                              |
| -------- | ------------------------------------------------- |
| High     | Xero integration                                  |
| High     | QuickBooks integration                            |
| High     | Live bank feeds and account aggregation           |
| Medium   | AI smart column mapping for uploads               |
| Medium   | Automated actuals refresh from accounting systems |
| Medium   | Real-time liquidity monitoring                    |

## Later Modules

- Debt covenant tracking
- Payment scheduling optimisation
- Advanced driver-based forecasting
- Low-code custom workflow builder
- Inventory, procurement, CRM

## Architecture Preservation

<!-- Implementation notes -->

- Keep `externalSource` / `externalId` on accounts, movements, and upload batches
- Separate **actual** layer from **forecast** and **scenario** layers
- Upload validation schemas versioned for template evolution
- Webhook/event placeholders for bank and ERP sync
