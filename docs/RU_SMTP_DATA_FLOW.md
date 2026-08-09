# RU SMTP / lead delivery data flow (Phase P)

**Date:** 2026-08-10 · **Status of the blocking fact:** **RESOLVED — no lead email path exists**

---

## 1. The blocking fact, answered

Phase P treats the SMTP provider as a blocking fact because a foreign mail processor receiving
name + email + phone + free-text comment would be a second, uncontrolled copy of every Russian lead,
outside the residency boundary and typically retained indefinitely in a mailbox.

**That path does not exist in Liqvia today.**

Verified in source at `fc026f8`:

- `MailService` (`backend/src/auth/mail.service.ts`) has exactly one public send method,
  `sendPasswordResetEmail(to, resetUrl)`.
- It is injected in exactly one place: `AuthService`. `grep` over `backend/src` returns no other
  consumer.
- `CashOsLeadsService` imports `PrismaService` and `ConsentService` and nothing else. There is no
  mail, webhook, queue or outbound HTTP call on any lead code path.

**A lead submission sends no email to anyone.** Not to the operator, not to the person who submitted
it. The submission is written to the database and the request returns `{ status: 'ok' }`.

---

## 2. Consequences, both good and bad

**Good, and worth preserving:** there is no foreign processor holding Russian lead personal data in a
mailbox. The design goal of Phase P is already satisfied, by absence rather than by design. It
should now be satisfied *by design*, so that a well-meaning future change does not reintroduce it.

**Bad, and the reason this cannot simply be left alone:** nobody is notified when a lead arrives.
Once Yandex Direct spend begins, enquiries land in a database table that nothing watches. A paid
consultation request that goes unanswered for a week is a commercial failure regardless of its
privacy properties.

So this is not "no change needed". It is "the obvious fix is the dangerous one".

---

## 3. Current mail infrastructure, for completeness

| Fact | Value | Jurisdiction |
|---|---|---|
| Domain MX | `mx00.ionos.com`, `mx01.ionos.com` | **NON-RU** |
| Domain SPF | `v=spf1 include:_spf-us.ionos.com ~all` | **NON-RU — US** (`_spf-us`) |
| Application SMTP host | `SMTP_HOST`, `sync: false` in `render.yaml` — **not set in the repository** | **UNKNOWN** |
| Application SMTP sender | `SMTP_FROM` defaults to `noreply@liqvia.com` | — |
| Is application SMTP configured in production? | **UNKNOWN** — dashboard value not verified | — |

`MailService.getTransporter()` returns `null` when `SMTP_HOST` is unset, and password-reset mail is
silently skipped with a masked-address warning. Whether production has a value configured is a
**dashboard fact that has not been verified** and is not needed for the RU lead plane.

Note the `SMTP_FROM` default is `noreply@liqvia.**com**` while the domain audited here is
`liqvia.**info**`. Not a residency issue; flagged because a mismatched envelope sender is a common
cause of silent delivery failure.

---

## 4. Proposed notification model — report first, implement after approval

Phase P asks for the current behaviour and a proposed change, not a blind implementation. This is the
proposal. **It is not implemented.**

### 4.1 Principle

> The notification says **that** a lead exists. It never says **who** it is.

Identity is retrieved by an authorised person, through the RU-hosted interface, over an
authenticated session, leaving an access record. It is not pushed to a mailbox.

### 4.2 Proposed notification body

```
Новая заявка Liqvia (Россия).
Идентификатор: RU-000143
Получена: 2026-08-14 09:22 MSK
Кампания: ru_cash_visibility_01

Открыть: https://<ru-host>/leads/RU-000143
```

Contains: an internal reference, a timestamp, a non-identifying campaign ID, a link.
Contains no name, no email, no phone, no company, no comment. Nothing in it is personal data of the
person who submitted the form, so it does not matter where the mail provider is.

This survives the "screenshot in a group chat" test, the "mailbox is breached" test, and the
"forwarded to a contractor" test — the failure mode is a leaked reference number.

### 4.3 What this requires

The link implies something that does not exist yet: an authenticated RU-hosted view of a lead. That
is a genuine piece of work, not a config change, and it brings authentication into a plane
deliberately designed without it.

Options, in order of increasing cost:

| Option | Notification | Retrieval | Cost | Assessment |
|---|---|---|---|---|
| **A. Reference-only email → direct DB access** | As above, minus the link | Operator queries the RU database directly | None beyond the mailer | Viable immediately; retrieval is unattributable and awkward |
| **B. Reference-only email → minimal authenticated lead view** | As above | RU-hosted, authenticated, access-logged | Moderate — one route, one auth mechanism | **Recommended.** The proposal as written |
| **C. No email; scheduled digest** | Daily count only | Same as B | Same as B | Lower urgency signal; fine for low volume |

**Recommendation: A at cutover, B shortly after.** Option A is safe on day one and needs almost
nothing; B is the destination. Neither is implemented, and B needs approval because it introduces
authentication.

### 4.4 Where the notification mail may go

Because the body contains no personal data of the data subject, the mail provider's jurisdiction is
not a residency question. The **recipient's** mailbox is still a security surface — the reference
number links to real data — so it should be an account with meaningful access control, not a shared
inbox.

If a notification is ever enriched with identifying content, this analysis is void and the provider
becomes a processor of Russian personal data. **That is exactly the change that must never be made
casually**, which is why §5 makes it fail rather than merely discouraging it.

---

## 5. Guard against reintroduction

The risk here is not the current state — it is the future one-line change: "just put the name in the
email so I can see who it is". That change looks helpful, takes thirty seconds, passes review, and
silently exports every Russian lead to a foreign mail processor.

Proposed control, to be implemented with the notification itself:

1. **A test that fails if `CashOsLeadsService` gains a mail dependency**, in the style of the
   existing `ai-boundary.spec.ts` — which already proves this pattern works in this codebase.
2. **A payload assertion** on the notification builder: the rendered body must not contain the
   lead's `name`, `email`, `phone`, `companyName` or `comment`.
3. **An ESLint boundary rule** preventing `MailService` from being imported into the lead module.

Tracked in `RU_PRODUCTION_DATA_FLOW.md` §Q.

---

## 6. Summary

| Phase P question | Answer |
|---|---|
| Provider | **None in the lead path.** Domain mail is IONOS |
| Region where known | IONOS **US** (`_spf-us.ionos.com`); application `SMTP_HOST` **UNKNOWN** |
| What lead information appears in email | **None** — no lead email is sent |
| Whether email contents are retained | N/A |
| Whether message logs contain identities | N/A. `MailService` masks addresses via `maskEmail` and never logs raw provider errors |
| Proposed change | Reference-only notification (§4.2). **Not implemented. Requires approval.** |

**LEGAL REVIEW REQUIRED** before the notification model is treated as satisfying any statutory
obligation. This document establishes technical facts, not compliance conclusions.
