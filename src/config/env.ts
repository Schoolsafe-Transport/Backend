import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val: string) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/schoolsafe_db?schema=public'),
  JWT_ACCESS_SECRET: z.string().default('schoolsafe_default_access_secret_development_only_12345'),
  JWT_REFRESH_SECRET: z.string().default('schoolsafe_default_refresh_secret_development_only_12345'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Fayda National ID (OIDC / eSignet) — optional in dev, required in prod
  FAYDA_CLIENT_ID: z.string().optional(),
  FAYDA_CLIENT_SECRET: z.string().optional(),
  FAYDA_REDIRECT_URI: z.string().default('http://localhost:5000/api/fayda/callback'),
  FAYDA_ISSUER_URL: z.string().default('https://esignet.ida.fayda.et'),
  FAYDA_AUTHORIZE_URL: z.string().default('https://esignet.ida.fayda.et/authorize'),
  FAYDA_TOKEN_URL: z.string().default('https://esignet.ida.fayda.et/v1/esignet/oauth/v2/token'),
  FAYDA_USERINFO_URL: z.string().default('https://esignet.ida.fayda.et/v1/esignet/oidc/userinfo'),

  // Email (SMTP for account verification and notification emails)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@schoolsafe.et'),
  FRONTEND_URL: z.string().optional(),

  // Private File Storage (Receipts & Evidence)
  RECEIPTS_STORAGE_DIR: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment configuration:', parsedEnv.error.format());
  process.exit(1);
}

const resolvedClientUrl = (parsedEnv.data.CLIENT_URL || parsedEnv.data.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
const resolvedFrontendUrl = (parsedEnv.data.FRONTEND_URL || parsedEnv.data.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
const resolvedSmtpPass = parsedEnv.data.SMTP_PASSWORD || parsedEnv.data.SMTP_PASS;

export const env = {
  ...parsedEnv.data,
  CLIENT_URL: resolvedClientUrl,
  FRONTEND_URL: resolvedFrontendUrl,
  SMTP_PASS: resolvedSmtpPass,
  SMTP_PASSWORD: resolvedSmtpPass,
};


