/**
 * Monaco Inline Completions Provider (Ghost Text)
 *
 * Provides AI-powered inline code completions similar to GitHub Copilot.
 * Features:
 * - Ghost text completions from multiple AI providers
 * - Tab to accept full completion
 * - Ctrl+Right to accept word-by-word
 * - Escape to dismiss
 * - Alt+] and Alt+[ to cycle through alternatives
 * - Partial accept (first line, etc.)
 * - Context-aware suggestions using surrounding code
 * - Caching for repeated patterns
 * - Fallback chain between providers
 */

import type * as Monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { CopilotProvider, getCopilotProvider } from "@/utils/ai/CopilotProvider";
import { SupermavenProvider, getSupermaven } from "@/utils/ai/SupermavenProvider";
import type { LLMProvider, LLMRequestOptions } from "@/utils/llm/types";
import { createProvider } from "@/utils/llm";

// ============================================================================
// Types
// ============================================================================

/** Inline suggestion provider type */
export type InlineProviderType = "copilot" | "supermaven" | "openai" | "anthropic" | "backend" | "auto";

/** Inline completion settings */
export interface InlineCompletionSettings {
  /** Enable inline suggestions */
  enabled: boolean;
  /** Show inline suggestion toolbar on hover */
  showToolbar: boolean;
  /** Suppress standard suggestions when inline suggestion is shown */
  suppressSuggestions: boolean;
  /** Provider to use for completions */
  provider: InlineProviderType;
  /** Debounce delay in milliseconds */
  debounceMs: number;
  /** Maximum completion length in characters */
  maxCompletionLength: number;
  /** Number of context lines to send before cursor */
  contextLinesBefore: number;
  /** Number of context lines to send after cursor */
  contextLinesAfter: number;
  /** Enable caching of completions */
  enableCache: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  /** LLM model to use (for openai/anthropic providers) */
  model?: string;
  /** LLM API key (for openai/anthropic providers) */
  apiKey?: string;
}

/** Internal inline completion with metadata */
interface InlineCompletionItem {
  /** Unique identifier */
  id: string;
  /** Completion text */
  text: string;
  /** Range to replace */
  range: Monaco.Range;
  /** Source provider */
  source: InlineProviderType;
  /** Confidence score (0-1) */
  confidence: number;
  /** Timestamp when created */
  timestamp: number;
  /** Filter text for matching */
  filterText?: string;
}

/** Cache entry for completions */
interface CacheEntry {
  /** Cached completions */
  completions: InlineCompletionItem[];
  /** Cache timestamp */
  timestamp: number;
  /** Content hash when cached */
  contentHash: string;
}

/** Provider status for UI */
export interface InlineProviderStatus {
  /** Current provider */
  provider: InlineProviderType;
  /** Provider is active/connected */
  isActive: boolean;
  /** Currently loading completion */
  isLoading: boolean;
  /** Error message if any */
  error?: string;
  /** Number of completions available */
  completionCount: number;
  /** Current completion index */
  currentIndex: number;
}

/** Event types for inline completions */
export type InlineCompletionEventType =
  | "status-changed"
  | "completion-shown"
  | "completion-accepted"
  | "completion-dismissed"
  | "provider-changed"
  | "error";

export interface InlineCompletionEvent {
  type: InlineCompletionEventType;
  data?: unknown;
}

type EventCallback = (event: InlineCompletionEvent) => void;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SETTINGS: InlineCompletionSettings = {
  enabled: true,
  showToolbar: true,
  suppressSuggestions: false,
  provider: "auto",
  debounceMs: 300,
  maxCompletionLength: 2000,
  contextLinesBefore: 50,
  contextLinesAfter: 10,
  enableCache: true,
  cacheTtlMs: 30000, // 30 seconds
};

/** System prompt for LLM-based completions */
const COMPLETION_SYSTEM_PROMPT = `You are an AI code completion assistant. Your task is to complete the code at the cursor position.

Rules:
1. Only output the completion text, nothing else
2. Do not include explanations or comments about the completion
3. Complete in a way that follows the existing code style
4. Consider the context before and after the cursor
5. Keep completions concise and relevant
6. Complete partial statements, functions, or expressions
7. If no reasonable completion exists, output nothing`;

// ============================================================================
// Utility Functions
// ============================================================================

