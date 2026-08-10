import type { Metadata } from 'next';
import {
  CASH_OS_LEAD_FORM_NOTICE_TEXT,
  CONSENT_POLICY_VERSION,
  OPERATOR_STATUS_RU,
} from '@/lib/consent';
import { operatorContactBlock } from '@/lib/legal-publication';
import { PRIVACY_POLICY_TITLE_RU } from '@/lib/legal-text';
import { LegalBackLink, LegalSection, OperatorIdentity } from '@/components/legal/legal-chrome';

/**
 * Interim privacy notice for the public Russian landing page.
 *
 * Scope is deliberately narrow: this page describes the processing that the
 * public site `liqvia.info` actually performs today — a lead form and a Metrica
 * counter — and nothing else. The authenticated product runs on separate
 * infrastructure, is not reachable from this host, and receives none of this
 * data, so describing it here would only add statements a reader cannot check
 * against anything they can see.
 *
 * Every statement below is one that has been verified against the running
 * system or against the source that produces it. Facts that are genuinely not
 * established — the physical region of database backups, Metrica console
 * retention settings, the terms of any processor outside this flow — are not
 * asserted and are not placeholdered either: they are simply outside what this
 * notice claims. A placeholder on a public page is a published statement that
 * the operator does not know what it does with personal data.
 *
 * This page therefore does NOT consult `isLegalPublicationReady()`. That gate
 * guards documents that assert the facts it tracks; this one asserts none of
 * them. `/consent` still uses it, and it stays in place unchanged.
 *
 * The wording is amended in place under `CONSENT_POLICY_VERSION` 2026-08-10.1
 * rather than under a new version. That is a deliberate exception, not the rule,
 * and the reason is mechanical: `policyVersion` on every entry in
 * `CONSENT_TEXT_ARCHIVE` is the constant itself, so bumping it would rewrite the
 * policy version of wordings already registered — the precise thing the
 * append-only rule exists to prevent. Four `ConsentRecord` rows in the RU
 * database do carry `policyVersion = 2026-08-10.1`; all four are `checkbox`
 * records written during the 2026-08-09 migration and restore probes, none from
 * a visitor acting on this page. The superseded text is preserved in Git at
 * `4d917c3`. See `docs/legal/PRIVACY_POLICY_REVIEW_NOTES.md`.
 *
 * From the first real lead onwards this exception is spent: a material change
 * here needs a new policy version, and the archive must be restructured so a
 * bump cannot rewrite past entries.
 */

