/**
 * Google AI Provider Implementation
 * Supports Gemini models with streaming and tool use
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

const GOOGLE_AI_API_URL = "https://generativelanguage.googleapis.com";

interface GoogleAIContent {
  role: "user" | "model";
  parts: GoogleAIPart[];
}

type GoogleAIPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: { content: string } } };

interface GoogleAITool {
  functionDeclarations: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  }[];
}

interface GoogleAIRequest {
  contents: GoogleAIContent[];
  systemInstruction?: { parts: { text: string }[] };
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };
  tools?: GoogleAITool[];
  toolConfig?: {
    functionCallingConfig: {
      mode: "AUTO" | "ANY" | "NONE";
    };
  };
}

interface GoogleAIResponse {
  candidates: {
    content: GoogleAIContent;
    finishReason: "STOP" | "MAX_TOKENS" | "SAFETY" | "RECITATION" | "OTHER";
    safetyRatings?: { category: string; probability: string }[];
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    cachedContentTokenCount?: number;
  };
}

export class GoogleAIProvider extends BaseLLMProvider {
  readonly type: LLMProviderType = "google";
  readonly name = "Google AI";

  protected checkConfiguration(): boolean {
    return !!this.config.apiKey;
  }

  protected initializeModels(): LLMModel[] {
    return [
      {
        id: "gemini-2.0-flash-exp",
        name: "Gemini 2.0 Flash",
        provider: "google",
        maxContextTokens: 1048576,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "Fast and capable experimental model",
      },
      {
        id: "gemini-2.0-flash-thinking-exp",
        name: "Gemini 2.0 Flash Thinking",
        provider: "google",
        maxContextTokens: 1048576,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsThinking: true,
        description: "Flash with enhanced reasoning",
      },
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        provider: "google",
        maxContextTokens: 2097152,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "Most capable Gemini model",
      },
      {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash",
        provider: "google",
        maxContextTokens: 1048576,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "Fast and efficient",
      },
      {
        id: "gemini-1.5-flash-8b",
        name: "Gemini 1.5 Flash 8B",
        provider: "google",
        maxContextTokens: 1048576,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        description: "Lightweight and fast",
      },
      {
        id: "gemini-1.0-pro",
        name: "Gemini 1.0 Pro",
        provider: "google",
        maxContextTokens: 30720,
        maxOutputTokens: 2048,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        description: "Previous generation model",
      },
    ];
  }

  protected async doComplete(options: LLMRequestOptions): Promise<LLMResponse> {
    const request = this.buildRequest(options);
    const url = `${this.config.baseUrl || GOOGLE_AI_API_URL}/v1beta/models/${options.model}:generateContent?key=${this.config.apiKey}`;

    const response = await this.makeRequest(url, {
      method: "POST",
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const body = await response.text();
      throw this.parseErrorResponse(response.status, body);
    }

    const data: GoogleAIResponse = await response.json();
    return this.parseResponse(data, options.model);
  }

  protected async *doStream(options: LLMRequestOptions): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const request = this.buildRequest(options);
    const url = `${this.config.baseUrl || GOOGLE_AI_API_URL}/v1beta/models/${options.model}:streamGenerateContent?alt=sse&key=${this.config.apiKey}`;

    const response = await this.makeRequest(url, {
      method: "POST",
      body: JSON.stringify(request),
    });

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
    let totalUsage: LLMUsage | null = null;

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
          if (!data) continue;

          try {
            const chunk: GoogleAIResponse = JSON.parse(data);
            
            for (const candidate of chunk.candidates || []) {
              for (const part of candidate.content?.parts || []) {
                if ("text" in part && part.text) {
                  yield { type: "text", content: part.text };
                }
                
                if ("functionCall" in part) {
                  const fc = part.functionCall;
                  const id = crypto.randomUUID();
                  yield {
                    type: "tool_call_start",
                    toolCall: { id, name: fc.name },
                  };
                  yield {
                    type: "tool_call_end",
                    toolCall: { id, name: fc.name, arguments: fc.args },
                  };
                }
              }
            }

            if (chunk.usageMetadata) {
              totalUsage = {
                inputTokens: chunk.usageMetadata.promptTokenCount || 0,
                outputTokens: chunk.usageMetadata.candidatesTokenCount || 0,
                totalTokens: chunk.usageMetadata.totalTokenCount || 0,
                cacheReadTokens: chunk.usageMetadata.cachedContentTokenCount,
              };
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      if (totalUsage) {
        yield { type: "usage", usage: totalUsage };
      }
      yield { type: "done" };
    } finally {
      reader.releaseLock();
    }
  }

  private buildRequest(options: LLMRequestOptions): GoogleAIRequest {
    const contents = this.convertMessages(options.messages);
    
    const request: GoogleAIRequest = {
      contents,
    };

    if (options.systemPrompt) {
      request.systemInstruction = {
        parts: [{ text: options.systemPrompt }],
      };
    }

    const generationConfig: GoogleAIRequest["generationConfig"] = {};

    if (options.maxTokens) {
      generationConfig.maxOutputTokens = options.maxTokens;
    }

    if (options.temperature !== undefined) {
      generationConfig.temperature = options.temperature;
    }

    if (options.topP !== undefined) {
      generationConfig.topP = options.topP;
    }

    if (options.stopSequences && options.stopSequences.length > 0) {
      generationConfig.stopSequences = options.stopSequences;
    }

    if (Object.keys(generationConfig).length > 0) {
      request.generationConfig = generationConfig;
    }

    if (options.tools && options.tools.length > 0) {
      request.tools = [this.convertTools(options.tools)];
      request.toolConfig = {
        functionCallingConfig: { mode: "AUTO" },
      };
    }

    return request;
  }

  private convertMessages(messages: LLMMessage[]): GoogleAIContent[] {
    const result: GoogleAIContent[] = [];

    for (const msg of messages) {
      if (msg.role === "system") continue; // System handled separately

      if (msg.role === "tool") {
        // Tool results should be added as function responses
        const lastUserContent = result[result.length - 1];
        if (lastUserContent && lastUserContent.role === "user") {
          lastUserContent.parts.push({
            functionResponse: {
              name: msg.toolCallId || "unknown",
              response: { content: msg.content },
            },
          });
        } else {
          result.push({
            role: "user",
            parts: [{
              functionResponse: {
                name: msg.toolCallId || "unknown",
                response: { content: msg.content },
              },
            }],
          });
        }
        continue;
      }

      const parts: GoogleAIPart[] = [];

      if (msg.content) {
        parts.push({ text: msg.content });
      }

      if (msg.role === "assistant" && msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          parts.push({
            functionCall: {
              name: tc.name,
              args: tc.arguments,
            },
          });
        }
      }

      const role = msg.role === "assistant" ? "model" : "user";
      result.push({ role, parts });
    }

    return result;
  }

  private convertTools(tools: LLMToolDefinition[]): GoogleAITool {
    return {
      functionDeclarations: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required,
        },
      })),
    };
  }

  private parseResponse(data: GoogleAIResponse, model: string): LLMResponse {
    const candidate = data.candidates[0];
    const content = candidate?.content;
    
    let textContent = "";
    const toolCalls: LLMToolCall[] = [];

    for (const part of content?.parts || []) {
      if ("text" in part && part.text) {
        textContent += part.text;
      }
      
      if ("functionCall" in part) {
        const fc = part.functionCall;
        toolCalls.push({
          id: crypto.randomUUID(),
          name: fc.name,
          arguments: fc.args,
        });
      }
    }

    const usage: LLMUsage = {
      inputTokens: data.usageMetadata?.promptTokenCount || 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
      cacheReadTokens: data.usageMetadata?.cachedContentTokenCount,
    };

    let finishReason: LLMResponse["finishReason"] = "stop";
    if (candidate?.finishReason === "MAX_TOKENS") finishReason = "length";
    else if (candidate?.finishReason === "SAFETY") finishReason = "error";
    else if (toolCalls.length > 0) finishReason = "tool_use";

    return {
      id: crypto.randomUUID(),
      content: textContent,
      role: "assistant",
      model,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
      finishReason,
    };
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const url = `${this.config.baseUrl || GOOGLE_AI_API_URL}/v1beta/models?key=${this.config.apiKey}`;
      const response = await this.makeRequest(url, { method: "GET" });
      return response.ok;
    } catch {
      return false;
    }
  }
}
