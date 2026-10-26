const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      isEmailVerified: true,
      createdAt: true
    }
  });
  console.log('--- LOCAL DATABASE USERS (' + users.length + ') ---');
  console.log(JSON.stringify(users, null, 2));

  // Also check email verification tokens
  const tokens = await prisma.emailVerificationToken.findMany({
    include: {
      user: {
        select: { email: true, firstName: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('--- RECENT EMAIL VERIFICATION TOKENS ---');
  console.log(JSON.stringify(tokens, null, 2));
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
