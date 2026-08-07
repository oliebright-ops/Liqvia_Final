import { AvailabilityBadge, Container, Eyebrow, NAVY_BG, PrimaryCta } from './primitives';
import { HeroProductPreview } from './hero-product-preview';

export function Hero() {
  return (
    <section className={`relative overflow-hidden ${NAVY_BG}`}>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_-10%,rgba(59,130,246,0.14),transparent_55%)]"
        aria-hidden
      />
      <Container className="relative grid gap-12 py-16 sm:py-20 lg:grid-cols-[52%_48%] lg:items-center lg:gap-10 lg:py-24">
        <div className="flex flex-col items-start text-left">
          <Eyebrow invert>Управление денежными потоками для растущего бизнеса</Eyebrow>

          <h1 className="mt-5 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.12]">
            Перестаньте принимать финансовые решения вслепую.
          </h1>

          <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-300">
            Видите движение денег на 13–26 недель вперёд, заранее обнаруживаете кассовые разрывы
            и проверяете последствия решений до того, как потратить деньги.
          </p>

          <p className="mt-3 max-w-lg text-sm text-slate-400">
            Персональное внедрение под руководством ACCA-консультанта на платформе Liqvia.
          </p>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <PrimaryCta className="w-full sm:w-auto">Обсудить финансовую ситуацию</PrimaryCta>
            <AvailabilityBadge invert>Пилотная программа · до 5 компаний</AvailabilityBadge>
          </div>

          <p className="mt-6 text-sm text-slate-400">
            Для компаний с 20–500 сотрудниками · Mutual NDA до обмена данными
          </p>
        </div>

        <div className="w-full">
          <HeroProductPreview />
        </div>
      </Container>
    </section>
  );
}
