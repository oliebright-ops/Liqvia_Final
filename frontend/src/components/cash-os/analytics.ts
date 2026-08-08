'use client';

/**
 * CTA/engagement events tracked across the Cash Operating System landing page.
 * Static `data-cta-event="..."` attributes on links/buttons cover markup-based
 * tracking (Metrica click-map, future GTM); `trackCtaEvent` additionally fires
 * a Metrica goal from client components where a real click handler exists.
 *
 * The production counter defaults to Liqvia's Metrica counter. The environment
 * variable remains available for preview or staging deployments.
 */
export type CtaEvent =
  | 'hero_primary_cta'
  | 'hero_secondary_cta'
  | 'middle_primary_cta'
  | 'pilot_apply_cta'
  | 'form_start'
  | 'form_submit'
  | 'product_walkthrough_open'
  | 'faq_click'
  | 'deep_scroll_90'
  | 'linkedin_click';

declare global {
  interface Window {
    ym?: (counterId: number, action: string, target: string) => void;
  }
}

export function trackCtaEvent(event: CtaEvent): void {
  if (typeof window === 'undefined') return;
  const counterId = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID ?? '111417446';
  if (typeof window.ym !== 'function') return;
  window.ym(Number(counterId), 'reachGoal', event);
}
