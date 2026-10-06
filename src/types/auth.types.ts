import { Request } from 'express';

export type UserRole =
  | 'PARENT'
  | 'STUDENT'
  | 'SCHOOL_ADMIN'
  | 'TRANSPORT_PROVIDER'
  | 'DRIVER'
  | 'BUSINESS'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

export interface UserSanitized {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResponse {
  user: UserSanitized;
  tokens: AuthTokens;
}

export interface AuthenticatedRequest extends Request {
  user?: UserSanitized;
}
