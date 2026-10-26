import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { sanitizeUser } from '../utils/security.util';
import { emailService } from './email.service';

export class AdminService {
  /**
   * Retrieves paginated list of users with multi-criteria filtering and keyword search.
   */
  async listUsers(query: {
    page?: number;
    limit?: number;
    role?: string;
    status?: string;
    search?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          emailVerificationTokens: {
            where: { used: false },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { sixDigitCode: true, createdAt: true, expiresAt: true },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      users: users.map(sanitizeUser),
    };
  }

  /**
   * Directly verifies a user's email address from the admin dashboard.
   */
  async verifyUserEmail(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.emailVerificationToken.updateMany({
      where: { userId, used: false },
      data: { used: true },
    });
    return sanitizeUser(updated);
  }

  /**
   * Updates account status of any user (e.g. approve pending driver, suspend violator).
   */
  async updateUserStatus(
    userId: string,
    status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REJECTED',
    requesterRole?: string,
    requesterId?: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (user.role === 'SUPER_ADMIN' && requesterRole !== 'SUPER_ADMIN') {
      const error: AppError = new Error('Only a SUPER_ADMIN can modify a SUPER_ADMIN account');
      error.statusCode = 403;
      throw error;
    }

    if (user.role === 'ADMIN' && requesterRole !== 'SUPER_ADMIN' && requesterId !== userId) {
      const error: AppError = new Error('Only a SUPER_ADMIN can modify other ADMIN accounts');
      error.statusCode = 403;
      throw error;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        status: status as any,
        isVerified: status === 'ACTIVE' ? true : user.isVerified,
      },
    });

    // 1. In-App Notification Feed
    let notifTitle = 'Account Status Updated';
    let notifMessage = `Your SchoolSafe account status is now ${status}.`;
    let notifType = 'ACCOUNT_STATUS';

    if (status === 'ACTIVE') {
      notifTitle = '🎉 Account Approved & Activated!';
      notifMessage = 'Your SchoolSafe account has been approved by the administrator. You now have full access to all platform features.';
      notifType = 'ACCOUNT_APPROVED';
    } else if (status === 'SUSPENDED') {
      notifTitle = '⚠️ Account Suspended';
      notifMessage = 'Your SchoolSafe account has been suspended by an administrator. Please contact support for assistance.';
      notifType = 'ACCOUNT_SUSPENDED';
    } else if (status === 'REJECTED') {
      notifTitle = 'Application Decision';
      notifMessage = 'Your account application has been reviewed and rejected by an administrator.';
      notifType = 'ACCOUNT_REJECTED';
    }

    try {
      await prisma.notification.create({
        data: {
          userId,
          title: notifTitle,
          message: notifMessage,
          type: notifType,
          entityId: userId,
          isRead: false,
        },
      });
    } catch (notifErr: any) {
      console.warn('[AdminService] Could not create in-app notification:', notifErr.message);
    }

    // 2. Dispatch real decision email to user's inbox
    try {
      await emailService.sendApprovalDecisionEmail(
        updated.email,
        updated.firstName,
        status === 'ACTIVE' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'SUSPENDED'
      );
    } catch (emailErr: any) {
      console.warn('[AdminService] Could not send decision email:', emailErr.message);
    }

    // 3. Record Audit Log
    if (requesterId) {
      await this.recordAuditLog(
        requesterId,
        status === 'ACTIVE' ? 'APPROVE_USER' : status === 'SUSPENDED' ? 'SUSPEND_USER' : 'REJECT_USER',
        'USER',
        userId,
        `Account status changed to ${status}`,
        userId
      );
    }