/** Generate a simple content hash for caching */
function hashContent(content: string, line: number, column: number): string {
  // Simple hash for cache key
  const key = `${content.slice(Math.max(0, content.length - 500))}:${line}:${column}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/** Generate unique ID */
function generateId(): string {
  return `ic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/** Extract word at cursor position (reserved for future use) */
function _getWordAtPosition(content: string, offset: number): string {
  const before = content.slice(0, offset);
  const after = content.slice(offset);
  
  const wordBefore = before.match(/[\w$]+$/)?.[0] || "";
  const wordAfter = after.match(/^[\w$]+/)?.[0] || "";
  
  return wordBefore + wordAfter;
}
void _getWordAtPosition; // Prevent unused warning

/** Get the first word from a completion */
function getFirstWord(text: string): string {
  const match = text.match(/^(\s*\S+\s*)/);
  return match ? match[1] : text;
}

/** Get the first line from a completion */
function getFirstLine(text: string): string {
  const newlineIndex = text.indexOf("\n");
  return newlineIndex === -1 ? text : text.slice(0, newlineIndex + 1);
}

// ============================================================================
// Inline Completions Provider Class
// ============================================================================

/**
 * Main inline completions provider that integrates with Monaco and AI providers
 */
export class InlineCompletionsProvider {
  private monaco: typeof Monaco | null = null;
  private settings: InlineCompletionSettings = { ...DEFAULT_SETTINGS };
  private status: InlineProviderStatus = {
    provider: "auto",
    isActive: false,
    isLoading: false,
    completionCount: 0,
    currentIndex: 0,
  };

  // Providers
  private copilot: CopilotProvider | null = null;
  private supermaven: SupermavenProvider | null = null;
  private llmProvider: LLMProvider | null = null;

  // State
  private currentCompletions: InlineCompletionItem[] = [];
  private currentIndex: number = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;
  private cache: Map<string, CacheEntry> = new Map();
  private eventListeners: Map<InlineCompletionEventType, Set<EventCallback>> = new Map();

  // Monaco integration
  private providerDisposable: Monaco.IDisposable | null = null;
  private commandDisposables: Monaco.IDisposable[] = [];

  // Backend streaming state
  private streamUnlisten: UnlistenFn | null = null;
  private pendingStreamResolve: ((text: string) => void) | null = null;
  private streamAccumulator: string = "";

  constructor() {
    // Initialize providers lazily
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Configure the inline completions provider
   */
  configure(settings: Partial<InlineCompletionSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.updateProviderStatus();
    this.emit({ type: "status-changed", data: this.status });
  }

  /**
   * Get current settings
   */
  getSettings(): InlineCompletionSettings {
    return { ...this.settings };
  }

  /**
   * Get current status
   */
  getStatus(): InlineProviderStatus {
    return { ...this.status };
  }

  // ============================================================================
  // Provider Management
  // ============================================================================

  /**
   * Initialize providers based on settings
   */
  private async initializeProviders(): Promise<void> {
    // Initialize Copilot if available
    try {
      this.copilot = getCopilotProvider();
    } catch (e) {
      console.debug("[InlineCompletions] Copilot not available:", e);
    }

    // Initialize Supermaven if available
    try {
      this.supermaven = getSupermaven();
    } catch (e) {
      console.debug("[InlineCompletions] Supermaven not available:", e);
    }

    // Initialize LLM provider if configured
    if (this.settings.provider === "openai" || this.settings.provider === "anthropic") {
      try {
        this.llmProvider = createProvider(this.settings.provider, {
          apiKey: this.settings.apiKey,
          defaultModel: this.settings.model,
        });
      } catch (e) {
        console.debug(`[InlineCompletions] ${this.settings.provider} not available:`, e);
      }
    }

    this.updateProviderStatus();
  }

  /**
   * Update provider status based on current configuration
   */
  private updateProviderStatus(): void {
    const provider = this.settings.provider;
    let isActive = false;

    if (provider === "auto") {
      // Auto mode - check what's available (backend always available)
      isActive = true;
    } else if (provider === "backend") {
      isActive = true;
    } else if (provider === "copilot") {
      isActive = this.copilot?.isSignedIn() ?? false;
    } else if (provider === "supermaven") {
      isActive = this.supermaven?.getState().status === "ready";
    } else {
      isActive = this.llmProvider?.isConfigured ?? false;
    }

    this.status = {
      ...this.status,
      provider,
      isActive: this.settings.enabled && isActive,
      completionCount: this.currentCompletions.length,
      currentIndex: this.currentIndex,
    };
  }

  /**
   * Get the active provider for completions
   */
  private getActiveProvider(): InlineProviderType | null {
    if (!this.settings.enabled) return null;

    const provider = this.settings.provider;

    if (provider === "auto") {
      // Priority: Copilot > Supermaven > Backend (Rust)
      if (this.copilot?.isSignedIn()) return "copilot";
      if (this.supermaven?.getState().status === "ready") return "supermaven";
      // Fall through to backend provider (always available)
      return "backend";
    }

    // Specific provider requested
    if (provider === "backend") return "backend";
    if (provider === "copilot" && this.copilot?.isSignedIn()) return "copilot";
    if (provider === "supermaven" && this.supermaven?.getState().status === "ready") return "supermaven";
    if ((provider === "openai" || provider === "anthropic") && this.llmProvider?.isConfigured) {
      return provider;
    }

    return "backend";
  }

  // ============================================================================
  // Monaco Integration
  // ============================================================================

  /**
   * Register the inline completions provider with Monaco
   */
  register(monaco: typeof Monaco): Monaco.IDisposable {
    this.monaco = monaco;

    // Initialize providers
    this.initializeProviders();

    // Register the inline completions provider for all languages
    this.providerDisposable = monaco.languages.registerInlineCompletionsProvider(
      { pattern: "**/*" }, // All languages
      {
        provideInlineCompletions: async (
          model: Monaco.editor.ITextModel,
          position: Monaco.Position,
          context: Monaco.languages.InlineCompletionContext,
          token: Monaco.CancellationToken
        ): Promise<Monaco.languages.InlineCompletions | null> => {
          return this.provideInlineCompletions(model, position, context, token);
        },

        disposeInlineCompletions: (
          _completions: Monaco.languages.InlineCompletions,
          _reason: unknown
        ): void => {
          // Cleanup completed - nothing to do for our implementation
        },

        handleItemDidShow: (
          _completions: Monaco.languages.InlineCompletions,
          item: Monaco.languages.InlineCompletion,
          _updatedInsertText: string,
          _editDeltaInfo: unknown
        ): void => {
          this.emit({ type: "completion-shown", data: item });
        },
      }
    );

    // Register keyboard commands
    this.registerCommands(monaco);

    return {
      dispose: () => this.dispose(),
    };
  }

  /**
   * Register keyboard commands for inline completions
   * Note: Commands are registered globally and need an active editor from context
   */
  private registerCommands(monaco: typeof Monaco): void {
    // We'll use a different approach - store the last active editor
    // Commands will be bound to editor actions in the hook/component layer
    
    // Register command stubs that will be invoked by keybindings
    this.commandDisposables.push(
      monaco.editor.registerCommand("orion.inlineCompletion.acceptWord", () => {
        // This will be handled by editor action keybindings
        console.debug("[InlineCompletions] acceptWord command invoked");
      })
    );

    this.commandDisposables.push(
      monaco.editor.registerCommand("orion.inlineCompletion.acceptLine", () => {
        console.debug("[InlineCompletions] acceptLine command invoked");
      })
    );

    this.commandDisposables.push(
      monaco.editor.registerCommand("orion.inlineCompletion.next", () => {
        this.cycleCompletion(1);
      })
    );

    this.commandDisposables.push(
      monaco.editor.registerCommand("orion.inlineCompletion.previous", () => {
        this.cycleCompletion(-1);
      })
    );

    this.commandDisposables.push(
      monaco.editor.registerCommand("orion.inlineCompletion.trigger", () => {
        console.debug("[InlineCompletions] trigger command invoked");
      })
    );
  }

  /**
   * Main completion provider implementation
   */
  private async provideInlineCompletions(
    model: Monaco.editor.ITextModel,
    position: Monaco.Position,
    _context: Monaco.languages.InlineCompletionContext,
    token: Monaco.CancellationToken
  ): Promise<Monaco.languages.InlineCompletions | null> {
    if (!this.settings.enabled || !this.monaco) {
      return null;
    }

    const activeProvider = this.getActiveProvider();
    if (!activeProvider) {
      return null;
    }

    // Check cache first
    const content = model.getValue();
    const cacheKey = hashContent(content, position.lineNumber, position.column);
    
    if (this.settings.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.settings.cacheTtlMs) {
        this.currentCompletions = cached.completions;
        this.currentIndex = 0;
        this.updateProviderStatus();
        return this.formatCompletions(cached.completions);
      }
    }

    // Debounce new requests
    return new Promise((resolve) => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(async () => {
        if (token.isCancellationRequested) {
          resolve(null);
          return;
        }

        // Cancel any pending request
        if (this.abortController) {
          this.abortController.abort();
        }
        this.abortController = new AbortController();

        this.status.isLoading = true;
        this.emit({ type: "status-changed", data: this.status });

        try {
          const completions = await this.fetchCompletions(
            model,
            position,
            activeProvider,
            token
          );

          if (token.isCancellationRequested) {
            resolve(null);
            return;
          }

          this.currentCompletions = completions;
          this.currentIndex = 0;

          // Cache the results
          if (this.settings.enableCache && completions.length > 0) {
            this.cache.set(cacheKey, {
              completions,
              timestamp: Date.now(),
              contentHash: cacheKey,
            });

            // Prune old cache entries
            this.pruneCache();
          }

          this.status.isLoading = false;
          this.updateProviderStatus();
          this.emit({ type: "status-changed", data: this.status });

          resolve(this.formatCompletions(completions));
        } catch (error) {
          this.status.isLoading = false;
          this.status.error = error instanceof Error ? error.message : "Unknown error";
          this.emit({ type: "error", data: error });
          this.emit({ type: "status-changed", data: this.status });
          resolve(null);
        }
      }, this.settings.debounceMs);
    });
  }

  /**
   * Fetch completions from the active provider
   */
  private async fetchCompletions(
    model: Monaco.editor.ITextModel,
    position: Monaco.Position,
    provider: InlineProviderType,
    _token: Monaco.CancellationToken
  ): Promise<InlineCompletionItem[]> {
    const content = model.getValue();
    const offset = model.getOffsetAt(position);
    const languageId = model.getLanguageId();
    const filePath = model.uri.path;

    // Build context
    const lines = content.split("\n");
    const cursorLine = position.lineNumber - 1;
    const linesBefore = Math.max(0, cursorLine - this.settings.contextLinesBefore);
    const linesAfter = Math.min(lines.length, cursorLine + this.settings.contextLinesAfter + 1);

    const prefix = lines.slice(linesBefore, cursorLine + 1).join("\n");
    const currentLine = lines[cursorLine] || "";
    const currentLineBefore = currentLine.slice(0, position.column - 1);
    const suffix = lines.slice(cursorLine + 1, linesAfter).join("\n");

    const completions: InlineCompletionItem[] = [];

    switch (provider) {
      case "copilot": {
        if (this.copilot) {
          const result = await this.copilot.getCompletion({
            content,
            language: languageId,
            filePath,
            position: { line: position.lineNumber, column: position.column },
            prefix: currentLineBefore,
            suffix: suffix,
          });

          if (result && result.text) {
            completions.push({
              id: result.id,
              text: result.text.slice(0, this.settings.maxCompletionLength),
              range: new this.monaco!.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
              source: "copilot",
              confidence: result.confidence,
              timestamp: Date.now(),
            });

            // Get alternative completions
            let next = this.copilot.getNextCompletion();
            while (next && completions.length < 3) {
              completions.push({
                id: next.id,
                text: next.text.slice(0, this.settings.maxCompletionLength),
                range: new this.monaco!.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column
                ),
                source: "copilot",
                confidence: next.confidence,
                timestamp: Date.now(),
              });
              next = this.copilot.getNextCompletion();
            }
          }
        }
        break;
      }

      case "supermaven": {
        if (this.supermaven) {
          await this.supermaven.requestCompletion({
            path: filePath,
            content,
            language: languageId,
            line: position.lineNumber,
            column: position.column,
            offset,
          });

          // Wait for completion (Supermaven uses async callback)
          const completion = await new Promise<string | null>((resolve) => {
            const timeout = setTimeout(() => resolve(null), 5000);
            const unsubscribe = this.supermaven!.onCompletion((comp) => {
              clearTimeout(timeout);
              unsubscribe();
              resolve(comp?.text || null);
            });
          });

          if (completion) {
            completions.push({
              id: generateId(),
              text: completion.slice(0, this.settings.maxCompletionLength),
              range: new this.monaco!.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
              source: "supermaven",
              confidence: 0.8,
              timestamp: Date.now(),
            });
          }
        }
        break;
      }

      case "openai":
      case "anthropic": {
        if (this.llmProvider) {
          const result = await this.fetchLLMCompletion(
            prefix,
            currentLineBefore,
            suffix,
            languageId,
            position
          );

          if (result) {
            completions.push({
              id: generateId(),
              text: result.slice(0, this.settings.maxCompletionLength),
              range: new this.monaco!.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
              source: provider,
              confidence: 0.7,
              timestamp: Date.now(),
            });
          }
        }
        break;
      }

      case "backend": {
        const backendResults = await this.fetchBackendCompletion(
          content,
          filePath,
          languageId,
          position
        );

        for (const result of backendResults) {
          completions.push({
            id: result.id,
            text: result.text.slice(0, this.settings.maxCompletionLength),
            range: new this.monaco!.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column
            ),
            source: "backend",
            confidence: result.confidence,
            timestamp: Date.now(),
          });
        }
        break;
      }
    }

    return completions;
  }

  /**
   * Fetch completion from LLM provider
   */
  private async fetchLLMCompletion(
    prefix: string,
    currentLine: string,
    suffix: string,
    languageId: string,
    _position: Monaco.Position
  ): Promise<string | null> {
    if (!this.llmProvider) return null;

    const prompt = `Complete the following ${languageId} code at the cursor position (marked with <CURSOR>):

\`\`\`${languageId}
${prefix}${currentLine}<CURSOR>${suffix ? `\n${suffix}` : ""}
\`\`\`

Completion (output only the code to insert, nothing else):`;

    try {
      const options: LLMRequestOptions = {
        model: this.settings.model || this.llmProvider.getDefaultModel().id,
        messages: [{ role: "user", content: prompt }],
        systemPrompt: COMPLETION_SYSTEM_PROMPT,
        maxTokens: 256,
        temperature: 0.1,
        stopSequences: ["\n\n", "```"],
      };

      const response = await this.llmProvider.complete(options);
      
      // Clean up the response
      let completion = response.content.trim();
      
      // Remove markdown code blocks if present
      if (completion.startsWith("```")) {
        completion = completion.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
      }

      // Remove leading/trailing quotes
      if ((completion.startsWith('"') && completion.endsWith('"')) ||
          (completion.startsWith("'") && completion.endsWith("'"))) {
        completion = completion.slice(1, -1);
      }

      return completion || null;
    } catch (error) {
      console.error("[InlineCompletions] LLM completion error:", error);
      return null;
    }
  }

  /**
   * Fetch completion from the Rust backend via Tauri IPC
   */
  private async fetchBackendCompletion(
    content: string,
    filePath: string,
    languageId: string,
    position: Monaco.Position
  ): Promise<Array<{ id: string; text: string; confidence: number }>> {
    const requestId = generateId();

    try {
      // Set up streaming listener
      this.streamAccumulator = "";
      if (!this.streamUnlisten) {
        this.streamUnlisten = await listen<{
          requestId: string;
          delta: string;
          done: boolean;
        }>("ai:completion_stream", (event) => {
          if (event.payload.requestId === requestId) {
            this.streamAccumulator += event.payload.delta;
            if (event.payload.done && this.pendingStreamResolve) {
              this.pendingStreamResolve(this.streamAccumulator);
              this.pendingStreamResolve = null;
            }
          }
        });
      }

      const results = await invoke<Array<{
        id: string;
        requestId: string;
        text: string;
        provider: string;
        confidence: number;
      }>>("request_inline_completion", {
        request: {
          requestId,
          filePath,
          content,
          language: languageId,
          line: position.lineNumber,
          column: position.column,
          provider: null,
          maxTokens: 256,
        },
      });

      return results.map((r) => ({
        id: r.id,
        text: r.text,
        confidence: r.confidence,
      }));
    } catch (error) {
      console.debug("[InlineCompletions] Backend completion error:", error);
      return [];
    }
  }

  /**
   * Notify backend that a completion was accepted
   */
  async notifyAccepted(completionId: string): Promise<void> {
    try {
      await invoke("accept_completion", { completionId });
    } catch (e) {
      console.debug("[InlineCompletions] Failed to notify accept:", e);
    }
  }

  /**
   * Notify backend that a completion was rejected
   */
  async notifyRejected(completionId: string): Promise<void> {
    try {
      await invoke("reject_completion", { completionId });
    } catch (e) {
      console.debug("[InlineCompletions] Failed to notify reject:", e);
    }
  }

  /**
   * Cancel an in-flight backend completion request
   */
  async cancelBackendRequest(requestId: string): Promise<void> {
    try {
      await invoke("cancel_completion", { requestId });
    } catch (e) {
      console.debug("[InlineCompletions] Failed to cancel request:", e);
    }
  }

  /**
   * Format completions for Monaco
   */
  private formatCompletions(
    completions: InlineCompletionItem[]
  ): Monaco.languages.InlineCompletions | null {
    if (!this.monaco || completions.length === 0) {
      return null;
    }

    return {
      items: completions.map((comp) => ({
        insertText: comp.text,
        range: comp.range,
        filterText: comp.filterText,
        command: {
          id: "orion.inlineCompletion.accepted",
          title: "Completion Accepted",
          arguments: [comp.id, comp.source],
        },
      })),
      enableForwardStability: true,
    };
  }

  // ============================================================================
  // Completion Actions
  // ============================================================================

  /**
   * Accept the next word from the current completion
   */
  acceptWord(editor: Monaco.editor.IStandaloneCodeEditor): void {
    const completion = this.currentCompletions[this.currentIndex];
    if (!completion || !this.monaco) return;

    const word = getFirstWord(completion.text);
    if (!word) return;

    const position = editor.getPosition();
    if (!position) return;

    // Insert the word
    editor.executeEdits("inline-completion", [{
      range: new this.monaco.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column
      ),
      text: word,
    }]);

    // Update the completion with remaining text
    const remaining = completion.text.slice(word.length);
    if (remaining) {
      completion.text = remaining;
      completion.range = new this.monaco.Range(
        position.lineNumber,
        position.column + word.length,
        position.lineNumber,
        position.column + word.length
      );
    } else {
      // Completion fully accepted
      this.currentCompletions.splice(this.currentIndex, 1);
      if (this.currentIndex >= this.currentCompletions.length) {
        this.currentIndex = 0;
      }
    }

    this.updateProviderStatus();
    this.emit({ type: "completion-accepted", data: { type: "word", text: word } });
  }

  /**
   * Accept the first line from the current completion
   */
  acceptLine(editor: Monaco.editor.IStandaloneCodeEditor): void {
    const completion = this.currentCompletions[this.currentIndex];
    if (!completion || !this.monaco) return;

    const line = getFirstLine(completion.text);
    if (!line) return;

    const position = editor.getPosition();
    if (!position) return;

    // Insert the line
    editor.executeEdits("inline-completion", [{
      range: new this.monaco.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column
      ),
      text: line,
    }]);

    // Update the completion with remaining text
    const remaining = completion.text.slice(line.length);
    if (remaining) {
      const newPosition = editor.getPosition();
      if (newPosition) {
        completion.text = remaining;
        completion.range = new this.monaco.Range(
          newPosition.lineNumber,
          newPosition.column,
          newPosition.lineNumber,
          newPosition.column
        );
      }
    } else {
      // Completion fully accepted
      this.currentCompletions.splice(this.currentIndex, 1);
      if (this.currentIndex >= this.currentCompletions.length) {
        this.currentIndex = 0;
      }
    }

    this.updateProviderStatus();
    this.emit({ type: "completion-accepted", data: { type: "line", text: line } });
  }

  /**
   * Cycle through available completions
   */
  cycleCompletion(direction: 1 | -1): void {
    if (this.currentCompletions.length <= 1) return;

    this.currentIndex = (this.currentIndex + direction + this.currentCompletions.length) % this.currentCompletions.length;
    this.updateProviderStatus();
    this.emit({ type: "status-changed", data: this.status });

    // Trigger Monaco to re-render inline completions
    // This is handled by Monaco's internal state
  }

  /**
   * Manually trigger completion
   */
  async triggerCompletion(editor: Monaco.editor.IStandaloneCodeEditor): Promise<void> {
    if (!this.monaco) return;

    // Clear cache to force a fresh completion
    this.cache.clear();

    // Trigger inline completions
    editor.trigger("inline-completion", "editor.action.inlineSuggest.trigger", {});
  }

  /**
   * Dismiss current completions
   */
  dismiss(): void {
    this.currentCompletions = [];
    this.currentIndex = 0;
    this.updateProviderStatus();
    this.emit({ type: "completion-dismissed" });
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Prune old cache entries
   */
  private pruneCache(): void {
    const now = Date.now();
    const maxEntries = 100;

    // Remove expired entries
    const cacheEntries = Array.from(this.cache.entries());
    for (const [key, entry] of cacheEntries) {
      if (now - entry.timestamp > this.settings.cacheTtlMs) {
        this.cache.delete(key);
      }
    }

    // Remove oldest entries if cache is too large
    if (this.cache.size > maxEntries) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.cache.size - maxEntries);
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached completions
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ============================================================================
  // Event System
  // ============================================================================

  /**
   * Subscribe to events
   */
  on(event: InlineCompletionEventType, callback: EventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit an event
   */
  private emit(event: InlineCompletionEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      const callbackList = Array.from(listeners);
      for (const callback of callbackList) {
        try {
          callback(event);
        } catch (e) {
          console.error("[InlineCompletions] Event listener error:", e);
        }
      }
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Dispose all resources
   */
  dispose(): void {
    // Cancel pending requests
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.abortController) {
      this.abortController.abort();
    }

    // Clean up backend stream listener
    if (this.streamUnlisten) {
      this.streamUnlisten();
      this.streamUnlisten = null;
    }

    // Dispose Monaco integration
    if (this.providerDisposable) {
      this.providerDisposable.dispose();
    }
    this.commandDisposables.forEach((d) => d.dispose());

    // Clear state
    this.currentCompletions = [];
    this.cache.clear();
    this.eventListeners.clear();

    this.monaco = null;
    this.copilot = null;
    this.supermaven = null;
    this.llmProvider = null;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let providerInstance: InlineCompletionsProvider | null = null;

/**
 * Get the singleton inline completions provider
 */
export function getInlineCompletionsProvider(): InlineCompletionsProvider {
  if (!providerInstance) {
    providerInstance = new InlineCompletionsProvider();
  }
  return providerInstance;
}

/**
 * Reset the singleton instance
 */
export function resetInlineCompletionsProvider(): void {
  if (providerInstance) {
    providerInstance.dispose();
    providerInstance = null;
  }
}

/**
 * Create and register inline completions with Monaco
 */
export function createInlineCompletionsProvider(
  monaco: typeof Monaco,
  settings?: Partial<InlineCompletionSettings>
): {
  provider: InlineCompletionsProvider;
  disposable: Monaco.IDisposable;
} {
  const provider = getInlineCompletionsProvider();
  
  if (settings) {
    provider.configure(settings);
  }

  const disposable = provider.register(monaco);

  return { provider, disposable };
}

/**
 * Get Monaco editor options for inline suggestions
 */
export function getInlineSuggestEditorOptions(
  settings: Pick<InlineCompletionSettings, "enabled" | "showToolbar" | "suppressSuggestions">
): Monaco.editor.IEditorOptions {
  return {
    inlineSuggest: {
      enabled: settings.enabled,
      showToolbar: settings.showToolbar ? "onHover" : "never",
      suppressSuggestions: settings.suppressSuggestions,
      mode: "subwordSmart",
    },
    // Keep standard suggestions unless suppressed
    quickSuggestions: settings.suppressSuggestions ? false : {
      other: "on",
      comments: "off",
      strings: "off",
    },
  };
}

// ============================================================================
// Keyboard Shortcuts Configuration
// ============================================================================

/**
 * Get keybindings for inline completions
 */
export function getInlineCompletionKeybindings(monaco: typeof Monaco): Array<{
  command: string;
  keybinding: number;
  when?: string;
}> {
  return [
    {
      command: "orion.inlineCompletion.acceptWord",
      keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.RightArrow,
      when: "inlineSuggestionVisible",
    },
    {
      command: "orion.inlineCompletion.acceptLine",
      keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.End,
      when: "inlineSuggestionVisible",
    },
    {
      command: "orion.inlineCompletion.next",
      keybinding: monaco.KeyMod.Alt | monaco.KeyCode.BracketRight,
      when: "inlineSuggestionVisible",
    },
    {
      command: "orion.inlineCompletion.previous",
      keybinding: monaco.KeyMod.Alt | monaco.KeyCode.BracketLeft,
      when: "inlineSuggestionVisible",
    },
    {
      command: "orion.inlineCompletion.trigger",
      keybinding: monaco.KeyMod.Alt | monaco.KeyCode.Backslash,
    },
  ];
}
