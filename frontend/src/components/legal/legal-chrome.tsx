import type { ReactNode } from 'react';
import Link from 'next/link';
import { OPERATOR_IDENTIFICATION_RU } from '@/lib/consent';
import { publicationBlockers } from '@/lib/legal-publication';

/**
 * Shared chrome for `/privacy` and `/consent`.
 *
 * Both documents identify the same operator, carry the same draft gate and use
 * the same marker for facts nobody has verified yet, so all three live here
 * rather than being restated — and drifting — in each page.
 */

/** The canonical operator identification line, rendered identically on both pages. */
export function OperatorIdentity({ className = '' }: { className?: string }) {
  return (
    <p className={`font-medium text-slate-900 ${className}`.trim()}>
      {OPERATOR_IDENTIFICATION_RU}
    </p>
  );
}

/**
 * Marks a fact that has not been established. Every occurrence is enumerated in
 * `docs/legal/RU_CONSENT_IMPLEMENTATION.md`, and the presence of any occurrence
 * is a deployment blocker — the document must not be published while one exists.
 */
export function Unverified({ id, children }: { id: string; children: ReactNode }) {
  return (
    <mark
      data-unverified={id}
      className="rounded bg-amber-100 px-1 py-0.5 text-amber-900 ring-1 ring-amber-300"
    >
      {children}
    </mark>
  );
}

/**
 * Rendered whenever `isLegalPublicationReady()` is false. States plainly that
 * the document is not yet in force and lists exactly what is missing, so nobody
 * mistakes a draft for a published notice.
 */
export function DraftBanner() {
  const blockers = publicationBlockers();

  return (
    <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900">
      <p className="font-semibold">Проект документа — не опубликован и не вступил в силу</p>
      <p className="mt-2">
        Этот документ подготовлен, но ещё не опубликован. Сведения, выделенные жёлтым, не
        установлены и намеренно не утверждаются. До их подтверждения документ не должен
        использоваться как действующая политика, а сбор персональных данных через сайт не
        должен запускаться.
      </p>
      <p className="mt-3 font-medium">Не хватает:</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {blockers.map((blocker) => (
          <li key={blocker}>{blocker}</li>
        ))}
      </ul>
      <p className="mt-3">
        Draft — not published and not in force. Highlighted facts are unverified and are
        deliberately not asserted.
      </p>
    </div>
  );
}

/** A numbered section with a Russian heading and an optional English subtitle. */
export function LegalSection({
  titleRu,
  titleEn,
  children,
}: {
  titleRu: string;
  titleEn?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-slate-900">{titleRu}</h2>
      {titleEn && <p className="text-sm font-medium text-slate-500">{titleEn}</p>}
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

/** Back link to the landing page, shared by both documents. */
export function LegalBackLink() {
  return (
    <Link href="/cash-operating-system" className="text-sm text-blue-600 hover:underline">
      ← Cash Operating System
    </Link>
  );
}
