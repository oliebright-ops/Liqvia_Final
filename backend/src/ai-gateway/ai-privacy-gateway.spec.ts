import { AiPayloadRejectedError, AiPrivacyGatewayService } from './ai-privacy-gateway.service';
import type { OpenAiProvider, ProviderRequest } from './providers/openai.provider';
import { buildAiPayload } from './decision-context';
import type { AiPayload } from './payload-schema';
import { makeContext } from './test-fixtures';

/**
 * The privacy boundary tests.
 *
 * Two halves, and both matter:
 *  - negative: prohibited data is rejected or removed before it can be sent;
 *  - positive: the approved aggregated metrics genuinely do reach the provider,
 *    so a future "make it safer" change cannot quietly gut the AI's usefulness
 *    without failing a test.
 */

/** Captures what would have been sent, without a network call. */
function spyProvider() {
  const sent: ProviderRequest[] = [];
  const provider = {
    isConfigured: () => true,
    model: () => 'gpt-4o-mini',
    complete: (request: ProviderRequest) => {
      sent.push(request);
      return Promise.resolve({ text: 'ok', model: 'gpt-4o-mini' });
    },
  } as unknown as OpenAiProvider;
  return { provider, sent, body: () => sent.map((r) => JSON.stringify(r)).join('\n') };
}

function gatewayWith(provider: OpenAiProvider) {
  return new AiPrivacyGatewayService(provider);
}

