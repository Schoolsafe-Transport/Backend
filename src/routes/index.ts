import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';

const router = Router();

// Register system and feature endpoints
router.use('/', healthRoutes);
router.use('/auth', authRoutes);

export default router;
