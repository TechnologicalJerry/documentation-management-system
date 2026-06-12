import type { Response } from 'express';
import {
  GenerationModel,
  IGenerationDocument,
  GenerationType,
  GenerationStatus,
  AIProvider,
} from '../models/generation.model';
import { AIProviderFactory } from '../providers/ai.factory';
import { PromptBuilderService } from './promptBuilder.service';
import { generationQueue, QueueJob } from './queue.service';
import { config } from '../config';
import { logger } from '../lib/logger';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  GenerationCancelledError,
} from '../lib/errors';
import { AIGenerationPublisher } from '../events/ai.publisher';

export interface GenerateRequestDto {
  type: GenerationType;
  content: string;
  context?: string;
  projectId?: string;
  documentId?: string;
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    provider?: 'ollama' | 'openai' | 'custom';
    customSystemPrompt?: string;
    variables?: Record<string, string>;
  };
}

export interface GenerateQueryDto {
  page?: number;
  limit?: number;
  type?: GenerationType;
  status?: GenerationStatus;
  projectId?: string;
  documentId?: string;
}

export interface PaginatedGenerations {
  data: IGenerationDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IGenerationService {
  requestGeneration(userId: string, dto: GenerateRequestDto): Promise<{ jobId: string }>;
  getGeneration(id: string, userId: string): Promise<IGenerationDocument>;
  getGenerations(userId: string, query: GenerateQueryDto): Promise<PaginatedGenerations>;
  cancelGeneration(id: string, userId: string): Promise<void>;
  streamGeneration(id: string, userId: string, res: Response): Promise<void>;
}

// Internal job payload
interface GenerationJobPayload {
  generationId: string;
  userId: string;
  dto: GenerateRequestDto;
}

export class GenerationService implements IGenerationService {
  private readonly promptBuilder: PromptBuilderService;
  private readonly publisher: AIGenerationPublisher;

