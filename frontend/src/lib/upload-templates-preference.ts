const WELCOME_KEY = 'liqvia.uploadCenterWelcome';
const PANEL_OPEN_KEY = 'liqvia.uploadTemplatesPanelOpen';

/** Call when onboarding finishes so Upload Center opens templates on first visit. */
export function markUploadCenterWelcome(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(WELCOME_KEY, '1');
}

export function consumeUploadCenterWelcome(): boolean {
  if (typeof window === 'undefined') return false;
  const welcome = sessionStorage.getItem(WELCOME_KEY) === '1';
  if (welcome) sessionStorage.removeItem(WELCOME_KEY);
  return welcome;
}

export function readUploadTemplatesPanelOpen(): boolean | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(PANEL_OPEN_KEY);
  if (raw === null) return null;
  return raw === 'true';
}

export function writeUploadTemplatesPanelOpen(open: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PANEL_OPEN_KEY, String(open));
}
