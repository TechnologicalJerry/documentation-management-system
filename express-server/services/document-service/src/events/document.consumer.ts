import { DocumentRepository } from '../repositories/document.repository';
import { DocumentVersionRepository } from '../repositories/documentVersion.repository';
import { CommentRepository } from '../repositories/comment.repository';
import { logger } from '../lib/logger';

// ─── Incoming event shapes ────────────────────────────────────────────────────

interface ProjectDeletedEvent {
  eventType: 'ProjectDeleted';
  projectId: string;
  deletedBy: string;
  timestamp: string;
}


// ─── Event bus consumer interface ────────────────────────────────────────────

export interface IEventBusConsumer {
  subscribe(
    routingKey: string,
    handler: (payload: unknown) => Promise<void>,
  ): Promise<void>;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class DocumentConsumer {
  private readonly documentRepo: DocumentRepository;
  private readonly versionRepo: DocumentVersionRepository;
  private readonly commentRepo: CommentRepository;

  constructor(
    documentRepo: DocumentRepository,
    versionRepo: DocumentVersionRepository,
    commentRepo: CommentRepository,
  ) {
    this.documentRepo = documentRepo;
    this.versionRepo = versionRepo;
    this.commentRepo = commentRepo;
  }

  async register(consumer: IEventBusConsumer): Promise<void> {
    await consumer.subscribe('project.deleted', this.handleProjectDeleted.bind(this));
    logger.info('DocumentConsumer registered: listening for project.deleted');
  }

  private async handleProjectDeleted(payload: unknown): Promise<void> {
    if (!this.isProjectDeletedEvent(payload)) {
      logger.warn('DocumentConsumer: received malformed project.deleted event', { payload });

      return;
    }

    const { projectId, deletedBy } = payload;

    logger.info('Handling ProjectDeleted: cascading document deletion', {
      projectId,
      deletedBy,
    });

    try {
      // 1. Find all documents (including already soft-deleted) for the project
      const result = await this.documentRepo.findByProject(projectId, {
        includeDeleted: true,
        limit: 1000,
        page: 1,
      });

      const documentIds = result.data.map((d) => String(d._id));

      // 2. Delete versions and comments for each document
      await Promise.all(
        documentIds.map(async (docId) => {
          await Promise.all([
            this.versionRepo.deleteByDocumentId(docId),
            this.commentRepo.deleteByDocumentId(docId),
          ]);
        }),
      );

      // 3. Soft-delete all project documents
      const deletedCount = await this.documentRepo.deleteByProjectId(projectId);

      logger.info('Cascade deletion complete for project', {
        projectId,
        documentsDeleted: deletedCount,
        versionDocumentCount: documentIds.length,
      });
    } catch (err) {
      logger.error('Error during cascade delete for ProjectDeleted event', {
        projectId,
        error: err,
      });
      // Re-throw so the message broker can attempt a retry / dead-letter
      throw err;
    }
  }

  private isProjectDeletedEvent(payload: unknown): payload is ProjectDeletedEvent {
    if (typeof payload !== 'object' || payload === null) {
      return false;
    }
    const obj = payload as Record<string, unknown>;

    return (
      obj.eventType === 'ProjectDeleted' &&
      typeof obj.projectId === 'string' &&
      typeof obj.deletedBy === 'string'
    );
  }
}
