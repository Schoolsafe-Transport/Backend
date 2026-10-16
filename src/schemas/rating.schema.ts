import { z, type infer as zInfer } from 'zod';

export const createRatingSchema = z.object({
  providerId: z.string().uuid('Invalid provider ID format'),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().max(500, 'Comment must not exceed 500 characters').optional(),
});

export type CreateRatingInput = zInfer<typeof createRatingSchema>;
