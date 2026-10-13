import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env';

let ioInstance: any = null;

export const initSocketIO = (httpServer: HttpServer): any => {
  const io = new Server(httpServer, {
    cors: {
      origin: [env.CLIENT_URL, 'http://localhost:3000', 'http://localhost:5173'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: any) => {
    // Authenticated user room binding
    socket.on('join_user', (userId: string) => {
      if (userId) {
        socket.join(`user:${userId}`);
      }
    });

    // Foundational ping/pong for connectivity check
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', (_reason: string) => {
      // Disconnection handling
    });
  });

  ioInstance = io;
  return io;
};

export const getIO = (): any => ioInstance;

export const emitToUser = (userId: string, event: string, payload: any): void => {
  if (ioInstance) {
    try {
      ioInstance.to(`user:${userId}`).emit(event, payload);
      ioInstance.emit(`notify:${userId}`, { event, payload });
    } catch (_err) {
      // Socket emission error handling
    }
  }
};
