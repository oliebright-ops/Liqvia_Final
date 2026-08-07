import { Container, Section, SectionHeading } from './primitives';

const INDUSTRIES = [
  { name: 'Строительство', note: 'Проектные платежи, авансы, кассовые разрывы между этапами' },
  { name: 'Производство', note: 'Закупка сырья, сезонность, длинные циклы оплаты' },
  { name: 'Оптовая торговля и дистрибуция', note: 'Товарные кредиты, оборачиваемость, множество контрагентов' },
  { name: 'Инжиниринг и проектный бизнес', note: 'Неравномерное поступление денег по этапам проекта' },
  { name: 'Импорт и экспорт', note: 'Валютные риски, длинная логистическая цепочка платежей' },
  { name: 'Логистика', note: 'Переменные затраты, растянутые циклы расчётов' },
  { name: 'Медицинские и профессиональные услуги', note: 'Рост штата быстрее роста выручки' },
  { name: 'Консалтинг и агентства', note: 'Проектная выручка, неравномерная загрузка' },
];

export function IndustriesSection() {
  return (
    <Section id="industries" tone="slate">
      <Container>
        <SectionHeading center title="Кому подходит Cash Operating System" />
        <p className="mx-auto mt-4 max-w-2xl text-center leading-relaxed text-slate-600">
          Методология особенно полезна компаниям с 20–500 сотрудниками, где движение денег
          сложнее, чем может удержать один файл Excel.
        </p>
        <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
          {INDUSTRIES.map((industry) => (
            <div
              key={industry.name}
              className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              <p className="font-semibold text-slate-900">{industry.name}</p>
              <p className="mt-1 text-sm text-slate-600">{industry.note}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
