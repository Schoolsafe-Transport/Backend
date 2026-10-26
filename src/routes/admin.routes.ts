import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { applicationDecisionSchema } from '../schemas/admin.schema';

const router = Router();

// Protect all admin endpoints to ADMIN and SUPER_ADMIN roles
router.use(authenticate as any);
router.use(authorize('ADMIN', 'SUPER_ADMIN') as any);

/**
 * @openapi
 * /admin/applications:
 *   get:
 *     summary: "List provider, driver, and business registration applications"
 *     tags:
 *       - Administration
 */
router.get('/applications', (req: any, res: any, next: any) =>
  adminController.listApplications(req, res, next)
);

/**
 * @openapi
 * /admin/applications/{userId}/review:
 *   post:
 *     summary: "Approve, reject, or suspend a registration application"
 *     tags:
 *       - Administration
 */
router.post(
  '/applications/:userId/review',
  validate(applicationDecisionSchema),
  (req: any, res: any, next: any) => adminController.reviewApplication(req, res, next)
);

(router as any).patch(
  '/applications/:userId/review',
  validate(applicationDecisionSchema),
  (req: any, res: any, next: any) => adminController.reviewApplication(req, res, next)
);

/**
 * @openapi
 * /admin/users:
 *   get:
 *     summary: "Paginated user list with role/status filters and search"
 *     tags:
 *       - Administration
 */
router.get('/users', (req: any, res: any, next: any) =>
  adminController.listUsers(req, res, next)
);

/**
 * @openapi
 * /admin/users/{userId}/status:
 *   patch:
 *     summary: "Update account status of a user (approve, suspend, reject, activate)"
 *     tags:
 *       - Administration
 */
(router as any).patch('/users/:userId/status', (req: any, res: any, next: any) =>
  adminController.updateUserStatus(req, res, next)
);

/**
 * @openapi
 * /admin/users/{userId}:
 *   delete:
 *     summary: "Permanently delete a user account"
 *     tags:
 *       - Administration
 */
router.delete('/users/:userId', (req: any, res: any, next: any) =>
  adminController.deleteUser(req, res, next)
);

/**
 * @openapi
 * /admin/stats:
 *   get:
 *     summary: "Retrieve aggregate platform metrics and financial indicators"
 *     tags:
 *       - Administration
 */
router.get('/stats', (req: any, res: any, next: any) =>
  adminController.getPlatformStats(req, res, next)
);

/**
 * @openapi
 * /admin/safety-incidents:
 *   get:
 *     summary: "List all safety incidents across the platform"
 *     tags:
 *       - Administration
 */
router.get('/safety-incidents', (req: any, res: any, next: any) =>
  adminController.listSafetyIncidents(req, res, next)
);

/**
 * @openapi
 * /admin/safety-incidents/{incidentId}/resolve:
 *   patch:
 *     summary: "Resolve safety incident with administrative notes"
 *     tags:
 *       - Administration
 */
(router as any).patch('/safety-incidents/:incidentId/resolve', (req: any, res: any, next: any) =>
  adminController.resolveSafetyIncident(req, res, next)
);

/**
 * @openapi
 * /admin/payments:
 *   get:
 *     summary: "List all payments submitted for review or historical records"
 *     tags:
 *       - Administration
 */
router.get('/payments', (req: any, res: any, next: any) =>
  adminController.listPayments(req, res, next)
);

/**
 * @openapi
 * /admin/payments/{paymentId}/review:
 *   patch:
 *     summary: "Approve, reject, or request another receipt for a payment"
 *     tags:
 *       - Administration
 */
(router as any).patch('/payments/:paymentId/review', (req: any, res: any, next: any) =>
  adminController.reviewPayment(req, res, next)
);

/**
 * @openapi
 * /admin/audit-logs:
 *   get:
 *     summary: "List chronological administrative audit logs"
 *     tags:
 *       - Administration
 */
router.get('/audit-logs', (req: any, res: any, next: any) =>
  adminController.listAuditLogs(req, res, next)
);

/**
 * @openapi
 * /admin/documents/{id}/review:
 *   patch:
 *     summary: "Approve or reject a provider/business document"
 *     tags:
 *       - Administration
 */
(router as any).patch('/documents/:id/review', (req: any, res: any, next: any) =>
  adminController.reviewAccountDocument(req, res, next)
);

/**
 * @openapi
 * /admin/vehicles:
 *   get:
 *     summary: "List all fleet vehicles with verification status and provider info"
 *     tags:
 *       - Administration
 */
router.get('/vehicles', (req: any, res: any, next: any) =>
  adminController.listVehicles(req, res, next)
);

/**
 * @openapi
 * /admin/vehicles/{vehicleId}/review:
 *   patch:
 *     summary: "Approve or reject a vehicle verification request"
 *     tags:
 *       - Administration
 */
(router as any).patch('/vehicles/:vehicleId/review', (req: any, res: any, next: any) =>
  adminController.reviewVehicle(req, res, next)
);

/**
 * @openapi
 * /admin/routes:
 *   get:
 *     summary: "List all platform transit routes with stops and agreements"
 *     tags:
 *       - Administration
 */
router.get('/routes', (req: any, res: any, next: any) =>
  adminController.listRoutes(req, res, next)
);

/**
 * @openapi
 * /admin/trips:
 *   get:
 *     summary: "List all transit dispatches and live trips"
 *     tags:
 *       - Administration
 */
router.get('/trips', (req: any, res: any, next: any) =>
  adminController.listTrips(req, res, next)
);

/**
 * @openapi
 * /admin/campaigns:
 *   get:
 *     summary: "List all advertising campaigns across businesses"
 *     tags:
 *       - Administration
 */
router.get('/campaigns', (req: any, res: any, next: any) =>
  adminController.listCampaigns(req, res, next)
);

/**
 * @openapi
 * /admin/campaigns/{campaignId}/review:
 *   patch:
 *     summary: "Approve or reject an advertising campaign"
 *     tags:
 *       - Administration
 */
(router as any).patch('/campaigns/:campaignId/review', (req: any, res: any, next: any) =>
  adminController.reviewCampaign(req, res, next)
);

/**
 * @openapi
 * /admin/purge-mock-data:
 *   post:
 *     summary: "Purge all mock example data (*@schoolsafe.org) (Admin only)"
 *     tags:
 *       - Administration
 */
router.post('/purge-mock-data', (req: any, res: any, next: any) =>
  adminController.purgeMockData(req, res, next)
);

export default router;
