import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Protect all admin endpoints to ADMIN and SUPER_ADMIN roles
router.use(authenticate as any);
router.use(authorize('ADMIN', 'SUPER_ADMIN') as any);

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

export default router;
