'use client';

import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Container, PrimaryCta } from './primitives';

const NAV_LINKS = [
  { href: '#problem', label: 'Проблема' },
  { href: '#cash-operating-system', label: 'Как работает' },
  { href: '#roadmap', label: 'Внедрение' },
  { href: '#about', label: 'О консультанте' },
  { href: '#faq', label: 'Вопросы' },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <span className="text-sm font-semibold tracking-tight text-slate-900">Cash Operating System</span>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Основная навигация">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:block">
          <PrimaryCta className="h-10 px-5 text-sm">Записаться на диагностику</PrimaryCta>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="cash-os-mobile-menu"
          aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 lg:hidden"
        >
          {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </Container>

      {menuOpen && (
        <nav
          id="cash-os-mobile-menu"
          aria-label="Мобильная навигация"
          className="border-t border-slate-200 bg-white px-6 py-4 lg:hidden"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-2 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <PrimaryCta href="/#apply" className="mt-3 w-full">
            Записаться на диагностику
          </PrimaryCta>
        </nav>
      )}
    </header>
  );
}
