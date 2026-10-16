import { Request, Response, NextFunction } from 'express';
import { ratingService } from '../services/rating.service';
import { AuthenticatedRequest } from '../types/auth.types';

export class RatingController {
  async submitRating(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ratingService.submitRating(req.user!.id, req.body);
      res.status(201).json({
        success: true,
        message: 'Rating and review submitted successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProviderRatings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { providerId } = req.params;
      const result = await ratingService.getProviderRatings(providerId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const ratingController = new RatingController();
