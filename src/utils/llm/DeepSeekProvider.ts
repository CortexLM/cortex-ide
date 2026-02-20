/**
 * DeepSeek Provider Implementation
 * Supports DeepSeek models with streaming and tool use
 * Uses OpenAI-compatible API
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

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1";

interface DeepSeekMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: DeepSeekToolCall[];
  tool_call_id?: string;
}

interface DeepSeekToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface DeepSeekTool {
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

interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: DeepSeekTool[];
  stop?: string[];
}

interface DeepSeekResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: {
    index: number;
    message: DeepSeekMessage;
    finish_reason: "stop" | "tool_calls" | "length";
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
  };
}

interface DeepSeekStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
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
    finish_reason?: "stop" | "tool_calls" | "length";
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class DeepSeekProvider extends BaseLLMProvider {
  readonly type: LLMProviderType = "deepseek";
  readonly name = "DeepSeek";

  protected checkConfiguration(): boolean {
    return !!this.config.apiKey;
  }

  protected initializeModels(): LLMModel[] {
    return [
      {
        id: "deepseek-chat",
        name: "DeepSeek Chat",
        provider: "deepseek",
        maxContextTokens: 64000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        description: "General purpose chat model",
      },
      {
        id: "deepseek-coder",
        name: "DeepSeek Coder",
        provider: "deepseek",
        maxContextTokens: 128000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        description: "Optimized for coding tasks",
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek Reasoner",
        provider: "deepseek",
        maxContextTokens: 64000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        supportsThinking: true,
        description: "Advanced reasoning model (R1)",
      },
    ];
  }

  protected async doComplete(options: LLMRequestOptions): Promise<LLMResponse> {
    const request = this.buildRequest(options);
    request.stream = false;

    const response = await this.makeRequest(
      `${this.config.baseUrl || DEEPSEEK_API_URL}/chat/completions`,
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

    const data: DeepSeekResponse = await response.json();
    return this.parseResponse(data);
  }

  protected async *doStream(options: LLMRequestOptions): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const request = this.buildRequest(options);
    request.stream = true;

    const response = await this.makeRequest(
      `${this.config.baseUrl || DEEPSEEK_API_URL}/chat/completions`,
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
                console.warn("[DeepSeek] Failed to parse tool call arguments, using empty object");
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
            const chunk: DeepSeekStreamChunk = JSON.parse(data);
            const choice = chunk.choices[0];
            
            if (!choice) continue;

            // Handle regular content
            if (choice.delta.content) {
              yield { type: "text", content: choice.delta.content };
            }

            // Handle reasoning content (for deepseek-reasoner)
            if (choice.delta.reasoning_content) {
              yield { type: "text", content: choice.delta.reasoning_content };
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
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  private buildRequest(options: LLMRequestOptions): DeepSeekRequest {
    const messages = this.convertMessages(options.messages, options.systemPrompt);
    
    const request: DeepSeekRequest = {
      model: options.model,
      messages,
    };

    if (options.maxTokens) {
      request.max_tokens = options.maxTokens;
    }

    if (options.temperature !== undefined) {
      request.temperature = options.temperature;
    }

    if (options.topP !== undefined) {
      request.top_p = options.topP;
    }

    if (options.tools && options.tools.length > 0) {
      request.tools = this.convertTools(options.tools);
    }

    if (options.stopSequences && options.stopSequences.length > 0) {
      request.stop = options.stopSequences;
    }

    return request;
  }

  private convertMessages(messages: LLMMessage[], systemPrompt?: string): DeepSeekMessage[] {
    const result: DeepSeekMessage[] = [];

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

      const deepseekMsg: DeepSeekMessage = {
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      };

      if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
        deepseekMsg.content = msg.content || null;
        deepseekMsg.tool_calls = msg.toolCalls.map(tc => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }));
      }

      result.push(deepseekMsg);
    }

    return result;
  }

  private convertTools(tools: LLMToolDefinition[]): DeepSeekTool[] {
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

  private parseResponse(data: DeepSeekResponse): LLMResponse {
    const choice = data.choices[0];
    const message = choice.message;
    
    const toolCalls: LLMToolCall[] = [];
    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments || "{}");
        } catch {
          console.warn("[DeepSeek] Failed to parse tool call arguments, using empty object");
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
      cacheReadTokens: data.usage.prompt_cache_hit_tokens,
    };

    let finishReason: LLMResponse["finishReason"] = "stop";
    if (choice.finish_reason === "tool_calls") finishReason = "tool_use";
    else if (choice.finish_reason === "length") finishReason = "length";

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
        `${this.config.baseUrl || DEEPSEEK_API_URL}/models`,
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
