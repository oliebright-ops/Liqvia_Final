# RU production data flow — target state (Phases G, H, I, J, O, Q, V, X)

**Date:** 2026-08-10 · **Status:** target design; the residency guard and boundary tests are
implemented, the Yandex infrastructure is not.

This is the companion to `RU_CURRENT_LEAD_DATA_FLOW.md`. That one describes what runs today; this
one describes what must be true after cutover, and which parts are already enforced in code.

---

## 1. Target flow, field by field

```
Russian visitor
   │  HTTPS
   ▼
liqvia.info  (RU application runtime, Yandex Compute Cloud)
   │
   ├── Metrica: goal name only. No parameters, no UserID, no field values.
   │
   └── POST /api/cash-os-leads
         │
         ├── consent required, versioned, server-enforced  ────► reject if absent
         │
         └── ONE transaction, RU PostgreSQL
               ├── CashOsLead      (name, role, company, phone, email, headcount, industry, comment, source)
               └── ConsentRecord   (subject, version, policyVersion, wording, sha256, locale, method, acknowledgedAt)

   ✗ no SMTP        ✗ no OpenAI       ✗ no CRM/webhook
   ✗ no fallback to the global database — fail closed
   ✗ no personal data in logs
```

---

## 2. Phase O — lead form data minimisation

Current fields, audited against "what is needed to manage the enquiry".

| Field | Purpose | Required? | Personal data? | DB destination | Analytics exposure | Email exposure | Retention |
|---|---|---|---|---|---|---|---|
| `name` | Address the person correctly | **Yes** | **Yes** | `CashOsLead.name` | None | None | With lead |
| `email` | Reply to the enquiry | **Yes** | **Yes** | `.email` | None | None | With lead |
| `companyName` | Qualify the enquiry | **Yes** | Indirect — identifies employer | `.companyName` | None | None | With lead |
| `phone` | Alternative contact | No | **Yes** | `.phone` | None | None | With lead |
| `role` | Qualify seniority | No | **Yes** — job title | `.role` | None | None | With lead |
| `employeeCount` | Qualify size | No | No — company attribute | `.employeeCount` | None | None | With lead |
| `industry` | Qualify sector | No | No — company attribute | `.industry` | None | None | With lead |
| `comment` | The enquiry itself | No | **Yes — unbounded free text** | `.comment` | None | None | With lead |
| `source` | Campaign attribution | No | **Must remain non-identifying** | `.source` | None | None | With lead |

### Assessment

**No field is collected "in case it's useful later."** Each maps to handling the enquiry. Three
observations:

1. **`phone` and `email` are both collected, and only one is needed to reply.** `phone` is optional
   and unticked-by-default in effect, so this is defensible — but it is the first field to drop if
   minimisation is ever challenged. A phone number is a strong identifier and, in Russia, is
   commonly linked to identity documents.
2. **`comment` is the highest-risk field in the system.** It cannot be validated into safety — a
   person may type health information, third-party names, or account numbers. Mitigations already in
   place: it never reaches logs, analytics, email or AI. The remaining mitigations are access control
   and retention.
3. **`role` is personal data**, not a company attribute. It is a job title attached to a named
   individual. Classified correctly above; frequently misclassified.

**No new field may be added without a row in this table.** That is the control.

---

## 3. Phase G — consent evidence

The append-only `ConsentRecord` architecture is preserved unchanged. The RU deployment stores:

| Stored | Not stored |
|---|---|
| Lead reference (`cashOsLeadId`) | **IP address** |
| Subject / purpose (`subjectId`) | User agent |
| Registered wording version (`version`, `policyVersion`) | Device fingerprint |
| Accepted state (a record exists ⇔ it was accepted) | Geolocation |
| Timestamp (`acknowledgedAt`, server-validated) | Anything not listed left |
| Form source (`method`) | |
| The exact wording + `consentTextSha256` | |

> **IP addresses are deliberately not collected.** Phase G is explicit, and it is right: an IP is
> personal data in its own right, and adding it to prove consent means processing more personal data
> to justify processing personal data. The wording, its hash and a server-validated timestamp already
> answer "what did this person agree to, and when?".
>
> If legal advice later requires IP evidence, implement it **separately, after approval**, as an
> additive change with its own retention decision. Do not fold it into this migration.

The principle that must survive every future change:

> **What the user read == what the system stores as consent wording evidence.**

Enforced mechanically: the UI renders the registry string and posts it back; `ConsentService`
compares it to the registry, stores the *registry* copy on match, and flags `textVerified = false`
on mismatch rather than trusting the client. `segmentConsentText` guarantees the linked version
reassembles to the identical string.

