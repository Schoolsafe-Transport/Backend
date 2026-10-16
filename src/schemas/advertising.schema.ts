import { z, type infer as zInfer } from 'zod';

export const createCampaignSchema = z.object({
  title: z.string().min(3, 'Campaign title must be at least 3 characters').trim(),
  description: z.string().optional(),
  bannerUrl: z.string().url('Banner must be a valid image URL'),
  targetUrl: z.string().url('Target URL must be a valid web address').optional(),
  packageId: z.string().uuid('Package ID must be a valid UUID').optional(),
  placement: z.enum(['DASHBOARD_BANNER', 'LANDING_PAGE', 'SIDEBAR']).default('DASHBOARD_BANNER'),
});

export const createPackageSchema = z.object({
  name: z.string().min(2, 'Package name is required'),
  description: z.string().min(5, 'Description is required'),
  durationDays: z.number().int().min(1, 'Duration must be at least 1 day'),
  price: z.number().min(0, 'Price must be positive'),
  placement: z.string().default('DASHBOARD_AND_LANDING'),
  isFeatured: z.boolean().default(false),
});

export const updateCampaignStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'REJECTED', 'PAUSED']),
});

export type CreateCampaignInput = zInfer<typeof createCampaignSchema>;
export type CreatePackageInput = zInfer<typeof createPackageSchema>;
export type UpdateCampaignStatusInput = zInfer<typeof updateCampaignStatusSchema>;
