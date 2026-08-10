/**
 * Attribution parsing is the boundary between a query string — which anyone can
 * write — and six columns in the lead table. These tests are mostly about what
 * does NOT get stored.
 */
import {
  describeAttribution,
  isAttributionEmpty,
  MAX_ATTRIBUTION_LENGTH,
  normaliseLeadAttribution,
  parseLeadAttribution,
  sanitiseAttributionValue,
} from '@liqvia2/shared';

/** A realistic Yandex Direct landing URL. */
const YANDEX_QUERY =
  '?utm_source=yandex&utm_medium=cpc&utm_campaign=ru_cash_visibility_01' +
  '&utm_content=15382947361&utm_term=%D0%BA%D0%B0%D1%81%D1%81%D0%BE%D0%B2%D1%8B%D0%B9%20%D1%80%D0%B0%D0%B7%D1%80%D1%8B%D0%B2' +
  '&yclid=17395028461230004321';

describe('parseLeadAttribution', () => {
  it('reads a full Yandex Direct query string', () => {
    expect(parseLeadAttribution(YANDEX_QUERY)).toEqual({
      utmSource: 'yandex',
      utmMedium: 'cpc',
      utmCampaign: 'ru_cash_visibility_01',
      utmContent: '15382947361',
      utmTerm: 'кассовый разрыв',
      yclid: '17395028461230004321',
    });
  });

  it('works with or without the leading question mark', () => {
    expect(parseLeadAttribution('utm_source=yandex')).toEqual({ utmSource: 'yandex' });
    expect(parseLeadAttribution('?utm_source=yandex')).toEqual({ utmSource: 'yandex' });
  });

  it('returns nothing for an untagged visit', () => {
    expect(parseLeadAttribution('')).toEqual({});
    expect(isAttributionEmpty(parseLeadAttribution('?ref=newsletter'))).toBe(true);
  });

  it('ignores every parameter it does not recognise', () => {
    // The point of reading named parameters instead of storing the URL: a link
    // someone else built can carry anything, and none of it should be persisted.
    const result = parseLeadAttribution(
      '?utm_source=yandex&session_token=secret&email=someone@example.com&fbclid=abc',
    );
    expect(result).toEqual({ utmSource: 'yandex' });
  });

  it('tolerates upper-case parameter names', () => {
    expect(parseLeadAttribution('?UTM_Source=Yandex')).toEqual({ utmSource: 'Yandex' });
  });
});

describe('sanitiseAttributionValue', () => {
  it('truncates rather than dropping an over-long campaign name', () => {
    const long = 'x'.repeat(MAX_ATTRIBUTION_LENGTH.utmCampaign + 250);
    const value = sanitiseAttributionValue('utmCampaign', long);
    expect(value).toHaveLength(MAX_ATTRIBUTION_LENGTH.utmCampaign);
  });

  it('caps an unbounded value so one request cannot write megabytes', () => {
    const huge = 'a'.repeat(5_000_000);
    expect(sanitiseAttributionValue('utmTerm', huge)).toHaveLength(
      MAX_ATTRIBUTION_LENGTH.utmTerm,
    );
  });

  it('strips control characters, including NUL', () => {
    const value = sanitiseAttributionValue('utmCampaign', 'ru\u0000_cash\u0007_01');
    expect(value).toBe('ru_cash_01');
  });

  it('rejects a yclid that Yandex could not have produced', () => {
    expect(sanitiseAttributionValue('yclid', '1739502846')).toBe('1739502846');
    expect(sanitiseAttributionValue('yclid', "'; DROP TABLE")).toBeUndefined();
    expect(sanitiseAttributionValue('yclid', '<script>')).toBeUndefined();
  });

  it('drops an unsubstituted Yandex template rather than storing it as a campaign', () => {
    // A misconfigured campaign sends the literal placeholder. Storing it would
    // show up in a report looking exactly like a real campaign name.
    expect(sanitiseAttributionValue('utmCampaign', '{campaign_name}')).toBeUndefined();
    expect(sanitiseAttributionValue('utmTerm', '{keyword}')).toBeUndefined();
  });

  it('keeps Cyrillic values intact', () => {
    // Campaign names and matched keywords are routinely Russian; an ASCII-only
    // rule would silently discard attribution on the campaigns this is built for.
    expect(sanitiseAttributionValue('utmTerm', 'кассовый разрыв')).toBe('кассовый разрыв');
  });

  it('treats blank and non-string input as absent', () => {
    expect(sanitiseAttributionValue('utmSource', '   ')).toBeUndefined();
    expect(sanitiseAttributionValue('utmSource', 42)).toBeUndefined();
    expect(sanitiseAttributionValue('utmSource', null)).toBeUndefined();
  });
});

describe('normaliseLeadAttribution', () => {
  it('re-applies every rule to a client-supplied object', () => {
    expect(
      normaliseLeadAttribution({
        utmSource: 'yandex',
        yclid: 'not a yclid!',
        utmCampaign: 'x'.repeat(1000),
      }),
    ).toEqual({
      utmSource: 'yandex',
      utmCampaign: 'x'.repeat(MAX_ATTRIBUTION_LENGTH.utmCampaign),
    });
  });

  it('ignores extra keys a caller invents', () => {
    expect(
      normaliseLeadAttribution({ utmSource: 'yandex', name: 'Иван', email: 'a@b.co' }),
    ).toEqual({ utmSource: 'yandex' });
  });

  it('never throws on malformed input', () => {
    // Attribution must never be the reason a real enquiry is rejected.
    for (const input of [null, undefined, 'string', 42, [], [1, 2]]) {
      expect(normaliseLeadAttribution(input)).toEqual({});
    }
  });
});

describe('describeAttribution', () => {
  it('summarises a campaign without exposing the raw yclid', () => {
    const text = describeAttribution(parseLeadAttribution(YANDEX_QUERY));
    expect(text).toContain('yandex');
    expect(text).toContain('ru_cash_visibility_01');
    expect(text).toContain('кассовый разрыв');
    expect(text).toContain('yclid: есть');
    expect(text).not.toContain('17395028461230004321');
  });

  it('says so plainly when there was no campaign', () => {
    expect(describeAttribution({})).toContain('без меток');
  });
});