describe('AiPrivacyGateway — prohibited data never reaches the provider', () => {
  const identifying = {
    customerName: 'Ivan Petrov',
    supplierName: 'ООО Ромашка Логистика',
    employeeName: 'Sarah Whitfield',
    email: 'ivan.petrov@romashka.ru',
    phone: '+7 916 555 21 43',
    bankAccount: '40702810900000012345',
    iban: 'GB29NWBK60161331926819',
    narrative: 'CARD PAYMENT TO IVAN PETROV REF 40702810900000012345',
    companyName: 'Acme Trading Ltd',
  };

  async function runWithFullContext() {
    const { provider, sent, body } = spyProvider();
    await gatewayWith(provider).run({
      companyId: 'company-1',
      context: makeContext({
        companyName: identifying.companyName,
        receivablesDetail: [
          {
            counterparty: identifying.customerName,
            amount: 2_400_000,
            invoiceDate: '2026-01-02',
            dueDate: '2026-02-01',
            daysOverdue: 12,
            status: 'overdue',
          },
        ],
        payablesDetail: [
          {
            counterparty: identifying.supplierName,
            amount: 310_000,
            billDate: '2026-01-10',
            dueDate: '2026-02-14',
            daysOverdue: 0,
            status: 'open',
            supplierPriority: 'critical',
          },
        ],
        cashTransactions: [
          {
            id: 't1',
            date: '2026-01-15',
            description: identifying.narrative,
            category: 'supplier',
            amount: -12_000,
            direction: 'OUT',
            accountName: 'Acme Operating Account',
          },
        ],
        recurringObligations: [
          {
            name: `Payroll — ${identifying.employeeName}`,
            category: 'payroll',
            amount: 90_000,
            frequency: 'monthly',
            dueDate: '2026-02-05',
            paymentMethod: 'transfer',
            linkedBankAccount: 'Acme Operating Account',
            confidence: 'high',
          },
        ],
        alerts: [
          { type: 'ar_overdue', severity: 'warning', message: `${identifying.customerName} is 12 days late` },
        ],
      }),
      feature: 'test',
      systemPrompt: 'You are a CFO assistant.',
      question: `Should I chase ${identifying.customerName} at ${identifying.email} or call ${identifying.phone}? Account ${identifying.bankAccount}.`,
    });
    return { sent, body: body() };
  }

  it.each([
    ['customer name', identifying.customerName],
    ['supplier name', identifying.supplierName],
    ['employee name', identifying.employeeName],
    ['email address', identifying.email],
    ['phone number', '9165552143'],
    ['bank account number', identifying.bankAccount],
    ['raw bank narrative', 'CARD PAYMENT TO'],
    ['company name', identifying.companyName],
  ])('strips %s from the outbound request', async (_label, secret) => {
    const { body } = await runWithFullContext();
    expect(body).not.toContain(secret);
  });

  it('strips the phone number even when the user typed it with separators', async () => {
    const { body } = await runWithFullContext();
    expect(body).not.toContain('916 555 21 43');
    expect(body).not.toContain('+7 916');
  });

  it('never sends an alert message assembled from customer data', async () => {
    const { body } = await runWithFullContext();
    expect(body).not.toContain('is 12 days late');
  });

  it('replaces the customer name in the question with that customer\'s own code', async () => {
    const { sent } = await runWithFullContext();
    const userTurn = sent[0]!.messages.find((m) => m.content.includes('redactedText'));
    expect(userTurn?.content).toMatch(/CUSTOMER_C\d{3}/);
  });

  it('rejects a payload carrying an unknown field rather than silently dropping it', () => {
    const gateway = gatewayWith(spyProvider().provider);
    const { payload } = buildAiPayload({ companyId: 'c', context: makeContext() });
    const tampered = { ...payload, customerName: 'Ivan Petrov' };

    expect(() => gateway.validate(tampered, 'test')).toThrow(AiPayloadRejectedError);
  });

  it.each([
    ['raw uploaded rows', { rows: [['2026-01-01', 'Ivan Petrov', '1000']] }],
    ['raw PDF text', { documentText: 'STATEMENT OF ACCOUNT ...' }],
    ['csv content', { canonicalCsv: 'date,description,amount' }],
    ['company identifier', { companyId: 'company-1' }],
    ['user identifier', { userId: 'user-9' }],
    ['verbatim question', { lastUserMessage: 'can I pay Ivan?' }],
    ['contact detail', { email: 'a@b.com' }],
  ])('rejects a payload containing %s', (_label, extra) => {
    const gateway = gatewayWith(spyProvider().provider);
    const { payload } = buildAiPayload({ companyId: 'c', context: makeContext() });

    expect(() => gateway.validate({ ...payload, ...extra }, 'test')).toThrow(
      AiPayloadRejectedError,
    );
  });

  it('rejects a counterparty code that is actually a name', () => {
    const gateway = gatewayWith(spyProvider().provider);
    const { payload } = buildAiPayload({
      companyId: 'c',
      context: makeContext({
        receivablesDetail: [
          {
            counterparty: 'Ivan Petrov',
            amount: 100,
            invoiceDate: '2026-01-01',
            dueDate: '2026-02-01',
            daysOverdue: 0,
            status: 'open',
          },
        ],
      }),
    });
    const tampered: AiPayload = {
      ...payload,
      receivables: {
        ...payload.receivables,
        items: [{ ...payload.receivables.items[0]!, counterpartyCode: 'Ivan Petrov' }],
      },
    };

    expect(() => gateway.validate(tampered, 'test')).toThrow(AiPayloadRejectedError);
  });

  it('does not send the rejected values to the logs either', () => {
    const gateway = gatewayWith(spyProvider().provider);
    const { payload } = buildAiPayload({ companyId: 'c', context: makeContext() });
    try {
      gateway.validate({ ...payload, customerName: 'Ivan Petrov' }, 'test');
      fail('expected rejection');
    } catch (err) {
      const violations = (err as AiPayloadRejectedError).violations.join(' ');
      expect(violations).not.toContain('Ivan Petrov');
    }
  });
});

