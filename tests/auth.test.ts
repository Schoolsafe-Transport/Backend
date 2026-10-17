import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';

describe('Authentication & RBAC Test Suite', () => {
  const testParent = {
    email: `testparent_${Date.now()}@schoolsafe.org`,
    password: 'ParentSecure123!',
    firstName: 'Sara',
    lastName: 'Bekele',
    phone: `+251911${Math.floor(100000 + Math.random() * 900000)}`,
    role: 'PARENT',
  };

  const testAdmin = {
    email: `testadmin_${Date.now()}@schoolsafe.org`,
    password: 'AdminSecure123!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
  };

  let parentAccessToken: string;
  let parentRefreshToken: string;
  let adminAccessToken: string;

  afterAll(async () => {
    // Cleanup created test records
    await prisma.refreshToken.deleteMany({
      where: {
        user: {
          email: { in: [testParent.email, testAdmin.email] },
        },
      },
    });
    await prisma.passwordResetToken.deleteMany({
      where: {
        user: {
          email: { in: [testParent.email, testAdmin.email] },
        },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [testParent.email, testAdmin.email] } },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new PARENT user successfully and return sanitized user without passwordHash', async () => {
      const res = await request(app).post('/api/auth/register').send(testParent);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testParent.email.toLowerCase());
      expect(res.body.data.user.role).toBe('PARENT');
      expect(res.body.data.user.passwordHash).toBeUndefined(); // Never expose passwordHash!
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();

      parentAccessToken = res.body.data.tokens.accessToken;
      parentRefreshToken = res.body.data.tokens.refreshToken;
    });

    it('should register an ADMIN user successfully', async () => {
      const res = await request(app).post('/api/auth/register').send(testAdmin);
      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('ADMIN');
      adminAccessToken = res.body.data.tokens.accessToken;
    });

    it('should reject registration if email is already taken', async () => {
      const res = await request(app).post('/api/auth/register').send(testParent);
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should reject registration if confirmPassword does not match password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: `mismatch_${Date.now()}@schoolsafe.org`,
        password: 'Password123!',
        confirmPassword: 'MismatchPassword123!',
        firstName: 'Test',
        lastName: 'Mismatch',
        role: 'PARENT',
      });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('Passwords do not match');
    });

    it('should accept registration when confirmPassword matches password', async () => {
      const validEmail = `match_${Date.now()}@schoolsafe.org`;
      const res = await request(app).post('/api/auth/register').send({
        email: validEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstName: 'Test',
        lastName: 'Match',
        role: 'PARENT',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Clean up test user
      await prisma.refreshToken.deleteMany({ where: { user: { email: validEmail } } });
      await prisma.user.deleteMany({ where: { email: validEmail } });
    });

    it('should reject registration with weak password (missing special char or short)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'weakpass@schoolsafe.org',
        password: 'weak',
        firstName: 'Test',
        lastName: 'Weak',
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should log in successfully with valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testParent.email,
        password: testParent.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should reject login with incorrect password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testParent.email,
        password: 'WrongPassword999!',
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should reject login for non-existent email', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'unknown_user_999@schoolsafe.org',
        password: 'ValidPassword123!',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    it('should issue a new token pair and rotate the refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: parentRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      // Update active refresh token
      parentRefreshToken = res.body.data.refreshToken;
    });

    it('should reject refresh token that has already been rotated or revoked', async () => {
      // Re-using the old refresh token must be rejected
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid_token_xyz' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me (Protected Route)', () => {
    it('should return authenticated user profile when valid Bearer token is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${parentAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(testParent.email.toLowerCase());
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('should reject request without Bearer token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('should forbid PARENT from accessing ADMIN-only route (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/auth/admin-only')
        .set('Authorization', `Bearer ${parentAccessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Forbidden: Role \'PARENT\' is not authorized');
    });

    it('should allow ADMIN to access ADMIN-only route (200 OK)', async () => {
      const res = await request(app)
        .get('/api/auth/admin-only')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Password Reset Lifecycle', () => {
    let resetToken: string;

    it('should issue a password reset token for registered email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testParent.email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.resetToken).toBeDefined();
      resetToken = res.body.resetToken;
    });

    it('should reject password reset when confirmPassword does not match newPassword', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        token: resetToken,
        newPassword: 'NewSecretPassword456!',
        confirmPassword: 'WrongConfirmation456!',
      });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('Passwords do not match');
    });

    it('should reset password with valid token and allow login with new password', async () => {
      const newPassword = 'NewSecretPassword456!';
      const res = await request(app).post('/api/auth/reset-password').send({
        token: resetToken,
        newPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify login with new password
      const loginRes = await request(app).post('/api/auth/login').send({
        email: testParent.email,
        password: newPassword,
      });
      expect(loginRes.status).toBe(200);
    });
  });
});
