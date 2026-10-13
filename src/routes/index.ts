import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import transportationRoutes from './transportation.routes';

const router = Router();

// Register system and feature endpoints
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/transportation', transportationRoutes);

export default router;
