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

export default router;
