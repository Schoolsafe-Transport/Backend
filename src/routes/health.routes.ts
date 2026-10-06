import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: System Health Check
 *     description: Returns the status and uptime of the SchoolSafe server.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Server is online and healthy.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 service:
 *                   type: string
 *                   example: SchoolSafe API
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   example: 12.34
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'SchoolSafe API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
