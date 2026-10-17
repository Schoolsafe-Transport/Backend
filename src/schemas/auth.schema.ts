import { z, type infer as zInfer } from 'zod';

const passwordValidation = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least 1 lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least 1 number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least 1 special character');

export const registerSchema = z
  .object({
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    password: passwordValidation,
    confirmPassword: z.string().optional(),
    firstName: z.string().min(2, 'First name must be at least 2 characters').trim(),
    lastName: z.string().min(2, 'Last name must be at least 2 characters').trim(),
    phone: z.string().optional(),
    role: z
      .enum([
        'PARENT',
        'STUDENT',
        'SCHOOL_ADMIN',
        'TRANSPORT_PROVIDER',
        'DRIVER',
        'BUSINESS',
        'ADMIN',
        'SUPER_ADMIN',
      ])
      .default('PARENT'),
  })
  .refine((data: any) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: passwordValidation,
    confirmPassword: z.string().optional(),
  })
  .refine((data: any) => !data.confirmPassword || data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordValidation,
    confirmPassword: z.string().optional(),
  })
  .refine((data: any) => !data.confirmPassword || data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const updateProfileSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters').trim().optional(),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').trim().optional(),
  phone: z.string().optional(),
  profilePhoto: z.string().url('Invalid photo URL').optional().or(z.literal('')),
});

export type RegisterInput = zInfer<typeof registerSchema>;
export type LoginInput = zInfer<typeof loginSchema>;
export type RefreshTokenInput = zInfer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = zInfer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = zInfer<typeof resetPasswordSchema>;
export type ChangePasswordInput = zInfer<typeof changePasswordSchema>;
export type UpdateProfileInput = zInfer<typeof updateProfileSchema>;

