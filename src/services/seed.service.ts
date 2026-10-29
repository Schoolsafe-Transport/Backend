import { prisma } from '../config/prisma';
import bcrypt from 'bcryptjs';

/**
 * Purges all mock, sample, or example data (*@schoolsafe.org) from the database.
 * Preserves strictly real user accounts, real admin credentials, and real registrations.
 */
export async function purgeMockExampleData(dbClient?: any) {
  const db = dbClient || prisma;

  // Drop phone unique constraint so parents/users can register with personal/shared mobile numbers
  try {
    await db.$executeRawUnsafe('DROP INDEX IF EXISTS "users_phone_key" CASCADE;');
  } catch (_e) {
    // Ignore if not present or unsupported
  }

  try {
    // Find all mock accounts
    const mockUsers = await db.user.findMany({
      where: {
        OR: [
          { email: { endsWith: '@schoolsafe.org' } },
          { email: { contains: 'schoolsafe.org' } },
          { email: { contains: 'example.com' } },
        ],
      },
      select: { id: true },
    });

    if (mockUsers.length === 0) {
      return;
    }

    console.log(`🧹 Found ${mockUsers.length} mock accounts. Purging mock data...`);
    const mockUserIds = mockUsers.map((u: any) => u.id);

    await db.notification.deleteMany({ where: { userId: { in: mockUserIds } } });
    await db.auditLog.deleteMany({
      where: { OR: [{ adminId: { in: mockUserIds } }, { targetUserId: { in: mockUserIds } }] },
    });
    await db.accountDocument.deleteMany({ where: { userId: { in: mockUserIds } } });
    await db.rating.deleteMany({
      where: { OR: [{ raterId: { in: mockUserIds } }, { rateeId: { in: mockUserIds } }] },
    });
    await db.student.deleteMany({ where: { parentId: { in: mockUserIds } } });
    await db.vehicle.deleteMany({ where: { providerId: { in: mockUserIds } } });
    await db.route.deleteMany({ where: { providerId: { in: mockUserIds } } });

    const result = await db.user.deleteMany({
      where: { id: { in: mockUserIds } },
    });

    console.log(`✅ Removed ${result.count} mock example accounts. Real data preserved.`);
  } catch (err: any) {
    console.error('⚠️ Error purging mock example data:', err.message);
  }
}

/**
 * Ensures the platform administrator account is present and active.
 */
export async function ensureRealAdministrator(dbClient?: any) {
  const db = dbClient || prisma;
  const adminPasswordHash = await bcrypt.hash('naba1219@Ra', 12);

  const admin = await db.user.upsert({
    where: { email: 'rachelberhane716@gmail.com' },
    update: {
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      isVerified: true,
      firstName: 'Rachel',
      lastName: 'Berhane',
      phone: '+251942027483',
    },
    create: {
      email: 'rachelberhane716@gmail.com',
      passwordHash: adminPasswordHash,
      firstName: 'Rachel',
      lastName: 'Berhane',
      phone: '+251942027483',
      role: 'ADMIN',
      status: 'ACTIVE',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      isVerified: true,
    },
  });

  // Ensure rahelnaba716@gmail.com is an ACTIVE PARENT user
  const existingRahel = await db.user.findUnique({
    where: { email: 'rahelnaba716@gmail.com' },
  });

  if (existingRahel) {
    await db.user.update({
      where: { id: existingRahel.id },
      data: {
        role: 'PARENT',
        status: 'ACTIVE',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        isVerified: true,
      },
    });
  } else {
    await db.user.create({
      data: {
        email: 'rahelnaba716@gmail.com',
        passwordHash: adminPasswordHash,
        firstName: 'Rahel',
        lastName: 'Bekele',
        phone: '+251942027483',
        role: 'PARENT',
        status: 'ACTIVE',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        isVerified: true,
      },
    });
  }

  console.log('✅ Accounts confirmed: Administrator (rachelberhane716@gmail.com), Parent (rahelnaba716@gmail.com)');
  return admin;
}
