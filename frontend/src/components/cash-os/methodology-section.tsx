import { CheckCircle2 } from 'lucide-react';
import { Container, Section, SectionHeading } from './primitives';

const INCLUDED_ITEMS = [
  'Прогноз денежных потоков',
  'Управление ликвидностью',
  'Контроль дебиторской задолженности',
  'Очерёдность платежей поставщикам',
  'Сценарное моделирование',
  'План-факт анализ',
  'Регулярный ритм финансовых решений',
  'Единая картина по деньгам для собственника, директора и команды',
];

export function WhatIsCosSection() {
  return (
    <Section id="cash-operating-system">
      <Container className="grid gap-12 lg:grid-cols-2 lg:items-start">
        <div>
          <SectionHeading title="Что такое Cash Operating System" />
          <p className="mt-5 leading-relaxed text-slate-600">
            Cash Operating System — это не ещё одна таблица для бюджета, не ERP-система и не
            шаблон прогноза. Это методология, которая объединяет прогноз денежных потоков,
            контроль платёжеспособности, работу с задолженностью, сценарии и регулярный ритм
            принятия решений — в единый процесс на платформе Liqvia.
          </p>
          <p className="mt-4 leading-relaxed text-slate-600">
            Я внедряю её лично — это не разовая установка программы, а выстроенный процесс,
            которым команда продолжает пользоваться самостоятельно и после завершения программы.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Что входит</p>
          <ul className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            {INCLUDED_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-slate-800">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}

export function WhyExcelStopsSection() {
  return (
    <Section id="why-excel-stops" tone="slate">
      <Container>
        <SectionHeading
          center
          title="Почему Excel рано или поздно перестаёт справляться"
          lede="Excel — хороший инструмент на старте. Проблема появляется по мере роста бизнеса."
        />
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
          {[
            'Файл обновляет один человек — и его отпуск становится риском для всей компании.',
            'У разных отделов — разные версии одного и того же файла.',
            'Нет истории: невозможно быстро понять, что изменилось за неделю и почему.',
          ].map((point) => (
            <div key={point} className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
              {point}
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center leading-relaxed text-slate-600">
          Это не критика Excel — как инструмент он выполняет свою задачу. Excel просто не
          рассчитан на объём и скорость решений, которые бизнес 20–500 сотрудников должен
          принимать каждую неделю.
        </p>
      </Container>
    </Section>
  );
}
