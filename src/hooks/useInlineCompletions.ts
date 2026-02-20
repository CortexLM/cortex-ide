/**
 * useInlineCompletions Hook
 *
 * SolidJS hook for integrating inline AI code completions with Monaco Editor.
 * Provides reactive state management and easy integration with the InlineCompletionsProvider.
 */

import { createSignal, onMount, onCleanup, createMemo } from "solid-js";
import type * as Monaco from "monaco-editor";
import {
  InlineCompletionsProvider,
  getInlineCompletionsProvider,
  createInlineCompletionsProvider,
  getInlineSuggestEditorOptions,
  getInlineCompletionKeybindings,
  type InlineCompletionSettings,
  type InlineProviderStatus,
  type InlineCompletionEvent,
} from "@/providers/InlineCompletionsProvider";

// ============================================================================
// Types
// ============================================================================

export interface UseInlineCompletionsOptions {
  /** Initial settings */
  settings?: Partial<InlineCompletionSettings>;
  /** Called when status changes */
  onStatusChange?: (status: InlineProviderStatus) => void;
  /** Called when completion is shown */
  onCompletionShown?: (event: InlineCompletionEvent) => void;
  /** Called when completion is accepted */
  onCompletionAccepted?: (event: InlineCompletionEvent) => void;
  /** Called when completion is dismissed */
  onCompletionDismissed?: () => void;
  /** Called on error */
  onError?: (error: unknown) => void;
}

