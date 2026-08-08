import Image from 'next/image';
import { Container, Section, SectionHeading } from './primitives';

export function AboutSection() {
  return (
    <Section id="about" tone="slate">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,280px)_1fr] lg:items-center">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <Image
            src="/cash-os/oli-bright-portrait.jpg"
            alt="Оли Брайт, консультант по внедрению Cash Operating System"
            width={144}
            height={144}
            className="h-36 w-36 rounded-2xl border border-slate-200 object-cover shadow-sm"
          />
          <p className="mt-4 text-lg font-semibold text-slate-900">Оли Брайт</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            ACCA · Международный аудит · Управленческая отчётность · Управление ликвидностью
          </p>
        </div>

        <div>
          <SectionHeading title="Кто будет работать с вашей компанией" />
          <p className="mt-5 leading-relaxed text-slate-600">
            Внедрение ведёт Оли Брайт — ACCA-квалифицированный специалист с опытом
            международного аудита и работы с финансовыми процессами компаний в России, на Кипре
            и в Австралии.
          </p>
          <p className="mt-4 leading-relaxed text-slate-600">
            Фокус работы — не подготовить ещё один отчёт, а помочь выстроить понятный процесс,
            который даёт руководителю более ясную картину будущего движения денег.
          </p>
        </div>
      </Container>
    </Section>
  );
}
