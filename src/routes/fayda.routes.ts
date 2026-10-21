import { Router } from 'express';
import { faydaController } from '../controllers/fayda.controller';
import { authenticate } from '../middleware/auth.middleware';
import { sensitiveRateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @openapi
 * /fayda/auth-url:
 *   get:
 *     summary: Generate Fayda eSignet OIDC authorization URL
 *     tags:
 *       - Fayda National ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Auth URL generated
 */
router.get('/auth-url', authenticate as any, (req: any, res: any, next: any) =>
  faydaController.getAuthUrl(req, res, next)
);

/**
 * @openapi
 * /fayda/callback:
 *   get:
 *     summary: Handle Fayda eSignet OAuth/OIDC redirection callback
 *     tags:
 *       - Fayda National ID
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Verification completed
 */
router.get('/callback', (req: any, res: any, next: any) =>
  faydaController.handleCallback(req, res, next)
);

/**
 * @openapi
 * /fayda/initiate-fin:
 *   post:
 *     summary: Initiate Fayda FIN identity verification and dispatch SMS OTP
 *     tags:
 *       - Fayda National ID
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - finNumber
 *             properties:
 *               finNumber:
 *                 type: string
 *                 example: "123456789012"
 *     responses:
 *       200:
 *         description: Fayda OTP dispatched to citizen phone
 */
router.post(
  '/initiate-fin',
  authenticate as any,
  sensitiveRateLimiter,
  (req: any, res: any, next: any) => faydaController.initiateFin(req, res, next)
);

/**
 * @openapi
 * /fayda/verify-fin:
 *   post:
 *     summary: Verify account using Fayda FIN (Ethiopian 12-digit National ID)
 *     tags:
 *       - Fayda National ID
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - finNumber
 *             properties:
 *               finNumber:
 *                 type: string
 *                 example: "123456789012"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               transactionId:
 *                 type: string
 *                 example: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
 *     responses:
 *       200:
 *         description: Account successfully verified
 */
router.post(
  '/verify-fin',
  authenticate as any,
  sensitiveRateLimiter,
  (req: any, res: any, next: any) => faydaController.verifyByFin(req, res, next)
);

/**
 * @openapi
 * /fayda/status:
 *   get:
 *     summary: Check Fayda verification status of authenticated user
 *     tags:
 *       - Fayda National ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current verification status
 */
router.get('/status', authenticate as any, (req: any, res: any, next: any) =>
  faydaController.getStatus(req, res, next)
);

export default router;
