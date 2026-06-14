import { CommentModel, IComment } from '../models/comment.model';
import { CreateCommentDto, UpdateCommentDto } from '../types/document.types';
import { logger } from '../lib/logger';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface ICommentRepository {
  findByDocument(documentId: string, includeDeleted?: boolean): Promise<IComment[]>;
  findById(id: string): Promise<IComment | null>;
  create(documentId: string, authorId: string, dto: CreateCommentDto): Promise<IComment>;
  update(id: string, dto: UpdateCommentDto): Promise<IComment | null>;
  softDelete(id: string): Promise<IComment | null>;
  resolve(id: string, resolvedBy: string): Promise<IComment | null>;
  unresolve(id: string): Promise<IComment | null>;
  deleteByDocumentId(documentId: string): Promise<number>;
  countByDocument(documentId: string): Promise<number>;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class CommentRepository implements ICommentRepository {
  async findByDocument(documentId: string, includeDeleted = false): Promise<IComment[]> {
    try {
      const filter: Record<string, unknown> = { documentId };
      if (!includeDeleted) {
        filter.deletedAt = null;
      }

      return await CommentModel.find(filter)
        .sort({ parentId: 1, createdAt: 1 })
        .lean()
        .exec();
    } catch (error) {
      logger.error('CommentRepository.findByDocument error', { documentId, error });
      throw error;
    }
  }

  async findById(id: string): Promise<IComment | null> {
    try {
      return await CommentModel.findOne({ _id: id, deletedAt: null }).lean().exec();
    } catch (error) {
      logger.error('CommentRepository.findById error', { id, error });
      throw error;
    }
  }

  async create(documentId: string, authorId: string, dto: CreateCommentDto): Promise<IComment> {
    try {
      const comment = new CommentModel({
        documentId,
        authorId,
        content: dto.content,
        parentId: dto.parentId ?? null,
        isResolved: false,
      });

      const saved = await comment.save();

      return saved;
    } catch (error) {
      logger.error('CommentRepository.create error', { documentId, authorId, error });
      throw error;
    }
  }

  async update(id: string, dto: UpdateCommentDto): Promise<IComment | null> {
    try {
      return await CommentModel.findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: { content: dto.content } },
        { new: true, runValidators: true },
      )
        .lean()
        .exec();
    } catch (error) {
      logger.error('CommentRepository.update error', { id, error });
      throw error;
    }
  }

  async softDelete(id: string): Promise<IComment | null> {
    try {
      return await CommentModel.findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: { deletedAt: new Date() } },
        { new: true },
      )
        .lean()
        .exec();
    } catch (error) {
      logger.error('CommentRepository.softDelete error', { id, error });
      throw error;
    }
  }

  async resolve(id: string, resolvedBy: string): Promise<IComment | null> {
    try {
      return await CommentModel.findOneAndUpdate(
        { _id: id, deletedAt: null, isResolved: false },
        {
          $set: {
            isResolved: true,
            resolvedBy,
            resolvedAt: new Date(),
          },
        },
        { new: true },
      )
        .lean()
        .exec();
    } catch (error) {
      logger.error('CommentRepository.resolve error', { id, resolvedBy, error });
      throw error;
    }
  }

  async unresolve(id: string): Promise<IComment | null> {
    try {
      return await CommentModel.findOneAndUpdate(
        { _id: id, deletedAt: null, isResolved: true },
        {
          $set: {
            isResolved: false,
            resolvedBy: null,
            resolvedAt: null,
          },
        },
        { new: true },
      )
        .lean()
        .exec();
    } catch (error) {
      logger.error('CommentRepository.unresolve error', { id, error });
      throw error;
    }
  }

  async deleteByDocumentId(documentId: string): Promise<number> {
    try {
      const result = await CommentModel.deleteMany({ documentId }).exec();

      return result.deletedCount;
    } catch (error) {
      logger.error('CommentRepository.deleteByDocumentId error', { documentId, error });
      throw error;
    }
  }

  async countByDocument(documentId: string): Promise<number> {
    try {
      return await CommentModel.countDocuments({ documentId, deletedAt: null }).exec();
    } catch (error) {
      logger.error('CommentRepository.countByDocument error', { documentId, error });
      throw error;
    }
  }
}
