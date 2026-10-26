import http from 'http';
import { execSync } from 'child_process';
import app from './app';
import { env } from './config/env';
import { initSocketIO } from './socket';

// Auto-run Prisma migrations on server startup to ensure tables exist
const runDatabaseMigrations = () => {
  if (process.env.NODE_ENV === 'test' || process.env.SKIP_MIGRATIONS === 'true') {
    return;
  }
  try {
    console.log('🔄 Checking and applying database migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('✅ Database migrations verified/applied.');
  } catch (migrateErr) {
    console.warn('⚠️ "prisma migrate deploy" encountered an issue. Falling back to "prisma db push"...');
    try {
      execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit' });
      console.log('✅ Database schema synchronized with db push.');
    } catch (pushErr) {
      console.error('❌ Failed to synchronize database schema:', pushErr);
    }
  }
};

runDatabaseMigrations();

// Ensure only real data exists and administrator account is active
const ensureInitialAdminAndStatuses = async () => {
  if (process.env.NODE_ENV === 'test') return;
  try {
    const { prisma } = await import('./config/prisma');
    const { purgeMockExampleData, ensureRealAdministrator } = await import('./services/seed.service');

    // Purge mock example accounts (@schoolsafe.org) so only real users exist
    await purgeMockExampleData(prisma);

    // Confirm real platform administrator
    await ensureRealAdministrator(prisma);
  } catch (err: any) {
    console.error('⚠️ Could not complete real admin setup:', err.message);
  }
};

const server = http.createServer(app as any);

export const io = initSocketIO(server);

server.listen(env.PORT, async () => {
  console.log(`===============================================`);
  console.log(`🚀 SchoolSafe Server running on port ${env.PORT}`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
  console.log(`📚 Swagger Docs: http://localhost:${env.PORT}/api/docs`);
  console.log(`🩺 Health Check: http://localhost:${env.PORT}/api/health`);
  console.log(`===============================================`);
  await ensureInitialAdminAndStatuses();
});

// Graceful Shutdown Handling
const shutdown = () => {
  console.log('Shutting down SchoolSafe server gracefully...');
  server.close(() => {
    console.log('HTTP and WebSocket server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
