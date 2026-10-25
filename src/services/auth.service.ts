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
import { getDocumentFilePath } from '../utils/documentStorage.util';
import {
  RegisterInput,
  LoginInput,
  AuthResponse,
  AuthTokens,
  UserSanitized,
  UserRole,
  ChangePasswordInput,
  UpdateProfileInput,
} from '../types/auth.types';

import { AppError } from '../middleware/errorHandler';

export class AuthService {
  /**
   * Generates a cryptographically secure, time-limited single-use email verification token.
   * Stores the SHA-256 hash in the database and applies a 60-second resend rate limit.
   */
  async generateEmailVerificationToken(userId: string): Promise<{ rawToken: string; sixDigitCode: string }> {
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

    // Generate 32 bytes cryptographically random raw token & 6-digit numeric verification code
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const sixDigitCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes validity

    await prisma.emailVerificationToken.create({
      data: {
        tokenHash,
        sixDigitCode,
        userId,
        used: false,
        expiresAt,
      },
    });

    return { rawToken, sixDigitCode };
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

    // Initial status: All publicly registered users require administrator approval
    const initialStatus = 'PENDING';

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
      scope: 'ONBOARDING' as const,
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
    let sixDigitCode: string | undefined;
    let emailDelivery: { delivered: boolean; error?: string } = { delivered: false };
    try {
      const generated = await this.generateEmailVerificationToken(user.id);
      verificationToken = generated.rawToken;
      sixDigitCode = generated.sixDigitCode;
      const sendRes = await emailService.sendVerificationEmail(user.email, user.firstName, verificationToken, sixDigitCode);
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
      ...(env.NODE_ENV !== 'production' && verificationToken ? { verificationToken, sixDigitCode } : {}),
    };
  }

