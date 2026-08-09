# RU Yandex Metrica / Webvisor verification (Phases K, L, M)

**Date:** 2026-08-10 · **Counter:** `111417446` · **Method:** repository inspection at `fc026f8`
**plus live runtime verification against production `liqvia.info` using synthetic data only.**

> ## Result: **NO P0 RAISED**
>
> Synthetic name, email and phone were typed into the live production lead form. **No identifying
> value was transmitted to Yandex.** Webvisor is not recording. No session replay, no form
> analytics, no key capture, no submitted-field capture.
>
> This was measured, not assumed. See §3 for the raw evidence.

---

## 1. Test data used

Per Phase K, synthetic values only. Nothing real was entered, and **the form was never submitted** —
so no row was created in the production database and no conversion was recorded.

| Field | Value typed |
|---|---|
| Name | `TEST USER` |
| Email | `test@example.invalid` (RFC 6761 reserved TLD — cannot resolve) |
| Phone | `+7 000 000 00 00` |
| Company | *(not filled — three fields were sufficient to prove the negative)* |

Typed as real keystrokes into the live page, not injected by script, so any keystroke-level recorder
would have observed them.

---

## 2. Repository-side configuration (verified in source)

`frontend/src/components/analytics/yandex-metrica.tsx`:

```ts
window.ym(Number(METRICA_ID), 'init', {
  ssr: true,
  clickmap: true,
  accurateTrackBounce: true,
  trackLinks: true,
});
```

| Setting | Value | Assessment |
|---|---|---|
| `webvisor` | **not passed** ⇒ `false` | Session replay off at the tag |
| `clickmap` | `true` | Click coordinates and element identity. **Records where, not what.** Does not capture field values |
| `accurateTrackBounce` | `true` | Timer ping only |
| `trackLinks` | `true` | Outbound link URLs. Safe here — the landing page links to no URL carrying personal data |
| `params` / `userParams` | **never called** | No custom parameter dictionary is ever sent |
| `setUserID` | **never called** | No cross-session user identifier is assigned |

**Host gating** (`METRICA_HOSTS`): the counter initialises only on `liqvia.info` and
`www.liqvia.info`. It does **not** run on `liqvia-landing.onrender.com`, on the application domain,
or in local development. Verified live: `location.hostname === 'www.liqvia.info'` and
`Ya._metrika.counters` contains exactly `111417446:0`.

**Event surface** (`frontend/src/components/cash-os/analytics.ts`):

```ts
export function trackCtaEvent(event: CtaEvent): void {
  window.ym(Number(counterId), 'reachGoal', event);   // ← no fourth argument
}
```

`CtaEvent` is a closed TypeScript union of **ten literal strings** (`hero_primary_cta`,
`form_start`, `form_submit`, `deep_scroll_90`, …). There is no parameters object and no string
interpolation. **It is not possible to pass a form value through this function** — a caller
attempting it fails to type-check. This is the strongest control in the whole analytics path,
because it is enforced by the compiler rather than by review.

---

## 3. Runtime verification — the actual evidence

Live production page, real browser, real keystrokes.

### 3.1 Resources loaded

```
https://mc.yandex.ru/metrika/tag.js?id=111417446
https://mc.yandex.com/metrika/tag_phono.js
https://mc.yandex.com/watch/111417446          ← page hit
```

**No `webvisor*.js`, no `watch_syn.js`, no recorder module.** The counter object's method surface is
`hit, reachGoal, params, userParams, setUserID, clickmap, trackLinks, notBounce, extLink, file,
getClientID, experiments, getYmclid, firstPartyParams…` — **no Webvisor recorder is present**.

`tag_phono.js` is Metrica's phone-substitution module, loaded as part of the standard tag. It
performs number replacement for call tracking and does not read form fields. Call tracking is not in
use.

### 3.2 Network traffic after typing name + email + phone

Requests to Yandex before typing: **4**. After typing: **6**. The two new requests were:

```
1) mc.yandex.com/watch/111417446?page-url=goal%3A%2F%2Fwww.liqvia.info%2Fform_start&page-ref=…
2) mc.yandex.com/watch/111417446/1?page-url=https%3A%2F%2Fwww.liqvia.info%2F&…
```

