import { z, type infer as zInfer } from 'zod';

export const initiateFaydaSchema = z.object({
  finNumber: z
    .string({ required_error: 'Fayda National ID Number (FIN) is required' })
    .trim()
    .transform((val: string) => val.replace(/[\s-]/g, ''))
    .refine((val: string) => /^\d{12}$|^\d{16}$/.test(val), {
      message: 'Fayda National ID must be a 12-digit FIN number or 16-digit VID',
    }),
});

export const verifyFaydaFinSchema = z.object({
  finNumber: z
    .string({ required_error: 'Fayda National ID Number (FIN) is required' })
    .trim()
    .transform((val: string) => val.replace(/[\s-]/g, ''))
    .refine((val: string) => /^\d{12}$|^\d{16}$/.test(val), {
      message: 'Fayda National ID must be a 12-digit FIN number or 16-digit VID',
    }),
  transactionId: z.string().uuid().optional(),
  otp: z
    .string({ required_error: 'Fayda SMS verification code (OTP) is required' })
    .trim()
    .min(4, 'OTP must be at least 4 digits')
    .max(8, 'OTP must not exceed 8 digits'),
});

export type InitiateFaydaInput = zInfer<typeof initiateFaydaSchema>;
export type VerifyFaydaFinInput = zInfer<typeof verifyFaydaFinSchema>;
