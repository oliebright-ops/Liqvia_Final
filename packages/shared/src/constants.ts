/** Default company when no tenant is selected (matches samples/demo-data/manifest.json). */
export const DEFAULT_DEMO_COMPANY_ID = 'demo-consulting';

/** Display name used in demo-mode onboarding UX. */
export const DEMO_COMPANY_DISPLAY_NAME = 'Acme Construction';

/** Cash-Driven Mode demo entity — an NDIS provider, seeded directly (not via the AR/AP CSV demo pack). */
export const NDIS_DEMO_COMPANY_ID = 'demo-ndis-care';

export const DEMO_COMPANY_IDS = [DEFAULT_DEMO_COMPANY_ID, NDIS_DEMO_COMPANY_ID] as const;
