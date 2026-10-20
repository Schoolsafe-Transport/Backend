import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { emitToUser, emitToTrip } from '../socket';
import {
  TransportationSearchQuery,
  CreateTransportationRequestInput,
  CounterOfferInput,
  AcceptOfferInput,
  RejectRequestInput,
  CancelAgreementInput,
  ProcessPaymentInput,
  CreateStudentInput,
  CreateVehicleInput,
  UpdateVehicleInput,
  CreateRouteInput,
  UpdateRouteInput,
  CreateTripInput,
  RecordBoardingInput,
  CreateAuthorizedPickupInput,
  CreateSafetyIncidentInput,
} from '../schemas/transportation.schema';

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
    };

    if (query.verified === true) {
      where.provider = {
        isVerified: true,
        status: 'ACTIVE',
      };
      where.vehicle = {
        isVerified: true,
        status: 'ACTIVE',
      };
    } else if (query.verified === false) {
      where.provider = {
        isVerified: false,
      };
    }

    if (query.vehicleType) {
      where.vehicle = {
        ...(where.vehicle || {}),
        OR: [
          { make: { contains: query.vehicleType, mode: 'insensitive' } },
          { model: { contains: query.vehicleType, mode: 'insensitive' } },
        ],
      };
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

  async updateTripStatus(tripId: string, status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') {
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

  async getTripPassengers(tripId: string) {
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
}

export const transportationService = new TransportationService();

