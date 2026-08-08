import { ShieldCheck } from 'lucide-react';
import { Container, Section } from './primitives';

export function ConfidentialitySection() {
  return (
    <Section id="confidentiality" className="!py-10" tone="slate">
      <Container>
        <div className="mx-auto flex max-w-3xl items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-blue-700" aria-hidden />
          <p className="leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-900">Конфиденциальность и взаимная защита информации. </span>
            Любое сотрудничество начинается с подписания взаимного соглашения о неразглашении
            (Mutual NDA) до обмена конфиденциальной информацией — это защищает и данные вашей
            компании, и методологию внедрения. Конфиденциальная финансовая информация обсуждается
            только после согласования формата работы и, при необходимости, подписания Mutual NDA.
            Подробные условия — в разделе{' '}
            <a href="#faq" className="font-medium text-blue-700 underline-offset-4 hover:underline">
              «Вопросы»
            </a>
            .
          </p>
        </div>
      </Container>
    </Section>
  );
}
