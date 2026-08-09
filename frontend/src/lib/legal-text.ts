/**
 * Fixed legal wording that must appear verbatim on the site.
 *
 * Kept as constants rather than inline JSX so the exact sentences can be
 * asserted by tests and reused without being retyped — a paraphrased disclaimer
 * is not the disclaimer that was approved.
 */

/**
 * Informational-and-legal disclaimer. Rendered as its own titled section of the
 * privacy policy («Информационно-правовая оговорка») and summarised in the
 * landing footer.
 */
export const SITE_DISCLAIMER_RU =
  'Информация и материалы, размещённые на Сайте, носят исключительно ' +
  'информационно-справочный характер. Они не являются публичной офертой, если прямо не ' +
  'указано иное, и не образуют бухгалтерскую, налоговую, юридическую, инвестиционную или ' +
  'иную профессиональную консультацию. Состав услуг, сроки, стоимость, ожидаемые результаты ' +
  'и иные условия сотрудничества определяются индивидуально по результатам консультации и ' +
  'закрепляются в отдельном письменном договоре. Материалы Сайта не гарантируют достижение ' +
  'конкретного финансового, коммерческого или иного результата. До принятия решений ' +
  'пользователю рекомендуется получить консультацию соответствующего квалифицированного ' +
  'специалиста.';

/** Title of the disclaimer section. */
export const SITE_DISCLAIMER_TITLE_RU = 'Информационно-правовая оговорка';

/** Public title of the privacy policy, as referenced by the consent wording. */
export const PRIVACY_POLICY_TITLE_RU = 'Политика обработки персональных данных';

/** Public title of the standalone consent document. */
export const CONSENT_DOCUMENT_TITLE_RU = 'Согласие на обработку персональных данных';
