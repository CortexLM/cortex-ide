/**
 * GitHub Copilot Provider
 * Handles OAuth authentication, completion requests, and chat integration
 */

// ============================================================================
// Types
// ============================================================================

export type CopilotStatus =
  | "disabled"
  | "starting"
  | "signedin"
  | "signedout"
  | "unauthorized"
  | "error";

export interface CopilotDeviceCodeResponse {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
  deviceCode: string;
}

export interface CopilotOAuthToken {
  accessToken: string;
  tokenType: string;
  scope: string;
  expiresAt: number;
}

export interface CopilotApiToken {
  token: string;
  expiresAt: number;
  endpoints: {
    api: string;
    proxy: string;
    "origin-tracker": string;
    telemetry: string;
  };
}

export interface CopilotCompletion {
  id: string;
  text: string;
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  confidence: number;
}

export interface CopilotCompletionRequest {
  content: string;
  language: string;
  filePath: string;
  position: {
    line: number;
    column: number;
  };
  prefix?: string;
  suffix?: string;
}

export interface CopilotChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CopilotChatRequest {
  model: string;
  messages: CopilotChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface CopilotChatResponse {
  id: string;
  model: string;
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface CopilotModel {
  id: string;
  name: string;
  vendor: string;
  isPremium: boolean;
  isChatDefault: boolean;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY_OAUTH_TOKEN = "cortex_copilot_oauth_token";
const STORAGE_KEY_API_TOKEN = "cortex_copilot_api_token";
const STORAGE_KEY_ENABLED = "cortex_copilot_enabled";

// ============================================================================
// GitHub OAuth Configuration
// ============================================================================

// GitHub Copilot OAuth App client ID (public)
const GITHUB_CLIENT_ID = "Iv1.b507a08c87ecfe98";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";

// ============================================================================
// Event Types
// ============================================================================

export type CopilotEventType =
  | "status-changed"
  | "device-code"
  | "signed-in"
  | "signed-out"
  | "completion"
  | "error";

export interface CopilotEvent {
  type: CopilotEventType;
  data?: unknown;
}

type EventCallback = (event: CopilotEvent) => void;

// ============================================================================
// Copilot Provider Class
// ============================================================================

export class CopilotProvider {
  private status: CopilotStatus = "disabled";
  private oauthToken: CopilotOAuthToken | null = null;
  private apiToken: CopilotApiToken | null = null;
  private enabled: boolean = false;
  private eventListeners: Map<CopilotEventType, Set<EventCallback>> = new Map();
  private completionIndex: number = 0;
  private cachedCompletions: CopilotCompletion[] = [];
  private currentCompletionRequest: AbortController | null = null;
  private tokenRefreshTimer: number | null = null;
  private pollInterval: number | null = null;
  private models: CopilotModel[] = [];

  constructor() {
    this.loadFromStorage();
    this.initializeStatus();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  private loadFromStorage(): void {
    try {
      const oauthJson = localStorage.getItem(STORAGE_KEY_OAUTH_TOKEN);
      if (oauthJson) {
        this.oauthToken = JSON.parse(oauthJson);
      }

      const apiJson = localStorage.getItem(STORAGE_KEY_API_TOKEN);
      if (apiJson) {
        this.apiToken = JSON.parse(apiJson);
      }

      const enabledStr = localStorage.getItem(STORAGE_KEY_ENABLED);
      this.enabled = enabledStr === "true";
    } catch (e) {
      console.error("[Copilot] Failed to load from storage:", e);
    }
  }

  private saveToStorage(): void {
    try {
      if (this.oauthToken) {
        localStorage.setItem(STORAGE_KEY_OAUTH_TOKEN, JSON.stringify(this.oauthToken));
      } else {
        localStorage.removeItem(STORAGE_KEY_OAUTH_TOKEN);
      }

      if (this.apiToken) {
        localStorage.setItem(STORAGE_KEY_API_TOKEN, JSON.stringify(this.apiToken));
      } else {
        localStorage.removeItem(STORAGE_KEY_API_TOKEN);
      }

      localStorage.setItem(STORAGE_KEY_ENABLED, String(this.enabled));
    } catch (e) {
      console.error("[Copilot] Failed to save to storage:", e);
    }
  }

  private async initializeStatus(): Promise<void> {
    if (!this.enabled) {
      this.setStatus("disabled");
      return;
    }

    this.setStatus("starting");

    if (this.oauthToken && this.isTokenValid(this.oauthToken.expiresAt)) {
      // Try to refresh API token
      const success = await this.refreshApiToken();
      if (success) {
        this.setStatus("signedin");
        this.startTokenRefreshTimer();
        this.emit({ type: "signed-in" });
      } else {
        this.setStatus("signedout");
      }
    } else {
      this.setStatus("signedout");
    }
  }

  // ============================================================================
  // Status Management
  // ============================================================================

  private setStatus(status: CopilotStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.emit({ type: "status-changed", data: status });
    }
  }

  public getStatus(): CopilotStatus {
    return this.status;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isSignedIn(): boolean {
    return this.status === "signedin";
  }

  // ============================================================================
  // Enable/Disable
  // ============================================================================

  public async enable(): Promise<void> {
    this.enabled = true;
    this.saveToStorage();
    await this.initializeStatus();
  }

  public disable(): void {
    this.enabled = false;
    this.stopTokenRefreshTimer();
    this.setStatus("disabled");
    this.saveToStorage();
  }

  // ============================================================================
  // OAuth Authentication Flow
  // ============================================================================

  public async initiateSignIn(): Promise<CopilotDeviceCodeResponse> {
    this.setStatus("starting");

    const response = await fetch(GITHUB_DEVICE_CODE_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        scope: "read:user",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.setStatus("error");
      throw new Error(`Failed to initiate device flow: ${error}`);
    }

    const data = await response.json();
    const deviceCode: CopilotDeviceCodeResponse = {
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      expiresIn: data.expires_in,
      interval: data.interval || 5,
      deviceCode: data.device_code,
    };

    this.emit({ type: "device-code", data: deviceCode });

    // Start polling for authorization
    this.startPolling(deviceCode);

    return deviceCode;
  }

  private startPolling(deviceCode: CopilotDeviceCodeResponse): void {
    this.stopPolling();

    const pollForToken = async () => {
      try {
        const response = await fetch(GITHUB_TOKEN_URL, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            device_code: deviceCode.deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          }),
        });

        const data = await response.json();

        if (data.error) {
          if (data.error === "authorization_pending") {
            // Continue polling
            return;
          } else if (data.error === "slow_down") {
            // Slow down polling
            this.stopPolling();
            this.pollInterval = window.setTimeout(
              () => this.startPolling(deviceCode),
              (deviceCode.interval + 5) * 1000
            );
            return;
          } else if (data.error === "expired_token") {
            this.stopPolling();
            this.setStatus("error");
            this.emit({ type: "error", data: "Device code expired" });
            return;
          } else if (data.error === "access_denied") {
            this.stopPolling();
            this.setStatus("unauthorized");
            this.emit({ type: "error", data: "Access denied" });
            return;
          } else {
            this.stopPolling();
            this.setStatus("error");
            this.emit({ type: "error", data: data.error_description || data.error });
            return;
          }
        }

        // Success - we have a token
        this.stopPolling();
        this.oauthToken = {
          accessToken: data.access_token,
          tokenType: data.token_type,
          scope: data.scope,
          // GitHub OAuth tokens don't expire, but we set a long expiry
          expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
        };
        this.saveToStorage();

        // Get Copilot API token
        const success = await this.refreshApiToken();
        if (success) {
          this.setStatus("signedin");
          this.startTokenRefreshTimer();
          this.emit({ type: "signed-in" });
          await this.fetchModels();
        } else {
          this.setStatus("unauthorized");
        }
      } catch (e) {
        console.error("[Copilot] Polling error:", e);
      }
    };

    // Poll every interval seconds
    this.pollInterval = window.setInterval(pollForToken, deviceCode.interval * 1000);
    // Also poll immediately
    pollForToken();
  }

  private stopPolling(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // ============================================================================
  // Token Management
  // ============================================================================

  private async refreshApiToken(): Promise<boolean> {
    if (!this.oauthToken) {
      return false;
    }

    try {
      const response = await fetch(COPILOT_TOKEN_URL, {
        method: "GET",
        headers: {
          "Authorization": `token ${this.oauthToken.accessToken}`,
          "Accept": "application/json",
          "Editor-Version": "Cortex/1.0.0",
          "Editor-Plugin-Version": "copilot/1.0.0",
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          this.setStatus("unauthorized");
          return false;
        }
        throw new Error(`Failed to get API token: ${response.status}`);
      }

      const data = await response.json();
      this.apiToken = {
        token: data.token,
        expiresAt: data.expires_at * 1000, // Convert to milliseconds
        endpoints: data.endpoints,
      };
      this.saveToStorage();
      return true;
    } catch (e) {
      console.error("[Copilot] Failed to refresh API token:", e);
      return false;
    }
  }

  private isTokenValid(expiresAt: number): boolean {
    // Token is valid if it expires more than 5 minutes from now
    return expiresAt > Date.now() + 5 * 60 * 1000;
  }

  private startTokenRefreshTimer(): void {
    this.stopTokenRefreshTimer();

    if (!this.apiToken) return;

    // Refresh 5 minutes before expiry
    const refreshIn = this.apiToken.expiresAt - Date.now() - 5 * 60 * 1000;
    if (refreshIn > 0) {
      this.tokenRefreshTimer = window.setTimeout(async () => {
        await this.refreshApiToken();
        this.startTokenRefreshTimer();
      }, refreshIn);
    } else {
      // Token is about to expire, refresh now
      this.refreshApiToken().then(() => this.startTokenRefreshTimer()).catch((err) => {
        console.error("Failed to refresh Copilot API token:", err);
      });
    }
  }

  private stopTokenRefreshTimer(): void {
    if (this.tokenRefreshTimer !== null) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  // ============================================================================
  // Sign Out
  // ============================================================================

  public async signOut(): Promise<void> {
    this.stopPolling();
    this.stopTokenRefreshTimer();
    this.oauthToken = null;
    this.apiToken = null;
    this.models = [];
    this.saveToStorage();
    this.setStatus("signedout");
    this.emit({ type: "signed-out" });
  }

  // ============================================================================
  // Models
  // ============================================================================

  private async fetchModels(): Promise<void> {
    if (!this.apiToken) return;

    try {
      const endpoint = this.apiToken.endpoints.api;
      const response = await fetch(`${endpoint}/models`, {
        headers: {
          "Authorization": `Bearer ${this.apiToken.token}`,
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      this.models = (data.data || []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        name: m.name as string,
        vendor: (m.vendor as string) || "unknown",
        isPremium: (m.billing as Record<string, unknown>)?.is_premium as boolean || false,
        isChatDefault: m.is_chat_default as boolean || false,
        supportsStreaming: (m.capabilities as Record<string, Record<string, boolean>>)?.supports?.streaming || false,
        supportsTools: (m.capabilities as Record<string, Record<string, boolean>>)?.supports?.tool_calls || false,
        supportsVision: (m.capabilities as Record<string, Record<string, boolean>>)?.supports?.vision || false,
        maxContextTokens: (m.capabilities as Record<string, Record<string, number>>)?.limits?.max_context_window_tokens || 4096,
        maxOutputTokens: (m.capabilities as Record<string, Record<string, number>>)?.limits?.max_output_tokens || 4096,
      }));
    } catch (e) {
      console.error("[Copilot] Failed to fetch models:", e);
    }
  }

  public getModels(): CopilotModel[] {
    return this.models;
  }

  public getDefaultModel(): CopilotModel | undefined {
    return this.models.find(m => m.isChatDefault) || this.models[0];
  }

  // ============================================================================
  // Completions
  // ============================================================================

  public async getCompletion(request: CopilotCompletionRequest): Promise<CopilotCompletion | null> {
    if (!this.isSignedIn() || !this.apiToken) {
      return null;
    }

    // Cancel any pending request
    this.cancelCompletion();

    this.currentCompletionRequest = new AbortController();

    try {
      const endpoint = this.apiToken.endpoints.api;
      
      // Build the prompt with context
      const lines = request.content.split("\n");
      const cursorLine = request.position.line - 1;
      const cursorCol = request.position.column - 1;
      
      // Get text before cursor
      const beforeLines = lines.slice(0, cursorLine);
      const currentLineBefore = lines[cursorLine]?.slice(0, cursorCol) || "";
      const prefix = beforeLines.join("\n") + (beforeLines.length > 0 ? "\n" : "") + currentLineBefore;
      
      // Get text after cursor
      const currentLineAfter = lines[cursorLine]?.slice(cursorCol) || "";
      const afterLines = lines.slice(cursorLine + 1);
      const suffix = currentLineAfter + (afterLines.length > 0 ? "\n" : "") + afterLines.join("\n");

      const response = await fetch(`${endpoint}/v1/engines/copilot-codex/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiToken.token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Editor-Version": "Cortex/1.0.0",
          "Editor-Plugin-Version": "copilot/1.0.0",
          "Openai-Organization": "github-copilot",
        },
        body: JSON.stringify({
          prompt: prefix,
          suffix: suffix,
          max_tokens: 500,
          temperature: 0,
          top_p: 1,
          n: 3,
          stop: ["\n\n", "\r\n\r\n"],
          stream: false,
          extra: {
            language: request.language,
            filename: request.filePath,
          },
        }),
        signal: this.currentCompletionRequest.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          await this.refreshApiToken();
        }
        throw new Error(`Completion request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        return null;
      }

      // Cache completions for cycling
      this.cachedCompletions = data.choices.map((choice: { text: string; index: number }, index: number) => ({
        id: `${data.id}-${index}`,
        text: choice.text,
        range: {
          startLine: request.position.line,
          startColumn: request.position.column,
          endLine: request.position.line,
          endColumn: request.position.column,
        },
        confidence: 1 - index * 0.1,
      }));
      this.completionIndex = 0;

      const completion = this.cachedCompletions[0];
      this.emit({ type: "completion", data: completion });
      return completion;
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        return null;
      }
      console.error("[Copilot] Completion error:", e);
      return null;
    } finally {
      this.currentCompletionRequest = null;
    }
  }

  public cancelCompletion(): void {
    if (this.currentCompletionRequest) {
      this.currentCompletionRequest.abort();
      this.currentCompletionRequest = null;
    }
  }

  public getNextCompletion(): CopilotCompletion | null {
    if (this.cachedCompletions.length === 0) {
      return null;
    }
    this.completionIndex = (this.completionIndex + 1) % this.cachedCompletions.length;
    return this.cachedCompletions[this.completionIndex];
  }

  public getPreviousCompletion(): CopilotCompletion | null {
    if (this.cachedCompletions.length === 0) {
      return null;
    }
    this.completionIndex = (this.completionIndex - 1 + this.cachedCompletions.length) % this.cachedCompletions.length;
    return this.cachedCompletions[this.completionIndex];
  }

  public clearCompletions(): void {
    this.cachedCompletions = [];
    this.completionIndex = 0;
  }

  public async acceptCompletion(completion: CopilotCompletion): Promise<void> {
    // Notify GitHub that the completion was accepted (for telemetry)
    if (!this.apiToken) return;

    try {
      const endpoint = this.apiToken.endpoints.api;
      await fetch(`${endpoint}/v1/engines/copilot-codex/acceptances`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiToken.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          completionUuid: completion.id,
        }),
      });
    } catch (e) {
      // Non-critical, ignore errors
    }

    this.clearCompletions();
  }

  public async rejectCompletion(completion: CopilotCompletion): Promise<void> {
    // Notify GitHub that the completion was rejected (for telemetry)
    if (!this.apiToken) return;

    try {
      const endpoint = this.apiToken.endpoints.api;
      await fetch(`${endpoint}/v1/engines/copilot-codex/rejections`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiToken.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          completionUuids: [completion.id],
        }),
      });
    } catch (e) {
      // Non-critical, ignore errors
    }

    this.clearCompletions();
  }

  // ============================================================================
  // Chat Integration
  // ============================================================================

  public async chat(request: CopilotChatRequest): Promise<CopilotChatResponse> {
    if (!this.isSignedIn() || !this.apiToken) {
      throw new Error("Not signed in to Copilot");
    }

    const endpoint = this.apiToken.endpoints.api;
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiToken.token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Editor-Version": "Cortex/1.0.0",
        "Editor-Plugin-Version": "copilot/1.0.0",
        "Copilot-Integration-Id": "vscode-chat",
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.1,
        max_tokens: request.maxTokens ?? 4096,
        stream: false,
        intent: true,
        n: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      model: data.model,
      content: data.choices?.[0]?.message?.content || "",
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  public async *chatStream(request: CopilotChatRequest): AsyncGenerator<string, void, unknown> {
    if (!this.isSignedIn() || !this.apiToken) {
      throw new Error("Not signed in to Copilot");
    }

    const endpoint = this.apiToken.endpoints.api;
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiToken.token}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "Editor-Version": "Cortex/1.0.0",
        "Editor-Plugin-Version": "copilot/1.0.0",
        "Copilot-Integration-Id": "vscode-chat",
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.1,
        max_tokens: request.maxTokens ?? 4096,
        stream: true,
        intent: true,
        n: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat stream request failed: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            return;
          }
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }

  // ============================================================================
  // Event System
  // ============================================================================

  public on(event: CopilotEventType, callback: EventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  private emit(event: CopilotEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(event);
        } catch (e) {
          console.error("[Copilot] Event listener error:", e);
        }
      }
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  public dispose(): void {
    this.stopPolling();
    this.stopTokenRefreshTimer();
    this.cancelCompletion();
    this.eventListeners.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let copilotInstance: CopilotProvider | null = null;

export function getCopilotProvider(): CopilotProvider {
  if (!copilotInstance) {
    copilotInstance = new CopilotProvider();
  }
  return copilotInstance;
}

export function disposeCopilotProvider(): void {
  if (copilotInstance) {
    copilotInstance?.dispose?.();
    copilotInstance = null;
  }
}
