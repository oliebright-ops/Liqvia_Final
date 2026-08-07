import { Container, MonoStat, Section, SectionHeading } from './primitives';

const STEPS = [
  {
    weeks: 'Нед. 1–2',
    title: 'Диагностика',
    description: 'Знакомство с финансовыми процессами компании, разбор данных и файлов, точки риска.',
  },
  {
    weeks: 'Нед. 3–6',
    title: 'Данные и настройка',
    description: 'Структурирование денежной позиции и задолженности, настройка Liqvia под структуру компании.',
  },
  {
    weeks: 'Нед. 7–14',
    title: 'Прогноз и управленческий ритм',
    description: 'Первый прогноз, приоритизация платежей, сценарии, еженедельные сессии с командой.',
  },
  {
    weeks: 'Нед. 15–16',
    title: 'Передача команде и поддержка',
    description: 'Проверка самостоятельной работы команды в системе и план дальнейшего использования.',
  },
];

export function RoadmapSection() {
  return (
    <Section id="roadmap">
      <Container>
        <SectionHeading center title="Как проходит внедрение" />

        <ol className="mx-auto mt-14 flex max-w-5xl flex-col gap-6 lg:flex-row lg:gap-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative flex flex-1 gap-4 lg:flex-col lg:gap-0">
              <div className="flex flex-col items-center lg:w-full">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    className="mt-1 w-px flex-1 bg-slate-200 lg:mt-0 lg:h-px lg:w-full lg:flex-none lg:translate-y-4"
                    aria-hidden
                  />
                )}
              </div>
              <div className="pb-6 lg:pb-0 lg:pt-4 lg:text-center">
                <MonoStat className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  {step.weeks}
                </MonoStat>
                <h3 className="mt-1 text-base font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 lg:mx-auto lg:max-w-[220px]">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mx-auto mt-10 max-w-2xl text-center leading-relaxed text-slate-600">
          После завершения программы — ещё <strong className="text-slate-900">3 месяца</strong>{' '}
          консультационной поддержки включены без дополнительной платы.
        </p>
      </Container>
    </Section>
  );
}
