import { CounterpartyRegistry } from './pseudonymise';
import { MAX_FREE_TEXT_LENGTH, redactFreeText, safeLabel } from './redaction';

describe('redactFreeText — structural identifiers', () => {
  it.each([
    ['email address', 'Email ivan.petrov@romashka.ru today', 'ivan.petrov@romashka.ru', '[EMAIL]'],
    ['phone with country code', 'Call +7 916 555 21 43 now', '916 555', '[PHONE]'],
    ['RU settlement account', 'Account 40702810900000012345 is wrong', '40702810900000012345', '[BANK_ACCOUNT]'],
    ['IBAN', 'Send to GB29NWBK60161331926819 please', 'GB29NWBK60161331926819', '[BANK_ACCOUNT]'],
    ['card number', 'Card 4111 1111 1111 1111 declined', '4111 1111', '[CARD_NUMBER]'],
    ['URL', 'See https://internal.acme.ru/invoices/9 for detail', 'internal.acme.ru', '[URL]'],
  ])('removes %s', (_label, input, secret, placeholder) => {
    const { text } = redactFreeText(input);
    expect(text).not.toContain(secret);
    expect(text).toContain(placeholder);
  });

  it('removes an RU tax identifier', () => {
    const { text } = redactFreeText('Counterparty INN 7707083893 has not paid');
    expect(text).not.toContain('7707083893');
  });

  it('leaves ordinary money amounts alone so the question still makes sense', () => {
    const { text } = redactFreeText('Can I afford a 250000 payment in week 4?');
    expect(text).toContain('250000');
    expect(text).toContain('week 4');
  });

  it('reports what it removed by type, never by value', () => {
    const { removed } = redactFreeText('a@b.com and +44 20 7946 0958');
    expect(removed.email).toBe(1);
    expect(removed.phone).toBe(1);
    expect(JSON.stringify(removed)).not.toContain('a@b.com');
  });

  it('truncates a paste rather than forwarding it', () => {
    const { text, truncated } = redactFreeText('x'.repeat(MAX_FREE_TEXT_LENGTH + 500));
    expect(truncated).toBe(true);
    expect(text.length).toBeLessThanOrEqual(MAX_FREE_TEXT_LENGTH);
  });

  it('handles empty and missing input', () => {
    expect(redactFreeText(undefined).text).toBe('');
    expect(redactFreeText('').text).toBe('');
  });
});

describe('redactFreeText — counterparty substitution preserves meaning', () => {
  function registryWith(...names: string[]) {
    const registry = new CounterpartyRegistry('company-1');
    for (const name of names) registry.code('CUSTOMER', name);
    return registry;
  }

  it('replaces a known customer name with its code, keeping the question answerable', () => {
    const registry = registryWith('Ivan Petrov');
    const { text } = redactFreeText('When will Ivan Petrov pay us?', registry);

    expect(text).not.toContain('Ivan Petrov');
    expect(text).toMatch(/^When will CUSTOMER_C\d{3} pay us\?$/);
  });

  it('gives two different customers two different codes', () => {
    const registry = registryWith('Alpha Ltd', 'Beta Ltd');
    const { text } = redactFreeText('Compare Alpha Ltd with Beta Ltd', registry);
    const codes = text.match(/CUSTOMER_C\d{3}/g) ?? [];

    expect(codes).toHaveLength(2);
    expect(codes[0]).not.toBe(codes[1]);
  });

  it('matches the longer name first so a prefix does not shadow it', () => {
    const registry = new CounterpartyRegistry('company-1');
    const shortCode = registry.code('CUSTOMER', 'Acme');
    const longCode = registry.code('CUSTOMER', 'Acme Trading Ltd');

    const { text } = redactFreeText('Chase Acme Trading Ltd this week', registry);
    expect(text).toContain(longCode);
    expect(text).not.toContain('Trading Ltd');
    expect(text).not.toBe(`Chase ${shortCode} Trading Ltd this week`);
  });

  it('is case-insensitive', () => {
    const registry = registryWith('Ivan Petrov');
    const { text } = redactFreeText('chase IVAN PETROV', registry);
    expect(text.toLowerCase()).not.toContain('ivan');
  });

  it('gives the same counterparty the same code across calls', () => {
    const registry = registryWith('Ivan Petrov');
    const first = redactFreeText('Ivan Petrov', registry).text;
    const second = redactFreeText('and Ivan Petrov again', registry).text;
    expect(second).toContain(first);
  });
});

describe('safeLabel', () => {
  it('caps length', () => {
    expect(safeLabel('x'.repeat(200), 60)).toHaveLength(60);
  });

  it('redacts identifiers hiding in a category name', () => {
    expect(safeLabel('Salaries ivan@acme.ru')).not.toContain('ivan@acme.ru');
  });

  it('returns an empty string for missing input', () => {
    expect(safeLabel(undefined)).toBe('');
  });
});

describe('CounterpartyRegistry', () => {
  it('produces stable codes for the same name', () => {
    const registry = new CounterpartyRegistry('company-1');
    expect(registry.code('CUSTOMER', 'Ivan Petrov')).toBe(registry.code('CUSTOMER', 'Ivan Petrov'));
  });

  it('ignores case and surrounding whitespace when matching', () => {
    const registry = new CounterpartyRegistry('company-1');
    expect(registry.code('SUPPLIER', '  Acme Ltd ')).toBe(registry.code('SUPPLIER', 'acme ltd'));
  });

  it('never issues the same code to two different counterparties', () => {
    const registry = new CounterpartyRegistry('company-1');
    const codes = new Set<string>();
    for (let i = 0; i < 300; i += 1) codes.add(registry.code('CUSTOMER', `Counterparty ${i}`));
    expect(codes.size).toBe(300);
  });

  it('separates the same name across different kinds', () => {
    const registry = new CounterpartyRegistry('company-1');
    expect(registry.code('CUSTOMER', 'Acme')).not.toBe(registry.code('SUPPLIER', 'Acme'));
  });

  it('gives a different code for the same name in a different company', () => {
    const a = new CounterpartyRegistry('company-a').code('CUSTOMER', 'Acme Ltd');
    const b = new CounterpartyRegistry('company-b').code('CUSTOMER', 'Acme Ltd');
    expect(a).not.toBe(b);
  });

  it('collapses missing names into one bucket instead of inventing identities', () => {
    const registry = new CounterpartyRegistry('company-1');
    expect(registry.code('CUSTOMER', '')).toBe('CUSTOMER_UNSPECIFIED');
    expect(registry.code('CUSTOMER', null)).toBe('CUSTOMER_UNSPECIFIED');
  });

  it('emits codes that contain no part of the original name', () => {
    const registry = new CounterpartyRegistry('company-1');
    const code = registry.code('CUSTOMER', 'Ivan Petrov');
    expect(code.toLowerCase()).not.toContain('ivan');
    expect(code.toLowerCase()).not.toContain('petrov');
  });
});
