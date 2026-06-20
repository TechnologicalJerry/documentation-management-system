export enum TemplateCategory {
  API_DOCS = 'API_DOCS',
  USER_GUIDE = 'USER_GUIDE',
  README = 'README',
  CHANGELOG = 'CHANGELOG',
  TUTORIAL = 'TUTORIAL',
  CUSTOM = 'CUSTOM',
}

export enum TemplateType {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  ORGANIZATION = 'ORGANIZATION',
}

export interface TemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
  required: boolean;
}

export interface CreateTemplateDto {
  name: string;
  description: string;
  content: string;
  category: TemplateCategory;
  type?: TemplateType;
  organizationId?: string;
  isPublic?: boolean;
  tags?: string[];
  variables?: TemplateVariable[];
  previewImage?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateTemplateDto {
  name?: string;
  description?: string;
  content?: string;
  category?: TemplateCategory;
  isPublic?: boolean;
  isActive?: boolean;
  tags?: string[];
  variables?: TemplateVariable[];
  previewImage?: string;
  metadata?: Record<string, unknown>;
  changelog?: string;
}

export interface TemplateQueryDto {
  page?: number;
  limit?: number;
  category?: TemplateCategory;
  type?: TemplateType;
  search?: string;
  isPublic?: boolean;
  authorId?: string;
  organizationId?: string;
  tags?: string[];
  sortBy?: 'createdAt' | 'updatedAt' | 'usageCount' | 'rating' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface ApplyTemplateDto {
  variables: Record<string, string>;
  documentTitle?: string;
}

export interface RateTemplateDto {
  rating: number;
  review?: string;
}

export interface PaginatedTemplates {
  data: ITemplateDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface AppliedTemplate {
  templateId: string;
  templateName: string;
  renderedContent: string;
  renderedContentHtml: string;
  appliedVariables: Record<string, string>;
}

import type { Document } from 'mongoose';

export interface ITemplateDocument extends Document {
  name: string;
  slug: string;
  description: string;
  content: string;
  contentHtml: string;
  category: TemplateCategory;
  type: TemplateType;
  authorId: string;
  organizationId?: string;
  isPublic: boolean;
  isActive: boolean;
  tags: string[];
  variables: TemplateVariable[];
  previewImage?: string;
  usageCount: number;
  rating: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface ITemplateVersionDocument extends Document {
  templateId: string;
  version: string;
  content: string;
  contentHtml: string;
  changelog?: string;
  createdBy: string;
  createdAt: Date;
}

export interface ITemplateRatingDocument extends Document {
  templateId: string;
  userId: string;
  rating: number;
  review?: string;
  createdAt: Date;
}
