import { PrismaClient } from '@prisma/client';
import { ensureRealAdministrator, purgeMockExampleData } from '../src/services/seed.service';

const prisma = new PrismaClient();

async function main() {
  await purgeMockExampleData(prisma);
  await ensureRealAdministrator(prisma);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
