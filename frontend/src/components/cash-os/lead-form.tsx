'use client';

import { FormEvent, ReactNode, useState } from 'react';
import { apiPost } from '@/lib/api';
import { Container, Section, SectionHeading } from './primitives';

interface FormState {
  name: string;
  role: string;
  companyName: string;
  phone: string;
  email: string;
  comment: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  role: '',
  companyName: '',
  phone: '',
  email: '',
  comment: '',
};

export function LeadFormSection() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage(null);
    try {
      await apiPost('/cash-os-leads', {
        name: form.name,
        role: form.role || undefined,
        companyName: form.companyName,
        phone: form.phone,
        email: form.email,
        comment: form.comment || undefined,
        source: 'cash-operating-system-landing',
      });
      setStatus('success');
      setForm(EMPTY_FORM);
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
          title="Хотите заранее видеть, что будет с деньгами компании?"
          lede="На первой консультации разберём, как сейчас строится прогноз, где возникают расхождения и подходит ли вашей компании Cash Operating System."
        />

        <div className="mx-auto mt-10 max-w-xl">
          {status === 'success' ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8 text-center">
              <p className="text-lg font-semibold text-blue-900">Заявка отправлена</p>
              <p className="mt-2 text-blue-900/80">
                Спасибо! Мы свяжемся с вами в ближайшее время, чтобы обсудить финансовые процессы
                вашей компании.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => void onSubmit(e)}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
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
                <Field label="Телефон">
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Email" className="sm:col-span-2">
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Должность" optional className="sm:col-span-2">
                  <input
                    type="text"
                    value={form.role}
                    onChange={(e) => update('role', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Что сейчас сложнее всего в управлении деньгами?" optional className="sm:col-span-2">
                  <textarea
                    value={form.comment}
                    onChange={(e) => update('comment', e.target.value)}
                    rows={3}
                    className={inputClass}
                  />
                </Field>
              </div>

              {status === 'error' && errorMessage && (
                <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
              )}

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-[12px] bg-blue-600 px-7 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {status === 'submitting' ? 'Отправляем…' : 'Обсудить финансовую ситуацию'}
              </button>

              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                Отправляя форму, вы соглашаетесь с обработкой персональных данных в соответствии
                с Политикой конфиденциальности. Мы используем ваши данные только для связи по
                вашей заявке и не передаём их третьим лицам без вашего согласия.
              </p>
            </form>
          )}
        </div>
      </Container>
    </Section>
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
