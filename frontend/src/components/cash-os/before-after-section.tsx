import { ArrowRight, Minus, Plus } from 'lucide-react';
import { Container, Section, SectionHeading } from './primitives';

const BEFORE = [
  'Прогноз собирается вручную из нескольких файлов',
  'О риске нехватки денег узнают слишком поздно',
  'Решения о найме и инвестициях принимаются по остатку на счёте',
  'У разных участников — разные версии цифр',
];

const AFTER = [
  'Единый прогноз обновляется каждую неделю',
  'Риски видны за несколько недель до возможного разрыва',
  'Крупные решения предварительно проверяются через сценарии',
  'Собственник и финансовая команда работают с одной картиной денег',
];

export function BeforeAfterSection() {
  return (
    <Section id="before-after">
      <Container>
        <SectionHeading
          center
          eyebrow="Как меняется процесс: иллюстративный пример"
          title="Что меняется после внедрения"
        />

        <div className="mx-auto mt-10 grid max-w-4xl items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">До</p>
            <ul className="mt-4 space-y-3">
              {BEFORE.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-600">
                  <Minus className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <ArrowRight className="mx-auto hidden h-6 w-6 shrink-0 text-slate-300 lg:block" aria-hidden />

          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">После</p>
            <ul className="mt-4 space-y-3">
              {AFTER.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-800">
                  <Plus className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500">
          Иллюстративный пример типовых изменений — не гарантия результата. Результат зависит от
          качества внедрения, полноты данных и регулярности использования системы.
        </p>
      </Container>
    </Section>
  );
}
