/**
 * First-touch attribution capture in the browser.
 *
 * Run with:  pnpm --filter @liqvia2/frontend test
 *
 * The behaviour worth pinning down is the one that is invisible when it breaks:
 * a visitor arrives on a tagged URL, opens the privacy notice, comes back to a
 * bare URL and submits. If capture happened at submit time the campaign would be
 * silently lost and the lead would report as organic — which looks like a
 * reporting quirk and is actually the difference between a campaign that appears
 * to work and one that appears not to.
 */
import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

/** Minimal `window` stand-in: the module only touches `location.search` and `sessionStorage`. */
function installWindow(search: string) {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  (globalThis as Record<string, unknown>).window = {
    location: { search },
    sessionStorage,
  };
  return { store, setSearch: (s: string) => {
    ((globalThis as Record<string, unknown>).window as { location: { search: string } })
      .location.search = s;
  } };
}

const TAGGED =
  '?utm_source=yandex&utm_medium=cpc&utm_campaign=ru_cash_visibility_01&yclid=17395028461230004321';

beforeEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

test('captures attribution from a tagged landing URL', async () => {
  installWindow(TAGGED);
  const mod = await import('./lead-attribution-capture');

  mod.captureLeadAttribution();

  assert.deepEqual(mod.readLeadAttribution(), {
    utmSource: 'yandex',
    utmMedium: 'cpc',
    utmCampaign: 'ru_cash_visibility_01',
    yclid: '17395028461230004321',
  });
});

test('survives a detour to the privacy page and back to a bare URL', async () => {
  const ctx = installWindow(TAGGED);
  const mod = await import('./lead-attribution-capture');

  mod.captureLeadAttribution();
  // The visitor follows the privacy link and returns; the query string is gone.
  ctx.setSearch('');
  mod.captureLeadAttribution();

  const attribution = mod.readLeadAttribution();
  assert.equal(attribution.utmCampaign, 'ru_cash_visibility_01');
  assert.equal(attribution.utmSource, 'yandex');
});

test('first touch wins — a later untagged pageview does not overwrite it', async () => {
  const ctx = installWindow(TAGGED);
  const mod = await import('./lead-attribution-capture');

  mod.captureLeadAttribution();
  ctx.setSearch('?utm_source=newsletter&utm_campaign=other');
  mod.captureLeadAttribution();

  assert.equal(mod.readLeadAttribution().utmCampaign, 'ru_cash_visibility_01');
});

test('an untagged visit captures and reports nothing', async () => {
  installWindow('');
  const mod = await import('./lead-attribution-capture');

  mod.captureLeadAttribution();

  assert.deepEqual(mod.readLeadAttribution(), {});
});

test('a tampered sessionStorage value is re-validated, not trusted', async () => {
  const ctx = installWindow('');
  const mod = await import('./lead-attribution-capture');

  // Anyone with the console open can write this.
  ctx.store.set(
    'liqvia.lead.attribution',
    JSON.stringify({ utmSource: 'yandex', yclid: "'; DROP TABLE", nonsense: 'x' }),
  );

  const attribution = mod.readLeadAttribution();
  assert.equal(attribution.utmSource, 'yandex');
  assert.equal(attribution.yclid, undefined);
  assert.equal((attribution as Record<string, unknown>).nonsense, undefined);
});

test('corrupt stored JSON falls back to the URL instead of throwing', async () => {
  const ctx = installWindow('?utm_source=yandex');
  const mod = await import('./lead-attribution-capture');

  ctx.store.set('liqvia.lead.attribution', 'not json');

  assert.deepEqual(mod.readLeadAttribution(), { utmSource: 'yandex' });
});

test('does nothing at all when there is no window (server render)', async () => {
  const mod = await import('./lead-attribution-capture');

  assert.doesNotThrow(() => mod.captureLeadAttribution());
  assert.deepEqual(mod.readLeadAttribution(), {});
});
