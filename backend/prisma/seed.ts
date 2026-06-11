import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('DemoPass123!', 10);

  const company = await prisma.company.upsert({
    where: { id: 'demo-consulting' },
    update: {},
    create: {
      id: 'demo-consulting',
      name: 'Demo Consulting Ltd',
      currency: 'USD',
      locale: 'en',
    },
  });

  const admin = await prisma.userProfile.upsert({
    where: { email: 'admin@demo.local' },
    update: {},
    create: {
      email: 'admin@demo.local',
      passwordHash,
      name: 'Demo Admin',
      companyId: company.id,
      role: UserRole.admin,
    },
  });

  await prisma.userCompanyLink.upsert({
    where: {
      email_companyId: { email: admin.email, companyId: company.id },
    },
    update: { userId: admin.id },
    create: {
      email: admin.email,
      companyId: company.id,
      userId: admin.id,
      role: UserRole.admin,
    },
  });

  console.log('Seed complete:', company.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
