import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UploadImportService } from '../uploads/upload-import.service';
import { buildDemoPackFiles, DEMO_PACK_PROFILES } from './demo-pack-generator';
import { isNdisDemoDataReady, seedNdisDemoCompany } from './ndis-demo-seed';

interface DemoCompany {
  id: string;
  name: string;
  currency: string;
  locale: string;
  slug: string;
  profile: string;
}

const FILES: Array<{ file: string; template: keyof ReturnType<typeof buildDemoPackFiles> }> = [
  { file: 'trial-balance.csv', template: 'trial_balance' },
  { file: 'bank-balances.csv', template: 'bank_balances' },
  { file: 'ar-ageing.csv', template: 'ar_ageing' },
  { file: 'ap-ageing.csv', template: 'ap_ageing' },
  { file: 'weekly-actuals.csv', template: 'weekly_actuals' },
  { file: 'prior-period-budget.csv', template: 'prior_period_budget' },
  { file: 'rolling-budget.csv', template: 'rolling_budget' },
  { file: 'bank-transactions.csv', template: 'bank_transactions' },
];

function samplesDir(): string {
  return join(__dirname, '..', '..', '..', 'samples', 'demo-data');
}

export async function isDemoDataReady(prisma: PrismaService): Promise<boolean> {
  const count = await prisma.weeklyActual.count({
    where: { companyId: DEFAULT_DEMO_COMPANY_ID },
  });
  return count > 0;
}

export async function seedDemoCompanies(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  const importer = app.get(UploadImportService);
  const manifest = JSON.parse(readFileSync(join(samplesDir(), 'manifest.json'), 'utf8')) as {
    companies: DemoCompany[];
  };

  console.log('[demo-seed] Seeding demo companies…');

  for (const company of manifest.companies) {
    console.log(`[demo-seed] → ${company.name} (${company.currency})`);

    await prisma.company.upsert({
      where: { id: company.id },
      update: {
        name: company.name,
        currency: company.currency,
        locale: company.locale,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
      },
      create: {
        id: company.id,
        name: company.name,
        currency: company.currency,
        locale: company.locale,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
      },
    });

    const demoEmail = `admin@${company.slug}.local`;
    const passwordHash = await bcrypt.hash('DemoPass123!', 10);
    const admin = await prisma.userProfile.upsert({
      where: { email: demoEmail },
      update: {},
      create: {
        email: demoEmail,
        passwordHash,
        name: `${company.name} Admin`,
        companyId: company.id,
        role: UserRole.admin,
      },
    });

    await prisma.userCompanyLink.upsert({
      where: { email_companyId: { email: demoEmail, companyId: company.id } },
      update: { userId: admin.id },
      create: {
        email: demoEmail,
        companyId: company.id,
        userId: admin.id,
        role: UserRole.admin,
      },
    });

    await resetCompanyData(prisma, company.id);

    const profile = DEMO_PACK_PROFILES.find((p) => p.slug === company.slug);
    if (!profile) {
      throw new Error(`No demo pack profile for slug: ${company.slug}`);
    }
    const pack = buildDemoPackFiles(profile);

    for (const { file, template } of FILES) {
      const csvContent = pack[template];
      const result = await importer.importCsv({
        templateType: template,
        csvContent,
        fileName: file,
        companyId: company.id,
        companyCurrency: company.currency,
      });
      console.log(`[demo-seed]    ${template}: ${result.rowCount} row(s)`);
    }
  }

  await seedNdisDemoCompany(app);

  console.log('[demo-seed] Demo seed complete.');
}

export async function runDemoSeedOnStartup(app: INestApplication): Promise<void> {
  if (process.env.SKIP_DEMO_SEED === 'true' || !process.env.DATABASE_URL) {
    return;
  }

  const prisma = app.get(PrismaService);
  const force = process.env.SEED_DEMO_ON_STARTUP === 'true';
  const ready = (await isDemoDataReady(prisma)) && (await isNdisDemoDataReady(prisma));

  if (!force && ready) {
    return;
  }

  await seedDemoCompanies(app);
}

async function resetCompanyData(prisma: PrismaService, companyId: string) {
  await prisma.scenarioLine.deleteMany({ where: { scenario: { companyId } } });
  await prisma.scenario.deleteMany({ where: { companyId } });
  await prisma.forecastLine.deleteMany({ where: { cashForecast: { companyId } } });
  await prisma.cashForecast.deleteMany({ where: { companyId } });
  await prisma.alert.deleteMany({ where: { companyId } });
  await prisma.aiInsight.deleteMany({ where: { companyId } });
  await prisma.receivable.deleteMany({ where: { companyId } });
  await prisma.payable.deleteMany({ where: { companyId } });
  await prisma.cashMovement.deleteMany({ where: { companyId } });
  await prisma.bankAccount.deleteMany({ where: { companyId } });
  await prisma.journalLine.deleteMany({ where: { journalEntry: { companyId } } });
  await prisma.journalEntry.deleteMany({ where: { companyId } });
  await prisma.weeklyActual.deleteMany({ where: { companyId } });
  await prisma.budgetLine.deleteMany({ where: { budget: { companyId } } });
  await prisma.budget.deleteMany({ where: { companyId } });
  await prisma.uploadError.deleteMany({ where: { uploadBatch: { companyId } } });
  await prisma.uploadBatch.deleteMany({ where: { companyId } });
}
