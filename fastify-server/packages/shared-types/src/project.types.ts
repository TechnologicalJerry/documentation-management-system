export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  DRAFT = 'DRAFT',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

export enum ProjectVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  INTERNAL = 'INTERNAL',
  RESTRICTED = 'RESTRICTED',
}

export enum TeamRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export interface TeamMember {
  userId: string;
  role: TeamRole;
  joinedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  members: TeamMember[];
  projectIds: string[];
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  ownerId: string;
  memberIds: string[];
  teamIds: string[];
  projectIds: string[];
  plan: OrganizationPlan;
  settings: OrganizationSettings;
  createdAt: Date;
  updatedAt: Date;
}

export enum OrganizationPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export interface OrganizationSettings {
  maxMembers: number;
  maxProjects: number;
  maxStorageGB: number;
  allowPublicProjects: boolean;
  enforceSSO: boolean;
  allowedDomains: string[];
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  organizationId: string;
  teamId?: string;
  ownerId: string;
  collaboratorIds: string[];
  documentIds: string[];
  tags: string[];
  settings: ProjectSettings;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectSettings {
  defaultDocumentType: string;
  allowExternalContributors: boolean;
  requireApprovalForPublish: boolean;
  enableVersioning: boolean;
  enableComments: boolean;
  customDomain?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  visibility?: ProjectVisibility;
  organizationId: string;
  teamId?: string;
  tags?: string[];
  settings?: Partial<ProjectSettings>;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  tags?: string[];
  settings?: Partial<ProjectSettings>;
}
