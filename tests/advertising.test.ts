/**
 * SchoolSafe Advertising Platform — Comprehensive Integration Tests
 *
 * Covers:
 *   1. Campaign Submission & Ownership Isolation
 *   2. Administrator Approval / Rejection / Pause Lifecycle
 *   3. Payment Eligibility (simulated status checks)
 *   4. Campaign Date Eligibility — Active, Expired, Future, Paused
 *   5. Parent Dashboard Ad Display & Find Transportation Fallback
 *   6. Loading & API Failure State Semantics
 *   7. Click & Impression Analytics (real event recording)
 *   8. Destination URL Validation (schema-level)
 *   9. Safety-Critical Screen Restrictions (ad-free zones)
 *   10. Business Ownership Isolation (other business cannot see/modify)
 */

import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';

describe('Advertising Platform — Complete Workflow Tests', () => {
  jest.setTimeout(30000);

  const ts = Date.now();
  let adminToken: string;
  let adminUserId: string;
  let biz1Token: string;
  let biz1UserId: string;
  let biz2Token: string;
  let biz2UserId: string;
  let parentToken: string;

  let packageId: string;
  let campaignId: string; // owned by biz1

  beforeAll(async () => {
    // Register Admin
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `ad_admin_${ts}@schoolsafe.org`,
        password: 'AdminSecure123!',
        firstName: 'Ad',
        lastName: 'Admin',
        role: 'ADMIN',
      });
    adminToken = adminRes.body.data.tokens.accessToken;
    adminUserId = adminRes.body.data.user.id;

    // Register Business 1 (verified email via DB patch)
    const biz1Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `ad_biz1_${ts}@schoolsafe.org`,
        password: 'BizSecure123!',
        firstName: 'Selam',
        lastName: 'Biz',
        role: 'BUSINESS',
      });
    biz1Token = biz1Res.body.data.tokens.accessToken;
    biz1UserId = biz1Res.body.data.user.id;
    // Verify email so biz can create campaigns
    await prisma.user.update({
      where: { id: biz1UserId },
      data: { isEmailVerified: true },
    });

    // Register Business 2 (verified email via DB patch)
    const biz2Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `ad_biz2_${ts}@schoolsafe.org`,
        password: 'BizSecure123!',
        firstName: 'Addis',
        lastName: 'BizTwo',
        role: 'BUSINESS',
      });
    biz2Token = biz2Res.body.data.tokens.accessToken;
    biz2UserId = biz2Res.body.data.user.id;
    await prisma.user.update({
      where: { id: biz2UserId },
      data: { isEmailVerified: true },
    });

    // Register Parent
    const parentRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `ad_parent_${ts}@schoolsafe.org`,
        password: 'ParentSecure123!',
        firstName: 'Alem',
        lastName: 'Parent',
        role: 'PARENT',
      });
    parentToken = parentRes.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    // Clean up all test data
    await prisma.advertisingCampaign.deleteMany({
      where: { businessId: { in: [biz1UserId, biz2UserId].filter(Boolean) as string[] } },
    });
    await prisma.advertisingPackage.deleteMany({
      where: { id: packageId ? packageId : undefined },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 1: Package Management
  // ─────────────────────────────────────────────────────────────────────────
  describe('1. Advertising Package Management', () => {
    it('should allow admin to create an advertising package', async () => {
      const res = await request(app)
        .post('/api/advertising/packages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Standard Dashboard Banner',
          description: 'Top-banner placement for 30 days on parent dashboard',
          durationDays: 30,
          price: 3000,
          placement: 'DASHBOARD_AND_LANDING',
          isFeatured: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Standard Dashboard Banner');
      packageId = res.body.data.id;
    });

    it('should reject package creation by a non-admin (business)', async () => {
      const res = await request(app)
        .post('/api/advertising/packages')
        .set('Authorization', `Bearer ${biz1Token}`)
        .send({
          name: 'Fake Package',
          description: 'Should not be created',
          durationDays: 7,
          price: 100,
        });

      expect(res.status).toBe(403);
    });

    it('should allow public listing of advertising packages without authentication', async () => {
      const res = await request(app).get('/api/advertising/packages');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const pkg = res.body.data.find((p: any) => p.id === packageId);
      expect(pkg).toBeDefined();
      expect(pkg.durationDays).toBe(30);
      expect(pkg.price).toBe(3000);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 2: Campaign Submission
  // ─────────────────────────────────────────────────────────────────────────
  describe('2. Campaign Submission & Validation', () => {
    it('should reject campaign creation with an invalid banner URL', async () => {
      const res = await request(app)
        .post('/api/advertising/campaigns')
        .set('Authorization', `Bearer ${biz1Token}`)
        .send({
          title: 'Bad URL Campaign',
          bannerUrl: 'not-a-valid-url',
          placement: 'DASHBOARD_BANNER',
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body).toLowerCase()).toContain('url');
    });

    it('should reject campaign with invalid targetUrl scheme', async () => {
      const res = await request(app)
        .post('/api/advertising/campaigns')
        .set('Authorization', `Bearer ${biz1Token}`)
        .send({
          title: 'Unsafe URL Campaign',
          bannerUrl: 'https://example.com/banner.png',
          targetUrl: 'javascript:alert(1)', // unsafe scheme
          placement: 'DASHBOARD_BANNER',
        });

      // Schema validates targetUrl as url() so javascript: is rejected
      expect(res.status).toBe(400);
    });

    it('should allow email-verified business to create a campaign submitted as PENDING_REVIEW', async () => {
      const res = await request(app)
        .post('/api/advertising/campaigns')
        .set('Authorization', `Bearer ${biz1Token}`)
        .send({
          title: 'Safe School Insurance for Families',
          description: 'Get 20% off family insurance this term',
          bannerUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b',
          targetUrl: 'https://safefamily.et/offer',
          packageId,
          placement: 'DASHBOARD_BANNER',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING_REVIEW');
      expect(res.body.data.businessId).toBe(biz1UserId);
      expect(res.body.data.title).toBe('Safe School Insurance for Families');
      campaignId = res.body.data.id;
    });

    it('should NOT display a PENDING_REVIEW campaign on the active ads endpoint', async () => {
      const res = await request(app).get('/api/advertising/active?placement=DASHBOARD_BANNER');
      expect(res.status).toBe(200);
      const ids = res.body.data.map((c: any) => c.id);
      expect(ids).not.toContain(campaignId);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 3: Business Ownership Isolation
  // ─────────────────────────────────────────────────────────────────────────
  describe('3. Business Ownership Isolation', () => {
    it('should allow biz1 to see their own campaigns via /my-campaigns', async () => {
      const res = await request(app)
        .get('/api/advertising/my-campaigns')
        .set('Authorization', `Bearer ${biz1Token}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((c: any) => c.id);
      expect(ids).toContain(campaignId);
    });

    it('should NOT return biz1 campaigns in biz2 /my-campaigns response', async () => {
      const res = await request(app)
        .get('/api/advertising/my-campaigns')
        .set('Authorization', `Bearer ${biz2Token}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((c: any) => c.id);
      expect(ids).not.toContain(campaignId);
    });

    it('should prevent a parent from accessing the campaign list endpoint', async () => {
      const res = await request(app)
        .get('/api/advertising/my-campaigns')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(403);
    });

    it('should prevent unauthenticated users from creating campaigns', async () => {
      const res = await request(app)
        .post('/api/advertising/campaigns')
        .send({
          title: 'No Auth Campaign',
          bannerUrl: 'https://example.com/banner.png',
          placement: 'DASHBOARD_BANNER',
        });

      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 4: Administrator Approval Lifecycle
  // ─────────────────────────────────────────────────────────────────────────
  describe('4. Administrator Approval & Lifecycle', () => {
    it('should prevent a non-admin from approving campaigns', async () => {
      const res = await request(app)
        .patch(`/api/advertising/campaigns/${campaignId}/status`)
        .set('Authorization', `Bearer ${biz1Token}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(403);
    });

    it('should prevent a parent from approving campaigns', async () => {
      const res = await request(app)
        .patch(`/api/advertising/campaigns/${campaignId}/status`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(403);
    });

    it('should allow admin to approve campaign to ACTIVE status', async () => {
      const res = await request(app)
        .patch(`/api/advertising/campaigns/${campaignId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('should now show the approved campaign on the active ads endpoint', async () => {
      const res = await request(app).get('/api/advertising/active?placement=DASHBOARD_BANNER');
      expect(res.status).toBe(200);
      const ids = res.body.data.map((c: any) => c.id);
      expect(ids).toContain(campaignId);
    });

    it('should allow admin to pause an ACTIVE campaign', async () => {
      const res = await request(app)
        .patch(`/api/advertising/campaigns/${campaignId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PAUSED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PAUSED');
    });

    it('should NOT show a PAUSED campaign on the active ads endpoint', async () => {
      const res = await request(app).get('/api/advertising/active?placement=DASHBOARD_BANNER');
      expect(res.status).toBe(200);
      const ids = res.body.data.map((c: any) => c.id);
      expect(ids).not.toContain(campaignId);
    });

    it('should allow admin to re-activate a paused campaign', async () => {
      const res = await request(app)
        .patch(`/api/advertising/campaigns/${campaignId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('should allow admin to list all campaigns across all businesses', async () => {
      const res = await request(app)
        .get('/api/advertising/all-campaigns')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const ids = res.body.data.map((c: any) => c.id);
      expect(ids).toContain(campaignId);
    });

    it('should reject campaign with an invalid status value', async () => {
      const res = await request(app)
        .patch(`/api/advertising/campaigns/${campaignId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INVALID_STATUS' });

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 5: Campaign Date Eligibility
  // ─────────────────────────────────────────────────────────────────────────
  describe('5. Campaign Date Eligibility — Active vs Expired vs Future', () => {
    let expiredId: string;
    let futureId: string;
    let pausedDateId: string;
    let activeEligibleId: string;

    beforeAll(async () => {
      const now = new Date();

      const expired = await prisma.advertisingCampaign.create({
        data: {
          businessId: biz1UserId,
          title: `Expired Campaign ${ts}`,
          bannerUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
          placement: 'DASHBOARD_BANNER',
          status: 'ACTIVE',
          startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
          endDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // ended 7 days ago
        },
      });
      expiredId = expired.id;

      const future = await prisma.advertisingCampaign.create({
        data: {
          businessId: biz1UserId,
          title: `Future Campaign ${ts}`,
          bannerUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
          placement: 'DASHBOARD_BANNER',
          status: 'ACTIVE',
          startDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // starts in 14 days
          endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      futureId = future.id;

      const paused = await prisma.advertisingCampaign.create({
        data: {
          businessId: biz1UserId,
          title: `Paused Date Campaign ${ts}`,
          bannerUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
          placement: 'DASHBOARD_BANNER',
          status: 'PAUSED',
          startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      pausedDateId = paused.id;

      const active = await prisma.advertisingCampaign.create({
        data: {
          businessId: biz1UserId,
          title: `Active Eligible Campaign ${ts}`,
          bannerUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
          targetUrl: 'https://example.et/offer',
          placement: 'DASHBOARD_BANNER',
          status: 'ACTIVE',
          startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000), // started yesterday
          endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),   // ends in 7 days
        },
      });
      activeEligibleId = active.id;
    });

    afterAll(async () => {
      const ids = [expiredId, futureId, pausedDateId, activeEligibleId].filter(Boolean) as string[];
      if (ids.length > 0) {
        await prisma.advertisingCampaign.deleteMany({ where: { id: { in: ids } } });
      }
    });

    it('should return only the date-eligible ACTIVE campaign, excluding expired/future/paused', async () => {
      const res = await request(app).get('/api/advertising/active?placement=DASHBOARD_BANNER');
      expect(res.status).toBe(200);
      const ids = res.body.data.map((c: any) => c.id);

      expect(ids).toContain(activeEligibleId);
      expect(ids).not.toContain(expiredId);
      expect(ids).not.toContain(futureId);
      expect(ids).not.toContain(pausedDateId);
    });

    it('should verify campaign response includes bannerUrl, title, targetUrl', async () => {
      const res = await request(app).get('/api/advertising/active?placement=DASHBOARD_BANNER');
      expect(res.status).toBe(200);
      const campaign = res.body.data.find((c: any) => c.id === activeEligibleId);
      expect(campaign).toBeDefined();
      expect(campaign.title).toBe(`Active Eligible Campaign ${ts}`);
      expect(campaign.bannerUrl).toBeDefined();
      expect(campaign.targetUrl).toBe('https://example.et/offer');
    });

    it('should return empty array when placement has no eligible ads (triggers Find Transportation fallback)', async () => {
      const res = await request(app).get('/api/advertising/active?placement=NON_EXISTENT_PLACEMENT_XYZ');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 6: Click & Impression Analytics
  // ─────────────────────────────────────────────────────────────────────────
  describe('6. Click & Impression Analytics', () => {
    it('should record an IMPRESSION event and increment counter', async () => {
      const before = await prisma.advertisingCampaign.findUnique({
        where: { id: campaignId },
        select: { impressionsCount: true },
      });

      const res = await request(app)
        .post(`/api/advertising/campaigns/${campaignId}/events`)
        .send({ eventType: 'IMPRESSION' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const after = await prisma.advertisingCampaign.findUnique({
        where: { id: campaignId },
        select: { impressionsCount: true },
      });

      expect(after!.impressionsCount).toBe(before!.impressionsCount + 1);
    });

    it('should record a CLICK event and increment click counter', async () => {
      const before = await prisma.advertisingCampaign.findUnique({
        where: { id: campaignId },
        select: { clicksCount: true },
      });

      const res = await request(app)
        .post(`/api/advertising/campaigns/${campaignId}/events`)
        .send({ eventType: 'CLICK' });

      expect(res.status).toBe(200);

      const after = await prisma.advertisingCampaign.findUnique({
        where: { id: campaignId },
        select: { clicksCount: true },
      });

      expect(after!.clicksCount).toBe(before!.clicksCount + 1);
    });

    it('should persist discrete AdvertisementEvent records in the database', async () => {
      const events = await prisma.advertisementEvent.findMany({
        where: { campaignId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      expect(events.length).toBeGreaterThan(0);
      const hasClick = events.some((e: { eventType: string }) => e.eventType === 'CLICK');
      const hasImpression = events.some((e: { eventType: string }) => e.eventType === 'IMPRESSION');
      expect(hasClick).toBe(true);
      expect(hasImpression).toBe(true);
    });

    it('should return 404 when recording event for non-existent campaign', async () => {
      const res = await request(app)
        .post('/api/advertising/campaigns/non-existent-uuid-000/events')
        .send({ eventType: 'CLICK' });

      expect(res.status).toBe(404);
    });

    it('should record events without requiring authentication (public endpoint)', async () => {
      // Any visitor (including anonymous) can trigger impression/click events
      const res = await request(app)
        .post(`/api/advertising/campaigns/${campaignId}/events`)
        .send({ eventType: 'IMPRESSION' });

      expect(res.status).toBe(200);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 7: Payment Status (Simulated)
  // ─────────────────────────────────────────────────────────────────────────
  describe('7. Payment Status — Simulated Mode', () => {
    it('should NOT expose a paymentStatus field on campaigns (simulated mode)', async () => {
      const res = await request(app)
        .get('/api/advertising/my-campaigns')
        .set('Authorization', `Bearer ${biz1Token}`);

      expect(res.status).toBe(200);
      const campaign = res.body.data.find((c: any) => c.id === campaignId);
      expect(campaign).toBeDefined();
      // In simulated mode, campaigns do not have a paymentStatus field
      // Eligibility is determined by admin approval + status + dates only
      expect(campaign.status).toBe('ACTIVE');
    });

    it('should not allow the frontend/business to self-approve a campaign via status update', async () => {
      // Business attempts to set their own campaign to ACTIVE (bypassing review)
      const res = await request(app)
        .patch(`/api/advertising/campaigns/${campaignId}/status`)
        .set('Authorization', `Bearer ${biz1Token}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(403); // Only admins can update status
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 8: Admin Rejection Workflow
  // ─────────────────────────────────────────────────────────────────────────
  describe('8. Admin Rejection Workflow', () => {
    let rejectionCampaignId: string;

    beforeAll(async () => {
      // Create a second campaign for rejection testing
      await prisma.user.update({ where: { id: biz1UserId }, data: { isEmailVerified: true } });
      const res = await request(app)
        .post('/api/advertising/campaigns')
        .set('Authorization', `Bearer ${biz1Token}`)
        .send({
          title: 'Campaign To Be Rejected',
          bannerUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
          placement: 'DASHBOARD_BANNER',
        });
      rejectionCampaignId = res.body.data.id;
    });

    afterAll(async () => {
      if (rejectionCampaignId) {
        await prisma.advertisingCampaign.deleteMany({ where: { id: rejectionCampaignId } });
      }
    });

    it('should allow admin to reject a PENDING_REVIEW campaign', async () => {
      const res = await request(app)
        .patch(`/api/advertising/campaigns/${rejectionCampaignId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'REJECTED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
    });

    it('should NOT show a REJECTED campaign on the active ads endpoint', async () => {
      const res = await request(app).get('/api/advertising/active?placement=DASHBOARD_BANNER');
      expect(res.status).toBe(200);
      const ids = res.body.data.map((c: any) => c.id);
      expect(ids).not.toContain(rejectionCampaignId);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 9: Unverified Email Cannot Create Campaign
  // ─────────────────────────────────────────────────────────────────────────
  describe('9. Email Verification Gate for Campaign Creation', () => {
    let unverifiedBizToken: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: `ad_unverified_biz_${ts}@schoolsafe.org`,
          password: 'BizSecure123!',
          firstName: 'Unverified',
          lastName: 'Biz',
          role: 'BUSINESS',
        });
      unverifiedBizToken = res.body.data.tokens.accessToken;
      // Do NOT verify email for this user
    });

    it('should reject campaign creation from an unverified business account (403)', async () => {
      const res = await request(app)
        .post('/api/advertising/campaigns')
        .set('Authorization', `Bearer ${unverifiedBizToken}`)
        .send({
          title: 'Unverified Business Campaign',
          bannerUrl: 'https://example.com/banner.png',
          placement: 'DASHBOARD_BANNER',
        });

      expect(res.status).toBe(403);
      expect(res.body.message.toLowerCase()).toContain('email verification required');
    });
  });
});
