import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../src/app';
import { prisma } from '../src/config/prisma';

describe('Payment-Receipt Upload, Storage & Multi-Role Review Workflow', () => {
  jest.setTimeout(35000);
  const ts = Date.now();

  let parentToken: string;
  let parentId: string;

  let unrelatedParentToken: string;
  let unrelatedParentId: string;

  let providerToken: string;
  let providerId: string;

  let unrelatedProviderToken: string;
  let unrelatedProviderId: string;

  let adminToken: string;
  let adminId: string;

  let agreementId: string;
  let paymentId: string;

  const dummyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );

  beforeAll(async () => {
    // 1. Create Parent
    const p1Res = await request(app).post('/api/auth/register').send({
      email: `parent_pay_${ts}@schoolsafe.org`,
      password: 'Password123!',
      firstName: 'Abebe',
      lastName: 'Parent',
      role: 'PARENT',
    });
    parentToken = p1Res.body.data.tokens.accessToken;
    parentId = p1Res.body.data.user.id;

    // 2. Create Unrelated Parent
    const p2Res = await request(app).post('/api/auth/register').send({
      email: `unrelated_parent_${ts}@schoolsafe.org`,
      password: 'Password123!',
      firstName: 'Tigist',
      lastName: 'ParentTwo',
      role: 'PARENT',
    });
    unrelatedParentToken = p2Res.body.data.tokens.accessToken;
    unrelatedParentId = p2Res.body.data.user.id;

    // 3. Create Transport Provider 1 (Assigned to route)
    const prov1Res = await request(app).post('/api/auth/register').send({
      email: `prov1_pay_${ts}@schoolsafe.org`,
      password: 'Password123!',
      firstName: 'Dawit',
      lastName: 'ProviderOne',
      role: 'TRANSPORT_PROVIDER',
    });
    providerToken = prov1Res.body.data.tokens.accessToken;
    providerId = prov1Res.body.data.user.id;

    // 4. Create Transport Provider 2 (Unrelated)
    const prov2Res = await request(app).post('/api/auth/register').send({
      email: `prov2_pay_${ts}@schoolsafe.org`,
      password: 'Password123!',
      firstName: 'Solomon',
      lastName: 'ProviderTwo',
      role: 'TRANSPORT_PROVIDER',
    });
    unrelatedProviderToken = prov2Res.body.data.tokens.accessToken;
    unrelatedProviderId = prov2Res.body.data.user.id;

    // 5. Create Admin
    const adminRes = await request(app).post('/api/auth/register').send({
      email: `admin_pay_${ts}@schoolsafe.org`,
      password: 'Password123!',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'ADMIN',
    });
    adminToken = adminRes.body.data.tokens.accessToken;
    adminId = adminRes.body.data.user.id;

    // Mark users verified and active
    await prisma.user.updateMany({
      where: { id: { in: [parentId, unrelatedParentId, providerId, unrelatedProviderId, adminId] } },
      data: { isEmailVerified: true, status: 'ACTIVE', isVerified: true },
    });

    // 6. Create Student for Parent 1
    const student = await prisma.student.create({
      data: {
        parentId,
        firstName: 'Dagmawi',
        lastName: 'Abebe',
        schoolName: 'Bole Community School',
      },
    });

    // 7. Create Vehicle & Route for Provider 1
    const vehicle = await prisma.vehicle.create({
      data: {
        providerId,
        make: 'Toyota',
        model: 'Coaster',
        plateNumber: `ET-${ts.toString().slice(-6)}`,
        capacity: 22,
        isVerified: true,
        status: 'ACTIVE',
      },
    });

    const route = await prisma.route.create({
      data: {
        providerId,
        vehicleId: vehicle.id,
        name: `Route Bole Express ${ts}`,
        origin: 'Bole Medhanealem',
        destinationSchool: 'Bole Community School',
        capacity: 22,
        availableSeats: 15,
        monthlyPrice: 3200,
        status: 'ACTIVE',
      },
    });

    // 8. Create Transportation Request and Agreement
    const requestRecord = await prisma.transportationRequest.create({
      data: {
        parentId,
        studentId: student.id,
        routeId: route.id,
        providerId,
        pickupStopName: 'Bole Medhanealem Stop',
        preferredStartDate: new Date(),
        proposedPrice: 3200,
        currentPrice: 3200,
        status: 'ACCEPTED',
      },
    });

    const agreement = await prisma.transportationAgreement.create({
      data: {
        requestId: requestRecord.id,
        parentId,
        studentId: student.id,
        providerId,
        vehicleId: vehicle.id,
        routeId: route.id,
        pickupStopName: 'Bole Medhanealem Stop',
        monthlyPrice: 3200,
        currency: 'ETB',
        startDate: new Date(),
        status: 'ACTIVE',
      },
    });
    agreementId = agreement.id;

    // 9. Create initial UNPAID Payment record
    const payment = await prisma.payment.create({
      data: {
        agreementId: agreement.id,
        payerId: parentId,
        receiverId: providerId,
        amount: 3200,
        currency: 'ETB',
        reference: `PAY-${ts}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        status: 'UNPAID',
      },
    });
    paymentId = payment.id;
  });

  afterAll(async () => {
    // Cleanup files if needed
  });

  describe('1. Receipt Upload Validation & State Transitions', () => {
    it('should reject file upload with unsupported extension/mime type (.txt)', async () => {
      const res = await request(app)
        .post(`/api/transportation/agreements/${agreementId}/payments/upload-receipt`)
        .set('Authorization', `Bearer ${parentToken}`)
        .attach('receipt', Buffer.from('Fake receipt content'), 'receipt.txt');

      expect(res.status).toBe(400);
      expect(res.body.message.toLowerCase()).toContain('invalid file format');
    });

    it('should reject upload if file is missing from form-data', async () => {
      const res = await request(app)
        .post(`/api/transportation/agreements/${agreementId}/payments/upload-receipt`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message.toLowerCase()).toContain('payment receipt file is required');
    });

    it('should successfully upload a PNG receipt and set payment to PENDING_REVIEW', async () => {
      const res = await request(app)
        .post(`/api/transportation/agreements/${agreementId}/payments/upload-receipt`)
        .set('Authorization', `Bearer ${parentToken}`)
        .field('notes', 'Paid via Telebirr ref #TXN123456')
        .attach('receipt', dummyPng, 'cbe_receipt.png');

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING_REVIEW');
      expect(res.body.data.receiptUploadedAt).toBeDefined();

      // Verify payment in database
      const updatedPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
      expect(updatedPayment?.status).toBe('PENDING_REVIEW');
      expect(updatedPayment?.receiptUrl).toBeDefined();
      expect(updatedPayment?.receiptMimeType).toBe('image/png');
      expect(updatedPayment?.receiptOriginalName).toBe('cbe_receipt.png');
      expect(updatedPayment?.notes).toBe('Paid via Telebirr ref #TXN123456');
    });
  });

  describe('2. Receipt Access Authorization & Isolation', () => {
    it('should allow the Agreement Parent to download/view their receipt', async () => {
      const res = await request(app)
        .get(`/api/transportation/payments/${paymentId}/receipt`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('image/png');
    });

    it('should allow the Assigned Transport Provider to view the receipt for their route', async () => {
      const res = await request(app)
        .get(`/api/transportation/payments/${paymentId}/receipt`)
        .set('Authorization', `Bearer ${providerToken}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('image/png');
    });

    it('should allow an Administrator to view the receipt', async () => {
      const res = await request(app)
        .get(`/api/transportation/payments/${paymentId}/receipt`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('image/png');
    });

    it('should forbid an Unrelated Parent from viewing another parent receipt (403)', async () => {
      const res = await request(app)
        .get(`/api/transportation/payments/${paymentId}/receipt`)
        .set('Authorization', `Bearer ${unrelatedParentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message.toLowerCase()).toContain('not authorized to view this payment receipt');
    });

    it('should forbid an Unrelated Provider from viewing another provider agreement receipt (403)', async () => {
      const res = await request(app)
        .get(`/api/transportation/payments/${paymentId}/receipt`)
        .set('Authorization', `Bearer ${unrelatedProviderToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message.toLowerCase()).toContain('not authorized to view this payment receipt');
    });

    it('should forbid unauthenticated access to receipts (401)', async () => {
      const res = await request(app).get(`/api/transportation/payments/${paymentId}/receipt`);
      expect(res.status).toBe(401);
    });
  });

  describe('3. Administrator Review Workflow & State Transitions', () => {
    it('should forbid a non-admin (Provider) from executing payment review (403)', async () => {
      const res = await request(app)
        .patch(`/api/admin/payments/${paymentId}/review`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          decision: 'APPROVE',
        });

      expect(res.status).toBe(403);
    });

    it('should forbid a parent from executing payment review (403)', async () => {
      const res = await request(app)
        .patch(`/api/admin/payments/${paymentId}/review`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          decision: 'APPROVE',
        });

      expect(res.status).toBe(403);
    });

    it('should require a reason when rejecting a payment', async () => {
      const res = await request(app)
        .patch(`/api/admin/payments/${paymentId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'REJECT',
        });

      expect(res.status).toBe(400);
      expect(res.body.message.toLowerCase()).toContain('reason must be provided');
    });

    it('should allow admin to REJECT payment with a mandatory reason', async () => {
      const res = await request(app)
        .patch(`/api/admin/payments/${paymentId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'REJECT',
          reason: 'Receipt screenshot is blurry and does not display transaction reference.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.rejectionReason).toContain('blurry');
      expect(res.body.data.reviewedById).toBe(adminId);

      // Verify in database
      const dbPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
      expect(dbPayment?.status).toBe('REJECTED');
      expect(dbPayment?.rejectionReason).toContain('blurry');
    });

    it('should allow parent to re-upload a receipt for a REJECTED payment', async () => {
      const res = await request(app)
        .post(`/api/transportation/agreements/${agreementId}/payments/upload-receipt`)
        .set('Authorization', `Bearer ${parentToken}`)
        .field('notes', 'Re-uploaded clearer PDF receipt')
        .attach('receipt', dummyPng, 'clear_cbe_receipt.png');

      expect([200, 201]).toContain(res.status);
      expect(res.body.data.status).toBe('PENDING_REVIEW');

      const dbPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
      expect(dbPayment?.status).toBe('PENDING_REVIEW');
    });

    it('should allow admin to APPROVE a verified receipt', async () => {
      const res = await request(app)
        .patch(`/api/admin/payments/${paymentId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'APPROVE',
          reason: 'Bank transaction confirmed on CBE Birr merchant portal.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.reviewedById).toBe(adminId);

      // Verify in database: Payment is APPROVED and Agreement is ACTIVE
      const dbPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
      expect(dbPayment?.status).toBe('APPROVED');

      const dbAgreement = await prisma.transportationAgreement.findUnique({ where: { id: agreementId } });
      expect(dbAgreement?.status).toBe('ACTIVE');
    });

    it('should allow admin to list payments filtered by status', async () => {
      const res = await request(app)
        .get('/api/admin/payments?status=APPROVED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.payments)).toBe(true);
      const found = res.body.data.payments.find((p: any) => p.id === paymentId);
      expect(found).toBeDefined();
      expect(found.status).toBe('APPROVED');
    });
  });
});
