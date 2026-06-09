export interface ExchangeConfig {
  name: string;
  type: 'direct' | 'topic' | 'fanout' | 'headers';
  durable: boolean;
  autoDelete: boolean;
}

export interface QueueConfig {
  name: string;
  durable: boolean;
  autoDelete: boolean;
  exclusive: boolean;
  arguments?: Record<string, unknown>;
}

export interface BindingConfig {
  exchange: string;
  queue: string;
  routingKey: string;
}

// Exchange definitions
export const EXCHANGES = {
  USERS: {
    name: 'devdocs.users',
    type: 'topic',
    durable: true,
    autoDelete: false,
  },
  PROJECTS: {
    name: 'devdocs.projects',
    type: 'topic',
    durable: true,
    autoDelete: false,
  },
  DOCUMENTS: {
    name: 'devdocs.documents',
    type: 'topic',
    durable: true,
    autoDelete: false,
  },
  EXPORTS: {
    name: 'devdocs.exports',
    type: 'topic',
    durable: true,
    autoDelete: false,
  },
  NOTIFICATIONS: {
    name: 'devdocs.notifications',
    type: 'topic',
    durable: true,
    autoDelete: false,
  },
  AI: {
    name: 'devdocs.ai',
    type: 'topic',
    durable: true,
    autoDelete: false,
  },
  AUDIT: {
    name: 'devdocs.audit',
    type: 'fanout',
    durable: true,
    autoDelete: false,
  },
  DEAD_LETTER: {
    name: 'devdocs.dlx',
    type: 'direct',
    durable: true,
    autoDelete: false,
  },
} as const satisfies Record<string, ExchangeConfig>;

// Routing key patterns
export const ROUTING_KEYS = {
  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_PASSWORD_CHANGED: 'user.password.changed',
  USER_EMAIL_VERIFIED: 'user.email.verified',

  // Project events
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',
  PROJECT_ARCHIVED: 'project.archived',

  // Document events
  DOCUMENT_CREATED: 'document.created',
  DOCUMENT_UPDATED: 'document.updated',
  DOCUMENT_DELETED: 'document.deleted',
  DOCUMENT_PUBLISHED: 'document.published',
  DOCUMENT_ARCHIVED: 'document.archived',

  // Export events
  EXPORT_REQUESTED: 'export.requested',
  EXPORT_COMPLETED: 'export.completed',
  EXPORT_FAILED: 'export.failed',

  // AI events
  AI_GENERATION_REQUESTED: 'ai.generation.requested',
  AI_GENERATION_COMPLETED: 'ai.generation.completed',
  AI_GENERATION_FAILED: 'ai.generation.failed',

  // Notification events
  NOTIFICATION_EMAIL: 'notification.email',
  NOTIFICATION_IN_APP: 'notification.in_app',
  NOTIFICATION_PUSH: 'notification.push',

  // Audit events (fanout — no routing key needed)
  AUDIT_LOG: 'audit.log',
} as const;

// Queue definitions
export const QUEUES = {
  // Auth service queues
  AUTH_USER_EVENTS: {
    name: 'auth-service.user-events',
    durable: true,
    autoDelete: false,
    exclusive: false,
    arguments: { 'x-dead-letter-exchange': EXCHANGES.DEAD_LETTER.name },
  },

  // User service queues
  USER_SERVICE_EVENTS: {
    name: 'user-service.events',
    durable: true,
    autoDelete: false,
    exclusive: false,
    arguments: { 'x-dead-letter-exchange': EXCHANGES.DEAD_LETTER.name },
  },

  // Project service queues
  PROJECT_SERVICE_EVENTS: {
    name: 'project-service.events',
    durable: true,
    autoDelete: false,
    exclusive: false,
    arguments: { 'x-dead-letter-exchange': EXCHANGES.DEAD_LETTER.name },
  },

  // Document service queues
  DOCUMENT_SERVICE_EVENTS: {
    name: 'document-service.events',
    durable: true,
    autoDelete: false,
    exclusive: false,
    arguments: { 'x-dead-letter-exchange': EXCHANGES.DEAD_LETTER.name },
  },

  // Export service queues
  EXPORT_SERVICE_REQUESTS: {
    name: 'export-service.requests',
    durable: true,
    autoDelete: false,
    exclusive: false,
    arguments: { 'x-dead-letter-exchange': EXCHANGES.DEAD_LETTER.name },
  },

  // AI service queues
  AI_SERVICE_REQUESTS: {
    name: 'ai-service.requests',
    durable: true,
    autoDelete: false,
    exclusive: false,
    arguments: { 'x-dead-letter-exchange': EXCHANGES.DEAD_LETTER.name },
  },

  // Notification service queues
  NOTIFICATION_SERVICE_QUEUE: {
    name: 'notification-service.queue',
    durable: true,
    autoDelete: false,
    exclusive: false,
    arguments: { 'x-dead-letter-exchange': EXCHANGES.DEAD_LETTER.name },
  },

  // Audit service queue
  AUDIT_SERVICE_QUEUE: {
    name: 'audit-service.queue',
    durable: true,
    autoDelete: false,
    exclusive: false,
  },

  // Dead letter queue
  DEAD_LETTER_QUEUE: {
    name: 'devdocs.dead-letters',
    durable: true,
    autoDelete: false,
    exclusive: false,
  },
} as const satisfies Record<string, QueueConfig>;

export interface RabbitMQConfig {
  url: string;
  vhost: string;
  heartbeat: number;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  prefetchCount: number;
  publishTimeout: number;
}

export function getRabbitMQConfig(): RabbitMQConfig {
  return {
    url: process.env['RABBITMQ_URL'] || 'amqp://devdocs:devdocs@localhost:5672',
    vhost: process.env['RABBITMQ_VHOST'] || '/',
    heartbeat: parseInt(process.env['RABBITMQ_HEARTBEAT'] || '60', 10),
    reconnectDelay: parseInt(process.env['RABBITMQ_RECONNECT_DELAY_MS'] || '5000', 10),
    maxReconnectAttempts: parseInt(process.env['RABBITMQ_MAX_RECONNECT'] || '10', 10),
    prefetchCount: parseInt(process.env['RABBITMQ_PREFETCH_COUNT'] || '10', 10),
    publishTimeout: parseInt(process.env['RABBITMQ_PUBLISH_TIMEOUT_MS'] || '5000', 10),
  };
}
