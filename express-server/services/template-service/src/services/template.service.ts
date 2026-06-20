import { marked } from 'marked';
import { StatusCodes } from 'http-status-codes';
import type { ITemplateRepository } from '../repositories/template.repository';
import type {
  ITemplateDocument,
  ITemplateVersionDocument,
  ITemplateRatingDocument,
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateQueryDto,
  ApplyTemplateDto,
  PaginatedTemplates,
  AppliedTemplate,
} from '../types/template.types';
import { TemplateType } from '../types/template.types';
import { logger } from '../lib/logger';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly isOperational: boolean = true,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export interface ITemplateService {
  createTemplate(userId: string, dto: CreateTemplateDto): Promise<ITemplateDocument>;
  getTemplate(id: string): Promise<ITemplateDocument>;
  getTemplateBySlug(slug: string): Promise<ITemplateDocument>;
  getTemplates(query: TemplateQueryDto): Promise<PaginatedTemplates>;
  updateTemplate(id: string, userId: string, dto: UpdateTemplateDto): Promise<ITemplateDocument>;
  deleteTemplate(id: string, userId: string): Promise<void>;
  publishTemplate(id: string, userId: string): Promise<ITemplateDocument>;
  unpublishTemplate(id: string, userId: string): Promise<ITemplateDocument>;
  applyTemplate(templateId: string, dto: ApplyTemplateDto): Promise<AppliedTemplate>;
  rateTemplate(
    templateId: string,
    userId: string,
    rating: number,
    review?: string,
  ): Promise<{ template: ITemplateDocument; ratingRecord: ITemplateRatingDocument }>;
  getSystemTemplates(): Promise<ITemplateDocument[]>;
  getTemplateVersions(templateId: string): Promise<ITemplateVersionDocument[]>;
  searchTemplates(query: string, options?: Partial<TemplateQueryDto>): Promise<PaginatedTemplates>;
  getCategories(): string[];
  getTemplateRatings(templateId: string): Promise<ITemplateRatingDocument[]>;
}

export class TemplateService implements ITemplateService {
  constructor(private readonly templateRepository: ITemplateRepository) {}

  async createTemplate(userId: string, dto: CreateTemplateDto): Promise<ITemplateDocument> {
    logger.info('Creating template', { userId, name: dto.name, category: dto.category });

    const contentHtml = await this.renderMarkdown(dto.content);
    const template = await this.templateRepository.create(userId, { ...dto, contentHtml } as CreateTemplateDto & { contentHtml: string });

    // Create initial version
    await this.templateRepository.createVersion(
      String(template._id),
      dto.content,
      contentHtml,
      userId,
      'Initial version',
    );

    logger.info('Template created successfully', { templateId: template._id, userId });

    return template;
  }

  async getTemplate(id: string): Promise<ITemplateDocument> {
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new AppError(StatusCodes.NOT_FOUND, `Template with ID '${id}' not found`);
    }

