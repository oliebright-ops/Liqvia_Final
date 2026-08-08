import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Container, MonoStat, NAVY_BORDER, NAVY_CARD, Section, SectionHeading, StatusBadge } from './primitives';

const WEEK_TICKS = ['1 нед', '4 нед', '7 нед', '10 нед', '13 нед'];

function ForecastPanel() {
  return (
    <div className={`rounded-2xl border ${NAVY_BORDER} ${NAVY_CARD} p-6 sm:p-8`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Видеть деньги на 13–26 недель вперёд</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
            Прогнозируйте ожидаемые поступления и выплаты и замечайте потенциальные кассовые
            разрывы заранее.
          </p>
        </div>
        <StatusBadge variant="negative">Риск дефицита · нед. 6</StatusBadge>
      </div>

      <div className="relative mt-6">
        <svg viewBox="0 0 640 180" className="h-44 w-full sm:h-52" aria-hidden focusable="false">
          <rect x="180" y="0" width="90" height="180" fill="hsl(0,72%,58%)" opacity="0.06" />
          <line x1="0" y1="120" x2="640" y2="120" stroke="hsl(222,30%,20%)" strokeWidth="1" strokeDasharray="3 4" />
          <path
            d="M0,70 C70,60 120,90 180,120 C210,136 240,142 270,132 C330,112 390,80 460,58 C520,40 580,30 640,24"
            fill="none"
            stroke="hsl(221,94%,68%)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M0,54 C70,44 120,68 180,90 C230,108 290,96 350,72 C420,46 520,16 640,6"
            fill="none"
            stroke="hsl(152,60%,45%)"
            strokeWidth="2"
            strokeDasharray="5 5"
            strokeLinecap="round"
          />
          <path
            d="M0,86 C70,82 120,118 180,150 C210,168 250,166 290,158 C360,144 440,120 520,104 C560,96 600,90 640,84"
            fill="none"
            stroke="hsl(38,92%,55%)"
            strokeWidth="2"
            strokeDasharray="5 5"
            strokeLinecap="round"
          />
          <circle cx="220" cy="128" r="5" fill="hsl(0,72%,58%)" />
        </svg>
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          {WEEK_TICKS.map((tick) => (
            <MonoStat key={tick}>{tick}</MonoStat>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {[
          { label: 'Ожидаемый', colorClass: 'bg-[hsl(221,94%,68%)]' },
          { label: 'Оптимистичный', colorClass: 'bg-[hsl(152,60%,45%)]' },
          { label: 'Консервативный', colorClass: 'bg-[hsl(38,92%,55%)]' },
        ].map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${item.colorClass}`} aria-hidden />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const OBLIGATIONS = [
  { order: 1, label: 'Зарплата', due: 'нед. 2', amount: '1 840 000 ₽', variant: 'negative' as const },
  { order: 2, label: 'Налоги', due: 'нед. 3', amount: '620 000 ₽', variant: 'warning' as const },
  { order: 3, label: 'Поставщики', due: 'нед. 4', amount: '1 120 000 ₽', variant: 'neutral' as const },
];

function ObligationsPanel() {
  return (
    <div className={`flex flex-col rounded-2xl border ${NAVY_BORDER} ${NAVY_CARD} p-6`}>
      <h3 className="text-base font-semibold text-white">Понимать, кому и когда нужно платить</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Соберите обязательства в одной картине и оценивайте приоритеты платежей с учётом будущей
        ликвидности.
      </p>
      <ul className="mt-4 space-y-2">
        {OBLIGATIONS.map((item) => (
          <li
            key={item.label}
            className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border ${NAVY_BORDER} bg-white/[0.02] px-3.5 py-2.5`}
          >
            <span className="flex items-center gap-2.5">
              <StatusBadge variant={item.variant}>{item.order}</StatusBadge>
              <span className="text-sm text-slate-200">{item.label}</span>
            </span>
            <span className="ml-auto flex items-center gap-2">
              <span className="text-xs text-slate-500">{item.due}</span>
              <MonoStat className="text-sm font-medium text-white">{item.amount}</MonoStat>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SCENARIOS = [
  { label: 'Ожидаемый', weeks: 18, widthPct: 72, colorClass: 'bg-[hsl(221,94%,68%)]' },
  { label: 'Оптимистичный', weeks: 24, widthPct: 96, colorClass: 'bg-[hsl(152,60%,45%)]' },
  { label: 'Консервативный', weeks: 9, widthPct: 36, colorClass: 'bg-[hsl(38,92%,55%)]' },
];

function ScenariosPanel() {
  return (
    <div className={`flex flex-col rounded-2xl border ${NAVY_BORDER} ${NAVY_CARD} p-6`}>
      <h3 className="text-base font-semibold text-white">Проверять решения до того, как потратить деньги</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Сравнивайте сценарии: новый сотрудник, закупка, инвестиция, изменение продаж или перенос
        платежа.
      </p>
      <ul className="mt-5 space-y-4">
        {SCENARIOS.map((s) => (
          <li key={s.label}>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{s.label}</span>
              <MonoStat className="text-slate-200">{s.weeks} нед. запаса</MonoStat>
            </div>
            <div className={`mt-1.5 h-2 w-full overflow-hidden rounded-full border ${NAVY_BORDER} bg-white/[0.03]`}>
              <div className={`h-full rounded-full ${s.colorClass}`} style={{ width: `${s.widthPct}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PLAN_ACTUAL = [
  { week: 'Нед. 1', plan: '4 100 000 ₽', actual: '4 260 000 ₽', up: true },
  { week: 'Нед. 2', plan: '3 820 000 ₽', actual: '3 640 000 ₽', up: false },
  { week: 'Нед. 3', plan: '3 500 000 ₽', actual: '3 510 000 ₽', up: true },
];

function PlanActualPanel() {
  return (
    <div className={`flex flex-col rounded-2xl border ${NAVY_BORDER} ${NAVY_CARD} p-6`}>
      <h3 className="text-base font-semibold text-white">Понимать, где прогноз расходится с реальностью</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Сравнивайте план с фактом и постепенно улучшайте качество прогнозирования.
      </p>
      <ul className="mt-4 space-y-2">
        {PLAN_ACTUAL.map((row) => (
          <li
            key={row.week}
            className={`flex items-center justify-between rounded-lg border ${NAVY_BORDER} bg-white/[0.02] px-3.5 py-2.5`}
          >
            <span className="text-sm text-slate-300">{row.week}</span>
            <span className="flex items-center gap-2 text-xs text-slate-500">
              <MonoStat>план {row.plan}</MonoStat>
              <MonoStat className={`font-medium ${row.up ? 'text-[hsl(152,60%,55%)]' : 'text-[hsl(0,72%,65%)]'}`}>
                {row.up ? <ArrowUpRight className="mr-0.5 inline h-3 w-3" aria-hidden /> : <ArrowDownRight className="mr-0.5 inline h-3 w-3" aria-hidden />}
                {row.actual}
              </MonoStat>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlatformWalkthroughSection() {
  return (
    <Section id="platform" tone="navy">
      <Container>
        <SectionHeading
          invert
          center
          title="Что вы сможете делать с Liqvia"
          lede="Ниже — экраны платформы Liqvia, которые показывают эти возможности на практике."
        />

        <div className="mt-12 space-y-6">
          <ForecastPanel />
          <div className="grid gap-6 lg:grid-cols-3">
            <ObligationsPanel />
            <ScenariosPanel />
            <PlanActualPanel />
          </div>
        </div>
      </Container>
    </Section>
  );
}
