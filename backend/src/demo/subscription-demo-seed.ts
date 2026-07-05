import { INestApplication } from '@nestjs/common';
import { AccountPurpose, ObligationCategory, ObligationFrequency, UserRole } from '@prisma/client';
import { SUBSCRIPTION_DEMO_COMPANY_ID } from '@liqvia2/shared';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const COMPANY_NAME = 'Demo — Subscription Studio';
const CURRENCY = 'USD';

interface DemoBankAccount {
  key: string;
  name: string;
  accountNumberMasked: string;
  accountPurpose: AccountPurpose;
  balance: number;
}

const BANK_ACCOUNTS: DemoBankAccount[] = [
  { key: 'operating', name: 'Operating Account', accountNumberMasked: '****7710', accountPurpose: 'operating', balance: 54000 },
  { key: 'payroll', name: 'Payroll Reserve Account', accountNumberMasked: '****7721', accountPurpose: 'payroll_reserve', balance: 46000 },
  { key: 'tax', name: 'Tax Reserve Account', accountNumberMasked: '****7733', accountPurpose: 'tax_reserve', balance: 21000 },
  { key: 'savings', name: 'Savings Account', accountNumberMasked: '****7744', accountPurpose: 'savings', balance: 30000 },
];

interface DemoObligation {
  name: string;
  category: ObligationCategory;
  frequency: ObligationFrequency;
  amount: number;
  linkedAccountKey: string;
  dueInDays: number;
}

// A generic recurring-revenue business's fixed costs — no invoices anywhere here,
// every outflow is a predictable, dated commitment rather than a bill to chase.
const OBLIGATIONS: DemoObligation[] = [
  { name: 'Payroll', category: 'payroll', frequency: 'fortnightly', amount: 46000, linkedAccountKey: 'payroll', dueInDays: 5 },
  { name: 'Payroll tax withholding', category: 'payg_withholding', frequency: 'monthly', amount: 9800, linkedAccountKey: 'tax', dueInDays: 14 },
  { name: 'Office rent', category: 'rent', frequency: 'monthly', amount: 6200, linkedAccountKey: 'operating', dueInDays: 3 },
  { name: 'Cloud infrastructure', category: 'subscription', frequency: 'monthly', amount: 8200, linkedAccountKey: 'operating', dueInDays: 10 },
  { name: 'Software tools', category: 'subscription', frequency: 'monthly', amount: 1400, linkedAccountKey: 'operating', dueInDays: 7 },
  { name: 'Business insurance', category: 'insurance', frequency: 'annually', amount: 9600, linkedAccountKey: 'operating', dueInDays: 45 },
];

interface DemoSettlement {
  source: string;
  frequency: ObligationFrequency;
  amount: number;
  destinationAccountKey: string;
  expectedInDays: number;
}

// Recurring revenue instead of invoices — subscription billing batches and contract
// renewals arrive on a schedule, which is exactly what makes this a cash-driven model.
const SETTLEMENTS: DemoSettlement[] = [
  { source: 'Subscription billing (weekly payout)', frequency: 'weekly', amount: 28000, destinationAccountKey: 'operating', expectedInDays: 2 },
  { source: 'Enterprise contract retainer', frequency: 'monthly', amount: 32000, destinationAccountKey: 'operating', expectedInDays: 8 },
  { source: 'Annual plan renewals batch', frequency: 'quarterly', amount: 45000, destinationAccountKey: 'operating', expectedInDays: 30 },
];

