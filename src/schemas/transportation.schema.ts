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

export const createVehicleSchema = z.object({
  make: z.string().min(1, { message: 'Vehicle make is required' }),
  model: z.string().min(1, { message: 'Vehicle model is required' }),
  year: z.number().int().min(1990).max(2035).optional(),
  plateNumber: z.string().min(3, { message: 'Valid plate number is required' }),
  capacity: z.number().int().positive({ message: 'Capacity must be at least 1 seat' }),
  photoUrl: z.string().url().optional().or(z.literal('')),
});

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).optional(),
});

export const createRouteSchema = z.object({
  vehicleId: z.string().uuid({ message: 'Valid vehicle ID is required' }),
  name: z.string().min(2, { message: 'Route name is required' }),
  origin: z.string().min(2, { message: 'Origin area is required' }),
  destinationSchool: z.string().min(2, { message: 'Destination school is required' }),
  schoolBranch: z.string().optional(),
  departureTimeMorning: z.string().optional(),
  departureTimeAfternoon: z.string().optional(),
  serviceType: z.enum(['MORNING', 'AFTERNOON', 'BOTH']).default('BOTH'),
  capacity: z.number().int().positive().optional(),
  monthlyPrice: z.number().positive({ message: 'Monthly price must be positive' }),
  stops: z
    .array(
      z.object({
        name: z.string().min(1),
        pickupTimeMorning: z.string().optional(),
        dropoffTimeAfternoon: z.string().optional(),
        orderIndex: z.number().int().default(0),
      })
    )
    .optional(),
});

export const updateRouteSchema = createRouteSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  isAcceptingPassengers: z.boolean().optional(),
});

export const createTripSchema = z.object({
  routeId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  driverId: z.string().uuid().optional(),
  tripType: z.enum(['MORNING', 'AFTERNOON']).default('MORNING'),
  notes: z.string().max(500).optional(),
});

export const recordBoardingSchema = z.object({
  studentId: z.string().uuid(),
  eventType: z.enum(['BOARDED', 'DROPPED_OFF']),
  scannedStop: z.string().optional(),
  notes: z.string().max(500).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const createAuthorizedPickupSchema = z.object({
  studentId: z.string().uuid(),
  fullName: z.string().min(2, { message: 'Full name is required' }),
  relationship: z.string().min(2, { message: 'Relationship is required' }),
  phone: z.string().min(5, { message: 'Valid phone number is required' }),
  idNumber: z.string().optional(),
  photoUrl: z.string().optional(),
  isEmergencyContact: z.boolean().default(false),
});

export const createSafetyIncidentSchema = z.object({
  title: z.string().min(3, { message: 'Incident title is required' }),
  description: z.string().min(5, { message: 'Detailed description is required' }),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  tripId: z.string().uuid().optional(),
  routeId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  location: z.string().optional(),
});

export type TransportationSearchQuery = zInfer<typeof transportationSearchQuerySchema>;
export type CreateTransportationRequestInput = zInfer<typeof createTransportationRequestSchema>;
export type CounterOfferInput = zInfer<typeof counterOfferSchema>;
export type AcceptOfferInput = zInfer<typeof acceptOfferSchema>;
export type RejectRequestInput = zInfer<typeof rejectRequestSchema>;
export type CancelAgreementInput = zInfer<typeof cancelAgreementSchema>;
export type ProcessPaymentInput = zInfer<typeof processPaymentSchema>;
export type CreateStudentInput = zInfer<typeof createStudentSchema>;
export type CreateVehicleInput = zInfer<typeof createVehicleSchema>;
export type UpdateVehicleInput = zInfer<typeof updateVehicleSchema>;
export type CreateRouteInput = zInfer<typeof createRouteSchema>;
export type UpdateRouteInput = zInfer<typeof updateRouteSchema>;
export type CreateTripInput = zInfer<typeof createTripSchema>;
export type RecordBoardingInput = zInfer<typeof recordBoardingSchema>;
export type CreateAuthorizedPickupInput = zInfer<typeof createAuthorizedPickupSchema>;
export type CreateSafetyIncidentInput = zInfer<typeof createSafetyIncidentSchema>;
