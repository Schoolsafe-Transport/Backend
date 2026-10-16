import { Router } from 'express';
import { advertisingController } from '../controllers/advertising.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  createCampaignSchema,
  createPackageSchema,
  updateCampaignStatusSchema,
} from '../schemas/advertising.schema';

const router = Router();

/**
 * @openapi
 * /advertising/active:
 *   get:
 *     summary: "Retrieve currently active ads for public/dashboard display"
 *     tags:
 *       - Advertising
 */
router.get('/active', (req: any, res: any, next: any) =>
  advertisingController.getActiveAds(req, res, next)
);

/**
 * @openapi
 * /advertising/packages:
 *   get:
 *     summary: "List all advertising packages"
 *     tags:
 *       - Advertising
 */
router.get('/packages', (req: any, res: any, next: any) =>
  advertisingController.listPackages(req, res, next)
);

/**
 * @openapi
 * /advertising/packages:
 *   post:
 *     summary: "Create a new advertising package tier (Admin)"
 *     tags:
 *       - Advertising
 */
router.post(
  '/packages',
  authenticate as any,
  authorize('ADMIN', 'SUPER_ADMIN') as any,
  validate(createPackageSchema),
  (req: any, res: any, next: any) => advertisingController.createPackage(req, res, next)
);

/**
 * @openapi
 * /advertising/campaigns:
 *   post:
 *     summary: "Create a new advertising campaign (Business)"
 *     tags:
 *       - Advertising
 */
router.post(
  '/campaigns',
  authenticate as any,
  authorize('BUSINESS', 'ADMIN', 'SUPER_ADMIN') as any,
  validate(createCampaignSchema),
  (req: any, res: any, next: any) => advertisingController.createCampaign(req, res, next)
);

/**
 * @openapi
 * /advertising/my-campaigns:
 *   get:
 *     summary: "Retrieve my campaigns (Business)"
 *     tags:
 *       - Advertising
 */
router.get(
  '/my-campaigns',
  authenticate as any,
  authorize('BUSINESS', 'ADMIN', 'SUPER_ADMIN') as any,
  (req: any, res: any, next: any) => advertisingController.getMyCampaigns(req, res, next)
);

/**
 * @openapi
 * /advertising/campaigns/{campaignId}/events:
 *   post:
 *     summary: "Record impression or click event on an advertisement"
 *     tags:
 *       - Advertising
 */
router.post('/campaigns/:campaignId/events', (req: any, res: any, next: any) =>
  advertisingController.recordEvent(req, res, next)
);

/**
 * @openapi
 * /advertising/campaigns/{campaignId}/status:
 *   patch:
 *     summary: "Update campaign approval status (Admin)"
 *     tags:
 *       - Advertising
 */
(router as any).patch(
  '/campaigns/:campaignId/status',
  authenticate as any,
  authorize('ADMIN', 'SUPER_ADMIN') as any,
  validate(updateCampaignStatusSchema),
  (req: any, res: any, next: any) => advertisingController.updateCampaignStatus(req, res, next)
);

/**
 * @openapi
 * /advertising/all-campaigns:
 *   get:
 *     summary: "List all advertising campaigns (Admin)"
 *     tags:
 *       - Advertising
 */
router.get(
  '/all-campaigns',
  authenticate as any,
  authorize('ADMIN', 'SUPER_ADMIN') as any,
  (req: any, res: any, next: any) => advertisingController.listAllCampaigns(req, res, next)
);

export default router;
