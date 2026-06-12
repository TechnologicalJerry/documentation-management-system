import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '@devdocs/shared-utils';
import { AnalyticsService } from '../services/analytics.service';

export class AnalyticsController {
  constructor(private readonly service = new AnalyticsService()) {}

  recordPageView = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.recordPageView({
        ...req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      sendSuccess(res, null, 'Page view recorded', StatusCodes.CREATED);
    } catch (error) {
      next(error);
    }
  };

  recordSearch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.recordSearch(req.body);
      sendSuccess(res, null, 'Search event recorded', StatusCodes.CREATED);
    } catch (error) {
      next(error);
    }
  };

  recordUserEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.recordUserEvent(req.body);
      sendSuccess(res, null, 'User event recorded', StatusCodes.CREATED);
    } catch (error) {
      next(error);
    }
  };

  projectSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await this.service.getProjectSummary(req.params.projectId);
      sendSuccess(res, summary, 'Project analytics summary');
    } catch (error) {
      next(error);
    }
  };
}