    return template;
  }

  async getTemplateBySlug(slug: string): Promise<ITemplateDocument> {
    const template = await this.templateRepository.findBySlug(slug);
    if (!template) {
      throw new AppError(StatusCodes.NOT_FOUND, `Template with slug '${slug}' not found`);
    }

    return template;
  }

  async getTemplates(query: TemplateQueryDto): Promise<PaginatedTemplates> {
    logger.debug('Fetching templates', { query });

    return this.templateRepository.findAll(query);
  }

  async updateTemplate(
    id: string,
    userId: string,
    dto: UpdateTemplateDto,
  ): Promise<ITemplateDocument> {
    const existing = await this.getTemplate(id);

    this.assertOwnership(existing, userId);

    const updateData: Partial<UpdateTemplateDto> & { contentHtml?: string } = { ...dto };

    if (dto.content) {
      updateData.contentHtml = await this.renderMarkdown(dto.content);
    }

    const updated = await this.templateRepository.update(id, updateData as UpdateTemplateDto);
    if (!updated) {
      throw new AppError(StatusCodes.NOT_FOUND, `Template with ID '${id}' not found`);
    }

    // Snapshot a new version when content changes
    if (dto.content) {
      await this.templateRepository.createVersion(
        id,
        dto.content,
        updateData.contentHtml ?? existing.contentHtml,
        userId,
        dto.changelog,
      );
    }

    logger.info('Template updated', { templateId: id, userId });

    return updated;
  }

  async deleteTemplate(id: string, userId: string): Promise<void> {
    const existing = await this.getTemplate(id);
    this.assertOwnership(existing, userId);

    const deleted = await this.templateRepository.softDelete(id);
    if (!deleted) {
      throw new AppError(StatusCodes.NOT_FOUND, `Template with ID '${id}' not found`);
    }

    logger.info('Template soft-deleted', { templateId: id, userId });
  }

  async publishTemplate(id: string, userId: string): Promise<ITemplateDocument> {
    const existing = await this.getTemplate(id);
    this.assertOwnership(existing, userId);

    if (existing.isPublic) {
      throw new AppError(StatusCodes.CONFLICT, 'Template is already public');
    }

    const updated = await this.templateRepository.update(id, { isPublic: true });
    if (!updated) {
      throw new AppError(StatusCodes.NOT_FOUND, `Template with ID '${id}' not found`);
    }

    logger.info('Template published', { templateId: id, userId });

    return updated;
  }

  async unpublishTemplate(id: string, userId: string): Promise<ITemplateDocument> {
    const existing = await this.getTemplate(id);
    this.assertOwnership(existing, userId);

    if (!existing.isPublic) {
      throw new AppError(StatusCodes.CONFLICT, 'Template is already private');
    }

    const updated = await this.templateRepository.update(id, { isPublic: false });
    if (!updated) {
      throw new AppError(StatusCodes.NOT_FOUND, `Template with ID '${id}' not found`);
    }

    logger.info('Template unpublished', { templateId: id, userId });

    return updated;
  }

  async applyTemplate(templateId: string, dto: ApplyTemplateDto): Promise<AppliedTemplate> {
    const template = await this.getTemplate(templateId);

    // Validate required variables
    const missingVars: string[] = [];
    for (const variable of template.variables) {
      if (variable.required && !(variable.name in dto.variables)) {
        const hasDefault = variable.defaultValue !== undefined && variable.defaultValue !== '';
        if (!hasDefault) {
          missingVars.push(variable.name);
        }
      }
    }

    if (missingVars.length > 0) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Missing required template variables: ${missingVars.join(', ')}`,
      );
    }

    // Build full variable map with defaults
    const resolvedVars: Record<string, string> = {};
    for (const variable of template.variables) {
      resolvedVars[variable.name] =
        dto.variables[variable.name] ?? variable.defaultValue ?? '';
    }
    // Also allow caller-supplied vars that aren't declared in the schema
    for (const [key, val] of Object.entries(dto.variables)) {
      resolvedVars[key] = val;
    }

    const renderedContent = this.interpolateVariables(template.content, resolvedVars);
    const renderedContentHtml = await this.renderMarkdown(renderedContent);

    // Increment usage counter
    await this.templateRepository.incrementUsage(templateId);

    logger.info('Template applied', { templateId, variableCount: Object.keys(resolvedVars).length });

    return {
      templateId,
      templateName: template.name,
      renderedContent,
      renderedContentHtml,
      appliedVariables: resolvedVars,
    };
  }

  async rateTemplate(
    templateId: string,
    userId: string,
    rating: number,
    review?: string,
  ): Promise<{ template: ITemplateDocument; ratingRecord: ITemplateRatingDocument }> {
    // Ensure template exists
    await this.getTemplate(templateId);

    const ratingRecord = await this.templateRepository.upsertRating(templateId, userId, rating, review);

    // Recompute aggregate rating
    await this.templateRepository.updateRating(templateId);

    const updatedTemplate = await this.getTemplate(templateId);

    logger.info('Template rated', { templateId, userId, rating });

    return { template: updatedTemplate, ratingRecord };
  }

  async getSystemTemplates(): Promise<ITemplateDocument[]> {
    return this.templateRepository.findByType(TemplateType.SYSTEM);
  }

  async getTemplateVersions(templateId: string): Promise<ITemplateVersionDocument[]> {
    await this.getTemplate(templateId);

    return this.templateRepository.findVersionsByTemplateId(templateId);
  }

  async searchTemplates(
    query: string,
    options: Partial<TemplateQueryDto> = {},
  ): Promise<PaginatedTemplates> {
    return this.templateRepository.findAll({ ...options, search: query });
  }

  getCategories(): string[] {
    const { TemplateCategory } = require('../types/template.types') as { TemplateCategory: Record<string, string> };

    return Object.values(TemplateCategory);
  }

  async getTemplateRatings(templateId: string): Promise<ITemplateRatingDocument[]> {
    await this.getTemplate(templateId);

    return this.templateRepository.findRatingsByTemplate(templateId);
  }

  // --------------- Private helpers ---------------

  private assertOwnership(template: ITemplateDocument, userId: string): void {
    if (template.type === TemplateType.SYSTEM) {
      throw new AppError(StatusCodes.FORBIDDEN, 'System templates cannot be modified by users');
    }
    if (template.authorId !== userId) {
      throw new AppError(StatusCodes.FORBIDDEN, 'You do not have permission to modify this template');
    }
  }

  private interpolateVariables(content: string, variables: Record<string, string>): string {
    return content.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_match, key: string) => {
      return key in variables ? variables[key] : `{{${key}}}`;
    });
  }

  private async renderMarkdown(markdown: string): Promise<string> {
    try {
      return await marked(markdown, { async: true });
    } catch (error) {
      logger.warn('Failed to render markdown, returning raw content', { error });

      return markdown;
    }
  }
}
