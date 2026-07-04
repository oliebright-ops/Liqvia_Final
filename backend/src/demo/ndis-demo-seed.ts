import { INestApplication } from '@nestjs/common';
import { AccountPurpose, ObligationCategory, ObligationFrequency, UserRole } from '@prisma/client';
import { NDIS_DEMO_COMPANY_ID } from '@liqvia2/shared';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const COMPANY_NAME = 'Demo — NDIS Care Services';
const CURRENCY = 'AUD';

interface DemoBankAccount {
  key: string;
  name: string;
  accountNumberMasked: string;
  accountPurpose: AccountPurpose;
  balance: number;
}

const BANK_ACCOUNTS: DemoBankAccount[] = [
  { key: 'operating', name: 'CBA Operating Account', accountNumberMasked: '****4410', accountPurpose: 'operating', balance: 82000 },
  { key: 'payroll', name: 'CBA Payroll Account', accountNumberMasked: '****4421', accountPurpose: 'payroll_reserve', balance: 135000 },
  { key: 'amex', name: 'Amex Settlement Account', accountNumberMasked: '****1009', accountPurpose: 'merchant_clearing', balance: 28000 },
  { key: 'paycom', name: 'Pay.com Account', accountNumberMasked: '****7742', accountPurpose: 'merchant_clearing', balance: 19000 },
  { key: 'ndis', name: 'NDIS Funding Account', accountNumberMasked: '****3390', accountPurpose: 'ndis_settlement', balance: 66000 },
  { key: 'tax', name: 'Tax Reserve Account', accountNumberMasked: '****5518', accountPurpose: 'tax_reserve', balance: 47000 },
  { key: 'emergency', name: 'Emergency Savings Account', accountNumberMasked: '****6602', accountPurpose: 'emergency_reserve', balance: 40000 },
];

interface DemoObligation {
  name: string;
  category: ObligationCategory;
  frequency: ObligationFrequency;
  amount: number;
  linkedAccountKey: string;
  dueInDays: number;
}

const OBLIGATIONS: DemoObligation[] = [
  { name: 'Payroll', category: 'payroll', frequency: 'fortnightly', amount: 84200, linkedAccountKey: 'payroll', dueInDays: 4 },
  { name: 'Superannuation', category: 'superannuation', frequency: 'monthly', amount: 18000, linkedAccountKey: 'payroll', dueInDays: 12 },
  { name: 'Rent', category: 'rent', frequency: 'monthly', amount: 7500, linkedAccountKey: 'operating', dueInDays: 6 },
  { name: 'Insurance', category: 'insurance', frequency: 'monthly', amount: 2400, linkedAccountKey: 'operating', dueInDays: 20 },
  { name: 'ATO payment plan', category: 'tax', frequency: 'monthly', amount: 12500, linkedAccountKey: 'tax', dueInDays: 15 },
  { name: 'Software subscriptions', category: 'subscription', frequency: 'monthly', amount: 1200, linkedAccountKey: 'operating', dueInDays: 9 },
  { name: 'Vehicle expenses', category: 'vehicle', frequency: 'weekly', amount: 3000, linkedAccountKey: 'operating', dueInDays: 3 },
];

interface DemoSettlement {
  source: string;
  frequency: ObligationFrequency;
  amount: number;
  destinationAccountKey: string;
  expectedInDays: number;
}

const SETTLEMENTS: DemoSettlement[] = [
  { source: 'NDIS settlement', frequency: 'weekly', amount: 42500, destinationAccountKey: 'ndis', expectedInDays: 2 },
  { source: 'Private client direct debit', frequency: 'weekly', amount: 9200, destinationAccountKey: 'operating', expectedInDays: 3 },
  { source: 'Amex settlement', frequency: 'weekly', amount: 17000, destinationAccountKey: 'amex', expectedInDays: 1 },
  { source: 'CBA merchant settlement', frequency: 'weekly', amount: 12800, destinationAccountKey: 'operating', expectedInDays: 1 },
  { source: 'Pay.com settlement', frequency: 'weekly', amount: 8600, destinationAccountKey: 'paycom', expectedInDays: 2 },
];

function addDaysIso(dateStr: string, days: number): Date {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function isNdisDemoDataReady(prisma: PrismaService): Promise<boolean> {
  const count = await prisma.bankAccount.count({ where: { companyId: NDIS_DEMO_COMPANY_ID } });
  return count > 0;
}

async function resetNdisCompanyData(prisma: PrismaService, companyId: string) {
  await prisma.expectedSettlement.deleteMany({ where: { companyId } });
  await prisma.recurringObligation.deleteMany({ where: { companyId } });
  await prisma.notification.deleteMany({ where: { companyId } });
  await prisma.cashMovement.deleteMany({ where: { companyId } });
  await prisma.bankAccount.deleteMany({ where: { companyId } });
}

export async function seedNdisDemoCompany(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  const asOfDate = new Date().toISOString().slice(0, 10);

  console.log(`[demo-seed] → ${COMPANY_NAME} (cash_driven)`);

  await prisma.company.upsert({
    where: { id: NDIS_DEMO_COMPANY_ID },
    update: {
      name: COMPANY_NAME,
      industry: 'NDIS provider',
      currency: CURRENCY,
      locale: 'en',
      businessMode: 'cash_driven',
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    },
    create: {
      id: NDIS_DEMO_COMPANY_ID,
      name: COMPANY_NAME,
      industry: 'NDIS provider',
      currency: CURRENCY,
      locale: 'en',
      businessMode: 'cash_driven',
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    },
  });

  const demoEmail = `admin@${NDIS_DEMO_COMPANY_ID}.local`;
  const passwordHash = await bcrypt.hash('DemoPass123!', 10);
  const admin = await prisma.userProfile.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      passwordHash,
      name: `${COMPANY_NAME} Admin`,
      companyId: NDIS_DEMO_COMPANY_ID,
      role: UserRole.admin,
    },
  });

  await prisma.userCompanyLink.upsert({
    where: { email_companyId: { email: demoEmail, companyId: NDIS_DEMO_COMPANY_ID } },
    update: { userId: admin.id },
    create: {
      email: demoEmail,
      companyId: NDIS_DEMO_COMPANY_ID,
      userId: admin.id,
      role: UserRole.admin,
    },
  });

  await resetNdisCompanyData(prisma, NDIS_DEMO_COMPANY_ID);

  const accountIdByKey = new Map<string, string>();
  const openingAnchorDate = addDaysIso(asOfDate, -365 * 5);

  for (const acc of BANK_ACCOUNTS) {
    const bankAccount = await prisma.bankAccount.create({
      data: {
        companyId: NDIS_DEMO_COMPANY_ID,
        name: acc.name,
        accountNumberMasked: acc.accountNumberMasked,
        currency: CURRENCY,
        accountPurpose: acc.accountPurpose,
      },
    });
    accountIdByKey.set(acc.key, bankAccount.id);

    await prisma.cashMovement.create({
      data: {
        companyId: NDIS_DEMO_COMPANY_ID,
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
        companyId: NDIS_DEMO_COMPANY_ID,
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
        companyId: NDIS_DEMO_COMPANY_ID,
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

  console.log('[demo-seed]    NDIS Care Services: 7 bank accounts, 7 obligations, 5 settlements');
}
