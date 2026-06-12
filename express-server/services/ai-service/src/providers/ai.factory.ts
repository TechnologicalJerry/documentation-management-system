import { config } from '../config';
import { logger } from '../lib/logger';
import { AIProviderError } from '../lib/errors';
import { IAIProvider } from './types';
import { OllamaProvider } from './ollama.provider';
import { OpenAIProvider } from './openai.provider';

export type ProviderType = 'ollama' | 'openai' | 'custom';

export interface ProviderConfig {
  type: ProviderType;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

/**
 * Factory responsible for constructing IAIProvider instances.
 * Providers are cached as singletons by their configuration key.
 */
export class AIProviderFactory {
  private static readonly cache = new Map<string, IAIProvider>();
  private static defaultProvider: IAIProvider | null = null;

  /**
   * Get the default provider configured via environment variables.
   */
  static getDefault(): IAIProvider {
    if (AIProviderFactory.defaultProvider !== null) {
      return AIProviderFactory.defaultProvider;
    }

    const provider = AIProviderFactory.create({
      type: config.ai.provider,
    });

    AIProviderFactory.defaultProvider = provider;
    logger.info('AI default provider initialised', {
      type: config.ai.provider,
      name: provider.name,
    });

    return provider;
  }

  /**
   * Create a provider instance for the supplied config.
   * Results are cached — identical configs return the same instance.
   */
  static create(providerConfig: ProviderConfig): IAIProvider {
    const cacheKey = AIProviderFactory.buildCacheKey(providerConfig);

    const cached = AIProviderFactory.cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    let provider: IAIProvider;

    switch (providerConfig.type) {
      case 'ollama':
        provider = new OllamaProvider(providerConfig.baseUrl, providerConfig.model);
        break;

      case 'openai':
        provider = new OpenAIProvider(
          providerConfig.apiKey,
          providerConfig.baseUrl,
          providerConfig.model,
        );
        break;

      case 'custom':
        // Custom provider uses the OpenAI-compatible interface with a custom base URL
        if (!providerConfig.baseUrl) {
          throw new AIProviderError(
            'Custom provider requires baseUrl to be specified',
          );
        }
        provider = new OpenAIProvider(
          providerConfig.apiKey ?? '',
          providerConfig.baseUrl,
          providerConfig.model,
        );
        break;

      default: {
        const exhaustive: never = providerConfig.type;
        throw new AIProviderError(`Unknown provider type: ${String(exhaustive)}`);
      }
    }

    AIProviderFactory.cache.set(cacheKey, provider);
    logger.debug('AI provider created', { type: providerConfig.type, cacheKey });

    return provider;
  }

  /**
   * Return all cached provider instances (useful for health checks).
   */
  static getAll(): IAIProvider[] {
    return Array.from(AIProviderFactory.cache.values());
  }

  /**
   * Clear the provider cache (mainly for testing).
   */
  static clearCache(): void {
    AIProviderFactory.cache.clear();
    AIProviderFactory.defaultProvider = null;
  }

  private static buildCacheKey(providerConfig: ProviderConfig): string {
    return [
      providerConfig.type,
      providerConfig.baseUrl ?? '',
      providerConfig.model ?? '',
    ].join('::');
  }
}
