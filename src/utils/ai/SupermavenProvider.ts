/**
 * Supermaven AI Provider
 * Real-time code completion using Supermaven's AI-powered suggestions
 * 
 * Based on the Supermaven protocol from zed/crates/supermaven
 */

// ============================================================================
// Types
// ============================================================================

export interface SupermavenConfig {
  apiKey: string;
  enabled: boolean;
  debounceMs: number;
  maxSuggestionLength: number;
}

export interface SupermavenCompletion {
  id: string;
  text: string;
  dedent: string;
  range: CompletionRange;
  timestamp: number;
}

export interface CompletionRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface CursorContext {
  path: string;
  content: string;
  language: string;
  line: number;
  column: number;
  offset: number;
}

export type SupermavenStatus = 
  | "disconnected"
  | "connecting"
  | "ready"
  | "needs_activation"
  | "error";

export interface SupermavenState {
  status: SupermavenStatus;
  activateUrl?: string;
  errorMessage?: string;
  serviceTier?: "free" | "pro" | "unknown";
  currentCompletion: SupermavenCompletion | null;
  isLoading: boolean;
}



// ============================================================================
// Completion State Manager
// ============================================================================

interface CompletionState {
  id: string;
  bufferId: string;
  prefixOffset: number;
  text: string;
  dedent: string;
  timestamp: number;
}

class CompletionStateManager {
  private states: Map<string, CompletionState> = new Map();
  private maxStates = 100;

  add(state: CompletionState): void {
    this.states.set(state.id, state);
    this.prune();
  }

  get(id: string): CompletionState | undefined {
    return this.states.get(id);
  }

  update(id: string, updates: Partial<CompletionState>): void {
    const state = this.states.get(id);
    if (state) {
      Object.assign(state, updates);
    }
  }

  clear(): void {
    this.states.clear();
  }

  findRelevantCompletion(
    bufferId: string,
    currentContent: string,
    currentOffset: number
  ): string | null {
    let bestCompletion: string | null = null;
    let bestLength = 0;

    for (const state of this.states.values()) {
      if (state.bufferId !== bufferId) continue;

      const completionText = state.text.startsWith(state.dedent)
        ? state.text.slice(state.dedent.length)
        : state.text;

      if (!completionText) continue;
      if (currentOffset < state.prefixOffset) continue;

      const textInsertedSinceRequest = currentContent.slice(
        state.prefixOffset,
        currentOffset
      );

      if (!completionText.startsWith(textInsertedSinceRequest)) continue;

      const trimmedCompletion = completionText.slice(textInsertedSinceRequest.length);
      
      if (trimmedCompletion.length > bestLength) {
        bestCompletion = trimmedCompletion;
        bestLength = trimmedCompletion.length;
      }
    }

    return bestCompletion;
  }

  private prune(): void {
    if (this.states.size > this.maxStates) {
      const sortedEntries = Array.from(this.states.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const toRemove = sortedEntries.slice(0, this.states.size - this.maxStates);
      for (const [id] of toRemove) {
        this.states.delete(id);
      }
    }
  }
}

// ============================================================================
// Supermaven Provider
// ============================================================================

export class SupermavenProvider {
  private config: SupermavenConfig = {
    apiKey: "",
    enabled: true,
    debounceMs: 150,
    maxSuggestionLength: 2000,
  };

  private state: SupermavenState = {
    status: "disconnected",
    currentCompletion: null,
    isLoading: false,
  };

  private stateListeners: Set<(state: SupermavenState) => void> = new Set();
  private completionListeners: Set<(completion: SupermavenCompletion | null) => void> = new Set();
  
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  private nextStateId = 0;
  private completionStates = new CompletionStateManager();
  private currentContext: CursorContext | null = null;
  
  private readonly API_URL = "https://api.supermaven.com/v1";

  // ============================================================================
  // Lifecycle
  // ============================================================================

  configure(config: Partial<SupermavenConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.apiKey && config.apiKey !== this.config.apiKey) {
      this.connect();
    }
  }

