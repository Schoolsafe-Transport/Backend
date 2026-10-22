import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';

describe('Student Transport Pass & QR Boarding System (Tasks 1-8)', () => {
  jest.setTimeout(45000);

  const ts = Date.now();
  let parentAToken: string;
  let parentAId: string;
  let parentBToken: string;
  let parentBId: string;

  let providerToken: string;
  let providerId: string;

  let driver1Token: string;
  let driver1Id: string;
  let driver2Token: string;
  let driver2Id: string;

  let childAId: string;
  let childBId: string;

  let vehicle1Id: string;
  let vehicle2Id: string;
  let route1Id: string;
  let route2Id: string;

  let agreementAId: string;
  let agreementBId: string;

  let trip1Id: string;
  let trip2Id: string;
  let trip3Id: string;

  let validPassTokenA: string;
  let passCodeA: string;

  beforeAll(async () => {
    // 1. Create Parent A
    const pARes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `pass_parent_a_${ts}@schoolsafe.org`,
        password: 'Password123!',
        firstName: 'Tigist',
        lastName: 'Alemu',
        role: 'PARENT',
      });
    parentAToken = pARes.body.data.tokens.accessToken;
    parentAId = pARes.body.data.user.id;

    // 2. Create Parent B
    const pBRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `pass_parent_b_${ts}@schoolsafe.org`,
        password: 'Password123!',
        firstName: 'Solomon',
        lastName: 'Bekele',
        role: 'PARENT',
      });
    parentBToken = pBRes.body.data.tokens.accessToken;
    parentBId = pBRes.body.data.user.id;

    // Verify parents
    await prisma.user.updateMany({
      where: { id: { in: [parentAId, parentBId] } },
      data: { isEmailVerified: true, isVerified: true, status: 'ACTIVE' },
    });

    // 3. Create Transport Provider
    const provRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `pass_provider_${ts}@schoolsafe.org`,
        password: 'Password123!',
        firstName: 'Selam',
        lastName: 'SchoolBus Co',
        role: 'TRANSPORT_PROVIDER',
      });
    providerToken = provRes.body.data.tokens.accessToken;
    providerId = provRes.body.data.user.id;

    // 4. Create Driver 1 (assigned to Trip 1)
    const d1Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `pass_driver1_${ts}@schoolsafe.org`,
        password: 'Password123!',
        firstName: 'Ephrem',
        lastName: 'Tefera',
        role: 'DRIVER',
      });
    driver1Token = d1Res.body.data.tokens.accessToken;
    driver1Id = d1Res.body.data.user.id;

    // 5. Create Driver 2 (assigned to unrelated Vehicle/Trip 2)
    const d2Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `pass_driver2_${ts}@schoolsafe.org`,
        password: 'Password123!',
        firstName: 'Yohannes',
        lastName: 'Haile',
        role: 'DRIVER',
      });
    driver2Token = d2Res.body.data.tokens.accessToken;
    driver2Id = d2Res.body.data.user.id;

    // Verify Provider and Drivers
    await prisma.user.updateMany({
      where: { id: { in: [providerId, driver1Id, driver2Id] } },
      data: { isEmailVerified: true, status: 'ACTIVE', isVerified: true },
    });

    // 6. Create Children for Parent A and Parent B
    const childARes = await request(app)
      .post('/api/transportation/students')
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({
        firstName: 'Nahom',
        lastName: 'Alemu',
        schoolName: 'Bole Community School',
        schoolBranch: 'Main Campus',
        grade: 'Grade 4',
        emergencyPhone: '+251911223344',
      });
    childAId = childARes.body.data.id;

    const childBRes = await request(app)
      .post('/api/transportation/students')
      .set('Authorization', `Bearer ${parentBToken}`)
      .send({
        firstName: 'Meron',
        lastName: 'Bekele',
        schoolName: 'St Joseph School',
        schoolBranch: 'Boys Division',
        grade: 'Grade 6',
        emergencyPhone: '+251922334455',
      });
    childBId = childBRes.body.data.id;

    // 7. Create Vehicles (Vehicle 1 and Vehicle 2)
    const vehicle1 = await prisma.vehicle.create({
      data: {
        providerId,
        make: 'Toyota',
        model: 'Coaster',
        plateNumber: `AA-${ts.toString().slice(-5)}`,
        capacity: 22,
        isVerified: true,
        status: 'ACTIVE',
      },
    });
    vehicle1Id = vehicle1.id;

    const vehicle2 = await prisma.vehicle.create({
      data: {
        providerId,
        make: 'Hyundai',
        model: 'County',
        plateNumber: `ET-${ts.toString().slice(-5)}`,
        capacity: 25,
        isVerified: true,
        status: 'ACTIVE',
      },
    });
    vehicle2Id = vehicle2.id;

    // 8. Create Routes
    const route1 = await prisma.route.create({
      data: {
        providerId,
        vehicleId: vehicle1Id,
        name: `Morning Bole - School Line ${ts}`,
        origin: 'Bole Medhanealem',
        destinationSchool: 'Bole Community School',
        schoolBranch: 'Main Campus',
        departureTimeMorning: '07:15 AM',
        departureTimeAfternoon: '03:45 PM',
        monthlyPrice: 3200,
        capacity: 22,
        availableSeats: 21,
        status: 'ACTIVE',
        isAcceptingPassengers: true,
        stops: {
          create: [
            { name: 'Bole Brass Stop', orderIndex: 1, pickupTimeMorning: '07:20 AM', dropoffTimeAfternoon: '04:00 PM' },
            { name: 'Atlas Junction', orderIndex: 2, pickupTimeMorning: '07:30 AM', dropoffTimeAfternoon: '04:15 PM' },
          ],
        },
      },
    });
    route1Id = route1.id;

    const route2 = await prisma.route.create({
      data: {
        providerId,
        vehicleId: vehicle2Id,
        name: `CMC Express ${ts}`,
        origin: 'CMC Michael',
        destinationSchool: 'St Joseph School',
        schoolBranch: 'Boys Division',
        departureTimeMorning: '07:00 AM',
        departureTimeAfternoon: '03:30 PM',
        monthlyPrice: 3500,
        capacity: 25,
        availableSeats: 25,
        status: 'ACTIVE',
        isAcceptingPassengers: true,
      },
    });
    route2Id = route2.id;

    // 9. Create Request and Binding Agreement for Child A (Parent A)
    const requestA = await prisma.transportationRequest.create({
      data: {
        parentId: parentAId,
        studentId: childAId,
        providerId,
        routeId: route1Id,
        pickupStopName: 'Bole Brass Stop',
        preferredStartDate: new Date(),
        proposedPrice: 3200,
        currentPrice: 3200,
        status: 'ACCEPTED',
      },
    });

    const agreementA = await prisma.transportationAgreement.create({
      data: {
        requestId: requestA.id,
        parentId: parentAId,
        studentId: childAId,
        providerId,
        vehicleId: vehicle1Id,
        routeId: route1Id,
        pickupStopName: 'Bole Brass Stop',
        monthlyPrice: 3200,
        startDate: new Date(),
        status: 'ACTIVE',
      },
    });
    agreementAId = agreementA.id;

    // 10. Create Request and Binding Agreement for Child B (Parent B)
    const requestB = await prisma.transportationRequest.create({
      data: {
        parentId: parentBId,
        studentId: childBId,
        providerId,
        routeId: route2Id,
        pickupStopName: 'CMC Michael',
        preferredStartDate: new Date(),
        proposedPrice: 3500,
        currentPrice: 3500,
        status: 'ACCEPTED',
      },
    });

    const agreementB = await prisma.transportationAgreement.create({
      data: {
        requestId: requestB.id,
        parentId: parentBId,
        studentId: childBId,
        providerId,
        vehicleId: vehicle2Id,
        routeId: route2Id,
        pickupStopName: 'CMC Michael',
        monthlyPrice: 3500,
        startDate: new Date(),
        status: 'ACTIVE',
      },
    });
    agreementBId = agreementB.id;

    // 11. Create Trips
    // Trip 1: Route 1, Vehicle 1, Driver 1 (Child A belongs here)
    const trip1 = await prisma.trip.create({
      data: {
        routeId: route1Id,
        vehicleId: vehicle1Id,
        driverId: driver1Id,
        tripType: 'MORNING',
        status: 'IN_PROGRESS',
        passengers: {
          create: [{ studentId: childAId, pickupStopName: 'Bole Brass Stop', status: 'SCHEDULED' }],
        },
      },
    });
    trip1Id = trip1.id;

    // Trip 2: Route 2, Vehicle 2, Driver 2 (Child B belongs here)
    const trip2 = await prisma.trip.create({
      data: {
        routeId: route2Id,
        vehicleId: vehicle2Id,
        driverId: driver2Id,
        tripType: 'MORNING',
        status: 'IN_PROGRESS',
        passengers: {
          create: [{ studentId: childBId, pickupStopName: 'CMC Michael', status: 'SCHEDULED' }],
        },
      },
    });
    trip2Id = trip2.id;
  });

  // =========================================================================
  // Test 1: Parent can generate a pass for their own child with an accepted booking
  // =========================================================================
  it('1. Parent can generate an active transport pass for their own child with an accepted booking', async () => {
    const res = await request(app)
      .get(`/api/transportation/agreements/${agreementAId}/pass`)
      .set('Authorization', `Bearer ${parentAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const pass = res.body.data;
    expect(pass.status).toBe('ACTIVE');
    expect(pass.passCode).toMatch(/^SSP-\d{4}-[A-F0-9]{6}$/);
    expect(pass.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(pass.qrToken).toMatch(/^ssp_live_[a-f0-9]{64}$/);
    expect(pass.student.firstName).toBe('Nahom');
    expect(pass.student.lastName).toBe('Alemu');
    expect(pass.branding.appName).toBe('SchoolSafe');

    validPassTokenA = pass.qrToken;
    passCodeA = pass.passCode;
  });

  // =========================================================================
  // Test 2: Parent cannot generate or view another parent's pass
  // =========================================================================
  it("2. Parent B cannot generate or view Parent A's child's transport pass", async () => {
    const res = await request(app)
      .get(`/api/transportation/agreements/${agreementAId}/pass`)
      .set('Authorization', `Bearer ${parentBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // =========================================================================
  // Test 3: The printed pass contains correct school and assigned vehicle information
  // =========================================================================
  it('3. Pass payload contains verified school, route, provider, and assigned vehicle plate number', async () => {
    const res = await request(app)
      .get(`/api/transportation/agreements/${agreementAId}/pass`)
      .set('Authorization', `Bearer ${parentAToken}`);

    expect(res.status).toBe(200);
    const pass = res.body.data;

    expect(pass.school.name).toBe('Bole Community School');
    expect(pass.school.branch).toBe('Main Campus');
    expect(pass.vehicle.plateNumber).toMatch(/^AA-/);
    expect(pass.vehicle.make).toBe('Toyota');
    expect(pass.provider.name).toContain('Selam');
    expect(pass.route.pickupStopName).toBe('Bole Brass Stop');
    expect(pass.route.pickupTimeMorning).toBeDefined();
  });

  // =========================================================================
  // Test 4: A valid scanner (assigned driver) can record boarding on the correct trip
  // =========================================================================
  it('4. Assigned driver can scan the student QR pass and record BOARDED event', async () => {
    const res = await request(app)
      .post(`/api/transportation/trips/${trip1Id}/scan-pass`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({
        qrToken: validPassTokenA,
        eventType: 'BOARDED',
        scannedStop: 'Bole Brass Stop',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.event.eventType).toBe('BOARDED');
    expect(res.body.data.student.firstName).toBe('Nahom');
    expect(res.body.data.passengerStatus).toBe('BOARDED');

    // Verify database record
    const event = await prisma.boardingEvent.findFirst({
      where: { tripId: trip1Id, studentId: childAId, eventType: 'BOARDED' },
    });
    expect(event).not.toBeNull();
  });

  // =========================================================================
  // Test 5: Driver assigned to another vehicle cannot scan student pass
  // =========================================================================
  it("5. Driver 2 assigned to another vehicle cannot scan Driver 1's student pass", async () => {
    // Attempt A: Driver 2 tries to scan student on Trip 1 (unauthorized trip for Driver 2)
    const unauthorizedTripRes = await request(app)
      .post(`/api/transportation/trips/${trip1Id}/scan-pass`)
      .set('Authorization', `Bearer ${driver2Token}`)
      .send({
        qrToken: validPassTokenA,
        eventType: 'BOARDED',
      });
    expect(unauthorizedTripRes.status).toBe(403);

    // Attempt B: Driver 2 tries to scan Student A on Driver 2's own Trip 2 (student does not belong to Trip 2)
    const wrongVehicleRes = await request(app)
      .post(`/api/transportation/trips/${trip2Id}/scan-pass`)
      .set('Authorization', `Bearer ${driver2Token}`)
      .send({
        qrToken: validPassTokenA,
        eventType: 'BOARDED',
      });
    expect(wrongVehicleRes.status).toBe(400);
    expect(wrongVehicleRes.body.message).toContain('not assigned to this vehicle or route');
  });

  // =========================================================================
  // Test 6: A cancelled booking cannot authorize boarding
  // =========================================================================
  it('6. A cancelled booking revokes the pass and rejects boarding authorization', async () => {
    // Create temporary child and cancelled agreement
    const tempChild = await prisma.student.create({
      data: {
        parentId: parentBId,
        firstName: 'Dagmawi',
        lastName: 'Bekele',
        schoolName: 'St Joseph School',
      },
    });

    const tempReq = await prisma.transportationRequest.create({
      data: {
        parentId: parentBId,
        studentId: tempChild.id,
        providerId,
        routeId: route2Id,
        pickupStopName: 'CMC Michael',
        preferredStartDate: new Date(),
        proposedPrice: 3500,
        currentPrice: 3500,
        status: 'ACCEPTED',
      },
    });

    const tempAgr = await prisma.transportationAgreement.create({
      data: {
        requestId: tempReq.id,
        parentId: parentBId,
        studentId: tempChild.id,
        providerId,
        vehicleId: vehicle2Id,
        routeId: route2Id,
        pickupStopName: 'CMC Michael',
        monthlyPrice: 3500,
        startDate: new Date(),
        status: 'ACTIVE',
      },
    });

    // Generate pass
    const passRes = await request(app)
      .get(`/api/transportation/agreements/${tempAgr.id}/pass`)
      .set('Authorization', `Bearer ${parentBToken}`);
    expect(passRes.status).toBe(200);
    const tempToken = passRes.body.data.qrToken;

    // Now cancel the agreement
    const cancelRes = await request(app)
      .post(`/api/transportation/agreements/${tempAgr.id}/cancel`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .send({ reason: 'Moving to different neighborhood' });
    expect(cancelRes.status).toBe(200);

    // Driver 2 attempts to scan the revoked pass on Trip 2
    const scanRes = await request(app)
      .post(`/api/transportation/trips/${trip2Id}/scan-pass`)
      .set('Authorization', `Bearer ${driver2Token}`)
      .send({
        qrToken: tempToken,
        eventType: 'BOARDED',
      });

    expect(scanRes.status).toBe(400);
    expect(scanRes.body.message).toContain('cannot authorize boarding');
  });

  // =========================================================================
  // Test 7: Invalid and forged QR tokens are rejected
  // =========================================================================
  it('7. Forged, altered, or random QR tokens are rejected (404)', async () => {
    const res = await request(app)
      .post(`/api/transportation/trips/${trip1Id}/scan-pass`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({
        qrToken: 'ssp_live_ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        eventType: 'BOARDED',
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Invalid or unrecognized student transport pass');
  });

  // =========================================================================
  // Test 8: Duplicate scans do not create conflicting events
  // =========================================================================
  it('8. Duplicate scans for the same event on the same trip are rejected (409 Conflict)', async () => {
    // Child A was already marked BOARDED in Test 4. Attempting to scan BOARDED again must fail.
    const res = await request(app)
      .post(`/api/transportation/trips/${trip1Id}/scan-pass`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({
        qrToken: validPassTokenA,
        eventType: 'BOARDED',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Duplicate scan rejected');
  });

  // =========================================================================
  // Test 9: A student can be scanned on a later legitimate trip
  // =========================================================================
  it('9. Pass is not permanently consumed; student can be scanned on a later afternoon trip', async () => {
    // Complete morning journey first: record ARRIVED_AT_SCHOOL on Trip 1
    const schoolRes = await request(app)
      .post(`/api/transportation/trips/${trip1Id}/scan-pass`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({
        qrToken: validPassTokenA,
        eventType: 'ARRIVED_AT_SCHOOL',
      });
    expect(schoolRes.status).toBe(200);
    expect(schoolRes.body.data.event.eventType).toBe('ARRIVED_AT_SCHOOL');

    // Create Afternoon Return Trip 3
    const trip3 = await prisma.trip.create({
      data: {
        routeId: route1Id,
        vehicleId: vehicle1Id,
        driverId: driver1Id,
        tripType: 'AFTERNOON',
        status: 'IN_PROGRESS',
        passengers: {
          create: [{ studentId: childAId, pickupStopName: 'Bole Brass Stop', status: 'SCHEDULED' }],
        },
      },
    });
    trip3Id = trip3.id;

    // Scan student for return journey on Trip 3 using the SAME printed QR pass
    const returnScanRes = await request(app)
      .post(`/api/transportation/trips/${trip3Id}/scan-pass`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({
        qrToken: validPassTokenA,
        eventType: 'BOARDED_FOR_RETURN',
      });

    expect(returnScanRes.status).toBe(200);
    expect(returnScanRes.body.data.event.eventType).toBe('BOARDED_FOR_RETURN');

    // Scan dropped off
    const dropoffRes = await request(app)
      .post(`/api/transportation/trips/${trip3Id}/scan-pass`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({
        qrToken: validPassTokenA,
        eventType: 'DROPPED_OFF',
      });

    expect(dropoffRes.status).toBe(200);
    expect(dropoffRes.body.data.event.eventType).toBe('DROPPED_OFF');
  });

  // =========================================================================
  // Test 10: Parent trip status updates after an event is recorded
  // =========================================================================
  it('10. Parent trip status endpoint reflects the latest safe transit event in real-time', async () => {
    const res = await request(app)
      .get(`/api/transportation/students/${childAId}/trip-status`)
      .set('Authorization', `Bearer ${parentAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hasActiveBooking).toBe(true);
    expect(res.body.data.statusLabel).toBe('Dropped Off');
    expect(res.body.data.latestEvent).toBeDefined();
    expect(res.body.data.latestEvent.eventType).toBe('DROPPED_OFF');
    expect(res.body.data.activeAgreement.vehiclePlate).toBeDefined();
  });

  // =========================================================================
  // Test 11: Private child information is not returned to unauthorized users
  // =========================================================================
  it("11. Private child status and pass details are protected against unauthorized users", async () => {
    // Parent B attempts to access Child A's trip status
    const unauthorizedParentRes = await request(app)
      .get(`/api/transportation/students/${childAId}/trip-status`)
      .set('Authorization', `Bearer ${parentBToken}`);
    expect(unauthorizedParentRes.status).toBe(403);

    // Unauthenticated user attempts to access Child A's trip status
    const unauthRes = await request(app).get(`/api/transportation/students/${childAId}/trip-status`);
    expect(unauthRes.status).toBe(401);

    // Scanning response returns only minimal display information
    const scanCheckRes = await request(app)
      .post(`/api/transportation/trips/${trip2Id}/scan-pass`)
      .set('Authorization', `Bearer ${driver2Token}`)
      .send({
        qrToken: (
          await request(app)
            .get(`/api/transportation/agreements/${agreementBId}/pass`)
            .set('Authorization', `Bearer ${parentBToken}`)
        ).body.data.qrToken,
        eventType: 'BOARDED',
      });

    expect(scanCheckRes.status).toBe(200);
    const scannerStudentData = scanCheckRes.body.data.student;

    // Must NOT contain sensitive PII like date of birth, emergency phone, parent home address, tokens, etc.
    expect(scannerStudentData.emergencyPhone).toBeUndefined();
    expect(scannerStudentData.homeAddress).toBeUndefined();
    expect(scannerStudentData.dateOfBirth).toBeUndefined();
    expect(scannerStudentData.passwordHash).toBeUndefined();
    expect(scannerStudentData.tokenHash).toBeUndefined();
  });
});
