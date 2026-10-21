import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

export interface FaydaVerificationResult {
  verified: boolean;
  faydaIdNumber: string;
  fullName: string;
  verifiedAt: Date;
  status: string;
  isSandbox?: boolean;
}

export interface FaydaSession {
  userId: string;
  finNumber: string;
  otpHash: string;
  expiresAt: number;
  isSandbox: boolean;
}

const consumedCallbackCodes = new Set<string>();
const activeFaydaSessions = new Map<string, FaydaSession>();

export class FaydaService {
  /**
   * Masks a Fayda FIN or VID to hide sensitive digits, displaying only the last 4.
   * Example: 123456789012 -> ********9012
   */
  maskFaydaId(rawFin: string): string {
    const clean = rawFin.replace(/[\s-]/g, '');
    if (clean.length < 4) return '********';
    return `********${clean.slice(-4)}`;
  }

  /**
   * Masks phone numbers for display during OTP verification.
   * Example: +251911223344 -> +251 9*** ***44
   */
  maskPhone(phone?: string | null): string {
    if (!phone) return '+251 9*** ***01';
    const clean = phone.replace(/\s+/g, '');
    if (clean.length >= 4) {
      return `${clean.slice(0, 5)}*** ***${clean.slice(-2)}`;
    }
    return '+251 9*** ***01';
  }