    return sanitizeUser(updated);
  }

  /**
   * Retrieves provider, driver, and business registration applications with document and verification status.
   */
  async listApplications(query: { role?: string; status?: string; search?: string }) {
    const where: any = {
      role: { in: ['PARENT', 'TRANSPORT_PROVIDER', 'DRIVER', 'BUSINESS', 'STUDENT'] },
    };

    if (query.role) {
      where.role = query.role;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const applications = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        isEmailVerified: true,
        emailVerifiedAt: true,
        isVerified: true,
        rejectionReason: true,
        businessName: true,
        licenseNumber: true,
        serviceArea: true,
        registrationStep: true,
        createdAt: true,
        updatedAt: true,
        accountDocuments: {
          select: {
            id: true,
            documentType: true,
            documentName: true,
            fileUrl: true,
            status: true,
            rejectionReason: true,
            createdAt: true,
          },
        },
        vehicles: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            plateNumber: true,
            capacity: true,
            isVerified: true,
            status: true,
            documents: {
              select: {
                id: true,
                documentType: true,
                documentUrl: true,
                isVerified: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return applications;
  }

  /**
   * Administrative decision on an applicant (APPROVE, REJECT, SUSPEND).
   * Enforces role hierarchy, requires rejection reasons, and sends decision notice.
   */
  async reviewApplication(
    userId: string,
    decision: 'APPROVE' | 'REJECT' | 'SUSPEND',
    reason?: string,
    requesterRole?: string,
    requesterId?: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error: AppError = new Error('Applicant not found');
      error.statusCode = 404;
      throw error;
    }

    if (user.role === 'SUPER_ADMIN' && requesterRole !== 'SUPER_ADMIN') {
      const error: AppError = new Error('Only a SUPER_ADMIN can modify a SUPER_ADMIN account');
      error.statusCode = 403;
      throw error;
    }

    if (user.role === 'ADMIN' && requesterRole !== 'SUPER_ADMIN' && requesterId !== userId) {
      const error: AppError = new Error('Only a SUPER_ADMIN can modify other ADMIN accounts');
      error.statusCode = 403;
      throw error;
    }

    if (decision === 'REJECT' && (!reason || !reason.trim())) {
      const error: AppError = new Error('A rejection reason must be provided when rejecting an application');
      error.statusCode = 400;
      throw error;
    }

    let nextStatus: 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
    let rejectionReason: string | null = null;

    if (decision === 'APPROVE') {
      nextStatus = 'ACTIVE';
      rejectionReason = null;
    } else if (decision === 'REJECT') {
      nextStatus = 'REJECTED';
      rejectionReason = reason!.trim();
    } else {
      nextStatus = 'SUSPENDED';
      rejectionReason = reason ? reason.trim() : null;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        status: nextStatus,
        rejectionReason,
        isVerified: decision === 'APPROVE' ? true : user.isVerified,
      },
    });

    // In-App Notification Feed
    let appNotifTitle = 'Application Status Updated';
    let appNotifMessage = `Your SchoolSafe application status is now ${nextStatus}.`;
    let appNotifType = 'APPLICATION_STATUS';

    if (decision === 'APPROVE') {
      appNotifTitle = '🎉 Application Approved!';
      appNotifMessage = 'Congratulations! Your SchoolSafe application has been approved by the administrator. You now have full access to your provider dashboard.';
      appNotifType = 'APPLICATION_APPROVED';
    } else if (decision === 'REJECT') {
      appNotifTitle = 'Application Decision';
      appNotifMessage = `Your SchoolSafe application was not approved.${reason ? ` Reason: ${reason}` : ''}`;
      appNotifType = 'APPLICATION_REJECTED';
    } else if (decision === 'SUSPEND') {
      appNotifTitle = '⚠️ Account Suspended';
      appNotifMessage = `Your account has been suspended.${reason ? ` Reason: ${reason}` : ''}`;
      appNotifType = 'APPLICATION_SUSPENDED';
    }

    try {
      await prisma.notification.create({
        data: {
          userId,
          title: appNotifTitle,
          message: appNotifMessage,
          type: appNotifType,
          entityId: userId,
          isRead: false,
        },
      });
    } catch (notifErr: any) {
      console.warn('[AdminService] Could not create in-app notification:', notifErr.message);
    }

    // Send decision notice via email
    try {
      await emailService.sendApprovalDecisionEmail(
        updated.email,
        updated.firstName,
        decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'SUSPENDED',
        rejectionReason || undefined
      );
    } catch (err: any) {
      console.error('[AdminService] Could not send decision email:', err.message);
    }

    if (requesterId) {
      await this.recordAuditLog(
        requesterId,
        decision === 'APPROVE' ? 'APPROVE_USER' : decision === 'REJECT' ? 'REJECT_USER' : 'SUSPEND_USER',
        'USER',
        userId,
        rejectionReason || `Account marked as ${decision}`,
        userId
      );
    }

    return sanitizeUser(updated);
  }

  /**
   * Platform Overview: Comprehensive system metrics and health indicators.
   * Directly queries PostgreSQL records for accurate platform reporting.
   */
  async getPlatformStats() {
    const [
      totalUsers,
      usersByRole,
      parentsCount,
      pendingProvidersCount,
      approvedProvidersCount,
      pendingBusinessesCount,
      approvedBusinessesCount,
      pendingVehiclesCount,
      approvedVehiclesCount,
      totalVehicles,
      activeRoutesCount,
      totalRoutesCount,
      activeAgreements,
      activeTripsCount,
      totalTripsCount,
      totalPayments,
      pendingPaymentsCount,
      safetyIncidents,
      openIncidentsCount,
      pendingCampaignsCount,
      activeAdsCount,
      totalCampaignsCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
      prisma.user.count({ where: { role: 'PARENT' } }),
      prisma.user.count({ where: { role: 'TRANSPORT_PROVIDER', status: 'PENDING' } }),
      prisma.user.count({ where: { role: 'TRANSPORT_PROVIDER', status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'BUSINESS', status: 'PENDING' } }),
      prisma.user.count({ where: { role: 'BUSINESS', status: 'ACTIVE' } }),
      prisma.vehicle.count({ where: { isVerified: false } }),
      prisma.vehicle.count({ where: { isVerified: true, status: 'ACTIVE' } }),
      prisma.vehicle.count(),
      prisma.route.count({ where: { status: 'ACTIVE' } }),
      prisma.route.count(),
      prisma.transportationAgreement.count({ where: { status: 'ACTIVE' } }),
      prisma.trip.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.trip.count(),
      prisma.payment.aggregate({
        where: { status: { in: ['PAID', 'APPROVED'] } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payment.count({
        where: {
          OR: [
            { status: 'PENDING_REVIEW' },
            { status: 'PENDING', receiptUrl: { not: null } },
          ],
        },
      }),
      prisma.safetyIncident.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.safetyIncident.count({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      }),
      prisma.advertisingCampaign.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.advertisingCampaign.count({ where: { status: 'ACTIVE' } }),
      prisma.advertisingCampaign.count(),
    ]);

    const roleCounts: Record<string, number> = {};
    usersByRole.forEach((r: any) => {
      roleCounts[r.role] = r._count.id;
    });

    const incidentCounts: Record<string, number> = {};
    safetyIncidents.forEach((s: any) => {
      incidentCounts[s.status] = s._count.id;
    });

    const pendingTotal =
      pendingProvidersCount +
      pendingVehiclesCount +
      pendingBusinessesCount +
      pendingCampaignsCount +
      pendingPaymentsCount;

    return {
      totalUsers,
      pendingProviders: pendingProvidersCount,
      approvedProviders: approvedProvidersCount,
      totalVehicles,
      activeRoutes: activeRoutesCount,
      activeTrips: activeTripsCount,
      metrics: {
        totalUsers,
        parents: parentsCount,
        parentsCount,
        pendingProviders: pendingProvidersCount,
        approvedProviders: approvedProvidersCount,
        pendingBusinesses: pendingBusinessesCount,
        approvedBusinesses: approvedBusinessesCount,
        pendingVehicles: pendingVehiclesCount,
        approvedVehicles: approvedVehiclesCount,
        totalVehicles,
        activeRoutes: activeRoutesCount,
        totalRoutes: totalRoutesCount,
        activeTrips: activeTripsCount,
        totalTrips: totalTripsCount,
        openIncidents: openIncidentsCount,
        pendingPayments: pendingPaymentsCount,
        pendingCampaigns: pendingCampaignsCount,
        activeCampaigns: activeAdsCount,
        totalCampaigns: totalCampaignsCount,
        totalPaidVolumeETB: totalPayments._sum.amount || 0,
        paidTransactionsCount: totalPayments._count.id,
      },
      pendingApprovals: {
        providers: pendingProvidersCount,
        vehicles: pendingVehiclesCount,
        businesses: pendingBusinessesCount,
        campaigns: pendingCampaignsCount,
        payments: pendingPaymentsCount,
        total: pendingTotal,
      },
      users: {
        total: totalUsers,
        byRole: roleCounts,
      },
      transportation: {
        activeRoutes: activeRoutesCount,
        totalVehicles,
        activeAgreements,
        activeTrips: activeTripsCount,
      },
      financials: {
        totalPaidVolumeETB: totalPayments._sum.amount || 0,
        paidTransactionsCount: totalPayments._count.id,
      },
      safety: {
        incidents: incidentCounts,
      },
      advertising: {
        activeCampaigns: activeAdsCount,
      },
    };
  }

  /**
   * Retrieves paginated vehicles with provider information, documents, and route assignments.
   */
  async listVehicles(query: {
    page?: number;
    limit?: number;
    status?: string;
    isVerified?: boolean;
    search?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (typeof query.isVerified === 'boolean') where.isVerified = query.isVerified;
    if (query.search) {
      where.OR = [
        { plateNumber: { contains: query.search, mode: 'insensitive' } },
        { make: { contains: query.search, mode: 'insensitive' } },
        { model: { contains: query.search, mode: 'insensitive' } },
        { provider: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { provider: { lastName: { contains: query.search, mode: 'insensitive' } } },
        { provider: { businessName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [total, vehicles] = await Promise.all([
      prisma.vehicle.count({ where }),
      prisma.vehicle.findMany({
        where,
        skip,
        take: limit,
        include: {
          provider: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              businessName: true,
              isVerified: true,
              status: true,
            },
          },
          documents: true,
          routes: {
            select: {
              id: true,
              name: true,
              status: true,
              origin: true,
              destinationSchool: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      vehicles,
    };
  }

  /**
   * Administrative decision on a vehicle verification request.
   */
  async reviewVehicle(
    vehicleId: string,
    decision: 'APPROVE' | 'REJECT',
    reason?: string,
    adminId?: string
  ) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { provider: true },
    });

    if (!vehicle) {
      const error: AppError = new Error('Vehicle record not found');
      error.statusCode = 404;
      throw error;
    }

    if (decision === 'REJECT' && (!reason || !reason.trim())) {
      const error: AppError = new Error('A rejection reason must be provided when rejecting vehicle verification');
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        isVerified: decision === 'APPROVE',
        status: decision === 'APPROVE' ? 'ACTIVE' : 'REJECTED',
      },
    });

    try {
      await prisma.notification.create({
        data: {
          userId: vehicle.providerId,
          title: decision === 'APPROVE' ? 'Vehicle Approved & Verified' : 'Vehicle Verification Rejected',
          message: decision === 'APPROVE'
            ? `Your vehicle ${vehicle.make} ${vehicle.model} (${vehicle.plateNumber}) has been approved and verified for student transit service.`
            : `Your vehicle ${vehicle.make} ${vehicle.model} (${vehicle.plateNumber}) was rejected: ${reason?.trim()}`,
          type: decision === 'APPROVE' ? 'VEHICLE_APPROVED' : 'VEHICLE_REJECTED',
          entityId: vehicle.id,
        },
      });
    } catch (e: any) {
      console.warn('[AdminService] Could not send vehicle review notification:', e.message);
    }

    if (adminId) {
      await this.recordAuditLog(
        adminId,
        decision === 'APPROVE' ? 'APPROVE_VEHICLE' : 'REJECT_VEHICLE',
        'VEHICLE',
        vehicleId,
        reason || `Vehicle marked as ${decision}`,
        vehicle.providerId
      );
    }

    return updated;
  }

  /**
   * Retrieves all platform transit routes with provider and vehicle details.
   */
  async listRoutes(query: { status?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { origin: { contains: query.search, mode: 'insensitive' } },
        { destinationSchool: { contains: query.search, mode: 'insensitive' } },
        { provider: { businessName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [total, routes] = await Promise.all([
      prisma.route.count({ where }),
      prisma.route.findMany({
        where,
        skip,
        take: limit,
        include: {
          provider: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              businessName: true,
              isVerified: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              make: true,
              model: true,
              plateNumber: true,
              capacity: true,
              isVerified: true,
              status: true,
            },
          },
          stops: { orderBy: { orderIndex: 'asc' } },
          _count: {
            select: {
              agreements: { where: { status: 'ACTIVE' } },
              requests: { where: { status: 'PENDING' } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, page, limit, totalPages: Math.ceil(total / limit), routes };
  }

  /**
   * Retrieves active and scheduled transit trips across the platform.
   */
  async listTrips(query: { status?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { route: { name: { contains: query.search, mode: 'insensitive' } } },
        { vehicle: { plateNumber: { contains: query.search, mode: 'insensitive' } } },
        { driver: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { driver: { lastName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [total, trips] = await Promise.all([
      prisma.trip.count({ where }),
      prisma.trip.findMany({
        where,
        skip,
        take: limit,
        include: {
          route: {
            select: {
              id: true,
              name: true,
              origin: true,
              destinationSchool: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              make: true,
              model: true,
              plateNumber: true,
            },
          },
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          passengers: {
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  schoolName: true,
                },
              },
            },
          },
          locations: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, page, limit, totalPages: Math.ceil(total / limit), trips };
  }

  /**
   * Retrieves all advertising campaigns across businesses with performance metrics.
   */
  async listCampaigns(query: { status?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status as any;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { business: { businessName: { contains: query.search, mode: 'insensitive' } } },
        { business: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [total, campaigns] = await Promise.all([
      prisma.advertisingCampaign.count({ where }),
      prisma.advertisingCampaign.findMany({
        where,
        skip,
        take: limit,
        include: {
          business: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              businessName: true,
              isVerified: true,
              status: true,
            },
          },
          package: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, page, limit, totalPages: Math.ceil(total / limit), campaigns };
  }

  /**
   * Reviews an advertising campaign (APPROVE or REJECT).
   */
  async reviewCampaign(
    campaignId: string,
    decision: 'APPROVE' | 'REJECT',
    reason?: string,
    adminId?: string
  ) {
    const campaign = await prisma.advertisingCampaign.findUnique({
      where: { id: campaignId },
      include: { business: true },
    });

    if (!campaign) {
      const error: AppError = new Error('Advertising campaign not found');
      error.statusCode = 404;
      throw error;
    }

    if (decision === 'REJECT' && (!reason || !reason.trim())) {
      const error: AppError = new Error('A rejection reason must be provided when rejecting a campaign');
      error.statusCode = 400;
      throw error;
    }

    const nextStatus = decision === 'APPROVE' ? 'ACTIVE' : 'REJECTED';
    const startDate = decision === 'APPROVE' ? new Date() : campaign.startDate;

    const updated = await prisma.advertisingCampaign.update({
      where: { id: campaignId },
      data: {
        status: nextStatus as any,
        startDate,
      },
    });

    try {
      await prisma.notification.create({
        data: {
          userId: campaign.businessId,
          title: decision === 'APPROVE' ? 'Campaign Approved & Live' : 'Campaign Review Rejected',
          message: decision === 'APPROVE'
            ? `Your advertising campaign "${campaign.title}" has been approved and is now active across SchoolSafe placements.`
            : `Your advertising campaign "${campaign.title}" was rejected: ${reason?.trim()}`,
          type: decision === 'APPROVE' ? 'CAMPAIGN_APPROVED' : 'CAMPAIGN_REJECTED',
          entityId: campaign.id,
        },
      });
    } catch (e: any) {
      console.warn('[AdminService] Could not send campaign review notification:', e.message);
    }

    if (adminId) {
      await this.recordAuditLog(
        adminId,
        decision === 'APPROVE' ? 'APPROVE_CAMPAIGN' : 'REJECT_CAMPAIGN',
        'CAMPAIGN',
        campaignId,
        reason || `Campaign marked as ${decision}`,
        campaign.businessId
      );
    }

    return updated;
  }

  /**
   * Retrieves all safety incidents across the platform for administrative resolution.
   */
  async listSafetyIncidents(query: { status?: string; severity?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;

    return prisma.safetyIncident.findMany({
      where,
      include: {
        reportedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        vehicle: true,
        route: true,
        trip: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Administrative resolution for a safety incident.
   */
  async resolveSafetyIncident(incidentId: string, resolution: string) {
    const incident = await prisma.safetyIncident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      const error: AppError = new Error('Safety incident not found');
      error.statusCode = 404;
      throw error;
    }

    return prisma.safetyIncident.update({
      where: { id: incidentId },
      data: {
        status: 'RESOLVED',
        resolution,
        resolvedAt: new Date(),
      },
    });
  }

  /**
   * Retrieves payments submitted for review or ledger history.
   */
  async listPayments(query: { status?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      if (query.status === 'PENDING') {
        where.status = { in: ['PENDING', 'PENDING_REVIEW'] };
      } else if (query.status === 'APPROVED') {
        where.status = { in: ['APPROVED', 'PAID'] };
      } else {
        where.status = query.status;
      }
    }

    if (query.search) {
      where.OR = [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { payer: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { payer: { lastName: { contains: query.search, mode: 'insensitive' } } },
        { payer: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        include: {
          payer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          receiver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          agreement: {
            include: {
              student: true,
              route: true,
              vehicle: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      payments: payments.map((p: any) => ({
        id: p.id,
        agreementId: p.agreementId,
        reference: p.reference,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        paymentMethod: p.paymentMethod,
        receiptUrl: p.receiptUrl ? `/api/transportation/payments/${p.id}/receipt` : null,
        hasReceipt: Boolean(p.receiptUrl),
        receiptOriginalName: p.receiptOriginalName,
        receiptMimeType: p.receiptMimeType,
        receiptSize: p.receiptSize,
        receiptUploadedAt: p.receiptUploadedAt,
        rejectionReason: p.rejectionReason,
        notes: p.notes,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
        reviewedAt: p.reviewedAt,
        reviewedBy: p.reviewedBy,
        parent: p.payer,
        provider: p.receiver,
        student: p.agreement?.student,
        route: p.agreement?.route,
        vehicle: p.agreement?.vehicle,
      })),
    };
  }

  /**
   * Reviews a payment evidence submission (APPROVE, REJECT, or REQUEST_NEW_RECEIPT).
   */
  async reviewPayment(
    paymentId: string,
    adminId: string,
    decision: 'APPROVE' | 'REJECT' | 'REQUEST_NEW_RECEIPT',
    reason?: string
  ) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        agreement: {
          include: {
            student: true,
            route: true,
          },
        },
        payer: true,
        receiver: true,
      },
    });

    if (!payment) {
      const error: AppError = new Error('Payment record not found');
      error.statusCode = 404;
      throw error;
    }

    if ((decision === 'REJECT' || decision === 'REQUEST_NEW_RECEIPT') && (!reason || !reason.trim())) {
      const error: AppError = new Error('A reason must be provided when rejecting payment evidence or requesting a new receipt');
      error.statusCode = 400;
      throw error;
    }

    const nextStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const rejectionReason = decision === 'APPROVE' ? null : reason!.trim();
    const paidAt = decision === 'APPROVE' ? new Date() : null;

    const updated = await prisma.$transaction(async (tx: any) => {
      const p = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: nextStatus as any,
          paidAt,
          reviewedById: adminId,
          reviewedAt: new Date(),
          rejectionReason,
        },
      });

      // Notify parent of review decision
      await tx.notification.create({
        data: {
          userId: payment.payerId,
          title: decision === 'APPROVE' ? 'Payment Approved' : 'Payment Receipt Rejected',
          message: decision === 'APPROVE'
            ? `Your payment of ETB ${payment.amount} for ${payment.agreement.student.firstName} (${payment.agreement.route.name}) has been verified and approved.`
            : `Your payment receipt for ${payment.agreement.student.firstName} was rejected: ${rejectionReason}. Please upload valid payment evidence.`,
          type: decision === 'APPROVE' ? 'PAYMENT_APPROVED' : 'PAYMENT_REJECTED',
          entityId: payment.id,
        },
      });

      // Notify provider of review decision
      await tx.notification.create({
        data: {
          userId: payment.receiverId,
          title: decision === 'APPROVE' ? 'Transit Fee Payment Verified' : 'Payment Evidence Rejected',
          message: decision === 'APPROVE'
            ? `Payment of ETB ${payment.amount} for student ${payment.agreement.student.firstName} has been officially verified by administrators.`
            : `Submitted payment receipt for student ${payment.agreement.student.firstName} was rejected during administrator review.`,
          type: decision === 'APPROVE' ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED',
          entityId: payment.id,
        },
      });

      return p;
    });

    if (adminId) {
      await this.recordAuditLog(
        adminId,
        decision === 'APPROVE' ? 'APPROVE_PAYMENT' : 'REJECT_PAYMENT',
        'PAYMENT',
        paymentId,
        decision === 'APPROVE' ? (reason || 'Payment approved') : (rejectionReason || undefined),
        payment.payerId
      );
    }

    return updated;
  }

  /**
   * Records an immutable administrative audit log entry.
   */
  async recordAuditLog(
    adminId: string,
    action: string,
    entityType: string,
    entityId: string,
    details?: string,
    targetUserId?: string
  ) {
    try {
      return await prisma.auditLog.create({
        data: {
          adminId,
          action,
          entityType,
          entityId,
          details: details || null,
          targetUserId: targetUserId || null,
        },
      });
    } catch (err: any) {
      console.warn('[AdminService] Could not write audit log:', err.message);
    }
  }

  /**
   * Lists chronological administrative audit logs.
   */
  async listAuditLogs(limit = 50) {
    return prisma.auditLog.findMany({
      take: Math.min(100, Math.max(1, limit)),
      include: {
        admin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Reviews a provider or business verification document (approve/reject).
   */
  async reviewAccountDocument(
    documentId: string,
    decision: 'APPROVE' | 'REJECT',
    reason?: string,
    adminId?: string
  ) {
    const doc = await prisma.accountDocument.findUnique({ where: { id: documentId } });
    if (!doc) {
      const error: AppError = new Error('Document not found');
      error.statusCode = 404;
      throw error;
    }

    const updated = await prisma.accountDocument.update({
      where: { id: documentId },
      data: {
        status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        rejectionReason: decision === 'REJECT' ? reason || 'Document rejected by administrator' : null,
        reviewedById: adminId || null,
        reviewedAt: new Date(),
      },
    });

    if (adminId) {
      await this.recordAuditLog(
        adminId,
        decision === 'APPROVE' ? 'APPROVE_DOCUMENT' : 'REJECT_DOCUMENT',
        'DOCUMENT',
        documentId,
        reason,
        doc.userId
      );
    }

    return updated;
  }
}

export const adminService = new AdminService();
