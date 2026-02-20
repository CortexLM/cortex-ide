/**
 * Base LLM Provider Implementation
 * Abstract base class with common functionality for all providers
 */

import {
  LLMProvider,
  LLMProviderType,
  LLMProviderConfig,
  LLMModel,
  LLMRequestOptions,
  LLMResponse,
  LLMStreamChunk,
  LLMError,
  LLMErrorCode,
  LLMMessage,
} from "./types";

export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly type: LLMProviderType;
  abstract readonly name: string;
  
  protected config: LLMProviderConfig = {};
  protected models: LLMModel[] = [];

  get isConfigured(): boolean {
    return this.checkConfiguration();
  }

  protected abstract checkConfiguration(): boolean;
  protected abstract initializeModels(): LLMModel[];
  protected abstract doComplete(options: LLMRequestOptions): Promise<LLMResponse>;
  protected abstract doStream(options: LLMRequestOptions): AsyncGenerator<LLMStreamChunk, void, unknown>;

  configure(config: LLMProviderConfig): void {
    this.config = { ...this.config, ...config };
    this.models = this.initializeModels();
  }

  getModels(): LLMModel[] {
    if (this.models.length === 0) {
      this.models = this.initializeModels();
    }
    return this.models;
  }

  getDefaultModel(): LLMModel {
    const models = this.getModels();
    const defaultId = this.config.defaultModel;
    
    if (defaultId) {
      const model = models.find(m => m.id === defaultId);
      if (model) return model;
    }
    
    return models[0];
  }

  async complete(options: LLMRequestOptions): Promise<LLMResponse> {
    this.validateRequest(options);
    return this.doComplete(options);
  }

  async *stream(options: LLMRequestOptions): AsyncGenerator<LLMStreamChunk, void, unknown> {
    this.validateRequest(options);
    yield* this.doStream(options);
  }

  protected validateRequest(options: LLMRequestOptions): void {
    if (!this.isConfigured) {
      throw new LLMError(
        `${this.name} provider is not configured`,
        "INVALID_API_KEY",
        this.type
      );
    }

    if (!options.model) {
      throw new LLMError(
        "Model is required",
        "INVALID_REQUEST",
        this.type
      );
    }

    if (!options.messages || options.messages.length === 0) {
      throw new LLMError(
        "At least one message is required",
        "INVALID_REQUEST",
        this.type
      );
    }
  }

  protected createError(
    message: string,
    code: LLMErrorCode,
    statusCode?: number,
    retryable: boolean = false
  ): LLMError {
    return new LLMError(message, code, this.type, statusCode, retryable);
  }

  protected parseErrorResponse(status: number, body: string): LLMError {
    let errorData: { error?: { message?: string; type?: string; code?: string } } = {};
    
    try {
      errorData = JSON.parse(body);
    } catch {
      // Body is not JSON
    }

    const errorMessage = errorData.error?.message || body || "Unknown error";

    if (status === 401 || status === 403) {
      return this.createError(
        `Authentication failed: ${errorMessage}`,
        "INVALID_API_KEY",
        status
      );
    }

    if (status === 429) {
      return this.createError(
        `Rate limit exceeded: ${errorMessage}`,
        "RATE_LIMIT",
        status,
        true
      );
    }

    if (status === 400) {
      if (errorMessage.toLowerCase().includes("context") || 
          errorMessage.toLowerCase().includes("token")) {
        return this.createError(
          `Context length exceeded: ${errorMessage}`,
          "CONTEXT_LENGTH_EXCEEDED",
          status
        );
      }
      return this.createError(
        `Invalid request: ${errorMessage}`,
        "INVALID_REQUEST",
        status
      );
    }

    if (status === 404) {
      return this.createError(
        `Model not found: ${errorMessage}`,
        "MODEL_NOT_FOUND",
        status
      );
    }

    if (status >= 500) {
      return this.createError(
        `Server error: ${errorMessage}`,
        "SERVER_ERROR",
        status,
        true
      );
    }

    return this.createError(errorMessage, "UNKNOWN", status);
  }

  protected async makeRequest(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const timeout = this.config.timeout || 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
          ...options.headers,
        },
      });

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw this.createError("Request timeout", "TIMEOUT", undefined, true);
      }
      throw this.createError(
        `Network error: ${error instanceof Error ? error.message : "Unknown"}`,
        "NETWORK_ERROR",
        undefined,
        true
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected formatMessages(messages: LLMMessage[], systemPrompt?: string): LLMMessage[] {
    const result: LLMMessage[] = [];
    
    if (systemPrompt) {
      result.push({ role: "system", content: systemPrompt });
    }
    
    result.push(...messages);
    return result;
  }

  protected estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }
}
