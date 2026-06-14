import { IDocument } from '../models/document.model';
import { logger } from '../lib/logger';

// ─── Event payloads ───────────────────────────────────────────────────────────

export interface DocumentCreatedEvent {
  eventType: 'DocumentCreated';
  documentId: string;
  projectId: string;
  authorId: string;
  title: string;
  status: string;
  timestamp: string;
}

export interface DocumentUpdatedEvent {
  eventType: 'DocumentUpdated';
  documentId: string;
  projectId: string;
  lastEditorId: string;
  title: string;
  status: string;
  timestamp: string;
}

export interface DocumentPublishedEvent {
  eventType: 'DocumentPublished';
  documentId: string;
  projectId: string;
  authorId: string;
  title: string;
  slug: string;
  isPublic: boolean;
  publishedAt: string;
  timestamp: string;
}

export interface DocumentDeletedEvent {
  eventType: 'DocumentDeleted';
  documentId: string;
  projectId: string;
  deletedBy: string;
  timestamp: string;
}

export type DocumentEvent =
  | DocumentCreatedEvent
  | DocumentUpdatedEvent
  | DocumentPublishedEvent
  | DocumentDeletedEvent;

// ─── Publisher interface ──────────────────────────────────────────────────────

export interface IEventBusClient {
  publish(routingKey: string, payload: unknown): Promise<void>;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class DocumentPublisher {
  constructor(private readonly eventBus: IEventBusClient | null) {}

  private async emit(routingKey: string, event: DocumentEvent): Promise<void> {
    if (this.eventBus === null) {
      logger.debug('Event bus not configured; skipping event', { routingKey, eventType: event.eventType });

      return;
    }

    try {
      await this.eventBus.publish(routingKey, event);
      logger.debug('Event published', { routingKey, eventType: event.eventType });
    } catch (err) {
      // Publishing failures must not break the primary request flow
      logger.error('Failed to publish event', { routingKey, eventType: event.eventType, error: err });
    }
  }

  async publishDocumentCreated(doc: IDocument): Promise<void> {
    const event: DocumentCreatedEvent = {
      eventType: 'DocumentCreated',
      documentId: String(doc._id),
      projectId: doc.projectId,
      authorId: doc.authorId,
      title: doc.title,
      status: doc.status,
      timestamp: new Date().toISOString(),
    };

    await this.emit('document.created', event);
  }

  async publishDocumentUpdated(doc: IDocument): Promise<void> {
    const event: DocumentUpdatedEvent = {
      eventType: 'DocumentUpdated',
      documentId: String(doc._id),
      projectId: doc.projectId,
      lastEditorId: doc.lastEditorId,
      title: doc.title,
      status: doc.status,
      timestamp: new Date().toISOString(),
    };

    await this.emit('document.updated', event);
  }

  async publishDocumentPublished(doc: IDocument): Promise<void> {
    const event: DocumentPublishedEvent = {
      eventType: 'DocumentPublished',
      documentId: String(doc._id),
      projectId: doc.projectId,
      authorId: doc.authorId,
      title: doc.title,
      slug: doc.slug,
      isPublic: doc.isPublic,
      publishedAt: (doc.publishedAt ?? new Date()).toISOString(),
      timestamp: new Date().toISOString(),
    };

    await this.emit('document.published', event);
  }

  async publishDocumentDeleted(
    documentId: string,
    projectId: string,
    deletedBy: string,
  ): Promise<void> {
    const event: DocumentDeletedEvent = {
      eventType: 'DocumentDeleted',
      documentId,
      projectId,
      deletedBy,
      timestamp: new Date().toISOString(),
    };

    await this.emit('document.deleted', event);
  }
}
