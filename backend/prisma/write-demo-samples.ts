import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDemoPackFiles, DEMO_PACK_PROFILES } from '../src/demo/demo-pack-generator';

const SAMPLES_DIR = join(__dirname, '..', '..', 'samples', 'demo-data');
const asOfDate = process.env.DEMO_AS_OF_DATE ?? new Date().toISOString().slice(0, 10);

const FILE_MAP: Array<{ key: keyof ReturnType<typeof buildDemoPackFiles>; file: string }> = [
  { key: 'trial_balance', file: 'trial-balance.csv' },
  { key: 'bank_balances', file: 'bank-balances.csv' },
  { key: 'ar_ageing', file: 'ar-ageing.csv' },
  { key: 'ap_ageing', file: 'ap-ageing.csv' },
  { key: 'weekly_actuals', file: 'weekly-actuals.csv' },
  { key: 'prior_period_budget', file: 'prior-period-budget.csv' },
  { key: 'rolling_budget', file: 'rolling-budget.csv' },
  { key: 'bank_transactions', file: 'bank-transactions.csv' },
];

console.log(`Generating demo packs as of ${asOfDate}`);

for (const profile of DEMO_PACK_PROFILES) {
  const dir = join(SAMPLES_DIR, profile.slug);
  mkdirSync(dir, { recursive: true });
  const files = buildDemoPackFiles(profile, asOfDate);

  for (const { key, file } of FILE_MAP) {
    const path = join(dir, file);
    writeFileSync(path, files[key], 'utf8');
    console.log(`  ${profile.slug}/${file}`);
  }
}

console.log('Done.');
