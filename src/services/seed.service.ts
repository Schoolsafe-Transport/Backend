import { prisma } from '../config/prisma';
import bcrypt from 'bcryptjs';

/**
 * Seeds comprehensive, realistic baseline operational data for the SchoolSafe platform.
 * This guarantees the Admin Dashboard has accurate, live-feeling data across all tabs:
 * - User Management (Parents, Drivers, Providers, Businesses, Admins)
 * - Provider Applications & Approvals (Active and Pending with documents)
 * - Vehicle Fleet Verifications (Active and Pending)
 * - Transit Routes & Corridors with active stops
 * - Live Trips with GPS coordinates & Passengers
 * - Payment Ledger & Receipt Review queue
 * - Child Safety Incidents (Open, Under Review, Resolved)
 * - Corporate Business Accounts & Ad Campaigns
 * - Security & Audit Trail Logs
 */
export async function seedBaselineOperationalData(dbClient?: any) {
  const db = dbClient || prisma;
  console.log('🌱 Checking / Seeding SchoolSafe operational baseline data...');

  const defaultPasswordHash = await bcrypt.hash('SafeDriver123!', 10);
  const parentPasswordHash = await bcrypt.hash('SafeParent123!', 10);
  const adminPasswordHash = await bcrypt.hash('naba1219@Ra', 12);

  // 1. System Administrator
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

  // 2. Verified Active Transport Providers
  const providerSamuel = await db.user.upsert({
    where: { email: 'driver.samuel@schoolsafe.org' },
    update: {
      status: 'ACTIVE',
      isVerified: true,
      isEmailVerified: true,
      businessName: 'Samuel Student Shuttle',
      licenseNumber: 'DL-AA-40912',
      serviceArea: 'Bole - British Academy Corridor',
    },
    create: {
      email: 'driver.samuel@schoolsafe.org',
      passwordHash: defaultPasswordHash,
      firstName: 'Samuel',
      lastName: 'Gebre',
      phone: '+251914112233',
      role: 'TRANSPORT_PROVIDER',
      status: 'ACTIVE',
      isVerified: true,
      isEmailVerified: true,
      businessName: 'Samuel Student Shuttle',
      licenseNumber: 'DL-AA-40912',
      serviceArea: 'Bole - British Academy Corridor',
      profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    },
  });

  const providerDawit = await db.user.upsert({
    where: { email: 'dawit.haile@schoolsafe.org' },
    update: {
      status: 'ACTIVE',
      isVerified: true,
      isEmailVerified: true,
      businessName: 'Dawit Express Transit',
      licenseNumber: 'DL-AA-38104',
      serviceArea: 'CMC - Sanford School Route',
    },
    create: {
      email: 'dawit.haile@schoolsafe.org',
      passwordHash: defaultPasswordHash,
      firstName: 'Dawit',
      lastName: 'Haile',
      phone: '+251911334455',
      role: 'TRANSPORT_PROVIDER',
      status: 'ACTIVE',
      isVerified: true,
      isEmailVerified: true,
      businessName: 'Dawit Express Transit',
      licenseNumber: 'DL-AA-38104',
      serviceArea: 'CMC - Sanford School Route',
      profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    },
  });

  const providerBethlehem = await db.user.upsert({
    where: { email: 'bethlehem.a@schoolsafe.org' },
    update: {
      status: 'ACTIVE',
      isVerified: true,
      isEmailVerified: true,
      businessName: 'Bethlehem Safe Transit',
      licenseNumber: 'DL-AA-51203',
      serviceArea: 'Sarbet - International Community School',
    },
    create: {
      email: 'bethlehem.a@schoolsafe.org',
      passwordHash: defaultPasswordHash,
      firstName: 'Bethlehem',
      lastName: 'Assefa',
      phone: '+251922556677',
      role: 'TRANSPORT_PROVIDER',
      status: 'ACTIVE',
      isVerified: true,
      isEmailVerified: true,
      businessName: 'Bethlehem Safe Transit',
      licenseNumber: 'DL-AA-51203',
      serviceArea: 'Sarbet - International Community School',
      profilePhoto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    },
  });

  // 3. Pending Transport Provider Applications (Awaiting Admin Review in Queue!)
  const providerSolomon = await db.user.upsert({
    where: { email: 'solomon.t@schoolsafe.org' },
    update: {
      status: 'PENDING',
      isVerified: false,
      businessName: 'Solomon Van Fleet',
      licenseNumber: 'DL-AA-62119',
      serviceArea: 'Gerji - St. Joseph School',
      registrationStep: 4,
    },
    create: {
      email: 'solomon.t@schoolsafe.org',
      passwordHash: defaultPasswordHash,
      firstName: 'Solomon',
      lastName: 'Tesfaye',
      phone: '+251933778899',
      role: 'TRANSPORT_PROVIDER',
      status: 'PENDING',
      isVerified: false,
      isEmailVerified: true,
      businessName: 'Solomon Van Fleet',
      licenseNumber: 'DL-AA-62119',
      serviceArea: 'Gerji - St. Joseph School',
      registrationStep: 4,
    },
  });

  const providerKidist = await db.user.upsert({
    where: { email: 'kidist.m@schoolsafe.org' },
    update: {
      status: 'PENDING',
      isVerified: false,
      businessName: 'Kidist Safe Ride',
      licenseNumber: 'DL-AA-71044',
      serviceArea: 'Old Airport - Bingham Academy',
      registrationStep: 4,
    },
    create: {
      email: 'kidist.m@schoolsafe.org',
      passwordHash: defaultPasswordHash,
      firstName: 'Kidist',
      lastName: 'Mengistu',
      phone: '+251944112233',
      role: 'TRANSPORT_PROVIDER',
      status: 'PENDING',
      isVerified: false,
      isEmailVerified: true,
      businessName: 'Kidist Safe Ride',
      licenseNumber: 'DL-AA-71044',
      serviceArea: 'Old Airport - Bingham Academy',
      registrationStep: 4,
    },
  });

  // 4. Parents & Guardians
  const parentAbebe = await db.user.upsert({
    where: { email: 'parent.abebe@schoolsafe.org' },
    update: { status: 'ACTIVE', isVerified: true },
    create: {
      email: 'parent.abebe@schoolsafe.org',
      passwordHash: parentPasswordHash,
      firstName: 'Abebe',
      lastName: 'Kebede',
      phone: '+251911223344',
      role: 'PARENT',
      status: 'ACTIVE',
      isVerified: true,
      isEmailVerified: true,
    },
  });

  const parentSelamawit = await db.user.upsert({
    where: { email: 'selamawit.d@schoolsafe.org' },
    update: { status: 'ACTIVE', isVerified: true },
    create: {
      email: 'selamawit.d@schoolsafe.org',
      passwordHash: parentPasswordHash,
      firstName: 'Selamawit',
      lastName: 'Desta',
      phone: '+251912445566',
      role: 'PARENT',
      status: 'ACTIVE',
      isVerified: true,
      isEmailVerified: true,
    },
  });

  const parentYohannes = await db.user.upsert({
    where: { email: 'yohannes.b@schoolsafe.org' },
    update: { status: 'ACTIVE', isVerified: true },
    create: {
      email: 'yohannes.b@schoolsafe.org',
      passwordHash: parentPasswordHash,
      firstName: 'Yohannes',
      lastName: 'Berhe',
      phone: '+251913667788',
      role: 'PARENT',
      status: 'ACTIVE',
      isVerified: true,
      isEmailVerified: true,
    },
  });

  const parentAlmaz = await db.user.upsert({
    where: { email: 'almaz.t@schoolsafe.org' },
    update: { status: 'ACTIVE', isVerified: true },
    create: {
      email: 'almaz.t@schoolsafe.org',
      passwordHash: parentPasswordHash,
      firstName: 'Almaz',
      lastName: 'Tadesse',
      phone: '+251914889900',
      role: 'PARENT',
      status: 'ACTIVE',
      isVerified: true,
      isEmailVerified: true,
    },
  });

  // 5. Students (Children)
  const studentHana = await db.student.upsert({
    where: { id: '11111111-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '11111111-0000-0000-0000-000000000001',
      parentId: parentAbebe.id,
      firstName: 'Hana',
      lastName: 'Kebede',
      schoolName: 'British Academy',
      grade: 'Grade 4',
      gender: 'Female',
      emergencyPhone: '+251911223344',
      homeAddress: 'Bole Atlas, Addis Ababa',
    },
  });

  const studentNahom = await db.student.upsert({
    where: { id: '11111111-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '11111111-0000-0000-0000-000000000002',
      parentId: parentSelamawit.id,
      firstName: 'Nahom',
      lastName: 'Desta',
      schoolName: 'Sanford International School',
      grade: 'Grade 6',
      gender: 'Male',
      emergencyPhone: '+251912445566',
      homeAddress: 'CMC Michael, Addis Ababa',
    },
  });

  const studentLiya = await db.student.upsert({
    where: { id: '11111111-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '11111111-0000-0000-0000-000000000003',
      parentId: parentYohannes.id,
      firstName: 'Liya',
      lastName: 'Yohannes',
      schoolName: 'International Community School (ICS)',
      grade: 'Grade 3',
      gender: 'Female',
      emergencyPhone: '+251913667788',
      homeAddress: 'Sarbet Bisrate Gabriel, Addis Ababa',
    },
  });

  const studentCaleb = await db.student.upsert({
    where: { id: '11111111-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '11111111-0000-0000-0000-000000000004',
      parentId: parentAlmaz.id,
      firstName: 'Caleb',
      lastName: 'Tadesse',
      schoolName: 'Lycée Guébré-Mariam',
      grade: 'Grade 5',
      gender: 'Male',
      emergencyPhone: '+251914889900',
      homeAddress: 'Kazanchis Guinea Conakry St, Addis Ababa',
    },
  });

  // 6. Vehicles (Active & Verified, and Pending Review)
  const vehicle1 = await db.vehicle.upsert({
    where: { plateNumber: '3-A12345' },
    update: { isVerified: true, status: 'ACTIVE' },
    create: {
      providerId: providerSamuel.id,
      make: 'Toyota',
      model: 'Hiace Van',
      year: 2021,
      plateNumber: '3-A12345',
      capacity: 12,
      isVerified: true,
      status: 'ACTIVE',
      photoUrl: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=600&q=80',
    },
  });

  const vehicle2 = await db.vehicle.upsert({
    where: { plateNumber: '3-B67890' },
    update: { isVerified: true, status: 'ACTIVE' },
    create: {
      providerId: providerDawit.id,
      make: 'Isuzu',
      model: 'Coaster Mini-bus',
      year: 2020,
      plateNumber: '3-B67890',
      capacity: 24,
      isVerified: true,
      status: 'ACTIVE',
      photoUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80',
    },
  });

  const vehicle3 = await db.vehicle.upsert({
    where: { plateNumber: '3-A44556' },
    update: { isVerified: true, status: 'ACTIVE' },
    create: {
      providerId: providerBethlehem.id,
      make: 'Hyundai',
      model: 'County Bus',
      year: 2022,
      plateNumber: '3-A44556',
      capacity: 18,
      isVerified: true,
      status: 'ACTIVE',
      photoUrl: 'https://images.unsplash.com/photo-1494515843206-f3117d3f51b7?auto=format&fit=crop&w=600&q=80',
    },
  });

  // Pending Vehicles (awaiting Admin Review in Fleet Queue!)
  await db.vehicle.upsert({
    where: { plateNumber: '3-A88219' },
    update: { isVerified: false, status: 'ACTIVE' },
    create: {
      providerId: providerSolomon.id,
      make: 'Toyota',
      model: 'Hiace High-Roof',
      year: 2019,
      plateNumber: '3-A88219',
      capacity: 14,
      isVerified: false,
      status: 'ACTIVE',
      photoUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=600&q=80',
    },
  });

  await db.vehicle.upsert({
    where: { plateNumber: '3-B99102' },
    update: { isVerified: false, status: 'ACTIVE' },
    create: {
      providerId: providerKidist.id,
      make: 'Mercedes-Benz',
      model: 'Sprinter 314',
      year: 2021,
      plateNumber: '3-B99102',
      capacity: 16,
      isVerified: false,
      status: 'ACTIVE',
      photoUrl: 'https://images.unsplash.com/photo-1527786356703-4b100091cd2c?auto=format&fit=crop&w=600&q=80',
    },
  });

  // 7. Routes & Corridors
  const route1 = await db.route.upsert({
    where: { id: '22222222-0000-0000-0000-000000000001' },
    update: { status: 'ACTIVE' },
    create: {
      id: '22222222-0000-0000-0000-000000000001',
      providerId: providerSamuel.id,
      vehicleId: vehicle1.id,
      name: 'Bole → British Academy Transit Route',
      origin: 'Bole Medhanialem',
      destinationSchool: 'British Academy',
      schoolBranch: 'Main Campus',
      departureTimeMorning: '07:15 AM',
      departureTimeAfternoon: '03:30 PM',
      serviceType: 'BOTH',
      monthlyPrice: 3800,
      capacity: 12,
      availableSeats: 3,
      isAcceptingPassengers: true,
      status: 'ACTIVE',
      completedTrips: 64,
      averageRating: 4.9,
    },
  });

  const route2 = await db.route.upsert({
    where: { id: '22222222-0000-0000-0000-000000000002' },
    update: { status: 'ACTIVE' },
    create: {
      id: '22222222-0000-0000-0000-000000000002',
      providerId: providerDawit.id,
      vehicleId: vehicle2.id,
      name: 'CMC / Ayat → Sanford International Route',
      origin: 'Ayat Roundabout',
      destinationSchool: 'Sanford International School',
      schoolBranch: 'Kebena Campus',
      departureTimeMorning: '07:00 AM',
      departureTimeAfternoon: '03:45 PM',
      serviceType: 'BOTH',
      monthlyPrice: 4200,
      capacity: 24,
      availableSeats: 5,
      isAcceptingPassengers: true,
      status: 'ACTIVE',
      completedTrips: 82,
      averageRating: 4.8,
    },
  });

  const route3 = await db.route.upsert({
    where: { id: '22222222-0000-0000-0000-000000000003' },
    update: { status: 'ACTIVE' },
    create: {
      id: '22222222-0000-0000-0000-000000000003',
      providerId: providerBethlehem.id,
      vehicleId: vehicle3.id,
      name: 'Sarbet → International Community School (ICS)',
      origin: 'Sarbet Gotera',
      destinationSchool: 'International Community School',
      schoolBranch: 'Old Airport Campus',
      departureTimeMorning: '07:20 AM',
      departureTimeAfternoon: '03:30 PM',
      serviceType: 'BOTH',
      monthlyPrice: 4500,
      capacity: 18,
      availableSeats: 4,
      isAcceptingPassengers: true,
      status: 'ACTIVE',
      completedTrips: 51,
      averageRating: 5.0,
    },
  });

  // Route Stops
  const stops1 = await db.routeStop.findMany({ where: { routeId: route1.id } });
  if (stops1.length === 0) {
    await db.routeStop.createMany({
      data: [
        { routeId: route1.id, name: 'Bole Medhanialem Square', orderIndex: 1, pickupTimeMorning: '07:15 AM' },
        { routeId: route1.id, name: 'Atlas Hotel Intersection', orderIndex: 2, pickupTimeMorning: '07:25 AM' },
        { routeId: route1.id, name: 'Urael Roundabout', orderIndex: 3, pickupTimeMorning: '07:40 AM' },
        { routeId: route1.id, name: 'British Academy Gate', orderIndex: 4, pickupTimeMorning: '08:00 AM' },
      ],
    });
  }

  // 8. Transportation Agreements
  const req1 = await db.transportationRequest.upsert({
    where: { id: '33333333-0000-0000-0000-000000000001' },
    update: { status: 'ACCEPTED' },
    create: {
      id: '33333333-0000-0000-0000-000000000001',
      parentId: parentAbebe.id,
      studentId: studentHana.id,
      providerId: providerSamuel.id,
      routeId: route1.id,
      pickupStopName: 'Atlas Hotel Intersection',
      preferredStartDate: new Date('2026-09-01'),
      proposedPrice: 3800,
      currentPrice: 3800,
      status: 'ACCEPTED',
    },
  });

  const agreement1 = await db.transportationAgreement.upsert({
    where: { requestId: req1.id },
    update: { status: 'ACTIVE' },
    create: {
      requestId: req1.id,
      parentId: parentAbebe.id,
      studentId: studentHana.id,
      providerId: providerSamuel.id,
      vehicleId: vehicle1.id,
      routeId: route1.id,
      pickupStopName: 'Atlas Hotel Intersection',
      monthlyPrice: 3800,
      startDate: new Date('2026-09-01'),
      status: 'ACTIVE',
    },
  });

  const req2 = await db.transportationRequest.upsert({
    where: { id: '33333333-0000-0000-0000-000000000002' },
    update: { status: 'ACCEPTED' },
    create: {
      id: '33333333-0000-0000-0000-000000000002',
      parentId: parentSelamawit.id,
      studentId: studentNahom.id,
      providerId: providerDawit.id,
      routeId: route2.id,
      pickupStopName: 'CMC Michael Gate',
      preferredStartDate: new Date('2026-09-01'),
      proposedPrice: 4200,
      currentPrice: 4200,
      status: 'ACCEPTED',
    },
  });

  const agreement2 = await db.transportationAgreement.upsert({
    where: { requestId: req2.id },
    update: { status: 'ACTIVE' },
    create: {
      requestId: req2.id,
      parentId: parentSelamawit.id,
      studentId: studentNahom.id,
      providerId: providerDawit.id,
      vehicleId: vehicle2.id,
      routeId: route2.id,
      pickupStopName: 'CMC Michael Gate',
      monthlyPrice: 4200,
      startDate: new Date('2026-09-01'),
      status: 'ACTIVE',
    },
  });

  // 9. Payment Ledger Records (both Pending Review and Approved)
  await db.payment.upsert({
    where: { reference: 'SS-PAY-2026-001' },
    update: { status: 'PENDING_REVIEW' },
    create: {
      reference: 'SS-PAY-2026-001',
      agreementId: agreement1.id,
      payerId: parentAbebe.id,
      receiverId: providerSamuel.id,
      amount: 3800,
      currency: 'ETB',
      status: 'PENDING_REVIEW',
      paymentMethod: 'TELEBIRR',
      receiptUrl: '/uploads/receipts/telebirr_hana_oct.png',
      receiptOriginalName: 'telebirr_october_transit.png',
      receiptMimeType: 'image/png',
      receiptSize: 248102,
      receiptUploadedAt: new Date(),
      notes: 'October monthly student transit fee via Telebirr (Txn #TB98234710)',
    },
  });

  await db.payment.upsert({
    where: { reference: 'SS-PAY-2026-002' },
    update: { status: 'PENDING_REVIEW' },
    create: {
      reference: 'SS-PAY-2026-002',
      agreementId: agreement2.id,
      payerId: parentSelamawit.id,
      receiverId: providerDawit.id,
      amount: 4200,
      currency: 'ETB',
      status: 'PENDING_REVIEW',
      paymentMethod: 'CBE_TRANSFER',
      receiptUrl: '/uploads/receipts/cbe_nahom_oct.pdf',
      receiptOriginalName: 'cbe_transfer_receipt.pdf',
      receiptMimeType: 'application/pdf',
      receiptSize: 312040,
      receiptUploadedAt: new Date(),
      notes: 'October monthly fee via CBE mobile banking (Ref #FT24018890)',
    },
  });

  await db.payment.upsert({
    where: { reference: 'SS-PAY-2026-003' },
    update: { status: 'APPROVED' },
    create: {
      reference: 'SS-PAY-2026-003',
      agreementId: agreement1.id,
      payerId: parentAbebe.id,
      receiverId: providerSamuel.id,
      amount: 3800,
      currency: 'ETB',
      status: 'APPROVED',
      paymentMethod: 'TELEBIRR',
      receiptUrl: '/uploads/receipts/telebirr_hana_sep.png',
      receiptOriginalName: 'telebirr_september_receipt.png',
      receiptMimeType: 'image/png',
      receiptSize: 198000,
      receiptUploadedAt: new Date('2026-09-02'),
      reviewedById: admin.id,
      reviewedAt: new Date('2026-09-02'),
      paidAt: new Date('2026-09-02'),
      notes: 'September fee confirmed and credited',
    },
  });

  // 10. Live Transit Trips & Telemetry
  const activeTrip1 = await db.trip.upsert({
    where: { id: '44444444-0000-0000-0000-000000000001' },
    update: { status: 'IN_PROGRESS' },
    create: {
      id: '44444444-0000-0000-0000-000000000001',
      routeId: route1.id,
      vehicleId: vehicle1.id,
      driverId: providerSamuel.id,
      tripType: 'MORNING',
      status: 'IN_PROGRESS',
      scheduledDate: new Date(),
      startTime: new Date(),
      notes: 'Active morning student run to British Academy',
    },
  });

  // Telemetry Location in Addis Ababa (Bole area)
  await db.tripLocation.create({
    data: {
      tripId: activeTrip1.id,
      latitude: 8.9806,
      longitude: 38.7578,
      speed: 34.5,
      heading: 52,
      timestamp: new Date(),
    },
  });

  // Trip Passenger
  await db.tripPassenger.upsert({
    where: { tripId_studentId: { tripId: activeTrip1.id, studentId: studentHana.id } },
    update: { status: 'BOARDED' },
    create: {
      tripId: activeTrip1.id,
      studentId: studentHana.id,
      pickupStopName: 'Atlas Hotel Intersection',
      status: 'BOARDED',
      boardedAt: new Date(),
    },
  });

  // 11. Safety Incidents (Open & Under Review)
  const existingIncidents = await db.safetyIncident.count();
  if (existingIncidents === 0) {
    await db.safetyIncident.createMany({
      data: [
        {
          reportedById: providerSamuel.id,
          tripId: activeTrip1.id,
          routeId: route1.id,
          vehicleId: vehicle1.id,
          title: 'Heavy Traffic Slowdown on Ring Road Near Urael',
          description: 'Route experiencing an estimated 10-minute delay due to temporary road repair works near Urael junction. All students safe onboard.',
          severity: 'LOW',
          status: 'OPEN',
          location: 'Ring Road / Urael, Addis Ababa',
        },
        {
          reportedById: providerDawit.id,
          routeId: route2.id,
          vehicleId: vehicle2.id,
          title: 'Minor Road Detour near Meganagna Overpass',
          description: 'Main corridor closed by municipal transit authorities; driver rerouting safely via CMC secondary access road.',
          severity: 'MEDIUM',
          status: 'UNDER_REVIEW',
          location: 'Meganagna Interchange, Addis Ababa',
        },
        {
          reportedById: parentAbebe.id,
          title: 'Authorized Pickup Contact Verification Check',
          description: 'Aunt verified and picked up student at scheduled stop after advance parental confirmation to dispatch desk.',
          severity: 'LOW',
          status: 'RESOLVED',
          resolution: 'Confirmed with parent via phone dispatch. Identity matched registered authorized pickup person.',
          resolvedAt: new Date(),
        },
      ],
    });
  }

  // 12. Corporate Businesses & Advertising Campaigns
  const business1 = await db.user.upsert({
    where: { email: 'addis.supplies@schoolsafe.org' },
    update: { status: 'ACTIVE', isVerified: true },
    create: {
      email: 'addis.supplies@schoolsafe.org',
      passwordHash: defaultPasswordHash,
      firstName: 'Addis',
      lastName: 'Supplies',
      phone: '+251911440022',
      businessName: 'Addis Kids School Uniforms & Supplies',
      role: 'BUSINESS',
      status: 'ACTIVE',
      isVerified: true,
      isEmailVerified: true,
    },
  });

  const business2 = await db.user.upsert({
    where: { email: 'freshbites@schoolsafe.org' },
    update: { status: 'PENDING', isVerified: false },
    create: {
      email: 'freshbites@schoolsafe.org',
      passwordHash: defaultPasswordHash,
      firstName: 'Fresh',
      lastName: 'Bites',
      phone: '+251912551133',
      businessName: 'FreshBites Healthy Kids Catering',
      role: 'BUSINESS',
      status: 'PENDING',
      isVerified: false,
      isEmailVerified: true,
    },
  });

  // Advertising Packages
  let adPkg = await db.advertisingPackage.findFirst();
  if (!adPkg) {
    adPkg = await db.advertisingPackage.create({
      data: {
        name: 'Parent Dashboard Featured Banner',
        description: 'Prime placement on Parent Dashboard and Booking Marketplace',
        durationDays: 30,
        price: 2500,
        placement: 'DASHBOARD_AND_LANDING',
        isFeatured: true,
      },
    });
  }

  // Campaigns (Active & Pending Review)
  const existingCampaigns = await db.advertisingCampaign.count();
  if (existingCampaigns === 0) {
    await db.advertisingCampaign.create({
      data: {
        businessId: business1.id,
        packageId: adPkg.id,
        title: 'Back-to-School Uniforms 15% Discount',
        description: 'Quality durable school uniforms and stationery for British Academy, Sanford, and ICS students.',
        bannerUrl: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=800&q=80',
        targetUrl: 'https://schoolsafe.org/marketplace',
        placement: 'DASHBOARD_BANNER',
        status: 'ACTIVE',
        impressionsCount: 1420,
        clicksCount: 88,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-11-01'),
      },
    });

    await db.advertisingCampaign.create({
      data: {
        businessId: business2.id,
        packageId: adPkg.id,
        title: 'Nutritious Organic Hot Lunches for Students',
        description: 'Delivered fresh and warm directly to the school cafeteria before lunch bell.',
        bannerUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
        targetUrl: 'https://freshbites.et',
        placement: 'DASHBOARD_BANNER',
        status: 'PENDING_REVIEW',
        impressionsCount: 0,
        clicksCount: 0,
      },
    });
  }

  // 13. Verification Documents for Pending Applications
  const existingDocs = await db.accountDocument.count();
  if (existingDocs === 0) {
    await db.accountDocument.createMany({
      data: [
        {
          userId: providerSolomon.id,
          documentType: 'DRIVER_LICENSE',
          documentName: 'Commercial_Driver_License_Grade3.pdf',
          fileUrl: '/uploads/documents/solomon_license.pdf',
          fileMimeType: 'application/pdf',
          fileSize: 421000,
          status: 'PENDING',
        },
        {
          userId: providerSolomon.id,
          documentType: 'CRIMINAL_CLEARANCE',
          documentName: 'Federal_Police_Clearance_2026.pdf',
          fileUrl: '/uploads/documents/solomon_clearance.pdf',
          fileMimeType: 'application/pdf',
          fileSize: 280000,
          status: 'PENDING',
        },
        {
          userId: providerKidist.id,
          documentType: 'DRIVER_LICENSE',
          documentName: 'Commercial_Driving_Permit.pdf',
          fileUrl: '/uploads/documents/kidist_license.pdf',
          fileMimeType: 'application/pdf',
          fileSize: 390000,
          status: 'PENDING',
        },
        {
          userId: business2.id,
          documentType: 'BUSINESS_REGISTRATION',
          documentName: 'Ministry_of_Trade_Commercial_License.pdf',
          fileUrl: '/uploads/documents/freshbites_license.pdf',
          fileMimeType: 'application/pdf',
          fileSize: 520000,
          status: 'PENDING',
        },
      ],
    });
  }

  // 14. Audit Logs (Tamper-Evident Security Log)
  const existingLogs = await db.auditLog.count();
  if (existingLogs === 0) {
    await db.auditLog.createMany({
      data: [
        {
          adminId: admin.id,
          targetUserId: providerSamuel.id,
          action: 'APPROVE_USER',
          entityType: 'USER',
          entityId: providerSamuel.id,
          details: 'Approved commercial transport provider credentials and background check for Samuel Gebre',
        },
        {
          adminId: admin.id,
          action: 'APPROVE_VEHICLE',
          entityType: 'VEHICLE',
          entityId: vehicle1.id,
          details: 'Approved vehicle 3-A12345 (Toyota Hiace Van) after annual mechanical safety inspection check',
        },
        {
          adminId: admin.id,
          targetUserId: providerDawit.id,
          action: 'APPROVE_USER',
          entityType: 'USER',
          entityId: providerDawit.id,
          details: 'Verified commercial driver licensing and approved Dawit Haile',
        },
        {
          adminId: admin.id,
          action: 'RESOLVE_INCIDENT',
          entityType: 'INCIDENT',
          entityId: 'inc-resolved-001',
          details: 'Resolved student authorized pickup query with parent verbal telephone confirmation',
        },
      ],
    });
  }

  console.log('✅ Baseline operational data seeded successfully!');
  console.log('   Admin: rachelberhane716@gmail.com');
  console.log('   Providers: 3 Active, 2 Pending');
  console.log('   Vehicles: 3 Active, 2 Pending');
  console.log('   Routes: 3 Active routes with stops');
  console.log('   Trips: 1 Active in-progress trip with live GPS');
  console.log('   Payments: 2 Pending review, 1 Approved');
  console.log('   Incidents: 1 Open, 1 Under Review, 1 Resolved');
  console.log('   Campaigns: 1 Active, 1 Pending Review');
  console.log('   Audit Logs: 4 entries recorded');
}
