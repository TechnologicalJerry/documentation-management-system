import type { Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { ITemplateService } from '../services/template.service';
import { AppError } from '../services/template.service';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateQueryDto,
  ApplyTemplateDto,
} from '../types/template.types';
import { logger } from '../lib/logger';

export class TemplateController {
  constructor(private readonly templateService: ITemplateService) {}

  /**
   * GET /templates
   * List templates with optional filters and pagination.
   */
  getTemplates = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = req.query as unknown as TemplateQueryDto;
      const result = await this.templateService.getTemplates(query);
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /templates/system
   * Get all active system templates.
   */
  getSystemTemplates = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const templates = await this.templateService.getSystemTemplates();
      res.status(StatusCodes.OK).json({ success: true, data: templates });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /templates/categories
   * Return the list of available template categories.
   */
  getCategories = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const categories = this.templateService.getCategories();
      res.status(StatusCodes.OK).json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /templates/:id
   * Retrieve a single template by ID.
   */
  getTemplate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const template = await this.templateService.getTemplate(id);
      res.status(StatusCodes.OK).json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /templates
   * Create a new template.
   */
  createTemplate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'Authentication required');
      }

      const dto = req.body as CreateTemplateDto;
      const template = await this.templateService.createTemplate(req.user.id, dto);
      res.status(StatusCodes.CREATED).json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /templates/:id
   * Update an existing template.
   */
  updateTemplate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'Authentication required');
      }

      const { id } = req.params;
      const dto = req.body as UpdateTemplateDto;
      const template = await this.templateService.updateTemplate(id, req.user.id, dto);
      res.status(StatusCodes.OK).json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /templates/:id
   * Soft-delete a template.
   */
  deleteTemplate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'Authentication required');
      }

      const { id } = req.params;
      await this.templateService.deleteTemplate(id, req.user.id);
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /templates/:id/apply
   * Apply a template with variable substitution and return rendered content.
   */
  applyTemplate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const dto = req.body as ApplyTemplateDto;
      const result = await this.templateService.applyTemplate(id, dto);
      res.status(StatusCodes.OK).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /templates/:id/rate
   * Submit a rating (1-5) and optional review for a template.
   */
  rateTemplate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'Authentication required');
      }

      const { id } = req.params;
      const { rating, review } = req.body as { rating: number; review?: string };

      const result = await this.templateService.rateTemplate(id, req.user.id, rating, review);
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          template: result.template,
          rating: result.ratingRecord,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /templates/:id/versions
   * Retrieve all version history for a template.
   */
  getTemplateVersions = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const versions = await this.templateService.getTemplateVersions(id);
      res.status(StatusCodes.OK).json({ success: true, data: versions });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /templates/:id/ratings
   * Retrieve all ratings for a template.
   */
  getTemplateRatings = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const ratings = await this.templateService.getTemplateRatings(id);
      res.status(StatusCodes.OK).json({ success: true, data: ratings });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /templates/:id/publish
   * Publish a template to the public marketplace.
   */
  publishTemplate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'Authentication required');
      }

      const { id } = req.params;
      const template = await this.templateService.publishTemplate(id, req.user.id);
      res.status(StatusCodes.OK).json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /templates/:id/unpublish
   * Unpublish a template (make it private).
   */
  unpublishTemplate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'Authentication required');
      }

      const { id } = req.params;
      const template = await this.templateService.unpublishTemplate(id, req.user.id);
      res.status(StatusCodes.OK).json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /templates/search
   * Full-text search across templates.
   */
  searchTemplates = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { q, ...rest } = req.query as { q?: string } & Partial<TemplateQueryDto>;

      if (!q || typeof q !== 'string' || q.trim() === '') {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Search query "q" is required');
      }

      const result = await this.templateService.searchTemplates(q, rest as Partial<TemplateQueryDto>);
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}

export function createTemplateController(templateService: ITemplateService): TemplateController {
  return new TemplateController(templateService);
}

// Global error handler for the template service
export function templateErrorHandler(
  err: unknown,
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn('Application error', {
      statusCode: err.statusCode,
      message: err.message,
    });
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });

    return;
  }

  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Unexpected error', { message: error.message, stack: error.stack });

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: 'An unexpected error occurred',
  });
}
