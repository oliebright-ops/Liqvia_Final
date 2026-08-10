/**
 * What the diagnosis form sends, and — just as importantly — what it does not.
 *
 * Run with:  pnpm --filter @liqvia2/frontend test
 *
 * The form shows a passive notice, so there is no acknowledgement event to
 * report and the payload must carry no affirmative consent at all. That absence
 * is the point of most of these assertions: a client that invented an `accepted:
 * true` would be fabricating an act the visitor never performed. The server half
 * of the pair lives in `backend/src/cash-os-leads/cash-os-leads.service.spec.ts`.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CASH_OS_LEAD_FORM_NOTICE_TEXT,
  LEAD_NOTICE_SUBJECT,
  LEAD_NOTICE_VERSION,
  MARKETING_CONSENT_ENABLED,
  lookupConsentText,
} from './consent';
import {
  LEAD_FORM_SOURCE,
  buildLeadPayload,
  type LeadFormValues,
  type MarketingConsentState,
} from './lead-submission';

const FILLED: LeadFormValues = {
  name: 'Иван Петров',
  companyName: 'ООО «Пример»',
  email: 'ivan@example.com',
  phone: '',
  employeeCount: '',
  industry: '',
  comment: '',
};

const TICKED_AT = '2026-08-10T10:15:00.000Z';

function marketingState(overrides: Partial<MarketingConsentState> = {}): MarketingConsentState {
  return { marketingGiven: false, marketingAcknowledgedAt: null, ...overrides };
}

test('a complete form produces a payload — nothing has to be ticked first', () => {
  const payload = buildLeadPayload(FILLED, marketingState());

  assert.equal(payload.name, 'Иван Петров');
  assert.equal(payload.email, 'ivan@example.com');
});

test('the payload claims no affirmative consent, because none was given', () => {
  const payload = buildLeadPayload(FILLED, marketingState());

  // The visitor ticked nothing. A `consent` object here would be the client
  // manufacturing an acknowledgement, which is exactly what the passive notice
  // must not do. The notice is recorded server-side from the registry instead.
  assert.ok(!('consent' in payload));
  assert.equal(JSON.stringify(payload).includes('accepted'), false);
});

test('the notice the form displays is registered, so the server can record it', () => {
  const entry = lookupConsentText(LEAD_NOTICE_SUBJECT, LEAD_NOTICE_VERSION);

  assert.ok(entry, 'the displayed notice must exist in the shared registry');
  assert.equal(entry.text, CASH_OS_LEAD_FORM_NOTICE_TEXT);
  // Not `required` and not `optional`: nothing about it is an acknowledgement.
  assert.equal(entry.obligation, 'notice');
});

test('the notice states a purpose and names no document the visitor must read', () => {
  assert.match(CASH_OS_LEAD_FORM_NOTICE_TEXT, /Нажимая кнопку/);
  assert.match(CASH_OS_LEAD_FORM_NOTICE_TEXT, /в целях обработки вашего обращения/);
  // The consent and privacy documents are still drafts. A notice that asserts the
  // visitor has read one of them would be evidence of something untrue.
  assert.doesNotMatch(CASH_OS_LEAD_FORM_NOTICE_TEXT, /ознакомлен/);
  assert.doesNotMatch(CASH_OS_LEAD_FORM_NOTICE_TEXT, /Политик/);
});

test('the lead records which form produced it', () => {
  const payload = buildLeadPayload(FILLED, marketingState());

  assert.equal(payload.source, LEAD_FORM_SOURCE);
  assert.equal(payload.source, 'cash-operating-system-landing');
});

test('empty optional fields are omitted rather than sent as empty strings', () => {
  const payload = buildLeadPayload(FILLED, marketingState());

  assert.equal(payload.phone, undefined);
  assert.equal(payload.comment, undefined);
});

test('marketing consent is never inferred from the submission itself', () => {
  const payload = buildLeadPayload(FILLED, marketingState({ marketingGiven: false }));

  assert.equal(payload.marketingConsent, undefined);
});

test('no marketing consent is produced while promotional messaging is disabled', () => {
  // Guards the current position: even a client that somehow ticks a marketing box
  // sends nothing while MARKETING_CONSENT_ENABLED is false. If that constant is
  // ever flipped on purpose, this expectation must be changed on purpose too.
  assert.equal(MARKETING_CONSENT_ENABLED, false);

  const payload = buildLeadPayload(
    FILLED,
    marketingState({ marketingGiven: true, marketingAcknowledgedAt: TICKED_AT }),
  );

  assert.equal(payload.marketingConsent, undefined);
});
