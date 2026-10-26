import { Request, Response, NextFunction } from 'express';
import { adminService } from '../services/admin.service';
import { AuthenticatedRequest } from '../types/auth.types';

export class AdminController {
  async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, role, status, search } = req.query as any;
      const result = await adminService.listUsers({
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        role,
        status,
        search,
      });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUserStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { status } = req.body;
      if (!['ACTIVE', 'PENDING', 'SUSPENDED', 'REJECTED'].includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid user status. Must be ACTIVE, PENDING, SUSPENDED, or REJECTED',
        });
        return;
      }

      const updated = await adminService.updateUserStatus(userId, status, req.user?.role, req.user?.id);
      res.status(200).json({
        success: true,
        message: `User status changed to ${status}`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async listApplications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { role, status, search } = req.query as any;
      const applications = await adminService.listApplications({ role, status, search });
      res.status(200).json({
        success: true,
        data: applications,
      });
    } catch (error) {
      next(error);
    }
  }

  async reviewApplication(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { decision, reason } = req.body;
      const updated = await adminService.reviewApplication(
        userId,
        decision,
        reason,
        req.user?.role,
        req.user?.id
      );
      res.status(200).json({
        success: true,
        message: `Application decision '${decision}' applied successfully`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPlatformStats(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminService.getPlatformStats();
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async listSafetyIncidents(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, severity } = req.query as any;
      const incidents = await adminService.listSafetyIncidents({ status, severity });
      res.status(200).json({
        success: true,
        data: incidents,
      });
    } catch (error) {
      next(error);
    }
  }

  async resolveSafetyIncident(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { incidentId } = req.params;
      const { resolution } = req.body;
      if (!resolution) {
        res.status(400).json({
          success: false,
          message: 'Resolution details are required',
        });
        return;
      }

      const resolved = await adminService.resolveSafetyIncident(incidentId, resolution);
      res.status(200).json({
        success: true,
        message: 'Safety incident marked as resolved',
        data: resolved,
      });
    } catch (error) {
      next(error);
    }
  }

  async listPayments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, search, page, limit } = req.query as any;
      const result = await adminService.listPayments({
        status,
        search,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async reviewPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentId } = req.params;
      const { decision, reason } = req.body;
      if (!['APPROVE', 'REJECT', 'REQUEST_NEW_RECEIPT'].includes(decision)) {
        res.status(400).json({
          success: false,
          message: 'Invalid decision. Must be APPROVE, REJECT, or REQUEST_NEW_RECEIPT',
        });
        return;
      }

      const updated = await adminService.reviewPayment(paymentId, req.user!.id, decision, reason);
      res.status(200).json({
        success: true,
        message: `Payment evidence decision '${decision}' recorded successfully`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async listAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const logs = await adminService.listAuditLogs(limit);
      res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  }

  async reviewAccountDocument(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { decision, reason } = req.body;
      if (!['APPROVE', 'REJECT'].includes(decision)) {
        res.status(400).json({
          success: false,
          message: 'Decision must be APPROVE or REJECT',
        });
        return;
      }

      const updated = await adminService.reviewAccountDocument(id, decision, reason, req.user?.id);
      res.status(200).json({
        success: true,
        message: `Document decision '${decision}' recorded`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async listVehicles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status, isVerified, search } = req.query as any;
      const parsedIsVerified =
        isVerified === 'true' ? true : isVerified === 'false' ? false : undefined;

      const result = await adminService.listVehicles({
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        status,
        isVerified: parsedIsVerified,
        search,
      });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async reviewVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vehicleId } = req.params;
      const { decision, reason } = req.body;
      if (!['APPROVE', 'REJECT'].includes(decision)) {
        res.status(400).json({
          success: false,
          message: 'Decision must be APPROVE or REJECT',
        });
        return;
      }

      const updated = await adminService.reviewVehicle(vehicleId, decision, reason, req.user?.id);
      res.status(200).json({
        success: true,
        message: `Vehicle decision '${decision}' applied successfully`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async listRoutes(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status, search } = req.query as any;
      const result = await adminService.listRoutes({
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        status,
        search,
      });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async listTrips(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status, search } = req.query as any;
      const result = await adminService.listTrips({
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        status,
        search,
      });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async listCampaigns(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status, search } = req.query as any;
      const result = await adminService.listCampaigns({
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        status,
        search,
      });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async reviewCampaign(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { campaignId } = req.params;
      const { decision, reason } = req.body;
      if (!['APPROVE', 'REJECT'].includes(decision)) {
        res.status(400).json({
          success: false,
          message: 'Decision must be APPROVE or REJECT',
        });
        return;
      }

      const updated = await adminService.reviewCampaign(campaignId, decision, reason, req.user?.id);
      res.status(200).json({
        success: true,
        message: `Campaign decision '${decision}' applied successfully`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async purgeMockData(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { purgeMockExampleData, ensureRealAdministrator } = await import('../services/seed.service');
      const { prisma } = await import('../config/prisma');
      await purgeMockExampleData(prisma);
      await ensureRealAdministrator(prisma);
      res.status(200).json({
        success: true,
        message: 'Mock example data purged successfully. Only real records remain.',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { prisma } = await import('../config/prisma');

      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      if (targetUser.email === 'rachelberhane716@gmail.com' || targetUser.role === 'ADMIN') {
        res.status(403).json({ success: false, message: 'Administrator accounts cannot be deleted' });
        return;
      }

      await prisma.notification.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.auditLog.deleteMany({ where: { OR: [{ adminId: userId }, { targetUserId: userId }] } });
      await prisma.accountDocument.deleteMany({ where: { userId } });
      await prisma.student.deleteMany({ where: { parentId: userId } });
      await prisma.vehicle.deleteMany({ where: { providerId: userId } });
      await prisma.route.deleteMany({ where: { providerId: userId } });
      await prisma.user.delete({ where: { id: userId } });

      res.status(200).json({
        success: true,
        message: `User ${targetUser.email} has been permanently deleted.`,
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyUserEmail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const updated = await adminService.verifyUserEmail(userId);
      res.status(200).json({
        success: true,
        message: 'User email marked as verified',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();

