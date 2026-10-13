import swaggerJSDoc from 'swagger-jsdoc';
import { env } from './env';

const swaggerOptions: any = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SchoolSafe API Documentation',
      version: '1.0.0',
      description:
        'RESTful API for SchoolSafe: Smart School Transportation, Child Safety & Advertising Platform.',
      contact: {
        name: 'SchoolSafe Engineering Team',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api`,
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);