  /**
   * Consumes a single-use email verification token and marks user email as verified.
   * Strictly isolates email verification from Fayda identity and administrator approval.
   */
  async verifyEmail(
    rawToken: string
  ): Promise<{ message: string; user: UserSanitized; tokens?: AuthTokens; nextStep?: string }> {
    if (!rawToken || typeof rawToken !== 'string') {
      const error: AppError = new Error('Verification token is required');
      error.statusCode = 400;
      throw error;
    }

    const cleanInput = rawToken.trim();
    let tokenRecord = null;

    // 1. If user supplied a 6-digit numeric verification code
    if (/^\d{6}$/.test(cleanInput)) {
      tokenRecord = await prisma.emailVerificationToken.findFirst({
        where: { sixDigitCode: cleanInput, used: false },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    // 2. Fall back to SHA-256 token hash lookup (direct link clicks or test tokens)
    if (!tokenRecord) {
      const tokenHash = crypto.createHash('sha256').update(cleanInput).digest('hex');
      tokenRecord = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
    }

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

    const isFullyVerified = true;

    const jwtPayload = {
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role as any,
      status: updatedUser.status as any,
      scope: 'FULL' as const,
    };

    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken(jwtPayload);

    return {
      message: 'Email address verified successfully.',
      user: sanitizeUser(updatedUser),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      },
      nextStep: 'DASHBOARD',
    };
  }


  /**
   * Dispatches a fresh email verification link with rate limiting.
   */
  async resendVerificationEmail(
    identifier: string
  ): Promise<{ success: boolean; delivered: boolean; message: string; error?: string; verificationToken?: string; sixDigitCode?: string; verificationUrl?: string }> {
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

    const { rawToken, sixDigitCode } = await this.generateEmailVerificationToken(user.id);
    const dispatchResult = await emailService.sendVerificationEmail(user.email, user.firstName, rawToken, sixDigitCode);

    if (!dispatchResult.delivered) {
      return {
        success: false,
        delivered: false,
        message: dispatchResult.error
          ? `Could not deliver verification email: ${dispatchResult.error}`
          : 'Verification link generated, but outbound email delivery failed. SMTP credentials must be configured on the server.',
        error: dispatchResult.error || 'SMTP delivery unavailable',
        ...(env.NODE_ENV !== 'production' ? { verificationToken: rawToken, sixDigitCode, verificationUrl: dispatchResult.verificationUrl } : {}),
      };
    }

    return {
      success: true,
      delivered: true,
      message: 'A fresh verification link has been sent to your email address.',
      ...(env.NODE_ENV !== 'production' ? { verificationToken: rawToken, sixDigitCode, verificationUrl: dispatchResult.verificationUrl } : {}),
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
      error.code = 'UNAUTHENTICATED';
      throw error;
    }

    const isPasswordValid = await comparePassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      const error: AppError = new Error('Invalid email or password');
      error.statusCode = 401;
      error.code = 'UNAUTHENTICATED';
      throw error;
    }

    if (user.status === 'SUSPENDED') {
      const error: AppError = new Error('Your account has been suspended. Please contact support.');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    if (user.status === 'REJECTED') {
      const error: AppError = new Error('Your account application was rejected.');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // TASK 3: Deny normal login if email is not verified
    if (!user.isEmailVerified) {
      const onboardingToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role as any,
        status: user.status as any,
        scope: 'ONBOARDING',
      });

      const error: AppError = new Error('Email verification required. Please verify your email address to continue.');
      error.statusCode = 403;
      error.code = 'EMAIL_VERIFICATION_REQUIRED';
      error.details = {
        code: 'EMAIL_VERIFICATION_REQUIRED',
        email: user.email,
        user: sanitizeUser(user),
        onboardingToken,
      };
      throw error;
    }


    const jwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as any,
      status: user.status as any,
      scope: 'FULL' as const,
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
      error.code = 'UNAUTHENTICATED';
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
      error.code = 'UNAUTHENTICATED';
      throw error;
    }

    // Revoke the used refresh token (Rotation)
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revoked: true },
    });

    const user = tokenRecord.user;

    if (user.status === 'SUSPENDED' || user.status === 'REJECTED') {
      const error: AppError = new Error('Account suspended or rejected');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    if (!user.isEmailVerified) {
      const error: AppError = new Error('Email verification required');
      error.statusCode = 403;
      error.code = 'EMAIL_VERIFICATION_REQUIRED';
      throw error;
    }

    const rolesRequiringFayda: UserRole[] = ['PARENT', 'TRANSPORT_PROVIDER', 'DRIVER'];
    if (rolesRequiringFayda.includes(user.role as any) && !user.isVerified) {
      const error: AppError = new Error('Fayda National ID verification required');
      error.statusCode = 403;
      error.code = 'FAYDA_VERIFICATION_REQUIRED';
      throw error;
    }

    const newPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as any,
      status: user.status as any,
      scope: 'FULL' as const,
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

  /**
   * Saves onboarding profile details (legal/business name, license, service area, etc.)
   */
  async saveOnboardingProfile(
    userId: string,
    input: {
      businessName?: string;
      licenseNumber?: string;
      serviceArea?: string;
      phone?: string;
      step?: number;
    }
  ): Promise<UserSanitized> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.businessName ? { businessName: input.businessName.trim() } : {}),
        ...(input.licenseNumber ? { licenseNumber: input.licenseNumber.trim() } : {}),
        ...(input.serviceArea ? { serviceArea: input.serviceArea.trim() } : {}),
        ...(input.phone ? { phone: input.phone.trim() } : {}),
        ...(input.step ? { registrationStep: input.step } : {}),
      },
      include: {
        accountDocuments: true,
      },
    });

    return sanitizeUser(updated);
  }

  /**
   * Uploads and stores an account verification document (driver license, business registration, etc.)
   */
  async uploadAccountDocument(
    userId: string,
    file: Express.Multer.File,
    documentType: string,
    documentName?: string,
    expiryDate?: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const doc = await prisma.accountDocument.create({
      data: {
        userId,
        documentType: documentType.trim(),
        documentName: documentName ? documentName.trim() : file.originalname,
        fileUrl: file.filename,
        fileMimeType: file.mimetype,
        fileSize: file.size,
        status: 'PENDING',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
    });

    return {
      id: doc.id,
      documentType: doc.documentType,
      documentName: doc.documentName,
      status: doc.status,
      createdAt: doc.createdAt,
    };
  }

  /**
   * Retrieves all account documents for the authenticated user.
   */
  async getMyDocuments(userId: string) {
    const docs = await prisma.accountDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return docs.map((d: any) => ({
      id: d.id,
      documentType: d.documentType,
      documentName: d.documentName,
      status: d.status,
      rejectionReason: d.rejectionReason,
      expiryDate: d.expiryDate,
      createdAt: d.createdAt,
      reviewedAt: d.reviewedAt,
      downloadUrl: `/api/auth/documents/${d.id}`,
    }));
  }

  /**
   * Securely serves a stored document with strict authorization check.
   */
  async getDocumentFile(documentId: string, requesterId: string, requesterRole: string) {
    const doc = await prisma.accountDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      const error: AppError = new Error('Document not found');
      error.statusCode = 404;
      throw error;
    }

    const isAdmin = requesterRole === 'ADMIN' || requesterRole === 'SUPER_ADMIN';
    const isOwner = doc.userId === requesterId;

    if (!isAdmin && !isOwner) {
      const error: AppError = new Error('Forbidden: You do not have permission to access this document');
      error.statusCode = 403;
      throw error;
    }

    const filePath = getDocumentFilePath(doc.fileUrl);
    return {
      filePath,
      mimeType: doc.fileMimeType || 'application/pdf',
      originalName: doc.documentName || 'document.pdf',
    };
  }

  /**
   * Retrieves full profile of the authenticated user including documents.
   */
  async getUserProfile(userId: string): Promise<UserSanitized & { accountDocuments: any[] }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accountDocuments: true,
      },
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const sanitized = sanitizeUser(user);
    return {
      ...sanitized,
      accountDocuments: (user.accountDocuments || []).map((d: any) => ({
        id: d.id,
        documentType: d.documentType,
        documentName: d.documentName,
        status: d.status,
        rejectionReason: d.rejectionReason,
        expiryDate: d.expiryDate,
        createdAt: d.createdAt,
      })),
    };
  }
}

export const authService = new AuthService();
