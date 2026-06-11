import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { GenerationService } from '../services/generation.service';
import { AIProviderFactory } from '../providers/ai.factory';
import { config } from '../config';
import { logger } from '../lib/logger';
import { AppError, UnauthorizedError } from '../lib/errors';
import type { GenerateRequestDto, GenerateQueryDto } from '../validators/ai.validators';

// Extend Request with validated query
interface RequestWithQuery extends Request {
  validatedQuery?: GenerateQueryDto;
}

// Minimal shape expected on req from JWT middleware
interface AuthUser {
  id: string;
  email: string;
  role: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export class AIController {
  private readonly generationService: GenerationService;

  constructor(generationService?: GenerationService) {
    this.generationService = generationService ?? new GenerationService();
  }

  // ---------------------------------------------------------------------------
  // POST /generate
  // ---------------------------------------------------------------------------
  startGeneration = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = this.resolveUserId(req);
      const dto = req.body as GenerateRequestDto;

      const result = await this.generationService.requestGeneration(userId, dto);

      logger.info('Generation requested', { userId, jobId: result.jobId, type: dto.type });

      res.status(StatusCodes.ACCEPTED).json({
        success: true,
        data: {
          jobId: result.jobId,
          message: 'Generation job queued successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ---------------------------------------------------------------------------
  // GET /generate/:id
  // ---------------------------------------------------------------------------
  getGeneration = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = this.resolveUserId(req);
      const { id } = req.params;

      const generation = await this.generationService.getGeneration(id, userId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: generation,
      });
    } catch (error) {
      next(error);
    }
  };

  // ---------------------------------------------------------------------------
  // GET /generate
  // ---------------------------------------------------------------------------
  listGenerations = async (
    req: RequestWithQuery & AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = this.resolveUserId(req);
      const query = req.validatedQuery ?? {};

      const result = await this.generationService.getGenerations(userId, query);

      res.status(StatusCodes.OK).json({
        success: true,
        data: result.data,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ---------------------------------------------------------------------------
  // DELETE /generate/:id
  // ---------------------------------------------------------------------------
  cancelGeneration = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = this.resolveUserId(req);
      const { id } = req.params;

      await this.generationService.cancelGeneration(id, userId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: { message: 'Generation cancelled successfully' },
      });
    } catch (error) {
      next(error);
    }
  };

  // ---------------------------------------------------------------------------
  // GET /generate/:id/stream  (SSE)
  // ---------------------------------------------------------------------------
  streamGeneration = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = this.resolveUserId(req);
      const { id } = req.params;

      // Delegate full SSE lifecycle to the service
      await this.generationService.streamGeneration(id, userId, res);
    } catch (error) {
      // If headers not sent yet, use normal error flow
      if (!res.headersSent) {
        next(error);
      } else {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Error during SSE stream (headers already sent)', {
          error: err.message,
        });
        res.end();
      }
    }
  };

  // ---------------------------------------------------------------------------
  // GET /models
  // ---------------------------------------------------------------------------
  getModels = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const provider = AIProviderFactory.getDefault();
      const models = await provider.getModels();

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          provider: provider.name,
          models,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ---------------------------------------------------------------------------
  // GET /health/providers
  // ---------------------------------------------------------------------------
  checkProviders = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const providerChecks = await Promise.allSettled([
        this.checkProvider('ollama'),
        this.checkProvider('openai'),
      ]);

      const results = {
        ollama: this.extractAvailability(providerChecks[0]),
        openai: this.extractAvailability(providerChecks[1]),
        default: config.ai.provider,
      };

      const overallHealthy = results.ollama || results.openai;

      res.status(overallHealthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  };

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private resolveUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    return userId;
  }

  private async checkProvider(
    type: 'ollama' | 'openai',
  ): Promise<{ type: string; available: boolean }> {
    try {
      const provider = AIProviderFactory.create({ type });
      const available = await provider.isAvailable();

      return { type, available };
    } catch {
      return { type, available: false };
    }
  }

  private extractAvailability(
    result: PromiseSettledResult<{ type: string; available: boolean }>,
  ): boolean {
    if (result.status === 'fulfilled') {
      return result.value.available;
    }

    return false;
  }
}

// ---------------------------------------------------------------------------
// Global error handler middleware
// ---------------------------------------------------------------------------
export function aiErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });

    return;
  }

  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Unhandled error', { error: error.message, stack: error.stack });

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
