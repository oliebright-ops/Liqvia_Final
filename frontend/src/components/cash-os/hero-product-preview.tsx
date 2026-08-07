import { ArrowUpRight, CalendarClock } from 'lucide-react';
import { CASH_NEGATIVE, MonoStat, NAVY_BORDER, NAVY_CARD, StatusBadge } from './primitives';

const OBLIGATIONS = [
  { label: 'Зарплата', week: 'нед. 2', amount: '1 840 000 ₽' },
  { label: 'Налоги', week: 'нед. 3', amount: '620 000 ₽' },
  { label: 'Поставщики', week: 'нед. 4', amount: '1 120 000 ₽' },
];

const SCENARIO_LEGEND = [
  { label: 'Ожидаемый', colorClass: 'bg-[hsl(221,94%,68%)]' },
  { label: 'Оптимистичный', colorClass: 'bg-[hsl(152,60%,45%)]' },
  { label: 'Консервативный', colorClass: 'bg-[hsl(38,92%,55%)]' },
];

/**
 * Constructed interface preview — not a real client screenshot. Reuses the exact HSL tokens
 * from the product's own dark theme (see primitives.tsx) so it reads as genuine Liqvia UI.
 */
export function HeroProductPreview() {
  return (
    <div
      className={`rounded-2xl border ${NAVY_BORDER} ${NAVY_CARD} p-5 shadow-[0_0_60px_-15px_rgba(59,130,246,0.35)] sm:p-6`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Денежная позиция</span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(152,60%,55%)]">
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          +4,2% за неделю
        </span>
      </div>
      <MonoStat className="mt-1.5 block text-3xl font-semibold text-white sm:text-4xl">
        4 260 000 ₽
      </MonoStat>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className={`rounded-xl border ${NAVY_BORDER} bg-white/[0.02] p-3.5`}>
          <p className="text-xs text-slate-400">Запас ликвидности</p>
          <MonoStat className="mt-1 block text-xl font-semibold text-white">18 недель</MonoStat>
        </div>
        <div className={`rounded-xl border ${NAVY_BORDER} bg-white/[0.02] p-3.5`}>
          <p className="text-xs text-slate-400">Состояние ликвидности</p>
          <div className="mt-1.5">
            <StatusBadge variant="positive">Стабильно</StatusBadge>
          </div>
        </div>
      </div>

      <div className={`mt-4 rounded-xl border ${NAVY_BORDER} bg-white/[0.02] p-3.5`}>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">Прогноз на 13 недель</p>
          <span className={`text-xs font-medium ${CASH_NEGATIVE}`}>Риск через 6 недель</span>
        </div>

        <svg viewBox="0 0 360 110" className="mt-3 h-24 w-full" aria-hidden focusable="false">
          <line x1="0" y1="72" x2="360" y2="72" stroke="hsl(222,30%,20%)" strokeWidth="1" strokeDasharray="3 4" />
          <path
            d="M0,42 C40,38 70,55 96,72 C112,82 128,86 150,80 C190,68 230,46 270,34 C300,25 330,20 360,16"
            fill="none"
            stroke="hsl(221,94%,68%)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M0,32 C40,26 70,38 96,50 C130,64 160,58 200,42 C240,28 300,10 360,4"
            fill="none"
            stroke="hsl(152,60%,45%)"
            strokeWidth="1.75"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          <path
            d="M0,50 C40,50 70,72 96,92 C110,102 130,100 150,96 C190,88 230,72 270,64 C300,58 330,54 360,50"
            fill="none"
            stroke="hsl(38,92%,55%)"
            strokeWidth="1.75"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          <circle cx="96" cy="72" r="4" fill="hsl(0,72%,58%)" />
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {SCENARIO_LEGEND.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <span className={`h-1.5 w-1.5 rounded-full ${item.colorClass}`} aria-hidden />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className={`mt-4 rounded-xl border ${NAVY_BORDER} bg-white/[0.02] p-3.5`}>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          Предстоящие платежи
        </div>
        <ul className="mt-2.5 space-y-2">
          {OBLIGATIONS.map((item) => (
            <li key={item.label} className="flex items-center justify-between text-sm">
              <span className="text-slate-300">{item.label}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{item.week}</span>
                <MonoStat className="font-medium text-white">{item.amount}</MonoStat>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
