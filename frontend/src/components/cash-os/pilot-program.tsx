import { CheckCircle2 } from 'lucide-react';
import { Container, PrimaryCta, Section, SectionHeading } from './primitives';

const INCLUDED = [
  'Установочные воркшопы',
  'Финансовая диагностика',
  'Подготовка данных',
  'Настройка платформы',
  'Внедрение системы',
  'Прогноз денежных потоков',
  'Мониторинг ликвидности',
  'Управление дебиторской задолженностью',
  'Очерёдность платежей поставщикам',
  'Сценарное моделирование',
  'Управленческие дашборды',
  'Еженедельные консультационные сессии',
  'Обучение команды',
  'Постоянная донастройка процесса',
];

export function PilotProgramSection() {
  return (
    <Section id="pilot-program">
      <Container>
        <SectionHeading
          center
          eyebrow="5 мест · 4 месяца"
          title="Пилотная программа"
          lede="Я лично участвую в каждом внедрении и адаптирую его под финансовые процессы конкретной компании. Поэтому пилотная программа рассчитана всего на пять компаний."
        />

        <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Что входит — 4 месяца
          </p>
          <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-3 text-slate-700">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
            <p className="font-semibold text-blue-900">После завершения программы</p>
            <p className="mt-1 text-blue-900/80">
              Компания продолжает работать в Liqvia и получает ещё 3 месяца консультационной
              поддержки без дополнительной платы.
            </p>
          </div>

          <div className="mt-8 flex justify-center">
            <PrimaryCta>Подать заявку на пилотную программу</PrimaryCta>
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            Конкретные коммерческие условия участия обсуждаются индивидуально на консультации.
          </p>
        </div>
      </Container>
    </Section>
  );
}