---

## 4. Phase H — the required consent

`cash-os-lead-form@2026-08-10.1` (or its registered successor) remains:

| Property | Status | Enforced by |
|---|---|---|
| Unticked by default | ✅ | Lead form component |
| Required — blocks submission | ✅ | `assertRequiredConsent` |
| Server enforced | ✅ | Rejects any POST lacking it, regardless of the browser |
| Versioned | ✅ | `ACTIVE_CONSENT_VERSION` + append-only archive |
| Stored transactionally | ✅ | One `$transaction` with the lead |
| Cached-browser compatible | ✅ | **Any registered version is accepted**, and the record names the version actually displayed |

**Do not "tighten" the last row.** Rejecting a superseded-but-registered version would discard real
enquiries from people whose browser holds an older bundle, to no benefit — the evidence records which
wording they actually saw, which is the point. Only a *legal* reason to reject a version justifies
changing this.

The wording of `2026-08-10.1` was amended once, in place, on 2026-08-10 to remove the operator's ИНН.
That is normally forbidden and was permissible exactly once, because the version had never been
displayed to anyone and no stored record could reference it — proven by the absence of the
`ConsentRecord` table in production. **From its first deployment the append-only rule applies without
exception.**

---

## 5. Phase I — marketing consent stays off

`MARKETING_CONSENT_ENABLED` is `false`, from two independent conditions:

```ts
const PROMOTIONAL_MESSAGES_ARE_SENT = false;              // business fact
MARKETING_CONSENT_ENABLED = PROMOTIONAL_MESSAGES_ARE_SENT
                          && CASH_OS_LEAD_MARKETING_CONSENT_TEXT !== null;  // needs a verified opt-out address
```

**It must not be switched on as part of this migration.** Enabling it requires:

1. a verified opt-out address (`OPERATOR_CONTACT_EMAIL` is `null`) — the wording promises a channel,
   and registering it with a placeholder publishes a promise nobody can act on;
2. a decision that promotional messages will genuinely be sent;
3. separate legal readiness.

The invariant that protects the required consent: **submitting the consultation form must never
silently become marketing consent.** Enforced by `resolveMarketingConsent`, which drops an unusable
marketing consent, logs it, and still delivers the lead — and asserted by
`'never infers marketing consent from the required consent'`.

---

## 6. Phase J — privacy and consent pages

`/privacy` and `/consent` keep their current behaviour:

- `LEGAL_REVIEW_PENDING` state until wording is approved;
- visible draft banner;
- `noindex`;
- an explicit «НЕ УСТАНОВЛЕНО» marker wherever a fact is missing, never an invented value.

> **Infrastructure readiness is not legal-document approval.** Completing the Yandex migration
> changes nothing about whether these documents may be published. Do not remove `noindex` or the
> draft banner because the infrastructure went live.

`isLegalPublicationReady()` returns `false` while any fact is unverified, and the pages read from it
rather than from a hand-maintained flag. Publication is a **STOP CONDITION** and requires:

1. a verified contact email;
2. a verified postal address for legally significant requests;
3. resolution of every entry in `UNVERIFIED_PROCESSING_FACTS`;
4. legal approval of the wording.

Once (1)–(3) are resolved, produce a legal-review-ready diff. **Do not self-approve publication.**

### On the missing contact facts (Phase 0B)

`OPERATOR_CONTACT_EMAIL` and `OPERATOR_REQUESTS_ADDRESS_RU` remain `null`. They are **not** replaced
with `[EMAIL]`, `[ADDRESS]` or `[TO BE CONFIRMED]` — a placeholder in a published legal document
reads as a real, if odd, value, and a privacy notice naming an address nobody monitors is worse than
one not yet published.

When verified details arrive, classify each as public disclosure or private configuration. A postal
address for statutory requests is normally required to be public; that does not mean **a personal
residential address** must be. If another legally valid contact address exists, prefer it.
**LEGAL REVIEW REQUIRED.**

---

## 7. Phase Q — logging

**Implemented in this commit series.**

RU logs must never contain: name, email, phone, form free text, request body, cookies, tokens, or
consent content tied to an identity. They may contain: internal lead ID, request ID, operation,
status, error code, timestamp.

| Control | Status |
|---|---|
| `maskEmail`, `redactForLog`, `describeErrorForLog` | Pre-existing |
| **`describeErrorClassForLog`** — error class only, message discarded | **New** |
| Lead-path failures log the error class only | **New** |
| `ConsentService` never logs submitted wording | Pre-existing |
| Tests asserting no identifying value reaches any log level | **New** — `ru-lead-boundary.spec.ts` |