  constructor() {
    this.promptBuilder = new PromptBuilderService();
    this.publisher = new AIGenerationPublisher();

    // Register the queue handler once
    generationQueue.registerHandler(
      (job: QueueJob<any>) => this.processJob(job as QueueJob<GenerationJobPayload>),
    );
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async requestGeneration(
    userId: string,
    dto: GenerateRequestDto,
  ): Promise<{ jobId: string }> {
    // Build prompts
    const { userPrompt, systemPrompt } = await this.promptBuilder.buildPrompt(
      dto.type,
      { content: dto.content, context: dto.context, options: dto.options },
      dto.options?.variables ?? {},
    );

    const overrideSystemPrompt = dto.options?.customSystemPrompt ?? systemPrompt;

    // Determine provider and model
    const providerType = dto.options?.provider ?? config.ai.provider;
    const provider = AIProviderFactory.create({ type: providerType });
    const model =
      dto.options?.model ??
      (providerType === 'ollama' ? config.ollama.model : config.openai.model);

    // Persist the generation record
    const generation = await GenerationModel.create({
      userId,
      projectId: dto.projectId,
      documentId: dto.documentId,
      type: dto.type,
      status: GenerationStatus.PENDING,
      prompt: userPrompt,
      systemPrompt: overrideSystemPrompt,
      model,
      provider: provider.name as AIProvider,
      input: {
        content: dto.content,
        context: dto.context,
        options: dto.options,
      },
    });

    const generationId = String(generation._id);

    // Enqueue the job
    generationQueue.enqueue(generationId, {
      generationId,
      userId,
      dto,
    } as GenerationJobPayload);

    logger.info('Generation job queued', { generationId, userId, type: dto.type });

    return { jobId: generationId };
  }

  async getGeneration(id: string, userId: string): Promise<IGenerationDocument> {
    const generation = await GenerationModel.findById(id);

    if (!generation) {
      throw new NotFoundError('Generation');
    }

    if (generation.userId !== userId) {
      throw new ForbiddenError('You do not have access to this generation');
    }

    return generation;
  }

  async getGenerations(
    userId: string,
    query: GenerateQueryDto,
  ): Promise<PaginatedGenerations> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(
      query.limit ?? config.pagination.defaultPageSize,
      config.pagination.maxPageSize,
    );
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { userId };

    if (query.type != null) {filter.type = query.type;}
    if (query.status != null) {filter.status = query.status;}
    if (query.projectId) {filter.projectId = query.projectId;}
    if (query.documentId) {filter.documentId = query.documentId;}

    const [data, total] = await Promise.all([
      GenerationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      GenerationModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async cancelGeneration(id: string, userId: string): Promise<void> {
    const generation = await GenerationModel.findById(id);

    if (!generation) {
      throw new NotFoundError('Generation');
    }

    if (generation.userId !== userId) {
      throw new ForbiddenError('You do not have access to this generation');
    }

    if (
      generation.status === GenerationStatus.COMPLETED ||
      generation.status === GenerationStatus.FAILED
    ) {
      throw new BadRequestError(
        `Cannot cancel a generation with status: ${generation.status}`,
      );
    }

    // Cancel in the queue (may be pending or running)
    generationQueue.cancel(id);

    await GenerationModel.findByIdAndUpdate(id, {
      status: GenerationStatus.CANCELLED,
      completedAt: new Date(),
    });

    logger.info('Generation cancelled', { generationId: id, userId });
  }

  /**
   * Stream the result of a completed or in-progress generation as SSE.
   * If the generation is COMPLETED, the full content is streamed as a single event.
   * If PENDING/PROCESSING, we perform a live streaming generation and send chunks.
   */
  async streamGeneration(id: string, userId: string, res: Response): Promise<void> {
    const generation = await GenerationModel.findById(id);

    if (!generation) {
      throw new NotFoundError('Generation');
    }

    if (generation.userId !== userId) {
      throw new ForbiddenError('You do not have access to this generation');
    }

    if (generation.status === GenerationStatus.CANCELLED) {
      throw new GenerationCancelledError();
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (event: string, data: unknown): void => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const sendError = (message: string): void => {
      sendEvent('error', { message });
      res.end();
    };

    // Already completed — emit the stored result immediately
    if (generation.status === GenerationStatus.COMPLETED && generation.output) {
      sendEvent('start', { generationId: id, model: generation.model });
      sendEvent('chunk', { content: generation.output.content });
      sendEvent('done', {
        generationId: id,
        tokensUsed: generation.output.tokensUsed,
        finishReason: generation.output.finishReason,
      });
      res.end();

      return;
    }

    if (generation.status === GenerationStatus.FAILED) {
      sendError(generation.error ?? 'Generation failed');

      return;
    }

    // Perform live streaming
    try {
      const providerType = (generation.provider.toLowerCase() as 'ollama' | 'openai') ?? config.ai.provider;
      const provider = AIProviderFactory.create({ type: providerType, model: generation.model });

      sendEvent('start', { generationId: id, model: generation.model });

      // Update status to PROCESSING
      await GenerationModel.findByIdAndUpdate(id, { status: GenerationStatus.PROCESSING });

      const startTime = Date.now();
      let fullContent = '';

      for await (const chunk of provider.streamGenerate(generation.prompt, {
        systemPrompt: generation.systemPrompt,
        model: generation.model,
        maxTokens: config.ai.maxTokens,
        temperature: config.ai.temperature,
        timeoutMs: config.ai.generationTimeoutMs,
      })) {
        // Check if cancelled mid-stream
        const current = await GenerationModel.findById(id).select('status').lean();
        if (current?.status === GenerationStatus.CANCELLED) {
          sendEvent('cancelled', { generationId: id });
          res.end();

          return;
        }

        fullContent += chunk;
        sendEvent('chunk', { content: chunk });
      }

      const processingTime = Date.now() - startTime;

      // Persist the result
      await GenerationModel.findByIdAndUpdate(id, {
        status: GenerationStatus.COMPLETED,
        output: { content: fullContent },
        processingTime,
        completedAt: new Date(),
      });

      sendEvent('done', {
        generationId: id,
        processingTime,
      });
      res.end();

      // Publish event
      await this.publisher.publishGenerationCompleted({
        generationId: id,
        userId: generation.userId,
        type: generation.type,
        projectId: generation.projectId,
        documentId: generation.documentId,
        outputContent: fullContent,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Stream generation error', { generationId: id, error: err.message });

      await GenerationModel.findByIdAndUpdate(id, {
        status: GenerationStatus.FAILED,
        error: err.message,
        completedAt: new Date(),
      });

      sendError(err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Queue job processor
  // ---------------------------------------------------------------------------

  private async processJob(job: QueueJob<GenerationJobPayload>): Promise<void> {
    const { generationId, dto } = job.payload;

    logger.info('Processing generation job', { generationId, type: dto.type });

    const startTime = Date.now();

    try {
      // Verify still valid (not cancelled)
      const generation = await GenerationModel.findById(generationId);
      if (!generation) {
        logger.warn('Generation record not found, skipping', { generationId });

        return;
      }

      if (generation.status === GenerationStatus.CANCELLED) {
        logger.info('Generation already cancelled, skipping', { generationId });

        return;
      }

      // Mark as processing
      await GenerationModel.findByIdAndUpdate(generationId, {
        status: GenerationStatus.PROCESSING,
      });

      // Resolve provider
      const providerType = dto.options?.provider ?? config.ai.provider;
      const provider = AIProviderFactory.create({ type: providerType });
      const model =
        dto.options?.model ??
        (providerType === 'ollama' ? config.ollama.model : config.openai.model);

      // Execute generation
      const result = await provider.generate(generation.prompt, {
        systemPrompt: generation.systemPrompt,
        model,
        maxTokens: dto.options?.maxTokens ?? config.ai.maxTokens,
        temperature: dto.options?.temperature ?? config.ai.temperature,
        timeoutMs: config.ai.generationTimeoutMs,
      });

      const processingTime = Date.now() - startTime;

      // Persist result
      await GenerationModel.findByIdAndUpdate(generationId, {
        status: GenerationStatus.COMPLETED,
        output: {
          content: result.content,
          tokensUsed: result.tokensUsed,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          finishReason: result.finishReason,
        },
        processingTime,
        completedAt: new Date(),
      });

      logger.info('Generation completed', {
        generationId,
        processingTimeMs: processingTime,
        tokensUsed: result.tokensUsed,
      });

      // Publish completion event
      await this.publisher.publishGenerationCompleted({
        generationId,
        userId: generation.userId,
        type: generation.type,
        projectId: generation.projectId,
        documentId: generation.documentId,
        outputContent: result.content,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const processingTime = Date.now() - startTime;

      logger.error('Generation job failed', {
        generationId,
        error: err.message,
        processingTimeMs: processingTime,
      });

      await GenerationModel.findByIdAndUpdate(generationId, {
        status: GenerationStatus.FAILED,
        error: err.message,
        processingTime,
        completedAt: new Date(),
      }).catch((updateErr: unknown) => {
        logger.error('Failed to update generation status to FAILED', {
          generationId,
          error: String(updateErr),
        });
      });

      throw err;
    }
  }
}
