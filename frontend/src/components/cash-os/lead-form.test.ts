/**
 * What the diagnosis-request form actually renders.
 *
 * Run with:  pnpm --filter @liqvia2/frontend test
 *
 * The form asks for no affirmative act: there is no consent checkbox, and the
 * visitor can submit without ticking anything. What must be there instead is the
 * passive notice, next to the button whose press it describes, reading exactly
 * what the registry registers — because that registry entry is what the server
 * stores as the record of what was displayed. A notice that quietly drifts from
 * the stored wording, or disappears from the page entirely, is not visible in
 * review, so it is asserted here.
 *
 * Rendered with `react-dom/server`, so this covers the markup the user is first
 * served.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CASH_OS_LEAD_FORM_NOTICE_TEXT, MARKETING_CONSENT_ENABLED } from '@/lib/consent';
import { LeadFormSection } from './lead-form';

const html = renderToStaticMarkup(createElement(LeadFormSection));

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

test('no consent checkbox is rendered at all', () => {
  // The visitor must be able to submit without ticking anything.
  assert.doesNotMatch(html, /id="consent-personal-data"/);
  assert.doesNotMatch(html, /type="checkbox"/);
});

test('no field in the form is a required checkbox that could block submission', () => {
  const inputs = html.match(/<input[^>]*>/g) ?? [];
  const requiredCheckboxes = inputs.filter(
    (input) => /type="checkbox"/.test(input) && /\brequired\b/.test(input),
  );

  assert.deepEqual(requiredCheckboxes, []);
});

test('the passive notice is rendered', () => {
  assert.match(html, /id="lead-form-privacy-notice"/);
});

test('the notice reads exactly what the registry registers', () => {
  const notice = html.match(/<p[^>]*id="lead-form-privacy-notice"[^>]*>([\s\S]*?)<\/p>/)?.[1];

  assert.ok(notice, 'no #lead-form-privacy-notice paragraph in the rendered form');
  // Byte-identical to what the server stores as the displayed wording. If these
  // diverge, the record no longer describes what the person actually saw.
  assert.equal(visibleText(notice), CASH_OS_LEAD_FORM_NOTICE_TEXT);
});

test('the notice sits next to the submit button, which is the act it describes', () => {
  const noticeAt = html.indexOf('id="lead-form-privacy-notice"');
  const submitAt = html.indexOf('type="submit"');

  assert.notEqual(noticeAt, -1);
  assert.notEqual(submitAt, -1);
  assert.ok(submitAt < noticeAt, 'the notice must follow the button it refers to');
});

test('the notice asks the visitor to open nothing before submitting', () => {
  const notice = html.match(/<p[^>]*id="lead-form-privacy-notice"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '';

  // Deliberate: /consent and /privacy are still drafts, so the notice must not
  // present them as documents the visitor has read.
  assert.deepEqual(notice.match(/<a[^>]*>/g), null);
});

test('the submit button is not disabled', () => {
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
