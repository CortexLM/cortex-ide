/**
 * useTerminalCompletion Hook
 * 
 * Bridge hook that integrates the TerminalCompletionProvider with the 
 * TerminalSuggest component for enhanced terminal autocompletion.
 * 
 * Features:
 * - Async command completion from PATH
 * - File/directory completion via Tauri
 * - Environment variable completion
 * - Shell history integration
 * - Argument completions for known commands
 */

import { createSignal, onCleanup, Accessor } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import {
  getTerminalCompletionProvider,
  type TerminalCompletionContext,
  type ShellType,
} from "@/providers/TerminalCompletionProvider";
import type { Suggestion, SuggestionContext } from "@/components/TerminalSuggest";
import type { TerminalCompletionItem } from "@/types/terminal";

// ============================================================================
// Types
// ============================================================================

export interface UseTerminalCompletionOptions {
  /** Enable the provider */
  enabled?: boolean;
  /** Debounce time in ms */
  debounceMs?: number;
  /** Maximum completions to return */
  maxCompletions?: number;
  /** Current shell type */
  shellType?: ShellType;
}

export interface UseTerminalCompletionResult {
  /** Get completions for input */
  getCompletions: (
    input: string,
    cursorIndex: number,
    cwd: string,
    context?: Partial<SuggestionContext>
  ) => Promise<Suggestion[]>;
  /** Whether completions are loading */
  isLoading: Accessor<boolean>;
  /** Last error (if any) */
  error: Accessor<string | null>;
  /** Clear cached data */
  clearCache: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert TerminalCompletionItem to Suggestion format.
 */
function completionItemToSuggestion(
  item: TerminalCompletionItem,
  index: number
): Suggestion {
  // Map completion kind to suggestion type
  const typeMap: Record<string, Suggestion["type"]> = {
    command: "command",
    file: "file",
    folder: "directory",
    directory: "directory",
    argument: "arg",
    flag: "arg",
    option: "arg",
    envvar: "arg",
    history: "history",
    git: "git",
    npm: "npm",
  };

  const type = typeMap[item.kind] || "command";

  return {
    id: `completion-${index}-${item.label}`,
    text: item.label,
    type,
    description: item.detail || item.documentation || undefined,
    insertText: item.insertText || item.label,
    matchScore: 100, // sortText not available in TerminalCompletionItem
    matchIndices: [], // Could compute from filter text matching
  };
}

/**
 * Detect shell type from shell path or environment.
 */
function detectShellType(shellPath?: string): ShellType {
  if (!shellPath) return "unknown";
  
  const lower = shellPath.toLowerCase();
  
  if (lower.includes("powershell") || lower.includes("pwsh")) return "powershell";
  if (lower.includes("bash")) return "bash";
  if (lower.includes("zsh")) return "zsh";
  if (lower.includes("fish")) return "fish";
  if (lower.includes("cmd")) return "cmd";
  if (lower.includes("nushell") || lower.includes("nu")) return "nushell";
  if (lower.includes("sh")) return "bash"; // Map generic "sh" to bash
  
  return "unknown";
}

/**
 * Get platform from Tauri or navigator.
 */
async function getPlatform(): Promise<NodeJS.Platform> {
  try {
    const platform = await invoke<string>("get_platform");
    return platform as NodeJS.Platform;
  } catch {
    // Fallback to navigator
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) return "win32";
    if (ua.includes("mac")) return "darwin";
    return "linux";
  }
}

/**
 * Get environment variables from Tauri.
 */
async function getEnvironment(): Promise<Record<string, string>> {
  try {
    const env = await invoke<Record<string, string>>("get_environment");
    return env;
  } catch {
    // Return minimal env from window
    return {
      HOME: "",
      PATH: "",
      USER: "",
    };
  }
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook for enhanced terminal completion using TerminalCompletionProvider.
 */
export function useTerminalCompletion(
  options: UseTerminalCompletionOptions = {}
): UseTerminalCompletionResult {
  const {
    enabled = true,
    debounceMs = 100,
    maxCompletions = 50,
    shellType: providedShellType,
  } = options;

  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  
  // Cached platform and environment
  let cachedPlatform: NodeJS.Platform | null = null;
  let cachedEnv: Record<string, string> | null = null;
  
  // Debounce timer
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Get the provider instance
  const provider = enabled ? getTerminalCompletionProvider() : null;

  // Clean up on unmount
  onCleanup(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });

  /**
   * Get completions for the given input.
   */
  const getCompletions = async (
    input: string,
    cursorIndex: number,
    cwd: string,
    context?: Partial<SuggestionContext>
  ): Promise<Suggestion[]> => {
    if (!enabled || !provider) {
      return [];
    }

    // Clear previous debounce
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    return new Promise((resolve) => {
      debounceTimer = setTimeout(async () => {
        try {
          setIsLoading(true);
          setError(null);

          // Get platform if not cached
          if (!cachedPlatform) {
            cachedPlatform = await getPlatform();
          }

          // Get environment if not cached
          if (!cachedEnv) {
            cachedEnv = await getEnvironment();
          }

          // Detect shell type
          const shellType = providedShellType || 
            detectShellType(context?.currentDir) || 
            "unknown";

          // Create completion context
          const completionContext: TerminalCompletionContext = {
            commandLine: input,
            cursorIndex,
            cwd,
            shellType,
            env: cachedEnv,
            platform: cachedPlatform,
          };

          // Get completions from provider
          const items = await provider.provideCompletions(completionContext);

          // Convert to Suggestion format
          const suggestions = items
            .slice(0, maxCompletions)
            .map((item, index) => completionItemToSuggestion(item, index));

          resolve(suggestions);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          console.error("[useTerminalCompletion] Error:", message);
          resolve([]);
        } finally {
          setIsLoading(false);
        }
      }, debounceMs);
    });
  };

  /**
   * Clear cached data.
   */
  const clearCache = () => {
    cachedPlatform = null;
    cachedEnv = null;
    // Note: clearCache is not available on TerminalCompletionProvider
  };

  return {
    getCompletions,
    isLoading,
    error,
    clearCache,
  };
}

// ============================================================================
// Integration with TerminalSuggest
// ============================================================================

/**
 * Create a suggestion source that uses TerminalCompletionProvider.
 * Can be used alongside the existing TerminalSuggest sources.
 */
export function createAdvancedCompletionSource(
  options: UseTerminalCompletionOptions = {}
) {
  const { getCompletions, isLoading } = useTerminalCompletion(options);

  return {
    type: "advanced" as const,
    priority: 100, // Highest priority
    isAsync: true,
    isLoading,
    
    /**
     * Get suggestions asynchronously.
     */
    getSuggestionsAsync: async (
      input: string,
      context: SuggestionContext
    ): Promise<Suggestion[]> => {
      return getCompletions(
        input,
        input.length, // Cursor at end
        context.currentDir,
        context
      );
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export { detectShellType, completionItemToSuggestion };
