import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { swaggerSpec } from './config/swagger';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { generalRateLimiter } from './middleware/rateLimiter';
import apiRoutes from './routes';

const app: Application = express();
app.use(helmet({
  contentSecurityPolicy: false,
  frameguard: false,
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
}));
app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/+$/, '');
      const allowedOrigins = [
        env.CLIENT_URL?.replace(/\/+$/, ''),
        env.FRONTEND_URL?.replace(/\/+$/, ''),
      ].filter(Boolean);

      if (allowedOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }

      // Allow any localhost or 127.0.0.1 port (e.g. 5173, 5174, 3000)
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // Allow Vercel deployments (*.vercel.app)
      if (/^https:\/\/schoolsafe(-[a-z0-9]+)?\.vercel\.app$/.test(cleanOrigin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);

// Logging Middleware
app.use(requestLogger);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI Documentation Endpoint
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Root Router with General Rate Limiting
app.use('/api', generalRateLimiter, apiRoutes);

// Fallback: alias API routes directly on root in case clients omit the /api prefix
app.use('/', generalRateLimiter, apiRoutes);

// Root Index Redirect to API docs
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'SchoolSafe API',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/api/health',
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
