import { Router } from 'express';
import { ratingController } from '../controllers/rating.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { createRatingSchema } from '../schemas/rating.schema';

const router = Router();

/**
 * @openapi
 * /ratings:
 *   post:
 *     summary: Submit a rating and review for a transportation provider
 *     tags:
 *       - Ratings & Reviews
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - providerId
 *               - rating
 *             properties:
 *               providerId:
 *                 type: string
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Review submitted
 *       403:
 *         description: Must have active or past agreement with provider
 */
router.post(
  '/',
  authenticate as any,
  authorize('PARENT') as any,
  validate(createRatingSchema),
  (req: any, res: any, next: any) => ratingController.submitRating(req, res, next)
);

/**
 * @openapi
 * /ratings/provider/{providerId}:
 *   get:
 *     summary: Get reviews and rating metrics for a transportation provider
 *     tags:
 *       - Ratings & Reviews
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Provider ratings retrieved
 */
router.get('/provider/:providerId', (req: any, res: any, next: any) =>
  ratingController.getProviderRatings(req, res, next)
);

export default router;
