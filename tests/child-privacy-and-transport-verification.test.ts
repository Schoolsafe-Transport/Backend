/**
 * Task 9: Child Privacy & Transport Provider Verification Integration Tests
 *
 * Verifies:
 *   1. Parent A sees only their own children
 *   2. Parent A cannot access Parent B's children (GET /students/:id -> 403)
 *   3. Parent A cannot modify or delete Parent B's children (PATCH/DELETE /students/:id -> 403)
 *   4. Changing a child ID in requests does not bypass authorization (POST /requests -> 403)
 *   5. Transport providers cannot access unauthorized children's records (403)
 *   6. Drivers cannot access passenger information for unauthorized trips (403)
 *   7. Unapproved providers and ineligible vehicles are excluded from transportation search
 *   8. Empty child list handling
 *   9. Empty provider search handling
 */

import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';

describe('Task 9: Child Privacy & Transport Provider Verification', () => {
  jest.setTimeout(30000);

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

  let routeId: string;
  let trip1Id: string;

  beforeAll(async () => {
    // 1. Create Parent A
    const pARes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `parent_a_${ts}@schoolsafe.org`,
        password: 'Password123!',
        firstName: 'ParentA',
        lastName: 'Guardian',
        role: 'PARENT',
      });
    parentAToken = pARes.body.data.tokens.accessToken;
    parentAId = pARes.body.data.user.id;

    // 2. Create Parent B
    const pBRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `parent_b_${ts}@schoolsafe.org`,
        password: 'Password123!',
        firstName: 'ParentB',
        lastName: 'Guardian',
        role: 'PARENT',
      });
    parentBToken = pBRes.body.data.tokens.accessToken;
    parentBId = pBRes.body.data.user.id;

    // Verify emails and Fayda identity in database
    await prisma.user.updateMany({
      where: { id: { in: [parentAId, parentBId] } },
      data: { isEmailVerified: true, isVerified: true },
    });

    // 3. Create Transport Provider
    const provRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `provider_t9_${ts}@schoolsafe.org`,
        password: 'Password123!',
        firstName: 'Abebe',
        lastName: 'Transport',
        role: 'TRANSPORT_PROVIDER',
      });
    providerToken = provRes.body.data.tokens.accessToken;
    providerId = provRes.body.data.user.id;

    // 4. Create Driver 1 (assigned driver)
    const d1Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `driver1_t9_${ts}@schoolsafe.org`,
        password: 'Password123!',
        firstName: 'Dawit',
        lastName: 'DriverOne',
        role: 'DRIVER',
      });
    driver1Token = d1Res.body.data.tokens.accessToken;
    driver1Id = d1Res.body.data.user.id;

    // 5. Create Driver 2 (unauthorized driver)
    const d2Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `driver2_t9_${ts}@schoolsafe.org`,
        password: 'Password123!',
        firstName: 'Kebede',
        lastName: 'DriverTwo',
        role: 'DRIVER',
      });
    driver2Token = d2Res.body.data.tokens.accessToken;
    driver2Id = d2Res.body.data.user.id;

    await prisma.user.updateMany({
      where: { id: { in: [providerId, driver1Id, driver2Id] } },
      data: { isEmailVerified: true, status: 'ACTIVE', isVerified: true },
    });

    // 6. Create a Vehicle and an Active Route for Provider
    const vehicle = await prisma.vehicle.create({
      data: {
        providerId,
        make: 'Toyota',
        model: 'HiAce Commuter',
        plateNumber: `PLATE-${ts.toString().slice(-6)}`,
        capacity: 14,
        isVerified: true,
        status: 'ACTIVE',
      },
    });

    const route = await prisma.route.create({
      data: {
        providerId,
        vehicleId: vehicle.id,
        name: `Route Bole-Cam-${ts}`,
        origin: 'Bole Medhanealem',
        destinationSchool: 'Cambridge Academy',
        capacity: 14,
        availableSeats: 10,
        monthlyPrice: 2500,
        isAcceptingPassengers: true,
        status: 'ACTIVE',
      },
    });
    routeId = route.id;

    // 7. Register Child A for Parent A
    const childARes = await request(app)
      .post('/api/transportation/students')
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({
        firstName: 'Maya',
        lastName: 'ParentA',
        schoolName: 'Cambridge Academy',
        grade: 'Grade 5',
      });
    childAId = childARes.body.data.id;

    // 8. Register Child B for Parent B
    const childBRes = await request(app)
      .post('/api/transportation/students')
      .set('Authorization', `Bearer ${parentBToken}`)
      .send({
        firstName: 'Noah',
        lastName: 'ParentB',
        schoolName: 'Cambridge Academy',
        grade: 'Grade 2',
      });
    childBId = childBRes.body.data.id;

    // 9. Create Trip 1 assigned to Driver 1 with Child A as passenger
    const trip = await prisma.trip.create({
      data: {
        routeId: route.id,
        driverId: driver1Id,
        vehicleId: vehicle.id,
        tripType: 'MORNING_PICKUP',
        status: 'IN_PROGRESS',
        scheduledDate: new Date(),
      },
    });
    trip1Id = trip.id;

    await prisma.tripPassenger.create({
      data: {
        tripId: trip.id,
        studentId: childAId,
        status: 'BOARDED',
      },
    });
  });

  // =========================================================================
  // Test 1: Parent A sees their own children
  // =========================================================================
  it('1. Parent A sees only their own children on GET /students', async () => {
    const res = await request(app)
      .get('/api/transportation/students')
      .set('Authorization', `Bearer ${parentAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(childAId);
    expect(ids).not.toContain(childBId);
  });

  // =========================================================================
  // Test 2: Parent A cannot access Parent B's children
  // =========================================================================
  it('2. Parent A cannot access Parent B child by ID (403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/transportation/students/${childBId}`)
      .set('Authorization', `Bearer ${parentAToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message.toLowerCase()).toContain('forbidden');
  });

  // =========================================================================
  // Test 3: Parent A cannot modify or delete Parent B's children
  // =========================================================================
  it('3a. Parent A cannot modify Parent B child (403 Forbidden)', async () => {
    const res = await request(app)
      .patch(`/api/transportation/students/${childBId}`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({ firstName: 'HackedName' });

    expect(res.status).toBe(403);

    // Verify record was untouched in database
    const childB = await prisma.student.findUnique({ where: { id: childBId } });
    expect(childB?.firstName).toBe('Noah');
  });

  it('3b. Parent A cannot delete Parent B child (403 Forbidden)', async () => {
    const res = await request(app)
      .delete(`/api/transportation/students/${childBId}`)
      .set('Authorization', `Bearer ${parentAToken}`);

    expect(res.status).toBe(403);

    // Verify record still exists
    const childB = await prisma.student.findUnique({ where: { id: childBId } });
    expect(childB).not.toBeNull();
  });

  // =========================================================================
  // Test 4: Changing child ID in transportation request does not bypass authorization
  // =========================================================================
  it('4. Parent A cannot create transportation request using Parent B child ID (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/transportation/requests')
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({
        studentId: childBId, // attempting to use Parent B's child
        routeId,
        pickupStopName: 'Bole Medhanealem',
        preferredStartDate: '2026-11-01',
      });

    expect(res.status).toBe(403);
    expect(res.body.message.toLowerCase()).toContain('own child');
  });

  // =========================================================================
  // Test 5: Transport providers cannot access unauthorized children's records
  // =========================================================================
  it('5. Transport provider cannot access /students or individual child records (403 Forbidden)', async () => {
    const resList = await request(app)
      .get('/api/transportation/students')
      .set('Authorization', `Bearer ${providerToken}`);

    expect(resList.status).toBe(403);

    const resSingle = await request(app)
      .get(`/api/transportation/students/${childAId}`)
      .set('Authorization', `Bearer ${providerToken}`);

    expect(resSingle.status).toBe(403);
  });

  // =========================================================================
  // Test 6: Drivers cannot access passenger information for unauthorized trips
  // =========================================================================
  it('6a. Assigned Driver 1 can access passenger info for Trip 1', async () => {
    const res = await request(app)
      .get(`/api/transportation/trips/${trip1Id}/passengers`)
      .set('Authorization', `Bearer ${driver1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].studentId).toBe(childAId);
  });

  it('6b. Unassigned Driver 2 CANNOT access passenger info for Trip 1 (403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/transportation/trips/${trip1Id}/passengers`)
      .set('Authorization', `Bearer ${driver2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.message.toLowerCase()).toContain('access denied');
  });

  // =========================================================================
  // Test 7: Unapproved providers and ineligible vehicles are excluded from search
  // =========================================================================
  it('7a. Transportation search returns active route for approved provider & active vehicle', async () => {
    const res = await request(app)
      .get(`/api/transportation/search?school=Cambridge`)
      .set('Authorization', `Bearer ${parentAToken}`);

    expect(res.status).toBe(200);
    const routeIds = res.body.data.map((r: any) => r.routeId);
    expect(routeIds).toContain(routeId);
  });

  it('7b. Transportation search excludes routes of PENDING or REJECTED providers', async () => {
    // Create an unapproved provider with a route
    const pendingProv = await prisma.user.create({
      data: {
        email: `pending_prov_${ts}@schoolsafe.org`,
        firstName: 'Pending',
        lastName: 'Provider',
        passwordHash: 'hashed',
        role: 'TRANSPORT_PROVIDER',
        status: 'PENDING', // NOT ACTIVE
      },
    });

    const unappVeh = await prisma.vehicle.create({
      data: {
        providerId: pendingProv.id,
        make: 'Isuzu',
        model: 'Minibus',
        plateNumber: `UNAPP-${ts.toString().slice(-5)}`,
        capacity: 12,
        status: 'ACTIVE',
      },
    });

    const pendingRoute = await prisma.route.create({
      data: {
        providerId: pendingProv.id,
        vehicleId: unappVeh.id,
        name: `Pending Prov Route ${ts}`,
        origin: 'Kazanchis',
        destinationSchool: 'Cambridge Academy',
        capacity: 12,
        availableSeats: 6,
        monthlyPrice: 2000,
        status: 'ACTIVE',
      },
    });

    const res = await request(app)
      .get(`/api/transportation/search?school=Cambridge`)
      .set('Authorization', `Bearer ${parentAToken}`);

    expect(res.status).toBe(200);
    const routeIds = res.body.data.map((r: any) => r.routeId);
    expect(routeIds).not.toContain(pendingRoute.id);
  });

  it('7c. Transportation search excludes routes with vehicles in MAINTENANCE status', async () => {
    // Create a route whose vehicle is in MAINTENANCE
    const maintVeh = await prisma.vehicle.create({
      data: {
        providerId,
        make: 'Nissan',
        model: 'Urvan',
        plateNumber: `MAINT-${ts.toString().slice(-5)}`,
        capacity: 12,
        status: 'MAINTENANCE', // Ineligible
      },
    });

    const maintRoute = await prisma.route.create({
      data: {
        providerId,
        vehicleId: maintVeh.id,
        name: `Maint Vehicle Route ${ts}`,
        origin: 'Bole',
        destinationSchool: 'Cambridge Academy',
        capacity: 12,
        availableSeats: 5,
        monthlyPrice: 2100,
        status: 'ACTIVE',
      },
    });

    const res = await request(app)
      .get(`/api/transportation/search?school=Cambridge`)
      .set('Authorization', `Bearer ${parentAToken}`);

    expect(res.status).toBe(200);
    const routeIds = res.body.data.map((r: any) => r.routeId);
    expect(routeIds).not.toContain(maintRoute.id);
  });

  // =========================================================================
  // Test 8: Empty child list displays the registration prompt
  // =========================================================================
  it('8. A new parent with no children receives empty array (triggers registration prompt in UI)', async () => {
    const newParentRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `new_empty_parent_${ts}@schoolsafe.org`,
        password: 'Password123!',
        firstName: 'Empty',
        lastName: 'Parent',
        role: 'PARENT',
      });
    const newParentToken = newParentRes.body.data.tokens.accessToken;

    const res = await request(app)
      .get('/api/transportation/students')
      .set('Authorization', `Bearer ${newParentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  // =========================================================================
  // Test 9: Empty provider search returns empty array for fallback prompt
  // =========================================================================
  it('9. Search with no matching eligible providers returns empty array (triggers No Verified Transport Providers UI)', async () => {
    const res = await request(app)
      .get(`/api/transportation/search?school=NonExistentSchoolXYZ123`)
      .set('Authorization', `Bearer ${parentAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });
});
