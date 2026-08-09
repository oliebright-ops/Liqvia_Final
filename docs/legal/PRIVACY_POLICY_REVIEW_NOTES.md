# Privacy Policy — Items Requiring Counsel

**Page:** `frontend/src/app/privacy/page.tsx`
**Route:** `/privacy`
**Version constant:** `CONSENT_POLICY_VERSION` in `packages/shared/src/consent.ts`
**Current state:** `LEGAL_REVIEW_PENDING = true` — the page renders a visible draft banner and is
excluded from search indexing via `metadata.robots`.

The factual sections of the policy (what is collected, which processors receive what, what the
AI gateway does and does not transmit) were written from direct inspection of the source and are
believed accurate. **They are engineering statements, not legal ones.** Everything below is
marked in the page with a `<LegalReview id="…">` element rendering a highlighted placeholder;
each `id` corresponds to a row here.

| `id`                     | Section | What counsel must supply                                                                                    | Also blocked by |
| ------------------------ | ------- | ----------------------------------------------------------------------------------------------------------- | --------------- |
| `controller-identity`    | 1       | Full legal entity name, registration number, registered address, contact details of the operator/controller | U12             |
| `controller-identity-en` | 1       | English rendering of the same                                                                               | U12             |
| `lawful-basis`           | 3       | The lawful bases relied on under each applicable law, including for cross-border transfer                   | —               |
| `ai-processor-terms`     | 4       | The OpenAI data-processing terms in force and the transfer mechanism relied on                              | U7              |
| `hosting-region`         | 6       | Where data is stored, backup location and retention — **no region may be asserted until verified**           | U1, U2, U3, U10 |
| `retention-periods`      | 7       | Retention period per data category (leads, accounts, uploaded financial data, logs, consent records)         | —               |
| `data-subject-rights`    | 8       | Rights available and the procedure to exercise them, including consent withdrawal and response deadlines     | —               |
| `contact-details`        | 10      | Contact address for data-protection enquiries; representative/responsible person if required                 | U12             |

## Additional questions for counsel

1. **Which law(s) govern.** The product is marketed in English, Spanish, French and Russian, and
   the `liqvia.info` landing page targets Russian-speaking businesses. Which regimes apply, and
   does the answer differ per surface?

2. **Consent record contents.** `ConsentRecord` (see `backend/prisma/schema.prisma`) stores the
   notice id, version, privacy-policy version, locale, the verbatim wording, its SHA-256, a
   verification flag, the method (`checkbox`) and a server-side timestamp. It deliberately does
   **not** store IP address or user agent, because that would add personal data solely for
   evidentiary purposes. **Does the applicable law require IP capture for valid consent
   evidence?** If yes, the schema must be extended and this decision recorded.

3. **Consent versioning.** Existing `CashOsLead` rows created before this change have no
   `ConsentRecord`. Those submissions displayed a passive notice ("by submitting you agree…")
   with no affirmative act and no evidence. Counsel should advise whether those leads may still
   be contacted, or whether re-consent is required.

4. **Retention of the free-text comment field.** The lead form's final field invites open text
   and could contain anything. Should it be retained on the same schedule as the rest of the
   lead, or shorter?

5. **Yandex Metrica and consent.** The `liqvia.info` landing page loads Metrica on first paint
   with no cookie or analytics consent gate. Whether that is lawful depends on the applicable
   regime and on U8 (whether Webvisor is recording form input). This is unresolved and is a
   live finding, not a hypothetical.

6. **Publication decision.** Publishing a policy marked "draft" is itself a choice. Counsel
   should confirm whether it is better to publish the reviewed document only, or to publish the
   draft now (as the consent notice already links to it) and replace it on sign-off.

## Release gate

Set `LEGAL_REVIEW_PENDING = false` and remove `metadata.robots` only when:

- every row in the table above is resolved in writing by counsel;
- every blocking item in `docs/CONSOLE_VERIFICATION_U1_U12.md` is verified;
- `CONSENT_POLICY_VERSION` has been bumped and a matching consent-text version added to
  `CONSENT_TEXT_ARCHIVE`, so records written against the draft remain distinguishable from
  records written against the approved text.
