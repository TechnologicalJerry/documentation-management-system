import { FilterQuery, UpdateQuery } from 'mongoose';
import { DocumentModel, IDocument, DocumentStatus } from '../models/document.model';
import {
  DocumentQueryDto,
  PaginatedResponseDto,
  DocumentTreeNodeDto,
} from '../types/document.types';
import { config } from '../config';
import { logger } from '../lib/logger';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface IDocumentRepository {
  findById(id: string, includeDeleted?: boolean): Promise<IDocument | null>;
  findBySlug(projectId: string, slug: string): Promise<IDocument | null>;
  findByProject(
    projectId: string,
    query: DocumentQueryDto,
  ): Promise<PaginatedResponseDto<IDocument>>;
  create(data: Partial<IDocument>): Promise<IDocument>;
  update(id: string, data: Partial<IDocument>): Promise<IDocument | null>;
  softDelete(id: string): Promise<IDocument | null>;
  hardDelete(id: string): Promise<void>;
  search(
    projectId: string,
    searchQuery: string,
    options?: { status?: DocumentStatus; limit?: number; page?: number },
  ): Promise<PaginatedResponseDto<IDocument>>;
  lock(id: string, userId: string): Promise<IDocument | null>;
  unlock(id: string, userId: string): Promise<IDocument | null>;
  getTree(projectId: string): Promise<DocumentTreeNodeDto[]>;
  slugExists(projectId: string, slug: string, excludeId?: string): Promise<boolean>;
  deleteByProjectId(projectId: string): Promise<number>;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class DocumentRepository implements IDocumentRepository {
  private buildBaseFilter(includeDeleted = false): FilterQuery<IDocument> {
    if (includeDeleted) {
      return {};
    }

    return { deletedAt: null };
  }

  async findById(id: string, includeDeleted = false): Promise<IDocument | null> {
    try {
      const filter: FilterQuery<IDocument> = {
        _id: id,
        ...this.buildBaseFilter(includeDeleted),
      };

      return await DocumentModel.findOne(filter).lean({ virtuals: false }).exec();
    } catch (error) {
      logger.error('DocumentRepository.findById error', { id, error });
      throw error;
    }
  }

  async findBySlug(projectId: string, slug: string): Promise<IDocument | null> {
    try {
      return await DocumentModel.findOne({ projectId, slug, deletedAt: null })
        .lean()
        .exec();
    } catch (error) {
      logger.error('DocumentRepository.findBySlug error', { projectId, slug, error });
      throw error;
    }
  }

  async findByProject(
    projectId: string,
    query: DocumentQueryDto,
  ): Promise<PaginatedResponseDto<IDocument>> {
    try {
      const {
        status,
        type,
        tags,
        authorId,
        isPublic,
        parentId,
        page = 1,
        limit = config.pagination.defaultPageSize,
        sortBy = 'order',
        sortOrder = 'asc',
        includeDeleted = false,
      } = query;

      const filter: FilterQuery<IDocument> = {
        projectId,
        ...this.buildBaseFilter(includeDeleted),
      };

      if (status !== undefined) {
        filter.status = status;
      }
      if (type !== undefined) {
        filter.type = type;
      }
      if (authorId !== undefined) {
        filter.authorId = authorId;
      }
      if (isPublic !== undefined) {
        filter.isPublic = isPublic;
      }
      if (parentId !== undefined) {
        filter.parentId = parentId === 'root' ? null : parentId;
      }
      if (tags !== undefined) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        filter.tags = { $in: tagArray };
      }

      const safePage = Math.max(1, page);
      const safeLimit = Math.min(limit, config.pagination.maxPageSize);
      const skip = (safePage - 1) * safeLimit;

      const sortDirection = sortOrder === 'asc' ? 1 : -1;
      const sortObj: Record<string, 1 | -1> = { [sortBy]: sortDirection };

      const [data, total] = await Promise.all([
        DocumentModel.find(filter)
          .sort(sortObj)
          .skip(skip)
          .limit(safeLimit)
          .lean()
          .exec(),
        DocumentModel.countDocuments(filter).exec(),
      ]);

      const totalPages = Math.ceil(total / safeLimit);

      return {
        data: data as IDocument[],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPrevPage: safePage > 1,
        },
      };
    } catch (error) {
      logger.error('DocumentRepository.findByProject error', { projectId, error });
      throw error;
    }
  }

  async create(data: Partial<IDocument>): Promise<IDocument> {
    try {
      const doc = new DocumentModel(data);
      const saved = await doc.save();

      return saved;
    } catch (error) {
      logger.error('DocumentRepository.create error', { error });
      throw error;
    }
  }

  async update(id: string, data: Partial<IDocument>): Promise<IDocument | null> {
    try {
      const updatePayload: UpdateQuery<IDocument> = { $set: data };

      return await DocumentModel.findOneAndUpdate(
        { _id: id, deletedAt: null },
        updatePayload,
        { new: true, runValidators: true },
      )
        .lean()
        .exec();
    } catch (error) {
      logger.error('DocumentRepository.update error', { id, error });
      throw error;
    }
  }

  async softDelete(id: string): Promise<IDocument | null> {
    try {
      return await DocumentModel.findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: { deletedAt: new Date() } },
        { new: true },
      )
        .lean()
        .exec();
    } catch (error) {
      logger.error('DocumentRepository.softDelete error', { id, error });
      throw error;
    }
  }

  async hardDelete(id: string): Promise<void> {
    try {
      await DocumentModel.deleteOne({ _id: id }).exec();
    } catch (error) {
      logger.error('DocumentRepository.hardDelete error', { id, error });
      throw error;
    }
  }

  async search(
    projectId: string,
    searchQuery: string,
    options: { status?: DocumentStatus; limit?: number; page?: number } = {},
  ): Promise<PaginatedResponseDto<IDocument>> {
    try {
      const { status, limit = config.pagination.defaultPageSize, page = 1 } = options;

      const filter: FilterQuery<IDocument> = {
        projectId,
        deletedAt: null,
        $text: { $search: searchQuery },
      };

      if (status !== undefined) {
        filter.status = status;
      }

      const safePage = Math.max(1, page);
      const safeLimit = Math.min(limit, config.pagination.maxPageSize);
      const skip = (safePage - 1) * safeLimit;

      const [data, total] = await Promise.all([
        DocumentModel.find(filter, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .skip(skip)
          .limit(safeLimit)
          .lean()
          .exec(),
        DocumentModel.countDocuments(filter).exec(),
      ]);

      const totalPages = Math.ceil(total / safeLimit);

      return {
        data: data as IDocument[],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPrevPage: safePage > 1,
        },
      };
    } catch (error) {
      logger.error('DocumentRepository.search error', { projectId, searchQuery, error });
      throw error;
    }
  }

  async lock(id: string, userId: string): Promise<IDocument | null> {
    try {
      const lockExpiry = new Date();
      lockExpiry.setMinutes(lockExpiry.getMinutes() + config.document.lockTtlMinutes);

      return await DocumentModel.findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
          $or: [
            { lockedBy: null },
            { lockedBy: userId },
            // Allow acquiring an expired lock
            { lockedAt: { $lt: new Date(Date.now() - config.document.lockTtlMinutes * 60 * 1000) } },
          ],
        },
        { $set: { lockedBy: userId, lockedAt: new Date() } },
        { new: true },
      )
        .lean()
        .exec();
    } catch (error) {
      logger.error('DocumentRepository.lock error', { id, userId, error });
      throw error;
    }
  }

  async unlock(id: string, userId: string): Promise<IDocument | null> {
    try {
      return await DocumentModel.findOneAndUpdate(
        { _id: id, deletedAt: null, lockedBy: userId },
        { $set: { lockedBy: null, lockedAt: null } },
        { new: true },
      )
        .lean()
        .exec();
    } catch (error) {
      logger.error('DocumentRepository.unlock error', { id, userId, error });
      throw error;
    }
  }

  async getTree(projectId: string): Promise<DocumentTreeNodeDto[]> {
    try {
      const allDocs = await DocumentModel.find(
        { projectId, deletedAt: null },
        { _id: 1, title: 1, slug: 1, status: 1, type: 1, order: 1, parentId: 1 },
      )
        .sort({ order: 1, title: 1 })
        .lean()
        .exec();

      const nodeMap = new Map<string, DocumentTreeNodeDto>();

      for (const doc of allDocs) {
        nodeMap.set(String(doc._id), {
          id: String(doc._id),
          title: doc.title,
          slug: doc.slug,
          status: doc.status,
          type: doc.type,
          order: doc.order,
          parentId: doc.parentId ?? undefined,
          children: [],
        });
      }

      const roots: DocumentTreeNodeDto[] = [];

      for (const node of nodeMap.values()) {
        if (node.parentId === undefined || node.parentId === null) {
          roots.push(node);
        } else {
          const parent = nodeMap.get(node.parentId);
          if (parent !== undefined) {
            parent.children.push(node);
          } else {
            // Orphaned node: treat as root
            roots.push(node);
          }
        }
      }

      return roots;
    } catch (error) {
      logger.error('DocumentRepository.getTree error', { projectId, error });
      throw error;
    }
  }

  async slugExists(projectId: string, slug: string, excludeId?: string): Promise<boolean> {
    try {
      const filter: FilterQuery<IDocument> = { projectId, slug, deletedAt: null };
      if (excludeId !== undefined) {
        filter._id = { $ne: excludeId };
      }

      const count = await DocumentModel.countDocuments(filter).exec();

      return count > 0;
    } catch (error) {
      logger.error('DocumentRepository.slugExists error', { projectId, slug, error });
      throw error;
    }
  }

  async deleteByProjectId(projectId: string): Promise<number> {
    try {
      const now = new Date();
      const result = await DocumentModel.updateMany(
        { projectId, deletedAt: null },
        { $set: { deletedAt: now } },
      ).exec();

      return result.modifiedCount;
    } catch (error) {
      logger.error('DocumentRepository.deleteByProjectId error', { projectId, error });
      throw error;
    }
  }
}
