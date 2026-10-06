import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { swaggerSpec } from './config/swagger';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import apiRoutes from './routes';

const app: Application = express();

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Allows Swagger UI to load its assets
}));
app.use(
  cors({
    origin: [env.CLIENT_URL, 'http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  })
);

// Logging Middleware
app.use(requestLogger);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI Documentation Endpoint
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Root Router
app.use('/api', apiRoutes);

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