export interface UseInlineCompletionsReturn {
  /** Provider instance */
  provider: InlineCompletionsProvider;
  /** Current status (reactive) */
  status: () => InlineProviderStatus;
  /** Whether completions are enabled (reactive) */
  isEnabled: () => boolean;
  /** Whether currently loading (reactive) */
  isLoading: () => boolean;
  /** Whether provider is active (reactive) */
  isActive: () => boolean;
  /** Current error message (reactive) */
  error: () => string | undefined;
  /** Number of available completions (reactive) */
  completionCount: () => number;
  /** Current completion index (reactive) */
  currentIndex: () => number;
  /** Register with Monaco editor */
  registerWithMonaco: (monaco: typeof Monaco) => Monaco.IDisposable;
  /** Register keybindings */
  registerKeybindings: (monaco: typeof Monaco, editor: Monaco.editor.IStandaloneCodeEditor) => Monaco.IDisposable[];
  /** Get Monaco editor options for inline suggestions */
  getEditorOptions: () => Monaco.editor.IEditorOptions;
  /** Configure settings */
  configure: (settings: Partial<InlineCompletionSettings>) => void;
  /** Accept word from current completion */
  acceptWord: (editor: Monaco.editor.IStandaloneCodeEditor) => void;
  /** Accept line from current completion */
  acceptLine: (editor: Monaco.editor.IStandaloneCodeEditor) => void;
  /** Cycle to next completion */
  nextCompletion: () => void;
  /** Cycle to previous completion */
  previousCompletion: () => void;
  /** Trigger completion manually */
  triggerCompletion: (editor: Monaco.editor.IStandaloneCodeEditor) => Promise<void>;
  /** Dismiss current completions */
  dismiss: () => void;
  /** Clear completion cache */
  clearCache: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for using inline AI completions in Monaco Editor
 *
 * @example
 * ```tsx
 * const {
 *   provider,
 *   status,
 *   isLoading,
 *   registerWithMonaco,
 *   getEditorOptions,
 * } = useInlineCompletions({
 *   settings: { provider: "copilot" },
 *   onCompletionAccepted: (e) => console.log("Accepted:", e),
 * });
 *
 * // In your Monaco setup:
 * onMount(() => {
 *   const disposable = registerWithMonaco(monaco);
 *   onCleanup(() => disposable.dispose());
 * });
 *
 * // Apply editor options:
 * const editorOptions = { ...baseOptions, ...getEditorOptions() };
 * ```
 */
export function useInlineCompletions(
  options: UseInlineCompletionsOptions = {}
): UseInlineCompletionsReturn {
  // Get the singleton provider
  const provider = getInlineCompletionsProvider();

  // Reactive state
  const [status, setStatus] = createSignal<InlineProviderStatus>(provider.getStatus());
  const [settings, setSettings] = createSignal<InlineCompletionSettings>(provider.getSettings());

  // Derived signals
  const isEnabled = createMemo(() => settings().enabled);
  const isLoading = createMemo(() => status().isLoading);
  const isActive = createMemo(() => status().isActive);
  const error = createMemo(() => status().error);
  const completionCount = createMemo(() => status().completionCount);
  const currentIndex = createMemo(() => status().currentIndex);

  // Configure provider with initial settings
  if (options.settings) {
    provider.configure(options.settings);
    setSettings(provider.getSettings());
  }

  // Subscribe to events
  onMount(() => {
    const unsubscribes: Array<() => void> = [];

    // Status changes
    unsubscribes.push(
      provider.on("status-changed", (event) => {
        if (event.data) {
          setStatus(event.data as InlineProviderStatus);
          options.onStatusChange?.(event.data as InlineProviderStatus);
        }
      })
    );

    // Completion shown
    unsubscribes.push(
      provider.on("completion-shown", (event) => {
        options.onCompletionShown?.(event);
      })
    );

    // Completion accepted
    unsubscribes.push(
      provider.on("completion-accepted", (event) => {
        options.onCompletionAccepted?.(event);
      })
    );

    // Completion dismissed
    unsubscribes.push(
      provider.on("completion-dismissed", () => {
        options.onCompletionDismissed?.();
      })
    );

    // Errors
    unsubscribes.push(
      provider.on("error", (event) => {
        options.onError?.(event.data);
      })
    );

    onCleanup(() => {
      unsubscribes.forEach((unsub) => unsub());
    });
  });

  // Register with Monaco
  const registerWithMonaco = (monaco: typeof Monaco): Monaco.IDisposable => {
    const { disposable } = createInlineCompletionsProvider(monaco, settings());
    return disposable;
  };

  // Register keybindings
  const registerKeybindings = (
    monaco: typeof Monaco,
    editor: Monaco.editor.IStandaloneCodeEditor
  ): Monaco.IDisposable[] => {
    const keybindings = getInlineCompletionKeybindings(monaco);
    const disposables: Monaco.IDisposable[] = [];

    for (const kb of keybindings) {
      const disposable = editor.addAction({
        id: kb.command,
        label: kb.command.replace("orion.inlineCompletion.", "").replace(/([A-Z])/g, " $1").trim(),
        keybindings: [kb.keybinding],
        precondition: kb.when,
        run: () => {
          switch (kb.command) {
            case "orion.inlineCompletion.acceptWord":
              provider.acceptWord(editor);
              break;
            case "orion.inlineCompletion.acceptLine":
              provider.acceptLine(editor);
              break;
            case "orion.inlineCompletion.next":
              provider.cycleCompletion(1);
              break;
            case "orion.inlineCompletion.previous":
              provider.cycleCompletion(-1);
              break;
            case "orion.inlineCompletion.trigger":
              provider.triggerCompletion(editor);
              break;
          }
        },
      });
      disposables.push(disposable);
    }

    return disposables;
  };

  // Get editor options
  const getEditorOptions = (): Monaco.editor.IEditorOptions => {
    return getInlineSuggestEditorOptions({
      enabled: settings().enabled,
      showToolbar: settings().showToolbar,
      suppressSuggestions: settings().suppressSuggestions,
    });
  };

  // Configure settings
  const configure = (newSettings: Partial<InlineCompletionSettings>): void => {
    provider.configure(newSettings);
    setSettings(provider.getSettings());
  };

  // Actions
  const acceptWord = (editor: Monaco.editor.IStandaloneCodeEditor): void => {
    provider.acceptWord(editor);
  };

  const acceptLine = (editor: Monaco.editor.IStandaloneCodeEditor): void => {
    provider.acceptLine(editor);
  };

  const nextCompletion = (): void => {
    provider.cycleCompletion(1);
  };

  const previousCompletion = (): void => {
    provider.cycleCompletion(-1);
  };

  const triggerCompletion = async (editor: Monaco.editor.IStandaloneCodeEditor): Promise<void> => {
    await provider.triggerCompletion(editor);
  };

  const dismiss = (): void => {
    provider.dismiss();
  };

  const clearCache = (): void => {
    provider.clearCache();
  };

  return {
    provider,
    status,
    isEnabled,
    isLoading,
    isActive,
    error,
    completionCount,
    currentIndex,
    registerWithMonaco,
    registerKeybindings,
    getEditorOptions,
    configure,
    acceptWord,
    acceptLine,
    nextCompletion,
    previousCompletion,
    triggerCompletion,
    dismiss,
    clearCache,
  };
}

// ============================================================================
// Convenience Hook for Simple Usage
// ============================================================================

/**
 * Simple hook for checking inline completion availability
 */
export function useInlineCompletionStatus() {
  const [status, setStatus] = createSignal<InlineProviderStatus>({
    provider: "auto",
    isActive: false,
    isLoading: false,
    completionCount: 0,
    currentIndex: 0,
  });

  onMount(() => {
    const provider = getInlineCompletionsProvider();
    setStatus(provider.getStatus());

    const unsubscribe = provider.on("status-changed", (event) => {
      if (event.data) {
        setStatus(event.data as InlineProviderStatus);
      }
    });

    onCleanup(() => unsubscribe());
  });

  return status;
}

// ============================================================================
// Export
// ============================================================================

export default useInlineCompletions;
