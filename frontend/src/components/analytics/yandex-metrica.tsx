'use client';

import Script from 'next/script';
import { useEffect, useRef } from 'react';
import { trackCtaEvent } from '@/components/cash-os/analytics';

const METRICA_ID = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID ?? '111417446';

export function YandexMetrica() {
  const deepScrollTracked = useRef(false);

  useEffect(() => {
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

  return (
    <>
      <Script id="yandex-metrica" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=${METRICA_ID}','ym');ym(${METRICA_ID},'init',{ssr:true,webvisor:true,clickmap:true,accurateTrackBounce:true,trackLinks:true});`}
      </Script>
      <noscript>
        <img
          src={`https://mc.yandex.ru/watch/${METRICA_ID}`}
          style={{ position: 'absolute', left: '-9999px' }}
          alt=""
        />
      </noscript>
    </>
  );
}