- **(1)** is the `form_start` goal. The payload carries the **goal name only**, encoded as
  `goal://<host>/form_start`. No field value, no parameter dictionary.
- **(2)** is the `accurateTrackBounce` non-bounce ping.

**Requests to any webvisor/recorder endpoint: `[]` — zero.**

The typed values `TEST USER`, `test@example.invalid` and `+7 000 000 00 00` remained in the DOM and
appeared in **no** outbound request.

### 3.3 Phase K checklist

| Item | Finding | Verdict |
|---|---|---|
| Counter ID | `111417446`, one instance | ✅ |
| Host gating | `liqvia.info`, `www.liqvia.info` only | ✅ |
| Domains | Tag from `mc.yandex.ru`; hits to `mc.yandex.com` | ✅ (see §6) |
| **Webvisor ON/OFF** | **OFF** — no recorder loaded, no recorder traffic after keystrokes | ✅ |
| Form analytics | Not active | ✅ |
| Session replay | Not active | ✅ |
| Sensitive-field protection | **Moot** — nothing is recorded, so nothing needs masking | ✅ (see §5) |
| Field masking | Not applicable while Webvisor is off | ⚠️ becomes required if ever enabled |
| Key capture | **None observed** while typing into three fields | ✅ |
| Submitted-field capture | **None** — `form_submit` is a bare goal | ✅ |
| UserID | `setUserID` never called | ✅ |
| Custom events | 10 compile-time literals, no parameters | ✅ |
| Parameters | `params` / `userParams` never called | ✅ |

---

## 4. Phase L — identifying data must not reach Metrica

| Channel | Status | Basis |
|---|---|---|
| Metrica events | ✅ Clean | Closed literal union; no parameters argument |
| UserID | ✅ Clean | Never called |
| URL | ✅ Clean | Landing URL is `/`. No lead field is ever placed in a query string |
| Query string | ✅ Clean | `source` is the fixed literal `'cash-operating-system-landing'`, not `window.location` |
| UTM tags | ✅ Clean | No UTM is read into the application at all (see §5.2) |
| JavaScript parameters | ✅ Clean | No parameter dictionary is constructed anywhere |
| **Page titles** | ⚠️ **Transmitted** | The `t=` field of every hit carries `document.title` |

**On page titles.** Metrica sends the page title with every hit — verified in the captured payload
(`t=Прибыль есть, а денег не хватает? — Cash Operating System`). Today that is a marketing headline
containing no personal data, so there is no issue. It becomes one the moment any page renders a
person's name or reference into its title — for example a future "Заявка RU-000143" view. Phase L
lists page titles for exactly this reason.

→ **Rule:** no RU page title may ever contain a lead name, email, phone or reference. Applies to the
authenticated RU application when it is built.

---

## 5. Findings and residual risks

### 5.1 Webvisor is off by configuration, not by guarantee — **MEDIUM**

Webvisor is currently off, and that is the correct state. But nothing in the repository *enforces*
it. Webvisor can be enabled entirely from the Metrica console UI, by anyone with access to the
counter, without a code change, a review or a deployment.

If that happens, session replay begins recording the lead form — and Metrica's default masking does
**not** cover arbitrary text inputs. Name, company and the free-text `comment` field would be
recorded verbatim and replayable.

**Recommended, and cheap:**

1. Pass `webvisor: false` **explicitly** in the `init` call, so the intent is stated in code and any
   change to it appears in a diff and a review.
2. Apply Metrica's `data-ym-disable-keys` / input-masking attributes to the lead form's fields
   **now**, while Webvisor is off. They cost nothing today and are the difference between a
   contained mistake and a full replay archive of Russian personal data if it is ever switched on.
3. Restrict Metrica console access — see `RU_ACCESS_CONTROL.md`.

Item 1 is a one-line change and is **not** applied here, because touching the deployed analytics path
is out of scope for a documentation phase. It is listed in `RU_CUTOVER_PLAN.md` as a pre-cutover item.

### 5.2 No campaign attribution reaches the database — **LOW, by design**

`source` is a hard-coded literal, so `yclid`, UTM values and campaign identity never enter
`CashOsLead`. Privacy-wise this is the safest possible arrangement.

