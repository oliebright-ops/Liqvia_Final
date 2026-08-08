import { Container, MonoStat, Section, SectionHeading } from './primitives';

const STEPS = [
  {
    weeks: 'Нед. 1–2',
    title: 'Диагностика и структура',
    description: 'Разбираемся, откуда сегодня берутся финансовые данные и как принимаются решения.',
  },
  {
    weeks: 'Нед. 3–6',
    title: 'Настройка системы',
    description: 'Настраиваем структуру денежных потоков, обязательств и прогноза под ваш бизнес.',
  },
  {
    weeks: 'Нед. 7–14',
    title: 'Сценарии и управленческий процесс',
    description: 'Настраиваем сценарии, приоритеты платежей и регулярный процесс обновления прогноза.',
  },
  {
    weeks: 'Нед. 15–16',
    title: 'Передача в рабочий режим',
    description: 'Команда начинает использовать систему как часть регулярного финансового управления.',
  },
];

export function RoadmapSection() {
  return (
    <Section id="roadmap">
      <Container>
        <SectionHeading
          center
          title="Как проходит внедрение за 16 недель"
          lede="Мы не просто предоставляем доступ к платформе. Liqvia внедряется вместе с вашей командой как регулярный процесс управления денежными потоками."
        />

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
          Конкретный объём и последовательность работ зависят от структуры бизнеса и исходных
          данных. После завершения программы — ещё{' '}
          <strong className="text-slate-900">3 месяца</strong> консультационной поддержки включены
          без дополнительной платы.
        </p>
      </Container>
    </Section>
  );
}
