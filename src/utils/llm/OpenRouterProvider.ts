/**
 * OpenRouter Provider Implementation
 * Routes all calls through Tauri IPC backend since CSP blocks direct frontend HTTP calls.
 * Supports streaming via Tauri events and function calling.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { BaseLLMProvider } from "./LLMProvider";
import {
  LLMProviderType,
  LLMModel,
  LLMRequestOptions,
  LLMResponse,
  LLMStreamChunk,
  LLMMessage,
  LLMToolDefinition,
} from "./types";

interface OpenRouterMessage {
  id: string;
  role: string;
  content: { type: string; text?: string }[];
  name: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

interface OpenRouterStreamEvent {
  threadId: string;
  chunk: {
    content: string;
    done: boolean;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
    finishReason: string | null;
  };
}

export class OpenRouterProvider extends BaseLLMProvider {
  readonly type: LLMProviderType = "openrouter";
  readonly name = "OpenRouter";

  protected checkConfiguration(): boolean {
    return !!this.config.apiKey;
  }

  protected initializeModels(): LLMModel[] {
    return [
      {
        id: "openai/gpt-4o",
        name: "GPT-4o (via OpenRouter)",
        provider: "openrouter",
        maxContextTokens: 128000,
        maxOutputTokens: 16384,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "OpenAI GPT-4o via OpenRouter",
      },
      {
        id: "anthropic/claude-3.5-sonnet",
        name: "Claude 3.5 Sonnet (via OpenRouter)",
        provider: "openrouter",
        maxContextTokens: 200000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "Anthropic Claude 3.5 Sonnet via OpenRouter",
      },
      {
        id: "google/gemini-pro-1.5",
        name: "Gemini Pro 1.5 (via OpenRouter)",
        provider: "openrouter",
        maxContextTokens: 1000000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: false,
        supportsVision: true,
        description: "Google Gemini Pro 1.5 via OpenRouter",
      },
      {
        id: "meta-llama/llama-3.1-405b-instruct",
        name: "Llama 3.1 405B (via OpenRouter)",
        provider: "openrouter",
        maxContextTokens: 131072,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsTools: false,
        supportsVision: false,
        description: "Meta Llama 3.1 405B via OpenRouter",
      },
      {
        id: "mistralai/mistral-large-latest",
        name: "Mistral Large (via OpenRouter)",
        provider: "openrouter",
        maxContextTokens: 131072,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        description: "Mistral Large via OpenRouter",
      },
    ];
  }

  async listModels(): Promise<LLMModel[]> {
    try {
      interface BackendModel {
        id: string;
        name: string;
        provider: string;
        contextWindow: number;
        maxOutputTokens: number | null;
        supportsVision: boolean;
        supportsFunctions: boolean;
        supportsStreaming: boolean;
      }

      const models = await invoke<BackendModel[]>("openrouter_list_models");
      return models.map((m) => ({
        id: m.id,
        name: m.name,
        provider: "openrouter" as LLMProviderType,
        maxContextTokens: m.contextWindow,
        maxOutputTokens: m.maxOutputTokens ?? 4096,
        supportsStreaming: m.supportsStreaming,
        supportsTools: m.supportsFunctions,
        supportsVision: m.supportsVision,
      }));
    } catch {
      return this.getModels();
    }
  }

  protected async doComplete(options: LLMRequestOptions): Promise<LLMResponse> {
    const messages = this.convertMessages(options.messages, options.systemPrompt);
    const tools = options.tools ? this.convertTools(options.tools) : undefined;

    const result = await invoke<string>("openrouter_chat", {
      messages,
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      tools,
    });

    return {
      id: crypto.randomUUID(),
      content: result,
      role: "assistant",
      model: options.model,
      finishReason: "stop",
    };
  }

  protected async *doStream(
    options: LLMRequestOptions,
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const messages = this.convertMessages(options.messages, options.systemPrompt);
    const tools = options.tools ? this.convertTools(options.tools) : undefined;
    const threadId = `openrouter-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    type ResolveFunc = (value: IteratorResult<LLMStreamChunk, void>) => void;
    const queue: LLMStreamChunk[] = [];
    let resolve: ResolveFunc | null = null;
    let done = false;

    const unlisten = await listen<OpenRouterStreamEvent>("openrouter:stream", (event) => {
      const payload = event.payload;
      if (payload.threadId !== threadId) return;

      const chunk = payload.chunk;

      if (chunk.content) {
        const streamChunk: LLMStreamChunk = { type: "text", content: chunk.content };
        if (resolve) {
          const r = resolve;
          resolve = null;
          r({ value: streamChunk, done: false });
        } else {
          queue.push(streamChunk);
        }
      }

      if (chunk.usage) {
        const usageChunk: LLMStreamChunk = {
          type: "usage",
          usage: {
            inputTokens: chunk.usage.promptTokens,
            outputTokens: chunk.usage.completionTokens,
            totalTokens: chunk.usage.totalTokens,
          },
        };
        queue.push(usageChunk);
      }

      if (chunk.done) {
        done = true;
        const doneChunk: LLMStreamChunk = { type: "done" };
        queue.push(doneChunk);
        if (resolve) {
          const r = resolve;
          resolve = null;
          const next = queue.shift();
          if (next) {
            r({ value: next, done: false });
          }
        }
      }
    });

    invoke("openrouter_stream_chat", {
      messages,
      model: options.model,
      threadId,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      tools,
    }).catch((err) => {
      done = true;
      const errorChunk: LLMStreamChunk = { type: "error", error: String(err) };
      if (resolve) {
        const r = resolve;
        resolve = null;
        r({ value: errorChunk, done: false });
      } else {
        queue.push(errorChunk);
      }
    });

    try {
      while (true) {
        if (queue.length > 0) {
          const chunk = queue.shift()!;
          yield chunk;
          if (chunk.type === "done" || chunk.type === "error") break;
        } else if (done) {
          break;
        } else {
          const result = await new Promise<IteratorResult<LLMStreamChunk, void>>((r) => {
            resolve = r;
          });
          if (result.done) break;
          yield result.value;
          if (result.value.type === "done" || result.value.type === "error") break;
        }
      }
    } finally {
      unlisten();
    }
  }

  private convertMessages(messages: LLMMessage[], systemPrompt?: string): OpenRouterMessage[] {
    const result: OpenRouterMessage[] = [];

    if (systemPrompt) {
      result.push({
        id: crypto.randomUUID(),
        role: "system",
        content: [{ type: "text", text: systemPrompt }],
        name: null,
        timestamp: new Date().toISOString(),
        metadata: {},
      });
    }

    for (const msg of messages) {
      const content: { type: string; text?: string; tool_call_id?: string }[] = [];

      if (msg.role === "tool") {
        content.push({ type: "tool_result", tool_call_id: msg.toolCallId, text: msg.content });
      } else {
        content.push({ type: "text", text: msg.content });
      }

      if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          content.push({
            type: "tool_call",
            text: JSON.stringify({ id: tc.id, name: tc.name, arguments: tc.arguments }),
          });
        }
      }

      result.push({
        id: crypto.randomUUID(),
        role: msg.role,
        content,
        name: null,
        timestamp: new Date().toISOString(),
        metadata: {},
      });
    }

    return result;
  }

  private convertTools(
    tools: LLMToolDefinition[],
  ): { name: string; description: string; parameters: Record<string, unknown> }[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required,
      },
    }));
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const exists = await invoke<boolean>("get_openrouter_api_key");
      return exists;
    } catch {
      return false;
    }
  }
}
