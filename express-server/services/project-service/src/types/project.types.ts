import { MemberRole, ProjectStatus, ProjectVisibility } from '@prisma/client';

// ─── Request DTOs ────────────────────────────────────────────────────────────

export interface CreateProjectDto {
  name: string;
  description?: string;
  visibility?: ProjectVisibility;
  organizationId?: string;
  coverImage?: string;
  tags?: CreateTagDto[];
  settings?: Partial<ProjectSettingsDto>;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  visibility?: ProjectVisibility;
  coverImage?: string;
  tags?: CreateTagDto[];
  settings?: Partial<ProjectSettingsDto>;
}

export interface ProjectQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  organizationId?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  tags?: string[];
}

export interface AddMemberDto {
  userId: string;
  role: MemberRole;
}

export interface UpdateMemberDto {
  role: MemberRole;
}

export interface InviteMemberDto {
  email: string;
  role: MemberRole;
}

export interface AcceptInvitationDto {
  token: string;
  userId: string;
}

export interface CreateTagDto {
  name: string;
  color?: string;
}

export interface ProjectSettingsDto {
  defaultDocumentStatus: string;
  allowPublicComments: boolean;
  enableVersioning: boolean;
  autoSaveInterval: number;
}

// ─── Response DTOs ───────────────────────────────────────────────────────────

export interface TagResponseDto {
  id: string;
  name: string;
  color: string;
}

export interface ProjectSettingsResponseDto {
  id: string;
  defaultDocumentStatus: string;
  allowPublicComments: boolean;
  enableVersioning: boolean;
  autoSaveInterval: number;
  updatedAt: Date;
}

export interface ProjectMemberResponseDto {
  id: string;
  userId: string;
  role: MemberRole;
  joinedAt: Date;
  updatedAt: Date;
}

export interface ProjectResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  organizationId: string | null;
  ownerId: string;
  coverImage: string | null;
  tags: TagResponseDto[];
  members: ProjectMemberResponseDto[];
  settings: ProjectSettingsResponseDto | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectListResponseDto {
  projects: ProjectResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProjectStatsDto {
  projectId: string;
  totalMembers: number;
  membersByRole: Record<MemberRole, number>;
  totalTags: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvitationResponseDto {
  id: string;
  projectId: string;
  email: string;
  role: MemberRole;
  token: string;
  invitedBy: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

// ─── Internal / Auth types ───────────────────────────────────────────────────

export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles?: string[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  roles?: string[];
  iat?: number;
  exp?: number;
  iss?: string;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

// ─── Events ──────────────────────────────────────────────────────────────────

export type ProjectEventType =
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'project.archived'
  | 'project.member.added'
  | 'project.member.removed'
  | 'project.member.role_changed'
  | 'project.invitation.sent'
  | 'project.invitation.accepted';

export interface ProjectEvent<T = unknown> {
  eventType: ProjectEventType;
  projectId: string;
  actorId: string;
  timestamp: string;
  payload: T;
}

export interface ProjectCreatedPayload {
  project: ProjectResponseDto;
}

export interface ProjectUpdatedPayload {
  projectId: string;
  changes: Partial<UpdateProjectDto>;
}

export interface ProjectDeletedPayload {
  projectId: string;
  ownerId: string;
}

export interface MemberAddedPayload {
  projectId: string;
  userId: string;
  role: MemberRole;
}

export interface MemberRemovedPayload {
  projectId: string;
  userId: string;
}

export interface MemberRoleChangedPayload {
  projectId: string;
  userId: string;
  oldRole: MemberRole;
  newRole: MemberRole;
}
