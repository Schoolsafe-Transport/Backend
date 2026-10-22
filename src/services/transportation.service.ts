import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { emitToUser, emitToTrip } from '../socket';
import { getReceiptFilePath } from '../utils/receiptStorage.util';
import {
  TransportationSearchQuery,
  CreateTransportationRequestInput,
  CounterOfferInput,
  AcceptOfferInput,
  RejectRequestInput,
  CancelAgreementInput,
  ProcessPaymentInput,
  CreateStudentInput,
  UpdateStudentInput,
  CreateVehicleInput,
  UpdateVehicleInput,
  CreateRouteInput,
  UpdateRouteInput,
  CreateTripInput,
  RecordBoardingInput,
  ScanPassInput,
  CreateAuthorizedPickupInput,
  CreateSafetyIncidentInput,
} from '../schemas/transportation.schema';
import {
  generateOpaquePassToken,
  hashPassToken,
  generatePassCode,
  encryptPassToken,
  decryptPassToken,
  generateQrDataUrl,
} from '../utils/qrPass.util';

export class TransportationService {
  /**
   * Search available transportation options with verified filters.
   * Only active, verified, accepting-passengers routes with availableSeats > 0 are returned.
   */
  async searchTransportation(query: TransportationSearchQuery) {
    const where: any = {
      status: 'ACTIVE',
      isAcceptingPassengers: true,
      availableSeats: {
        gt: 0,
      },
      provider: {
        status: 'ACTIVE',
        isVerified: true,
      },
      vehicle: {
        status: 'ACTIVE',
        isVerified: true,
      },
    };

    if (query.verified === false) {
      where.provider.isVerified = false;
    }

    if (query.vehicleType) {
      where.vehicle.OR = [
        { make: { contains: query.vehicleType, mode: 'insensitive' } },
        { model: { contains: query.vehicleType, mode: 'insensitive' } },
      ];
    }

    if (query.school) {
      where.destinationSchool = {
        contains: query.school,
        mode: 'insensitive',
      };
    }

    if (query.schoolBranch) {
      where.schoolBranch = {
        contains: query.schoolBranch,
        mode: 'insensitive',
      };
    }

    if (query.route) {
      where.name = {
        contains: query.route,
        mode: 'insensitive',
      };
    }

    if (query.pickupArea) {
      where.OR = [
        {
          origin: {
            contains: query.pickupArea,
            mode: 'insensitive',
          },
        },
        {
          stops: {
            some: {
              name: {
                contains: query.pickupArea,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.monthlyPrice = {};
      if (query.minPrice !== undefined) where.monthlyPrice.gte = query.minPrice;
      if (query.maxPrice !== undefined) where.monthlyPrice.lte = query.maxPrice;
    }

    if (query.minSeats !== undefined) {
      where.availableSeats = {
        gte: query.minSeats,
      };
    }

    if (query.minRating !== undefined) {
      where.averageRating = {
        gte: query.minRating,
      };
    }

    if (query.serviceType) {
      where.serviceType = query.serviceType;
    }

    const routes = await prisma.route.findMany({
      where,
      include: {
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
            isVerified: true,
            email: true,
            phone: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            plateNumber: true,
            capacity: true,
            photoUrl: true,
            isVerified: true,
          },
        },
        stops: {
          orderBy: {
            orderIndex: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format clean marketplace listings without leaking private documents
    return routes.map((r: any) => ({
      routeId: r.id,
      routeName: r.name,
      origin: r.origin,
      destinationSchool: r.destinationSchool,
      schoolBranch: r.schoolBranch,
      departureTimeMorning: r.departureTimeMorning,
      departureTimeAfternoon: r.departureTimeAfternoon,
      serviceType: r.serviceType,
      monthlyPrice: r.monthlyPrice,
      capacity: r.capacity,
      availableSeats: r.availableSeats,
      completedTrips: r.completedTrips,
      averageRating: r.averageRating,
      provider: {
        id: r.provider.id,
        name: `${r.provider.firstName} ${r.provider.lastName}`,
        profilePhoto: r.provider.profilePhoto,
        isVerified: r.provider.isVerified,
        phone: r.provider.phone,
      },
      vehicle: {
        id: r.vehicle.id,
        model: `${r.vehicle.make} ${r.vehicle.model}`,
        plateNumber: r.vehicle.plateNumber,
        capacity: r.vehicle.capacity,
        photoUrl: r.vehicle.photoUrl,
        isVerified: r.vehicle.isVerified,
      },
      stops: r.stops.map((s: any) => ({
        id: s.id,
        name: s.name,
        pickupTimeMorning: s.pickupTimeMorning,
        dropoffTimeAfternoon: s.dropoffTimeAfternoon,
        orderIndex: s.orderIndex,
      })),
    }));
  }

  /**
   * Get detailed profile of a specific route.
   */
  async getRouteDetails(routeId: string) {
    const route = await prisma.route.findUnique({
      where: { id: routeId },
      include: {
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
            isVerified: true,
            phone: true,
            createdAt: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            plateNumber: true,
            capacity: true,
            photoUrl: true,
            isVerified: true,
            inspectionExpiry: true,
          },
        },
        stops: {
          orderBy: {
            orderIndex: 'asc',
          },
        },
      },
    });

    if (!route) {
      const err: any = new Error('Route not found');
      err.statusCode = 404;
      throw err;
    }

    return {
      route: {
        id: route.id,
        name: route.name,
        origin: route.origin,
        destinationSchool: route.destinationSchool,
        schoolBranch: route.schoolBranch,
        departureTimeMorning: route.departureTimeMorning,
        departureTimeAfternoon: route.departureTimeAfternoon,
        serviceType: route.serviceType,
        monthlyPrice: route.monthlyPrice,
        capacity: route.capacity,
        availableSeats: route.availableSeats,
        completedTrips: route.completedTrips,
        averageRating: route.averageRating,
        status: route.status,
      },
      stops: route.stops,
      vehicle: route.vehicle,
      provider: {
        id: route.provider.id,
        name: `${route.provider.firstName} ${route.provider.lastName}`,
        profilePhoto: route.provider.profilePhoto,
        isVerified: route.provider.isVerified,
        phone: route.provider.phone,
        memberSince: route.provider.createdAt,
      },
    };
  }

  /**
   * Submit seat request. Initial status is PENDING and does NOT reduce seats.
   */
  async createRequest(parentId: string, input: CreateTransportationRequestInput) {
    // 0. Identity verification check: Parent must be verified with Ethiopian Fayda National ID
    const parent = await prisma.user.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      const err: any = new Error('Parent user not found');
      err.statusCode = 404;
      throw err;
    }

    if (!parent.isVerified) {
      const err: any = new Error(
        'Identity verification required: Parents must verify their Ethiopian Fayda National ID before requesting school transportation'
      );
      err.statusCode = 403;
      throw err;
    }

    if (!parent.isEmailVerified) {
      const err: any = new Error(
        'Email verification required: Please verify your email address before requesting school transportation'
      );
      err.statusCode = 403;
      throw err;
    }

    // 1. Ownership check: student must belong to the parent
    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
    });

    if (!student || student.parentId !== parentId) {
      const err: any = new Error('Forbidden: You can only request transportation for your own child');
      err.statusCode = 403;
      throw err;
    }

    // 2. Route existence and availability check
    const route = await prisma.route.findUnique({
      where: { id: input.routeId },
      include: { provider: true, vehicle: true },
    });

    if (!route) {
      const err: any = new Error('Route not found');
      err.statusCode = 404;
      throw err;
    }

    if (route.status !== 'ACTIVE' || !route.isAcceptingPassengers || route.availableSeats <= 0) {
      const err: any = new Error('This route is currently not accepting new passengers or has no available seats');
      err.statusCode = 400;
      throw err;
    }

    // 3. Duplicate active request check
    const existing = await prisma.transportationRequest.findFirst({
      where: {
        studentId: input.studentId,
        routeId: input.routeId,
        status: { in: ['PENDING', 'NEGOTIATING', 'ACCEPTED'] },
      },
    });

    if (existing) {
      const err: any = new Error('An active request or agreement already exists for this student on this route');
      err.statusCode = 400;
      throw err;
    }

    const proposedPrice = input.proposedPrice ?? route.monthlyPrice;

    let stopName = input.pickupStopName;
    if (!stopName && input.pickupStopId) {
      const stop = await prisma.routeStop.findUnique({ where: { id: input.pickupStopId } });
      if (stop) stopName = stop.name;
    }
    if (!stopName) {
      stopName = route.origin || 'Main Pickup';
    }

    // 4. Create request and initial offer in an atomic transaction
    const newRequest = await prisma.$transaction(async (tx: any) => {
      const req = await tx.transportationRequest.create({
        data: {
          parentId,
          studentId: input.studentId,
          providerId: route.providerId,
          routeId: input.routeId,
          pickupStopId: input.pickupStopId,
          pickupStopName: stopName,
          preferredStartDate: new Date(input.preferredStartDate),
          proposedPrice,
          currentPrice: proposedPrice,
          message: input.message,
          status: 'PENDING',
        },
      });

      await tx.transportationOffer.create({
        data: {
          requestId: req.id,
          senderId: parentId,
          amount: proposedPrice,
          message: input.message || 'Initial seat request',
          status: 'PENDING',
        },
      });

      // Notification to provider
      await tx.notification.create({
        data: {
          userId: route.providerId,
          title: 'New Seat Request Received',
          message: `Parent submitted a seat request for ${student.firstName} on route ${route.name} at ETB ${proposedPrice}/month.`,
          type: 'REQUEST_RECEIVED',
          entityId: req.id,
        },
      });

      return req;
    });

    // Notify provider in real-time
    emitToUser(route.providerId, 'transportation:request_received', {
      requestId: newRequest.id,
      routeId: route.id,
      studentName: `${student.firstName} ${student.lastName}`,
      proposedPrice,
    });

    return this.getRequestById(newRequest.id, parentId, 'PARENT');
  }

  /**
   * List transportation requests filtered by user role and optional tab status.
   */
  async getRequests(userId: string, role: string, status?: string) {
    const where: any = {};

    if (role === 'PARENT') {
      where.parentId = userId;
    } else if (role === 'TRANSPORT_PROVIDER' || role === 'DRIVER') {
      where.providerId = userId;
    }

    if (status && ['PENDING', 'NEGOTIATING', 'ACCEPTED', 'REJECTED', 'CANCELLED'].includes(status.toUpperCase())) {
      where.status = status.toUpperCase();
    }

    const requests = await prisma.transportationRequest.findMany({
      where,
      include: {
        student: true,
        route: {
          include: {
            vehicle: true,
          },
        },
        parent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isVerified: true,
          },
        },
        offers: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        agreement: {
          select: {
            id: true,
            status: true,
            monthlyPrice: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return requests;
  }

  /**
   * Get single request with complete negotiation history.
   */
  async getRequestById(requestId: string, userId: string, role: string) {
    const request = await prisma.transportationRequest.findUnique({
      where: { id: requestId },
      include: {
        student: true,
        route: {
          include: {
            vehicle: true,
            stops: true,
          },
        },
        parent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isVerified: true,
          },
        },
        offers: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        agreement: true,
      },
    });

    if (!request) {
      const err: any = new Error('Transportation request not found');
      err.statusCode = 404;
      throw err;
    }

    // Role-based authorization
    const isParent = request.parentId === userId;
    const isProvider = request.providerId === userId;
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

    if (!isParent && !isProvider && !isAdmin) {
      const err: any = new Error('Forbidden: You do not have permission to view this request');
      err.statusCode = 403;
      throw err;
    }

    return request;
  }

  /**
   * Submit counter-offer in negotiation. Keeps immutable offer history.
   */
  async submitCounterOffer(requestId: string, userId: string, role: string, input: CounterOfferInput) {
    const request = await prisma.transportationRequest.findUnique({
      where: { id: requestId },
      include: { student: true, route: true },
    });

    if (!request) {
      const err: any = new Error('Transportation request not found');
      err.statusCode = 404;
      throw err;
    }

    const isParent = request.parentId === userId;
    const isProvider = request.providerId === userId;
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

    if (!isParent && !isProvider && !isAdmin) {
      const err: any = new Error('Forbidden: You are not a party to this negotiation');
      err.statusCode = 403;
      throw err;
    }

    if (request.status !== 'PENDING' && request.status !== 'NEGOTIATING') {
      const err: any = new Error(`Cannot negotiate request in '${request.status}' status`);
      err.statusCode = 400;
      throw err;
    }

    const recipientId = isParent ? request.providerId : request.parentId;

    const offer = await prisma.$transaction(async (tx: any) => {
      // Mark previous pending offers as COUNTERED
      await tx.transportationOffer.updateMany({
        where: {
          requestId,
          status: 'PENDING',
        },
        data: {
          status: 'COUNTERED',
        },
      });

      // Create new immutable offer entry
      const newOffer = await tx.transportationOffer.create({
        data: {
          requestId,
          senderId: userId,
          amount: input.amount,
          message: input.message,
          status: 'PENDING',
        },
      });

      // Update request status to NEGOTIATING and update current price
      await tx.transportationRequest.update({
        where: { id: requestId },
        data: {
          status: 'NEGOTIATING',
          currentPrice: input.amount,
        },
      });

      // Notify counterparty
      const senderTitle = isParent ? 'Parent' : 'Transport Provider';
      await tx.notification.create({
        data: {
          userId: recipientId,
          title: 'New Price Counter-Offer',
          message: `${senderTitle} offered ETB ${input.amount}/month for ${request.student.firstName}'s route.`,
          type: 'COUNTER_OFFER',
          entityId: requestId,
        },
      });

      return newOffer;
    });

    // Real-time notification
    emitToUser(recipientId, 'transportation:counter_offer', {
      requestId,
      amount: input.amount,
      message: input.message,
    });

    return this.getRequestById(requestId, userId, role);
  }

  /**
   * Accept an offer in the negotiation thread.
   */
  async acceptOffer(requestId: string, userId: string, role: string, input: AcceptOfferInput) {
    const request = await prisma.transportationRequest.findUnique({
      where: { id: requestId },
      include: {
        offers: {
          orderBy: { createdAt: 'desc' },
        },
        student: true,
      },
    });

    if (!request) {
      const err: any = new Error('Transportation request not found');
      err.statusCode = 404;
      throw err;
    }

    const isParent = request.parentId === userId;
    const isProvider = request.providerId === userId;
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

    if (!isParent && !isProvider && !isAdmin) {
      const err: any = new Error('Forbidden: You are not a party to this negotiation');
      err.statusCode = 403;
      throw err;
    }

    // Find the offer to accept
    const targetOffer = input.offerId
      ? request.offers.find((o: any) => o.id === input.offerId)
      : request.offers[0];

    if (!targetOffer) {
      const err: any = new Error('No pending offer found to accept');
      err.statusCode = 404;
      throw err;
    }

    // Prevent accepting one's own offer
    if (targetOffer.senderId === userId && !isAdmin) {
      const err: any = new Error('You cannot accept your own offer; counterparty must accept');
      err.statusCode = 400;
      throw err;
    }

    const recipientId = isParent ? request.providerId : request.parentId;

    await prisma.$transaction(async (tx: any) => {
      await tx.transportationOffer.update({
        where: { id: targetOffer.id },
        data: { status: 'ACCEPTED' },
      });

      await tx.transportationRequest.update({
        where: { id: requestId },
        data: { currentPrice: targetOffer.amount },
      });

      await tx.notification.create({
        data: {
          userId: recipientId,
          title: 'Offer Accepted!',
          message: `The counter-offer of ETB ${targetOffer.amount}/month was accepted.`,
          type: 'OFFER_ACCEPTED',
          entityId: requestId,
        },
      });
    });

    emitToUser(recipientId, 'transportation:offer_accepted', {
      requestId,
      agreedPrice: targetOffer.amount,
    });

    return this.getRequestById(requestId, userId, role);
  }

  /**
   * CRITICAL: Accept request & transactional seat reservation.
   * Concurrency Safe: Uses atomic decrement with availableSeats > 0 check.
   * If availableSeats is exhausted, rolls back and throws 409 Conflict.
   */
  async acceptRequest(requestId: string, providerId: string, role: string) {
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Fetch request with route and student
      const request = await tx.transportationRequest.findUnique({
        where: { id: requestId },
        include: {
          route: {
            include: {
              vehicle: true,
            },
          },
          student: true,
        },
      });

      if (!request) {
        const err: any = new Error('Transportation request not found');
        err.statusCode = 404;
        throw err;
      }

      const isProvider = request.providerId === providerId;
      const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

      if (!isProvider && !isAdmin) {
        const err: any = new Error('Forbidden: You can only accept requests for your own routes');
        err.statusCode = 403;
        throw err;
      }

      if (isProvider) {
        const provider = await tx.user.findUnique({ where: { id: providerId } });
        if (!provider || !provider.isEmailVerified || provider.status !== 'ACTIVE') {
          const err: any = new Error('Provider account must have verified email and active administrator approval to accept requests');
          err.statusCode = 403;
          throw err;
        }
      }

      if (request.status === 'ACCEPTED') {
        const err: any = new Error('Request has already been accepted and agreement is active');
        err.statusCode = 400;
        throw err;
      }

      if (request.status === 'REJECTED' || request.status === 'CANCELLED') {
        const err: any = new Error(`Cannot accept request in '${request.status}' status`);
        err.statusCode = 400;
        throw err;
      }

      // 2. Atomic seat decrement with condition: availableSeats > 0
      // Concurrency race condition protection: returns count: 0 if seat is already taken!
      const seatReservation = await tx.route.updateMany({
        where: {
          id: request.routeId,
          availableSeats: {
            gt: 0,
          },
        },
        data: {
          availableSeats: {
            decrement: 1,
          },
        },
      });

      if (seatReservation.count === 0) {
        const err: any = new Error('Sorry, this transportation option is no longer available.');
        err.statusCode = 409;
        throw err;
      }

      // 3. Mark request as ACCEPTED
      const updatedRequest = await tx.transportationRequest.update({
        where: { id: requestId },
        data: {
          status: 'ACCEPTED',
        },
      });

      // 4. Mark all pending offers as ACCEPTED
      await tx.transportationOffer.updateMany({
        where: {
          requestId: request.id,
          status: 'PENDING',
        },
        data: {
          status: 'ACCEPTED',
        },
      });

      // 5. Create TransportationAgreement locking permanent agreed price
      const agreement = await tx.transportationAgreement.create({
        data: {
          requestId: request.id,
          parentId: request.parentId,
          studentId: request.studentId,
          providerId: request.providerId,
          vehicleId: request.route.vehicleId,
          routeId: request.routeId,
          pickupStopId: request.pickupStopId,
          pickupStopName: request.pickupStopName,
          monthlyPrice: request.currentPrice, // Permanently stored agreed price
          currency: 'ETB',
          startDate: request.preferredStartDate,
          status: 'ACTIVE',
        },
      });

      // 6. Create initial Payment ledger record with PENDING status
      const paymentRef = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const payment = await tx.payment.create({
        data: {
          agreementId: agreement.id,
          payerId: request.parentId,
          receiverId: request.providerId,
          amount: request.currentPrice,
          currency: 'ETB',
          status: 'PENDING',
          paymentMethod: 'SIMULATED_TRANSFER',
          reference: paymentRef,
        },
      });

      // 7. Create notification for parent
      await tx.notification.create({
        data: {
          userId: request.parentId,
          title: 'Transportation Seat Reserved!',
          message: `Your seat request for ${request.student.firstName} on route ${request.route.name} was approved! Agreement active at ETB ${request.currentPrice}/month.`,
          type: 'REQUEST_ACCEPTED',
          entityId: agreement.id,
        },
      });

      return { request: updatedRequest, agreement, payment, parentId: request.parentId, routeName: request.route.name };
    });

    // Real-time Socket.IO notification to parent
    emitToUser(result.parentId, 'transportation:request_accepted', {
      requestId: result.request.id,
      agreementId: result.agreement.id,
      routeName: result.routeName,
      monthlyPrice: result.agreement.monthlyPrice,
    });

    return result;
  }

  /**
   * Provider rejects a transportation request.
   */
  async rejectRequest(requestId: string, providerId: string, role: string, input: RejectRequestInput) {
    const request = await prisma.transportationRequest.findUnique({
      where: { id: requestId },
      include: { student: true, route: true },
    });

    if (!request) {
      const err: any = new Error('Transportation request not found');
      err.statusCode = 404;
      throw err;
    }

    const isProvider = request.providerId === providerId;
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

    if (!isProvider && !isAdmin) {
      const err: any = new Error('Forbidden: You can only reject requests for your own routes');
      err.statusCode = 403;
      throw err;
    }

    if (request.status === 'ACCEPTED') {
      const err: any = new Error('Cannot reject an already accepted request. Use agreement cancellation instead.');
      err.statusCode = 400;
      throw err;
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.transportationRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED' },
      });

      await tx.transportationOffer.updateMany({
        where: { requestId, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });

      await tx.notification.create({
        data: {
          userId: request.parentId,
          title: 'Transportation Request Declined',
          message: `Your request for ${request.student.firstName} on route ${request.route.name} was not accepted.${input.reason ? ` Reason: ${input.reason}` : ''}`,
          type: 'REQUEST_REJECTED',
          entityId: requestId,
        },
      });
    });

    emitToUser(request.parentId, 'transportation:request_rejected', {
      requestId,
      reason: input.reason,
    });

    return { success: true, message: 'Request rejected' };
  }

