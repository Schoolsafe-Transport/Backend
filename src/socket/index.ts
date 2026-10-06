import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';

export const initSocketIO = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: [env.CLIENT_URL, 'http://localhost:3000', 'http://localhost:5173'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Foundational ping/pong for connectivity check
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (Reason: ${reason})`);
    });
  });

  return io;
};
