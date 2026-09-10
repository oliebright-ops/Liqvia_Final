'use client';

import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { apiPost } from '@/lib/api';
import { captureLeadAttribution, readLeadAttribution } from '@/lib/lead-attribution-capture';
import {
  CASH_OS_LEAD_FORM_NOTICE_TEXT,
  CASH_OS_LEAD_MARKETING_CONSENT_TEXT,
  MARKETING_CONSENT_ENABLED,
} from '@/lib/consent';
import { buildLeadPayload } from '@/lib/lead-submission';
import { trackCtaEvent } from './analytics';
import { Container, Section, SectionHeading } from './primitives';

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
  /** Optional, never a condition of submitting, and currently never rendered. */
  const [marketingGiven, setMarketingGiven] = useState(false);
  /** Captured the moment the box is ticked, not at submit — that is the acknowledgement. */
  const marketingAt = useRef<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasStarted = useRef(false);

  /**
   * Record which advert brought this visitor, once, on arrival.
   *
   * It has to happen here rather than at submit time: the query string is gone
   * by then if the visitor followed the privacy link and came back. See
   * lead-attribution-capture.ts.
   */
  useEffect(() => {
    captureLeadAttribution();
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (!hasStarted.current) {
      hasStarted.current = true;
      trackCtaEvent('form_start');
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const payload = buildLeadPayload(
      form,
      { marketingGiven, marketingAcknowledgedAt: marketingAt.current },
      undefined,
      readLeadAttribution(),
    );

    setStatus('submitting');
    setErrorMessage(null);
    try {
      await apiPost('/cash-os-leads', payload);
      trackCtaEvent('form_submit');
      setStatus('success');
      setForm(EMPTY_FORM);
      setMarketingGiven(false);
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

              {/* Passive notice. Nothing to tick and nothing blocked — the act it
                  refers to is pressing the button above, which is why it sits
                  below it. Rendered from the shared registry, and the server
                  stores that same registry entry as the record of what was
                  displayed. Do not edit the sentence here: add a new version in
                  packages/shared/src/consent.ts, or the stored evidence stops
                  matching what this page actually showed. */}
              <p id="lead-form-privacy-notice" className="mt-4 text-xs leading-relaxed text-slate-500">
                {CASH_OS_LEAD_FORM_NOTICE_TEXT}
              </p>
            </form>
          )}
        </div>
      </Container>
    </Section>
  );
}

/**
 * `text-base` below `sm`, not `text-sm`.
 *
 * iOS Safari zooms the page in whenever a focused field's font is smaller than
 * 16px, and it does not zoom back out on blur. At 14px every tap on this form
 * left the visitor pinching to recover, on the one screen where the page is
 * asking them for effort — and most of this page's paid traffic arrives from
 * Yandex search on a phone. 16px is the threshold, so `text-base` is the fix.
 *
 * Desktop keeps the original 14px through `sm:text-sm`, so nothing above the
 * breakpoint changes appearance.
 */
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base sm:text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

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