export const metadata: Metadata = {
  title: `${PRIVACY_POLICY_TITLE_RU} · Privacy Policy — Liqvia`,
  description:
    'Как обрабатываются персональные данные, отправленные через форму на сайте liqvia.info.',
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  const contact = operatorContactBlock();

  return (
    <main className="min-h-screen bg-white py-16 text-slate-800">
      <div className="mx-auto w-full max-w-3xl px-6">
        <LegalBackLink />

        <h1 className="mt-6 text-3xl font-semibold text-slate-900">{PRIVACY_POLICY_TITLE_RU}</h1>
        <p className="mt-1 text-lg text-slate-600">Privacy Policy</p>
        <p className="mt-4 text-sm text-slate-500">
          Версия / Version: <code>{CONSENT_POLICY_VERSION}</code>
        </p>

        <p className="mt-6 text-sm leading-relaxed text-slate-700">
          Настоящий документ описывает обработку персональных данных на публичном сайте{' '}
          <code>liqvia.info</code>: данные, которые вы отправляете через форму заявки, и данные,
          которые собирает веб-аналитика этого сайта. Иных персональных данных сайт не собирает.
        </p>

        <LegalSection titleRu="1. Кто обрабатывает данные" titleEn="1. Who processes your data">
          <OperatorIdentity />
          <p>
            Оператор — {OPERATOR_STATUS_RU}. Обработка персональных данных, собираемых через сайт{' '}
            <code>liqvia.info</code>, осуществляется указанным оператором.
          </p>
          {contact ? (
            <ul>
              <li>
                Адрес электронной почты для обращений по вопросам обработки персональных данных:{' '}
                <code>{contact.email}</code>
              </li>
              {contact.address ? (
                <li>Почтовый адрес для юридически значимых обращений: {contact.address}</li>
              ) : null}
            </ul>
          ) : null}
        </LegalSection>

        <LegalSection titleRu="2. Какие данные собираются" titleEn="2. What is collected">
          <p>Только то, что вы сами вводите в форму заявки на сайте.</p>
          <ul>
            <li>
              <strong>Обязательные поля:</strong> имя, рабочий адрес электронной почты, название
              компании.
            </li>
            <li>
              <strong>Необязательные поля:</strong> телефон, должность, количество сотрудников,
              отрасль, свободный комментарий.
            </li>
          </ul>
          <p>
            Свободный комментарий — поле произвольного текста. Пожалуйста, не указывайте в нём
            сведения, которые не нужны для рассмотрения вашего обращения.
          </p>
          <p>
            Специальные категории персональных данных и биометрические персональные данные не
            запрашиваются и не обрабатываются. Данные веб-аналитики описаны отдельно в разделе 7.
          </p>
        </LegalSection>

        <LegalSection titleRu="3. Зачем они собираются" titleEn="3. Why it is collected">
          <p>
            Единственная цель — рассмотреть ваше обращение, связаться с вами и, если вы этого
            хотите, организовать и провести консультацию. Отправка формы означает, что вы
            обращаетесь к оператору по своей инициативе, и обработка ведётся для ответа на это
            обращение.
          </p>
          <p>
            Данные не продаются, не передаются третьим лицам для их собственных маркетинговых целей
            и не используются для рассылок: отдельного согласия на информационные и рекламные
            сообщения сайт не запрашивает, и такие сообщения не отправляются.
          </p>
        </LegalSection>

        <LegalSection
          titleRu="4. Как выражается согласие"
          titleEn="4. How your agreement is expressed"
        >
          <p>
            Рядом с кнопкой отправки формы размещено уведомление следующего содержания:
          </p>
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 italic">
            «{CASH_OS_LEAD_FORM_NOTICE_TEXT}»
          </p>
          <p>
            Отдельная отметка (галочка) не проставляется, и отдельный документ о согласии вы не
            подписываете. Согласие выражается самим действием — нажатием кнопки отправки формы
            при показанном уведомлении. Если вы не согласны с обработкой данных на этих условиях,
            не отправляйте форму; связаться с оператором можно по адресу электронной почты,
            указанному в разделе 1.
          </p>
          <p>
            Вместе с заявкой сохраняется техническая запись о том, какое именно уведомление вам
            было показано: точный текст уведомления и его контрольная сумма, версия уведомления,
            версия настоящего документа, язык, момент отправки по UTC и способ —{' '}
            <code>passive-notice</code>, то есть «пассивное уведомление», а не проставленная
            отметка. IP-адрес, сведения об устройстве и о браузере в эту запись не включаются.
          </p>
        </LegalSection>

        <LegalSection titleRu="5. Где данные хранятся" titleEn="5. Where the data is stored">
          <p>
            Сайт <code>liqvia.info</code> и база данных заявок размещены в инфраструктуре Yandex
            Cloud на территории Российской Федерации, регион <code>ru-central1</code>, зона{' '}
            <code>ru-central1-a</code>. Веб-сервис и база данных находятся в одной и той же
            российской зоне.
          </p>
          <p>
            Заявка, отправленная через форму на <code>liqvia.info</code>, записывается
            исключительно в эту российскую базу данных. Если база данных недоступна, заявка не
            сохраняется вовсе и вам предлагается отправить её позже — она никогда не
            перенаправляется в инфраструктуру за пределами Российской Федерации.
          </p>
          <p>
            Прямой доступ к базе данных из сети Интернет отключён: обращаться к ней может только
            само приложение внутри закрытой сети.
          </p>
        </LegalSection>

        <LegalSection titleRu="6. Кому передаются данные" titleEn="6. Who receives the data">
          <p>
            Заявка, отправленная через форму, не передаётся никому, кроме оператора. В связи с ней:
          </p>
          <ul>
            <li>письма не отправляются — ни вам, ни оператору;</li>
            <li>отдельная CRM-система не используется;</li>
            <li>данные не передаются во внешние сервисы искусственного интеллекта;</li>
            <li>интеграции с иными внешними системами отсутствуют.</li>
          </ul>
          <p>
            К обработке привлечён только поставщик инфраструктуры — Yandex Cloud (Российская
            Федерация), который размещает сайт и базу данных. Веб-аналитика описана в разделе 7.
          </p>
        </LegalSection>

        <LegalSection titleRu="7. Веб-аналитика" titleEn="7. Web analytics">
          <p>
            На сайте работает Яндекс.Метрика (счётчик <code>111417446</code>). Она собирает
            IP-адрес, файлы cookie, сведения об устройстве и о поведении на странице. Обработка
            этих данных осуществляется Яндексом в соответствии с условиями Яндекс.Метрики.
          </p>
          <p>
            Запись сессий (Вебвизор) на счётчике не ведётся: проверено 10 августа 2026 года
            непосредственно на работающем сайте — модуль записи не загружается, и после ввода
            текста в поля формы обращения к серверам записи не отправляются. Поля формы
            дополнительно помечены техническими классами, скрывающими их содержимое от записи, а
            цели (конверсии) передают только фиксированное название события и не содержат значений
            полей. Значения, которые вы вводите в форму, в веб-аналитику не попадают.
          </p>
          <p>
            Отказаться от сбора этих данных можно средствами браузера — запретив файлы cookie для
            этого сайта или удалив их.
          </p>
        </LegalSection>

        <LegalSection titleRu="8. Сколько данные хранятся" titleEn="8. Retention">
          <p>
            Персональные данные, указанные в форме, хранятся не более{' '}
            <strong>одного месяца</strong> с момента получения заявки. Они удаляются раньше этого
            срока, если цель обработки достигнута, если вы отозвали согласие или потребовали
            прекращения обработки. Один месяц — предельный срок, а не гарантированный срок
            хранения.
          </p>
          <p>
            Техническая запись об уведомлении (раздел 4) хранится отдельно от самой заявки и не
            удаляется вместе с ней: она подтверждает, при каком тексте уведомления была отправлена
            заявка. Такая запись не содержит вашего имени, адреса электронной почты или телефона.
          </p>
          <p>
            Если обращение приводит к заключению договора, дальнейшее хранение осуществляется на
            ином правовом основании и в сроки, установленные для соответствующих отношений.
          </p>
        </LegalSection>

        <LegalSection titleRu="9. Меры безопасности" titleEn="9. Security measures">
          <ul>
            <li>передача данных между вашим браузером и сайтом только по HTTPS;</li>
            <li>база данных не доступна из сети Интернет;</li>
            <li>
              адреса электронной почты маскируются в технических журналах приложения; содержимое
              заявок в журналы не записывается;
            </li>
            <li>
              заголовки безопасности сайта: политика безопасности контента, запрет фреймов, запрет
              угадывания типов содержимого, ограничение реферера;
            </li>
            <li>ограничение частоты отправки формы для защиты от автоматических рассылок.</li>
          </ul>
        </LegalSection>

        <LegalSection
          titleRu="10. Ваши права и обращения"
          titleEn="10. Your rights and how to exercise them"
        >
          <p>Вы вправе:</p>
          <ul>
            <li>получить подтверждение факта обработки и сведения о ней;</li>
            <li>получить доступ к своим данным;</li>
            <li>требовать уточнения неточных или неполных данных;</li>
            <li>требовать блокирования или удаления данных;</li>
            <li>отозвать согласие;</li>
            <li>обжаловать действия оператора в уполномоченном органе или в суде.</li>
          </ul>
          {contact ? (
            <p>
              Обращения направляйте на <code>{contact.email}</code>
              {contact.address ? <> либо по адресу: {contact.address}</> : null}. Ответ
              предоставляется в сроки, установленные применимым законодательством.
            </p>
          ) : null}
        </LegalSection>

        <LegalSection titleRu="11. Изменения документа" titleEn="11. Changes to this notice">
          <p>
            Актуальная версия документа всегда доступна на этой странице. Версия указана вверху; при
            изменении текста уведомления, показываемого в форме, сохранённые ранее записи
            продолжают ссылаться на ту версию, которая была показана пользователю.
          </p>
        </LegalSection>
      </div>
    </main>
  );
}