  /**
   * Safely cancel an active agreement and release the reserved seat.
   * Transactional and ensures availableSeats <= capacity.
   */
  async cancelAgreement(agreementId: string, userId: string, role: string, input: CancelAgreementInput) {
    const result = await prisma.$transaction(async (tx: any) => {
      const agreement = await tx.transportationAgreement.findUnique({
        where: { id: agreementId },
        include: {
          route: true,
          student: true,
        },
      });

      if (!agreement) {
        const err: any = new Error('Transportation agreement not found');
        err.statusCode = 404;
        throw err;
      }

      const isParent = agreement.parentId === userId;
      const isProvider = agreement.providerId === userId;
      const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

      if (!isParent && !isProvider && !isAdmin) {
        const err: any = new Error('Forbidden: You are not authorized to cancel this agreement');
        err.statusCode = 403;
        throw err;
      }

      if (agreement.status === 'CANCELLED') {
        const err: any = new Error('Agreement is already cancelled');
        err.statusCode = 400;
        throw err;
      }

      // 1. Restore seat back to route, never exceeding vehicle/route capacity
      if (agreement.route.availableSeats < agreement.route.capacity) {
        await tx.route.update({
          where: { id: agreement.routeId },
          data: {
            availableSeats: {
              increment: 1,
            },
          },
        });
      }

      // 2. Mark agreement CANCELLED
      const updatedAgreement = await tx.transportationAgreement.update({
        where: { id: agreementId },
        data: {
          status: 'CANCELLED',
          endDate: new Date(),
        },
      });

      // 3. Update pending payment records if any
      await tx.payment.updateMany({
        where: {
          agreementId,
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
        },
      });

      // 4. Revoke active student transport pass
      await tx.studentTransportPass.updateMany({
        where: { agreementId },
        data: {
          status: 'REVOKED',
        },
      });

      // 4. Notify counterparty
      const recipientId = isParent ? agreement.providerId : agreement.parentId;
      const actorLabel = isParent ? 'Parent' : 'Transport Provider';

      await tx.notification.create({
        data: {
          userId: recipientId,
          title: 'Transportation Agreement Cancelled',
          message: `${actorLabel} cancelled the agreement for ${agreement.student.firstName}.${input.reason ? ` Reason: ${input.reason}` : ''}`,
          type: 'AGREEMENT_CANCELLED',
          entityId: agreementId,
        },
      });

      return { agreement: updatedAgreement, recipientId };
    });

    emitToUser(result.recipientId, 'transportation:agreement_cancelled', {
      agreementId,
      reason: input.reason,
    });

    return result.agreement;
  }

