import Link from 'next/link';
import { OPERATOR_IDENTIFICATION_RU, PRIVACY_POLICY_PATH } from '@/lib/consent';
import { PRIVACY_POLICY_TITLE_RU } from '@/lib/legal-text';
import { Container } from './primitives';

export function CashOsFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-10">
      <Container>
        <p className="text-sm font-semibold text-slate-900">Cash Operating System</p>
        <p className="mt-1 text-sm text-slate-600">Внедрение — Оли Брайт · Платформа — Liqvia</p>

        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-slate-500">
          Информация на сайте носит справочный характер. Конкретные коммерческие условия
          сотрудничества согласовываются индивидуально на консультации. Материалы сайта не
          являются публичной офертой и не являются бухгалтерской, налоговой, инвестиционной или
          юридической консультацией.
        </p>

        {/* The operator must be identifiable from the page that collects the data,
            not only from the documents it links to. */}
        <p className="mt-6 text-xs text-slate-500">{OPERATOR_IDENTIFICATION_RU}</p>

        {/* Only the privacy notice is linked. `/consent` describes the affirmative
            checkbox consent, which the form no longer shows — it displays a passive
            notice instead — and that document is still a draft carrying a "not in
            force" banner. Linking it from the launch footer would present a draft
            as if it governed the visitor's submission. The route still resolves and
            stays out of search indexes; it is simply not advertised. Restore this
            link at the same time as the checkbox, never before. */}
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
          <Link
            href={PRIVACY_POLICY_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
          >
            {PRIVACY_POLICY_TITLE_RU}
          </Link>
        </p>

        <p className="mt-4 text-xs text-slate-400">
          © {new Date().getFullYear()} Cash Operating System. Все права защищены.
        </p>
      </Container>
    </footer>
  );
}
