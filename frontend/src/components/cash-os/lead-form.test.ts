/**
 * What the diagnosis-request form actually renders.
 *
 * Run with:  pnpm --filter @liqvia2/frontend test
 *
 * The audit questions this answers are structural, and each of them was
 * previously verifiable only by driving a browser: is there a checkbox, is it
 * unticked, is it required, is it above the submit button, does its label say
 * exactly what the registry says, and do both documents it names resolve. A
 * consent that quietly becomes pre-ticked, optional, or detached from its
 * wording is not a consent, and none of those regressions is visible in review.
 *
 * Rendered with `react-dom/server`, so this covers the markup the user is first
 * served. Behaviour after hydration — that an unticked box produces nothing to
 * send — is covered in `src/lib/lead-submission.test.ts` instead, without
 * needing a DOM.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CASH_OS_LEAD_FORM_CONSENT_TEXT,
  CONSENT_DOCUMENT_PATH,
  CONSENT_REQUIRED_MESSAGE_RU,
  MARKETING_CONSENT_ENABLED,
  PRIVACY_POLICY_PATH,
} from '@/lib/consent';
import { LeadFormSection } from './lead-form';

const html = renderToStaticMarkup(createElement(LeadFormSection));

/** The consent input as rendered, isolated so attribute assertions cannot match a different field. */
const consentInput = html.match(/<input[^>]*id="consent-personal-data"[^>]*>/)?.[0] ?? '';

/** Text with tags stripped and whitespace collapsed, for comparing against registry wording. */
function visibleText(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

test('a consent checkbox is rendered at all', () => {
  assert.ok(consentInput, 'no #consent-personal-data input in the rendered form');
  assert.match(consentInput, /type="checkbox"/);
});

test('the checkbox is unticked in the markup the user is first served', () => {
  // A pre-ticked box is not consent under 152-FZ: the user must act.
  assert.doesNotMatch(consentInput, /\bchecked\b/);
});

test('the checkbox is required, so it blocks submission without any script running', () => {
  assert.match(consentInput, /required/);
});

test('the consent appears before the submit button, not after it as a disclaimer', () => {
  const consentAt = html.indexOf('id="consent-personal-data"');
  const submitAt = html.indexOf('type="submit"');

  assert.notEqual(consentAt, -1);
  assert.notEqual(submitAt, -1);
  assert.ok(consentAt < submitAt, 'consent must precede the submit button');
});

test('the label reads exactly what the registry registers as the consent wording', () => {
  const label = html.match(/<label[^>]*for="consent-personal-data"[^>]*>([\s\S]*?)<\/label>/)?.[1];

  assert.ok(label, 'no label bound to the consent checkbox');
  // Byte-identical to the stored evidence, once link markup is stripped. If these
  // ever diverge, the record no longer proves what the person actually read.
  assert.equal(visibleText(label), CASH_OS_LEAD_FORM_CONSENT_TEXT);
});

test('both named documents are real links that open without discarding the form', () => {
  const label = html.match(/<label[^>]*for="consent-personal-data"[^>]*>([\s\S]*?)<\/label>/)?.[1] ?? '';
  const anchors = label.match(/<a[^>]*>/g) ?? [];

  assert.equal(anchors.length, 2, 'expected the consent document and the privacy policy');
  assert.ok(anchors.some((a) => a.includes(`href="${CONSENT_DOCUMENT_PATH}"`)));
  assert.ok(anchors.some((a) => a.includes(`href="${PRIVACY_POLICY_PATH}"`)));
  for (const anchor of anchors) {
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, /rel="noopener noreferrer"/);
  }
});

test('the submit button is not disabled, so the Russian validation message can surface', () => {
  const submit = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? '';
  // Strip `class` first: the Tailwind utility `disabled:opacity-50` lives there
  // and is not the attribute being asserted.
  const attributes = submit.replace(/\sclass="[^"]*"/, '');

  assert.ok(submit);
  assert.doesNotMatch(attributes, /\bdisabled\b/);
});

test('the form keeps its contents out of Yandex Webvisor recordings', () => {
  const form = html.match(/<form[^>]*>/)?.[0] ?? '';

  assert.match(form, /ym-hide-content/);
  assert.match(form, /ym-disable-keys/);
});

test('the marketing checkbox is absent while promotional messaging is disabled', () => {
  assert.equal(MARKETING_CONSENT_ENABLED, false);
  assert.doesNotMatch(html, /id="consent-marketing"/);
});

test('the Russian refusal message is the one the registry defines', () => {
  // Rendered only after a blocked attempt, so assert the constant the component
  // imports rather than the initial markup.
  assert.match(CONSENT_REQUIRED_MESSAGE_RU, /согласие на обработку персональных данных/);
});
