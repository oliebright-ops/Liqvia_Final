import '../src/load-env';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { UploadTemplateType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UploadImportService } from '../src/uploads/upload-import.service';

interface DemoCompany {
  id: string;
  name: string;
  currency: string;
  locale: string;
  slug: string;
  profile: string;
}

const SAMPLES_DIR = join(__dirname, '..', '..', 'samples', 'demo-data');

const FILES: Array<{ file: string; template: UploadTemplateType }> = [
  { file: 'trial-balance.csv', template: 'trial_balance' },
  { file: 'bank-balances.csv', template: 'bank_balances' },
  { file: 'ar-ageing.csv', template: 'ar_ageing' },
  { file: 'ap-ageing.csv', template: 'ap_ageing' },
  { file: 'budget.csv', template: 'budget' },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const importer = app.get(UploadImportService);

  const manifest = JSON.parse(readFileSync(join(SAMPLES_DIR, 'manifest.json'), 'utf8')) as {
    companies: DemoCompany[];
  };

  for (const company of manifest.companies) {
    console.log(`\n→ Seeding ${company.name} (${company.currency})`);

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

    for (const { file, template } of FILES) {
      const csvContent = readFileSync(join(SAMPLES_DIR, company.slug, file), 'utf8');
      const result = await importer.importCsv({
        templateType: template,
        csvContent,
        fileName: file,
        companyId: company.id,
        companyCurrency: company.currency,
      });
      console.log(`   ${template}: ${result.rowCount} row(s)`);
    }
  }

  console.log('\nDemo seed complete.');
  await app.close();
}

/** Clear transactional data so the seed is idempotent. */
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
  await prisma.budgetLine.deleteMany({ where: { budget: { companyId } } });
  await prisma.budget.deleteMany({ where: { companyId } });
  await prisma.uploadError.deleteMany({ where: { uploadBatch: { companyId } } });
  await prisma.uploadBatch.deleteMany({ where: { companyId } });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
