import { z, type infer as zInfer } from 'zod';

export const transportationSearchQuerySchema = z.object({
  school: z.string().optional(),
  schoolBranch: z.string().optional(),
  pickupArea: z.string().optional(),
  route: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  minSeats: z.coerce.number().int().positive().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  serviceType: z.enum(['MORNING', 'AFTERNOON', 'BOTH']).optional(),
  verified: z
    .string()
    .optional()
    .transform((val?: string) => val === undefined || val === 'true'),
});

export const createTransportationRequestSchema = z.object({
  studentId: z.string().uuid({ message: 'Valid student ID is required' }),
  routeId: z.string().uuid({ message: 'Valid route ID is required' }),
  pickupStopId: z.string().uuid().optional(),
  pickupStopName: z.string().optional(),
  preferredStartDate: z.string().min(1, { message: 'Preferred start date is required' }),
  proposedPrice: z.number().positive().optional(),
  message: z.string().max(500).optional(),
});

export const counterOfferSchema = z.object({
  amount: z.number().positive({ message: 'Proposed amount must be positive' }),
  message: z.string().max(500).optional(),
});

export const acceptOfferSchema = z.object({
  offerId: z.string().uuid().optional(),
});

export const rejectRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const cancelAgreementSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const processPaymentSchema = z.object({
  paymentMethod: z.string().default('SIMULATED_TRANSFER'),
  amount: z.number().positive().optional(),
});

export const createStudentSchema = z.object({
  firstName: z.string().min(1, { message: 'First name is required' }),
  lastName: z.string().min(1, { message: 'Last name is required' }),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  grade: z.string().optional(),
  schoolName: z.string().min(1, { message: 'School name is required' }),
  schoolBranch: z.string().optional(),
  homeAddress: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

export type TransportationSearchQuery = zInfer<typeof transportationSearchQuerySchema>;
export type CreateTransportationRequestInput = zInfer<typeof createTransportationRequestSchema>;
export type CounterOfferInput = zInfer<typeof counterOfferSchema>;
export type AcceptOfferInput = zInfer<typeof acceptOfferSchema>;
export type RejectRequestInput = zInfer<typeof rejectRequestSchema>;
export type CancelAgreementInput = zInfer<typeof cancelAgreementSchema>;
export type ProcessPaymentInput = zInfer<typeof processPaymentSchema>;
export type CreateStudentInput = zInfer<typeof createStudentSchema>;
