import { StatusCodes } from 'http-status-codes';
import { IDocumentRepository } from '../repositories/document.repository';
import { ICommentRepository } from '../repositories/comment.repository';
import { IComment } from '../models/comment.model';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CommentResponseDto,
  DocumentServiceError,
} from '../types/document.types';
import { logger } from '../lib/logger';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface ICommentService {
  addComment(documentId: string, userId: string, dto: CreateCommentDto): Promise<CommentResponseDto>;
  getComments(documentId: string): Promise<CommentResponseDto[]>;
  updateComment(commentId: string, userId: string, dto: UpdateCommentDto): Promise<CommentResponseDto>;
  deleteComment(commentId: string, userId: string): Promise<void>;
  resolveComment(commentId: string, userId: string): Promise<CommentResponseDto>;
  unresolveComment(commentId: string, userId: string): Promise<CommentResponseDto>;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function toDto(comment: IComment): CommentResponseDto {
  return {
    id: String(comment._id),
    documentId: comment.documentId,
    authorId: comment.authorId,
    content: comment.content,
    parentId: comment.parentId,
    isResolved: comment.isResolved,
    resolvedBy: comment.resolvedBy,
    resolvedAt: comment.resolvedAt?.toISOString(),
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class CommentService implements ICommentService {
  constructor(
    private readonly documentRepo: IDocumentRepository,
    private readonly commentRepo: ICommentRepository,
  ) {}

  private async assertDocumentExists(documentId: string): Promise<void> {
    const doc = await this.documentRepo.findById(documentId);
    if (doc === null) {
      throw new DocumentServiceError(
        'DOCUMENT_NOT_FOUND',
        `Document ${documentId} not found`,
        StatusCodes.NOT_FOUND,
      );
    }
  }

  async addComment(
    documentId: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    await this.assertDocumentExists(documentId);

    // If replying, verify parent comment exists and belongs to same document
    if (dto.parentId !== undefined) {
      const parent = await this.commentRepo.findById(dto.parentId);
      if (parent === null || parent.documentId !== documentId) {
        throw new DocumentServiceError(
          'COMMENT_NOT_FOUND',
          `Parent comment ${dto.parentId} not found on this document`,
          StatusCodes.NOT_FOUND,
        );
      }
    }

    const comment = await this.commentRepo.create(documentId, userId, dto);

    logger.info('Comment added', { commentId: comment._id, documentId, userId });

    return toDto(comment);
  }

  async getComments(documentId: string): Promise<CommentResponseDto[]> {
    await this.assertDocumentExists(documentId);
    const comments = await this.commentRepo.findByDocument(documentId);

    return comments.map(toDto);
  }

  async updateComment(
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    const existing = await this.commentRepo.findById(commentId);
    if (existing === null) {
      throw new DocumentServiceError(
        'COMMENT_NOT_FOUND',
        `Comment ${commentId} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    if (existing.authorId !== userId) {
      throw new DocumentServiceError(
        'COMMENT_NOT_AUTHOR',
        'You can only edit your own comments',
        StatusCodes.FORBIDDEN,
      );
    }

    const updated = await this.commentRepo.update(commentId, dto);
    if (updated === null) {
      throw new DocumentServiceError(
        'COMMENT_NOT_FOUND',
        `Comment ${commentId} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    logger.info('Comment updated', { commentId, userId });

    return toDto(updated);
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const existing = await this.commentRepo.findById(commentId);
    if (existing === null) {
      throw new DocumentServiceError(
        'COMMENT_NOT_FOUND',
        `Comment ${commentId} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    if (existing.authorId !== userId) {
      throw new DocumentServiceError(
        'COMMENT_NOT_AUTHOR',
        'You can only delete your own comments',
        StatusCodes.FORBIDDEN,
      );
    }

    await this.commentRepo.softDelete(commentId);

    logger.info('Comment deleted', { commentId, userId });
  }

  async resolveComment(commentId: string, userId: string): Promise<CommentResponseDto> {
    const existing = await this.commentRepo.findById(commentId);
    if (existing === null) {
      throw new DocumentServiceError(
        'COMMENT_NOT_FOUND',
        `Comment ${commentId} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    const resolved = await this.commentRepo.resolve(commentId, userId);
    if (resolved === null) {
      throw new DocumentServiceError(
        'COMMENT_NOT_FOUND',
        `Comment ${commentId} not found or already resolved`,
        StatusCodes.NOT_FOUND,
      );
    }

    logger.info('Comment resolved', { commentId, resolvedBy: userId });

    return toDto(resolved);
  }

  async unresolveComment(commentId: string, userId: string): Promise<CommentResponseDto> {
    const existing = await this.commentRepo.findById(commentId);
    if (existing === null) {
      throw new DocumentServiceError(
        'COMMENT_NOT_FOUND',
        `Comment ${commentId} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    const unresolved = await this.commentRepo.unresolve(commentId);
    if (unresolved === null) {
      throw new DocumentServiceError(
        'COMMENT_NOT_FOUND',
        `Comment ${commentId} not found or not resolved`,
        StatusCodes.NOT_FOUND,
      );
    }

    logger.info('Comment unresolved', { commentId, unresolvedBy: userId });

    return toDto(unresolved);
  }
}
