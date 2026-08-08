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

const NOT_STATEMENTS = [
  'Это не бухгалтерская программа.',
  'Не ERP-система.',
  'Не ещё один шаблон БДДС.',
  'И не таблица, которую нужно каждый раз собирать заново.',
];

export function WhatIsCosSection() {
  return (
    <Section id="cash-operating-system">
      <Container className="grid gap-12 lg:grid-cols-2 lg:items-start">
        <div>
          <SectionHeading title="Что такое Cash Operating System — и почему это не ещё одна таблица Excel" />
          <p className="mt-5 leading-relaxed text-slate-600">
            Cash Operating System — это система управления денежными потоками компании, которая
            объединяет прогноз, обязательства, сценарии и план-факт в одном процессе принятия
            решений.
          </p>
          <div className="mt-4 space-y-1.5">
            {NOT_STATEMENTS.map((line) => (
              <p key={line} className="leading-relaxed text-slate-600">
                {line}
              </p>
            ))}
          </div>
          <p className="mt-4 leading-relaxed text-slate-600">
            Liqvia помогает создать единый процесс, в котором руководство видит ожидаемое движение
            денег и может оценить последствия решений заранее.
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
        <SectionHeading center title="Почему Excel перестаёт справляться по мере роста бизнеса" />
        <div className="mx-auto mt-6 max-w-2xl space-y-2 text-center">
          <p className="leading-relaxed text-slate-600">Пока бизнес небольшой, Excel может работать отлично.</p>
          <p className="leading-relaxed text-slate-600">
            Но с ростом компании появляются новые счета, проекты, юридические лица, контрагенты и
            версии файлов.
          </p>
          <p className="leading-relaxed text-slate-600">В какой-то момент проблема уже не в самой таблице.</p>
          <p className="leading-relaxed text-slate-600">
            Проблема в том, сколько времени нужно, чтобы собрать актуальную картину и понять,
            какой цифре можно доверять.
          </p>
        </div>
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
