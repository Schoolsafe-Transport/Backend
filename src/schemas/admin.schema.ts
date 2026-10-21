import { z, type infer as zInfer } from 'zod';

export const applicationDecisionSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT', 'SUSPEND']),
    reason: z.string().optional(),
  })
  .refine(
    (data: any) =>
      data.decision !== 'REJECT' ||
      (typeof data.reason === 'string' && data.reason.trim().length >= 3),
    {
      message: 'A rejection reason of at least 3 characters is required',
      path: ['reason'],
    }
  );

export const campaignDecisionSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT', 'PAUSE']),
    feedback: z.string().optional(),
  })
  .refine(
    (data: any) =>
      data.decision !== 'REJECT' ||
      (typeof data.feedback === 'string' && data.feedback.trim().length >= 3),
    {
      message: 'Rejection feedback of at least 3 characters is required',
      path: ['feedback'],
    }
  );

export type ApplicationDecisionInput = zInfer<typeof applicationDecisionSchema>;
export type CampaignDecisionInput = zInfer<typeof campaignDecisionSchema>;
