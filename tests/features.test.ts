import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';

describe('SchoolSafe Extended Features Integration Tests', () => {
  jest.setTimeout(30000);
  let adminToken: string;
  let parentToken: string;
  let providerToken: string;
  let businessToken: string;
  let parentId: string;
  let providerId: string;

  beforeAll(async () => {
    // 1. Register Admin
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `admin_${Date.now()}@schoolsafe.et`,
        password: 'AdminPassword123!',
        firstName: 'System',
        lastName: 'Admin',
        role: 'ADMIN',
      });
    adminToken = adminRes.body.data.tokens.accessToken;

    // 2. Register Parent
    const parentRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `parent_${Date.now()}@schoolsafe.et`,
        password: 'ParentPassword123!',
        firstName: 'Abebe',
        lastName: 'Bikila',
        role: 'PARENT',
      });
    parentToken = parentRes.body.data.tokens.accessToken;
    parentId = parentRes.body.data.user.id;

    // 3. Register Provider
    const providerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `provider_${Date.now()}@schoolsafe.et`,
        password: 'ProviderPassword123!',
        firstName: 'Tadesse',
        lastName: 'Haile',
        role: 'TRANSPORT_PROVIDER',
      });
    providerToken = providerRes.body.data.tokens.accessToken;
    providerId = providerRes.body.data.user.id;

    // 4. Register Business
    const businessRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `biz_${Date.now()}@schoolsafe.et`,
        password: 'BizPassword123!',
        firstName: 'Addis',
        lastName: 'Supplies',
        role: 'BUSINESS',
      });
    businessToken = businessRes.body.data.tokens.accessToken;
    await prisma.user.update({
      where: { id: businessRes.body.data.user.id },
      data: { isEmailVerified: true, status: 'ACTIVE' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Profile & Password Management', () => {
    it('should allow user to update their profile', async () => {
      const dynamicPhone = `+2519${Date.now().toString().slice(-8)}`;
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          firstName: 'Abebe-Updated',
          phone: dynamicPhone,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.firstName).toBe('Abebe-Updated');
      expect(res.body.data.phone).toBe(dynamicPhone);
    });

    it('should allow user to change their password with valid current password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          currentPassword: 'ParentPassword123!',
          newPassword: 'NewSecurePassword456!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject password change with incorrect current password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'AnotherPassword789!',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Fayda National Digital ID Integration', () => {
    it('should generate Fayda eSignet OIDC authorization URL', async () => {
      const res = await request(app)
        .get('/api/fayda/auth-url')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.authUrl).toContain('https://esignet.ida.fayda.et/authorize');
    });

    it('should verify citizen using Fayda 12-digit National ID (FIN)', async () => {
      const res = await request(app)
        .post('/api/fayda/verify-fin')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          finNumber: '123456789012',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verified).toBe(true);
      expect(res.body.data.status).toBe('VERIFIED');
    });

    it('should reject invalid Fayda FIN format (less than 12 digits)', async () => {
      const res = await request(app)
        .post('/api/fayda/verify-fin')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          finNumber: '12345',
        });

      expect(res.status).toBe(400);
    });

    it('should return verified status after Fayda verification', async () => {
      const res = await request(app)
        .get('/api/fayda/status')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isVerified).toBe(true);
      expect(res.body.data.status).toBe('VERIFIED');
    });
  });

  describe('Business Advertising Platform', () => {
    let packageId: string;
    let campaignId: string;

    it('should allow admin to create an advertising package', async () => {
      const res = await request(app)
        .post('/api/advertising/packages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Premium School Banner',
          description: 'Top placement across parent dashboard for 30 days',
          durationDays: 30,
          price: 2500,
          placement: 'DASHBOARD_BANNER',
          isFeatured: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      packageId = res.body.data.id;
    });

    it('should allow public listing of advertising packages', async () => {
      const res = await request(app).get('/api/advertising/packages');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should allow business to create a campaign', async () => {
      const res = await request(app)
        .post('/api/advertising/campaigns')
        .set('Authorization', `Bearer ${businessToken}`)
        .send({
          title: 'Addis Back-to-School Stationery Sale',
          description: 'Special 20% discount on backpacks and notebooks for all SchoolSafe parents',
          bannerUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b',
          targetUrl: 'https://example.com/sale',
          packageId,
          placement: 'DASHBOARD_BANNER',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      campaignId = res.body.data.id;
    });

    it('should allow admin to approve campaign to ACTIVE status', async () => {
      const res = await request(app)
        .patch(`/api/advertising/campaigns/${campaignId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'ACTIVE',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('should display active campaigns on public / active endpoint', async () => {
      const res = await request(app).get('/api/advertising/active');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should record ad click event without error', async () => {
      const res = await request(app)
        .post(`/api/advertising/campaigns/${campaignId}/events`)
        .send({
          eventType: 'CLICK',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Admin Operations & System Metrics', () => {
    it('should allow admin to list users with pagination and role filter', async () => {
      const res = await request(app)
        .get('/api/admin/users?role=PARENT&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users.length).toBeGreaterThan(0);
    });

    it('should allow admin to update user status to ACTIVE', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${providerId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('should allow admin to view comprehensive platform stats', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('users');
      expect(res.body.data).toHaveProperty('transportation');
      expect(res.body.data).toHaveProperty('financials');
    });

    it('should forbid non-admin from accessing admin endpoints', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(403);
    });
  });
});
