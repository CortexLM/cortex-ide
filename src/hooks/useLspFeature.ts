/**
 * useLspFeature - Generic hook for any LSP request with loading/error state
 *
 * Provides a reusable pattern for executing LSP-related async requests
 * with full state tracking including data, loading, and error signals.
 *
 * Features:
 * - Full TypeScript generic support
 * - Loading, error, and data state tracking
 * - Immediate execution option on mount
 * - Reset utility to clear all state
 * - Automatic cleanup on unmount
 *
 * @example
 * ```tsx
 * function HoverInfo(props: { uri: string; line: number; character: number }) {
 *   const { data, loading, error, execute } = useLspFeature<HoverResult>(
 *     (uri: unknown, line: unknown, char: unknown) =>
 *       invoke("lsp_hover", { uri, line, character: char }),
 *     { immediate: true, args: [props.uri, props.line, props.character] }
 *   );
 *
 *   return (
 *     <Show when={!loading()} fallback={<Spinner />}>
 *       <Show when={error()}>
 *         <ErrorBanner message={error()!} />
 *       </Show>
 *       <Show when={data()}>
 *         <HoverCard content={data()!} />
 *       </Show>
 *     </Show>
 *   );
 * }
 * ```
 */

import {
  createSignal,
  onMount,
  onCleanup,
  batch,
  type Accessor,
} from "solid-js";

// ============================================================================
// Types
// ============================================================================

/** Return type for useLspFeature hook */
export interface UseLspFeatureReturn<T> {
  /** The result data from the last successful request */
  data: Accessor<T | null>;
  /** Whether a request is currently in progress */
  loading: Accessor<boolean>;
  /** Error message from the last failed request */
  error: Accessor<string | null>;
  /** Execute the request function with the given arguments */
  execute: (...args: unknown[]) => Promise<T | null>;
  /** Reset all state to initial values */
  reset: () => void;
}

/** Options for useLspFeature hook */
export interface UseLspFeatureOptions {
  /** Whether to execute immediately on mount */
  immediate?: boolean;
  /** Arguments to pass when executing immediately */
  args?: unknown[];
}

// ============================================================================
// useLspFeature Hook
// ============================================================================

/**
 * Generic hook for executing LSP requests with loading/error state management.
 *
 * @param requestFn - Async function that performs the LSP request
 * @param options - Configuration options
 * @returns Object with data, loading, error signals and execute/reset methods
 *
 * @example
 * ```tsx
 * const { data, loading, execute } = useLspFeature<CompletionItem[]>(
 *   (uri: unknown, pos: unknown) =>
 *     invoke("lsp_completion", { uri, position: pos })
 * );
 *
 * // Execute manually
 * await execute(fileUri, cursorPosition);
 * ```
 */
export function useLspFeature<T>(
  requestFn: (...args: unknown[]) => Promise<T>,
  options?: UseLspFeatureOptions
): UseLspFeatureReturn<T> {
  const [data, setData] = createSignal<T | null>(null);
  const [loading, setLoading] = createSignal<boolean>(false);
  const [error, setError] = createSignal<string | null>(null);

  let cancelled = false;

  const execute = async (...args: unknown[]): Promise<T | null> => {
    if (cancelled) {
      return null;
    }

    batch(() => {
      setLoading(true);
      setError(null);
    });

    try {
      const result = await requestFn(...args);

      if (!cancelled) {
        batch(() => {
          setData(() => result);
          setLoading(false);
        });
      }

      return result;
    } catch (err) {
      if (!cancelled) {
        const message =
          err instanceof Error ? err.message : String(err);

        batch(() => {
          setError(message);
          setLoading(false);
        });
      }

      return null;
    }
  };

  const reset = (): void => {
    batch(() => {
      setData(null);
      setLoading(false);
      setError(null);
    });
  };

  if (options?.immediate) {
    onMount(() => {
      void execute(...(options.args ?? []));
    });
  }

  onCleanup(() => {
    cancelled = true;
  });

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default useLspFeature;
