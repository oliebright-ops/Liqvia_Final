/**
 * The publication gate, tested from the frontend side.
 *
 * Run with:  pnpm --filter @liqvia2/frontend test
 *
 * These assertions exist so that publishing the legal pages requires deleting a
 * test expectation on purpose, rather than happening as a side effect of an
 * unrelated change.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CASH_OS_LEAD_FORM_CONSENT_TEXT,
  CONSENT_DOCUMENT_PATH,
  CONSENT_LINK_PHRASES,
  MARKETING_CONSENT_ENABLED,
  OPERATOR_IDENTIFICATION_RU,
  isOperatorPostalAddressVerified,
  PRIVACY_POLICY_PATH,
  segmentConsentText,
} from './consent';
import {
  EXTERNAL_LEGAL_REVIEW_COMPLETE,
  LEGAL_REVIEW_STATUS,
  OWNER_APPROVED_FOR_PUBLICATION,
  UNVERIFIED_PROCESSING_FACTS,
  isLegalPublicationReady,
  openOwnerInputs,
  operatorContactBlock,
  publicationBlockers,
} from './legal-publication';
import { PRIVACY_POLICY_TITLE_RU, SITE_DISCLAIMER_RU } from './legal-text';

test('the operator is identified as a natural person, never as an entrepreneur', () => {
  assert.equal(
    OPERATOR_IDENTIFICATION_RU,
    'Оператор персональных данных: Оли Брайт Бабатунде, физическое лицо',
  );
  assert.ok(!OPERATOR_IDENTIFICATION_RU.includes('ОГРНИП'));
});

test('no tax identifier reaches the client bundle', () => {
  // Everything this module re-exports is imported by client components and is
  // therefore readable by any visitor. The ИНН belongs in server-side private
  // configuration — see packages/shared/src/operator.ts.
  for (const text of [OPERATOR_IDENTIFICATION_RU, CASH_OS_LEAD_FORM_CONSENT_TEXT]) {
    assert.ok(!text.includes('ИНН'), 'public wording must not quote a tax identifier');
    assert.ok(!/\d{4,}/.test(text), 'public wording must not quote a long identifier');
  }
});

test('the legal pages are not publishable while facts remain unverified', () => {
  assert.equal(isLegalPublicationReady(), false);
  assert.ok(publicationBlockers().length > 0);
  assert.ok(UNVERIFIED_PROCESSING_FACTS.length > 0);
});

test('the verified email is offered even though no postal address exists', () => {
  // Email and postal address are independent. Suppressing a mailbox that genuinely
  // works, because a second channel is missing, tells the reader they cannot reach
  // the operator when they can — which is its own false statement.
  const contact = operatorContactBlock();
  assert.ok(contact, 'a verified email must produce a contact block');
  assert.equal(contact.email, 'olie.bright@gmail.com');
});

test('the postal address is omitted, never invented or placeholdered', () => {
  const contact = operatorContactBlock();
  assert.equal(contact?.address, null);
  assert.equal(isOperatorPostalAddressVerified(), false);
  // Callers render a null address by leaving the line out entirely.
  assert.ok(openOwnerInputs().includes('OWNER INPUT REQUIRED — POSTAL ADDRESS'));
});

test('owner approval is recorded, and is never presented as legal review', () => {
  assert.equal(OWNER_APPROVED_FOR_PUBLICATION, true);
  assert.equal(EXTERNAL_LEGAL_REVIEW_COMPLETE, false);
  assert.equal(
    LEGAL_REVIEW_STATUS,
    'OWNER-APPROVED FOR PUBLICATION — NOT EXTERNALLY LEGALLY REVIEWED',
  );
  assert.ok(!LEGAL_REVIEW_STATUS.includes('LEGAL VERIFIED'));
  assert.ok(!LEGAL_REVIEW_STATUS.includes('LEGAL APPROVED'));
});

test('the consent checkbox links both documents by their exact referenced titles', () => {
  const segments = segmentConsentText(CASH_OS_LEAD_FORM_CONSENT_TEXT, [
    { phrase: CONSENT_LINK_PHRASES.consentDocument, href: CONSENT_DOCUMENT_PATH },
    { phrase: CONSENT_LINK_PHRASES.privacyPolicy, href: PRIVACY_POLICY_PATH },
  ]);

  assert.equal(segments.map((s) => s.text).join(''), CASH_OS_LEAD_FORM_CONSENT_TEXT);
  assert.deepEqual(
    segments.filter((s) => s.href).map((s) => [s.text, s.href]),
    [
      [CONSENT_LINK_PHRASES.consentDocument, CONSENT_DOCUMENT_PATH],
      [CONSENT_LINK_PHRASES.privacyPolicy, PRIVACY_POLICY_PATH],
    ],
  );
});

test('the privacy policy is titled the way the consent wording refers to it', () => {
  // «Я ознакомлен(а) с Политикой обработки персональных данных» must name a
  // document that actually carries that title.
  assert.equal(PRIVACY_POLICY_TITLE_RU, 'Политика обработки персональных данных');
  assert.ok(CASH_OS_LEAD_FORM_CONSENT_TEXT.includes(CONSENT_LINK_PHRASES.privacyPolicy));
});

test('the disclaimer is the approved wording, unparaphrased', () => {
  assert.ok(
    SITE_DISCLAIMER_RU.startsWith(
      'Информация и материалы, размещённые на Сайте, носят исключительно ' +
        'информационно-справочный характер.',
    ),
  );
  assert.ok(SITE_DISCLAIMER_RU.includes('не являются публичной офертой, если прямо не указано иное'));
  assert.ok(
    SITE_DISCLAIMER_RU.endsWith(
      'До принятия решений пользователю рекомендуется получить консультацию соответствующего ' +
        'квалифицированного специалиста.',
    ),
  );
});

test('the optional marketing checkbox stays off while no opt-out address exists', () => {
  assert.equal(MARKETING_CONSENT_ENABLED, false);
});
