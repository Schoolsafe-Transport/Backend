import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken } from '../utils/security.util';
import { prisma } from '../config/prisma';

let ioInstance: any = null;

export const initSocketIO = (httpServer: HttpServer): any => {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, true);

        const cleanOrigin = origin.replace(/\/+$/, '');
        const allowedOrigins = [
          env.CLIENT_URL?.replace(/\/+$/, ''),
          env.FRONTEND_URL?.replace(/\/+$/, ''),
        ].filter(Boolean);

        if (
          allowedOrigins.includes(cleanOrigin) ||
          /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
          /^https:\/\/schoolsafe(-[a-z0-9]+)?\.vercel\.app$/.test(cleanOrigin)
        ) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
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

    // Trip room subscription for live tracking with family/driver access verification
    socket.on('join_trip', async (data: { tripId: string; token?: string } | string) => {
      try {
        const tripId = typeof data === 'string' ? data : data?.tripId;
        if (!tripId || typeof tripId !== 'string') return;

        const authToken = (typeof data !== 'string' && data?.token) || socket.handshake?.auth?.token;
        if (authToken) {
          try {
            const decoded = verifyAccessToken(authToken);
            const isAdmin = decoded.role === 'ADMIN' || decoded.role === 'SUPER_ADMIN';

            if (!isAdmin) {
              const trip = await prisma.trip.findUnique({
                where: { id: tripId },
                include: {
                  route: true,
                  passengers: {
                    include: { student: true },
                  },
                },
              });

              if (trip) {
                const isAssignedDriver = trip.driverId === decoded.userId;
                const isRouteProvider = trip.route?.providerId === decoded.userId;
                const hasChild = trip.passengers.some((p: any) => p.student?.parentId === decoded.userId);

                if (!isAssignedDriver && !isRouteProvider && !hasChild) {
                  socket.emit('auth_error', { message: 'Unauthorized: You do not have permission to view tracking for this trip' });
                  return;
                }
              }
            }
          } catch (_err) {
            socket.emit('auth_error', { message: 'Invalid or expired socket token' });
            return;
          }
        } else if (env.NODE_ENV === 'production') {
          socket.emit('auth_error', { message: 'Authentication required to subscribe to live trip tracking' });
          return;
        }

        socket.join(`trip:${tripId}`);
        socket.emit('joined_trip', { tripId });
      } catch (err) {
        // Safe catch
      }
    });

    socket.on('leave_trip', (data: { tripId: string } | string) => {
      const tripId = typeof data === 'string' ? data : data?.tripId;
      if (tripId && typeof tripId === 'string') {
        socket.leave(`trip:${tripId}`);
      }
    });

    // Driver live GPS emission with coordinate boundary validation and stale coordinate handling
    socket.on('driver_location', async (data: {
      tripId: string;
      latitude: number;
      longitude: number;
      speed?: number;
      heading?: number;
      timestamp?: string | number;
      token?: string;
      isSimulated?: boolean;
    }) => {
      if (data && data.tripId) {
        // Validate geographic coordinate boundaries
        if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') return;
        if (data.latitude < -90 || data.latitude > 90 || data.longitude < -180 || data.longitude > 180) return;

        // Discard stale coordinates (older than 120 seconds or future beyond 30s)
        if (data.timestamp) {
          const clientTime = typeof data.timestamp === 'string' ? new Date(data.timestamp).getTime() : data.timestamp;
          const now = Date.now();
          if (now - clientTime > 120000 || clientTime - now > 30000) {
            return;
          }
        }

        const authToken = data.token || socket.handshake?.auth?.token;
        if (authToken) {
          try {
            const decoded = verifyAccessToken(authToken);
            const isAdmin = decoded.role === 'ADMIN' || decoded.role === 'SUPER_ADMIN';
            if (!isAdmin) {
              const trip = await prisma.trip.findUnique({
                where: { id: data.tripId },
                include: { route: true },
              });
              if (trip) {
                const isAssignedDriver = trip.driverId === decoded.userId;
                const isRouteProvider = trip.route?.providerId === decoded.userId;
                if (!isAssignedDriver && !isRouteProvider) {
                  socket.emit('auth_error', { message: 'Unauthorized driver location telemetry' });
                  return;
                }
              }
            }
          } catch (_err) {
            socket.emit('auth_error', { message: 'Invalid or expired token for driver location' });
            return;
          }
        }

        // Broadcast to all tracking parents/admins in this trip's room
        (io as any).to(`trip:${data.tripId}`).emit('trip_location_update', {
          tripId: data.tripId,
          latitude: data.latitude,
          longitude: data.longitude,
          speed: data.speed || 0,
          heading: data.heading || 0,
          isSimulated: !!data.isSimulated,
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
