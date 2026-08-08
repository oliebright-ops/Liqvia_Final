import { AvailabilityBadge, Container, Eyebrow, NAVY_BG, PrimaryCta, SecondaryCta } from './primitives';
import { HeroProductPreview } from './hero-product-preview';
import { resolveIndustryVariant, resolveIntentVariant } from './message-match';

interface HeroProps {
  industry?: string;
  intent?: string;
}

export function Hero({ industry, intent }: HeroProps) {
  const industryVariant = resolveIndustryVariant(industry);
  const intentVariant = resolveIntentVariant(intent);

  const eyebrow = industryVariant?.eyebrow ?? 'Система управления денежными потоками для растущего бизнеса';
  const headline = industryVariant?.headline ?? 'Прибыль есть. А денег всё равно постоянно не хватает?';
  const supporting = intentVariant?.supporting ?? industryVariant?.supporting;

  return (
    <section className={`relative overflow-hidden ${NAVY_BG}`}>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_-10%,rgba(59,130,246,0.14),transparent_55%)]"
        aria-hidden
      />
      <Container className="relative grid gap-12 py-16 sm:py-20 lg:grid-cols-[52%_48%] lg:items-center lg:gap-10 lg:py-24">
        <div className="flex flex-col items-start text-left">
          <Eyebrow invert>{eyebrow}</Eyebrow>

          <h1 className="mt-5 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.12]">
            {headline}
          </h1>

          <p className="mt-4 max-w-lg text-xl font-semibold text-white sm:text-2xl">
            Перестаньте принимать финансовые решения вслепую.
          </p>

          <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-300">
            {supporting ??
              'Liqvia помогает видеть движение денег на 13–26 недель вперёд, заранее замечать возможные кассовые разрывы и проверять последствия финансовых решений до того, как деньги будут потрачены.'}
          </p>

          <p className="mt-3 max-w-lg text-sm text-slate-400">
            Персональное внедрение проходит под руководством ACCA-квалифицированного финансового специалиста.
          </p>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <PrimaryCta className="w-full sm:w-auto" data-cta-event="hero_primary_cta">
              Записаться на диагностику денежных потоков
            </PrimaryCta>
            <SecondaryCta
              href="#platform"
              invert
              className="w-full sm:w-auto"
              data-cta-event="hero_secondary_cta"
            >
              Посмотреть, как работает Liqvia
            </SecondaryCta>
          </div>

          <p className="mt-3 text-sm text-slate-400">30 минут · Без обязательств · Конфиденциально</p>

          <p className="mt-2 max-w-lg text-xs leading-relaxed text-slate-500">
            До обмена конфиденциальной финансовой информацией стороны могут подписать взаимное
            соглашение о конфиденциальности (Mutual NDA).
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <AvailabilityBadge invert>До 5 компаний в пилотной программе</AvailabilityBadge>
            <span className="text-sm text-slate-400">Для компаний с 20–500 сотрудниками</span>
          </div>
        </div>

        <div className="w-full">
          <HeroProductPreview />
        </div>
      </Container>
    </section>
  );
}
