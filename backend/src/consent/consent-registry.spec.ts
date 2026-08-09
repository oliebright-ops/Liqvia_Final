/**
 * Guards the properties of the consent registry that a legal review depends on.
 *
 * These are not tests of behaviour — they are tests that the wording itself has
 * not drifted from what was approved, which is the failure mode nobody notices
 * until a regulator does.
 */
import {
  ACTIVE_CONSENT_VERSION,
  CASH_OS_LEAD_FORM_CONSENT_TEXT,
  CONSENT_LINK_PHRASES,
  CONSENT_POLICY_VERSION,
  CONSENT_TEXT_ARCHIVE,
  MARKETING_CONSENT_ENABLED,
  MARKETING_LEAD_CONSENT_SUBJECT,
  OPERATOR_CONTACT_EMAIL,
  OPERATOR_FULL_NAME,
  OPERATOR_IDENTIFICATION_RU,
  OPERATOR_SHORT_DESIGNATION_RU,
  REQUIRED_LEAD_CONSENT_SUBJECT,
  activeConsentEntry,
  assertOperatorDesignation,
  buildMarketingConsentText,
  isOperatorContactVerified,
  lookupConsentText,
  operatorPrivateConfig,
  segmentConsentText,
} from '@liqvia2/shared';

describe('operator identity', () => {
  it('identifies the operator by name and legal status, and by nothing further', () => {
    expect(OPERATOR_IDENTIFICATION_RU).toBe(
      'Оператор персональных данных: Оли Брайт Бабатунде, физическое лицо',
    );
    expect(OPERATOR_FULL_NAME).toBe('Оли Брайт Бабатунде');
  });

  it('publishes no tax identifier anywhere in the operator identity', () => {
    // The ИНН is private configuration, not public legal disclosure. Reintroducing
    // it into published wording is a legal decision — see packages/shared/src/operator.ts.
    for (const text of [OPERATOR_IDENTIFICATION_RU, OPERATOR_SHORT_DESIGNATION_RU]) {
      expect(text).not.toMatch(/ИНН/);
      expect(text).not.toMatch(/\d{4,}/);
    }
  });

  it('rejects wording that publishes a tax identifier', () => {
    expect(() =>
      // Synthetic identifier: the real one must not appear in the repository at all.
      assertOperatorDesignation('Оли Брайт Бабатунде, физическое лицо, ИНН 000000000000', 'test'),
    ).toThrow(/tax identifier/);
  });

  it('keeps private operator configuration out of the browser', () => {
    const globalWithWindow = globalThis as { window?: unknown };
    const had = 'window' in globalWithWindow;
    globalWithWindow.window = {};
    try {
      expect(() => operatorPrivateConfig()).toThrow(/server-only/);
    } finally {
      if (!had) delete globalWithWindow.window;
    }
  });

  it('rejects an ОГРНИП, which a natural person does not have', () => {
    expect(() => assertOperatorDesignation('ОГРНИП 123456789012345', 'test')).toThrow(/ОГРНИП/);
  });

  it('rejects describing the operator as an individual entrepreneur', () => {
    expect(() =>
      assertOperatorDesignation('Индивидуальный предприниматель Оли Брайт Бабатунде', 'test'),
    ).toThrow(/individual entrepreneur/);
    expect(() => assertOperatorDesignation('Оператор: ИП Бабатунде', 'test')).toThrow(/ИП/);
  });

  it('permits the negated status line', () => {
    expect(() =>
      assertOperatorDesignation(
        'Оли Брайт Бабатунде, физическое лицо, не индивидуальный предприниматель',
        'test',
      ),
    ).not.toThrow();
  });

  it('treats contact details as unverified until real values are supplied', () => {
    // This assertion exists so that supplying the contact details is a deliberate
    // act that updates this expectation, not something that slips in unnoticed.
    if (OPERATOR_CONTACT_EMAIL === null) {
      expect(isOperatorContactVerified()).toBe(false);
    } else {
      expect(isOperatorContactVerified()).toBe(true);
    }
  });
});

