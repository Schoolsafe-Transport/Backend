import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', notificationController.getNotifications.bind(notificationController));
(router as any).patch('/read-all', notificationController.markAllAsRead.bind(notificationController));
(router as any).patch('/:id/read', notificationController.markAsRead.bind(notificationController));
router.post('/read-all', notificationController.markAllAsRead.bind(notificationController));
router.post('/:id/read', notificationController.markAsRead.bind(notificationController));

export default router;
