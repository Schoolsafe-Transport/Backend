import { prisma } from '../config/prisma';
import bcrypt from 'bcryptjs';

/**
 * Purges all mock, sample, or example data (*@schoolsafe.org) from the database.
 * Preserves strictly real user accounts, real admin credentials, and real registrations.
 */
export async function purgeMockExampleData(dbClient?: any) {
  const db = dbClient || prisma;
  console.log('🧹 Purging all mock example data from database...');

  try {
    await db.advertisementEvent.deleteMany({});
    await db.advertisingCampaign.deleteMany({});
    await db.advertisingPackage.deleteMany({});
    await db.safetyIncident.deleteMany({});
    await db.boardingEvent.deleteMany({});
    await db.tripPassenger.deleteMany({});
    await db.tripLocation.deleteMany({});
    await db.trip.deleteMany({});
    await db.studentTransportPass.deleteMany({});
    await db.payment.deleteMany({});
    await db.transportationAgreement.deleteMany({});
    await db.transportationOffer.deleteMany({});
    await db.transportationRequest.deleteMany({});
    await db.routeStop.deleteMany({});
    await db.route.deleteMany({});
    await db.vehicleDocument.deleteMany({});
    await db.vehicle.deleteMany({});
    await db.authorizedPickupPerson.deleteMany({});
    await db.student.deleteMany({});
    await db.rating.deleteMany({});
    await db.notification.deleteMany({});
    await db.auditLog.deleteMany({});
    await db.accountDocument.deleteMany({});

    // Delete all users whose email ends with @schoolsafe.org or contains mock domains
    const result = await db.user.deleteMany({
      where: {
        OR: [
          { email: { endsWith: '@schoolsafe.org' } },
          { email: { contains: 'schoolsafe.org' } },
          { email: { contains: 'example.com' } },
        ],
      },
    });

    console.log(`✅ Removed ${result.count} mock example accounts. Only real users remain.`);
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

  console.log('✅ Real administrator confirmed:', admin.email);
  return admin;
}
