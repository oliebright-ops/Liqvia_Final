import { BadgeCheck, Globe2, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { Container } from './primitives';

const ITEMS = [
  { icon: BadgeCheck, label: 'ACCA-квалификация' },
  { icon: UserCheck, label: 'Опыт международного аудита' },
  { icon: Globe2, label: 'Россия • Кипр • Австралия' },
  { icon: ShieldCheck, label: 'Mutual NDA' },
  { icon: Users, label: 'До 5 компаний в пилотной программе' },
];

export function TrustStrip() {
  return (
    <div className="border-b border-slate-200 bg-white py-5">
      <Container className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:justify-between">
        {ITEMS.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
            <Icon className="h-4 w-4 shrink-0 text-blue-700" aria-hidden />
            {label}
          </span>
        ))}
      </Container>
    </div>
  );
}