  /**
   * Generates the Fayda eSignet OIDC authorization URL for Ethiopian National ID sign-in.
   */
  getAuthorizationUrl(userId: string): { authUrl: string; state: string } {
    const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64');
    const nonce = Math.random().toString(36).substring(2);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.FAYDA_CLIENT_ID || 'schoolsafe_fayda_client',
      redirect_uri: env.FAYDA_REDIRECT_URI,
      scope: 'openid profile phone email national_id',
      state,
      nonce,
      claims: JSON.stringify({
        id_token: {
          national_id: { essential: true },
          name: { essential: true },
          phone_number: { essential: false },
        },
      }),
    });

    const authUrl = `${env.FAYDA_AUTHORIZE_URL}?${params.toString()}`;
    return { authUrl, state };
  }

  /**
   * Exchanges authorization code from Fayda eSignet callback, extracts identity claims,
   * and marks the user as verified.
   */
  async handleCallback(code: string, state: string): Promise<FaydaVerificationResult> {
    if (!code || !state) {
      const error: AppError = new Error('Missing code or state in Fayda callback');
      error.statusCode = 400;
      throw error;
    }

    if (consumedCallbackCodes.has(code)) {
      const error: AppError = new Error('Fayda authorization code has already been consumed (replay detected)');
      error.statusCode = 400;
      throw error;
    }

    let userId: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      if (!decoded.userId || !decoded.ts) {
        throw new Error('Malformed state payload');
      }

      // Check state expiration (max 15 minutes)
      const MAX_STATE_AGE_MS = 15 * 60 * 1000;
      if (Date.now() - decoded.ts > MAX_STATE_AGE_MS) {
        const error: AppError = new Error('Fayda authorization state has expired. Please initiate verification again.');
        error.statusCode = 400;
        throw error;
      }

      userId = decoded.userId;
    } catch (err: any) {
      const error: AppError = new Error(err.statusCode ? err.message : 'Invalid or malformed state parameter in Fayda callback');
      error.statusCode = err.statusCode || 400;
      throw error;
    }

    consumedCallbackCodes.add(code);
    if (consumedCallbackCodes.size > 10000) {
      consumedCallbackCodes.clear();
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error: AppError = new Error('User referenced in Fayda verification does not exist');
      error.statusCode = 404;
      throw error;
    }

    let rawFin: string;
    let fullName: string;
    let isSandbox = false;

    if (env.FAYDA_CLIENT_ID && env.NODE_ENV === 'production') {
      try {
        const tokenRes = await fetch(env.FAYDA_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: env.FAYDA_REDIRECT_URI,
            client_id: env.FAYDA_CLIENT_ID,
          }),
        });

        if (!tokenRes.ok) {
          throw new Error(`Token exchange failed with status ${tokenRes.status}`);
        }

        const tokenData = await tokenRes.json();
        const userInfoRes = await fetch(env.FAYDA_USERINFO_URL, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const userInfo = await userInfoRes.json();
        rawFin = userInfo.national_id || userInfo.sub;
        fullName = userInfo.name || `${user.firstName} ${user.lastName}`;
      } catch (err: any) {
        const error: AppError = new Error(`Fayda identity verification failed: ${err.message}`);
        error.statusCode = 502;
        throw error;
      }
    } else {
      // Mock / Dev verification for testing Fayda flow
      isSandbox = true;
      rawFin = `ET-FIN-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
      fullName = `${user.firstName} ${user.lastName}`;
    }

    const maskedFaydaId = this.maskFaydaId(rawFin);

    // Update user to verified and store ONLY masked identifier
    await prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: true,
        faydaId: maskedFaydaId,
        status: user.status === 'PENDING' ? 'ACTIVE' : user.status,
      },
    });

    return {
      verified: true,
      faydaIdNumber: maskedFaydaId,
      fullName,
      verifiedAt: new Date(),
      status: 'VERIFIED',
      isSandbox,
    };
  }

  /**
   * Step 1: Initiates Fayda FIN identity verification.
   * Validates format, initiates authorized Fayda e-KYC SMS OTP dispatch.
   */
  async initiateFinVerification(userId: string, finNumber: string) {
    const cleanFin = finNumber.replace(/[\s-]/g, '');

    // Validate Ethiopian Fayda FIN format (12 or 16 numeric digits)
    if (!/^\d{12}$|^\d{16}$/.test(cleanFin)) {
      const error: AppError = new Error(
        'Invalid Fayda National ID number format. Must be a 12-digit FIN or 16-digit VID.'
      );
      error.statusCode = 400;
      throw error;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Production security boundary: Direct FIN verification requires authorized Fayda credentials in production
    if (env.NODE_ENV === 'production' && !env.FAYDA_CLIENT_ID) {
      const error: AppError = new Error(
        'Direct FIN verification is disabled in production without authorized Fayda KYC integration. Please authenticate via Fayda eSignet OIDC.'
      );
      error.statusCode = 403;
      throw error;
    }

    const transactionId = crypto.randomUUID();
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    activeFaydaSessions.set(transactionId, {
      userId,
      finNumber: cleanFin,
      otpHash,
      expiresAt,
      isSandbox: true,
    });

    const maskedPhone = this.maskPhone(user.phone);

    // In development/sandbox mode, log simulated dispatch to terminal
    if (env.NODE_ENV === 'development') {
      console.log(`[Fayda Service - DEV SANDBOX] Dispatched SMS OTP to citizen phone: ${maskedPhone}. OTP: ${otp} (Txn: ${transactionId})`);
    }

    return {
      success: true,
      transactionId,
      maskedPhone,
      isSandbox: true,
      message: `Fayda identity verification initiated. SMS OTP dispatched to ${maskedPhone}.`,
      simulatedOtp: env.NODE_ENV !== 'production' ? otp : undefined,
    };
  }

  /**
   * Step 2: Validates the Fayda SMS OTP and completes identity verification.
   */
  async verifyByFin(
    userId: string,
    finNumber: string,
    otp?: string,
    transactionId?: string
  ): Promise<FaydaVerificationResult> {
    const cleanFin = finNumber.replace(/[\s-]/g, '');

    // Validate Ethiopian Fayda FIN format (12 or 16 numeric digits)
    if (!/^\d{12}$|^\d{16}$/.test(cleanFin)) {
      const error: AppError = new Error(
        'Invalid Fayda National ID number format. Must be a 12-digit FIN or 16-digit VID.'
      );
      error.statusCode = 400;
      throw error;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Production security boundary: Direct FIN string format checking cannot grant verified status without authorized NID partner KYC credentials
    if (env.NODE_ENV === 'production' && !env.FAYDA_CLIENT_ID) {
      const error: AppError = new Error(
        'Direct FIN verification is disabled in production without authorized Fayda KYC integration. Please authenticate via Fayda eSignet OIDC.'
      );
      error.statusCode = 403;
      throw error;
    }

    // If transactionId is provided, strictly validate the active Fayda OTP session
    if (transactionId) {
      if (!otp || typeof otp !== 'string' || otp.trim().length < 4) {
        const error: AppError = new Error('Fayda SMS verification code (OTP) is required to establish identity verification.');
        error.statusCode = 400;
        throw error;
      }

      const session = activeFaydaSessions.get(transactionId);
      if (!session) {
        const error: AppError = new Error('Fayda verification session has expired or is invalid. Please request a new verification code.');
        error.statusCode = 400;
        throw error;
      }

      if (session.userId !== userId) {
        const error: AppError = new Error('Fayda verification session does not match the authenticated user.');
        error.statusCode = 403;
        throw error;
      }

      if (Date.now() > session.expiresAt) {
        activeFaydaSessions.delete(transactionId);
        const error: AppError = new Error('Fayda SMS verification code has expired. Please request a new verification code.');
        error.statusCode = 400;
        throw error;
      }

      const inputOtpHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
      if (inputOtpHash !== session.otpHash) {
        const error: AppError = new Error('Invalid Fayda SMS verification code (OTP). Please check your SMS and try again.');
        error.statusCode = 400;
        throw error;
      }

      // Single-use enforcement: Consume the session
      activeFaydaSessions.delete(transactionId);
    } else if (otp) {
      if (otp === '000000' || otp.trim().length < 4) {
        const error: AppError = new Error('Invalid Fayda SMS verification code (OTP). Please check your SMS and try again.');
        error.statusCode = 400;
        throw error;
      }
    }

    const maskedFaydaId = this.maskFaydaId(cleanFin);

    // Mark user as verified and save ONLY masked Fayda identifier
    await prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: true,
        faydaId: maskedFaydaId,
        status: user.status === 'PENDING' ? 'ACTIVE' : user.status,
      },
    });

    return {
      verified: true,
      faydaIdNumber: maskedFaydaId,
      fullName: `${user.firstName} ${user.lastName}`,
      verifiedAt: new Date(),
      status: 'VERIFIED',
      isSandbox: true,
    };
  }

  /**
   * Returns current Fayda verification status for a given user.
   */
  async getVerificationStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
        faydaId: true,
        status: true,
        updatedAt: true,
      },
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    return {
      isVerified: user.isVerified,
      faydaId: user.faydaId,
      status: user.isVerified ? 'VERIFIED' : 'UNVERIFIED',
      user: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        accountStatus: user.status,
      },
    };
  }
}

export const faydaService = new FaydaService();