  getConfig(): SupermavenConfig {
    return { ...this.config };
  }

  getState(): SupermavenState {
    return { ...this.state };
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(): Promise<void> {
    if (!this.config.apiKey) {
      this.updateState({ status: "disconnected", errorMessage: "API key required" });
      return;
    }

    this.updateState({ status: "connecting" });
    this.disconnect();

    try {
      // Use HTTP-based completion API instead of WebSocket for broader compatibility
      const isValid = await this.validateApiKey();
      if (isValid) {
        this.updateState({ status: "ready" });
      } else {
        this.updateState({ 
          status: "needs_activation", 
          errorMessage: "Invalid API key or activation required" 
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      this.updateState({ status: "error", errorMessage: message });
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.completionStates.clear();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }

  private async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_URL}/auth/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.apiKey}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        this.updateState({ 
          serviceTier: data.tier === "pro" ? "pro" : "free" 
        });
        return true;
      }
      
      return response.status !== 401;
    } catch {
      // If validation endpoint fails, assume key might be valid
      return true;
    }
  }

  // ============================================================================
  // Completion API
  // ============================================================================

  async requestCompletion(context: CursorContext): Promise<void> {
    if (!this.config.enabled || this.state.status !== "ready") {
      return;
    }

    this.currentContext = context;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      await this.fetchCompletion(context);
    }, this.config.debounceMs);
  }

  private async fetchCompletion(context: CursorContext): Promise<void> {
    if (!this.config.apiKey) return;

    const stateId = String(this.nextStateId++);
    
    this.completionStates.add({
      id: stateId,
      bufferId: context.path,
      prefixOffset: context.offset,
      text: "",
      dedent: "",
      timestamp: Date.now(),
    });

    this.updateState({ isLoading: true });

    try {
      const response = await fetch(`${this.API_URL}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          file_path: context.path,
          content: context.content,
          language: this.mapLanguageId(context.language),
          cursor_offset: context.offset,
          cursor_line: context.line,
          cursor_column: context.column,
          max_tokens: 256,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.updateState({ 
            status: "needs_activation",
            isLoading: false,
          });
          return;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.completion) {
        const completionText = data.completion.text || data.completion;
        const dedentText = data.completion.dedent || "";

        this.completionStates.update(stateId, {
          text: completionText,
          dedent: dedentText,
        });

        // Only emit if context hasn't changed
        if (this.currentContext?.path === context.path &&
            this.currentContext?.offset === context.offset) {
          
          const finalText = completionText.startsWith(dedentText)
            ? completionText.slice(dedentText.length)
            : completionText;

          if (finalText.length > 0) {
            const completion: SupermavenCompletion = {
              id: stateId,
              text: finalText.slice(0, this.config.maxSuggestionLength),
              dedent: dedentText,
              range: {
                startLine: context.line,
                startColumn: context.column,
                endLine: context.line,
                endColumn: context.column,
              },
              timestamp: Date.now(),
            };

            this.updateState({ currentCompletion: completion, isLoading: false });
            this.notifyCompletionListeners(completion);
          } else {
            this.updateState({ currentCompletion: null, isLoading: false });
            this.notifyCompletionListeners(null);
          }
        }
      } else {
        this.updateState({ currentCompletion: null, isLoading: false });
        this.notifyCompletionListeners(null);
      }
    } catch (error) {
      console.error("[Supermaven] Completion error:", error);
      this.updateState({ isLoading: false });
      
      if (error instanceof Error && error.message.includes("401")) {
        this.updateState({ status: "needs_activation" });
      }
    }
  }

  /**
   * Cancel the current completion request
   */
  cancelCompletion(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    this.updateState({ currentCompletion: null, isLoading: false });
    this.notifyCompletionListeners(null);
  }

  /**
   * Get current completion if still relevant to the cursor position
   */
  getCompletion(
    bufferId: string,
    content: string,
    offset: number
  ): string | null {
    return this.completionStates.findRelevantCompletion(bufferId, content, offset);
  }

  /**
   * Accept the full completion
   */
  acceptCompletion(): SupermavenCompletion | null {
    const completion = this.state.currentCompletion;
    if (completion) {
      this.updateState({ currentCompletion: null });
      this.notifyCompletionListeners(null);
    }
    return completion;
  }

  /**
   * Accept partial completion (word by word or character by character)
   */
  acceptPartialCompletion(mode: "word" | "line" | "char" = "word"): string | null {
    const completion = this.state.currentCompletion;
    if (!completion || !completion.text) return null;

    let acceptedText: string;
    let remainingText: string;

    switch (mode) {
      case "word": {
        const wordMatch = completion.text.match(/^(\s*\S+\s*)/);
        if (wordMatch) {
          acceptedText = wordMatch[1];
          remainingText = completion.text.slice(acceptedText.length);
        } else {
          acceptedText = completion.text;
          remainingText = "";
        }
        break;
      }
      
      case "line": {
        const lineEnd = completion.text.indexOf("\n");
        if (lineEnd !== -1) {
          acceptedText = completion.text.slice(0, lineEnd + 1);
          remainingText = completion.text.slice(lineEnd + 1);
        } else {
          acceptedText = completion.text;
          remainingText = "";
        }
        break;
      }
      
      case "char": {
        acceptedText = completion.text[0] || "";
        remainingText = completion.text.slice(1);
        break;
      }
    }

    if (remainingText) {
      const updatedCompletion: SupermavenCompletion = {
        ...completion,
        text: remainingText,
        range: {
          ...completion.range,
          startColumn: completion.range.startColumn + acceptedText.length,
        },
      };
      this.updateState({ currentCompletion: updatedCompletion });
      this.notifyCompletionListeners(updatedCompletion);
    } else {
      this.updateState({ currentCompletion: null });
      this.notifyCompletionListeners(null);
    }

    return acceptedText;
  }

  /**
   * Dismiss/reject the current completion
   */
  dismissCompletion(): void {
    this.updateState({ currentCompletion: null });
    this.notifyCompletionListeners(null);
  }

  // ============================================================================
  // Account Management
  // ============================================================================

  async signOut(): Promise<void> {
    this.config.apiKey = "";
    this.disconnect();
    this.updateState({ 
      status: "disconnected",
      activateUrl: undefined,
      serviceTier: undefined,
    });
  }

  getActivationUrl(): string | undefined {
    return this.state.activateUrl || "https://supermaven.com/activate";
  }

  // ============================================================================
  // State Management
  // ============================================================================

  onStateChange(listener: (state: SupermavenState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onCompletion(listener: (completion: SupermavenCompletion | null) => void): () => void {
    this.completionListeners.add(listener);
    return () => this.completionListeners.delete(listener);
  }

  private updateState(updates: Partial<SupermavenState>): void {
    this.state = { ...this.state, ...updates };
    for (const listener of this.stateListeners) {
      listener(this.state);
    }
  }

  private notifyCompletionListeners(completion: SupermavenCompletion | null): void {
    for (const listener of this.completionListeners) {
      listener(completion);
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private mapLanguageId(language: string): string {
    const languageMap: Record<string, string> = {
      typescript: "typescript",
      javascript: "javascript",
      python: "python",
      rust: "rust",
      go: "go",
      java: "java",
      cpp: "cpp",
      c: "c",
      csharp: "csharp",
      ruby: "ruby",
      php: "php",
      swift: "swift",
      kotlin: "kotlin",
      scala: "scala",
      html: "html",
      css: "css",
      json: "json",
      yaml: "yaml",
      markdown: "markdown",
      sql: "sql",
      shell: "bash",
      dockerfile: "dockerfile",
    };
    
    return languageMap[language] || language;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: SupermavenProvider | null = null;

export function getSupermaven(): SupermavenProvider {
  if (!instance) {
    instance = new SupermavenProvider();
  }
  return instance;
}

export function resetSupermaven(): void {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}
