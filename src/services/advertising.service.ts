import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  CreateCampaignInput,
  CreatePackageInput,
  UpdateCampaignStatusInput,
} from '../schemas/advertising.schema';

export class AdvertisingService {
  /**
   * Retrieves active, approved advertising banners to display on user dashboards or public pages.
   */
  async getActiveAds(placement?: string) {
    const now = new Date();
    return prisma.advertisingCampaign.findMany({
      where: {
        status: 'ACTIVE',
        ...(placement ? { placement } : {}),
        AND: [
          {
            OR: [
              { startDate: null },
              { startDate: { lte: now } },
            ],
          },
          {
            OR: [
              { endDate: null },
              { endDate: { gte: now } },
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        bannerUrl: true,
        targetUrl: true,
        placement: true,
        business: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Lists all advertising packages available for businesses to purchase.
   */
  async listPackages() {
    return prisma.advertisingPackage.findMany({
      orderBy: { price: 'asc' },
    });
  }

  /**
   * Admin: Creates a new advertising package tier.
   */
  async createPackage(input: CreatePackageInput) {
    return prisma.advertisingPackage.create({
      data: input,
    });
  }

  /**
   * Business: Creates a new advertising campaign for promotion.
   */
  async createCampaign(businessId: string, input: CreateCampaignInput) {
    const business = await prisma.user.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      const error: AppError = new Error('Business account not found');
      error.statusCode = 404;
      throw error;
    }

    if (!business.isEmailVerified) {
      const error: AppError = new Error('Email verification required before creating advertising campaigns');
      error.statusCode = 403;
      error.code = 'EMAIL_VERIFICATION_REQUIRED';
      throw error;
    }

    if (business.status !== 'ACTIVE' || !business.isVerified) {
      const error: AppError = new Error('Your business account is pending administrator approval. You cannot create campaigns until an administrator verifies and approves your business.');
      error.statusCode = 403;
      error.code = 'BUSINESS_APPROVAL_REQUIRED';
      throw error;
    }


    let startDate = new Date();
    let endDate: Date | null = null;

    if (input.packageId) {
      const pkg = await prisma.advertisingPackage.findUnique({
        where: { id: input.packageId },
      });
      if (pkg) {
        endDate = new Date(Date.now() + pkg.durationDays * 24 * 60 * 60 * 1000);
      }
    }

    return prisma.advertisingCampaign.create({
      data: {
        businessId,
        title: input.title,
        description: input.description || null,
        bannerUrl: input.bannerUrl,
        targetUrl: input.targetUrl || null,
        placement: input.placement,
        packageId: input.packageId || null,
        status: 'PENDING_REVIEW',
        startDate,
        endDate,
      },
      include: {
        package: true,
      },
    });
  }

  /**
   * Retrieves campaigns belonging to the authenticated business.
   */
  async getMyCampaigns(businessId: string) {
    return prisma.advertisingCampaign.findMany({
      where: { businessId },
      include: {
        package: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Records an ad impression or click event and updates campaign counters.
   */
  async recordEvent(campaignId: string, eventType: 'IMPRESSION' | 'CLICK', ip?: string, userAgent?: string) {
    const campaign = await prisma.advertisingCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      const error: AppError = new Error('Campaign not found');
      error.statusCode = 404;
      throw error;
    }

    // Atomic increment
    await prisma.advertisingCampaign.update({
      where: { id: campaignId },
      data: {
        ...(eventType === 'CLICK' ? { clicksCount: { increment: 1 } } : { impressionsCount: { increment: 1 } }),
      },
    });

    // Record the discrete event
    await prisma.advertisementEvent.create({
      data: {
        campaignId,
        eventType,
        userAgent: userAgent || null,
        ipHash: ip ? Buffer.from(ip).toString('base64') : null,
      },
    });

    return { success: true };
  }

  /**
   * Admin: Approve, reject, or pause an advertising campaign.
   */
  async updateCampaignStatus(campaignId: string, input: UpdateCampaignStatusInput) {
    const campaign = await prisma.advertisingCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      const error: AppError = new Error('Campaign not found');
      error.statusCode = 404;
      throw error;
    }

    return prisma.advertisingCampaign.update({
      where: { id: campaignId },
      data: { status: input.status as any },
    });
  }

  /**
   * Admin: List all campaigns across all businesses.
   */
  async listAllCampaigns() {
    return prisma.advertisingCampaign.findMany({
      include: {
        business: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        package: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const advertisingService = new AdvertisingService();
