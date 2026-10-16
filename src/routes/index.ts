import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import transportationRoutes from './transportation.routes';
import notificationRoutes from './notification.routes';
import faydaRoutes from './fayda.routes';
import advertisingRoutes from './advertising.routes';
import adminRoutes from './admin.routes';
import ratingRoutes from './rating.routes';

const router = Router();

// Register system and feature endpoints
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/transportation', transportationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/fayda', faydaRoutes);
router.use('/advertising', advertisingRoutes);
router.use('/admin', adminRoutes);
router.use('/ratings', ratingRoutes);

export default router;
