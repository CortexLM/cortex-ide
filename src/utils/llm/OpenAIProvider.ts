/**
 * OpenAI Provider Implementation
 * Supports GPT models with streaming and tool use
 */

import { BaseLLMProvider } from "./LLMProvider";
import {
  LLMProviderType,
  LLMModel,
  LLMRequestOptions,
  LLMResponse,
  LLMStreamChunk,
  LLMUsage,
  LLMToolCall,
  LLMMessage,
  LLMToolDefinition,
} from "./types";

const OPENAI_API_URL = "https://api.openai.com/v1";

interface OpenAIMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: OpenAITool[];
  stop?: string[];
  parallel_tool_calls?: boolean;
}

interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: {
    index: number;
    message: OpenAIMessage;
    finish_reason: "stop" | "tool_calls" | "length" | "content_filter";
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
  };
}

interface OpenAIStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: {
        index: number;
        id?: string;
        type?: "function";
        function?: {
          name?: string;
          arguments?: string;
        };
      }[];
    };
    finish_reason?: "stop" | "tool_calls" | "length" | "content_filter";
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIProvider extends BaseLLMProvider {
  readonly type: LLMProviderType = "openai";
  readonly name = "OpenAI";

  protected checkConfiguration(): boolean {
    return !!this.config.apiKey;
  }

  protected initializeModels(): LLMModel[] {
    return [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        provider: "openai",
        maxContextTokens: 128000,
        maxOutputTokens: 16384,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "Most capable GPT-4 model",
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        provider: "openai",
        maxContextTokens: 128000,
        maxOutputTokens: 16384,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "Fast and affordable",
      },
      {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        provider: "openai",
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "Previous flagship model",
      },
      {
        id: "gpt-4.1",
        name: "GPT-4.1",
        provider: "openai",
        maxContextTokens: 1047576,
        maxOutputTokens: 32768,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "Latest GPT-4 iteration",
      },
      {
        id: "gpt-4.1-mini",
        name: "GPT-4.1 Mini",
        provider: "openai",
        maxContextTokens: 1047576,
        maxOutputTokens: 32768,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "Fast GPT-4.1 variant",
      },
      {
        id: "o1",
        name: "o1",
        provider: "openai",
        maxContextTokens: 200000,
        maxOutputTokens: 100000,
        supportsStreaming: true,
        supportsTools: false,
        supportsVision: true,
        supportsThinking: true,
        description: "Advanced reasoning model",
      },
      {
        id: "o3-mini",
        name: "o3 Mini",
        provider: "openai",
        maxContextTokens: 200000,
        maxOutputTokens: 100000,
        supportsStreaming: true,
        supportsTools: false,
        supportsVision: false,
        supportsThinking: true,
        description: "Fast reasoning model",
      },
      {
        id: "gpt-3.5-turbo",
        name: "GPT-3.5 Turbo",
        provider: "openai",
        maxContextTokens: 16385,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        description: "Legacy fast model",
      },
    ];
  }

  protected async doComplete(options: LLMRequestOptions): Promise<LLMResponse> {
    const request = this.buildRequest(options);
    request.stream = false;

    const response = await this.makeRequest(
      `${this.config.baseUrl || OPENAI_API_URL}/chat/completions`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw this.parseErrorResponse(response.status, body);
    }

    const data: OpenAIResponse = await response.json();
    return this.parseResponse(data);
  }

  protected async *doStream(options: LLMRequestOptions): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const request = this.buildRequest(options);
    request.stream = true;

    const response = await this.makeRequest(
      `${this.config.baseUrl || OPENAI_API_URL}/chat/completions`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw this.parseErrorResponse(response.status, body);
    }

    if (!response.body) {
      throw this.createError("No response body", "NETWORK_ERROR");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            // Yield any pending tool calls
            for (const [, tc] of toolCalls) {
              let parsedArgs: Record<string, unknown> = {};
              try {
                parsedArgs = JSON.parse(tc.arguments || "{}");
              } catch {
                console.warn("[OpenAI] Failed to parse tool call arguments, using empty object");
              }
              yield {
                type: "tool_call_end",
                toolCall: {
                  id: tc.id,
                  name: tc.name,
                  arguments: parsedArgs,
                },
              };
            }
            yield { type: "done" };
            continue;
          }

          try {
            const chunk: OpenAIStreamChunk = JSON.parse(data);
            const choice = chunk.choices[0];
            
            if (!choice) continue;

            if (choice.delta.content) {
              yield { type: "text", content: choice.delta.content };
            }

            if (choice.delta.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                const existing = toolCalls.get(tc.index);
                
                if (tc.id && tc.function?.name) {
                  // New tool call
                  toolCalls.set(tc.index, {
                    id: tc.id,
                    name: tc.function.name,
                    arguments: tc.function.arguments || "",
                  });
                  yield {
                    type: "tool_call_start",
                    toolCall: { id: tc.id, name: tc.function.name },
                  };
                } else if (existing && tc.function?.arguments) {
                  // Append to existing tool call
                  existing.arguments += tc.function.arguments;
                  yield { type: "tool_call_delta", content: tc.function.arguments };
                }
              }
            }

            if (chunk.usage) {
              yield {
                type: "usage",
                usage: {
                  inputTokens: chunk.usage.prompt_tokens,
                  outputTokens: chunk.usage.completion_tokens,
                  totalTokens: chunk.usage.total_tokens,
                },
              };
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
    };

    if (this.config.organizationId) {
      headers["OpenAI-Organization"] = this.config.organizationId;
    }

    return headers;
  }

  private buildRequest(options: LLMRequestOptions): OpenAIRequest {
    const messages = this.convertMessages(options.messages, options.systemPrompt);
    
    const request: OpenAIRequest = {
      model: options.model,
      messages,
    };

    if (options.maxTokens) {
      request.max_completion_tokens = options.maxTokens;
    }

    if (options.temperature !== undefined) {
      request.temperature = options.temperature;
    }

    if (options.topP !== undefined) {
      request.top_p = options.topP;
    }

    if (options.tools && options.tools.length > 0) {
      request.tools = this.convertTools(options.tools);
      request.parallel_tool_calls = true;
    }

    if (options.stopSequences && options.stopSequences.length > 0) {
      request.stop = options.stopSequences;
    }

    return request;
  }

  private convertMessages(messages: LLMMessage[], systemPrompt?: string): OpenAIMessage[] {
    const result: OpenAIMessage[] = [];

    if (systemPrompt) {
      result.push({ role: "system", content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === "tool") {
        result.push({
          role: "tool",
          content: msg.content,
          tool_call_id: msg.toolCallId,
        });
        continue;
      }

      const openaiMsg: OpenAIMessage = {
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      };

      if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
        openaiMsg.content = msg.content || null;
        openaiMsg.tool_calls = msg.toolCalls.map(tc => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }));
      }

      result.push(openaiMsg);
    }

    return result;
  }

  private convertTools(tools: LLMToolDefinition[]): OpenAITool[] {
    return tools.map(tool => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required,
        },
      },
    }));
  }

  private parseResponse(data: OpenAIResponse): LLMResponse {
    const choice = data.choices[0];
    const message = choice.message;
    
    const toolCalls: LLMToolCall[] = [];
    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments || "{}");
        } catch {
          console.warn("[OpenAI] Failed to parse tool call arguments, using empty object");
        }
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: parsedArgs,
        });
      }
    }

    const usage: LLMUsage = {
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
      cacheReadTokens: data.usage.prompt_tokens_details?.cached_tokens,
    };

    let finishReason: LLMResponse["finishReason"] = "stop";
    if (choice.finish_reason === "tool_calls") finishReason = "tool_use";
    else if (choice.finish_reason === "length") finishReason = "length";
    else if (choice.finish_reason === "content_filter") finishReason = "error";

    return {
      id: data.id,
      content: message.content || "",
      role: "assistant",
      model: data.model,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
      finishReason,
    };
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        `${this.config.baseUrl || OPENAI_API_URL}/models`,
        {
          method: "GET",
          headers: this.getHeaders(),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
