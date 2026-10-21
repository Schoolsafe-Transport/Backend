import request from 'supertest';
import crypto from 'crypto';
import app from '../src/app';
import { prisma } from '../src/config/prisma';

describe('Phase 7: Email Verification & Role-Based Administrator Approval Integration Tests', () => {
  jest.setTimeout(30000);
  const timestamp = Date.now();
  const testParentEmail = `parent_phase7_${timestamp}@schoolsafe.org`;
  const testProviderEmail = `provider_phase7_${timestamp}@schoolsafe.org`;
  const testDriverEmail = `driver_phase7_${timestamp}@schoolsafe.org`;
  const testBizEmail = `biz_phase7_${timestamp}@schoolsafe.org`;
  const testAdminEmail = `admin_phase7_${timestamp}@schoolsafe.org`;

  let parentUserId: string;
  let parentToken: string;
  let parentRawVerificationToken: string;

  let providerUserId: string;
  let providerToken: string;
  let providerRawVerificationToken: string;

  let driverUserId: string;
  let driverToken: string;

  let bizUserId: string;
  let bizToken: string;

  let adminToken: string;
  let adminUserId: string;

  let testVehicleId: string;
  let testRouteId: string;
  let testTripId: string;

  beforeAll(async () => {
    // 1. Register Parent
    const parentRes = await request(app).post('/api/auth/register').send({
      email: testParentEmail,
      password: 'ParentSecure123!',
      firstName: 'Alem',
      lastName: 'Tesfaye',
      role: 'PARENT',
    });
    parentUserId = parentRes.body.data.user.id;
    parentToken = parentRes.body.data.tokens.accessToken;
    parentRawVerificationToken = parentRes.body.data.verificationToken;

    // 2. Register Provider (starts PENDING)
    const providerRes = await request(app).post('/api/auth/register').send({
      email: testProviderEmail,
      password: 'ProviderSecure123!',
      firstName: 'Haile',
      lastName: 'Gebre',
      role: 'TRANSPORT_PROVIDER',
    });
    providerUserId = providerRes.body.data.user.id;
    providerToken = providerRes.body.data.tokens.accessToken;
    providerRawVerificationToken = providerRes.body.data.verificationToken;

    // 3. Register Driver (starts PENDING)
    const driverRes = await request(app).post('/api/auth/register').send({
      email: testDriverEmail,
      password: 'DriverSecure123!',
      firstName: 'Kifle',
      lastName: 'Wolde',
      role: 'DRIVER',
    });
    driverUserId = driverRes.body.data.user.id;
    driverToken = driverRes.body.data.tokens.accessToken;

    // 4. Register Business (starts PENDING)
    const bizRes = await request(app).post('/api/auth/register').send({
      email: testBizEmail,
      password: 'BizSecure123!',
      firstName: 'Selam',
      lastName: 'Trading',
      role: 'BUSINESS',
    });
    bizUserId = bizRes.body.data.user.id;
    bizToken = bizRes.body.data.tokens.accessToken;

    // 5. Register Admin
    const adminRes = await request(app).post('/api/auth/register').send({
      email: testAdminEmail,
      password: 'AdminSecure123!',
      firstName: 'System',
      lastName: 'Admin',
      role: 'ADMIN',
    });
    adminUserId = adminRes.body.data.user.id;
    adminToken = adminRes.body.data.tokens.accessToken;

    // Seed a vehicle and route for driver trip test
    const vehicle = await prisma.vehicle.create({
      data: {
        providerId: providerUserId,
        make: 'Toyota',
        model: 'Coaster',
        plateNumber: `P7-${timestamp}`,
        capacity: 25,
        status: 'ACTIVE',
      },
    });
    testVehicleId = vehicle.id;

    const route = await prisma.route.create({
      data: {
        providerId: providerUserId,
        vehicleId: testVehicleId,
        name: 'Phase 7 Route',
        origin: 'Bole',
        destinationSchool: 'Bole International School',
        capacity: 25,
        availableSeats: 25,
        monthlyPrice: 2800,
        status: 'ACTIVE',
        isAcceptingPassengers: true,
      },
    });
    testRouteId = route.id;

    const trip = await prisma.trip.create({
      data: {
        routeId: testRouteId,
        vehicleId: testVehicleId,
        driverId: driverUserId,
        status: 'SCHEDULED',
      },
    });
    testTripId = trip.id;
  });

  afterAll(async () => {
    // Cleanup records
    await prisma.trip.deleteMany({ where: { id: testTripId } });
    await prisma.route.deleteMany({ where: { id: testRouteId } });
    await prisma.vehicle.deleteMany({ where: { id: testVehicleId } });
    await prisma.emailVerificationToken.deleteMany({
      where: {
        userId: { in: [parentUserId, providerUserId, driverUserId, bizUserId, adminUserId] },
      },
    });
    await prisma.refreshToken.deleteMany({
      where: {
        userId: { in: [parentUserId, providerUserId, driverUserId, bizUserId, adminUserId] },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [parentUserId, providerUserId, driverUserId, bizUserId, adminUserId] },
      },
    });
    await prisma.$disconnect();
  });

  // ==========================================
  // 1. Email Verification Lifecycle & Security
  // ==========================================
  describe('1. Email Verification Lifecycle & Token Security', () => {
    it('should reject invalid or malformed verification tokens', async () => {
      const res = await request(app).post('/api/auth/verify-email').send({
        token: 'invalid-nonexistent-token-12345',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid email verification token');
    });

    it('should reject expired verification token', async () => {
      // Create an expired token directly in database
      const expiredRaw = crypto.randomBytes(32).toString('hex');
      const expiredHash = crypto.createHash('sha256').update(expiredRaw).digest('hex');

      await prisma.emailVerificationToken.create({
        data: {
          tokenHash: expiredHash,
          userId: parentUserId,
          used: false,
          expiresAt: new Date(Date.now() - 1000 * 60), // Expired 1 min ago
        },
      });

      const res = await request(app).post('/api/auth/verify-email').send({
        token: expiredRaw,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('expired');
    });

    it('should successfully verify email with a valid token and persist verification status', async () => {
      expect(parentRawVerificationToken).toBeDefined();

      const res = await request(app).post('/api/auth/verify-email').send({
        token: parentRawVerificationToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('verified successfully');
      expect(res.body.user.isEmailVerified).toBe(true);
      expect(res.body.user.emailVerifiedAt).toBeDefined();

      // Verify in DB that token is marked used and hash was stored
      const rawHash = crypto.createHash('sha256').update(parentRawVerificationToken).digest('hex');
      const tokenInDb = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash: rawHash },
      });
      expect(tokenInDb?.used).toBe(true);

      const userInDb = await prisma.user.findUnique({ where: { id: parentUserId } });
      expect(userInDb?.isEmailVerified).toBe(true);
      expect(userInDb?.emailVerifiedAt).not.toBeNull();
    });

    it('should reject token reuse (single-use enforcement)', async () => {
      // Attempt to use the already consumed token again
      const res = await request(app).post('/api/auth/verify-email').send({
        token: parentRawVerificationToken,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already been used');
    });

    it('should enforce 60-second rate limiting on resend verification', async () => {
      // First resend attempt on provider
      const res1 = await request(app).post('/api/auth/resend-verification').send({
        email: testProviderEmail,
      });

      // If registered less than 60s ago, resend immediately hits rate limiting (429)
      if (res1.status === 429) {
        expect(res1.body.message).toContain('60 seconds');
      } else {
        expect(res1.status).toBe(200);

        // Immediate second resend must strictly hit 429
        const res2 = await request(app).post('/api/auth/resend-verification').send({
          email: testProviderEmail,
        });
        expect(res2.status).toBe(429);
        expect(res2.body.message).toContain('60 seconds');
      }
    });
  });

  // ==========================================
  // 2. Strict Separation Between Verification States
  // ==========================================
  describe('2. Separation Between Email Verification and Fayda Identity Verification', () => {
    it('should verify that email verification does NOT grant Fayda identity verification', async () => {
      const user = await prisma.user.findUnique({ where: { id: parentUserId } });
      expect(user?.isEmailVerified).toBe(true);
      // Fayda isVerified MUST remain false!
      expect(user?.isVerified).toBe(false);
      expect(user?.faydaId).toBeFalsy();
    });

    it('should verify that email verification does NOT approve a provider account', async () => {
      // Verify provider's email
      const res = await request(app).post('/api/auth/verify-email').send({
        token: providerRawVerificationToken,
      });
      expect(res.status).toBe(200);

      const provider = await prisma.user.findUnique({ where: { id: providerUserId } });
      expect(provider?.isEmailVerified).toBe(true);
      // Status MUST remain PENDING!
      expect(provider?.status).toBe('PENDING');
    });
  });

  // ==========================================
  // 3. Unapproved Role-Based Restrictions
  // ==========================================
  describe('3. Role-Specific Restrictions for Unverified & Unapproved Accounts', () => {
    it('should prevent an unapproved provider from creating routes', async () => {
      const res = await request(app)
        .post('/api/transportation/routes')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          vehicleId: testVehicleId,
          name: 'Unauthorized Route',
          origin: 'Megenagna',
          destinationSchool: 'Cathedral School',
          serviceType: 'BOTH',
          monthlyPrice: 3000,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Account pending administrator approval');
    });

    it('should prevent an unapproved/unverified driver from starting a trip', async () => {
      const res = await request(app)
        .patch(`/api/transportation/trips/${testTripId}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          status: 'IN_PROGRESS',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('email must be verified');
    });

    it('should prevent an unverified business from creating ad campaigns', async () => {
      const res = await request(app)
        .post('/api/advertising/campaigns')
        .set('Authorization', `Bearer ${bizToken}`)
        .send({
          title: 'Unverified Ad Campaign',
          bannerUrl: 'https://example.com/banner.png',
          placement: 'DASHBOARD_BANNER',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Email verification required');
    });
  });

  // ==========================================
  // 4. Role-Based Administrator Approval Workflow
  // ==========================================
  describe('4. Administrator Review & Approval Workflow', () => {
    it('should prevent non-admin user from accessing application review endpoints', async () => {
      const res = await request(app)
        .get('/api/admin/applications')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow admin to list pending registration applications with vehicle details', async () => {
      const res = await request(app)
        .get('/api/admin/applications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const foundProvider = res.body.data.find((a: any) => a.id === providerUserId);
      expect(foundProvider).toBeDefined();
      expect(foundProvider.role).toBe('TRANSPORT_PROVIDER');
      expect(foundProvider.status).toBe('PENDING');
      expect(foundProvider.isEmailVerified).toBe(true);
      expect(Array.isArray(foundProvider.vehicles)).toBe(true);
    });

    it('should require a rejection reason when rejecting an application', async () => {
      const res = await request(app)
        .post(`/api/admin/applications/${providerUserId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'REJECT',
          reason: '', // Missing reason
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body).toLowerCase()).toContain('reason');
    });

    it('should allow admin to approve provider application to ACTIVE', async () => {
      const res = await request(app)
        .post(`/api/admin/applications/${providerUserId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'APPROVE',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.rejectionReason).toBeNull();

      const updated = await prisma.user.findUnique({ where: { id: providerUserId } });
      expect(updated?.status).toBe('ACTIVE');
    });

    it('should now allow approved provider to create a route', async () => {
      const res = await request(app)
        .post('/api/transportation/routes')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          vehicleId: testVehicleId,
          name: 'Approved Provider Route',
          origin: 'Megenagna',
          destinationSchool: 'Cathedral School',
          serviceType: 'BOTH',
          monthlyPrice: 3200,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');

      // Clean up newly created route
      await prisma.route.delete({ where: { id: res.body.data.id } });
    });

    it('should allow admin to reject an application with an explicit reason', async () => {
      const res = await request(app)
        .post(`/api/admin/applications/${bizUserId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'REJECT',
          reason: 'Business commercial registration document is blurry and invalid',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.rejectionReason).toBe('Business commercial registration document is blurry and invalid');

      const updatedBiz = await prisma.user.findUnique({ where: { id: bizUserId } });
      expect(updatedBiz?.status).toBe('REJECTED');
      expect(updatedBiz?.rejectionReason).toBe('Business commercial registration document is blurry and invalid');
    });
  });

  describe('5. Fayda FIN & SMS OTP Two-Step Lifecycle and Identifier Protection', () => {
    const rawFin = '123456789012';
    let txnId: string;
    let testOtp: string;

    it('should reject invalid Fayda FIN format on initiation (<12 digits)', async () => {
      const res = await request(app)
        .post('/api/fayda/initiate-fin')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ finNumber: '12345' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('12-digit');
    });

    it('should initiate Fayda FIN verification, return transactionId, maskedPhone, and NOT verify user yet', async () => {
      const res = await request(app)
        .post('/api/fayda/initiate-fin')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ finNumber: rawFin });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transactionId).toBeDefined();
      expect(res.body.data.maskedPhone).toBeDefined();
      expect(res.body.data.isSandbox).toBe(true);

      txnId = res.body.data.transactionId;
      testOtp = res.body.data.simulatedOtp || '123456';

      // Crucial security check: User MUST still be unverified!
      const parentInDb = await prisma.user.findUnique({ where: { id: parentUserId } });
      expect(parentInDb?.isVerified).toBe(false);
      expect(parentInDb?.faydaId).toBeNull();
    });

    it('should reject OTP verification with incorrect OTP code', async () => {
      const res = await request(app)
        .post('/api/fayda/verify-fin')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          finNumber: rawFin,
          transactionId: txnId,
          otp: '000000', // Wrong OTP
        });

      expect(res.status).toBe(400);
      expect(res.body.message.toLowerCase()).toContain('invalid fayda sms verification code');

      // Still unverified
      const parentInDb = await prisma.user.findUnique({ where: { id: parentUserId } });
      expect(parentInDb?.isVerified).toBe(false);
    });

    it('should establish verified status upon valid OTP and store ONLY masked identifier (last 4 digits)', async () => {
      const res = await request(app)
        .post('/api/fayda/verify-fin')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          finNumber: rawFin,
          transactionId: txnId,
          otp: testOtp,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verified).toBe(true);
      expect(res.body.data.faydaIdNumber).toBe('********9012'); // Masked!
      expect(res.body.data.faydaIdNumber).not.toContain(rawFin);

      // Verify in database: ONLY masked identifier is stored
      const parentInDb = await prisma.user.findUnique({ where: { id: parentUserId } });
      expect(parentInDb?.isVerified).toBe(true);
      expect(parentInDb?.faydaId).toBe('********9012');
      expect(parentInDb?.faydaId).not.toBe(rawFin);
    });

    it('should reject replay of already-consumed transactionId', async () => {
      const res = await request(app)
        .post('/api/fayda/verify-fin')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          finNumber: rawFin,
          transactionId: txnId,
          otp: testOtp,
        });

      expect(res.status).toBe(400);
      expect(res.body.message.toLowerCase()).toContain('expired or is invalid');
    });

    it('should return masked identifier on Fayda status endpoint', async () => {
      const res = await request(app)
        .get('/api/fayda/status')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isVerified).toBe(true);
      expect(res.body.data.faydaId).toBe('********9012');
      expect(res.body.data.status).toBe('VERIFIED');
    });

    it('should persist verification status on GET /api/auth/me', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isVerified).toBe(true);
      expect(res.body.data.isEmailVerified).toBe(true);
      expect(res.body.data.faydaId).toBe('********9012');
    });
  });

  describe('6. Active Advertisements Eligibility, Expiration & Fallback Retrieval', () => {
    let activeCampaignId: string;
    let expiredCampaignId: string;
    let pausedCampaignId: string;
    let futureCampaignId: string;

    beforeAll(async () => {
      const now = new Date();

      // 1. Eligible active campaign
      const activeCamp = await prisma.advertisingCampaign.create({
        data: {
          businessId: bizUserId,
          title: 'Safe Ride Transit Care',
          description: 'Special back-to-school student ride discounts',
          bannerUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
          targetUrl: 'https://saferide.et/offers',
          placement: 'DASHBOARD_BANNER',
          status: 'ACTIVE',
          startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Started yesterday
          endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Ends in 7 days
        },
      });
      activeCampaignId = activeCamp.id;

      // 2. Expired campaign
      const expiredCamp = await prisma.advertisingCampaign.create({
        data: {
          businessId: bizUserId,
          title: 'Expired Summer Camp Special',
          description: 'Ended last week',
          bannerUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
          placement: 'DASHBOARD_BANNER',
          status: 'ACTIVE',
          startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
          endDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // Ended 7 days ago
        },
      });
      expiredCampaignId = expiredCamp.id;

      // 3. Paused campaign
      const pausedCamp = await prisma.advertisingCampaign.create({
        data: {
          businessId: bizUserId,
          title: 'Paused Insurance Campaign',
          description: 'Temporarily disabled',
          bannerUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
          placement: 'DASHBOARD_BANNER',
          status: 'PAUSED',
          startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      pausedCampaignId = pausedCamp.id;

      // 4. Future campaign (not yet started)
      const futureCamp = await prisma.advertisingCampaign.create({
        data: {
          businessId: bizUserId,
          title: 'Next Term Promo',
          description: 'Starts next month',
          bannerUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
          placement: 'DASHBOARD_BANNER',
          status: 'ACTIVE',
          startDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // Starts in 14 days
          endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      futureCampaignId = futureCamp.id;
    });

    afterAll(async () => {
      const idsToDelete = [activeCampaignId, expiredCampaignId, pausedCampaignId, futureCampaignId].filter(
        Boolean
      ) as string[];
      if (idsToDelete.length > 0) {
        await prisma.advertisingCampaign.deleteMany({
          where: {
            id: { in: idsToDelete },
          },
        });
      }
    });

    it('should return ONLY eligible active campaigns matching placement and date criteria', async () => {
      const res = await request(app).get('/api/advertising/active?placement=DASHBOARD_BANNER');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const ids = res.body.data.map((c: any) => c.id);
      expect(ids).toContain(activeCampaignId);
      expect(ids).not.toContain(expiredCampaignId);
      expect(ids).not.toContain(pausedCampaignId);
      expect(ids).not.toContain(futureCampaignId);

      const activeAd = res.body.data.find((c: any) => c.id === activeCampaignId);
      expect(activeAd.title).toBe('Safe Ride Transit Care');
      expect(activeAd.targetUrl).toBe('https://saferide.et/offers');
      expect(activeAd.bannerUrl).toBeDefined();
    });

    it('should return empty array when placement has no matching active ads (triggers Find Transportation fallback)', async () => {
      const res = await request(app).get('/api/advertising/active?placement=NON_EXISTENT_PLACEMENT');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });
});