  /**
   * Process simulated payment for an agreement.
   * Easily replaceable with Ethiopian payment gateways (Telebirr, CBE Birr, Chapa).
   */
  async processPayment(agreementId: string, payerId: string, role: string, input: ProcessPaymentInput) {
    const agreement = await prisma.transportationAgreement.findUnique({
      where: { id: agreementId },
      include: {
        provider: true,
        student: true,
        route: true,
      },
    });

    if (!agreement) {
      const err: any = new Error('Transportation agreement not found');
      err.statusCode = 404;
      throw err;
    }

    const isParent = agreement.parentId === payerId;
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

    if (!isParent && !isAdmin) {
      const err: any = new Error('Forbidden: You can only make payments for your own agreements');
      err.statusCode = 403;
      throw err;
    }

    const amountToPay = input.amount || agreement.monthlyPrice;

    // Find pending payment or create new one
    let payment = await prisma.payment.findFirst({
      where: {
        agreementId,
        status: 'PENDING',
      },
    });

    const updatedPayment = await prisma.$transaction(async (tx: any) => {
      if (payment) {
        payment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            paymentMethod: input.paymentMethod || 'SIMULATED_TRANSFER',
            amount: amountToPay,
          },
        });
      } else {
        const reference = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        payment = await tx.payment.create({
          data: {
            agreementId,
            payerId,
            receiverId: agreement.providerId,
            amount: amountToPay,
            currency: 'ETB',
            status: 'PAID',
            paymentMethod: input.paymentMethod || 'SIMULATED_TRANSFER',
            reference,
            paidAt: new Date(),
          },
        });
      }

      // Notify provider of payment receipt
      await tx.notification.create({
        data: {
          userId: agreement.providerId,
          title: 'Transportation Fee Received',
          message: `Payment of ETB ${amountToPay} received for student ${agreement.student.firstName} (${agreement.route.name}).`,
          type: 'PAYMENT_SUCCESSFUL',
          entityId: payment.id,
        },
      });

