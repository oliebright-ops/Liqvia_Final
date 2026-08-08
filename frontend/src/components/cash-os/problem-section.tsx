import { Container, Section, SectionHeading } from './primitives';

const DEFAULT_PAIN_POINTS = [
  '«Прибыль есть, но денег постоянно не хватает.»',
  '«Мы не можем точно сказать, сколько денег останется через месяц.»',
  '«У нас десятки файлов Excel, и у каждого — свои цифры.»',
  '«О проблеме мы узнаём, когда её уже поздно решать.»',
  '«Не понимаем, что будет с деньгами, если упадут продажи.»',
  '«Не успеваем решать, кому из поставщиков платить в первую очередь.»',
];

interface ProblemSectionProps {
  industryPain?: string;
}

export function ProblemSection({ industryPain }: ProblemSectionProps) {
  const painPoints = industryPain ? [industryPain, ...DEFAULT_PAIN_POINTS.slice(1)] : DEFAULT_PAIN_POINTS;

  return (
    <Section id="problem" tone="slate">
      <Container>
        <SectionHeading
          center
          title="Вам знакомы эти ситуации?"
          lede="Если хотя бы один пункт кажется знакомым, проблема может быть не в прибыли — а в том, что у руководителя нет единой картины будущего движения денег."
        />
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
          {painPoints.map((point) => (
            <div
              key={point}
              className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-slate-700 shadow-sm"
            >
              {point}
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl items-center gap-10 lg:grid-cols-2">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
              Три источника. Три разные цифры. Какой верить?
            </h3>
            <p className="mt-4 leading-relaxed text-slate-600">Банк показывает остаток сегодня.</p>
            <p className="mt-2 leading-relaxed text-slate-600">Бухгалтерия показывает то, что уже произошло.</p>
            <p className="mt-2 leading-relaxed text-slate-600">
              Excel показывает прогноз — если его успели обновить.
            </p>
            <p className="mt-4 leading-relaxed text-slate-600">
              Руководителю нужна единая картина: что происходит с деньгами сейчас и что может
              произойти дальше.
            </p>
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
