/**
 * Mistral Provider Implementation
 * Supports Mistral AI models with streaming and tool use
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

const MISTRAL_API_URL = "https://api.mistral.ai/v1";

interface MistralMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: MistralToolCall[];
  tool_call_id?: string;
}

interface MistralToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface MistralTool {
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

interface MistralRequest {
  model: string;
  messages: MistralMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: MistralTool[];
  tool_choice?: "auto" | "any" | "none";
  stop?: string[];
}

interface MistralResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: {
    index: number;
    message: MistralMessage;
    finish_reason: "stop" | "tool_calls" | "length" | "model_length";
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface MistralStreamChunk {
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
    finish_reason?: "stop" | "tool_calls" | "length" | "model_length";
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class MistralProvider extends BaseLLMProvider {
  readonly type: LLMProviderType = "mistral";
  readonly name = "Mistral AI";

  protected checkConfiguration(): boolean {
    return !!this.config.apiKey;
  }

  protected initializeModels(): LLMModel[] {
    return [
      {
        id: "mistral-large-latest",
        name: "Mistral Large",
        provider: "mistral",
        maxContextTokens: 128000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "Most capable Mistral model",
      },
      {
        id: "mistral-medium-latest",
        name: "Mistral Medium",
        provider: "mistral",
        maxContextTokens: 32000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        description: "Balanced performance",
      },
      {
        id: "mistral-small-latest",
        name: "Mistral Small",
        provider: "mistral",
        maxContextTokens: 32000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        description: "Fast and efficient",
      },
      {
        id: "codestral-latest",
        name: "Codestral",
        provider: "mistral",
        maxContextTokens: 32000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        description: "Optimized for code",
      },
      {
        id: "ministral-8b-latest",
        name: "Ministral 8B",
        provider: "mistral",
        maxContextTokens: 128000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        description: "Lightweight model",
      },
      {
        id: "ministral-3b-latest",
        name: "Ministral 3B",
        provider: "mistral",
        maxContextTokens: 128000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        description: "Ultra-lightweight model",
      },
      {
        id: "open-mistral-nemo",
        name: "Mistral Nemo",
        provider: "mistral",
        maxContextTokens: 128000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        description: "Open source flagship",
      },
      {
        id: "pixtral-12b-latest",
        name: "Pixtral 12B",
        provider: "mistral",
        maxContextTokens: 128000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "Vision-capable model",
      },
    ];
  }

  protected async doComplete(options: LLMRequestOptions): Promise<LLMResponse> {
    const request = this.buildRequest(options);
    request.stream = false;

    const response = await this.makeRequest(
      `${this.config.baseUrl || MISTRAL_API_URL}/chat/completions`,
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

    const data: MistralResponse = await response.json();
    return this.parseResponse(data);
  }

  protected async *doStream(options: LLMRequestOptions): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const request = this.buildRequest(options);
    request.stream = true;

    const response = await this.makeRequest(
      `${this.config.baseUrl || MISTRAL_API_URL}/chat/completions`,
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
                console.warn("[Mistral] Failed to parse tool call arguments, using empty object");
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
            const chunk: MistralStreamChunk = JSON.parse(data);
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
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  private buildRequest(options: LLMRequestOptions): MistralRequest {
    const messages = this.convertMessages(options.messages, options.systemPrompt);
    
    const request: MistralRequest = {
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
      request.tool_choice = "auto";
    }

    if (options.stopSequences && options.stopSequences.length > 0) {
      request.stop = options.stopSequences;
    }

    return request;
  }

  private convertMessages(messages: LLMMessage[], systemPrompt?: string): MistralMessage[] {
    const result: MistralMessage[] = [];

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

      const mistralMsg: MistralMessage = {
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      };

      if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
        mistralMsg.content = msg.content || null;
        mistralMsg.tool_calls = msg.toolCalls.map(tc => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }));
      }

      result.push(mistralMsg);
    }

    return result;
  }

  private convertTools(tools: LLMToolDefinition[]): MistralTool[] {
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

  private parseResponse(data: MistralResponse): LLMResponse {
    const choice = data.choices[0];
    const message = choice.message;
    
    const toolCalls: LLMToolCall[] = [];
    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments || "{}");
        } catch {
          console.warn("[Mistral] Failed to parse tool call arguments, using empty object");
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
    };

    let finishReason: LLMResponse["finishReason"] = "stop";
    if (choice.finish_reason === "tool_calls") finishReason = "tool_use";
    else if (choice.finish_reason === "length" || choice.finish_reason === "model_length") finishReason = "length";

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
        `${this.config.baseUrl || MISTRAL_API_URL}/models`,
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
