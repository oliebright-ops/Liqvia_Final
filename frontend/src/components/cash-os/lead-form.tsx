'use client';

import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';
import {
  ACTIVE_CONSENT_VERSION,
  CASH_OS_LEAD_FORM_CONSENT_TEXT,
  CASH_OS_LEAD_MARKETING_CONSENT_TEXT,
  CONSENT_DOCUMENT_PATH,
  CONSENT_LINK_PHRASES,
  CONSENT_REQUIRED_MESSAGE_RU,
  MARKETING_CONSENT_ENABLED,
  MARKETING_LEAD_CONSENT_SUBJECT,
  PRIVACY_POLICY_PATH,
  REQUIRED_LEAD_CONSENT_SUBJECT,
  segmentConsentText,
  type ConsentTextSegment,
} from '@/lib/consent';
import { trackCtaEvent } from './analytics';
import { Container, Section, SectionHeading } from './primitives';

const CONSENT_VERSION = ACTIVE_CONSENT_VERSION[REQUIRED_LEAD_CONSENT_SUBJECT];
const MARKETING_CONSENT_VERSION = ACTIVE_CONSENT_VERSION[MARKETING_LEAD_CONSENT_SUBJECT];

/**
 * The required notice, split so that «Согласием на обработку персональных данных»
 * and «Политикой обработки персональных данных» render as separate links while
 * the visible sentence stays character-for-character identical to the registry
 * wording that is sent as evidence. `segmentConsentText` throws at module load
 * if either phrase is ever edited out of the wording.
 */
const CONSENT_SEGMENTS = segmentConsentText(CASH_OS_LEAD_FORM_CONSENT_TEXT, [
  { phrase: CONSENT_LINK_PHRASES.consentDocument, href: CONSENT_DOCUMENT_PATH },
  { phrase: CONSENT_LINK_PHRASES.privacyPolicy, href: PRIVACY_POLICY_PATH },
]);

const EMPLOYEE_COUNT_OPTIONS = ['До 20', '20–50', '51–100', '101–250', '251–500', 'Более 500'];

const INDUSTRY_OPTIONS = [
  'Строительство',
  'Производство',
  'Оптовая торговля / дистрибуция',
  'Инжиниринг / проектный бизнес',
  'Импорт / экспорт',
  'Логистика',
  'Медицинские услуги',
  'Профессиональные услуги / консалтинг / агентство',
  'Другое',
];

interface FormState {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  employeeCount: string;
  industry: string;
  comment: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  companyName: '',
  email: '',
  phone: '',
  employeeCount: '',
  industry: '',
  comment: '',
};

