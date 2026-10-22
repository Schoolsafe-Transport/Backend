import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { emailService } from './email.service';
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
  ChangePasswordInput,
  UpdateProfileInput,
} from '../types/auth.types';
import { AppError } from '../middleware/errorHandler';

export class AuthService {
  /**
   * Generates a cryptographically secure, time-limited single-use email verification token.
   * Stores the SHA-256 hash in the database and applies a 60-second resend rate limit.
   */
  async generateEmailVerificationToken(userId: string): Promise<string> {
    // 60-second rate limiting per user
    const recentToken = await prisma.emailVerificationToken.findFirst({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
    });

    if (recentToken) {
      const error: AppError = new Error('Verification email was sent recently. Please wait 60 seconds before requesting another.');
      error.statusCode = 429;
      throw error;
    }

    // Invalidate any previously unconsumed tokens for this user
    await prisma.emailVerificationToken.updateMany({
      where: { userId, used: false },
      data: { used: true },
    });

    // Generate 32 bytes cryptographically random raw token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes validity

    await prisma.emailVerificationToken.create({
      data: {
        tokenHash,
        userId,
        used: false,
        expiresAt,
      },
    });

    return rawToken;
  }

  /**
   * Registers a new user account with role selection, password hashing, and token issuance.
   * Automatically initiates single-use email verification dispatch.
   */
  async register(
    input: RegisterInput
  ): Promise<AuthResponse & { verificationToken?: string; emailDelivery?: { delivered: boolean; error?: string } }> {
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

    if (input.role === 'SUPER_ADMIN') {
      const error: AppError = new Error('SUPER_ADMIN accounts cannot be registered via public registration');
      error.statusCode = 403;
      throw error;
    }

    if (input.role === 'ADMIN' && env.NODE_ENV === 'production') {
      const error: AppError = new Error('ADMIN accounts cannot be registered publicly in production');
      error.statusCode = 403;
      throw error;
    }

    const hashedPassword = await hashPassword(input.password);

    // Initial status: ACTIVE for parents, students; PENDING administrator approval for drivers, providers, and businesses
    const initialStatus =
      input.role === 'DRIVER' || input.role === 'TRANSPORT_PROVIDER' || input.role === 'BUSINESS'
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
        isEmailVerified: false,
        emailVerifiedAt: null,
      },
    });

    const jwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as any,
      status: user.status as any,
      isEmailVerified: false,
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

    // Generate single-use email verification token & dispatch email
    let verificationToken: string | undefined;
    let emailDelivery: { delivered: boolean; error?: string } = { delivered: false };
    try {
      verificationToken = await this.generateEmailVerificationToken(user.id);
      const sendRes = await emailService.sendVerificationEmail(user.email, user.firstName, verificationToken);
      emailDelivery = {
        delivered: sendRes.delivered,
        ...(sendRes.error ? { error: sendRes.error } : {}),
      };
    } catch (err: any) {
      console.error('[AuthService] Could not send verification email on registration:', err.message);
      emailDelivery = { delivered: false, error: err.message };
    }

    return {
      user: sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      },
      emailDelivery,
      ...(env.NODE_ENV !== 'production' && verificationToken ? { verificationToken } : {}),
    };
  }

  /**
   * Consumes a single-use email verification token and marks user email as verified.
   * Strictly isolates email verification from Fayda identity and administrator approval.
   */
  async verifyEmail(rawToken: string): Promise<{ message: string; user: UserSanitized }> {
    if (!rawToken || typeof rawToken !== 'string') {
      const error: AppError = new Error('Verification token is required');
      error.statusCode = 400;
      throw error;
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const tokenRecord = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord) {
      const error: AppError = new Error('Invalid email verification token');
      error.statusCode = 400;
      throw error;
    }

    if (tokenRecord.used) {
      const error: AppError = new Error('Email verification token has already been used');
      error.statusCode = 400;
      throw error;
    }

    if (tokenRecord.expiresAt < new Date()) {
      const error: AppError = new Error('Email verification token has expired. Please request a new verification link.');
      error.statusCode = 400;
      throw error;
    }

    // Atomically consume token and verify email
    const [, updatedUser] = await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { used: true },
      }),
      prisma.user.update({
        where: { id: tokenRecord.userId },
        data: {
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Email address verified successfully.',
      user: sanitizeUser(updatedUser),
    };
  }

  /**
   * Dispatches a fresh email verification link with rate limiting.
   */
  async resendVerificationEmail(
    identifier: string
  ): Promise<{ success: boolean; delivered: boolean; message: string; error?: string; verificationToken?: string; verificationUrl?: string }> {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: identifier },
          { email: identifier.toLowerCase().trim() },
        ],
      },
    });

    // Generic response if not found to prevent user enumeration
    if (!user) {
      return {
        success: true,
        delivered: false,
        message: 'If an account exists with this email address, a verification link has been dispatched.',
      };
    }

    if (user.isEmailVerified) {
      return {
        success: true,
        delivered: false,
        message: 'Email address is already verified.',
      };
    }

    const rawToken = await this.generateEmailVerificationToken(user.id);
    const dispatchResult = await emailService.sendVerificationEmail(user.email, user.firstName, rawToken);

    if (!dispatchResult.delivered) {
      return {
        success: false,
        delivered: false,
        message: dispatchResult.error
          ? `Could not deliver verification email: ${dispatchResult.error}`
          : 'Verification link generated, but outbound email delivery failed. SMTP credentials must be configured on the server.',
        error: dispatchResult.error || 'SMTP delivery unavailable',
        ...(env.NODE_ENV !== 'production' ? { verificationToken: rawToken, verificationUrl: dispatchResult.verificationUrl } : {}),
      };
    }

    return {
      success: true,
      delivered: true,
      message: 'A fresh verification link has been sent to your email address.',
      ...(env.NODE_ENV !== 'production' ? { verificationToken: rawToken, verificationUrl: dispatchResult.verificationUrl } : {}),
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

  /**
   * Changes password for an authenticated user after verifying current password.
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const isValid = await comparePassword(input.currentPassword, user.passwordHash);
    if (!isValid) {
      const error: AppError = new Error('Current password is incorrect');
      error.statusCode = 400;
      throw error;
    }

    const newHashedPassword = await hashPassword(input.newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHashedPassword },
    });

    // Revoke all existing refresh tokens for security
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });

    return {
      message: 'Password changed successfully. Please log in again with your new credentials.',
    };
  }

  /**
   * Updates profile information (first name, last name, phone, profile photo).
   */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserSanitized> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (input.phone && input.phone !== user.phone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone: input.phone, NOT: { id: userId } },
      });
      if (existingPhone) {
        const error: AppError = new Error('Phone number is already associated with another account');
        error.statusCode = 409;
        throw error;
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.firstName ? { firstName: input.firstName } : {}),
        ...(input.lastName ? { lastName: input.lastName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.profilePhoto !== undefined ? { profilePhoto: input.profilePhoto || null } : {}),
      },
    });

    return sanitizeUser(updated);
  }
}

export const authService = new AuthService();
