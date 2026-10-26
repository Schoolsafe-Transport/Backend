import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AuthenticatedRequest } from '../types/auth.types';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({
        success: true,
        message: 'Account registered successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({
        success: true,
        message: 'Authentication successful',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refreshToken(refreshToken);
      res.status(200).json({
        success: true,
        message: 'Tokens refreshed successfully',
        data: tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body;
      const result = await authService.resetPassword(token, newPassword);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;
      const result = await authService.verifyEmail(token);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const identifier = req.body?.email || (req as any).user?.id || (req as any).user?.email;
      if (!identifier) {
        res.status(400).json({
          success: false,
          message: 'Email address or user identifier is required',
        });
        return;
      }
      const result = await authService.resendVerificationEmail(identifier);
      const statusCode = result.success ? 200 : 502;
      res.status(statusCode).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getUserProfile(req.user!.id);
      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.changePassword(req.user!.id, req.body);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.updateProfile(req.user!.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async saveOnboarding(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.saveOnboardingProfile(req.user!.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Onboarding progress saved',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadDocument(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({
          success: false,
          message: 'Document file is required (PDF, JPEG, or PNG up to 10MB)',
        });
        return;
      }

      const { documentType, documentName, expiryDate } = req.body;
      if (!documentType) {
        res.status(400).json({
          success: false,
          message: 'documentType is required',
        });
        return;
      }

      const doc = await authService.uploadAccountDocument(
        req.user!.id,
        file,
        documentType,
        documentName,
        expiryDate
      );

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully and queued for review',
        data: doc,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyDocuments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const docs = await authService.getMyDocuments(req.user!.id);
      res.status(200).json({
        success: true,
        data: docs,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDocument(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { filePath, mimeType, originalName, fallbackHtml } = await authService.getDocumentFile(
        id,
        req.user!.id,
        req.user!.role
      );

      if (fallbackHtml) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(fallbackHtml);
        return;
      }

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${originalName}"`);
      res.sendFile(filePath!);
    } catch (error) {
      next(error);
    }
  }

  // RBAC Demonstration Endpoints
  async adminOnly(req: AuthenticatedRequest, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'Access granted: Administrator Privileges Verified',
      user: req.user,
    });
  }

  async schoolAdminOnly(req: AuthenticatedRequest, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'Access granted: School Administrator Console',
      user: req.user,
    });
  }

  async providerOnly(req: AuthenticatedRequest, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'Access granted: Transport Provider Workspace',
      user: req.user,
    });
  }
}

export const authController = new AuthController();
