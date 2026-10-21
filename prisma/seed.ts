import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SchoolSafe database with verified transportation options...');

  const providerPasswordHash = await bcrypt.hash('SafeDriverPassword123!', 12);
  const parentPasswordHash = await bcrypt.hash('SafePassword123!', 12);
  const adminPasswordHash = await bcrypt.hash('AdminSafe123!', 12);

  // 0. System Administrator
  const admin = await prisma.user.upsert({
    where: { email: 'admin@schoolsafe.org' },
    update: {
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      isVerified: true,
    },
    create: {
      email: 'admin@schoolsafe.org',
      passwordHash: adminPasswordHash,
      firstName: 'SchoolSafe',
      lastName: 'Administrator',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      isVerified: true,
    },
  });

  // 1. Verified Transport Provider
  const provider = await prisma.user.upsert({
    where: { email: 'driver.samuel@schoolsafe.org' },
    update: {
      status: UserStatus.ACTIVE,
      isVerified: true,
      profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    },
    create: {
      email: 'driver.samuel@schoolsafe.org',
      passwordHash: providerPasswordHash,
      firstName: 'Samuel',
      lastName: 'Gebre',
      phone: '+251914112233',
      role: UserRole.TRANSPORT_PROVIDER,
      status: UserStatus.ACTIVE,
      isVerified: true,
      profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    },
  });

  // 2. Demo Parent & Child
  const parent = await prisma.user.upsert({
    where: { email: 'parent.abebe@schoolsafe.org' },
    update: {
      status: UserStatus.ACTIVE,
      isVerified: true,
    },
    create: {
      email: 'parent.abebe@schoolsafe.org',
      passwordHash: parentPasswordHash,
      firstName: 'Abebe',
      lastName: 'Kebede',
      phone: '+251911223344',
      role: UserRole.PARENT,
      status: UserStatus.ACTIVE,
      isVerified: true,
    },
  });

  const student = await prisma.student.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      parentId: parent.id,
      firstName: 'Hana',
      lastName: 'Kebede',
      schoolName: 'Mekelle Primary Academy',
      grade: 'Grade 4',
      gender: 'Female',
      emergencyPhone: '+251911223344',
    },
  });

  // 3. Vehicle (Toyota Hiace, Plate 3-A12345)
  const vehicle = await prisma.vehicle.upsert({
    where: { plateNumber: '3-A12345' },
    update: {
      providerId: provider.id,
      capacity: 12,
    },
    create: {
      providerId: provider.id,
      make: 'Toyota',
      model: 'Hiace Van',
      year: 2021,
      plateNumber: '3-A12345',
      capacity: 12,
      photoUrl: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=600&q=80',
      isVerified: true,
      status: 'ACTIVE',
    },
  });

  // 4. Route (Mekelle -> School Route)
  const route = await prisma.route.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: {
      providerId: provider.id,
      vehicleId: vehicle.id,
      availableSeats: 3,
      monthlyPrice: 3500,
      isAcceptingPassengers: true,
      status: 'ACTIVE',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      providerId: provider.id,
      vehicleId: vehicle.id,
      name: 'Mekelle → School Route',
      origin: 'Ayder',
      destinationSchool: 'Mekelle Primary Academy',
      schoolBranch: 'Main Campus',
      monthlyPrice: 3500,
      capacity: 12,
      availableSeats: 3,
      departureTimeMorning: '07:15 AM',
      departureTimeAfternoon: '03:45 PM',
      serviceType: 'BOTH',
      isAcceptingPassengers: true,
      status: 'ACTIVE',
      completedTrips: 48,
      averageRating: 4.9,
    },
  });

  // 5. Route Stops
  const existingStops = await prisma.routeStop.findMany({ where: { routeId: route.id } });
  if (existingStops.length === 0) {
    await prisma.routeStop.createMany({
      data: [
        { routeId: route.id, name: 'Ayder Roundabout', orderIndex: 1, pickupTimeMorning: '07:20 AM' },
        { routeId: route.id, name: 'Romanat Square', orderIndex: 2, pickupTimeMorning: '07:35 AM' },
        { routeId: route.id, name: 'Piazza Post Office', orderIndex: 3, pickupTimeMorning: '07:45 AM' },
        { routeId: route.id, name: 'Mekelle Primary Academy Gate', orderIndex: 4, pickupTimeMorning: '08:00 AM' },
      ],
    });
  }

  // 6. Rating
  const existingRating = await prisma.rating.findFirst({
    where: { providerId: provider.id, parentId: parent.id },
  });
  if (!existingRating) {
    await prisma.rating.create({
      data: {
        providerId: provider.id,
        parentId: parent.id,
        rating: 5,
        comment: 'Very punctual and careful driver. My daughter feels safe every morning.',
      },
    });
  }

  console.log('Seed completed successfully!');
  console.log(`Admin: ${admin.firstName} ${admin.lastName} (admin@schoolsafe.org / AdminSafe123!)`);
  console.log(`Provider: ${provider.firstName} ${provider.lastName} (driver.samuel@schoolsafe.org / SafeDriverPassword123!)`);
  console.log(`Route: ${route.name} (Monthly: ETB ${route.monthlyPrice}, Available Seats: ${route.availableSeats})`);
  console.log(`Parent: ${parent.firstName} ${parent.lastName} (parent.abebe@schoolsafe.org / SafePassword123!)`);
  console.log(`Student: ${student.firstName} ${student.lastName} (${student.schoolName})`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
