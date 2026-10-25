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

// Seed default administrator if none exists & ensure unapproved accounts are PENDING
const ensureInitialAdminAndStatuses = async () => {
  if (process.env.NODE_ENV === 'test') return;
  try {
    const { prisma } = await import('./config/prisma');
    const bcrypt = await import('bcryptjs');

    const adminCount = await prisma.user.count({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    });

    if (adminCount === 0) {
      console.log('🌱 Seeding initial platform administrator...');
      const adminPasswordHash = await bcrypt.hash('AdminSafe123!', 12);
      await prisma.user.create({
        data: {
          email: 'admin@schoolsafe.org',
          passwordHash: adminPasswordHash,
          firstName: 'SchoolSafe',
          lastName: 'Administrator',
          role: 'ADMIN',
          status: 'ACTIVE',
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          isVerified: true,
        },
      });
      console.log('✅ Default administrator seeded: admin@schoolsafe.org');
    }

    // Set any registered account awaiting admin approval to PENDING
    await prisma.user.updateMany({
      where: {
        email: { in: ['nabalura@gmail.com'] },
        role: 'PARENT',
      },
      data: {
        status: 'PENDING',
      },
    });
  } catch (err: any) {
    console.error('⚠️ Could not run admin/status check:', err.message);
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
