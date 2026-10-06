import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  sanitizeUser,
} from '../utils/security.util';
import {
  RegisterInput,
  LoginInput,
  AuthResponse,
  AuthTokens,
  UserSanitized,
} from '../types/auth.types';
import { AppError } from '../middleware/errorHandler';

export class AuthService {
  /**
   * Registers a new user account with role selection, password hashing, and token issuance.
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.email },
          ...(input.phone ? [{ phone: input.phone }] : []),
        ],
      },
    });

    if (existingUser) {
      const error: AppError = new Error(
        existingUser.email === input.email
          ? 'An account with this email address already exists'
          : 'An account with this phone number already exists'
      );
      error.statusCode = 409;
      throw error;
    }

    const hashedPassword = await hashPassword(input.password);

    // Initial status: ACTIVE for parents, students, businesses; PENDING verification for drivers/providers
    const initialStatus =
      input.role === 'DRIVER' || input.role === 'TRANSPORT_PROVIDER'
        ? 'PENDING'
        : 'ACTIVE';

    const user = await prisma.user.create({
      data: {
        email: input.email,
        phone: input.phone || null,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash: hashedPassword,
        role: input.role as any,
        status: initialStatus,
      },
    });

    const jwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as any,
      status: user.status as any,
    };

    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken(jwtPayload);

    // Store refresh token in database (valid for 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      user: sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      },
    };
  }

  /**
   * Authenticates user credentials, validates account status, and issues session tokens.
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      const error: AppError = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isPasswordValid = await comparePassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      const error: AppError = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    if (user.status === 'SUSPENDED') {
      const error: AppError = new Error('Your account has been suspended. Please contact support.');
      error.statusCode = 403;
      throw error;
    }

    if (user.status === 'REJECTED') {
      const error: AppError = new Error('Your account application was rejected.');
      error.statusCode = 403;
      throw error;
    }

    const jwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as any,
      status: user.status as any,
    };

    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken(jwtPayload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      user: sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      },
    };
  }

  /**
   * Rotates refresh tokens and issues a new access token to prevent replay attacks.
   */
  async refreshToken(refreshTokenStr: string): Promise<AuthTokens> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshTokenStr);
    } catch (_err) {
      const error: AppError = new Error('Invalid or expired refresh token');
      error.statusCode = 401;
      throw error;
    }

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenStr },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.revoked || tokenRecord.expiresAt < new Date()) {
      // Replay attack mitigation: if an already revoked token is used, invalidate all sessions
      if (tokenRecord?.revoked) {
        await prisma.refreshToken.updateMany({
          where: { userId: tokenRecord.userId },
          data: { revoked: true },
        });
      }
      const error: AppError = new Error('Refresh token is invalid, expired, or revoked');
      error.statusCode = 401;
      throw error;
    }

    // Revoke the used refresh token (Rotation)
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revoked: true },
    });

    const user = tokenRecord.user;
    const newPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as any,
      status: user.status as any,
    };

    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    };
  }

  /**
   * Invalidates a refresh token to securely terminate user session.
   */
  async logout(refreshTokenStr: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token: refreshTokenStr },
      data: { revoked: true },
    });
  }

  /**
   * Generates a time-limited password reset token.
   */
  async forgotPassword(
    email: string
  ): Promise<{ message: string; resetToken?: string }> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Uniform message returned to prevent account enumeration
    const genericResponse = {
      message: 'If an account exists with this email, a password reset link has been dispatched.',
    };

    if (!user) {
      return genericResponse;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

    await prisma.passwordResetToken.create({
      data: {
        token: resetToken,
        userId: user.id,
        expiresAt,
      },
    });

    // In dev/test environments, expose token in response for testing
    return {
      ...genericResponse,
      ...(env.NODE_ENV !== 'production' && { resetToken }),
    };
  }

  /**
   * Verifies reset token, updates password hash, marks token as used, and invalidates sessions.
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
      const error: AppError = new Error('Invalid, used, or expired password reset token');
      error.statusCode = 400;
      throw error;
    }

    const newHashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash: newHashedPassword },
    });

    // Invalidate reset token
    await prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { used: true },
    });

    // Security: Revoke all existing refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId: resetRecord.userId },
      data: { revoked: true },
    });

    return {
      message: 'Password has been successfully updated. Please sign in with your new credentials.',
    };
  }

  /**
   * Retrieves profile details for the authenticated user without exposing password hashes.
   */
  async getProfile(userId: string): Promise<UserSanitized> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    return sanitizeUser(user);
  }
}

export const authService = new AuthService();
