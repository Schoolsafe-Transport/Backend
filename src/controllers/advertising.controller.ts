import { Request, Response, NextFunction } from 'express';
import { advertisingService } from '../services/advertising.service';
import { AuthenticatedRequest } from '../types/auth.types';

export class AdvertisingController {
  async getActiveAds(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { placement } = req.query as { placement?: string };
      const ads = await advertisingService.getActiveAds(placement);
      res.status(200).json({
        success: true,
        data: ads,
      });
    } catch (error) {
      next(error);
    }
  }

  async listPackages(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const packages = await advertisingService.listPackages();
      res.status(200).json({
        success: true,
        data: packages,
      });
    } catch (error) {
      next(error);
    }
  }

  async createPackage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pkg = await advertisingService.createPackage(req.body);
      res.status(201).json({
        success: true,
        message: 'Advertising package created',
        data: pkg,
      });
    } catch (error) {
      next(error);
    }
  }

  async createCampaign(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaign = await advertisingService.createCampaign(req.user!.id, req.body);
      res.status(201).json({
        success: true,
        message: 'Advertising campaign submitted for review',
        data: campaign,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyCampaigns(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaigns = await advertisingService.getMyCampaigns(req.user!.id);
      res.status(200).json({
        success: true,
        data: campaigns,
      });
    } catch (error) {
      next(error);
    }
  }

  async recordEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { campaignId } = req.params;
      const { eventType } = req.body;
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await advertisingService.recordEvent(campaignId, eventType, ip, userAgent);
      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async updateCampaignStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { campaignId } = req.params;
      const campaign = await advertisingService.updateCampaignStatus(campaignId, req.body);
      res.status(200).json({
        success: true,
        message: `Campaign status updated to ${req.body.status}`,
        data: campaign,
      });
    } catch (error) {
      next(error);
    }
  }

  async listAllCampaigns(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaigns = await advertisingService.listAllCampaigns();
      res.status(200).json({
        success: true,
        data: campaigns,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const advertisingController = new AdvertisingController();
