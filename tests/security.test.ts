import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { hashPassword, generateAccessToken } from '../src/utils/security.util';

describe('Security, Authorization & Child Safety Integration Tests', () => {
  let superAdminToken: string;
  let superAdminId: string;

  let adminToken: string;
  let adminId: string;

  let providerToken: string;
  let providerId: string;

  let driverToken: string;
  let driverId: string;

  let parentToken: string;
  let parentId: string;

  let otherParentToken: string;
  let otherParentId: string;

  let studentId: string;
  let routeId: string;
  let vehicleId: string;
  let tripId: string;

  beforeAll(async () => {
    const ts = Date.now();
    const commonPasswordHash = await hashPassword('SecurePassword123!');

    // 1. Super Admin
    const superAdmin = await prisma.user.create({
      data: {
        email: `super_${ts}@schoolsafe.org`,
        passwordHash: commonPasswordHash,
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });
    superAdminId = superAdmin.id;
    superAdminToken = generateAccessToken({
      userId: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role,
      status: superAdmin.status,
    });

    // 2. Admin
    const admin = await prisma.user.create({
      data: {
        email: `admin_${ts}@schoolsafe.org`,
        passwordHash: commonPasswordHash,
        firstName: 'System',
        lastName: 'Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    adminId = admin.id;
    adminToken = generateAccessToken({
      userId: admin.id,
      email: admin.email,
      role: admin.role,
      status: admin.status,
    });

    // 3. Provider
    const provider = await prisma.user.create({
      data: {
        email: `prov_${ts}@schoolsafe.org`,
        passwordHash: commonPasswordHash,
        firstName: 'Provider',
        lastName: 'One',
        role: 'TRANSPORT_PROVIDER',
        status: 'ACTIVE',
      },
    });
    providerId = provider.id;
    providerToken = generateAccessToken({
      userId: provider.id,
      email: provider.email,
      role: provider.role,
      status: provider.status,
    });

    // 4. Driver
    const driver = await prisma.user.create({
      data: {
        email: `driver_${ts}@schoolsafe.org`,
        passwordHash: commonPasswordHash,
        firstName: 'Driver',
        lastName: 'One',
        role: 'DRIVER',
        status: 'ACTIVE',
      },
    });
    driverId = driver.id;
    driverToken = generateAccessToken({
      userId: driver.id,
      email: driver.email,
      role: driver.role,
      status: driver.status,
    });

    // 5. Parent & Child
    const parent = await prisma.user.create({
      data: {
        email: `parent_${ts}@schoolsafe.org`,
        passwordHash: commonPasswordHash,
        firstName: 'Parent',
        lastName: 'Alpha',
        role: 'PARENT',
        status: 'ACTIVE',
      },
    });
    parentId = parent.id;
    parentToken = generateAccessToken({
      userId: parent.id,
      email: parent.email,
      role: parent.role,
      status: parent.status,
    });

    const student = await prisma.student.create({
      data: {
        parentId: parent.id,
        firstName: 'Kid',
        lastName: 'Alpha',
        schoolName: 'Addis International Academy',
      },
    });
    studentId = student.id;

    // 6. Other Parent (Unrelated)
    const otherParent = await prisma.user.create({
      data: {
        email: `otherparent_${ts}@schoolsafe.org`,
        passwordHash: commonPasswordHash,
        firstName: 'Parent',
        lastName: 'Beta',
        role: 'PARENT',
        status: 'ACTIVE',
      },
    });
    otherParentId = otherParent.id;
    otherParentToken = generateAccessToken({
      userId: otherParent.id,
      email: otherParent.email,
      role: otherParent.role,
      status: otherParent.status,
    });

    // 7. Vehicle, Route, and Trip
    const vehicle = await prisma.vehicle.create({
      data: {
        providerId,
        plateNumber: `ET-${ts.toString().slice(-6)}`,
        make: 'Toyota',
        model: 'Coaster',
        capacity: 25,
      },
    });
    vehicleId = vehicle.id;

    const route = await prisma.route.create({
      data: {
        providerId,
        vehicleId: vehicle.id,
        name: 'Bole to Academy Express',
        origin: 'Bole Medhanealem',
        destinationSchool: 'Addis International Academy',
        capacity: 25,
        availableSeats: 24,
        monthlyPrice: 3500,
        status: 'ACTIVE',
      },
    });
    routeId = route.id;

    const trip = await prisma.trip.create({
      data: {
        routeId: route.id,
        driverId,
        vehicleId: vehicle.id,
        tripType: 'MORNING',
        status: 'SCHEDULED',
        scheduledDate: new Date(),
      },
    });
    tripId = trip.id;
  });

  afterAll(async () => {
    // Clean up created records
    await prisma.authorizedPickupPerson.deleteMany({ where: { studentId } });
    await prisma.boardingEvent.deleteMany({ where: { tripId } });
    await prisma.tripLocation.deleteMany({ where: { tripId } });
    await prisma.tripPassenger.deleteMany({ where: { tripId } });
    await prisma.trip.deleteMany({ where: { id: tripId } });
    await prisma.route.deleteMany({ where: { id: routeId } });
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
    await prisma.student.deleteMany({ where: { id: studentId } });
    await prisma.user.deleteMany({
      where: {
        id: { in: [superAdminId, adminId, providerId, driverId, parentId, otherParentId] },
      },
    });
    await prisma.$disconnect();
  });

  describe('1. Registration Security & Self-Promotion Prevention', () => {
    it('should strictly reject public registration of SUPER_ADMIN role (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: `super_hacker_${Date.now()}@schoolsafe.org`,
          password: 'Password123!',
          firstName: 'Bad',
          lastName: 'Actor',
          role: 'SUPER_ADMIN',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('SUPER_ADMIN');
    });
  });

  describe('2. Admin Hierarchy & Privilege Separation', () => {
    it('should prevent standard ADMIN from modifying or suspending a SUPER_ADMIN account (403)', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${superAdminId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('SUPER_ADMIN');
    });

    it('should allow SUPER_ADMIN to update an ADMIN account status (200)', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${adminId}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
    });
  });

  describe('3. Fayda OIDC Integrity & Replay Protection', () => {
    it('should reject Fayda callback with expired state (>15 minutes old)', async () => {
      const expiredTimestamp = Date.now() - (20 * 60 * 1000); // 20 mins ago
      const expiredState = Buffer.from(JSON.stringify({ userId: parentId, ts: expiredTimestamp })).toString('base64');

      const res = await request(app)
        .get(`/api/fayda/callback?code=mock_code_${Date.now()}&state=${expiredState}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('expired');
    });

    it('should reject duplicate callback when code is replayed', async () => {
      const code = `replay_test_code_${Date.now()}`;
      const validState = Buffer.from(JSON.stringify({ userId: parentId, ts: Date.now() })).toString('base64');

      // First invocation succeeds
      const firstRes = await request(app)
        .get(`/api/fayda/callback?code=${code}&state=${validState}`);
      expect(firstRes.status).toBe(200);

      // Replayed code must be rejected
      const replayRes = await request(app)
        .get(`/api/fayda/callback?code=${code}&state=${validState}`);
      expect(replayRes.status).toBe(400);
      expect(replayRes.body.message).toContain('already been consumed');
    });
  });

  describe('4. GPS Telemetry Ingestion & Authorization', () => {
    it('should reject GPS telemetry from unauthorized parent or random user (403)', async () => {
      const res = await request(app)
        .post(`/api/transportation/trips/${tripId}/location`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          latitude: 9.0123,
          longitude: 38.7456,
          speed: 40,
        });

      expect(res.status).toBe(403);
    });

    it('should reject GPS telemetry when trip status is SCHEDULED (400)', async () => {
      const res = await request(app)
        .post(`/api/transportation/trips/${tripId}/location`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          latitude: 9.0123,
          longitude: 38.7456,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('must be IN_PROGRESS');
    });

    it('should reject invalid out-of-bounds GPS coordinates (400)', async () => {
      const res = await request(app)
        .post(`/api/transportation/trips/${tripId}/location`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          latitude: 95.0, // Invalid latitude (> 90)
          longitude: 38.7456,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid GPS coordinates');
    });

    it('should allow assigned driver to record GPS when trip is IN_PROGRESS (201)', async () => {
      // Transition trip to IN_PROGRESS
      await prisma.trip.update({
        where: { id: tripId },
        data: { status: 'IN_PROGRESS', startTime: new Date() },
      });

      const res = await request(app)
        .post(`/api/transportation/trips/${tripId}/location`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          latitude: 9.0123,
          longitude: 38.7456,
          speed: 35,
          heading: 180,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.latitude).toBe(9.0123);
    });

    it('should prevent unenrolled parent from tracking a trip they have no child on (403)', async () => {
      const res = await request(app)
        .get(`/api/transportation/trips/${tripId}/location`)
        .set('Authorization', `Bearer ${otherParentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access denied');
    });
  });

  describe('5. Child Safety, Boarding & Authorized Pickups', () => {
    it('should reject boarding event from an unauthorized parent or random user (403)', async () => {
      const res = await request(app)
        .post(`/api/transportation/trips/${tripId}/boarding`)
        .set('Authorization', `Bearer ${otherParentToken}`)
        .send({
          studentId,
          eventType: 'BOARDED',
        });

      expect(res.status).toBe(403);
    });

    it('should allow assigned driver to record boarding event (201)', async () => {
      const res = await request(app)
        .post(`/api/transportation/trips/${tripId}/boarding`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          studentId,
          eventType: 'BOARDED',
          scannedStop: 'Bole Medhanealem Stop',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should reject unauthorized user from accessing another child authorized pickups (403)', async () => {
      const res = await request(app)
        .get(`/api/transportation/students/${studentId}/authorized-pickups`)
        .set('Authorization', `Bearer ${otherParentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access denied');
    });

    it('should allow the student own parent to view authorized pickups (200)', async () => {
      const res = await request(app)
        .get(`/api/transportation/students/${studentId}/authorized-pickups`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
