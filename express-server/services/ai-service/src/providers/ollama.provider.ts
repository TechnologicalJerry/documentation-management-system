import { config } from '../config';
import { logger } from '../lib/logger';
import { AIProviderError, GenerationTimeoutError } from '../lib/errors';
import { IAIProvider, GenerateOptions, GenerateResult, ModelInfo } from './types';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream: boolean;
  options?: {
    num_predict?: number;
    temperature?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  done_reason?: string;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaListResponse {
  models: OllamaModel[];
}

export class OllamaProvider implements IAIProvider {
  public readonly name = 'OLLAMA';
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = (baseUrl ?? config.ollama.baseUrl).replace(/\/$/, '');
    this.defaultModel = model ?? config.ollama.model;
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    const model = options.model ?? this.defaultModel;
    const timeoutMs = options.timeoutMs ?? config.ai.generationTimeoutMs;

    const body: OllamaGenerateRequest = {
      model,
      prompt,
      stream: false,
      ...(options.systemPrompt && { system: options.systemPrompt }),
      options: {
        ...(options.maxTokens !== undefined && { num_predict: options.maxTokens }),
        ...(options.temperature !== undefined && { temperature: options.temperature }),
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      logger.debug('Ollama generate request', { model, promptLength: prompt.length });

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new AIProviderError(
          `Ollama returned HTTP ${response.status}: ${errorText}`,
          this.name,
        );
      }

      const data = (await response.json()) as OllamaGenerateResponse;

      logger.debug('Ollama generate response', {
        model: data.model,
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count,
        doneReason: data.done_reason,
      });

      const totalTokens =
        (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0);

      return {
        content: data.response,
        tokensUsed: totalTokens > 0 ? totalTokens : undefined,
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count,
        finishReason: data.done_reason ?? (data.done ? 'stop' : undefined),
        model: data.model,
        provider: this.name,
      };
    } catch (error) {
      clearTimeout(timer);

      if (error instanceof AIProviderError) {
        throw error;
      }

      const err = error as Error;
      if (err.name === 'AbortError') {
        throw new GenerationTimeoutError(timeoutMs);
      }

      logger.error('Ollama generate error', { error: err.message });
      throw new AIProviderError(`Ollama generation failed: ${err.message}`, this.name);
    }
  }

  async *streamGenerate(
    prompt: string,
    options: GenerateOptions = {},
  ): AsyncGenerator<string> {
    const model = options.model ?? this.defaultModel;
    const timeoutMs = options.timeoutMs ?? config.ai.generationTimeoutMs;

    const body: OllamaGenerateRequest = {
      model,
      prompt,
      stream: true,
      ...(options.systemPrompt && { system: options.systemPrompt }),
      options: {
        ...(options.maxTokens !== undefined && { num_predict: options.maxTokens }),
        ...(options.temperature !== undefined && { temperature: options.temperature }),
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        clearTimeout(timer);
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new AIProviderError(
          `Ollama returned HTTP ${response.status}: ${errorText}`,
          this.name,
        );
      }

      if (!response.body) {
        clearTimeout(timer);
        throw new AIProviderError('Ollama response has no body for streaming', this.name);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {break;}

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter((line) => line.trim() !== '');

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line) as OllamaGenerateResponse;
              if (parsed.response) {
                yield parsed.response;
              }
              if (parsed.done) {
                return;
              }
            } catch {
              // partial JSON line — skip
            }
          }
        }
      } finally {
        reader.releaseLock();
        clearTimeout(timer);
      }
    } catch (error) {
      clearTimeout(timer);

      if (error instanceof AIProviderError || error instanceof GenerationTimeoutError) {
        throw error;
      }

      const err = error as Error;
      if (err.name === 'AbortError') {
        throw new GenerationTimeoutError(timeoutMs);
      }

      logger.error('Ollama stream error', { error: err.message });
      throw new AIProviderError(`Ollama streaming failed: ${err.message}`, this.name);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        logger.warn('Ollama getModels returned non-OK status', { status: response.status });

        return [];
      }

      const data = (await response.json()) as OllamaListResponse;

      return data.models.map((m) => ({
        id: m.name,
        name: m.name,
        description: m.details
          ? `${m.details.family} ${m.details.parameter_size} (${m.details.quantization_level})`
          : undefined,
      }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get Ollama models', { error: err.message });

      return [];
    }
  }
}
