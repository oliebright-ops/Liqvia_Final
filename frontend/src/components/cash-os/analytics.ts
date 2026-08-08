'use client';

/**
 * CTA/engagement events tracked across the Cash Operating System landing page.
 * Static `data-cta-event="..."` attributes on links/buttons cover markup-based
 * tracking (Metrica click-map, future GTM); `trackCtaEvent` additionally fires
 * a Metrica goal from client components where a real click handler exists.
 *
 * No Metrica counter is installed yet, so this is a safe no-op until
 * NEXT_PUBLIC_YANDEX_METRICA_ID is set and the Metrica snippet is added —
 * intentionally not inventing a tracking ID here.
 */
export type CtaEvent =
  | 'hero_primary_cta'
  | 'hero_secondary_cta'
  | 'middle_primary_cta'
  | 'pilot_apply_cta'
  | 'form_start'
  | 'form_submit'
  | 'product_walkthrough_open'
  | 'faq_open'
  | 'linkedin_click';

declare global {
  interface Window {
    ym?: (counterId: number, action: string, target: string) => void;
  }
}

export function trackCtaEvent(event: CtaEvent): void {
  if (typeof window === 'undefined') return;
  const counterId = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID;
  if (!counterId || typeof window.ym !== 'function') return;
  window.ym(Number(counterId), 'reachGoal', event);
}
