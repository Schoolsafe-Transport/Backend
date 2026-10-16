import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

export interface FaydaVerificationResult {
  verified: boolean;
  faydaIdNumber: string;
  fullName: string;
  verifiedAt: Date;
  status: string;
}

const consumedCallbackCodes = new Set<string>();

export class FaydaService {
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

    // In a live production environment with valid Fayda client secrets,
    // exchange code with FAYDA_TOKEN_URL and query FAYDA_USERINFO_URL.
    // In dev / sandbox mode, mock the verified payload if client credentials are demo defaults.
    let faydaProfile: { fin: string; name: string };

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
        faydaProfile = {
          fin: userInfo.national_id || userInfo.sub,
          name: userInfo.name || `${user.firstName} ${user.lastName}`,
        };
      } catch (err: any) {
        const error: AppError = new Error(`Fayda identity verification failed: ${err.message}`);
        error.statusCode = 502;
        throw error;
      }
    } else {
      // Mock / Dev verification for testing Fayda flow
      faydaProfile = {
        fin: `ET-FIN-${Math.floor(100000000000 + Math.random() * 900000000000)}`,
        name: `${user.firstName} ${user.lastName}`,
      };
    }

    // Update user to verified
    await prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: true,
        status: user.status === 'PENDING' ? 'ACTIVE' : user.status,
      },
    });

    return {
      verified: true,
      faydaIdNumber: faydaProfile.fin,
      fullName: faydaProfile.name,
      verifiedAt: new Date(),
      status: 'VERIFIED',
    };
  }

  /**
   * Direct FIN (Fayda Identification Number) Verification for instant verification.
   * Ethiopian FIN is a 12-digit unique national identification number or 16-digit VID.
   */
  async verifyByFin(
    userId: string,
    finNumber: string,
    _otp?: string
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
    if (env.NODE_ENV === 'production') {
      const error: AppError = new Error(
        'Direct FIN verification is disabled in production without authorized Fayda KYC integration. Please authenticate via Fayda eSignet OIDC.'
      );
      error.statusCode = 403;
      throw error;
    }

    // Mark user as verified (in sandbox/test mode)
    await prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: true,
        status: user.status === 'PENDING' ? 'ACTIVE' : user.status,
      },
    });

    return {
      verified: true,
      faydaIdNumber: `FIN-ET-${cleanFin.slice(0, 4)}-****-${cleanFin.slice(-4)}`,
      fullName: `${user.firstName} ${user.lastName}`,
      verifiedAt: new Date(),
      status: 'VERIFIED',
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
