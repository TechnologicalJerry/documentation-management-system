import { NotFoundError } from '@devdocs/shared-utils';
import {
  AuditLogDto,
  AuditLogQuery,
  ComplianceReport,
  CreateAuditLogDto,
  PaginatedAuditLogs,
} from '../types/audit.types';
import { AuditLogRepository, auditLogRepository } from '../repositories/auditLog.repository';

export class AuditService {
  constructor(private readonly repository: AuditLogRepository = auditLogRepository) {}

  create(dto: CreateAuditLogDto): Promise<AuditLogDto> {
    return this.repository.create(dto);
  }

  async findById(id: string): Promise<AuditLogDto> {
    const log = await this.repository.findById(id);
    if (!log) {
      throw new NotFoundError('Audit log', id);
    }

    return log;
  }

  findAll(query: AuditLogQuery): Promise<PaginatedAuditLogs> {
    return this.repository.findAll(query);
  }

  findResourceHistory(resource: string, resourceId: string): Promise<AuditLogDto[]> {
    return this.repository.findByResourceHistory(resource, resourceId);
  }

  async generateComplianceReport(startDate: Date, endDate: Date): Promise<ComplianceReport> {
    const [summary, actionBreakdown, resourceBreakdown, topUsers, securityIncidents] =
      await Promise.all([
        this.repository.getComplianceSummary(startDate, endDate),
        this.repository.countByAction(startDate, endDate),
        this.repository.countByResource(startDate, endDate),
        this.repository.getTopUsers(startDate, endDate, 10),
        this.repository.getSecurityIncidents(startDate, endDate),
      ]);

    return {
      period: { startDate, endDate },
      summary,
      actionBreakdown: actionBreakdown.map((item) => ({
        action: item.action as ComplianceReport['actionBreakdown'][number]['action'],
        count: item.count,
        failureCount: item.failureCount,
      })),
      resourceBreakdown: resourceBreakdown.map((item) => ({
        resource: item.resource as ComplianceReport['resourceBreakdown'][number]['resource'],
        count: item.count,
      })),
      topUsers,
      securityIncidents,
      generatedAt: new Date(),
    };
  }
}
