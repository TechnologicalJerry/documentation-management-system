import type { FilterQuery, UpdateQuery } from 'mongoose';
import { TemplateModel } from '../models/template.model';
import { TemplateVersionModel } from '../models/templateVersion.model';
import { TemplateRatingModel } from '../models/templateRating.model';
import type {
  ITemplateDocument,
  ITemplateVersionDocument,
  ITemplateRatingDocument,
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateQueryDto,
  PaginatedTemplates,
} from '../types/template.types';
import { TemplateType } from '../types/template.types';
import { logger } from '../lib/logger';

export interface ITemplateRepository {
  findById(id: string): Promise<ITemplateDocument | null>;
  findBySlug(slug: string): Promise<ITemplateDocument | null>;
  findAll(query: TemplateQueryDto): Promise<PaginatedTemplates>;
  findByType(type: TemplateType): Promise<ITemplateDocument[]>;
  create(authorId: string, dto: CreateTemplateDto): Promise<ITemplateDocument>;
  update(id: string, dto: UpdateTemplateDto): Promise<ITemplateDocument | null>;
  softDelete(id: string): Promise<ITemplateDocument | null>;
  incrementUsage(id: string): Promise<void>;
  updateRating(id: string): Promise<void>;
  createVersion(
    templateId: string,
    content: string,
    contentHtml: string,
    createdBy: string,
    changelog?: string,
  ): Promise<ITemplateVersionDocument>;
  findVersionsByTemplateId(templateId: string): Promise<ITemplateVersionDocument[]>;
  findLatestVersion(templateId: string): Promise<ITemplateVersionDocument | null>;
  upsertRating(
    templateId: string,
    userId: string,
    rating: number,
    review?: string,
  ): Promise<ITemplateRatingDocument>;
  findRatingByUser(templateId: string, userId: string): Promise<ITemplateRatingDocument | null>;
  findRatingsByTemplate(templateId: string): Promise<ITemplateRatingDocument[]>;
  countByAuthor(authorId: string): Promise<number>;
}

export class TemplateRepository implements ITemplateRepository {
  async findById(id: string): Promise<ITemplateDocument | null> {
    try {
      return await TemplateModel.findOne({ _id: id, deletedAt: null }).lean<ITemplateDocument>({ virtuals: true });
    } catch (error) {
      logger.error('TemplateRepository.findById error', { id, error });
      throw error;
    }
  }

  async findBySlug(slug: string): Promise<ITemplateDocument | null> {
    try {
      return await TemplateModel.findOne({ slug, deletedAt: null }).lean<ITemplateDocument>({ virtuals: true });
    } catch (error) {
      logger.error('TemplateRepository.findBySlug error', { slug, error });
      throw error;
    }
  }

  async findAll(query: TemplateQueryDto): Promise<PaginatedTemplates> {
    const {
      page = 1,
      limit = 20,
      category,
      type,
      search,
      isPublic,
      authorId,
      organizationId,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const filter: FilterQuery<ITemplateDocument> = { deletedAt: null, isActive: true };

    if (category != null) {filter.category = category;}
    if (type != null) {filter.type = type;}
    if (isPublic !== undefined) {filter.isPublic = isPublic;}
    if (authorId) {filter.authorId = authorId;}
    if (organizationId) {filter.organizationId = organizationId;}
    if (tags && tags.length > 0) {filter.tags = { $all: tags };}

    if (search) {
      filter.$text = { $search: search };
    }

    const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * limit;

    try {
      const [data, total] = await Promise.all([
        TemplateModel.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean<ITemplateDocument[]>({ virtuals: true }),
        TemplateModel.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('TemplateRepository.findAll error', { query, error });
      throw error;
    }
  }

  async findByType(type: TemplateType): Promise<ITemplateDocument[]> {
    try {
      return await TemplateModel.find({ type, isActive: true, deletedAt: null })
        .sort({ name: 1 })
        .lean<ITemplateDocument[]>({ virtuals: true });
    } catch (error) {
      logger.error('TemplateRepository.findByType error', { type, error });
      throw error;
    }
  }

  async create(authorId: string, dto: CreateTemplateDto): Promise<ITemplateDocument> {
    try {
      const template = new TemplateModel({
        ...dto,
        authorId,
        isPublic: dto.isPublic ?? false,
        isActive: true,
        usageCount: 0,
        rating: 0,
      });
      const saved = await template.save();

      return saved.toObject({ virtuals: true }) as ITemplateDocument;
    } catch (error) {
      logger.error('TemplateRepository.create error', { authorId, dto, error });
      throw error;
    }
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<ITemplateDocument | null> {
    try {
      const updateData: UpdateQuery<ITemplateDocument> = { ...dto };
      // Remove changelog from the direct update — it's stored in versions
      delete (updateData as Partial<UpdateTemplateDto>).changelog;

      return await TemplateModel.findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: updateData },
        { new: true, runValidators: true },
      ).lean<ITemplateDocument>({ virtuals: true });
    } catch (error) {
      logger.error('TemplateRepository.update error', { id, dto, error });
      throw error;
    }
  }

  async softDelete(id: string): Promise<ITemplateDocument | null> {
    try {
      return await TemplateModel.findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: { deletedAt: new Date(), isActive: false } },
        { new: true },
      ).lean<ITemplateDocument>({ virtuals: true });
    } catch (error) {
      logger.error('TemplateRepository.softDelete error', { id, error });
      throw error;
    }
  }

