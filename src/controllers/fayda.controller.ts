import { Request, Response, NextFunction } from 'express';
import { faydaService } from '../services/fayda.service';
import { AuthenticatedRequest } from '../types/auth.types';

export class FaydaController {
  async getAuthUrl(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = faydaService.getAuthorizationUrl(req.user!.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async handleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state } = req.query as { code: string; state: string };
      if (!code || !state) {
        res.status(400).json({
          success: false,
          message: 'Missing code or state parameters from Fayda provider',
        });
        return;
      }

      const result = await faydaService.handleCallback(code, state);
      res.status(200).json({
        success: true,
        message: 'Fayda National ID verified successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyByFin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { finNumber, otp } = req.body;
      if (!finNumber) {
        res.status(400).json({
          success: false,
          message: 'Fayda FIN (National ID Number) is required',
        });
        return;
      }

      const result = await faydaService.verifyByFin(req.user!.id, finNumber, otp);
      res.status(200).json({
        success: true,
        message: 'Fayda National ID successfully validated and account verified',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await faydaService.getVerificationStatus(req.user!.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const faydaController = new FaydaController();