export function LeadFormSection() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentError, setConsentError] = useState(false);
  /** Optional and entirely independent of the required consent above. */
  const [marketingGiven, setMarketingGiven] = useState(false);
  /** Captured the moment each box is ticked, not at submit — that is the acknowledgement. */
  const consentAt = useRef<string | null>(null);
  const marketingAt = useRef<string | null>(null);
  const consentInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasStarted = useRef(false);

  /**
   * Native constraint validation would otherwise show a browser-default message
   * in the browser's own language. Setting a custom validity keeps the blocking
   * behaviour and makes the message Russian, matching the rest of the form.
   */
  useEffect(() => {
    consentInput.current?.setCustomValidity(consentGiven ? '' : CONSENT_REQUIRED_MESSAGE_RU);
  }, [consentGiven, status]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (!hasStarted.current) {
      hasStarted.current = true;
      trackCtaEvent('form_start');
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    // Second layer behind native validation: a submit can still be triggered
    // programmatically, and the consent must block it in every path.
    if (!consentGiven) {
      setConsentError(true);
      consentInput.current?.focus();
      return;
    }
    setConsentError(false);

    setStatus('submitting');
    setErrorMessage(null);
    try {
      await apiPost('/cash-os-leads', {
        name: form.name,
        companyName: form.companyName,
        email: form.email,
        phone: form.phone || undefined,
        employeeCount: form.employeeCount || undefined,
        industry: form.industry || undefined,
        comment: form.comment || undefined,
        source: 'cash-operating-system-landing',
        consent: {
          subjectId: REQUIRED_LEAD_CONSENT_SUBJECT,
          version: CONSENT_VERSION,
          consentText: CASH_OS_LEAD_FORM_CONSENT_TEXT,
          locale: 'ru',
          accepted: true,
          acknowledgedAt: consentAt.current ?? new Date().toISOString(),
        },
        // Present only when the optional box exists and was ticked. Its absence
        // is what records "no marketing consent" — never a false flag on the
        // required consent above.
        marketingConsent:
          MARKETING_CONSENT_ENABLED && marketingGiven && CASH_OS_LEAD_MARKETING_CONSENT_TEXT
            ? {
                subjectId: MARKETING_LEAD_CONSENT_SUBJECT,
                version: MARKETING_CONSENT_VERSION,
                consentText: CASH_OS_LEAD_MARKETING_CONSENT_TEXT,
                locale: 'ru',
                accepted: true,
                acknowledgedAt: marketingAt.current ?? new Date().toISOString(),
              }
            : undefined,
      });
      trackCtaEvent('form_submit');
      setStatus('success');
      setForm(EMPTY_FORM);
      setConsentGiven(false);
      setMarketingGiven(false);
      consentAt.current = null;
      marketingAt.current = null;
      hasStarted.current = false;
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Не удалось отправить заявку.');
    }
  }

  return (
    <Section id="apply" tone="slate">
      <Container>
        <SectionHeading
          center
          title="Расскажите немного о вашей компании"
          lede="Это поможет понять, подходит ли Liqvia под вашу текущую финансовую ситуацию."
        />

        <div className="mx-auto mt-10 max-w-xl">
          {status === 'success' ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8 text-center">
              <p className="text-lg font-semibold text-blue-900">Спасибо. Заявка получена.</p>
              <p className="mt-2 text-blue-900/80">
                Мы свяжемся с вами, чтобы уточнить несколько деталей и договориться о следующем
                шаге.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => void onSubmit(e)}
              /* ym-hide-content keeps the entered values out of any Yandex
                 Webvisor session recording, and ym-disable-keys keeps keystrokes
                 out of it, regardless of how the Metrica counter is configured in
                 the console. A dashboard toggle leaves no trace in this repo, so
                 the form carries its own protection. Neither class affects goals,
                 the click map or traffic reporting. */
              className="ym-hide-content ym-disable-keys rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Имя">
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Компания">
                  <input
                    required
                    type="text"
                    value={form.companyName}
                    onChange={(e) => update('companyName', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Рабочий email" className="sm:col-span-2">
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Телефон / Telegram" optional>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Количество сотрудников" optional>
                  <select
                    value={form.employeeCount}
                    onChange={(e) => update('employeeCount', e.target.value)}
                    className={inputClass}
                  >
                    <option value="" />
                    {EMPLOYEE_COUNT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Отрасль" optional className="sm:col-span-2">
                  <select
                    value={form.industry}
                    onChange={(e) => update('industry', e.target.value)}
                    className={inputClass}
                  >
                    <option value="" />
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Что сейчас сложнее всего в управлении деньгами?"
                  optional
                  className="sm:col-span-2"
                >
                  <textarea
                    value={form.comment}
                    onChange={(e) => update('comment', e.target.value)}
                    rows={3}
                    className={inputClass}
                  />
                </Field>
              </div>

              {status === 'error' && errorMessage && (
                <p className="mt-4 text-sm text-red-600" role="alert">
                  {errorMessage}
                </p>
              )}

              {/* Required consent. The wording is rendered from the shared consent
                  registry and the same string is sent with the submission, so the
                  stored evidence is provably what the user saw. Do not edit the
                  sentence here — add a new version in packages/shared/src/consent.ts. */}
              <div className="mt-6 flex items-start gap-3">
                <input
                  ref={consentInput}
                  id="consent-personal-data"
                  name="consentPersonalData"
                  required
                  type="checkbox"
                  checked={consentGiven}
                  aria-describedby={
                    consentError ? 'consent-personal-data-error' : undefined
                  }
                  aria-invalid={consentError || undefined}
                  onChange={(e) => {
                    setConsentGiven(e.target.checked);
                    setConsentError(false);
                    consentAt.current = e.target.checked ? new Date().toISOString() : null;
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="consent-personal-data"
                  className="cursor-pointer text-xs leading-relaxed text-slate-600"
                >
                  <ConsentSentence segments={CONSENT_SEGMENTS} />
                </label>
              </div>

              {consentError && (
                <p
                  id="consent-personal-data-error"
                  role="alert"
                  className="mt-2 text-xs font-medium text-red-600"
                >
                  {CONSENT_REQUIRED_MESSAGE_RU}
                </p>
              )}

              {/* Optional marketing consent — separate box, separate record, never
                  a condition of submitting. Rendered only when promotional
                  messages are actually sent AND a verified opt-out address exists;
                  see MARKETING_CONSENT_ENABLED. */}
              {MARKETING_CONSENT_ENABLED && CASH_OS_LEAD_MARKETING_CONSENT_TEXT && (
                <div className="mt-3 flex items-start gap-3">
                  <input
                    id="consent-marketing"
                    name="consentMarketing"
                    type="checkbox"
                    checked={marketingGiven}
                    onChange={(e) => {
                      setMarketingGiven(e.target.checked);
                      marketingAt.current = e.target.checked
                        ? new Date().toISOString()
                        : null;
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="consent-marketing"
                    className="cursor-pointer text-xs leading-relaxed text-slate-500"
                  >
                    {CASH_OS_LEAD_MARKETING_CONSENT_TEXT}
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'submitting'}
                data-cta-event="form_submit"
                className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-[12px] bg-blue-600 px-7 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {status === 'submitting' ? 'Отправляем…' : 'Подать заявку'}
              </button>
            </form>
          )}
        </div>
      </Container>
    </Section>
  );
}

/**
 * Renders a registered consent wording with its linked phrases as anchors.
 *
 * Both links open in a new tab and stop the click from reaching the surrounding
 * label, so opening either document never toggles the checkbox and never
 * discards a partially filled form or the campaign parameters on the landing URL.
 */
function ConsentSentence({ segments }: { segments: ConsentTextSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.href ? (
          <Link
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-500"
          >
            {segment.text}
          </Link>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

function Field({
  label,
  optional = false,
  className,
  children,
}: {
  label: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-400">— необязательно</span>}
      </span>
      {children}
    </label>
  );
}