  async incrementUsage(id: string): Promise<void> {
    try {
      await TemplateModel.updateOne({ _id: id }, { $inc: { usageCount: 1 } });
    } catch (error) {
      logger.error('TemplateRepository.incrementUsage error', { id, error });
      throw error;
    }
  }

  async updateRating(id: string): Promise<void> {
    try {
      const ratings = await TemplateRatingModel.find({ templateId: id });
      if (ratings.length === 0) {
        await TemplateModel.updateOne({ _id: id }, { $set: { rating: 0 } });

        return;
      }
      const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      const rounded = Math.round(avg * 10) / 10;
      await TemplateModel.updateOne({ _id: id }, { $set: { rating: rounded } });
    } catch (error) {
      logger.error('TemplateRepository.updateRating error', { id, error });
      throw error;
    }
  }

  async createVersion(
    templateId: string,
    content: string,
    contentHtml: string,
    createdBy: string,
    changelog?: string,
  ): Promise<ITemplateVersionDocument> {
    try {
      const latest = await this.findLatestVersion(templateId);
      const nextVersion = latest ? this.bumpVersion(latest.version) : '1.0.0';

      const version = new TemplateVersionModel({
        templateId,
        version: nextVersion,
        content,
        contentHtml,
        changelog,
        createdBy,
      });
      const saved = await version.save();

      return saved.toObject({ virtuals: true }) as ITemplateVersionDocument;
    } catch (error) {
      logger.error('TemplateRepository.createVersion error', { templateId, error });
      throw error;
    }
  }

  async findVersionsByTemplateId(templateId: string): Promise<ITemplateVersionDocument[]> {
    try {
      return await TemplateVersionModel.find({ templateId })
        .sort({ createdAt: -1 })
        .lean<ITemplateVersionDocument[]>({ virtuals: true });
    } catch (error) {
      logger.error('TemplateRepository.findVersionsByTemplateId error', { templateId, error });
      throw error;
    }
  }

  async findLatestVersion(templateId: string): Promise<ITemplateVersionDocument | null> {
    try {
      return await TemplateVersionModel.findOne({ templateId })
        .sort({ createdAt: -1 })
        .lean<ITemplateVersionDocument>({ virtuals: true });
    } catch (error) {
      logger.error('TemplateRepository.findLatestVersion error', { templateId, error });
      throw error;
    }
  }

  async upsertRating(
    templateId: string,
    userId: string,
    rating: number,
    review?: string,
  ): Promise<ITemplateRatingDocument> {
    try {
      const updated = await TemplateRatingModel.findOneAndUpdate(
        { templateId, userId },
        { $set: { rating, review } },
        { new: true, upsert: true, runValidators: true },
      ).lean<ITemplateRatingDocument>({ virtuals: true });

      if (!updated) {
        throw new Error('Failed to upsert rating');
      }

      return updated;
    } catch (error) {
      logger.error('TemplateRepository.upsertRating error', { templateId, userId, error });
      throw error;
    }
  }

  async findRatingByUser(templateId: string, userId: string): Promise<ITemplateRatingDocument | null> {
    try {
      return await TemplateRatingModel.findOne({ templateId, userId }).lean<ITemplateRatingDocument>({ virtuals: true });
    } catch (error) {
      logger.error('TemplateRepository.findRatingByUser error', { templateId, userId, error });
      throw error;
    }
  }

  async findRatingsByTemplate(templateId: string): Promise<ITemplateRatingDocument[]> {
    try {
      return await TemplateRatingModel.find({ templateId })
        .sort({ createdAt: -1 })
        .lean<ITemplateRatingDocument[]>({ virtuals: true });
    } catch (error) {
      logger.error('TemplateRepository.findRatingsByTemplate error', { templateId, error });
      throw error;
    }
  }

  async countByAuthor(authorId: string): Promise<number> {
    try {
      return await TemplateModel.countDocuments({ authorId, deletedAt: null });
    } catch (error) {
      logger.error('TemplateRepository.countByAuthor error', { authorId, error });
      throw error;
    }
  }

  private bumpVersion(version: string): string {
    const parts = version.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      return '1.0.0';
    }
    parts[2] += 1;

    return parts.join('.');
  }
}
