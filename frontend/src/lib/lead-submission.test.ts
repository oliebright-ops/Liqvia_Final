/**
 * The rule that an unticked consent produces nothing to send.
 *
 * Run with:  pnpm --filter @liqvia2/frontend test
 *
 * These assertions are the client half of the pair; the server half lives in
 * `backend/src/cash-os-leads/cash-os-leads.service.spec.ts`, which rejects the
 * same submissions when they arrive by some other route. Neither is sufficient
 * alone: the browser guard protects the user, the server guard is the control.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVE_CONSENT_VERSION,
  CASH_OS_LEAD_FORM_CONSENT_TEXT,
  MARKETING_CONSENT_ENABLED,
  MARKETING_LEAD_CONSENT_SUBJECT,
  REQUIRED_LEAD_CONSENT_SUBJECT,
} from './consent';
import {
  LEAD_FORM_SOURCE,
  buildLeadSubmission,
  type ConsentState,
  type LeadFormValues,
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

function consentState(overrides: Partial<ConsentState> = {}): ConsentState {
  return {
    consentGiven: false,
    consentAcknowledgedAt: null,
    marketingGiven: false,
    marketingAcknowledgedAt: null,
    ...overrides,
  };
}

test('an unticked consent produces no payload, however complete the rest of the form is', () => {
  const result = buildLeadSubmission(FILLED, consentState({ consentGiven: false }));

  assert.equal(result.blocked, true);
  assert.equal(result.blocked && result.reason, 'consent-not-given');
  // There is deliberately no payload on a blocked result: the caller cannot send
  // one by mistake, because there is nothing to send.
  assert.ok(!('payload' in result));
});

test('a ticked consent produces a lead payload carrying its own evidence', () => {
  const result = buildLeadSubmission(
    FILLED,
    consentState({ consentGiven: true, consentAcknowledgedAt: TICKED_AT }),
  );

  assert.equal(result.blocked, false);
  if (result.blocked) return;

  assert.deepEqual(result.payload.consent, {
    subjectId: REQUIRED_LEAD_CONSENT_SUBJECT,
    version: ACTIVE_CONSENT_VERSION[REQUIRED_LEAD_CONSENT_SUBJECT],
    consentText: CASH_OS_LEAD_FORM_CONSENT_TEXT,
    locale: 'ru',
    accepted: true,
    acknowledgedAt: TICKED_AT,
  });
});

test('the wording sent as evidence is the registry wording, not a copy that can drift', () => {
  const result = buildLeadSubmission(
    FILLED,
    consentState({ consentGiven: true, consentAcknowledgedAt: TICKED_AT }),
  );

  assert.equal(result.blocked, false);
  if (result.blocked) return;
  // Identity, not equality: the payload must reference the registry constant.
  assert.equal(result.payload.consent.consentText, CASH_OS_LEAD_FORM_CONSENT_TEXT);
  assert.equal(result.payload.consent.accepted, true);
});

test('the lead records which form produced it', () => {
  const result = buildLeadSubmission(FILLED, consentState({ consentGiven: true }));

  assert.equal(result.blocked, false);
  if (result.blocked) return;
  assert.equal(result.payload.source, LEAD_FORM_SOURCE);
  assert.equal(result.payload.source, 'cash-operating-system-landing');
});

test('the acknowledgement timestamp is when the box was ticked, not when the form was sent', () => {
  const sentAt = '2026-08-10T18:00:00.000Z';
  const result = buildLeadSubmission(
    FILLED,
    consentState({ consentGiven: true, consentAcknowledgedAt: TICKED_AT }),
    () => sentAt,
  );

  assert.equal(result.blocked, false);
  if (result.blocked) return;
  assert.equal(result.payload.consent.acknowledgedAt, TICKED_AT);
  assert.notEqual(result.payload.consent.acknowledgedAt, sentAt);
});

test('a tick with no recorded moment falls back to now rather than to no timestamp at all', () => {
  const now = '2026-08-10T18:00:00.000Z';
  const result = buildLeadSubmission(
    FILLED,
    consentState({ consentGiven: true, consentAcknowledgedAt: null }),
    () => now,
  );

  assert.equal(result.blocked, false);
  if (result.blocked) return;
  assert.equal(result.payload.consent.acknowledgedAt, now);
});

test('empty optional fields are omitted rather than sent as empty strings', () => {
  const result = buildLeadSubmission(FILLED, consentState({ consentGiven: true }));

  assert.equal(result.blocked, false);
  if (result.blocked) return;
  assert.equal(result.payload.phone, undefined);
  assert.equal(result.payload.comment, undefined);
});

test('marketing consent is never inferred from the required consent', () => {
  const result = buildLeadSubmission(
    FILLED,
    consentState({ consentGiven: true, marketingGiven: false }),
  );

  assert.equal(result.blocked, false);
  if (result.blocked) return;
  assert.equal(result.payload.marketingConsent, undefined);
});

test('no marketing consent is produced while promotional messaging is disabled', () => {
  // Guards the current position: even a client that somehow ticks a marketing box
  // sends nothing while MARKETING_CONSENT_ENABLED is false. If that constant is
  // ever flipped on purpose, this expectation must be changed on purpose too.
  assert.equal(MARKETING_CONSENT_ENABLED, false);

  const result = buildLeadSubmission(
    FILLED,
    consentState({
      consentGiven: true,
      marketingGiven: true,
      marketingAcknowledgedAt: TICKED_AT,
    }),
  );

  assert.equal(result.blocked, false);
  if (result.blocked) return;
  assert.equal(result.payload.marketingConsent, undefined);
  assert.notEqual(result.payload.consent.subjectId, MARKETING_LEAD_CONSENT_SUBJECT);
});
