import { Container, Section, SectionHeading } from './primitives';

const PAIN_POINTS = [
  '«Прибыль есть, но денег постоянно не хватает.»',
  '«Мы не можем точно сказать, сколько денег останется через месяц.»',
  '«У нас десятки файлов Excel, и у каждого — свои цифры.»',
  '«О проблеме мы узнаём, когда её уже поздно решать.»',
  '«Не понимаем, что будет с деньгами, если упадут продажи.»',
  '«Не успеваем решать, кому из поставщиков платить в первую очередь.»',
];

export function ProblemSection() {
  return (
    <Section id="problem" tone="slate">
      <Container>
        <SectionHeading center title="Знакомая ситуация?" />
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
          {PAIN_POINTS.map((point) => (
            <div
              key={point}
              className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-slate-700 shadow-sm"
            >
              {point}
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-lg leading-relaxed text-slate-600">
          Если хотя бы две из этих фраз про вас — дело не в бухгалтерии. Дело в том, что решения
          о деньгах принимаются без системы, которая показывает последствия заранее.
        </p>

        <div className="mx-auto mt-14 grid max-w-5xl items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="leading-relaxed text-slate-600">
              Большинство компаний хорошо ведут бухгалтерский учёт — это база, которая нужна по
              закону. Но бухгалтерия отвечает на вопрос «что произошло», а не «что произойдёт».
              Когда бизнес растёт, платежей и контрагентов становится больше, чем способен
              удержать ручной Excel-файл — и решения начинают приниматься по ощущению, а не по
              расчёту.
            </p>
            <p className="mt-4 font-medium text-slate-900">Это не ошибка людей. Это предел инструмента.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Три источника — три разные цифры
            </p>
            <div className="mt-5 space-y-3">
              {[
                { label: 'Банк', value: '4 260 000 ₽' },
                { label: 'Бухгалтерия', value: '3 910 000 ₽' },
                { label: 'Excel-файл руководителя', value: '4 500 000 ₽' },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <span className="text-sm text-slate-600">{row.label}</span>
                  <span className="font-mono text-sm font-semibold text-slate-900">{row.value}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Три источника не совпадают между собой — и никто не может сказать точно, какая
              цифра верна.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
