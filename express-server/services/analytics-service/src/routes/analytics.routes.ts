import { Router } from 'express';
import { authenticate } from '@devdocs/shared-middleware';
import { AnalyticsController } from '../controllers/analytics.controller';
import { validate } from '../middleware/validate.middleware';
import {
  pageViewSchema,
  projectSummarySchema,
  searchEventSchema,
  userEventSchema,
} from '../validators/analytics.validators';

const controller = new AnalyticsController();
export const analyticsRouter = Router();

analyticsRouter.post('/page-views', authenticate, validate(pageViewSchema), controller.recordPageView);
analyticsRouter.post('/searches', authenticate, validate(searchEventSchema), controller.recordSearch);
analyticsRouter.post('/events', authenticate, validate(userEventSchema), controller.recordUserEvent);
analyticsRouter.get('/projects/:projectId/summary', authenticate, validate(projectSummarySchema), controller.projectSummary);
