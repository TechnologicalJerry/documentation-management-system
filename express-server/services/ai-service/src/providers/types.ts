export interface GenerateOptions {
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  timeoutMs?: number;
}

export interface GenerateResult {
  content: string;
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  finishReason?: string;
  model: string;
  provider: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
}

export interface IAIProvider {
  /**
   * Generate a completion synchronously (non-streaming).
   */
  generate(prompt: string, options: GenerateOptions): Promise<GenerateResult>;

  /**
   * Stream tokens as an async generator, yielding string chunks as they arrive.
   */
  streamGenerate(prompt: string, options: GenerateOptions): AsyncGenerator<string>;

  /**
   * Returns true if the provider backend is reachable.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Returns a list of model IDs available on this provider.
   */
  getModels(): Promise<ModelInfo[]>;

  /**
   * Human-readable name for the provider.
   */
  readonly name: string;
}
