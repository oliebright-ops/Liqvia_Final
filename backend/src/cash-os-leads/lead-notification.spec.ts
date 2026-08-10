/**
 * What a lead notification carries.
 *
 * This file twice asserted the opposite of what it asserts now, and the history
 * is the point. It began by requiring that the body contain *no* identity at
 * all, on the assumption that the operator would look the lead up in an
 * RU-hosted view. That view was never built — the owner decided on 2026-08-10
 * not to build one — which left a notification nobody could act on.
 *
 * So the body now carries the contact details deliberately. The closed-template
 * assertion below is what keeps that a decision rather than a drift: any field
 * added or removed in future fails this test and has to be argued for.
 */
import { buildNotificationBody, leadReference } from './lead-notification.service';

const FULL = {
  leadId: 'cmskfegc80000hp343rmbqymy',
  name: 'Иван Петров',
  companyName: 'ООО «Ромашка»',
  email: 'ivan.petrov@example.com',
  phone: '+7 916 555 44 33',
  role: 'Финансовый директор',
  employeeCount: '51–100',
  industry: 'Строительство',
  comment: 'Хотим обсудить прогноз ДДС на 13 недель',
  source: 'cash-operating-system-landing',
  attribution: {
    utmSource: 'yandex',
    utmMedium: 'cpc',
    utmCampaign: 'ru_cash_visibility_01',
    utmTerm: 'кассовый разрыв',
    yclid: '17395028461230004321',
  },
  receivedAt: new Date('2026-08-14T09:22:00Z'),
};

describe('lead notification body', () => {
  const body = buildNotificationBody(FULL);

  it('carries everything needed to follow the lead up', () => {
    expect(body).toContain('RU-MBQYMY');
    expect(body).toContain('2026-08-14 09:22');
    expect(body).toContain('Иван Петров');
    expect(body).toContain('ООО «Ромашка»');
    expect(body).toContain('ivan.petrov@example.com');
    expect(body).toContain('+7 916 555 44 33');
    expect(body).toContain('Хотим обсудить прогноз ДДС на 13 недель');
  });

  it('names the campaign that produced the lead', () => {
    expect(body).toContain('ru_cash_visibility_01');
    expect(body).toContain('кассовый разрыв');
  });

  it('does not include the raw yclid', () => {
    // Useful in the database, pointless in a message. Reporting that one exists
    // keeps the summary honest without copying the click identifier around.
    expect(body).not.toContain('17395028461230004321');
    expect(body).toContain('yclid: есть');
  });

  it('is exactly the fixed template — any added or removed field breaks this', () => {
    expect(body.split('\n')).toEqual([
      'Новая заявка Liqvia (Россия).',
      'Идентификатор: RU-MBQYMY',
      'Получена: 2026-08-14 09:22 UTC',
      '',
      'Имя: Иван Петров',
      'Компания: ООО «Ромашка»',
      'Email: ivan.petrov@example.com',
      'Телефон / Telegram: +7 916 555 44 33',
      'Должность: Финансовый директор',
      'Сотрудников: 51–100',
      'Отрасль: Строительство',
      '',
      'Комментарий: Хотим обсудить прогноз ДДС на 13 недель',
      '',
      'Привлечение: источник: yandex · канал: cpc · кампания: ru_cash_visibility_01 · запрос: кассовый разрыв · yclid: есть',
      'Форма: cash-operating-system-landing',
    ]);
  });

  it('omits optional fields rather than showing them empty', () => {
    // A lead with only the three required fields must still produce a short,
    // readable message — not a wall of blank labels on a phone screen.
    const minimal = buildNotificationBody({
      leadId: 'lead-000001',
      name: 'Анна',
      companyName: 'ИП Анна',
      email: 'anna@example.com',
      receivedAt: new Date('2026-08-14T09:22:00Z'),
    });

    expect(minimal).not.toContain('Телефон');
    expect(minimal).not.toContain('Комментарий');
    expect(minimal).not.toContain('Должность');
    expect(minimal).toContain('без меток');
    expect(minimal).toContain('Форма: не указана');
  });

  it('derives a stable, non-reversible reference from the internal id', () => {
    expect(leadReference('cmskfegc80000hp343rmbqymy')).toBe('RU-MBQYMY');
    expect(leadReference('abc')).toBe('RU-ABC');
    expect(leadReference('')).toBe('RU-000000');
    // Same input, same reference — the operator can quote it back.
    expect(leadReference('lead-42')).toBe(leadReference('lead-42'));
  });
});
