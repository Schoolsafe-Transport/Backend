import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { authRateLimiter, sensitiveRateLimiter } from '../middleware/rateLimiter';
import { uploadDocumentMiddleware } from '../utils/documentStorage.util';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from '../schemas/auth.schema';

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new account
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [PARENT, STUDENT, SCHOOL_ADMIN, TRANSPORT_PROVIDER, DRIVER, BUSINESS, ADMIN, SUPER_ADMIN]
 *     responses:
 *       201:
 *         description: Registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email or phone already registered
 */
router.post('/register', authRateLimiter, validate(registerSchema), (req: any, res: any, next: any) =>
  authController.register(req, res, next)
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in with credentials
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Authentication successful
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account suspended or rejected
 */
router.post('/login', authRateLimiter, validate(loginSchema), (req: any, res: any, next: any) =>
  authController.login(req, res, next)
);

/**
 * @openapi
 * /auth/refresh-token:
 *   post:
 *     summary: Renew JWT access token using refresh token
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens rotated successfully
 *       401:
 *         description: Invalid or revoked refresh token
 */
router.post('/refresh-token', validate(refreshTokenSchema), (req: any, res: any, next: any) =>
  authController.refreshToken(req, res, next)
);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Log out and revoke active refresh token
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', authenticate as any, (req: any, res: any, next: any) =>
  authController.logout(req, res, next)
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset token
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset instructions dispatched
 */
router.post('/forgot-password', sensitiveRateLimiter, validate(forgotPasswordSchema), (req: any, res: any, next: any) =>
  authController.forgotPassword(req, res, next)
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password successfully updated
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password', sensitiveRateLimiter, validate(resetPasswordSchema), (req: any, res: any, next: any) =>
  authController.resetPassword(req, res, next)
);

/**
 * @openapi
 * /auth/verify-email:
 *   post:
 *     summary: Verify account email address using secure single-use token
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid, used, or expired verification token
 */
router.post('/verify-email', sensitiveRateLimiter, validate(verifyEmailSchema), (req: any, res: any, next: any) =>
  authController.verifyEmail(req, res, next)
);

/**
 * @openapi
 * /auth/resend-verification:
 *   post:
 *     summary: Request fresh email verification link with rate limiting
 *     tags:
 *       - Authentication
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Fresh verification link dispatched if account exists
 *       429:
 *         description: Rate limit exceeded (wait 60 seconds)
 */
router.post('/resend-verification', sensitiveRateLimiter, validate(resendVerificationSchema), (req: any, res: any, next: any) =>
  authController.resendVerification(req, res, next)
);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Retrieve currently authenticated user profile
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate as any, (req: any, res: any, next: any) =>
  authController.getMe(req as any, res, next)
);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     summary: Change password for currently authenticated user
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Incorrect current password or invalid new password
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/change-password',
  authenticate as any,
  sensitiveRateLimiter,
  validate(changePasswordSchema),
  (req: any, res: any, next: any) => authController.changePassword(req as any, res, next)
);

/**
 * @openapi
 * /auth/profile:
 *   patch:
 *     summary: Update profile for currently authenticated user
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               profilePhoto:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Phone number in use
 */
(router as any).patch(
  '/profile',
  authenticate as any,
  validate(updateProfileSchema),
  (req: any, res: any, next: any) => authController.updateProfile(req as any, res, next)
);

/**
 * @openapi
 * /auth/admin-only:
 *   get:
 *     summary: Protected route restricted to ADMIN and SUPER_ADMIN
 *     tags:
 *       - RBAC Tests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Access granted
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.get(
  '/admin-only',
  authenticate as any,
  authorize('ADMIN', 'SUPER_ADMIN') as any,
  (req: any, res: any) => authController.adminOnly(req as any, res)
);

/**
 * @openapi
 * /auth/school-only:
 *   get:
 *     summary: Protected route restricted to SCHOOL_ADMIN
 *     tags:
 *       - RBAC Tests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Access granted
 *       403:
 *         description: Forbidden
 */
router.get(
  '/school-only',
  authenticate as any,
  authorize('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN') as any,
  (req: any, res: any) => authController.schoolAdminOnly(req as any, res)
);

/**
 * @openapi
 * /auth/provider-only:
 *   get:
 *     summary: Protected route restricted to TRANSPORT_PROVIDER
 *     tags:
 *       - RBAC Tests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Access granted
 *       403:
 *         description: Forbidden
 */
router.get(
  '/provider-only',
  authenticate as any,
  authorize('TRANSPORT_PROVIDER', 'ADMIN', 'SUPER_ADMIN') as any,
  (req: any, res: any) => authController.providerOnly(req as any, res)
);

/**
 * Onboarding profile details save
 */
router.post('/onboarding', authenticate as any, (req: any, res: any, next: any) =>
  authController.saveOnboarding(req, res, next)
);

/**
 * Document upload for provider/business verification
 */
router.post(
  '/documents/upload',
  authenticate as any,
  uploadDocumentMiddleware.single('document'),
  (req: any, res: any, next: any) => authController.uploadDocument(req, res, next)
);

/**
 * List my uploaded documents
 */
router.get('/documents', authenticate as any, (req: any, res: any, next: any) =>
  authController.getMyDocuments(req, res, next)
);

/**
 * Securely retrieve an uploaded document
 */
router.get('/documents/:id', authenticate as any, (req: any, res: any, next: any) =>
  authController.getDocument(req, res, next)
);
/**
 * Utility endpoint: purge test user data and restore default admin
 */
router.post('/reset-test-database', async (_req: any, res: any) => {
  try {
    const { prisma } = await import('../config/prisma');
    const bcrypt = await import('bcryptjs');

    await prisma.user.deleteMany({
      where: {
        email: { not: 'rachelberhane716@gmail.com' },
      },
    });

    const adminPasswordHash = await bcrypt.hash('naba1219@Ra', 12);
    const admin = await prisma.user.upsert({
      where: { email: 'rachelberhane716@gmail.com' },
      update: {
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        isVerified: true,
      },
      create: {
        email: 'rachelberhane716@gmail.com',
        passwordHash: adminPasswordHash,
        firstName: 'Rachel',
        lastName: 'Berhane',
        role: 'ADMIN',
        status: 'ACTIVE',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        isVerified: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'All test accounts deleted successfully. Database reset for fresh testing.',
      admin: { email: admin.email, role: admin.role },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