describe('required lead-form consent wording', () => {
  const active = activeConsentEntry(REQUIRED_LEAD_CONSENT_SUBJECT);

  it('is the exact approved sentence', () => {
    expect(CASH_OS_LEAD_FORM_CONSENT_TEXT).toBe(
      'Я даю Оли Брайту Бабатунде согласие на обработку моих персональных ' +
        'данных, указанных в форме, с целью рассмотрения моего обращения, связи со мной, ' +
        'организации и проведения консультации в соответствии с отдельным Согласием на ' +
        'обработку персональных данных. Я ознакомлен(а) с Политикой обработки персональных ' +
        'данных.',
    );
  });

  it('publishes no tax identifier in any registered wording', () => {
    for (const entry of Object.values(CONSENT_TEXT_ARCHIVE)) {
      expect(entry.text).not.toMatch(/ИНН/);
    }
  });

  it('is registered as required and points at the current policy version', () => {
    expect(active.obligation).toBe('required');
    expect(active.text).toBe(CASH_OS_LEAD_FORM_CONSENT_TEXT);
    expect(active.policyVersion).toBe(CONSENT_POLICY_VERSION);
    expect(active.locale).toBe('ru');
  });

  it('contains both linked phrases exactly once', () => {
    for (const phrase of Object.values(CONSENT_LINK_PHRASES)) {
      expect(CASH_OS_LEAD_FORM_CONSENT_TEXT.split(phrase)).toHaveLength(2);
    }
  });

  it('splits into segments that reassemble into the identical sentence', () => {
    const segments = segmentConsentText(CASH_OS_LEAD_FORM_CONSENT_TEXT, [
      { phrase: CONSENT_LINK_PHRASES.consentDocument, href: '/consent' },
      { phrase: CONSENT_LINK_PHRASES.privacyPolicy, href: '/privacy' },
    ]);

    expect(segments.map((s) => s.text).join('')).toBe(CASH_OS_LEAD_FORM_CONSENT_TEXT);
    expect(segments.filter((s) => s.href).map((s) => s.href)).toEqual(['/consent', '/privacy']);
  });

  it('throws rather than silently unlinking a phrase that is not present', () => {
    expect(() =>
      segmentConsentText('какой-то другой текст', [{ phrase: 'отсутствует', href: '/x' }]),
    ).toThrow(/does not contain the linked phrase/);
  });
});

describe('consent archive', () => {
  it('keeps every superseded version resolvable', () => {
    // A stored ConsentRecord points at a version by key; dropping the entry would
    // orphan the evidence.
    expect(lookupConsentText('cash-os-lead-form', '2026-08-09.1')).toBeDefined();
    expect(lookupConsentText('cash-os-lead-form', '2026-08-10.1')).toBeDefined();
  });

  it('has an entry for every active version', () => {
    for (const [id, version] of Object.entries(ACTIVE_CONSENT_VERSION)) {
      const entry = lookupConsentText(id, version);
      if (id === MARKETING_LEAD_CONSENT_SUBJECT && !MARKETING_CONSENT_ENABLED) {
        // Deliberately unregistered until an opt-out address exists.
        expect(entry).toBeUndefined();
        continue;
      }
      expect(entry).toBeDefined();
    }
  });

  it('carries no prohibited operator designation in any registered wording', () => {
    for (const [key, entry] of Object.entries(CONSENT_TEXT_ARCHIVE)) {
      expect(() => assertOperatorDesignation(entry.text, key)).not.toThrow();
    }
  });
});

describe('optional marketing consent', () => {
  it('is disabled while no verified opt-out address exists', () => {
    if (OPERATOR_CONTACT_EMAIL === null) {
      expect(MARKETING_CONSENT_ENABLED).toBe(false);
      expect(lookupConsentText(MARKETING_LEAD_CONSENT_SUBJECT, '2026-08-10.1')).toBeUndefined();
    }
  });

  it('produces no wording at all without an address, rather than a placeholder', () => {
    expect(buildMarketingConsentText(null)).toBeNull();
    expect(buildMarketingConsentText('   ')).toBeNull();
  });

  it('names the operator and the opt-out address once an address is supplied', () => {
    const text = buildMarketingConsentText('example@example.org');

    expect(text).toBe(
      'Я отдельно соглашаюсь получать информационные и рекламные сообщения от Оли Брайта ' +
        'Бабатунде по указанным мной контактным данным. Я могу отказаться ' +
        'от сообщений в любое время, направив обращение по адресу example@example.org.',
    );
    expect(text).not.toContain('ПОДТВЕРЖДЁННЫЙ EMAIL');
  });
});
