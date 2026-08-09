/**
 * The notification must never carry the lead's identity.
 *
 * This is the test that stops the thirty-second "helpful" change: putting the
 * name and phone in the email so the operator can read it without logging in.
 */
import { buildNotificationBody, leadReference } from './lead-notification.service';

const IDENTITY = {
  name: 'Иван Петров',
  email: 'ivan.petrov@example.com',
  phone: '+7 916 555 44 33',
  company: 'ООО «Ромашка»',
  comment: 'Хотим обсудить прогноз ДДС',
};

describe('lead notification body', () => {
  const body = buildNotificationBody(
    { leadId: 'cmskfegc80000hp343rmbqymy', source: 'ru_cash_visibility_01', receivedAt: new Date('2026-08-14T09:22:00Z') },
    'https://liqvia.info',
  );

  it('carries a reference, a timestamp and a campaign tag', () => {
    expect(body).toContain('RU-MBQYMY');
    expect(body).toContain('2026-08-14 09:22');
    expect(body).toContain('ru_cash_visibility_01');
    expect(body).toContain('https://liqvia.info/leads/');
  });

  it('contains none of the lead identity', () => {
    for (const [field, value] of Object.entries(IDENTITY)) {
      expect(body).not.toContain(value);
      expect(`${field}:${body}`).not.toMatch(/ivan\.petrov/);
    }
  });

  it('contains no email address', () => {
    expect(body).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  });

  it('is exactly the fixed template — any added field breaks this', () => {
    // Stronger than pattern-matching for contact details: the body is a closed
    // template, so a future "just add the name so I can see it" change fails here
    // rather than being caught by a regex that happens to cover that field.
    expect(body.split('\n')).toEqual([
      'Новая заявка Liqvia (Россия).',
      'Идентификатор: RU-MBQYMY',
      'Получена: 2026-08-14 09:22 UTC',
      'Кампания: ru_cash_visibility_01',
      '',
      'Контактные данные не включены в это письмо намеренно.',
      'Открыть заявку: https://liqvia.info/leads/RU-MBQYMY',
    ]);
  });

  it('says explicitly that contact details were withheld on purpose', () => {
    expect(body).toContain('намеренно');
  });

  it('derives a stable, non-reversible reference from the internal id', () => {
    expect(leadReference('cmskfegc80000hp343rmbqymy')).toBe('RU-MBQYMY');
    expect(leadReference('abc')).toBe('RU-ABC');
    expect(leadReference('')).toBe('RU-000000');
    // Same input, same reference — the operator can quote it back.
    expect(leadReference('lead-42')).toBe(leadReference('lead-42'));
  });
});
