import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';

jest.setTimeout(30000);

describe('Transportation Marketplace Test Suite', () => {
  // Test Actor Credentials
  let parentToken: string;
  let parentId: string;

  let otherParentToken: string;
  let otherParentId: string;

  let providerToken: string;
  let providerId: string;

  let otherProviderToken: string;
  let otherProviderId: string;

  let businessToken: string;

  // Created IDs for testing flow
  let studentId: string;
  let otherStudentId: string;
  let vehicleId: string;
  let routeId: string;
  let stopId: string;

  beforeAll(async () => {
    const timestamp = Date.now();

    // 1. Create Primary Parent
    const parentRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `parent_${timestamp}@test.com`,
        password: 'Password123!',
        firstName: 'Abebe',
        lastName: 'Kebede',
        role: 'PARENT',
      });
    parentToken = parentRes.body.data.tokens.accessToken;
    parentId = parentRes.body.data.user.id;

    // 2. Create Other Parent
    const otherParentRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `otherparent_${timestamp}@test.com`,
        password: 'Password123!',
        firstName: 'Marta',
        lastName: 'Hailu',
        role: 'PARENT',
      });
    otherParentToken = otherParentRes.body.data.tokens.accessToken;
    otherParentId = otherParentRes.body.data.user.id;

    // 3. Create Transport Provider
    const providerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `provider_${timestamp}@test.com`,
        password: 'Password123!',
        firstName: 'Dawit',
        lastName: 'Tadesse',
        role: 'TRANSPORT_PROVIDER',
      });
    providerToken = providerRes.body.data.tokens.accessToken;
    providerId = providerRes.body.data.user.id;

    // Mark Provider as Verified and ACTIVE in DB
    await prisma.user.update({
      where: { id: providerId },
      data: { isVerified: true, status: 'ACTIVE', isEmailVerified: true },
    });

    // 4. Create Other Provider
    const otherProviderRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `otherprovider_${timestamp}@test.com`,
        password: 'Password123!',
        firstName: 'Yohannes',
        lastName: 'Berhe',
        role: 'TRANSPORT_PROVIDER',
      });
    otherProviderToken = otherProviderRes.body.data.tokens.accessToken;
    otherProviderId = otherProviderRes.body.data.user.id;

    await prisma.user.update({
      where: { id: otherProviderId },
      data: { isVerified: true, status: 'ACTIVE', isEmailVerified: true },
    });

    // 5. Create Business User
    const businessRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `business_${timestamp}@test.com`,
        password: 'Password123!',
        firstName: 'Sponsor',
        lastName: 'Corp',
        role: 'BUSINESS',
      });
    businessToken = businessRes.body.data.tokens.accessToken;

    // 6. Create Student for Primary Parent
    const student = await prisma.student.create({
      data: {
        parentId,
        firstName: 'Hana',
        lastName: 'Kebede',
        schoolName: 'Cambridge Academy',
        schoolBranch: 'Main Campus',
        grade: 'Grade 4',
      },
    });
    studentId = student.id;

    // 7. Create Student for Other Parent
    const otherStudent = await prisma.student.create({
      data: {
        parentId: otherParentId,
        firstName: 'Samuel',
        lastName: 'Hailu',
        schoolName: 'Cambridge Academy',
        schoolBranch: 'Main Campus',
        grade: 'Grade 2',
      },
    });
    otherStudentId = otherStudent.id;

    // 8. Create Vehicle for Provider
    const vehicle = await prisma.vehicle.create({
      data: {
        providerId,
        make: 'Toyota',
        model: 'HiAce',
        plateNumber: `3-A${Math.floor(10000 + Math.random() * 90000)}`,
        capacity: 12,
        isVerified: true,
        status: 'ACTIVE',
      },
    });
    vehicleId = vehicle.id;

    // 9. Create Route for Provider (Capacity: 12, Available: 3)
    const route = await prisma.route.create({
      data: {
        providerId,
        vehicleId,
        name: 'Mekelle - Ayder - Cambridge Academy',
        origin: 'Ayder',
        destinationSchool: 'Cambridge Academy',
        schoolBranch: 'Main Campus',
        departureTimeMorning: '07:15 AM',
        departureTimeAfternoon: '03:30 PM',
        serviceType: 'BOTH',
        capacity: 12,
        availableSeats: 3,
        monthlyPrice: 3500,
        isAcceptingPassengers: true,
        status: 'ACTIVE',
        averageRating: 4.9,
        completedTrips: 142,
      },
    });
    routeId = route.id;

    // 10. Create Stops
    const stop = await prisma.routeStop.create({
      data: {
        routeId,
        name: 'Ayder Hospital Gate',
        pickupTimeMorning: '07:15 AM',
        dropoffTimeAfternoon: '03:45 PM',
        orderIndex: 1,
      },
    });
    stopId = stop.id;
  });

  describe('1. Transportation Discovery & Search', () => {
    it('should allow parent to search transportation and find active routes', async () => {
      const res = await request(app)
        .get('/api/transportation/search')
        .set('Authorization', `Bearer ${parentToken}`)
        .query({ school: 'Cambridge Academy' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const listing = res.body.data.find((r: any) => r.routeId === routeId);
      expect(listing).toBeDefined();
      expect(listing.monthlyPrice).toBe(3500);
      expect(listing.availableSeats).toBe(3);
      expect(listing.provider.name).toBe('Dawit Tadesse');
      expect(listing.vehicle.model).toBe('Toyota HiAce');
    });

    it('should filter correctly by pickup area', async () => {
      const res = await request(app)
        .get('/api/transportation/search')
        .set('Authorization', `Bearer ${parentToken}`)
        .query({ pickupArea: 'Ayder' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter correctly by price range', async () => {
      const res = await request(app)
        .get('/api/transportation/search')
        .set('Authorization', `Bearer ${parentToken}`)
        .query({ minPrice: 3000, maxPrice: 4000 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty list when price filter exceeds route price', async () => {
      const res = await request(app)
        .get('/api/transportation/search')
        .set('Authorization', `Bearer ${parentToken}`)
        .query({ minPrice: 5000 });

      expect(res.status).toBe(200);
      const match = res.body.data.find((r: any) => r.routeId === routeId);
      expect(match).toBeUndefined();
    });

    it('should filter correctly by school branch', async () => {
      const res = await request(app)
        .get('/api/transportation/search')
        .set('Authorization', `Bearer ${parentToken}`)
        .query({ school: 'Cambridge Academy', schoolBranch: 'Main Campus' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const match = res.body.data.find((r: any) => r.routeId === routeId);
      expect(match).toBeDefined();
      expect(match.schoolBranch).toBe('Main Campus');
    });

    it('should return empty list when school branch does not match', async () => {
      const res = await request(app)
        .get('/api/transportation/search')
        .set('Authorization', `Bearer ${parentToken}`)
        .query({ school: 'Cambridge Academy', schoolBranch: 'NonExistent Branch' });

      expect(res.status).toBe(200);
      const match = res.body.data.find((r: any) => r.routeId === routeId);
      expect(match).toBeUndefined();
    });

    it('should filter correctly by vehicle type', async () => {
      const res = await request(app)
        .get('/api/transportation/search')
        .set('Authorization', `Bearer ${parentToken}`)
        .query({ vehicleType: 'HiAce' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const match = res.body.data.find((r: any) => r.routeId === routeId);
      expect(match).toBeDefined();
    });

    it('should filter correctly by verified provider status', async () => {
      const res = await request(app)
        .get('/api/transportation/search')
        .set('Authorization', `Bearer ${parentToken}`)
        .query({ verified: 'true' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      res.body.data.forEach((r: any) => {
        expect(r.provider.isVerified).toBe(true);
      });
    });

    it('should retrieve detailed route profile', async () => {
      const res = await request(app)
        .get(`/api/transportation/routes/${routeId}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.route.name).toBe('Mekelle - Ayder - Cambridge Academy');
      expect(res.body.data.vehicle.plateNumber).toBeDefined();
      expect(res.body.data.provider.name).toBe('Dawit Tadesse');
    });
  });

  describe('2. Transportation Requests & Security', () => {
    it('should reject request when parent has not completed Fayda identity verification', async () => {
      const res = await request(app)
        .post('/api/transportation/requests')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId,
          routeId,
          pickupStopId: stopId,
          pickupStopName: 'Ayder Hospital Gate',
          preferredStartDate: '2026-11-01',
          proposedPrice: 3200,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Identity verification required');
    });

    it('should reject request when parent attempts to request for another parent child after verification', async () => {
      // Mark parents as verified to unlock request capabilities
      await prisma.user.update({
        where: { id: parentId },
        data: { isVerified: true, isEmailVerified: true },
      });
      await prisma.user.update({
        where: { id: otherParentId },
        data: { isVerified: true, isEmailVerified: true },
      });

      const res = await request(app)
        .post('/api/transportation/requests')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId: otherStudentId, // Belongs to otherParent
          routeId,
          pickupStopId: stopId,
          pickupStopName: 'Ayder Hospital Gate',
          preferredStartDate: '2026-11-01',
          proposedPrice: 3200,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('only request transportation for your own child');
    });

    it('should reject request if route is stale or has 0 available seats', async () => {
      // Temporarily mark route availableSeats = 0
      await prisma.route.update({
        where: { id: routeId },
        data: { availableSeats: 0 },
      });

      const res = await request(app)
        .post('/api/transportation/requests')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId,
          routeId,
          pickupStopId: stopId,
          pickupStopName: 'Ayder Hospital Gate',
          preferredStartDate: '2026-11-01',
          proposedPrice: 3200,
        });

      // Restore seats
      await prisma.route.update({
        where: { id: routeId },
        data: { availableSeats: 3 },
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('no available seats');
    });

    it('should allow verified parent to submit a seat request for own child without reducing available seats', async () => {
      const beforeRoute = await prisma.route.findUnique({ where: { id: routeId } });
      expect(beforeRoute?.availableSeats).toBe(3);

      const res = await request(app)
        .post('/api/transportation/requests')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId,
          routeId,
          pickupStopId: stopId,
          pickupStopName: 'Ayder Hospital Gate',
          preferredStartDate: '2026-11-01',
          proposedPrice: 3200,
          message: 'Hana needs pickup at 7:15 AM sharp',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.currentPrice).toBe(3200);
      expect(res.body.data.offers.length).toBe(1);
      expect(res.body.data.offers[0].status).toBe('PENDING');

      // CRITICAL REQUIREMENT: A pending request MUST NOT reduce available seats!
      const afterRoute = await prisma.route.findUnique({ where: { id: routeId } });
      expect(afterRoute?.availableSeats).toBe(3);
    });
  });

  describe('3. Price Negotiation & History', () => {
    let requestId: string;

    beforeAll(async () => {
      const requests = await prisma.transportationRequest.findMany({
        where: { parentId, routeId },
      });
      requestId = requests[0].id;
    });

    it('should allow provider to review request and submit counter-offer', async () => {
      const res = await request(app)
        .post(`/api/transportation/requests/${requestId}/counter`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          amount: 3300,
          message: 'Can do ETB 3,300 with morning and afternoon service',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('NEGOTIATING');
      expect(res.body.data.currentPrice).toBe(3300);

      // Offer history must have 2 records: initial offer (COUNTERED) and new offer (PENDING)
      expect(res.body.data.offers.length).toBe(2);
      expect(res.body.data.offers[0].amount).toBe(3200);
      expect(res.body.data.offers[0].status).toBe('COUNTERED');
      expect(res.body.data.offers[1].amount).toBe(3300);
      expect(res.body.data.offers[1].status).toBe('PENDING');
    });

    it('should allow parent to accept provider counter-offer', async () => {
      const res = await request(app)
        .post(`/api/transportation/requests/${requestId}/accept-offer`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.currentPrice).toBe(3300);

      const latestOffer = res.body.data.offers[res.body.data.offers.length - 1];
      expect(latestOffer.status).toBe('ACCEPTED');
    });

    it('should forbid non-participating provider from submitting counter-offer', async () => {
      const res = await request(app)
        .post(`/api/transportation/requests/${requestId}/counter`)
        .set('Authorization', `Bearer ${otherProviderToken}`)
        .send({ amount: 3000 });

      expect(res.status).toBe(403);
    });
  });

  describe('4. Seat Reservation & Agreement Creation', () => {
    let requestId: string;

    beforeAll(async () => {
      const reqRecord = await prisma.transportationRequest.findFirst({
        where: { parentId, routeId },
      });
      requestId = reqRecord!.id;
    });

    it('should allow provider to accept request, decrementing seats and creating agreement', async () => {
      const beforeRoute = await prisma.route.findUnique({ where: { id: routeId } });
      const seatsBefore = beforeRoute!.availableSeats;

      const res = await request(app)
        .post(`/api/transportation/requests/${requestId}/accept`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // 1. Request updated to ACCEPTED
      expect(res.body.data.request.status).toBe('ACCEPTED');

      // 2. Agreement created
      expect(res.body.data.agreement).toBeDefined();
      expect(res.body.data.agreement.status).toBe('ACTIVE');
      expect(res.body.data.agreement.monthlyPrice).toBe(3300); // Locked permanent price

      // 3. Payment record created with PENDING status
      expect(res.body.data.payment).toBeDefined();
      expect(res.body.data.payment.status).toBe('PENDING');
      expect(res.body.data.payment.amount).toBe(3300);

      // 4. Exactly 1 seat decremented in database
      const afterRoute = await prisma.route.findUnique({ where: { id: routeId } });
      expect(afterRoute!.availableSeats).toBe(seatsBefore - 1);
    });
  });

  describe('5. Concurrency Control & Race Condition Protection', () => {
    let raceRouteId: string;
    let reqAId: string;
    let reqBId: string;

    beforeAll(async () => {
      // Create a test route with EXACTLY 1 available seat
      const raceRoute = await prisma.route.create({
        data: {
          providerId,
          vehicleId,
          name: 'Race Route Bole - British International',
          origin: 'Bole',
          destinationSchool: 'British International',
          capacity: 10,
          availableSeats: 1, // Only 1 seat left!
          monthlyPrice: 4000,
          isAcceptingPassengers: true,
          status: 'ACTIVE',
        },
      });
      raceRouteId = raceRoute.id;

      // Create Student A & Student B
      const studentA = await prisma.student.create({
        data: { parentId, firstName: 'ChildA', lastName: 'Test', schoolName: 'British International' },
      });
      const studentB = await prisma.student.create({
        data: { parentId: otherParentId, firstName: 'ChildB', lastName: 'Test', schoolName: 'British International' },
      });

      // Submit Request A & Request B
      const reqA = await prisma.transportationRequest.create({
        data: {
          parentId,
          studentId: studentA.id,
          providerId,
          routeId: raceRouteId,
          pickupStopName: 'Bole Medhanialem',
          preferredStartDate: new Date(),
          proposedPrice: 4000,
          currentPrice: 4000,
          status: 'PENDING',
        },
      });
      reqAId = reqA.id;

      const reqB = await prisma.transportationRequest.create({
        data: {
          parentId: otherParentId,
          studentId: studentB.id,
          providerId,
          routeId: raceRouteId,
          pickupStopName: 'Bole Brass',
          preferredStartDate: new Date(),
          proposedPrice: 4000,
          currentPrice: 4000,
          status: 'PENDING',
        },
      });
      reqBId = reqB.id;
    });

    it('should safely handle 2 concurrent acceptances: 1 succeeds (200) and 1 receives 409 Conflict', async () => {
      // Execute 2 simultaneous acceptance attempts
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/transportation/requests/${reqAId}/accept`)
          .set('Authorization', `Bearer ${providerToken}`)
          .send(),
        request(app)
          .post(`/api/transportation/requests/${reqBId}/accept`)
          .set('Authorization', `Bearer ${providerToken}`)
          .send(),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Verify the 409 response has the specified message
      const conflictRes = res1.status === 409 ? res1 : res2;
      expect(conflictRes.body.message).toContain('Sorry, this transportation option is no longer available');

      // Verify availableSeats in DB is exactly 0 (not negative!)
      const routeCheck = await prisma.route.findUnique({ where: { id: raceRouteId } });
      expect(routeCheck!.availableSeats).toBe(0);
    });
  });

  describe('6. Agreement Cancellation & Seat Release', () => {
    it('should cancel agreement, release the seat, and never exceed capacity', async () => {
      const agreement = await prisma.transportationAgreement.findFirst({
        where: { parentId, status: 'ACTIVE' },
        include: { route: true },
      });

      expect(agreement).toBeDefined();
      const seatsBefore = agreement!.route.availableSeats;

      const res = await request(app)
        .post(`/api/transportation/agreements/${agreement!.id}/cancel`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ reason: 'Relocating to another district' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');

      // Seat should be safely incremented by 1
      const routeAfter = await prisma.route.findUnique({ where: { id: agreement!.routeId } });
      expect(routeAfter!.availableSeats).toBe(seatsBefore + 1);
      expect(routeAfter!.availableSeats).toBeLessThanOrEqual(routeAfter!.capacity);
    });
  });

  describe('7. Payment Simulation', () => {
    it('should simulate payment transition from PENDING to PAID', async () => {
      // Create student and request specifically for payment flow verification
      const payChild = await prisma.student.create({
        data: {
          parentId,
          firstName: 'PaymentChild',
          lastName: 'Kebede',
          schoolName: 'Cambridge Academy',
        },
      });

      const payReq = await prisma.transportationRequest.create({
        data: {
          parentId,
          studentId: payChild.id,
          providerId,
          routeId,
          pickupStopName: 'Ayder Hospital Gate',
          preferredStartDate: new Date(),
          proposedPrice: 3300,
          currentPrice: 3300,
          status: 'PENDING',
        },
      });

      const acceptRes = await request(app)
        .post(`/api/transportation/requests/${payReq.id}/accept`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send();

      const targetAgreement = acceptRes.body.data.agreement;

      const res = await request(app)
        .post(`/api/transportation/agreements/${targetAgreement.id}/pay`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ paymentMethod: 'TELEBIRR_SIMULATED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PAID');
      expect(res.body.data.paidAt).toBeDefined();
      expect(res.body.data.paymentMethod).toBe('TELEBIRR_SIMULATED');
    });
  });

  describe('8. Role-Based Access Control Boundaries', () => {
    it('should forbid BUSINESS role from accessing marketplace search', async () => {
      const res = await request(app)
        .get('/api/transportation/search')
        .set('Authorization', `Bearer ${businessToken}`);

      expect(res.status).toBe(403);
    });

    it('should forbid PARENT from accessing provider passengers manifest', async () => {
      const res = await request(app)
        .get('/api/transportation/passengers')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow provider to view their active passengers', async () => {
      const res = await request(app)
        .get('/api/transportation/passengers')
        .set('Authorization', `Bearer ${providerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
