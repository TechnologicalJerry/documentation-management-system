export interface BaseEvent {
  eventId: string;
  eventType: string;
  correlationId: string;
  causationId?: string;
  timestamp: string;
  version: number;
  source: string;
}

// User Events
export interface UserCreatedEvent extends BaseEvent {
  eventType: 'user.created';
  payload: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    organizationId?: string;
  };
}

export interface UserUpdatedEvent extends BaseEvent {
  eventType: 'user.updated';
  payload: {
    userId: string;
    changes: Record<string, unknown>;
    updatedBy: string;
  };
}

export interface UserDeletedEvent extends BaseEvent {
  eventType: 'user.deleted';
  payload: {
    userId: string;
    email: string;
    deletedBy: string;
    reason?: string;
  };
}

// Project Events
export interface ProjectCreatedEvent extends BaseEvent {
  eventType: 'project.created';
  payload: {
    projectId: string;
    name: string;
    slug: string;
    organizationId: string;
    ownerId: string;
    visibility: string;
  };
}

export interface ProjectUpdatedEvent extends BaseEvent {
  eventType: 'project.updated';
  payload: {
    projectId: string;
    changes: Record<string, unknown>;
    updatedBy: string;
  };
}

// Document Events
export interface DocumentCreatedEvent extends BaseEvent {
  eventType: 'document.created';
  payload: {
    documentId: string;
    title: string;
    projectId: string;
    authorId: string;
    contentType: string;
  };
}

export interface DocumentUpdatedEvent extends BaseEvent {
  eventType: 'document.updated';
  payload: {
    documentId: string;
    projectId: string;
    changes: Record<string, unknown>;
    updatedBy: string;
    versionNumber?: number;
  };
}

export interface DocumentPublishedEvent extends BaseEvent {
  eventType: 'document.published';
  payload: {
    documentId: string;
    title: string;
    projectId: string;
    authorId: string;
    publishedBy: string;
    publishedAt: string;
    notifySubscribers: boolean;
  };
}

// Export Events
export interface ExportRequestedEvent extends BaseEvent {
  eventType: 'export.requested';
  payload: {
    exportId: string;
    documentId: string;
    projectId?: string;
    requestedBy: string;
    format: string;
    options: Record<string, unknown>;
  };
}

export interface ExportCompletedEvent extends BaseEvent {
  eventType: 'export.completed';
  payload: {
    exportId: string;
    documentId: string;
    requestedBy: string;
    format: string;
    fileUrl: string;
    fileSizeBytes: number;
    expiresAt: string;
    success: boolean;
    errorMessage?: string;
  };
}

// Notification Events
export interface NotificationEvent extends BaseEvent {
  eventType: 'notification.send';
  payload: {
    notificationId: string;
    recipientIds: string[];
    channel: 'email' | 'in_app' | 'push' | 'slack';
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    priority: 'low' | 'normal' | 'high' | 'urgent';
  };
}

// Audit Events
export interface AuditEvent extends BaseEvent {
  eventType: 'audit.log';
  payload: {
    actorId: string;
    actorEmail: string;
    action: string;
    resource: string;
    resourceId: string;
    organizationId?: string;
    projectId?: string;
    ipAddress?: string;
    userAgent?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    status: 'success' | 'failure';
    errorMessage?: string;
  };
}

// AI Events
export interface AIGenerationRequestedEvent extends BaseEvent {
  eventType: 'ai.generation.requested';
  payload: {
    requestId: string;
    userId: string;
    documentId?: string;
    projectId?: string;
    prompt: string;
    model: string;
    type: 'generate' | 'improve' | 'summarize' | 'translate' | 'custom';
    options: Record<string, unknown>;
  };
}

export interface AIGenerationCompletedEvent extends BaseEvent {
  eventType: 'ai.generation.completed';
  payload: {
    requestId: string;
    userId: string;
    documentId?: string;
    success: boolean;
    result?: string;
    tokensUsed?: number;
    durationMs: number;
    errorMessage?: string;
  };
}

export type DomainEvent =
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent
  | ProjectCreatedEvent
  | ProjectUpdatedEvent
  | DocumentCreatedEvent
  | DocumentUpdatedEvent
  | DocumentPublishedEvent
  | ExportRequestedEvent
  | ExportCompletedEvent
  | NotificationEvent
  | AuditEvent
  | AIGenerationRequestedEvent
  | AIGenerationCompletedEvent;

export type EventType = DomainEvent['eventType'];
