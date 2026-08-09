import type { Metadata } from 'next';
import { YandexMetrica } from '@/components/analytics/yandex-metrica';
import { AboutSection } from '@/components/cash-os/about-section';
import { BeforeAfterSection } from '@/components/cash-os/before-after-section';
import { ConfidentialitySection } from '@/components/cash-os/confidentiality';
import { FaqSection } from '@/components/cash-os/faq';
import { CashOsFooter } from '@/components/cash-os/footer';
import { Hero } from '@/components/cash-os/hero';
import { LeadFormSection } from '@/components/cash-os/lead-form';
import { resolveIndustryVariant } from '@/components/cash-os/message-match';
import { WhatIsCosSection, WhyExcelStopsSection } from '@/components/cash-os/methodology-section';
import { IndustriesSection } from '@/components/cash-os/outcomes-industries';
import { PilotProgramSection } from '@/components/cash-os/pilot-program';
import { PlatformWalkthroughSection } from '@/components/cash-os/platform-walkthrough';
import { Container, PrimaryCta } from '@/components/cash-os/primitives';
import { ProblemSection } from '@/components/cash-os/problem-section';
import { RoadmapSection } from '@/components/cash-os/roadmap';
import { SiteHeader } from '@/components/cash-os/site-header';
import { StickyCta } from '@/components/cash-os/sticky-cta';
import { TrustStrip } from '@/components/cash-os/trust-strip';

const FAQ_ITEMS_FOR_SCHEMA: Array<[string, string]> = [
  [
    'Сколько стоит участие?',
    'Стоимость зависит от сложности бизнеса, количества юридических лиц, источников данных и объёма внедрения. После первичной диагностики мы определим необходимый объём работы и обсудим стоимость до начала проекта.',
  ],
  [
    'Сколько занимает внедрение?',
    'Текущий пилот рассчитан примерно на 4 месяца. Конкретный объём и последовательность работ зависят от структуры бизнеса и исходных данных.',
  ],
  [
    'Liqvia заменяет бухгалтерию?',
    'Нет. Бухгалтерский учёт отвечает прежде всего за фиксацию и отражение уже произошедших операций. Liqvia используется для управленческого взгляда вперёд: ожидаемых поступлений, выплат, обязательств, сценариев и будущей ликвидности.',
  ],
  [
    'Liqvia заменяет финансового директора?',
    'Нет. Liqvia помогает руководителю и финансовой команде работать с единой картиной денежных потоков и быстрее оценивать последствия решений.',
  ],
  [
    'Нужно ли отказываться от Excel?',
    'Не обязательно. На этапе внедрения существующие таблицы могут оставаться источником данных. Задача — постепенно убрать зависимость от множества разрозненных файлов и создать единый управленческий процесс.',
  ],
  [
    'Что именно закрывает взаимное соглашение о неразглашении (Mutual NDA)?',
    'С моей стороны — строгая конфиденциальность финансовой отчётности, прогнозов и операционных данных компании, безопасное хранение и использование информации только для внедрения системы, без передачи третьим лицам без письменного согласия (кроме случаев, предусмотренных законом). С вашей стороны — уважение конфиденциальности методологии внедрения.',
  ],
];

export const metadata: Metadata = {
  title: 'Прибыль есть, а денег не хватает? — Cash Operating System',
  description:
    'Видите движение денег на 13–26 недель вперёд и находите кассовые разрывы заранее. Личное внедрение под руководством ACCA-специалиста. Пилотная программа — до 5 компаний.',
  alternates: { canonical: '/cash-operating-system' },
};

interface CashOperatingSystemPageProps {
  searchParams: Promise<{ industry?: string; intent?: string }>;
}

export default async function CashOperatingSystemPage({ searchParams }: CashOperatingSystemPageProps) {
  const params = await searchParams;
  const industryVariant = resolveIndustryVariant(params.industry);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: 'Cash Operating System — Оли Брайт',
      description:
        'Внедрение методологии управления денежными потоками для малого и среднего бизнеса на базе платформы Liqvia.',
      areaServed: 'RU',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS_FOR_SCHEMA.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ];

  return (
    <div className="bg-white text-slate-900">
      <YandexMetrica />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <SiteHeader />

      <main>
        <Hero industry={params.industry} intent={params.intent} />
        <TrustStrip />
        <ProblemSection industryPain={industryVariant?.pain} />
        <WhatIsCosSection />
        <WhyExcelStopsSection />
        <PlatformWalkthroughSection />
        <BeforeAfterSection />

        <div className="border-y border-slate-200 bg-slate-50 py-10">
          <Container className="flex flex-col items-center gap-3 text-center">
            <p className="text-base text-slate-700">
              Хотите понять, подойдёт ли это вашей компании?
            </p>
            <PrimaryCta data-cta-event="middle_primary_cta">
              Записаться на диагностику денежных потоков
            </PrimaryCta>
          </Container>
        </div>

        <IndustriesSection />
        <RoadmapSection />
        <AboutSection />
        <PilotProgramSection />
        <ConfidentialitySection />
        <FaqSection />
        <LeadFormSection />
      </main>

      <CashOsFooter />
      <StickyCta />
    </div>
  );
}