describe('AiPrivacyGateway — approved financial metrics do reach the provider', () => {
  async function sendRealisticContext() {
    const { provider, sent } = spyProvider();
    await gatewayWith(provider).run({
      companyId: 'company-1',
      context: makeContext({
        currency: 'RUB',
        currentCash: 8_000_000,
        week13ClosingCash: 2_150_000,
        runwayWeeks: 9.4,
        weeklyBurn: 620_000,
        liquidityStatus: 'high_risk',
        overdueReceivables: 2_400_000,
        apOverdue: 180_000,
        forecastWeeks: [
          { weekStart: '2026-02-02', weekIndex: 1, openingCash: 8_000_000, inflows: 1_200_000, outflows: 1_820_000, closingCash: 7_380_000 },
          { weekStart: '2026-02-09', weekIndex: 2, openingCash: 7_380_000, inflows: 900_000, outflows: 1_600_000, closingCash: 6_680_000 },
        ],
        receivablesDetail: [
          { counterparty: 'Ivan Petrov', amount: 2_400_000, invoiceDate: '2026-01-02', dueDate: '2026-02-01', daysOverdue: 12, status: 'overdue' },
          { counterparty: 'Beta LLC', amount: 400_000, invoiceDate: '2026-01-20', dueDate: '2026-03-01', daysOverdue: 0, status: 'open' },
        ],
        payablesDetail: [
          { counterparty: 'Gamma Supply', amount: 900_000, billDate: '2026-01-05', dueDate: '2026-02-20', daysOverdue: 0, status: 'open', supplierPriority: 'critical' },
        ],
        recurringObligations: [
          { name: 'Payroll', category: 'payroll', amount: 1_500_000, frequency: 'monthly', dueDate: '2026-02-05', paymentMethod: null, linkedBankAccount: null, confidence: 'high' },
          { name: 'VAT', category: 'tax', amount: 300_000, frequency: 'quarterly', dueDate: '2026-03-25', paymentMethod: null, linkedBankAccount: null, confidence: 'medium' },
        ],
      }),
      feature: 'test',
      systemPrompt: 'You are a CFO assistant.',
    });
    const userTurn = sent[0]!.messages.find((m) => m.role === 'user')!;
    return JSON.parse(userTurn.content.slice(userTurn.content.indexOf('{'))) as AiPayload;
  }

  it('sends currency and opening cash', async () => {
    const payload = await sendRealisticContext();
    expect(payload.meta.currency).toBe('RUB');
    expect(payload.liquidity.openingCash).toBe(8_000_000);
  });

  it('sends weekly aggregated inflows, outflows and closing cash', async () => {
    const payload = await sendRealisticContext();
    expect(payload.weeks).toHaveLength(2);
    expect(payload.weeks[0]).toMatchObject({
      weekIndex: 1,
      inflows: 1_200_000,
      outflows: 1_820_000,
      closingCash: 7_380_000,
    });
  });

  it('sends receivables totals, overdue totals and per-item structure', async () => {
    const payload = await sendRealisticContext();
    expect(payload.receivables.total).toBe(2_800_000);
    expect(payload.receivables.overdueTotal).toBe(2_400_000);
    expect(payload.receivables.items).toHaveLength(2);
  });

  it('sends payables totals and total payroll and tax obligations', async () => {
    const payload = await sendRealisticContext();
    expect(payload.payables.total).toBe(900_000);
    const payroll = payload.obligations.find((o) => o.category === 'payroll');
    const tax = payload.obligations.find((o) => o.category === 'tax');
    expect(payroll?.amount).toBe(1_500_000);
    expect(tax?.amount).toBe(300_000);
  });

  it('sends cash runway, weekly burn and liquidity status', async () => {
    const payload = await sendRealisticContext();
    expect(payload.liquidity.runwayWeeks).toBe(9.4);
    expect(payload.liquidity.weeklyBurn).toBe(620_000);
    expect(payload.liquidity.liquidityStatus).toBe('high_risk');
  });

  it('sends forecast confidence signals for obligations', async () => {
    const payload = await sendRealisticContext();
    expect(payload.obligations.map((o) => o.confidence)).toEqual(
      expect.arrayContaining(['high', 'medium']),
    );
  });

  it('sends scenario assumptions when a scenario was modelled', async () => {
    const { provider, sent } = spyProvider();
    await gatewayWith(provider).run({
      companyId: 'company-1',
      context: makeContext(),
      feature: 'decision_centre',
      systemPrompt: 'x',
      scenario: {
        baseline: { week13ClosingCash: 100_000, runwayWeeks: 12 },
        scenario: { week13ClosingCash: 40_000, runwayWeeks: 6 },
        delta: { week13ClosingCash: -60_000, runwayWeeks: -6 },
      },
    });
    const userTurn = sent[0]!.messages.find((m) => m.role === 'user')!;
    const payload = JSON.parse(userTurn.content.slice(userTurn.content.indexOf('{'))) as AiPayload;
    expect(payload.scenario).toMatchObject({
      baselineWeek13ClosingCash: 100_000,
      scenarioWeek13ClosingCash: 40_000,
      deltaRunwayWeeks: -6,
    });
  });
});
