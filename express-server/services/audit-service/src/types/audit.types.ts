import {
  AuditAction,
  AuditResource,
  AuditSeverity,
  AuditStatus,
  AuditLogChanges,
  AuditLogMetadata,
} from '../models/auditLog.model';

export { AuditAction, AuditResource, AuditSeverity, AuditStatus };

export interface CreateAuditLogDto {
  userId?: string | null;
  userEmail?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string | null;
  resourceName?: string;
  changes?: AuditLogChanges;
  metadata?: AuditLogMetadata;
  severity?: AuditSeverity;
  status?: AuditStatus;
}

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  userId?: string;
  action?: AuditAction;
  resource?: AuditResource;
  resourceId?: string;
  severity?: AuditSeverity;
  status?: AuditStatus;
  organizationId?: string;
  projectId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  sortBy?: 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditLogDto {
  id: string;
  userId: string | null;
  userEmail?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId: string | null;
  resourceName?: string;
  changes: AuditLogChanges;
  metadata: AuditLogMetadata;
  severity: AuditSeverity;
  status: AuditStatus;
  createdAt: Date;
}

export interface PaginatedAuditLogs {
  data: AuditLogDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ComplianceReport {
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    uniqueUsers: number;
    criticalEvents: number;
    highSeverityEvents: number;
  };
  actionBreakdown: Array<{ action: AuditAction; count: number; failureCount: number }>;
  resourceBreakdown: Array<{ resource: AuditResource; count: number }>;
  topUsers: Array<{ userId: string; userEmail?: string; count: number }>;
  securityIncidents: AuditLogDto[];
  generatedAt: Date;
}
