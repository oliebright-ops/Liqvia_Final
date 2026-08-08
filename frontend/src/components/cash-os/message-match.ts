/**
 * Whitelisted Yandex Direct message-match variants for ?industry= and ?intent=.
 *
 * Only adjusts the hero eyebrow/H1/supporting line and (for industry) one pain
 * example — never the rest of the page. Values are hardcoded here, not derived
 * from the query string, so an arbitrary query parameter can never inject
 * customer-facing HTML/text onto the page.
 */

export interface IndustryVariant {
  eyebrow: string;
  headline: string;
  supporting: string;
  pain: string;
}

export interface IntentVariant {
  supporting: string;
}

export const INDUSTRY_VARIANTS: Record<string, IndustryVariant> = {
  construction: {
    eyebrow: 'Управление денежными потоками строительной компании',
    headline: 'Прибыль по проекту есть. А денег на следующий этап хватит?',
    supporting:
      'Видите будущие поступления, выплаты по проектам и возможные кассовые разрывы между этапами работ.',
    pain: '«Деньги за этап получены, а следующий этап уже требует закупки материалов.»',
  },
  manufacturing: {
    eyebrow: 'Управление денежными потоками производственной компании',
    headline: 'Прибыль есть. А денег всё равно постоянно не хватает?',
    supporting: 'Планируйте закупки, выплаты и оборотный капитал с учётом будущего движения денег.',
    pain: '«Деньги вложены в сырьё и производство — а платёж от клиента придёт только через месяц.»',
  },
  distribution: {
    eyebrow: 'Управление деньгами в оптовой торговле и дистрибуции',
    headline: 'Прибыль есть. А денег всё равно постоянно не хватает?',
    supporting: 'Связывайте ожидаемые оплаты клиентов, закупки и платежи поставщикам в одной картине.',
    pain: '«Товар уже оплачен поставщику, а клиенты платят по факту продажи.»',
  },
  engineering: {
    eyebrow: 'Финансовая видимость для проектного бизнеса',
    headline: 'Прибыль по проекту есть. А денег на следующий этап хватит?',
    supporting: 'Контролируйте денежные потоки между этапами проектов и оценивайте будущую ликвидность компании.',
    pain: '«Проект оплачивается по этапам, а расходы идут постоянно.»',
  },
  logistics: {
    eyebrow: 'Управление денежными потоками в логистике',
    headline: 'Прибыль есть. А денег всё равно постоянно не хватает?',
    supporting: 'Видите влияние сроков расчётов, переменных затрат и будущих платежей на ликвидность.',
    pain: '«Тариф согласован, но оплата от заказчика приходит с отсрочкой в 30–60 дней.»',
  },
  medical: {
    eyebrow: 'Управление денежными потоками клиники',
    headline: 'Прибыль есть. А денег всё равно постоянно не хватает?',
    supporting: 'Планируйте выплаты, рост команды и другие обязательства с учётом будущих поступлений.',
    pain: '«Оборудование и персонал требуют вложений сейчас, а оплата от пациентов и страховых растянута во времени.»',
  },
  consulting: {
    eyebrow: 'Управление деньгами в проектном сервисном бизнесе',
    headline: 'Прибыль есть. А денег всё равно постоянно не хватает?',
    supporting: 'Планируйте ликвидность при неравномерной проектной выручке, загрузке команды и задержках оплат.',
    pain: '«Загрузка команды есть, а оплата по проекту приходит только по факту сдачи этапа.»',
  },
};

export const INTENT_VARIANTS: Record<string, IntentVariant> = {
  cashgap: { supporting: 'Увидите возможный кассовый разрыв до того, как он станет проблемой.' },
  forecast: { supporting: 'Прогнозируйте движение денег на 13–26 недель вперёд.' },
  excel: { supporting: 'Соберите финансовую картину компании вместо множества разрозненных Excel-файлов.' },
  cfo: {
    supporting: 'Получите CFO-уровень видимости денежных потоков без превращения проекта в ещё один ручной отчёт.',
  },
};

export function resolveIndustryVariant(raw: string | undefined): IndustryVariant | undefined {
  if (!raw) return undefined;
  return INDUSTRY_VARIANTS[raw.toLowerCase()];
}

export function resolveIntentVariant(raw: string | undefined): IntentVariant | undefined {
  if (!raw) return undefined;
  return INTENT_VARIANTS[raw.toLowerCase()];
}
