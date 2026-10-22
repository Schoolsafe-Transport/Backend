import crypto from 'crypto';
import QRCode from 'qrcode';

// Secret key for pass token encryption at rest
const ENCRYPTION_SECRET = process.env.JWT_SECRET || 'schoolsafe-transport-pass-secret-salt-2026';
const ALGORITHM = 'aes-256-cbc';
const KEY = crypto.scryptSync(ENCRYPTION_SECRET, 'schoolsafe-salt', 32);

/**
 * Generate a cryptographically secure, opaque random QR token.
 * Contains 256 bits of entropy.
 */
export function generateOpaquePassToken(): string {
  const randomHex = crypto.randomBytes(32).toString('hex');
  return `ssp_live_${randomHex}`;
}

/**
 * Compute SHA-256 hash of a raw QR token for database storage and indexing.
 */
export function hashPassToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Generate a human-readable unique pass code (e.g. SSP-2026-A8F1C3)
 */
export function generatePassCode(): string {
  const year = new Date().getFullYear();
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SSP-${year}-${hex}`;
}

/**
 * Encrypt the raw token for secure storage at rest.
 */
export function encryptPassToken(rawToken: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(rawToken, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt the stored encrypted token for the authorized parent.
 */
export function decryptPassToken(encryptedPayload: string): string {
  try {
    const [ivHex, encryptedText] = encryptedPayload.split(':');
    if (!ivHex || !encryptedText) return '';
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

/**
 * Generate a high-contrast, error-tolerant QR code Data URL for printing and mobile display.
 * Uses High (H) error correction level (up to 30% damage resistance).
 */
export async function generateQrDataUrl(token: string): Promise<string> {
  return await QRCode.toDataURL(token, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    margin: 2,
    width: 320,
    color: {
      dark: '#0f172a', // Deep slate for crisp printing
      light: '#ffffff',
    },
  });
}
