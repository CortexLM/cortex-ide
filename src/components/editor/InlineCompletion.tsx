/**
 * InlineCompletion — Ghost text rendering UI for AI inline completions
 *
 * Integrates with Monaco's inline completions API to show dim ghost text
 * after the cursor. Provides visual indicators for:
 * - Tab to accept the full completion
 * - Esc to dismiss
 * - Alt+] / Alt+[ to cycle alternatives
 * - Loading state while fetching completions
 * - Source provider badge
 */

import { Show, createSignal, createEffect, onCleanup } from "solid-js";
import type * as Monaco from "monaco-editor";
import {
  useInlineCompletions,
  type UseInlineCompletionsOptions,
} from "@/hooks/useInlineCompletions";

// ============================================================================
// Types
// ============================================================================

export interface InlineCompletionProps {
  /** Monaco editor instance */
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  /** Monaco module */
  monaco: typeof Monaco | null;
  /** Whether inline completions are enabled */
  enabled?: boolean;
  /** Callback when a completion is accepted */
  onAccepted?: (text: string) => void;
  /** Callback when a completion is dismissed */
  onDismissed?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function InlineCompletion(props: InlineCompletionProps) {
  const [isRegistered, setIsRegistered] = createSignal(false);

  const options: UseInlineCompletionsOptions = {
    settings: {
      enabled: props.enabled ?? true,
    },
    onCompletionAccepted: (event) => {
      const data = event.data as { text?: string } | undefined;
      if (data?.text) {
        props.onAccepted?.(data.text);
      }
    },
    onCompletionDismissed: () => {
      props.onDismissed?.();
    },
  };

  const {
    status,
    isLoading,
    isActive,
    completionCount,
    currentIndex,
    registerWithMonaco,
    registerKeybindings,
    getEditorOptions,
    configure,
  } = useInlineCompletions(options);

  // Register with Monaco when editor and monaco are available
  createEffect(() => {
    const monacoInstance = props.monaco;
    const editorInstance = props.editor;

    if (!monacoInstance || !editorInstance || isRegistered()) return;

    const disposable = registerWithMonaco(monacoInstance);
    const keybindingDisposables = registerKeybindings(monacoInstance, editorInstance);

    const editorOptions = getEditorOptions();
    editorInstance.updateOptions(editorOptions);

    setIsRegistered(true);

    onCleanup(() => {
      disposable.dispose();
      keybindingDisposables.forEach((d) => d.dispose());
      setIsRegistered(false);
    });
  });

  // Update enabled state when prop changes
  createEffect(() => {
    configure({ enabled: props.enabled ?? true });
  });

  return (
    <Show when={isRegistered()}>
      <div class="inline-completion-status pointer-events-none absolute right-2 top-2 z-50 flex items-center gap-1.5">
        <Show when={isLoading()}>
          <div class="flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/60">
            <span class="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-white/40 border-t-white/80" />
            <span>AI</span>
          </div>
        </Show>

        <Show when={!isLoading() && isActive() && completionCount() > 1}>
          <div class="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/50">
            {currentIndex() + 1}/{completionCount()}
          </div>
        </Show>

        <Show when={!isLoading() && isActive() && completionCount() > 0}>
          <div class="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/40">
            {status().provider}
          </div>
        </Show>
      </div>
    </Show>
  );
}

export default InlineCompletion;
