import { z } from 'zod';
import { AuditAction, AuditResource, AuditSeverity, AuditStatus } from '../types/audit.types';

export const createAuditLogSchema = z.object({
  body: z.object({
    userId: z.string().optional().nullable(),
    userEmail: z.string().email().optional(),
    action: z.nativeEnum(AuditAction),
    resource: z.nativeEnum(AuditResource),
    resourceId: z.string().optional().nullable(),
    resourceName: z.string().optional(),
    changes: z
      .object({
        before: z.record(z.unknown()).nullable().optional(),
        after: z.record(z.unknown()).nullable().optional(),
      })
      .optional(),
    metadata: z.record(z.unknown()).optional(),
    severity: z.nativeEnum(AuditSeverity).optional(),
    status: z.nativeEnum(AuditStatus).optional(),
  }),
});

export const auditQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
    userId: z.string().optional(),
    action: z.nativeEnum(AuditAction).optional(),
    resource: z.nativeEnum(AuditResource).optional(),
    resourceId: z.string().optional(),
    severity: z.nativeEnum(AuditSeverity).optional(),
    status: z.nativeEnum(AuditStatus).optional(),
    organizationId: z.string().optional(),
    projectId: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    search: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const resourceHistorySchema = z.object({
  params: z.object({
    resource: z.nativeEnum(AuditResource),
    resourceId: z.string().min(1),
  }),
});

export const complianceReportSchema = z.object({
  query: z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  }),
});
