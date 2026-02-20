/**
 * Anthropic Provider Implementation
 * Supports Claude models with streaming and tool use
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

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: AnthropicTool[];
  stop_sequences?: string[];
}

interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

interface AnthropicStreamEvent {
  type: string;
  message?: AnthropicResponse;
  index?: number;
  content_block?: AnthropicContentBlock;
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export class AnthropicProvider extends BaseLLMProvider {
  readonly type: LLMProviderType = "anthropic";
  readonly name = "Anthropic";

  protected checkConfiguration(): boolean {
    return !!this.config.apiKey;
  }

  protected initializeModels(): LLMModel[] {
    return [
      {
        id: "claude-opus-4-5-latest",
        name: "Claude Opus 4.5",
        provider: "anthropic",
        maxContextTokens: 200000,
        maxOutputTokens: 32000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsThinking: true,
        description: "Most capable model with exceptional reasoning",
      },
      {
        id: "claude-sonnet-4-latest",
        name: "Claude Sonnet 4",
        provider: "anthropic",
        maxContextTokens: 200000,
        maxOutputTokens: 16000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsThinking: true,
        description: "Balanced performance and speed",
      },
      {
        id: "claude-opus-4-latest",
        name: "Claude Opus 4",
        provider: "anthropic",
        maxContextTokens: 200000,
        maxOutputTokens: 32000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "High capability for complex tasks",
      },
      {
        id: "claude-3-5-sonnet-latest",
        name: "Claude 3.5 Sonnet",
        provider: "anthropic",
        maxContextTokens: 200000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "Fast and intelligent",
      },
      {
        id: "claude-3-5-haiku-latest",
        name: "Claude 3.5 Haiku",
        provider: "anthropic",
        maxContextTokens: 200000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "Fastest model for quick tasks",
      },
      {
        id: "claude-3-opus-latest",
        name: "Claude 3 Opus",
        provider: "anthropic",
        maxContextTokens: 200000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "Previous generation flagship",
      },
    ];
  }

  protected async doComplete(options: LLMRequestOptions): Promise<LLMResponse> {
    const request = this.buildRequest(options);
    request.stream = false;

    const response = await this.makeRequest(
      `${this.config.baseUrl || ANTHROPIC_API_URL}/messages`,
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

    const data: AnthropicResponse = await response.json();
    return this.parseResponse(data);
  }

  protected async *doStream(options: LLMRequestOptions): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const request = this.buildRequest(options);
    request.stream = true;

    const response = await this.makeRequest(
      `${this.config.baseUrl || ANTHROPIC_API_URL}/messages`,
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
    let currentToolCall: Partial<LLMToolCall> | null = null;
    let toolCallJson = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          
          const data = line.slice(6);
          if (data === "[DONE]") {
            yield { type: "done" };
            continue;
          }

          try {
            const event: AnthropicStreamEvent = JSON.parse(data);
            const chunk = this.parseStreamEvent(event, currentToolCall, toolCallJson);
            
            if (chunk) {
              if (chunk.type === "tool_call_start" && chunk.toolCall) {
                currentToolCall = chunk.toolCall;
                toolCallJson = "";
              } else if (chunk.type === "tool_call_delta" && chunk.content) {
                toolCallJson += chunk.content;
              } else if (chunk.type === "tool_call_end" && currentToolCall) {
                try {
                  currentToolCall.arguments = JSON.parse(toolCallJson);
                } catch {
                  currentToolCall.arguments = {};
                }
                yield { type: "tool_call_end", toolCall: currentToolCall };
                currentToolCall = null;
                toolCallJson = "";
                continue;
              }
              yield chunk;
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
      "x-api-key": this.config.apiKey || "",
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-beta": "prompt-caching-2024-07-31",
    };
  }

  private buildRequest(options: LLMRequestOptions): AnthropicRequest {
    const messages = this.convertMessages(options.messages);
    
    const request: AnthropicRequest = {
      model: options.model,
      messages,
      max_tokens: options.maxTokens || 4096,
    };

    if (options.systemPrompt) {
      request.system = options.systemPrompt;
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
      request.stop_sequences = options.stopSequences;
    }

    return request;
  }

  private convertMessages(messages: LLMMessage[]): AnthropicMessage[] {
    const result: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === "system") continue; // System message handled separately

      if (msg.role === "tool") {
        // Tool results need to be part of user message
        const lastUserMsg = result[result.length - 1];
        if (lastUserMsg && lastUserMsg.role === "user") {
          if (typeof lastUserMsg.content === "string") {
            lastUserMsg.content = [{ type: "text", text: lastUserMsg.content }];
          }
          (lastUserMsg.content as AnthropicContentBlock[]).push({
            type: "tool_result",
            tool_use_id: msg.toolCallId,
            content: msg.content,
          });
        } else {
          result.push({
            role: "user",
            content: [{
              type: "tool_result",
              tool_use_id: msg.toolCallId,
              content: msg.content,
            }],
          });
        }
        continue;
      }

      const content: AnthropicContentBlock[] = [];

      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }

      if (msg.role === "assistant" && msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
      }

      result.push({
        role: msg.role as "user" | "assistant",
        content: content.length === 1 && content[0].type === "text" 
          ? content[0].text! 
          : content,
      });
    }

    return result;
  }

  private convertTools(tools: LLMToolDefinition[]): AnthropicTool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object",
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required,
      },
    }));
  }

  private parseResponse(data: AnthropicResponse): LLMResponse {
    let content = "";
    const toolCalls: LLMToolCall[] = [];

    for (const block of data.content) {
      if (block.type === "text" && block.text) {
        content += block.text;
      } else if (block.type === "tool_use" && block.id && block.name) {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input || {},
        });
      }
    }

    const usage: LLMUsage = {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      cacheReadTokens: data.usage.cache_read_input_tokens,
      cacheCreationTokens: data.usage.cache_creation_input_tokens,
    };

    let finishReason: LLMResponse["finishReason"] = "stop";
    if (data.stop_reason === "tool_use") finishReason = "tool_use";
    else if (data.stop_reason === "max_tokens") finishReason = "length";

    return {
      id: data.id,
      content,
      role: "assistant",
      model: data.model,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
      finishReason,
    };
  }

  private parseStreamEvent(
    event: AnthropicStreamEvent,
    currentToolCall: Partial<LLMToolCall> | null,
    _toolCallJson: string
  ): LLMStreamChunk | null {
    switch (event.type) {
      case "content_block_start":
        if (event.content_block?.type === "tool_use") {
          return {
            type: "tool_call_start",
            toolCall: {
              id: event.content_block.id,
              name: event.content_block.name,
            },
          };
        }
        return null;

      case "content_block_delta":
        if (event.delta?.type === "text_delta" && event.delta.text) {
          return { type: "text", content: event.delta.text };
        }
        if (event.delta?.type === "input_json_delta" && event.delta.partial_json) {
          return { type: "tool_call_delta", content: event.delta.partial_json };
        }
        return null;

      case "content_block_stop":
        if (currentToolCall) {
          return { type: "tool_call_end", toolCall: currentToolCall };
        }
        return null;

      case "message_delta":
        if (event.usage) {
          return {
            type: "usage",
            usage: {
              inputTokens: event.usage.input_tokens || 0,
              outputTokens: event.usage.output_tokens || 0,
              totalTokens: (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0),
            },
          };
        }
        return null;

      case "message_stop":
        return { type: "done" };

      default:
        return null;
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        `${this.config.baseUrl || ANTHROPIC_API_URL}/messages`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify({
            model: "claude-3-5-haiku-latest",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        }
      );
      return response.ok || response.status === 400; // 400 means valid key but bad request
    } catch {
      return false;
    }
  }
}
