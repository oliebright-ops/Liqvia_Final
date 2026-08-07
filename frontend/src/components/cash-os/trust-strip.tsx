import { BadgeCheck, CalendarRange, ShieldCheck, UserCheck } from 'lucide-react';
import { Container } from './primitives';

const ITEMS = [
  { icon: BadgeCheck, label: 'ACCA' },
  { icon: CalendarRange, label: 'Прогноз на 13–26 недель' },
  { icon: UserCheck, label: 'Личное внедрение' },
  { icon: ShieldCheck, label: 'Mutual NDA' },
];

export function TrustStrip() {
  return (
    <div className="border-b border-slate-200 bg-white py-5">
      <Container className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 sm:justify-between">
        {ITEMS.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
            <Icon className="h-4 w-4 text-blue-700" aria-hidden />
            {label}
          </span>
        ))}
      </Container>
    </div>
  );
}
