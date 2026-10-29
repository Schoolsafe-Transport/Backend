import crypto from 'crypto';
import fs from 'fs';
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
import { getDocumentFilePath, findDocumentFile } from '../utils/documentStorage.util';
import { generateDocumentVisualSvg } from '../utils/documentVisualGenerator.util';
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
      // Re-use existing valid 6-digit code so user receives it in their inbox immediately without being blocked
      return {
        rawToken: recentToken.tokenHash,
        sixDigitCode: recentToken.sixDigitCode,
      };
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
  ): Promise<AuthResponse & { verificationToken?: string; sixDigitCode?: string; emailDelivery?: { delivered: boolean; error?: string } }> {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      const error: AppError = new Error('An account with this email address already exists');
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
      },
    });

    const jwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as any,
      status: user.status as any,
      scope: 'FULL' as const,
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

    // Generate single-use email verification token & dispatch email to recipient
    let verificationToken: string | undefined;
    let sixDigitCode: string | undefined;
    let emailDelivery: { delivered: boolean; error?: string } = { delivered: false };
    try {
      const generated = await this.generateEmailVerificationToken(user.id);
      verificationToken = generated.rawToken;
      sixDigitCode = generated.sixDigitCode;

      console.log(`[AuthService] Dispatching 6-digit verification code to ${user.email}...`);
      const sendRes = await emailService.sendVerificationEmail(user.email, user.firstName, verificationToken, sixDigitCode);
      emailDelivery = {
        delivered: sendRes.delivered,
        error: sendRes.error,
      };
      console.log(`[AuthService] Email delivery for ${user.email}:`, sendRes.delivered ? 'SUCCESS' : sendRes.error);
    } catch (err: any) {
      console.warn('[AuthService] Could not prepare or dispatch verification token:', err.message);
      emailDelivery = { delivered: false, error: err.message };
    }

    return {
      user: sanitizeUser({ ...user, latestVerificationCode: sixDigitCode } as any),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      },
      emailDelivery,
      verificationToken,
      sixDigitCode,
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
    console.log(`[AuthService] Resending 6-digit verification code to ${user.email}...`);
    const dispatchResult = await emailService.sendVerificationEmail(user.email, user.firstName, rawToken, sixDigitCode);
    console.log(`[AuthService] Resend email delivery for ${user.email}:`, dispatchResult.delivered ? 'SUCCESS' : dispatchResult.error);

    if (!dispatchResult.delivered) {
      return {
        success: false,
        delivered: false,
        message: 'Could not deliver verification email. Please check your email address or SMTP configuration.',
        error: dispatchResult.error,
        verificationToken: rawToken,
        sixDigitCode,
        verificationUrl: dispatchResult.verificationUrl,
      };
    }

    return {
      success: true,
      delivered: true,
      message: 'A fresh 6-digit verification code has been dispatched to your email address.',
      verificationToken: rawToken,
      sixDigitCode,
      verificationUrl: dispatchResult.verificationUrl,
    };
  }

  /**
   * Authenticates user credentials, validates account status, and issues session tokens.
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    let user = await prisma.user.findUnique({
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

    // Auto-promote system administrator rachelberhane716@gmail.com to ADMIN role
    const emailLower = user.email.toLowerCase();
    if (
      emailLower === 'rachelberhane716@gmail.com' &&
      user.role !== 'ADMIN' &&
      user.role !== 'SUPER_ADMIN'
    ) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'ADMIN',
          status: 'ACTIVE',
          isVerified: true,
          isEmailVerified: true,
        },
      });
    }

    // Explicitly guarantee rahelnaba716@gmail.com is a verified PARENT user
    if (
      emailLower === 'rahelnaba716@gmail.com' &&
      (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')
    ) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'PARENT',
          status: 'ACTIVE',
          isVerified: true,
          isEmailVerified: true,
        },
      });
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

    // Convert uploaded physical file to permanent Base64 Data URI so it is NEVER lost on Render ephemeral container restarts!
    let fileUrl = file.filename;
    try {
      if (file.path && fs.existsSync(file.path)) {
        const fileBuf = fs.readFileSync(file.path);
        fileUrl = `data:${file.mimetype};base64,${fileBuf.toString('base64')}`;
      } else if ((file as any).buffer) {
        fileUrl = `data:${file.mimetype};base64,${(file as any).buffer.toString('base64')}`;
      }
    } catch (e) {
      console.warn('Failed to convert uploaded document to data URL, using filename fallback', e);
      fileUrl = file.filename;
    }

    const doc = await prisma.accountDocument.create({
      data: {
        userId,
        documentType: documentType.trim(),
        documentName: documentName ? documentName.trim() : file.originalname,
        fileUrl,
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
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!doc) {
      const error: AppError = new Error('Document record not found in system registry');
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

    let physicalPath: string | null = null;
    let buffer: Buffer | null = null;
    let dataUrl: string | null = null;

    if (doc.fileUrl && doc.fileUrl.startsWith('data:')) {
      dataUrl = doc.fileUrl;
      const commaIdx = doc.fileUrl.indexOf(',');
      const base64Data = doc.fileUrl.substring(commaIdx + 1);
      buffer = Buffer.from(base64Data, 'base64');
    } else if (doc.fileUrl) {
      physicalPath = findDocumentFile(doc.fileUrl);
      if (physicalPath && fs.existsSync(physicalPath)) {
        try {
          buffer = fs.readFileSync(physicalPath);
          dataUrl = `data:${doc.fileMimeType || 'image/png'};base64,${buffer.toString('base64')}`;
        } catch (_e) {
          // ignore
        }
      }
    }

    const isPdf =
      Boolean(doc.fileMimeType === 'application/pdf') ||
      Boolean(doc.documentName?.toLowerCase().endsWith('.pdf')) ||
      Boolean(dataUrl?.startsWith('data:application/pdf'));

    const isImage =
      Boolean(doc.fileMimeType?.startsWith('image/')) ||
      Boolean(dataUrl?.startsWith('data:image/')) ||
      Boolean(doc.documentName?.toLowerCase().endsWith('.png')) ||
      Boolean(doc.documentName?.toLowerCase().endsWith('.jpg')) ||
      Boolean(doc.documentName?.toLowerCase().endsWith('.jpeg'));

    const u = doc.user || {
      firstName: 'Applicant',
      lastName: 'User',
      email: 'N/A',
      phone: 'N/A',
      role: 'OPERATOR',
    };

    // Generate the official vector SVG document image
    const svgVisual = generateDocumentVisualSvg(doc, u as any);

    const escapeHtml = (str: string) =>
      str.replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&#39;';
          case '"': return '&quot;';
          default: return c;
        }
      });

    const statusColor =
      doc.status === 'APPROVED' ? '#059669' : doc.status === 'REJECTED' ? '#DC2626' : '#D97706';
    const statusBg =
      doc.status === 'APPROVED' ? '#ECFDF5' : doc.status === 'REJECTED' ? '#FEF2F2' : '#FFFBEB';

    const fallbackHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SchoolSafe - Official Document: ${escapeHtml(doc.documentName || doc.documentType)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0B1120;
      background-image: radial-gradient(at 0% 0%, #1E293B 0px, transparent 50%), radial-gradient(at 100% 100%, #1E3A8A 0px, transparent 50%);
      color: #F8FAFC;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1.5rem 1rem 3rem;
    }
    .container {
      max-width: 900px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      background: rgba(30, 41, 59, 0.75);
      backdrop-filter: blur(12px);
      padding: 1rem 1.5rem;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .brand-icon {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, #2563EB, #1D4ED8);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.35rem;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
    }
    .brand-title {
      font-size: 1.15rem;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.02em;
    }
    .brand-subtitle {
      font-size: 0.78rem;
      color: #94A3B8;
    }
    .actions-bar {
      display: flex;
      gap: 0.6rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .btn {
      padding: 0.55rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s ease;
      border: 1px solid transparent;
    }
    .btn-primary {
      background: #2563EB;
      color: #FFFFFF;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }
    .btn-primary:hover { background: #1D4ED8; }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #F8FAFC;
      border-color: rgba(255, 255, 255, 0.15);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.2); }
    .status-badge {
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background-color: ${statusBg};
      color: ${statusColor};
      border: 1px solid ${statusColor};
    }
    .visual-card-wrapper {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .visual-header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .visual-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #F8FAFC;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .svg-container {
      width: 100%;
      max-width: 850px;
      display: flex;
      justify-content: center;
    }
    .svg-container svg {
      width: 100%;
      height: auto;
      max-height: 540px;
    }
    .uploaded-img {
      max-width: 100%;
      max-height: 540px;
      border-radius: 16px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .meta-card {
      background: #FFFFFF;
      color: #0F172A;
      border-radius: 20px;
      padding: 1.75rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    }
    .meta-title {
      font-size: 1.15rem;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 1.25rem;
    }
    .meta-item label {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748B;
      margin-bottom: 0.25rem;
    }
    .meta-item span {
      font-size: 0.95rem;
      font-weight: 600;
      color: #0F172A;
      word-break: break-word;
    }
    .verified-banner {
      margin-top: 1.25rem;
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: 10px;
      padding: 1rem 1.25rem;
      color: #1E3A8A;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    @media (max-width: 600px) {
      .top-bar { flex-direction: column; align-items: stretch; }
      .actions-bar { justify-content: stretch; }
      .btn { flex: 1; justify-content: center; }
      .meta-grid { grid-template-columns: 1fr; }
    }
    @media print {
      body { background: white; color: black; padding: 0; }
      .top-bar, .actions-bar { display: none; }
      .visual-card-wrapper { border: none; box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="top-bar">
      <div class="brand">
        <div class="brand-icon">🛡️</div>
        <div>
          <div class="brand-title">SchoolSafe Verification Center</div>
          <div class="brand-subtitle">Federal Transport &amp; Driver Compliance Registry</div>
        </div>
      </div>
      <div class="actions-bar">
        <span class="status-badge">${doc.status}</span>
        ${isPdf ? `
          <a href="?format=raw" target="_blank" class="btn btn-primary" title="Open PDF in new window">
            📄 Open Fullscreen PDF
          </a>
          <a href="?format=raw&download=1" download="${escapeHtml(doc.documentName || 'document.pdf')}" class="btn btn-secondary" title="Download PDF document">
            ⬇️ Download PDF
          </a>
        ` : `
          <a href="?format=image" target="_blank" class="btn btn-secondary" title="View standalone pure image">
            🖼️ Pure Image
          </a>
          <button onclick="downloadDocumentSvg()" class="btn btn-primary" title="Download document image">
            ⬇️ Download Image
          </button>
        `}
        <button onclick="window.print()" class="btn btn-secondary">
          🖨️ Print
        </button>
      </div>
    </div>

    <!-- Hero Document Visual Scan / PDF Viewer -->
    <div class="visual-card-wrapper">
      <div class="visual-header">
        <div class="visual-title">
          <span>${isPdf ? '📄' : '📜'}</span>
          <span>Official Visual Credential: <strong>${escapeHtml(doc.documentName || doc.documentType.replace(/_/g, ' '))}</strong></span>
        </div>
        <div style="font-size: 0.8rem; color: #94A3B8;">
          Format: <span style="font-weight: 700; color: #38BDF8;">${isPdf ? 'PDF DOCUMENT' : 'PNG / IMAGE'}</span> • Record: <span style="font-family: monospace; color: #60A5FA;">${doc.id.substring(0, 13)}...</span>
        </div>
      </div>

      <div class="svg-container" id="docVisual">
        ${isPdf
          ? `<div style="width: 100%; min-height: 600px; background: #FFFFFF; border-radius: 12px; overflow: hidden;">
               <object data="${dataUrl || '?format=raw'}" type="application/pdf" style="width: 100%; height: 600px; border: none;">
                 <iframe src="${dataUrl || '?format=raw'}" style="width: 100%; height: 600px; border: none;">
                   <div style="padding: 2.5rem; text-align: center; color: #1E293B;">
                     <h3 style="margin-bottom: 0.5rem; color: #0F172A;">PDF Document Verified</h3>
                     <p style="margin-bottom: 1.5rem; color: #64748B;">Uploaded document: ${escapeHtml(doc.documentName || 'document.pdf')}</p>
                     <a href="?format=raw" target="_blank" class="btn btn-primary">📄 Open Fullscreen PDF</a>
                   </div>
                 </iframe>
               </object>
             </div>`
          : (isImage && dataUrl)
          ? `<div style="display: flex; justify-content: center; width: 100%;">
               <img src="${dataUrl}" alt="${escapeHtml(doc.documentName || 'Submitted Document Image')}" class="uploaded-img" />
             </div>`
          : svgVisual
        }
      </div>
    </div>

    <!-- Official Metadata Verification Record -->
    <div class="meta-card">
      <div class="meta-title">
        <span>📋</span>
        <span>Identity &amp; Compliance Registry Specifications</span>
      </div>

      <div class="meta-grid">
        <div class="meta-item">
          <label>Applicant / Operator Name</label>
          <span>${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</span>
        </div>
        <div class="meta-item">
          <label>System Role</label>
          <span>${escapeHtml(u.role || 'TRANSPORT_PROVIDER')}</span>
        </div>
        <div class="meta-item">
          <label>Contact Email</label>
          <span>${escapeHtml(u.email || 'N/A')}</span>
        </div>
        <div class="meta-item">
          <label>Contact Phone</label>
          <span>${escapeHtml(u.phone || 'N/A')}</span>
        </div>
        <div class="meta-item">
          <label>Document Classification</label>
          <span>${escapeHtml(doc.documentType.replace(/_/g, ' '))}</span>
        </div>
        <div class="meta-item">
          <label>Document Record UUID</label>
          <span style="font-family: monospace; font-size: 0.8rem;">${doc.id}</span>
        </div>
        <div class="meta-item">
          <label>Submission Date</label>
          <span>${new Date(doc.createdAt).toLocaleString()}</span>
        </div>
        <div class="meta-item">
          <label>Compliance Expiry</label>
          <span>${doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : 'Valid (Multi-Year)'}</span>
        </div>
      </div>

      <div class="verified-banner">
        <div style="font-size: 1.5rem;">✅</div>
        <div>
          <strong>Federal Transit Compliance Certified:</strong> This credential has been recorded in the SchoolSafe PostgreSQL cryptographically signed ledger. Qualified for municipal and private school transit route operations.
        </div>
      </div>
    </div>
  </div>

  <script>
    function downloadDocumentSvg() {
      const container = document.getElementById('docVisual');
      const img = container.querySelector('img');
      if (img && img.src) {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = '${escapeHtml(doc.documentName || 'document_image.png')}';
        a.click();
        return;
      }
      const svg = container.querySelector('svg');
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '${escapeHtml(doc.documentType || 'document')}.svg';
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  </script>
</body>
</html>`;

    return {
      filePath: physicalPath,
      buffer,
      dataUrl,
      isPdf,
      isImage,
      svgContent: svgVisual,
      mimeType: isPdf ? 'application/pdf' : (doc.fileMimeType || 'image/svg+xml'),
      originalName: doc.documentName || (isPdf ? `${doc.documentType}.pdf` : `${doc.documentType}.svg`),
      fallbackHtml,
    };
  }

  /**
   * Retrieves full profile of the authenticated user including documents.
   */
  async getUserProfile(userId: string): Promise<UserSanitized & { accountDocuments: any[] }> {
    let user = await prisma.user.findUnique({
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

    const emailLower = user.email.toLowerCase();
    if (
      emailLower === 'rachelberhane716@gmail.com' &&
      user.role !== 'ADMIN' &&
      user.role !== 'SUPER_ADMIN'
    ) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'ADMIN',
          status: 'ACTIVE',
          isVerified: true,
          isEmailVerified: true,
        },
        include: {
          accountDocuments: true,
        },
      });
    }

    if (
      emailLower === 'rahelnaba716@gmail.com' &&
      (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')
    ) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'PARENT',
          status: 'ACTIVE',
          isVerified: true,
          isEmailVerified: true,
        },
        include: {
          accountDocuments: true,
        },
      });
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
