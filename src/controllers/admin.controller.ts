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
}

export const adminController = new AdminController();
