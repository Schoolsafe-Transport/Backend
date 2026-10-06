import { Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { verifyAccessToken, sanitizeUser } from '../utils/security.util';
import { AuthenticatedRequest, UserRole } from '../types/auth.types';
import { AppError } from './errorHandler';

/**
 * Middleware to verify JWT Access Token and attach sanitized user to request.
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error: AppError = new Error('Access denied: No token provided');
      error.statusCode = 401;
      return next(error);
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (_err) {
      const error: AppError = new Error('Access denied: Invalid or expired token');
      error.statusCode = 401;
      return next(error);
    }

    // Verify user still exists in database and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      const error: AppError = new Error('User account not found');
      error.statusCode = 401;
      return next(error);
    }

    if (user.status === 'SUSPENDED') {
      const error: AppError = new Error('Account suspended: Contact platform administration');
      error.statusCode = 403;
      return next(error);
    }

    if (user.status === 'REJECTED') {
      const error: AppError = new Error('Account rejected: Registration was not approved');
      error.statusCode = 403;
      return next(error);
    }

    req.user = sanitizeUser(user);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-Based Access Control (RBAC) authorization middleware.
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      const error: AppError = new Error('Unauthorized');
      error.statusCode = 401;
      return next(error);
    }

    if (!allowedRoles.includes(req.user.role)) {
      const error: AppError = new Error(
        `Forbidden: Role '${req.user.role}' is not authorized to access this resource`
      );
      error.statusCode = 403;
      return next(error);
    }

    next();
  };
};

/**
 * Middleware ensuring a user can only access their own resources unless they are an ADMIN.
 */
export const requireSelfOrAdmin = (paramKey: string = 'userId') => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      const error: AppError = new Error('Unauthorized');
      error.statusCode = 401;
      return next(error);
    }

    const targetUserId = req.params[paramKey] || req.body[paramKey];
    const isOwner = req.user.id === targetUserId;
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      const error: AppError = new Error('Forbidden: You cannot access or modify another user\'s resources');
      error.statusCode = 403;
      return next(error);
    }

    next();
  };
};
