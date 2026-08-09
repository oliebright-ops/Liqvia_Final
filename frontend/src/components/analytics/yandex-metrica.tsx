'use client';

import { useEffect, useRef } from 'react';
import { trackCtaEvent } from '@/components/cash-os/analytics';

const METRICA_ID = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID ?? '111417446';
const METRICA_HOSTS = new Set(['liqvia.info', 'www.liqvia.info']);

export function YandexMetrica() {
  const deepScrollTracked = useRef(false);

  useEffect(() => {
    if (!METRICA_HOSTS.has(window.location.hostname.toLowerCase())) return;

    if (typeof window.ym !== 'function') {
      const queuedYm = ((...args: unknown[]) => {
        queuedYm.a = queuedYm.a ?? [];
        queuedYm.a.push(args);
      }) as NonNullable<Window['ym']>;
      queuedYm.l = Date.now();
      window.ym = queuedYm;
    }

    window.ym(Number(METRICA_ID), 'init', {
      ssr: true,
      clickmap: true,
      accurateTrackBounce: true,
      trackLinks: true,
    });

    const metricaSrc = `https://mc.yandex.ru/metrika/tag.js?id=${METRICA_ID}`;
    if (!document.querySelector(`script[src="${metricaSrc}"]`)) {
      const script = document.createElement('script');
      script.async = true;
      script.src = metricaSrc;
      document.head.appendChild(script);
    }

    function trackDeepScroll() {
      if (deepScrollTracked.current) return;

      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollableHeight <= 0) return;

      if (window.scrollY / scrollableHeight >= 0.9) {
        deepScrollTracked.current = true;
        trackCtaEvent('deep_scroll_90');
        window.removeEventListener('scroll', trackDeepScroll);
      }
    }

    window.addEventListener('scroll', trackDeepScroll, { passive: true });
    trackDeepScroll();
    return () => window.removeEventListener('scroll', trackDeepScroll);
  }, []);

  return null;
}
