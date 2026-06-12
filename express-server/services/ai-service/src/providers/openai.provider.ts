import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../lib/logger';
import { AIProviderError, GenerationTimeoutError } from '../lib/errors';
import { IAIProvider, GenerateOptions, GenerateResult, ModelInfo } from './types';

export class OpenAIProvider implements IAIProvider {
  public readonly name = 'OPENAI';
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(apiKey?: string, baseUrl?: string, model?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? config.openai.apiKey,
      baseURL: baseUrl ?? config.openai.baseUrl,
      timeout: config.ai.generationTimeoutMs,
      maxRetries: 2,
    });
    this.defaultModel = model ?? config.openai.model;
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    const model = options.model ?? this.defaultModel;

    try {
      logger.debug('OpenAI generate request', { model, promptLength: prompt.length });

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const completion = await this.client.chat.completions.create({
        model,
        messages,
        ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        stream: false,
      });

      const choice = completion.choices[0];
      if (!choice) {
        throw new AIProviderError('OpenAI returned no choices', this.name);
      }

      const content = choice.message.content ?? '';
      const usage = completion.usage;

      logger.debug('OpenAI generate response', {
        model: completion.model,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        finishReason: choice.finish_reason,
      });

      return {
        content,
        tokensUsed: usage?.total_tokens,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        finishReason: choice.finish_reason,
        model: completion.model,
        provider: this.name,
      };
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }

      if (error instanceof OpenAI.APIConnectionTimeoutError) {
        throw new GenerationTimeoutError(config.ai.generationTimeoutMs);
      }

      if (error instanceof OpenAI.APIError) {
        logger.error('OpenAI API error', {
          status: error.status,
          message: error.message,
          code: error.code,
        });
        throw new AIProviderError(
          `OpenAI API error (${error.status ?? 'unknown'}): ${error.message}`,
          this.name,
        );
      }

      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('OpenAI generate error', { error: err.message });
      throw new AIProviderError(`OpenAI generation failed: ${err.message}`, this.name);
    }
  }

  async *streamGenerate(
    prompt: string,
    options: GenerateOptions = {},
  ): AsyncGenerator<string> {
    const model = options.model ?? this.defaultModel;

    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const stream = await this.client.chat.completions.create({
        model,
        messages,
        ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield delta;
        }
      }
    } catch (error) {
      if (error instanceof AIProviderError || error instanceof GenerationTimeoutError) {
        throw error;
      }

      if (error instanceof OpenAI.APIConnectionTimeoutError) {
        throw new GenerationTimeoutError(config.ai.generationTimeoutMs);
      }

      if (error instanceof OpenAI.APIError) {
        throw new AIProviderError(
          `OpenAI API error (${error.status ?? 'unknown'}): ${error.message}`,
          this.name,
        );
      }

      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('OpenAI stream error', { error: err.message });
      throw new AIProviderError(`OpenAI streaming failed: ${err.message}`, this.name);
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!config.openai.apiKey) {
      return false;
    }
    try {
      await this.client.models.list();

      return true;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const models = await this.client.models.list();

      return models.data
        .filter(
          (m) =>
            m.id.startsWith('gpt-') ||
            m.id.startsWith('o1') ||
            m.id.startsWith('o3') ||
            m.id.startsWith('text-') ||
            m.id.includes('claude'),
        )
        .map((m) => ({
          id: m.id,
          name: m.id,
        }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get OpenAI models', { error: err.message });

      return [];
    }
  }
}
