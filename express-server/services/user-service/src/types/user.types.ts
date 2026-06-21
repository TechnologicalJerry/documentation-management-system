// ─── Enums ───────────────────────────────────────────────────────────────────

export enum OrganizationPlan {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum TeamMemberRole {
  OWNER = 'owner',
  LEAD = 'lead',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

// ─── Create DTOs ─────────────────────────────────────────────────────────────

export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  timezone?: string;
  language?: string;
  organizationId?: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  bio?: string;
  timezone?: string;
  language?: string;
  isActive?: boolean;
  organizationId?: string | null;
}

export interface CreateOrganizationDto {
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  plan?: OrganizationPlan;
  maxMembers?: number;
}

export interface UpdateOrganizationDto {
  name?: string;
  description?: string;
  logo?: string;
  website?: string;
  plan?: OrganizationPlan;
  maxMembers?: number;
  isActive?: boolean;
}

export interface CreateTeamDto {
  name: string;
  description?: string;
  organizationId: string;
}

export interface UpdateTeamDto {
  name?: string;
  description?: string;
}

export interface AddTeamMemberDto {
  userId: string;
  role?: TeamMemberRole;
}

export interface UpdateTeamMemberDto {
  role: TeamMemberRole;
}

export interface UpdateUserPreferencesDto {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  theme?: Theme;
  editorFontSize?: number;
  editorTheme?: string;
}

// ─── Query DTOs ──────────────────────────────────────────────────────────────

export interface PaginationDto {
  page?: number;
  limit?: number;
}

export interface UserQueryDto extends PaginationDto {
  search?: string;
  organizationId?: string;
  isActive?: boolean;
  teamId?: string;
  language?: string;
  timezone?: string;
  sortBy?: 'createdAt' | 'firstName' | 'lastName' | 'email' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface OrganizationQueryDto extends PaginationDto {
  search?: string;
  plan?: OrganizationPlan;
  isActive?: boolean;
  sortBy?: 'createdAt' | 'name' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface TeamQueryDto extends PaginationDto {
  organizationId?: string;
  search?: string;
  sortBy?: 'createdAt' | 'name' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface UserPreferenceResponseDto {
  id: string;
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  theme: string;
  editorFontSize: number;
  editorTheme: string;
  updatedAt: Date;
}

export interface UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  timezone: string;
  language: string;
  isActive: boolean;
  organizationId: string | null;
  organization?: OrganizationSummaryDto | null;
  preferences?: UserPreferenceResponseDto | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationSummaryDto {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  plan: string;
}

export interface OrganizationResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  website: string | null;
  plan: string;
  maxMembers: number;
  isActive: boolean;
  memberCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMemberResponseDto {
  id: string;
  userId: string;
  teamId: string;
  role: string;
  joinedAt: Date;
  user?: UserSummaryDto;
}

export interface UserSummaryDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatar: string | null;
}

export interface TeamResponseDto {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  memberCount?: number;
  members?: TeamMemberResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Paginated Response ───────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

// ─── Service Errors ───────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      404,
      'NOT_FOUND',
    );
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}
