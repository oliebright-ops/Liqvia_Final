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

        <p className="mt-4 text-xs text-slate-400">
          © {new Date().getFullYear()} Cash Operating System. Все права защищены.
        </p>
      </Container>
    </footer>
  );
}