### Why a new helper was needed

`redactForLog` redacts what it can *recognise*: emails, phones, IBANs, long digit runs. It cannot
recognise a name or free text, because those have no pattern.

This was found by writing the test, not by reading the code. A Prisma write error embeds the row it
failed to write:

```
Invalid `prisma.cashOsLead.create()` invocation: … data: { name: "Иван Петров", email: …, comment: … }
```

Passed through `describeErrorForLog`, the email and phone were masked — and **the name and the
comment went to the log sink verbatim.** On the lead path the message is not sanitisable at all, so
`describeErrorClassForLog` discards it and keeps only the error class and driver code.

### Remaining gap — **OPEN**

Redaction is applied where a developer remembered to apply it. There is no framework-level guarantee
that an unhandled exception carrying a request body cannot reach the log sink: NestJS's default
exception filter logs the stack of an unhandled error, and a validation error on the lead DTO can
embed submitted values.

**Recommended:** a global exception filter that logs class + request ID and never the message, plus
a request-ID interceptor. Not implemented here — it changes global application behaviour and is out
of scope for the RU lead plane. Tracked as a pre-cutover item.

---

## 8. Phase V — AI

**Russian lead identity must never reach OpenAI, and does not.**

`CashOsLeadsService` depends on `PrismaService` and `ConsentService` only. There is no AI call on any
lead code path, and no reason for one to exist: a consultation request needs storing and answering,
not modelling.

The `AiPrivacyGateway` architecture is preserved and **not weakened**: a single reviewable provider
adapter, a schema rejecting identifying keys, counterparty pseudonymisation, and a lint + test
boundary (`ai-boundary.spec.ts`) preventing any other module from reaching a provider directly.

Proof added — `ru-lead-boundary.spec.ts`:

| Test | What it proves |
|---|---|
| `makes no outbound network call of any kind while storing a lead` | `fetch` is stubbed and asserted uncalled. Catches **any** provider added by any route, not just a mocked SDK |
| `depends on nothing beyond Prisma and the consent registry` | Constructor arity is the dependency boundary; injecting a gateway or mail client fails the test |

---

## 9. Phase X — fail closed

**Implemented.** `backend/src/residency/data-plane.ts`.

Two halves:

### 9.1 Boot time — refuse to start in the wrong place

`assertResidency()` runs in `createNestApplication` **before migrations and before the container**,
because running migrations first would create the RU tables in the wrong database.

With `LIQVIA_DATA_PLANE=ru`, the process refuses to start unless `DATABASE_URL` names a recognised
Russian host:

| Configuration | Result |
|---|---|
| `ru` + Yandex Managed PostgreSQL host | starts |
| `ru` + Render / Oregon host | **`ResidencyViolationError` — refuses to start** |
| `ru` + AWS / Neon / Supabase / Azure host | **refuses to start** |
| `ru` + missing or unparseable `DATABASE_URL` | **refuses to start** |
| `ru` + **unrecognised** host | **refuses to start** — an unknown host is not evidence of residency |
| `global` + anything | unaffected — today's behaviour exactly |

The unrecognised-host case is the one that matters. Treating "I don't recognise this" as "probably
fine" is how a residency guarantee rots quietly.

### 9.2 Request time — no fallback, ever

If the RU database is unavailable, the lead submission:

- **does not** fall back to the global database — there is deliberately no second destination;
- **does not** report success; it returns `503` with a Russian retry message, so the person resends
  rather than believing their enquiry arrived;
- stores no personal data anywhere;
- logs only non-sensitive diagnostics (§7).

Asserted by four tests in `ru-lead-boundary.spec.ts`, including that `$transaction` is attempted
**exactly once** — no retry against another destination.

---

## 10. Status summary

| Phase | Item | Status |
|---|---|---|
| G | Consent evidence, no IP | ✅ Preserved |
| H | Required consent versioned + enforced | ✅ Preserved |
| I | Marketing consent off | ✅ Preserved, two independent conditions |
| J | `/privacy`, `/consent`, `LEGAL_REVIEW_PENDING` | ✅ Preserved |
| O | Data minimisation audit | ✅ Complete — no field removed, `phone` flagged |
| Q | Logging redaction | ✅ Strengthened · ⚠️ global exception filter OPEN |
| V | No AI on the lead path | ✅ Proven by test |
| X | Fail closed | ✅ Implemented, boot + request time |
| — | RU infrastructure | ❌ Not created — **STOP CONDITION** |
| — | Legal wording | ❌ **LEGAL REVIEW REQUIRED** |
