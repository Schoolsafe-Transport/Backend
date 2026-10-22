import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

// Determine private storage directory
const receiptsDir = env.RECEIPTS_STORAGE_DIR
  ? path.resolve(env.RECEIPTS_STORAGE_DIR)
  : path.resolve(process.cwd(), 'storage', 'receipts');

// Ensure directory exists with restricted permissions
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

// Storage configuration with cryptographically safe randomized filenames
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, receiptsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

// File filter: explicitly allow only JPEG, PNG, and PDF
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    const err: AppError = new Error('Invalid file format. Only JPEG, PNG, and PDF files are allowed for payment receipts.');
    err.statusCode = 400;
    cb(err as any, false);
  }
};

// Maximum file size: 5MB
export const uploadReceiptMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
});

export function getReceiptFilePath(filename: string): string {
  // Prevent directory traversal attacks
  const safeFilename = path.basename(filename);
  const fullPath = path.join(receiptsDir, safeFilename);

  if (!fs.existsSync(fullPath)) {
    const err: AppError = new Error('Receipt evidence file not found in storage');
    err.statusCode = 404;
    throw err;
  }

  return fullPath;
}

export function deleteReceiptFile(filename: string): void {
  try {
    const safeFilename = path.basename(filename);
    const fullPath = path.join(receiptsDir, safeFilename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error('[ReceiptStorage] Failed to remove file:', err);
  }
}
