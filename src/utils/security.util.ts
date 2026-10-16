import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { JWTPayload, UserSanitized } from '../types/auth.types';
import { User } from '@prisma/client';

const SALT_ROUNDS = 12;

/**
 * Hashes a plaintext password using bcrypt with salt rounds of 12.
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 */
export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Generates a short-lived signed JWT access token.
 */
export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
};

/**
 * Generates a long-lived signed JWT refresh token.
 */
export const generateRefreshToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    jwtid: crypto.randomUUID(),
  });
};

/**
 * Decodes and verifies a JWT access token.
 */
export const verifyAccessToken = (token: string): JWTPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JWTPayload;
};

/**
 * Decodes and verifies a JWT refresh token.
 */
export const verifyRefreshToken = (token: string): JWTPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JWTPayload;
};

/**
 * Strips sensitive fields like passwordHash from User objects.
 */
export const sanitizeUser = (user: User): UserSanitized => {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as any,
    status: user.status as any,
    isVerified: user.isVerified,
    profilePhoto: (user as any).profilePhoto || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};
