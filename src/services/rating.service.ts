import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { CreateRatingInput } from '../schemas/rating.schema';

export class RatingService {
  /**
   * Submits or updates a rating from a parent for a transportation provider.
   */
  async submitRating(parentId: string, input: CreateRatingInput) {
    // Verify provider exists and is a TRANSPORT_PROVIDER or DRIVER
    const provider = await prisma.user.findUnique({
      where: { id: input.providerId },
    });

    if (!provider || (provider.role !== 'TRANSPORT_PROVIDER' && provider.role !== 'DRIVER')) {
      const error: AppError = new Error('Target user is not a registered transportation provider or driver');
      error.statusCode = 404;
      throw error;
    }

    // Verify parent has an agreement with this provider (child safety / genuine reviews)
    const agreement = await prisma.transportationAgreement.findFirst({
      where: {
        parentId,
        providerId: input.providerId,
      },
    });

    // In production, enforce that parent has had an agreement with provider
    if (!agreement) {
      const error: AppError = new Error('You can only review providers with whom you have booked transportation');
      error.statusCode = 403;
      throw error;
    }

    // Upsert or create rating
    const existing = await prisma.rating.findFirst({
      where: {
        parentId,
        providerId: input.providerId,
      },
    });

    if (existing) {
      const updated = await prisma.rating.update({
        where: { id: existing.id },
        data: {
          rating: input.rating,
          comment: input.comment || null,
        },
      });
      return updated;
    }

    const created = await prisma.rating.create({
      data: {
        parentId,
        providerId: input.providerId,
        rating: input.rating,
        comment: input.comment || null,
      },
      include: {
        parent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
          },
        },
      },
    });

    return created;
  }

  /**
   * Retrieves all ratings and calculates aggregate metrics for a provider.
   */
  async getProviderRatings(providerId: string) {
    const ratings = await prisma.rating.findMany({
      where: { providerId },
      include: {
        parent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalRatings = ratings.length;
    const averageRating =
      totalRatings > 0
        ? Number((ratings.reduce((acc: number, r: any) => acc + r.rating, 0) / totalRatings).toFixed(1))
        : 5.0; // Default high rating for new providers

    return {
      providerId,
      totalRatings,
      averageRating,
      reviews: ratings,
    };
  }
}

export const ratingService = new RatingService();
