import { Router } from 'express';
import { authenticate, requireAnyPermission } from '@devdocs/shared-middleware';
import { AuditController } from '../controllers/audit.controller';
import { validate } from '../validators/validate.middleware';
import {
  auditQuerySchema,
  complianceReportSchema,
  createAuditLogSchema,
  idParamSchema,
  resourceHistorySchema,
} from '../validators/audit.validators';

const controller = new AuditController();
export const auditRouter = Router();

auditRouter.use(authenticate);
auditRouter.get('/', requireAnyPermission('audit:read', '*:*'), validate(auditQuerySchema), controller.list);
auditRouter.post('/', requireAnyPermission('audit:write', '*:*'), validate(createAuditLogSchema), controller.create);
auditRouter.get('/compliance-report', requireAnyPermission('audit:read', '*:*'), validate(complianceReportSchema), controller.complianceReport);
auditRouter.get('/resources/:resource/:resourceId', requireAnyPermission('audit:read', '*:*'), validate(resourceHistorySchema), controller.resourceHistory);
auditRouter.get('/:id', requireAnyPermission('audit:read', '*:*'), validate(idParamSchema), controller.getById);
