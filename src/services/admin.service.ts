import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { sanitizeUser } from '../utils/security.util';

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
      data: { status: status as any },
    });

    return sanitizeUser(updated);
  }

  /**
   * Platform Overview: Comprehensive system metrics and health indicators.
   */
  async getPlatformStats() {
    const [
      totalUsers,
      usersByRole,
      activeRoutes,
      totalVehicles,
      activeAgreements,
      activeTrips,
      totalPayments,
      safetyIncidents,
      activeAds,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
      prisma.route.count({ where: { status: 'ACTIVE' } }),
      prisma.vehicle.count(),
      prisma.transportationAgreement.count({ where: { status: 'ACTIVE' } }),
      prisma.trip.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.payment.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.safetyIncident.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.advertisingCampaign.count({ where: { status: 'ACTIVE' } }),
    ]);

    const roleCounts: Record<string, number> = {};
    usersByRole.forEach((r: any) => {
      roleCounts[r.role] = r._count.id;
    });

    const incidentCounts: Record<string, number> = {};
    safetyIncidents.forEach((s: any) => {
      incidentCounts[s.status] = s._count.id;
    });

    return {
      users: {
        total: totalUsers,
        byRole: roleCounts,
      },
      transportation: {
        activeRoutes,
        totalVehicles,
        activeAgreements,
        activeTrips,
      },
      financials: {
        totalPaidVolumeETB: totalPayments._sum.amount || 0,
        paidTransactionsCount: totalPayments._count.id,
      },
      safety: {
        incidents: incidentCounts,
      },
      advertising: {
        activeCampaigns: activeAds,
      },
    };
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
}

export const adminService = new AdminService();
