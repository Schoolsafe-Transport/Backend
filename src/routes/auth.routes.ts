import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
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
router.post('/register', validate(registerSchema), (req, res, next) =>
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
router.post('/login', validate(loginSchema), (req, res, next) =>
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
router.post('/refresh-token', validate(refreshTokenSchema), (req, res, next) =>
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
router.post('/logout', authenticate as any, (req, res, next) =>
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
router.post('/forgot-password', validate(forgotPasswordSchema), (req, res, next) =>
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
router.post('/reset-password', validate(resetPasswordSchema), (req, res, next) =>
  authController.resetPassword(req, res, next)
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
router.get('/me', authenticate as any, (req, res, next) =>
  authController.getMe(req as any, res, next)
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
  (req, res) => authController.adminOnly(req as any, res)
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
  (req, res) => authController.schoolAdminOnly(req as any, res)
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
  (req, res) => authController.providerOnly(req as any, res)
);

export default router;
