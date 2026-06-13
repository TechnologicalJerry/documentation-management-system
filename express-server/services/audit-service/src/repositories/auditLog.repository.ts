import { FilterQuery } from 'mongoose';
import { AuditLogModel, IAuditLog } from '../models/auditLog.model';
import { logger } from '../lib/logger';
import {
  CreateAuditLogDto,
  AuditLogQuery,
  AuditLogDto,
  PaginatedAuditLogs,
  AuditSeverity,
  AuditStatus,
} from '../types/audit.types';
import { config } from '../config';

function docToDto(doc: IAuditLog): AuditLogDto {
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    userEmail: doc.userEmail,
    action: doc.action,
    resource: doc.resource,
    resourceId: doc.resourceId,
    resourceName: doc.resourceName,
    changes: doc.changes,
    metadata: doc.metadata,
    severity: doc.severity,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

export class AuditLogRepository {
  async create(dto: CreateAuditLogDto): Promise<AuditLogDto> {
    const doc = await AuditLogModel.create({
      userId: dto.userId ?? null,
      userEmail: dto.userEmail,
      action: dto.action,
      resource: dto.resource,
      resourceId: dto.resourceId ?? null,
      resourceName: dto.resourceName,
      changes: dto.changes ?? {},
      metadata: dto.metadata ?? {},
      severity: dto.severity ?? AuditSeverity.LOW,
      status: dto.status ?? AuditStatus.SUCCESS,
    });

    logger.debug('Audit log created', {
      id: doc._id.toString(),
      action: dto.action,
      resource: dto.resource,
      userId: dto.userId,
    });

    return docToDto(doc);
  }

  async findById(id: string): Promise<AuditLogDto | null> {
    const doc = await AuditLogModel.findById(id).lean();
    if (!doc) {return null;}

    return docToDto(doc as unknown as IAuditLog);
  }

  async findAll(query: AuditLogQuery): Promise<PaginatedAuditLogs> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(
      config.pagination.maxPageSize,
      Math.max(1, query.pageSize ?? config.pagination.defaultPageSize),
    );
    const skip = (page - 1) * pageSize;

    const filter: FilterQuery<IAuditLog> = {};

    if (query.userId) {filter.userId = query.userId;}
    if (query.action != null) {filter.action = query.action;}
    if (query.resource != null) {filter.resource = query.resource;}
    if (query.resourceId) {filter.resourceId = query.resourceId;}
    if (query.severity != null) {filter.severity = query.severity;}
    if (query.status != null) {filter.status = query.status;}
    if (query.organizationId) {filter['metadata.organizationId'] = query.organizationId;}
    if (query.projectId) {filter['metadata.projectId'] = query.projectId;}

    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) {filter.createdAt.$gte = query.startDate;}
      if (query.endDate) {filter.createdAt.$lte = query.endDate;}
    }

    if (query.search) {
      const searchRegex = { $regex: query.search, $options: 'i' };
      filter.$or = [
        { userEmail: searchRegex },
        { resourceName: searchRegex },
        { action: searchRegex },
      ];
    }

    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { createdAt: sortOrder };

    const [total, docs] = await Promise.all([
      AuditLogModel.countDocuments(filter),
      AuditLogModel.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(pageSize)
        .lean(),
    ]);

    return {
      data: (docs as unknown as IAuditLog[]).map(docToDto),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findByResourceHistory(resource: string, resourceId: string): Promise<AuditLogDto[]> {
    const docs = await AuditLogModel.find({
      resource,
      resourceId,
    })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return (docs as unknown as IAuditLog[]).map(docToDto);
  }

  async findByUserId(userId: string, query: AuditLogQuery): Promise<PaginatedAuditLogs> {
    return this.findAll({ ...query, userId });
  }

  async countByAction(
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ action: string; count: number; failureCount: number }>> {
    const result = await AuditLogModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { action: '$action', status: '$status' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.action',
          total: { $sum: '$count' },
          failures: {
            $sum: {
              $cond: [{ $eq: ['$_id.status', AuditStatus.FAILURE] }, '$count', 0],
            },
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    return result.map((r: Record<string, unknown>) => ({
      action: r['_id'] as string,
      count: r['total'] as number,
      failureCount: r['failures'] as number,
    }));
  }

  async countByResource(
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ resource: string; count: number }>> {
    const result = await AuditLogModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$resource',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return result.map((r: Record<string, unknown>) => ({
      resource: r['_id'] as string,
      count: r['count'] as number,
    }));
  }

  async getTopUsers(
    startDate: Date,
    endDate: Date,
    limit = 10,
  ): Promise<Array<{ userId: string; userEmail?: string; count: number }>> {
    const result = await AuditLogModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          userId: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$userId',
          userEmail: { $first: '$userEmail' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    return result.map((r: Record<string, unknown>) => ({
      userId: r['_id'] as string,
      userEmail: r['userEmail'] as string | undefined,
      count: r['count'] as number,
    }));
  }

  async getComplianceSummary(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    uniqueUsers: number;
    criticalEvents: number;
    highSeverityEvents: number;
  }> {
    const result = await AuditLogModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          successfulEvents: {
            $sum: { $cond: [{ $eq: ['$status', AuditStatus.SUCCESS] }, 1, 0] },
          },
          failedEvents: {
            $sum: { $cond: [{ $eq: ['$status', AuditStatus.FAILURE] }, 1, 0] },
          },
          uniqueUsers: { $addToSet: '$userId' },
          criticalEvents: {
            $sum: { $cond: [{ $eq: ['$severity', AuditSeverity.CRITICAL] }, 1, 0] },
          },
          highSeverityEvents: {
            $sum: { $cond: [{ $eq: ['$severity', AuditSeverity.HIGH] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalEvents: 1,
          successfulEvents: 1,
          failedEvents: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          criticalEvents: 1,
          highSeverityEvents: 1,
        },
      },
    ]);

    return (
      (result[0] as {
        totalEvents: number;
        successfulEvents: number;
        failedEvents: number;
        uniqueUsers: number;
        criticalEvents: number;
        highSeverityEvents: number;
      }) ?? {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        uniqueUsers: 0,
        criticalEvents: 0,
        highSeverityEvents: 0,
      }
    );
  }

  async getSecurityIncidents(startDate: Date, endDate: Date): Promise<AuditLogDto[]> {
    const docs = await AuditLogModel.find({
      createdAt: { $gte: startDate, $lte: endDate },
      $or: [
        { severity: { $in: [AuditSeverity.CRITICAL, AuditSeverity.HIGH] } },
        { status: AuditStatus.FAILURE },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return (docs as unknown as IAuditLog[]).map(docToDto);
  }

  async deleteOld(olderThan: Date): Promise<number> {
    const result = await AuditLogModel.deleteMany({
      createdAt: { $lt: olderThan },
    });

    return result.deletedCount;
  }
}

export const auditLogRepository = new AuditLogRepository();
