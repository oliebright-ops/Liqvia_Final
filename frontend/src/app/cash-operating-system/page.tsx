import type { Metadata } from 'next';
import { AboutSection } from '@/components/cash-os/about-section';
import { BeforeAfterSection } from '@/components/cash-os/before-after-section';
import { ConfidentialitySection } from '@/components/cash-os/confidentiality';
import { FaqSection } from '@/components/cash-os/faq';
import { CashOsFooter } from '@/components/cash-os/footer';
import { Hero } from '@/components/cash-os/hero';
import { LeadFormSection } from '@/components/cash-os/lead-form';
import { WhatIsCosSection, WhyExcelStopsSection } from '@/components/cash-os/methodology-section';
import { IndustriesSection } from '@/components/cash-os/outcomes-industries';
import { PilotProgramSection } from '@/components/cash-os/pilot-program';
import { PlatformWalkthroughSection } from '@/components/cash-os/platform-walkthrough';
import { ProblemSection } from '@/components/cash-os/problem-section';
import { RoadmapSection } from '@/components/cash-os/roadmap';
import { SiteHeader } from '@/components/cash-os/site-header';
import { StickyCta } from '@/components/cash-os/sticky-cta';
import { TrustStrip } from '@/components/cash-os/trust-strip';

const FAQ_ITEMS_FOR_SCHEMA: Array<[string, string]> = [
  [
    'Cash Operating System заменяет бухгалтера?',
    'Нет. Методология не заменяет бухгалтерский учёт и не является бухгалтерской, налоговой, инвестиционной или юридической консультацией. Она дополняет работу бухгалтера, добавляя управленческую картину движения денег.',
  ],
  [
    'Нужно ли отказываться от нашей ERP или учётной системы?',
    'Нет. Система работает поверх существующего учёта, а не вместо него.',
  ],
  [
    'Насколько точен прогноз?',
    'Прогноз строится на данных, предоставленных компанией, и явно показывает, на каких допущениях он основан. Точность зависит от полноты и регулярности обновления данных и не гарантируется.',
  ],
  [
    'Что именно закрывает взаимное соглашение о неразглашении (Mutual NDA)?',
    'С моей стороны — строгая конфиденциальность финансовой отчётности, прогнозов и операционных данных компании, безопасное хранение и использование информации только для внедрения системы, без передачи третьим лицам без письменного согласия (кроме случаев, предусмотренных законом). С вашей стороны — уважение конфиденциальности методологии внедрения.',
  ],
  [
    'Сколько стоит участие в пилотной программе?',
    'Стоимость зависит от масштаба компании и объёма внедрения и обсуждается индивидуально на консультации. Пилотная программа имеет отдельные условия для первых пяти компаний.',
  ],
];

export const metadata: Metadata = {
  title: 'Cash Operating System — управление денежными потоками',
  description:
    'Внедрение системы управления денежными потоками для бизнеса 20–500 сотрудников. Консультант ACCA. Пилотная программа — 5 компаний.',
  alternates: { canonical: '/cash-operating-system' },
};

export default function CashOperatingSystemPage() {
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <SiteHeader />

      <main>
        <Hero />
        <TrustStrip />
        <ProblemSection />
        <WhatIsCosSection />
        <WhyExcelStopsSection />
        <PlatformWalkthroughSection />
        <BeforeAfterSection />
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
