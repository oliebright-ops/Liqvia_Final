import { INestApplication } from '@nestjs/common';
import { ObligationFrequency } from '@prisma/client';
import { MIXED_DEMO_COMPANY_ID } from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';

const OPERATING_ACCOUNT_NAME = 'Operating Account';

interface MixedObligation {
  name: string;
  category: 'rent' | 'subscription' | 'tax';
  frequency: ObligationFrequency;
  amount: number;
  dueInDays: number;
}

// Layered on top of the CSV-imported AR/AP invoices for this company — these are the
// predictable, dated commitments that make the cash model "mixed" rather than purely
// invoice-driven. Payroll itself stays as the once-off AP bill from the CSV pack so it
// isn't double-counted between the historical actuals and the forward-looking obligations.
const OBLIGATIONS: MixedObligation[] = [
  { name: 'Office rent', category: 'rent', frequency: 'monthly', amount: 5400, dueInDays: 4 },
  { name: 'Creative software suite', category: 'subscription', frequency: 'monthly', amount: 3200, dueInDays: 11 },
  { name: 'Quarterly tax installment', category: 'tax', frequency: 'quarterly', amount: 14500, dueInDays: 22 },
];

interface MixedSettlement {
  source: string;
  frequency: ObligationFrequency;
  amount: number;
  expectedInDays: number;
}

// The predictable half of revenue — ongoing retainer contracts that land on a schedule,
// separate from the one-off project invoices tracked in AR ageing.
const SETTLEMENTS: MixedSettlement[] = [
  { source: 'Retainer client — Monthly support contract', frequency: 'monthly', amount: 18000, expectedInDays: 9 },
  { source: 'Retainer client — Ongoing brand management', frequency: 'monthly', amount: 11000, expectedInDays: 16 },
];

function addDaysIso(dateStr: string, days: number): Date {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function isMixedDemoDataReady(prisma: PrismaService): Promise<boolean> {
  const count = await prisma.recurringObligation.count({ where: { companyId: MIXED_DEMO_COMPANY_ID } });
  return count > 0;
}

/**
 * Runs after seedDemoCompanies' CSV-import loop has already created the
 * demo-creative-agency company and its bank accounts (from bank-balances.csv) —
 * this only adds the recurring layer and flips businessMode to 'mixed'.
 */
export async function seedMixedDemoCompany(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  const asOfDate = new Date().toISOString().slice(0, 10);

  const company = await prisma.company.findUnique({ where: { id: MIXED_DEMO_COMPANY_ID } });
  if (!company) {
    throw new Error(
      `${MIXED_DEMO_COMPANY_ID} not found — seedMixedDemoCompany must run after the CSV demo-pack loop.`,
    );
  }

  console.log(`[demo-seed] → ${company.name} (mixed)`);

  await prisma.company.update({
    where: { id: MIXED_DEMO_COMPANY_ID },
    data: { businessMode: 'mixed' },
  });

  const operatingAccount = await prisma.bankAccount.findFirst({
    where: { companyId: MIXED_DEMO_COMPANY_ID, name: OPERATING_ACCOUNT_NAME },
  });

  await prisma.expectedSettlement.deleteMany({ where: { companyId: MIXED_DEMO_COMPANY_ID } });
  await prisma.recurringObligation.deleteMany({ where: { companyId: MIXED_DEMO_COMPANY_ID } });

  for (const o of OBLIGATIONS) {
    await prisma.recurringObligation.create({
      data: {
        companyId: MIXED_DEMO_COMPANY_ID,
        name: o.name,
        category: o.category,
        amount: o.amount,
        frequency: o.frequency,
        nextDueDate: addDaysIso(asOfDate, o.dueInDays),
        paymentMethod: 'Direct debit',
        linkedBankAccountId: operatingAccount?.id,
        confidence: 'high',
      },
    });
  }

  for (const s of SETTLEMENTS) {
    await prisma.expectedSettlement.create({
      data: {
        companyId: MIXED_DEMO_COMPANY_ID,
        source: s.source,
        amount: s.amount,
        frequency: s.frequency,
        nextExpectedDate: addDaysIso(asOfDate, s.expectedInDays),
        destinationAccountId: operatingAccount?.id,
        status: 'expected',
        confidence: 'high',
      },
    });
  }

  console.log('[demo-seed]    Creative Agency Co: businessMode=mixed, 3 obligations, 2 settlements');
}
