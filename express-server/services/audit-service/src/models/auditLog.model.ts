import mongoose, { Schema, Model } from 'mongoose';

export enum AuditAction {
  // Document actions
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  RESTORE = 'RESTORE',
  PUBLISH = 'PUBLISH',
  ARCHIVE = 'ARCHIVE',
  // Auth actions
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  // Data actions
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
  DOWNLOAD = 'DOWNLOAD',
  SHARE = 'SHARE',
  // Admin actions
  PERMISSION_GRANT = 'PERMISSION_GRANT',
  PERMISSION_REVOKE = 'PERMISSION_REVOKE',
  MEMBER_ADD = 'MEMBER_ADD',
  MEMBER_REMOVE = 'MEMBER_REMOVE',
  MEMBER_ROLE_CHANGE = 'MEMBER_ROLE_CHANGE',
  // AI actions
  AI_GENERATION = 'AI_GENERATION',
  // System actions
  SETTINGS_CHANGE = 'SETTINGS_CHANGE',
  API_KEY_CREATE = 'API_KEY_CREATE',
  API_KEY_REVOKE = 'API_KEY_REVOKE',
}

export enum AuditResource {
  DOCUMENT = 'document',
  PROJECT = 'project',
  USER = 'user',
  ORGANIZATION = 'organization',
  TEAM = 'team',
  EXPORT = 'export',
  IMPORT = 'import',
  COMMENT = 'comment',
  API_KEY = 'api_key',
  SETTINGS = 'settings',
  AUTH = 'auth',
}

export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

export interface AuditLogChanges {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface AuditLogMetadata {
  ip?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
  organizationId?: string;
  projectId?: string;
  errorMessage?: string;
  additionalData?: Record<string, unknown>;
}

export interface IAuditLog {
  _id: string;
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

const AuditLogChangesSchema = new Schema<AuditLogChanges>(
  {
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const AuditLogMetadataSchema = new Schema<AuditLogMetadata>(
  {
    ip: { type: String },
    userAgent: { type: String },
    requestId: { type: String },
    sessionId: { type: String },
    organizationId: { type: String },
    projectId: { type: String },
    errorMessage: { type: String },
    additionalData: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: String, default: null },
    userEmail: { type: String },
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true,
    },
    resource: {
      type: String,
      enum: Object.values(AuditResource),
      required: true,
    },
    resourceId: { type: String, default: null },
    resourceName: { type: String },
    changes: { type: AuditLogChangesSchema, default: () => ({}) },
    metadata: { type: AuditLogMetadataSchema, default: () => ({}) },
    severity: {
      type: String,
      enum: Object.values(AuditSeverity),
      default: AuditSeverity.LOW,
    },
    status: {
      type: String,
      enum: Object.values(AuditStatus),
      default: AuditStatus.SUCCESS,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

// Indexes
AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ resource: 1, resourceId: 1 });
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ severity: 1 });
AuditLogSchema.index({ status: 1 });
AuditLogSchema.index({ 'metadata.organizationId': 1 });
AuditLogSchema.index({ 'metadata.projectId': 1 });

// Compound indexes for common query patterns
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, status: 1, createdAt: -1 });

// TTL index for automatic cleanup (if enabled)
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 0, sparse: true });

export const AuditLogModel: Model<IAuditLog> = mongoose.model<IAuditLog>(
  'AuditLog',
  AuditLogSchema,
);
