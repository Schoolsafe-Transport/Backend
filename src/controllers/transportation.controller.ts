import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { transportationService } from '../services/transportation.service';
import {
  transportationSearchQuerySchema,
  createTransportationRequestSchema,
  counterOfferSchema,
  acceptOfferSchema,
  rejectRequestSchema,
  cancelAgreementSchema,
  processPaymentSchema,
  createStudentSchema,
  createVehicleSchema,
  updateVehicleSchema,
  createRouteSchema,
  updateRouteSchema,
  createTripSchema,
  recordBoardingSchema,
  createAuthorizedPickupSchema,
  createSafetyIncidentSchema,
} from '../schemas/transportation.schema';

export class TransportationController {
  async search(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedQuery = transportationSearchQuerySchema.parse(req.query);
      const results = await transportationService.searchTransportation(validatedQuery);
      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRouteDetails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const routeId = req.params.id;
      const details = await transportationService.getRouteDetails(routeId);
      res.json({
        success: true,
        data: details,
      });
    } catch (error) {
      next(error);
    }
  }

  async createRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = createTransportationRequestSchema.parse(req.body);
      const request = await transportationService.createRequest(req.user!.id, validatedInput);
      res.status(201).json({
        success: true,
        message: 'Transportation seat request submitted successfully',
        data: request,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRequests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const requests = await transportationService.getRequests(req.user!.id, req.user!.role, status);
      res.json({
        success: true,
        data: requests,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRequestById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.params.id;
      const request = await transportationService.getRequestById(requestId, req.user!.id, req.user!.role);
      res.json({
        success: true,
        data: request,
      });
    } catch (error) {
      next(error);
    }
  }

  async counterOffer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.params.id;
      const validatedInput = counterOfferSchema.parse(req.body);
      const request = await transportationService.submitCounterOffer(
        requestId,
        req.user!.id,
        req.user!.role,
        validatedInput
      );
      res.json({
        success: true,
        message: 'Counter-offer submitted successfully',
        data: request,
      });
    } catch (error) {
      next(error);
    }
  }

  async acceptOffer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.params.id;
      const validatedInput = acceptOfferSchema.parse(req.body);
      const request = await transportationService.acceptOffer(
        requestId,
        req.user!.id,
        req.user!.role,
        validatedInput
      );
      res.json({
        success: true,
        message: 'Offer accepted successfully',
        data: request,
      });
    } catch (error) {
      next(error);
    }
  }

  async acceptRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.params.id;
      const result = await transportationService.acceptRequest(requestId, req.user!.id, req.user!.role);
      res.json({
        success: true,
        message: 'Seat successfully reserved and transportation agreement established',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async rejectRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.params.id;
      const validatedInput = rejectRequestSchema.parse(req.body);
      const result = await transportationService.rejectRequest(
        requestId,
        req.user!.id,
        req.user!.role,
        validatedInput
      );
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelAgreement(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const agreementId = req.params.id;
      const validatedInput = cancelAgreementSchema.parse(req.body);
      const agreement = await transportationService.cancelAgreement(
        agreementId,
        req.user!.id,
        req.user!.role,
        validatedInput
      );
      res.json({
        success: true,
        message: 'Agreement cancelled and seat released successfully',
        data: agreement,
      });
    } catch (error) {
      next(error);
    }
  }

  async processPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const agreementId = req.params.id;
      const validatedInput = processPaymentSchema.parse(req.body);
      const payment = await transportationService.processPayment(
        agreementId,
        req.user!.id,
        req.user!.role,
        validatedInput
      );
      res.json({
        success: true,
        message: 'Transportation fee payment processed successfully',
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyAgreements(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const agreements = await transportationService.getMyAgreements(req.user!.id);
      res.json({
        success: true,
        data: agreements,
      });
    } catch (error) {
      next(error);
    }
  }

  async getActivePassengers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const passengers = await transportationService.getActivePassengers(req.user!.id);
      res.json({
        success: true,
        data: passengers,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStudents(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const students = await transportationService.getStudents(req.user!.id);
      res.json({
        success: true,
        data: students,
      });
    } catch (error) {
      next(error);
    }
  }

  async createStudent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = createStudentSchema.parse(req.body);
      const student = await transportationService.createStudent(req.user!.id, validatedInput);
      res.status(201).json({
        success: true,
        message: 'Child registered successfully',
        data: student,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Fleet / Vehicles
  // ==========================================

  async getVehicles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const vehicles = await transportationService.getVehicles(req.user!.id);
      res.json({
        success: true,
        data: vehicles,
      });
    } catch (error) {
      next(error);
    }
  }

  async createVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createVehicleSchema.parse(req.body);
      const vehicle = await transportationService.createVehicle(req.user!.id, validated);
      res.status(201).json({
        success: true,
        message: 'Vehicle registered successfully. Under verification review.',
        data: vehicle,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateVehicleSchema.parse(req.body);
      const vehicle = await transportationService.updateVehicle(req.user!.id, req.params.id, validated);
      res.json({
        success: true,
        message: 'Vehicle updated successfully',
        data: vehicle,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await transportationService.deleteVehicle(req.user!.id, req.params.id);
      res.json({
        success: true,
        message: 'Vehicle deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Routes Management
  // ==========================================

  async getProviderRoutes(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const routes = await transportationService.getProviderRoutes(req.user!.id);
      res.json({
        success: true,
        data: routes,
      });
    } catch (error) {
      next(error);
    }
  }

  async createRoute(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createRouteSchema.parse(req.body);
      const route = await transportationService.createRoute(req.user!.id, validated);
      res.status(201).json({
        success: true,
        message: 'Transportation route created successfully',
        data: route,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateRoute(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateRouteSchema.parse(req.body);
      const route = await transportationService.updateRoute(req.user!.id, req.params.id, validated);
      res.json({
        success: true,
        message: 'Route updated successfully',
        data: route,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteRoute(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await transportationService.deleteRoute(req.user!.id, req.params.id);
      res.json({
        success: true,
        message: 'Route removed or deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Trips & Boarding
  // ==========================================

  async getTrips(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const routeId = req.query.routeId as string | undefined;
      const trips = await transportationService.getTrips(req.user!.id, req.user!.role, routeId);
      res.json({
        success: true,
        data: trips,
      });
    } catch (error) {
      next(error);
    }
  }

  async createTrip(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createTripSchema.parse(req.body);
      const trip = await transportationService.createTrip(req.user!.id, validated);
      res.status(201).json({
        success: true,
        message: 'Transit run trip scheduled successfully',
        data: trip,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTripStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.body;
      const trip = await transportationService.updateTripStatus(
        req.params.id,
        status,
        req.user?.id,
        req.user?.role
      );
      res.json({
        success: true,
        message: `Trip status updated to ${status}`,
        data: trip,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTripPassengers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const passengers = await transportationService.getTripPassengers(req.params.id);
      res.json({
        success: true,
        data: passengers,
      });
    } catch (error) {
      next(error);
    }
  }

  async recordBoardingEvent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = recordBoardingSchema.parse(req.body);
      const event = await transportationService.recordBoardingEvent(req.user!.id, req.params.id, validated, req.user?.role);
      res.status(201).json({
        success: true,
        message: `Student successfully recorded as ${validated.eventType}`,
        data: event,
      });
    } catch (error) {
      next(error);
    }
  }

  async recordTripLocation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { latitude, longitude, speed, heading } = req.body;
      const loc = await transportationService.recordTripLocation(req.params.id, {
        latitude: Number(latitude),
        longitude: Number(longitude),
        speed: speed ? Number(speed) : 0,
        heading: heading ? Number(heading) : 0,
      }, req.user?.id, req.user?.role);
      res.status(201).json({
        success: true,
        data: loc,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLatestTripLocation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const loc = await transportationService.getLatestTripLocation(req.params.id, req.user?.id, req.user?.role);
      res.json({
        success: true,
        data: loc,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Authorized Pickups & Safety Incidents
  // ==========================================

  async getAuthorizedPickups(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId } = req.params;
      const pickups = await transportationService.getAuthorizedPickups(studentId, req.user?.id, req.user?.role);
      res.json({
        success: true,
        data: pickups,
      });
    } catch (error) {
      next(error);
    }
  }

  async createAuthorizedPickup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createAuthorizedPickupSchema.parse(req.body);
      const pickup = await transportationService.createAuthorizedPickup(req.user!.id, validated);
      res.status(201).json({
        success: true,
        message: 'Authorized pickup delegate registered',
        data: pickup,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAuthorizedPickup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId, pickupId } = req.params;
      await transportationService.deleteAuthorizedPickup(req.user!.id, studentId, pickupId);
      res.json({
        success: true,
        message: 'Authorized pickup contact removed',
      });
    } catch (error) {
      next(error);
    }
  }

  async createSafetyIncident(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createSafetyIncidentSchema.parse(req.body);
      const incident = await transportationService.createSafetyIncident(req.user!.id, validated);
      res.status(201).json({
        success: true,
        message: 'Safety incident reported. Support and dispatch notified immediately.',
        data: incident,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSafetyIncidents(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const incidents = await transportationService.getSafetyIncidents(req.user!.id, req.user!.role);
      res.json({
        success: true,
        data: incidents,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const transportationController = new TransportationController();

