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
}

export const transportationController = new TransportationController();