function addDaysIso(dateStr: string, days: number): Date {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function isSubscriptionDemoDataReady(prisma: PrismaService): Promise<boolean> {
  const count = await prisma.bankAccount.count({ where: { companyId: SUBSCRIPTION_DEMO_COMPANY_ID } });
  return count > 0;
}

async function resetSubscriptionCompanyData(prisma: PrismaService, companyId: string) {
  await prisma.expectedSettlement.deleteMany({ where: { companyId } });
  await prisma.recurringObligation.deleteMany({ where: { companyId } });
  await prisma.notification.deleteMany({ where: { companyId } });
  await prisma.cashMovement.deleteMany({ where: { companyId } });
  await prisma.bankAccount.deleteMany({ where: { companyId } });
}

export async function seedSubscriptionDemoCompany(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  const asOfDate = new Date().toISOString().slice(0, 10);

  console.log(`[demo-seed] → ${COMPANY_NAME} (cash_driven)`);

  await prisma.company.upsert({
    where: { id: SUBSCRIPTION_DEMO_COMPANY_ID },
    update: {
      name: COMPANY_NAME,
      industry: 'Subscription software',
      currency: CURRENCY,
      locale: 'en',
      businessMode: 'cash_driven',
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    },
    create: {
      id: SUBSCRIPTION_DEMO_COMPANY_ID,
      name: COMPANY_NAME,
      industry: 'Subscription software',
      currency: CURRENCY,
      locale: 'en',
      businessMode: 'cash_driven',
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    },
  });

  const demoEmail = `admin@${SUBSCRIPTION_DEMO_COMPANY_ID}.local`;
  const passwordHash = await bcrypt.hash('DemoPass123!', 10);
  const admin = await prisma.userProfile.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      passwordHash,
      name: `${COMPANY_NAME} Admin`,
      companyId: SUBSCRIPTION_DEMO_COMPANY_ID,
      role: UserRole.admin,
    },
  });

  await prisma.userCompanyLink.upsert({
    where: { email_companyId: { email: demoEmail, companyId: SUBSCRIPTION_DEMO_COMPANY_ID } },
    update: { userId: admin.id },
    create: {
      email: demoEmail,
      companyId: SUBSCRIPTION_DEMO_COMPANY_ID,
      userId: admin.id,
      role: UserRole.admin,
    },
  });

  await resetSubscriptionCompanyData(prisma, SUBSCRIPTION_DEMO_COMPANY_ID);

  const accountIdByKey = new Map<string, string>();
  const openingAnchorDate = addDaysIso(asOfDate, -365 * 5);

  for (const acc of BANK_ACCOUNTS) {
    const bankAccount = await prisma.bankAccount.create({
      data: {
        companyId: SUBSCRIPTION_DEMO_COMPANY_ID,
        name: acc.name,
        accountNumberMasked: acc.accountNumberMasked,
        currency: CURRENCY,
        accountPurpose: acc.accountPurpose,
      },
    });
    accountIdByKey.set(acc.key, bankAccount.id);

    await prisma.cashMovement.create({
      data: {
        companyId: SUBSCRIPTION_DEMO_COMPANY_ID,
        bankAccountId: bankAccount.id,
        movementDate: openingAnchorDate,
        amount: acc.balance,
        isInflow: true,
        description: 'Opening cash balance',
      },
    });
  }

  for (const o of OBLIGATIONS) {
    await prisma.recurringObligation.create({
      data: {
        companyId: SUBSCRIPTION_DEMO_COMPANY_ID,
        name: o.name,
        category: o.category,
        amount: o.amount,
        frequency: o.frequency,
        nextDueDate: addDaysIso(asOfDate, o.dueInDays),
        paymentMethod: 'Direct debit',
        linkedBankAccountId: accountIdByKey.get(o.linkedAccountKey),
        confidence: 'high',
      },
    });
  }

  for (const s of SETTLEMENTS) {
    await prisma.expectedSettlement.create({
      data: {
        companyId: SUBSCRIPTION_DEMO_COMPANY_ID,
        source: s.source,
        amount: s.amount,
        frequency: s.frequency,
        nextExpectedDate: addDaysIso(asOfDate, s.expectedInDays),
        destinationAccountId: accountIdByKey.get(s.destinationAccountKey),
        status: 'expected',
        confidence: 'high',
      },
    });
  }

  console.log('[demo-seed]    Subscription Studio: 4 bank accounts, 6 obligations, 3 settlements');
}