      return payment;
    });

    emitToUser(agreement.providerId, 'transportation:payment_completed', {
      agreementId,
      amount: amountToPay,
      paymentId: updatedPayment.id,
    });

    return updatedPayment;
  }

  /**
   * Upload manual payment receipt evidence for an agreement.
   * File is stored in private storage and status set to PENDING_REVIEW.
   * Uploading a receipt is evidence, not automatic payment confirmation.
   */
  async uploadPaymentReceipt(
    agreementId: string,
    parentId: string,
    file: Express.Multer.File,
    notes?: string
  ) {
    if (!file) {
      const err: any = new Error('Payment receipt file is required (JPEG, PNG, or PDF up to 5MB)');
      err.statusCode = 400;
      throw err;
    }

    const agreement = await prisma.transportationAgreement.findUnique({
      where: { id: agreementId },
      include: {
        provider: true,
        student: true,
        route: true,
      },
    });

    if (!agreement) {
      const err: any = new Error('Transportation agreement not found');
      err.statusCode = 404;
      throw err;
    }

    if (agreement.parentId !== parentId) {
      const err: any = new Error('Forbidden: You can only upload receipts for your own agreements');
      err.statusCode = 403;
      throw err;
    }

    // Find pending, unpaid, rejected or review payment for this agreement
    let payment = await prisma.payment.findFirst({
      where: {
        agreementId,
        status: { in: ['PENDING', 'UNPAID', 'PENDING_REVIEW', 'REJECTED'] as any },
      },
      orderBy: { createdAt: 'desc' },
    });

    const updatedPayment = await prisma.$transaction(async (tx: any) => {
      if (payment) {
        payment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'PENDING_REVIEW',
            paymentMethod: 'MANUAL_TRANSFER',
            receiptUrl: file.filename,
            receiptOriginalName: file.originalname,
            receiptMimeType: file.mimetype,
            receiptSize: file.size,
            receiptUploadedAt: new Date(),
            rejectionReason: null, // Clear any past rejection reason on new upload
            notes: notes || null,
          },
        });
      } else {
        const reference = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        payment = await tx.payment.create({
          data: {
            agreementId,
            payerId: parentId,
            receiverId: agreement.providerId,
            amount: agreement.monthlyPrice,
            currency: agreement.currency || 'ETB',
            status: 'PENDING_REVIEW',
            paymentMethod: 'MANUAL_TRANSFER',
            reference,
            receiptUrl: file.filename,
            receiptOriginalName: file.originalname,
            receiptMimeType: file.mimetype,
            receiptSize: file.size,
            receiptUploadedAt: new Date(),
            notes: notes || null,
          },
        });
      }

      // Notify provider that evidence has been submitted
      await tx.notification.create({
        data: {
          userId: agreement.providerId,
          title: 'Payment Evidence Submitted',
          message: `Payment receipt uploaded for ${agreement.student.firstName} (${agreement.route.name}). Status: Pending administrator review.`,
          type: 'PAYMENT_RECEIPT_SUBMITTED',
          entityId: payment.id,
        },
      });

      return payment;
    });

    emitToUser(agreement.providerId, 'transportation:receipt_uploaded', {
      agreementId,
      amount: agreement.monthlyPrice,
      paymentId: updatedPayment.id,
    });

    return updatedPayment;
  }

  /**
   * Retrieves securely stored payment receipt file for authorized actors.
   * Access is strictly restricted to:
   * 1. The paying parent
   * 2. The assigned route transport provider
   * 3. SchoolSafe administrators
   */
  async getPaymentReceipt(paymentId: string, requesterId: string, requesterRole: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        agreement: {
          include: {
            route: true,
            provider: true,
            student: true,
          },
        },
      },
    });

    if (!payment) {
      const err: any = new Error('Payment record not found');
      err.statusCode = 404;
      throw err;
    }

    if (!payment.receiptUrl) {
      const err: any = new Error('No receipt has been uploaded for this payment record');
      err.statusCode = 404;
      throw err;
    }

    const isAdmin = requesterRole === 'ADMIN' || requesterRole === 'SUPER_ADMIN';
    const isPayer = payment.payerId === requesterId;
    const isProvider = payment.receiverId === requesterId || payment.agreement.providerId === requesterId;

    if (!isAdmin && !isPayer && !isProvider) {
      const err: any = new Error('Forbidden: You are not authorized to view this payment receipt evidence');
      err.statusCode = 403;
      throw err;
    }

    const filePath = getReceiptFilePath(payment.receiptUrl);
    return {
      filePath,
      mimeType: payment.receiptMimeType || 'image/jpeg',
      originalName: payment.receiptOriginalName || 'receipt.jpg',
      payment,
    };
  }

  /**
   * Get active and historical transportation agreements for parent.
   */
  async getMyAgreements(parentId: string) {
    const agreements = await prisma.transportationAgreement.findMany({
      where: { parentId },
      include: {
        student: true,
        route: {
          include: {
            stops: true,
          },
        },
        vehicle: true,
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
            phone: true,
            email: true,
            isVerified: true,
          },
        },
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return agreements;
  }

  /**
   * Get active passengers for transport provider manifest.
   */
  async getActivePassengers(providerId: string) {
    const agreements = await prisma.transportationAgreement.findMany({
      where: {
        providerId,
        status: 'ACTIVE',
      },
      include: {
        student: true,
        parent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        route: true,
        vehicle: true,
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return agreements.map((a: any) => ({
      agreementId: a.id,
      student: {
        id: a.student.id,
        name: `${a.student.firstName} ${a.student.lastName}`,
        grade: a.student.grade,
        schoolName: a.student.schoolName,
        emergencyPhone: a.student.emergencyPhone,
      },
      parent: {
        id: a.parent.id,
        name: `${a.parent.firstName} ${a.parent.lastName}`,
        phone: a.parent.phone,
        email: a.parent.email,
      },
      route: {
        id: a.route.id,
        name: a.route.name,
      },
      vehicle: {
        id: a.vehicle.id,
        plateNumber: a.vehicle.plateNumber,
        model: `${a.vehicle.make} ${a.vehicle.model}`,
      },
      pickupStopName: a.pickupStopName,
      monthlyPrice: a.monthlyPrice,
      agreementStatus: a.status,
      latestPayment: a.payments[0]
        ? {
            status: a.payments[0].status,
            amount: a.payments[0].amount,
            paidAt: a.payments[0].paidAt,
          }
        : null,
    }));
  }

  /**
   * Helper: Get parent's students (children).
   */
  async getStudents(parentId: string) {
    return prisma.student.findMany({
      where: { parentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Helper: Register a new student for parent.
   */
  async createStudent(parentId: string, input: CreateStudentInput) {
    return prisma.student.create({
      data: {
        parentId,
        firstName: input.firstName,
        lastName: input.lastName,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        grade: input.grade,
        schoolName: input.schoolName,
        schoolBranch: input.schoolBranch,
        homeAddress: input.homeAddress,
        emergencyPhone: input.emergencyPhone,
      },
    });
  }

  /**
   * Helper: Get student by ID with ownership enforcement.
   */
  async getStudentById(studentId: string, userId: string, userRole: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      const err: any = new Error('Student not found');
      err.statusCode = 404;
      throw err;
    }

    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    const isParent = student.parentId === userId;

    if (!isAdmin && !isParent) {
      const err: any = new Error('Forbidden: You do not have permission to view this child record');
      err.statusCode = 403;
      throw err;
    }

    return student;
  }

  /**
   * Helper: Update student record with ownership enforcement.
   */
  async updateStudent(studentId: string, userId: string, userRole: string, input: UpdateStudentInput) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      const err: any = new Error('Student not found');
      err.statusCode = 404;
      throw err;
    }

    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    const isParent = student.parentId === userId;

    if (!isAdmin && !isParent) {
      const err: any = new Error('Forbidden: You do not have permission to modify this child record');
      err.statusCode = 403;
      throw err;
    }

    return prisma.student.update({
      where: { id: studentId },
      data: {
        ...(input.firstName !== undefined && { firstName: input.firstName }),
        ...(input.lastName !== undefined && { lastName: input.lastName }),
        ...(input.gender !== undefined && { gender: input.gender }),
        ...(input.dateOfBirth !== undefined && {
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        }),
        ...(input.grade !== undefined && { grade: input.grade }),
        ...(input.schoolName !== undefined && { schoolName: input.schoolName }),
        ...(input.schoolBranch !== undefined && { schoolBranch: input.schoolBranch }),
        ...(input.homeAddress !== undefined && { homeAddress: input.homeAddress }),
        ...(input.emergencyPhone !== undefined && { emergencyPhone: input.emergencyPhone }),
      },
    });
  }

  /**
   * Helper: Delete student record with ownership enforcement.
   */
  async deleteStudent(studentId: string, userId: string, userRole: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      const err: any = new Error('Student not found');
      err.statusCode = 404;
      throw err;
    }

    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    const isParent = student.parentId === userId;

    if (!isAdmin && !isParent) {
      const err: any = new Error('Forbidden: You do not have permission to delete this child record');
      err.statusCode = 403;
      throw err;
    }

    return prisma.student.delete({
      where: { id: studentId },
    });
  }

  // ==========================================
  // Fleet / Vehicle Management for Providers
  // ==========================================

  async getVehicles(providerId: string) {
    return prisma.vehicle.findMany({
      where: { providerId },
      include: {
        routes: {
          select: { id: true, name: true, status: true, availableSeats: true, capacity: true },
        },
        documents: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createVehicle(providerId: string, input: CreateVehicleInput) {
    // Check if plateNumber already registered
    const existing = await prisma.vehicle.findUnique({
      where: { plateNumber: input.plateNumber.toUpperCase().trim() },
    });

    if (existing) {
      throw new Error(`Vehicle with plate number ${input.plateNumber} is already registered`);
    }

    return prisma.vehicle.create({
      data: {
        providerId,
        make: input.make,
        model: input.model,
        year: input.year,
        plateNumber: input.plateNumber.toUpperCase().trim(),
        capacity: input.capacity,
        photoUrl: input.photoUrl || null,
        isVerified: false, // Explicit false: requires safety check or admin validation
        status: 'ACTIVE',
      },
    });
  }

  async updateVehicle(providerId: string, vehicleId: string, input: UpdateVehicleInput) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, providerId },
    });

    if (!vehicle) {
      throw new Error('Vehicle not found or you are not authorized to modify it');
    }

    return prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        make: input.make,
        model: input.model,
        year: input.year,
        capacity: input.capacity,
        photoUrl: input.photoUrl !== undefined ? input.photoUrl : vehicle.photoUrl,
        status: input.status,
      },
    });
  }

  async deleteVehicle(providerId: string, vehicleId: string) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, providerId },
      include: {
        routes: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.routes.length > 0) {
      throw new Error('Cannot delete vehicle while active routes are assigned to it. Please deactivate the routes first.');
    }

    return prisma.vehicle.delete({
      where: { id: vehicleId },
    });
  }

  // ==========================================
  // Route Management for Providers
  // ==========================================

  async getProviderRoutes(providerId: string) {
    return prisma.route.findMany({
      where: { providerId },
      include: {
        vehicle: true,
        stops: { orderBy: { orderIndex: 'asc' } },
        _count: {
          select: {
            agreements: { where: { status: 'ACTIVE' } },
            requests: { where: { status: 'PENDING' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRoute(providerId: string, input: CreateRouteInput) {
    const provider = await prisma.user.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      const err: any = new Error('Provider account not found');
      err.statusCode = 404;
      throw err;
    }

    if (!provider.isEmailVerified) {
      const err: any = new Error('Email verification required: Please verify your email before publishing routes');
      err.statusCode = 403;
      throw err;
    }

    if (provider.status !== 'ACTIVE') {
      const err: any = new Error('Account pending administrator approval: Your provider account must be approved by an administrator before publishing transportation routes');
      err.statusCode = 403;
      throw err;
    }

    // Verify vehicle belongs to provider
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: input.vehicleId, providerId },
    });

    if (!vehicle) {
      throw new Error('Assigned vehicle not found or does not belong to your account');
    }

    const routeCapacity = input.capacity || vehicle.capacity;

    return prisma.route.create({
      data: {
        providerId,
        vehicleId: input.vehicleId,
        name: input.name,
        origin: input.origin,
        destinationSchool: input.destinationSchool,
        schoolBranch: input.schoolBranch,
        departureTimeMorning: input.departureTimeMorning,
        departureTimeAfternoon: input.departureTimeAfternoon,
        serviceType: input.serviceType,
        capacity: routeCapacity,
        availableSeats: routeCapacity,
        monthlyPrice: input.monthlyPrice,
        isAcceptingPassengers: true,
        status: 'ACTIVE',
        stops: input.stops && input.stops.length > 0
          ? {
              create: input.stops.map((stop: any, idx: number) => ({
                name: stop.name,
                pickupTimeMorning: stop.pickupTimeMorning,
                dropoffTimeAfternoon: stop.dropoffTimeAfternoon,
                orderIndex: stop.orderIndex !== undefined ? stop.orderIndex : idx,
              })),
            }
          : undefined,
      },
      include: {
        vehicle: true,
        stops: { orderBy: { orderIndex: 'asc' } },
      },
    });
  }

  async updateRoute(providerId: string, routeId: string, input: UpdateRouteInput) {
    const route = await prisma.route.findFirst({
      where: { id: routeId, providerId },
    });

    if (!route) {
      throw new Error('Route not found or you are not authorized to edit it');
    }

    return prisma.route.update({
      where: { id: routeId },
      data: {
        name: input.name,
        origin: input.origin,
        destinationSchool: input.destinationSchool,
        schoolBranch: input.schoolBranch,
        departureTimeMorning: input.departureTimeMorning,
        departureTimeAfternoon: input.departureTimeAfternoon,
        serviceType: input.serviceType,
        monthlyPrice: input.monthlyPrice,
        status: input.status,
        isAcceptingPassengers: input.isAcceptingPassengers,
      },
      include: {
        vehicle: true,
        stops: { orderBy: { orderIndex: 'asc' } },
      },
    });
  }

  async deleteRoute(providerId: string, routeId: string) {
    const route = await prisma.route.findFirst({
      where: { id: routeId, providerId },
      include: {
        agreements: { where: { status: 'ACTIVE' } },
      },
    });

    if (!route) {
      throw new Error('Route not found');
    }

    if (route.agreements.length > 0) {
      // Instead of hard delete, safely deactivate to preserve contracts
      return prisma.route.update({
        where: { id: routeId },
        data: { status: 'INACTIVE', isAcceptingPassengers: false },
      });
    }

    return prisma.route.delete({
      where: { id: routeId },
    });
  }

  // ==========================================
  // Trips & Live Transit Control
  // ==========================================

  async getTrips(userId: string, role: string, routeId?: string) {
    const where: any = {};
    if (routeId) where.routeId = routeId;

    if (role === 'TRANSPORT_PROVIDER' || role === 'DRIVER') {
      where.OR = [
        { driverId: userId },
        { route: { providerId: userId } },
      ];
    } else if (role === 'PARENT') {
      // Return trips corresponding to parent's active agreements
      const parentAgreements = await prisma.transportationAgreement.findMany({
        where: { parentId: userId, status: 'ACTIVE' },
        select: { routeId: true },
      });
      const routeIds = parentAgreements.map((a: any) => a.routeId);
      where.routeId = { in: routeIds };
    }

    return prisma.trip.findMany({
      where,
      include: {
        route: true,
        vehicle: true,
        driver: { select: { id: true, firstName: true, lastName: true, phone: true } },
        passengers: {
          include: {
            student: true,
          },
        },
        locations: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async createTrip(userId: string, input: CreateTripInput) {
    // Verify route belongs to provider or driver
    const route = await prisma.route.findFirst({
      where: { id: input.routeId },
      include: {
        agreements: {
          where: { status: 'ACTIVE' },
          select: { studentId: true, pickupStopName: true },
        },
      },
    });

    if (!route) {
      throw new Error('Route not found');
    }

    const driverId = input.driverId || userId;

    // Create Trip and automatically populate passengers from active agreements
    const trip = await prisma.trip.create({
      data: {
        routeId: input.routeId,
        vehicleId: input.vehicleId,
        driverId,
        tripType: input.tripType,
        status: 'SCHEDULED',
        notes: input.notes,
        passengers: {
          create: route.agreements.map((a: any) => ({
            studentId: a.studentId,
            pickupStopName: a.pickupStopName,
            status: 'SCHEDULED',
          })),
        },
      },
      include: {
        route: true,
        vehicle: true,
        passengers: { include: { student: true } },
      },
    });

    return trip;
  }

  async updateTripStatus(
    tripId: string,
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    actorId?: string,
    actorRole?: string
  ) {
    const existingTrip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        driver: true,
        vehicle: true,
        route: true,
      },
    });

    if (!existingTrip) {
      const err: any = new Error('Trip not found');
      err.statusCode = 404;
      throw err;
    }

    if (actorRole === 'DRIVER' && actorId && existingTrip.driverId !== actorId) {
      const err: any = new Error('Forbidden: You can only update trips assigned to your driver account');
      err.statusCode = 403;
      throw err;
    }

    if (actorRole === 'TRANSPORT_PROVIDER' && actorId && existingTrip.route.providerId !== actorId) {
      const err: any = new Error('Forbidden: You can only update trips for your own routes');
      err.statusCode = 403;
      throw err;
    }

    if (status === 'IN_PROGRESS') {
      if (!existingTrip.driver.isEmailVerified) {
        const err: any = new Error('Driver email must be verified before starting trips');
        err.statusCode = 403;
        throw err;
      }
      if (existingTrip.driver.status !== 'ACTIVE') {
        const err: any = new Error('Driver account must have active administrator approval before starting trips');
        err.statusCode = 403;
        throw err;
      }
      if (existingTrip.vehicle.status !== 'ACTIVE') {
        const err: any = new Error('Assigned vehicle is not active or authorized for operation');
        err.statusCode = 400;
        throw err;
      }
    }

    const updateData: any = { status };
    if (status === 'IN_PROGRESS') {
      updateData.startTime = new Date();
    } else if (status === 'COMPLETED') {
      updateData.endTime = new Date();
    }

    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: updateData,
      include: {
        route: true,
        vehicle: true,
        passengers: { include: { student: true } },
      },
    });

    // Notify trip room and subscribers
    emitToTrip(tripId, 'trip_status_changed', {
      tripId,
      status,
      updatedAt: new Date().toISOString(),
    });

    return updatedTrip;
  }

  async getTripPassengers(tripId: string, userId: string, userRole: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { route: true },
    });

    if (!trip) {
      const error: AppError = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    const isAssignedDriver = trip.driverId === userId;
    const isRouteProvider = trip.route?.providerId === userId;

    if (!isAdmin && !isAssignedDriver && !isRouteProvider) {
      const error: AppError = new Error('Access denied: You are not authorized to view passenger information for this trip');
      error.statusCode = 403;
      throw error;
    }

    return prisma.tripPassenger.findMany({
      where: { tripId },
      include: {
        student: {
          include: {
            parent: {
              select: { id: true, firstName: true, lastName: true, phone: true },
            },
            authorizedPickups: true,
          },
        },
      },
    });
  }

  async recordBoardingEvent(
    userId: string,
    tripId: string,
    input: RecordBoardingInput,
    userRole?: string
  ) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { route: true },
    });

    if (!trip) {
      const error: AppError = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    const isAssignedDriver = trip.driverId === userId;
    const isRouteProvider = trip.route?.providerId === userId;

    if (!isAdmin && !isAssignedDriver && !isRouteProvider) {
      const error: AppError = new Error('Access denied: You are not authorized to record boarding events for this trip');
      error.statusCode = 403;
      throw error;
    }

    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
      include: { parent: true },
    });

    if (!student) {
      const error: AppError = new Error('Student not found');
      error.statusCode = 404;
      throw error;
    }

    // 1. Create Boarding Event log
    const event = await prisma.boardingEvent.create({
      data: {
        tripId,
        studentId: input.studentId,
        eventType: input.eventType,
        scannedStop: input.scannedStop || null,
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        notes: input.notes || null,
      },
    });

    // 2. Update passenger manifest status
    const passengerStatus = input.eventType === 'BOARDED' ? 'BOARDED' : 'DROPPED_OFF';
    await prisma.tripPassenger.updateMany({
      where: { tripId, studentId: input.studentId },
      data: {
        status: passengerStatus,
        ...(input.eventType === 'BOARDED' ? { boardedAt: new Date() } : { droppedOffAt: new Date() }),
      },
    });

    // 3. Send high-priority in-app notification to the child's parent
    const eventLabel = input.eventType === 'BOARDED' ? 'safely boarded the bus' : 'safely arrived and dropped off';
    await prisma.notification.create({
      data: {
        userId: student.parentId,
        title: `Child Safety Update: ${student.firstName} ${student.lastName}`,
        message: `${student.firstName} has ${eventLabel} for route ${trip.route.name}${input.scannedStop ? ` at ${input.scannedStop}` : ''}.`,
        type: input.eventType === 'BOARDED' ? 'STUDENT_BOARDED' : 'STUDENT_DROPPED_OFF',
        entityId: tripId,
      },
    });

    // Real-time socket emission to parent
    emitToUser(student.parentId, 'student:boarding_event', {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      eventType: input.eventType,
      tripId,
      scannedStop: input.scannedStop,
      timestamp: new Date().toISOString(),
    });

    return event;
  }

  async recordTripLocation(
    tripId: string,
    coords: { latitude: number; longitude: number; speed?: number; heading?: number },
    userId?: string,
    userRole?: string
  ) {
    if (
      typeof coords.latitude !== 'number' ||
      typeof coords.longitude !== 'number' ||
      isNaN(coords.latitude) ||
      isNaN(coords.longitude) ||
      coords.latitude < -90 ||
      coords.latitude > 90 ||
      coords.longitude < -180 ||
      coords.longitude > 180
    ) {
      const error: AppError = new Error('Invalid GPS coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.');
      error.statusCode = 400;
      throw error;
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { route: true },
    });

    if (!trip) {
      const error: AppError = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    if (trip.status !== 'IN_PROGRESS') {
      const error: AppError = new Error(`Cannot record GPS location for trip with status '${trip.status}'. Trip must be IN_PROGRESS.`);
      error.statusCode = 400;
      throw error;
    }

    if (userId) {
      const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
      const isAssignedDriver = trip.driverId === userId;
      const isRouteProvider = trip.route?.providerId === userId;

      if (!isAdmin && !isAssignedDriver && !isRouteProvider) {
        const error: AppError = new Error('Access denied: Only assigned driver or provider can post GPS telemetry for this trip');
        error.statusCode = 403;
        throw error;
      }
    }

    const loc = await prisma.tripLocation.create({
      data: {
        tripId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        speed: coords.speed || 0,
        heading: coords.heading || 0,
      },
    });

    emitToTrip(tripId, 'trip_location_update', {
      tripId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      speed: coords.speed || 0,
      heading: coords.heading || 0,
      timestamp: loc.timestamp.toISOString(),
    });

    return loc;
  }

  async getLatestTripLocation(tripId: string, userId?: string, userRole?: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        route: true,
        passengers: {
          include: { student: true },
        },
      },
    });

    if (!trip) {
      const error: AppError = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    if (userId) {
      const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
      const isAssignedDriver = trip.driverId === userId;
      const isRouteProvider = trip.route?.providerId === userId;
      const hasEnrolledChild = trip.passengers.some((p: any) => p.student?.parentId === userId);

      if (!isAdmin && !isAssignedDriver && !isRouteProvider && !hasEnrolledChild) {
        const error: AppError = new Error('Access denied: You do not have permission to view location for this journey');
        error.statusCode = 403;
        throw error;
      }
    }

    return prisma.tripLocation.findFirst({
      where: { tripId },
      orderBy: { timestamp: 'desc' },
    });
  }

  // ==========================================
  // Child Safety & Incident Management
  // ==========================================

  async getAuthorizedPickups(studentId: string, userId?: string, userRole?: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      const error: AppError = new Error('Student not found');
      error.statusCode = 404;
      throw error;
    }

    if (userId) {
      const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
      const isParent = student.parentId === userId;

      if (!isAdmin && !isParent) {
        const hasActiveTrip = await prisma.tripPassenger.findFirst({
          where: {
            studentId,
            trip: {
              OR: [
                { driverId: userId },
                { route: { providerId: userId } },
              ],
            },
          },
        });

        if (!hasActiveTrip) {
          const error: AppError = new Error('Access denied: You are not authorized to view pickup contacts for this child');
          error.statusCode = 403;
          throw error;
        }
      }
    }

    return prisma.authorizedPickupPerson.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAuthorizedPickup(parentId: string, input: CreateAuthorizedPickupInput) {
    // Verify parent owns student
    const student = await prisma.student.findFirst({
      where: { id: input.studentId, parentId },
    });

    if (!student) {
      throw new Error('Student not found or access denied');
    }

    return prisma.authorizedPickupPerson.create({
      data: {
        studentId: input.studentId,
        fullName: input.fullName,
        relationship: input.relationship,
        phone: input.phone,
        idNumber: input.idNumber,
        photoUrl: input.photoUrl,
        isEmergencyContact: input.isEmergencyContact,
      },
    });
  }

  async deleteAuthorizedPickup(parentId: string, studentId: string, pickupId: string) {
    const student = await prisma.student.findFirst({
      where: { id: studentId, parentId },
    });

    if (!student) {
      throw new Error('Student not found or access denied');
    }

    return prisma.authorizedPickupPerson.delete({
      where: { id: pickupId },
    });
  }

  async createSafetyIncident(userId: string, input: CreateSafetyIncidentInput) {
    return prisma.safetyIncident.create({
      data: {
        reportedById: userId,
        title: input.title,
        description: input.description,
        severity: input.severity,
        tripId: input.tripId || null,
        routeId: input.routeId || null,
        vehicleId: input.vehicleId || null,
        location: input.location || null,
        status: 'OPEN',
      },
    });
  }

  async getSafetyIncidents(userId: string, role: string) {
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      return prisma.safetyIncident.findMany({
        include: {
          reportedBy: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          route: true,
          vehicle: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return prisma.safetyIncident.findMany({
      where: { reportedById: userId },
      include: {
        route: true,
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * TASK 1 & 2: Generate or retrieve a secure Student Transport Pass.
   * Only active, verified bookings with eligible provider and vehicle can generate an ACTIVE pass.
   * Parents can only access passes for their own children.
   */
  async getOrCreateStudentTransportPass(agreementId: string, userId: string, role: string) {
    const agreement = await prisma.transportationAgreement.findUnique({
      where: { id: agreementId },
      include: {
        student: true,
        route: {
          include: {
            stops: true,
          },
        },
        vehicle: true,
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            isVerified: true,
            profilePhoto: true,
          },
        },
        transportPass: true,
      },
    });

    if (!agreement) {
      const err: any = new Error('Transportation agreement not found');
      err.statusCode = 404;
      throw err;
    }

    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    const isParent = agreement.parentId === userId;
    const isProvider = agreement.providerId === userId;

    if (!isAdmin && !isParent && !isProvider) {
      const err: any = new Error('Forbidden: You can only view transport passes for your own children or assigned agreements');
      err.statusCode = 403;
      throw err;
    }

    // Task 1: Check active booking status and provider/vehicle eligibility
    if (agreement.status !== 'ACTIVE') {
      const err: any = new Error('Cannot generate transport pass: Booking is not active or has been cancelled. An accepted, active transportation booking is required.');
      err.statusCode = 400;
      throw err;
    }

    if (agreement.provider.status !== 'ACTIVE' || !agreement.provider.isVerified) {
      const err: any = new Error('Cannot generate transport pass: Assigned transport provider is not active or verified.');
      err.statusCode = 400;
      throw err;
    }

    if (agreement.vehicle.status !== 'ACTIVE' || !agreement.vehicle.isVerified) {
      const err: any = new Error('Cannot generate transport pass: Assigned vehicle is not active or verified.');
      err.statusCode = 400;
      throw err;
    }

    let pass = agreement.transportPass;
    let rawToken: string = '';
    let qrDataUrl: string = pass?.qrDataUrl || '';

    if (pass && pass.encryptedToken) {
      rawToken = decryptPassToken(pass.encryptedToken);
    }

    // If pass doesn't exist or token was rotated/missing, generate cryptographically secure token
    if (!pass || !rawToken || !qrDataUrl) {
      rawToken = generateOpaquePassToken();
      const tokenHash = hashPassToken(rawToken);
      const encryptedToken = encryptPassToken(rawToken);
      const passCode = pass?.passCode || generatePassCode();
      qrDataUrl = await generateQrDataUrl(rawToken);

      if (!pass) {
        pass = await prisma.studentTransportPass.create({
          data: {
            studentId: agreement.studentId,
            agreementId: agreement.id,
            passCode,
            tokenHash,
            status: 'ACTIVE',
            encryptedToken,
            qrDataUrl,
            issuedAt: new Date(),
          },
        });
      } else {
        pass = await prisma.studentTransportPass.update({
          where: { id: pass.id },
          data: {
            tokenHash,
            encryptedToken,
            qrDataUrl,
            status: 'ACTIVE',
            updatedAt: new Date(),
          },
        });
      }
    }

    // Match stop times if available
    const stop = agreement.route.stops?.find((s: any) => s.name === agreement.pickupStopName);

    return {
      id: pass.id,
      passCode: pass.passCode,
      status: pass.status,
      issuedAt: pass.issuedAt,
      lastScannedAt: pass.lastScannedAt,
      scanCount: pass.scanCount,
      qrDataUrl,
      qrToken: rawToken,
      student: {
        id: agreement.student.id,
        firstName: agreement.student.firstName,
        lastName: agreement.student.lastName,
        grade: agreement.student.grade,
        schoolName: agreement.student.schoolName,
        schoolBranch: agreement.student.schoolBranch,
        emergencyPhone: agreement.student.emergencyPhone,
      },
      school: {
        name: agreement.student.schoolName,
        branch: agreement.student.schoolBranch || agreement.route.schoolBranch || 'Main Campus',
      },
      provider: {
        id: agreement.provider.id,
        name: `${agreement.provider.firstName} ${agreement.provider.lastName}`,
        phone: agreement.provider.phone,
        isVerified: agreement.provider.isVerified,
      },
      vehicle: {
        id: agreement.vehicle.id,
        make: agreement.vehicle.make,
        model: agreement.vehicle.model,
        plateNumber: agreement.vehicle.plateNumber,
      },
      route: {
        id: agreement.route.id,
        name: agreement.route.name,
        origin: agreement.route.origin,
        destinationSchool: agreement.route.destinationSchool,
        pickupStopName: agreement.pickupStopName,
        pickupTimeMorning: stop?.pickupTimeMorning || agreement.route.departureTimeMorning || '07:30 AM',
        dropoffTimeAfternoon: stop?.dropoffTimeAfternoon || agreement.route.departureTimeAfternoon || '03:30 PM',
      },
      agreement: {
        id: agreement.id,
        status: agreement.status,
        monthlyPrice: agreement.monthlyPrice,
        currency: agreement.currency,
      },
      branding: {
        appName: 'SchoolSafe',
        systemName: 'Student Transport SafePass',
        tagline: 'Verified Identity & Real-time Boarding Network',
      },
    };
  }

  /**
   * Regenerate pass token for security (e.g. if student pass is lost).
   */
  async regenerateStudentTransportPass(agreementId: string, userId: string, role: string) {
    const agreement = await prisma.transportationAgreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement) {
      const err: any = new Error('Transportation agreement not found');
      err.statusCode = 404;
      throw err;
    }

    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    const isParent = agreement.parentId === userId;

    if (!isAdmin && !isParent) {
      const err: any = new Error('Forbidden: You can only regenerate passes for your own children');
      err.statusCode = 403;
      throw err;
    }

    if (agreement.status !== 'ACTIVE') {
      const err: any = new Error('Cannot regenerate pass: Agreement is no longer active');
      err.statusCode = 400;
      throw err;
    }

    // Force rotation of token
    const rawToken = generateOpaquePassToken();
    const tokenHash = hashPassToken(rawToken);
    const encryptedToken = encryptPassToken(rawToken);
    const passCode = generatePassCode();
    const qrDataUrl = await generateQrDataUrl(rawToken);

    await prisma.studentTransportPass.upsert({
      where: { agreementId: agreement.id },
      create: {
        studentId: agreement.studentId,
        agreementId: agreement.id,
        passCode,
        tokenHash,
        status: 'ACTIVE',
        encryptedToken,
        qrDataUrl,
        issuedAt: new Date(),
      },
      update: {
        passCode,
        tokenHash,
        encryptedToken,
        qrDataUrl,
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });

    return this.getOrCreateStudentTransportPass(agreementId, userId, role);
  }

  /**
   * TASK 4, 5 & 7: Scan student QR pass from driver / provider app.
   * Strictly validates role, vehicle & trip assignment, prevents duplicates on same trip,
   * records authoritative boarding/arrival event, and emits real-time updates.
   */
  async scanStudentPass(
    tripId: string,
    userId: string,
    userRole: string,
    input: ScanPassInput
  ) {
    // 1. Hash the incoming opaque token
    const tokenHash = hashPassToken(input.qrToken);

    // 2. Look up the pass by tokenHash
    const pass = await prisma.studentTransportPass.findUnique({
      where: { tokenHash },
      include: {
        student: true,
        agreement: {
          include: {
            route: true,
            vehicle: true,
            provider: true,
          },
        },
      },
    });

    if (!pass) {
      const err: any = new Error('Invalid or unrecognized student transport pass. QR token could not be verified.');
      err.statusCode = 404;
      throw err;
    }

    // 3. Validate pass and underlying agreement status
    if (pass.status !== 'ACTIVE') {
      const err: any = new Error(`Transport pass is ${pass.status.toLowerCase()} and cannot authorize boarding.`);
      err.statusCode = 400;
      throw err;
    }

    if (pass.agreement.status !== 'ACTIVE') {
      const err: any = new Error(`Cannot authorize boarding: Transportation booking is ${pass.agreement.status.toLowerCase()}.`);
      err.statusCode = 400;
      throw err;
    }

    if (pass.agreement.provider.status !== 'ACTIVE' || !pass.agreement.provider.isVerified) {
      const err: any = new Error('Cannot authorize boarding: Provider account is not active or verified.');
      err.statusCode = 400;
      throw err;
    }

    if (pass.agreement.vehicle.status !== 'ACTIVE' || !pass.agreement.vehicle.isVerified) {
      const err: any = new Error('Cannot authorize boarding: Assigned vehicle is not active or verified.');
      err.statusCode = 400;
      throw err;
    }

    // 4. Validate Trip exists and is active
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        driver: true,
        vehicle: true,
        route: true,
        passengers: true,
      },
    });

    if (!trip) {
      const err: any = new Error('Trip not found');
      err.statusCode = 404;
      throw err;
    }

    if (trip.status === 'CANCELLED' || trip.status === 'COMPLETED') {
      const err: any = new Error(`Cannot record events on a trip with status ${trip.status}`);
      err.statusCode = 400;
      throw err;
    }

    // 5. TASK 7: Validate user assignment to this trip
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    const isAssignedDriver = trip.driverId === userId;
    const isVehicleOwner = trip.vehicle?.providerId === userId;
    const isRouteProvider = trip.route?.providerId === userId;

    if (!isAdmin && !isAssignedDriver && !isVehicleOwner && !isRouteProvider) {
      const err: any = new Error('Access denied: You are not assigned to drive or operate this trip');
      err.statusCode = 403;
      throw err;
    }

    // 6. Verify vehicle/route match with the student's booking
    const vehicleMatches = trip.vehicleId === pass.agreement.vehicleId;
    const routeMatches = trip.routeId === pass.agreement.routeId;

    if (!vehicleMatches && !routeMatches) {
      const err: any = new Error('Student is not assigned to this vehicle or route');
      err.statusCode = 400;
      throw err;
    }

    // 7. Ensure student is listed on this trip passenger manifest
    let passenger = await prisma.tripPassenger.findUnique({
      where: {
        tripId_studentId: {
          tripId,
          studentId: pass.studentId,
        },
      },
    });

    if (!passenger) {
      passenger = await prisma.tripPassenger.create({
        data: {
          tripId,
          studentId: pass.studentId,
          pickupStopName: pass.agreement.pickupStopName,
          status: 'SCHEDULED',
        },
      });
    }

    // 8. TASK 5: Enforce state transitions and prevent duplicate scans on this trip
    const existingEventsForTrip = await prisma.boardingEvent.findMany({
      where: {
        tripId,
        studentId: pass.studentId,
      },
      orderBy: { timestamp: 'desc' },
    });

    const alreadyHasThisEvent = existingEventsForTrip.some((e: any) => e.eventType === input.eventType);
    if (alreadyHasThisEvent) {
      const err: any = new Error(`Duplicate scan rejected: Event '${input.eventType}' has already been recorded for this student on this trip.`);
      err.statusCode = 409;
      throw err;
    }

    // State transition validations
    if (input.eventType === 'ARRIVED_AT_SCHOOL') {
      const hasBoarded = existingEventsForTrip.some((e: any) => e.eventType === 'BOARDED');
      if (!hasBoarded) {
        const err: any = new Error("Invalid state transition: Student must be marked as 'BOARDED' before recording 'ARRIVED_AT_SCHOOL'.");
        err.statusCode = 400;
        throw err;
      }
    }

    if (input.eventType === 'DROPPED_OFF') {
      const hasBoarded = existingEventsForTrip.some(
        (e: any) => e.eventType === 'BOARDED' || e.eventType === 'BOARDED_FOR_RETURN'
      );
      if (!hasBoarded) {
        const err: any = new Error("Invalid state transition: Student must be boarded before recording 'DROPPED_OFF'.");
        err.statusCode = 400;
        throw err;
      }
    }

    // 9. Record authoritative event with server timestamp
    const authoritativeTimestamp = new Date();
    const event = await prisma.boardingEvent.create({
      data: {
        tripId,
        studentId: pass.studentId,
        eventType: input.eventType,
        timestamp: authoritativeTimestamp,
        scannedStop: input.scannedStop || pass.agreement.pickupStopName || null,
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        verifiedByName: `${trip.driver?.firstName || 'Assigned'} ${trip.driver?.lastName || 'Driver'}`,
        notes: input.notes || 'Scanned via driver QR pass reader',
      },
    });

    // 10. Update manifest passenger status
    let updatedPassengerStatus: any = 'BOARDED';
    if (input.eventType === 'ARRIVED_AT_SCHOOL') updatedPassengerStatus = 'ARRIVED_AT_SCHOOL';
    else if (input.eventType === 'BOARDED_FOR_RETURN') updatedPassengerStatus = 'BOARDED_FOR_RETURN';
    else if (input.eventType === 'DROPPED_OFF') updatedPassengerStatus = 'DROPPED_OFF';

    await prisma.tripPassenger.update({
      where: { id: passenger.id },
      data: {
        status: updatedPassengerStatus,
        ...(input.eventType === 'BOARDED' || input.eventType === 'BOARDED_FOR_RETURN'
          ? { boardedAt: authoritativeTimestamp }
          : {}),
        ...(input.eventType === 'DROPPED_OFF' || input.eventType === 'ARRIVED_AT_SCHOOL'
          ? { droppedOffAt: authoritativeTimestamp }
          : {}),
      },
    });

    // 11. Update pass metadata (does NOT permanently invalidate pass; supports future trips)
    await prisma.studentTransportPass.update({
      where: { id: pass.id },
      data: {
        lastScannedAt: authoritativeTimestamp,
        scanCount: { increment: 1 },
      },
    });

    // 12. Friendly labels for notification
    const eventLabels: Record<string, string> = {
      BOARDED: 'has safely boarded the vehicle',
      ARRIVED_AT_SCHOOL: 'has safely arrived at school',
      BOARDED_FOR_RETURN: 'has boarded the vehicle for the return journey',
      DROPPED_OFF: 'has safely arrived and been dropped off at the stop',
    };
    const actionText = eventLabels[input.eventType] || `recorded event ${input.eventType}`;

    // Notification to parent
    await prisma.notification.create({
      data: {
        userId: pass.student.parentId,
        title: `SafePass Update: ${pass.student.firstName} ${pass.student.lastName}`,
        message: `${pass.student.firstName} ${actionText} (${trip.route?.name || 'Assigned Route'}).`,
        type: `PASS_${input.eventType}`,
        entityId: tripId,
      },
    });

    // Real-time socket emissions
    emitToUser(pass.student.parentId, 'student:boarding_event', {
      studentId: pass.student.id,
      studentName: `${pass.student.firstName} ${pass.student.lastName}`,
      eventType: input.eventType,
      tripId,
      scannedStop: input.scannedStop || pass.agreement.pickupStopName,
      timestamp: authoritativeTimestamp.toISOString(),
    });

    emitToTrip(tripId, 'trip:passenger_update', {
      tripId,
      studentId: pass.student.id,
      status: updatedPassengerStatus,
      eventType: input.eventType,
      timestamp: authoritativeTimestamp.toISOString(),
    });

    // 13. TASK 7: Return minimum required student info to driver scanner
    return {
      success: true,
      message: `Verified: ${pass.student.firstName} ${pass.student.lastName.charAt(0)}. ${actionText}.`,
      event: {
        id: event.id,
        eventType: event.eventType,
        timestamp: event.timestamp,
        tripId,
        scannedStop: event.scannedStop,
      },
      student: {
        id: pass.student.id,
        firstName: pass.student.firstName,
        lastName: pass.student.lastName,
        schoolName: pass.student.schoolName,
        pickupStopName: pass.agreement.pickupStopName,
      },
      passengerStatus: updatedPassengerStatus,
    };
  }

  /**
   * TASK 6: Get latest trip status and safe travel journey for parent dashboard.
   */
  async getStudentTripStatus(studentId: string, userId: string, role: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        agreements: {
          where: { status: 'ACTIVE' },
          include: {
            route: true,
            vehicle: true,
            provider: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                profilePhoto: true,
              },
            },
            transportPass: {
              select: {
                id: true,
                passCode: true,
                status: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!student) {
      const err: any = new Error('Student not found');
      err.statusCode = 404;
      throw err;
    }

    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    const isParent = student.parentId === userId;

    if (!isAdmin && !isParent) {
      const err: any = new Error('Forbidden: You can only view trip status for your own child');
      err.statusCode = 403;
      throw err;
    }

    const activeAgreement = student.agreements[0] || null;

    // Fetch latest boarding event
    const latestEvent = await prisma.boardingEvent.findFirst({
      where: { studentId },
      include: {
        trip: {
          include: {
            route: true,
            vehicle: true,
            driver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Human readable status mapping
    let statusLabel = 'Waiting for Pickup';
    let statusBadgeColor = 'neutral';
    let detailMessage = 'Vehicle scheduled for regular pickup route.';

    if (latestEvent) {
      const isToday =
        new Date(latestEvent.timestamp).toDateString() === new Date().toDateString();

      if (isToday) {
        switch (latestEvent.eventType) {
          case 'BOARDED':
            statusLabel = 'Student Boarded';
            statusBadgeColor = 'info';
            detailMessage = `Boarded bus at ${latestEvent.scannedStop || 'scheduled stop'}. Transit in progress.`;
            break;
          case 'ARRIVED_AT_SCHOOL':
            statusLabel = 'Arrived at School';
            statusBadgeColor = 'success';
            detailMessage = `Safely arrived at ${student.schoolName}.`;
            break;
          case 'BOARDED_FOR_RETURN':
            statusLabel = 'Return Journey Started';
            statusBadgeColor = 'info';
            detailMessage = 'Boarded bus for afternoon homebound transit.';
            break;
          case 'DROPPED_OFF':
            statusLabel = 'Dropped Off';
            statusBadgeColor = 'success';
            detailMessage = `Safely dropped off at ${latestEvent.scannedStop || 'designated stop'}.`;
            break;
        }
      }
    }

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        schoolName: student.schoolName,
        schoolBranch: student.schoolBranch,
      },
      hasActiveBooking: !!activeAgreement,
      pass: activeAgreement?.transportPass || null,
      statusLabel,
      statusBadgeColor,
      detailMessage,
      latestEvent: latestEvent
        ? {
            id: latestEvent.id,
            eventType: latestEvent.eventType,
            timestamp: latestEvent.timestamp,
            scannedStop: latestEvent.scannedStop,
            tripId: latestEvent.tripId,
            driverName: latestEvent.trip?.driver
              ? `${latestEvent.trip.driver.firstName} ${latestEvent.trip.driver.lastName}`
              : null,
            driverPhone: latestEvent.trip?.driver?.phone || null,
            vehiclePlate: latestEvent.trip?.vehicle?.plateNumber || null,
          }
        : null,
      activeAgreement: activeAgreement
        ? {
            id: activeAgreement.id,
            routeId: activeAgreement.routeId,
            routeName: activeAgreement.route.name,
            pickupStopName: activeAgreement.pickupStopName,
            providerName: `${activeAgreement.provider.firstName} ${activeAgreement.provider.lastName}`,
            providerPhone: activeAgreement.provider.phone,
            vehiclePlate: activeAgreement.vehicle.plateNumber,
            vehicleModel: `${activeAgreement.vehicle.make} ${activeAgreement.vehicle.model}`,
          }
        : null,
    };
  }
}

export const transportationService = new TransportationService();

