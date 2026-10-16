import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken } from '../utils/security.util';

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
    // Authenticated user room binding with token verification
    socket.on('join_user', (data: { userId: string; token?: string } | string) => {
      try {
        let requestedUserId: string;
        let token: string | undefined;

        if (typeof data === 'string') {
          requestedUserId = data;
        } else {
          requestedUserId = data.userId;
          token = data.token;
        }

        // If a token is provided or passed in handshake, verify it
        const authToken = token || socket.handshake?.auth?.token;
        if (authToken) {
          try {
            const decoded = verifyAccessToken(authToken);
            // Secure bind to decoded user id
            socket.join(`user:${decoded.userId}`);
            socket.emit('joined_user_success', { userId: decoded.userId });
            return;
          } catch (_err) {
            // Invalid token
            socket.emit('auth_error', { message: 'Invalid or expired socket token' });
            return;
          }
        }

        if (env.NODE_ENV === 'production') {
          socket.emit('auth_error', { message: 'Authentication token required to join private user events' });
          return;
        }

        // Fallback for local development if token omitted
        if (requestedUserId) {
          socket.join(`user:${requestedUserId}`);
          socket.emit('joined_user_success', { userId: requestedUserId });
        }
      } catch (err) {
        // Safe catch
      }
    });

    // Trip room subscription for live tracking
    socket.on('join_trip', (data: { tripId: string; token?: string } | string) => {
      const tripId = typeof data === 'string' ? data : data?.tripId;
      if (tripId && typeof tripId === 'string') {
        socket.join(`trip:${tripId}`);
        socket.emit('joined_trip', { tripId });
      }
    });

    socket.on('leave_trip', (data: { tripId: string } | string) => {
      const tripId = typeof data === 'string' ? data : data?.tripId;
      if (tripId && typeof tripId === 'string') {
        socket.leave(`trip:${tripId}`);
      }
    });

    // Driver live GPS emission
    socket.on('driver_location', (data: { tripId: string; latitude: number; longitude: number; speed?: number; heading?: number }) => {
      if (data && data.tripId) {
        // Validate geographic coordinate boundaries
        if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') return;
        if (data.latitude < -90 || data.latitude > 90 || data.longitude < -180 || data.longitude > 180) return;

        // Broadcast to all tracking parents/admins in this trip's room
        (io as any).to(`trip:${data.tripId}`).emit('trip_location_update', {
          tripId: data.tripId,
          latitude: data.latitude,
          longitude: data.longitude,
          speed: data.speed || 0,
          heading: data.heading || 0,
          timestamp: new Date().toISOString(),
        });
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

export const emitToTrip = (tripId: string, event: string, payload: any): void => {
  if (ioInstance) {
    try {
      ioInstance.to(`trip:${tripId}`).emit(event, payload);
    } catch (_err) {
      // Socket emission error handling
    }
  }
};