Commercially it means **you cannot tell which Yandex Direct campaign produced which lead** from the
database. Attribution exists only inside Metrica.

For Phase M, if per-lead campaign attribution is wanted, the correct approach is to capture a
**non-identifying campaign ID only** into `source`:

```
utm_source=yandex_direct
utm_campaign=ru_cash_visibility_01
utm_content=owner_cash_gap
utm_term={keyword}
```

→ store **`ru_cash_visibility_01`** (an allow-listed campaign identifier), never the raw URL, never
the full query string, never `yclid` alongside personal data. Parsing `window.location.search` into
`source` unfiltered is the mistake to avoid: it would drag whatever else is in the address bar into
the lead table. **Not implemented; requires a decision.**

### 5.3 Console-side settings not directly verified — **OPEN, owner action**

Everything above is measured from the browser and the repository. Three Metrica console settings
cannot be read without authenticating to the counter's Yandex account, which I have neither
credentials for nor permission to use:

| Setting | Why it matters | Runtime evidence available |
|---|---|---|
| «Вебвизор, карта скроллинга, аналитика форм» | Master switch for recording | **Strong: off.** No recorder loaded; no traffic after keystrokes |
| Data retention period | How long Metrica keeps hit data | None — console only |
| Counter access list | Who can turn Webvisor on | None — console only |

**Owner action — five minutes, before any paid traffic:**

1. Open `metrika.yandex.ru` → counter `111417446` → **Настройки**.
2. **Вебвизор** tab: confirm «Вебвизор» is **off** and «Аналитика форм» is **off**.
   If either is on, turn it off — the runtime evidence says recording is not happening, but the
   console is the authority on the setting.
3. **Настройки → Доступ**: confirm the access list contains only people who should have it. Remove
   any agency, contractor or legacy account.
4. Record the retention period.

The runtime evidence in §3 is strong enough that this is a **confirmation**, not an investigation.
No P0 is raised on the basis of an unverified console setting, because the observable behaviour is
unambiguous: nothing was recorded.

### 5.4 Live form has no consent checkbox — **HIGH, but not a Metrica issue**

Verified live: `document.querySelector('input[type=checkbox]')` returns `null`. The production form
uses submission-implied agreement, not an affirmative act. This is the defect that checkpoint
`fc026f8` fixes and has not yet deployed. Recorded here because it was observed during this test;
tracked in `RU_CURRENT_LEAD_DATA_FLOW.md` §3.

---

## 6. Phase M — Yandex Direct attribution

**Not yet verified: no Direct account has been linked and no campaign has run.** There is nothing to
inspect.

When Direct is set up:

| Requirement | Position |
|---|---|
| Direct ↔ Metrica link | Link counter `111417446` to the Direct account so `yclid` attribution resolves inside Metrica |
| `yclid` | Handled inside Metrica. **Do not** persist it next to lead personal data |
| Campaign / ad / keyword | Non-identifying identifiers only |
| UTM scheme | As in §5.2 |
| Personal data in URLs | **Never.** No lead field may appear in any advertising URL, landing URL or query string |

### Phase N — offline conversions

If qualified-consultation or pilot-acceptance outcomes are ever uploaded back to Yandex, **review
the mechanism before using it**. Do not upload name, email or phone through improvised CSV or event
fields. Use Yandex-supported non-identifying conversion linkage (`yclid`-based), and document the
exact identifier used. **No mechanism is proposed here** — it is not needed until there are
conversions to report.

---

## 7. Verdict

| Question | Answer |
|---|---|
| Are identifying values visible to Yandex? | **No.** Measured with synthetic name, email and phone on the live site |
| Is Webvisor recording? | **No.** No recorder loaded, no recorder traffic |
| Is a P0 raised? | **No** |
| May paid traffic start on this basis? | **Not yet** — for reasons unrelated to Metrica: the live form has no consent checkbox and `/privacy` is unreachable. See `RU_CUTOVER_PLAN.md` |

**Metrica/Webvisor: GO.** It is, at present, the best-behaved component in the entire Russian data
path.

**LEGAL REVIEW REQUIRED** for whether analytics on Russian visitors requires its own consent basis
separate from the lead-form consent. That is a legal question and is not answered here.
