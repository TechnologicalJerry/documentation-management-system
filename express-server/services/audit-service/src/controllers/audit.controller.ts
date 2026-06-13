import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '@devdocs/shared-utils';
import { AuditService } from '../services/audit.service';

export class AuditController {
  constructor(private readonly service = new AuditService()) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const log = await this.service.create(req.body);
      sendSuccess(res, log, 'Audit log created', StatusCodes.CREATED);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const logs = await this.service.findAll(req.query);
      sendSuccess(res, logs, 'Audit logs retrieved');
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const log = await this.service.findById(req.params.id);
      sendSuccess(res, log, 'Audit log retrieved');
    } catch (error) {
      next(error);
    }
  };

  resourceHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const logs = await this.service.findResourceHistory(req.params.resource, req.params.resourceId);
      sendSuccess(res, logs, 'Resource audit history retrieved');
    } catch (error) {
      next(error);
    }
  };

  complianceReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = await this.service.generateComplianceReport(
        new Date(req.query.startDate as string),
        new Date(req.query.endDate as string),
      );
      sendSuccess(res, report, 'Compliance report generated');
    } catch (error) {
      next(error);
    }
  };
}
