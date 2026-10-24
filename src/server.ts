import http from 'http';
import app from './app';
import { env } from './config/env';
import { initSocketIO } from './socket';

const server = http.createServer(app as any);


export const io = initSocketIO(server);

server.listen(env.PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 SchoolSafe Server running on port ${env.PORT}`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
  console.log(`📚 Swagger Docs: http://localhost:${env.PORT}/api/docs`);
  console.log(`🩺 Health Check: http://localhost:${env.PORT}/api/health`);
  console.log(`===============================================`);
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
