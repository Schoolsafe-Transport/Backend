import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { AppError } from '../middleware/errorHandler';

// Determine private storage directory for documents
const documentsDir = path.resolve(process.cwd(), 'storage', 'documents');

if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

// Storage configuration with cryptographically randomized filenames
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, documentsDir);
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
    const err: AppError = new Error('Invalid file format. Only JPEG, PNG, and PDF files are allowed for account documents.');
    err.statusCode = 400;
    cb(err as any, false);
  }
};

// Maximum file size: 10MB
export const uploadDocumentMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
  },
});

export function findDocumentFile(filename: string): string | null {
  try {
    const safeFilename = path.basename(filename);
    const fullPath = path.join(documentsDir, safeFilename);
    return fs.existsSync(fullPath) ? fullPath : null;
  } catch (_e) {
    return null;
  }
}

export function getDocumentFilePath(filename: string): string {
  // Prevent directory traversal attacks
  const safeFilename = path.basename(filename);
  const fullPath = path.join(documentsDir, safeFilename);

  if (!fs.existsSync(fullPath)) {
    const err: AppError = new Error('Requested document file not found in storage');
    err.statusCode = 404;
    throw err;
  }

  return fullPath;
}

export function deleteDocumentFile(filename: string): void {
  try {
    const safeFilename = path.basename(filename);
    const fullPath = path.join(documentsDir, safeFilename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error('[DocumentStorage] Failed to remove file:', err);
  }
}
