/**
 * useDiagnostics - Subscribe to diagnostic updates with filtering
 *
 * Provides a reactive interface for fetching and filtering LSP diagnostics
 * with computed severity counts and manual refresh capabilities.
 *
 * Features:
 * - Fetch diagnostics from the backend via Tauri IPC
 * - Filter by URI, severity, and source
 * - Computed counts for each severity level
 * - Manual refresh and clear operations
 * - Automatic cleanup on unmount
 *
 * @example
 * ```tsx
 * function DiagnosticsPanel() {
 *   const {
 *     diagnostics, errorCount, warningCount, refresh, clear,
 *   } = useDiagnostics({ severity: ["error", "warning"] });
 *
 *   onMount(() => { void refresh(); });
 *
 *   return (
 *     <div>
 *       <span>Errors: {errorCount()}</span>
 *       <span>Warnings: {warningCount()}</span>
 *       <For each={diagnostics()}>
 *         {(d) => <DiagnosticItem entry={d} />}
 *       </For>
 *       <button onClick={clear}>Clear</button>
 *     </div>
 *   );
 * }
 * ```
 */

import {
  createSignal,
  onCleanup,
  type Accessor,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================

/** A single diagnostic entry from the language server */
export interface DiagnosticEntry {
  /** Document URI this diagnostic belongs to */
  uri: string;
  /** Human-readable diagnostic message */
  message: string;
  /** Severity level (error, warning, information, hint) */
  severity: string;
  /** Line number (0-based) */
  line: number;
  /** Character offset within the line (0-based) */
  character: number;
  /** Source of the diagnostic (e.g., "typescript", "eslint") */
  source?: string;
}

/** Options for filtering diagnostics */
export interface UseDiagnosticsOptions {
  /** Filter diagnostics to a specific document URI */
  uri?: string;
  /** Filter by severity levels */
  severity?: string[];
  /** Filter by diagnostic sources */
  source?: string[];
}

/** Return type for useDiagnostics hook */
export interface UseDiagnosticsReturn {
  /** Current filtered list of diagnostics */
  diagnostics: Accessor<DiagnosticEntry[]>;
  /** Number of error-level diagnostics */
  errorCount: Accessor<number>;
  /** Number of warning-level diagnostics */
  warningCount: Accessor<number>;
  /** Number of information-level diagnostics */
  infoCount: Accessor<number>;
  /** Number of hint-level diagnostics */
  hintCount: Accessor<number>;
  /** Total number of filtered diagnostics */
  totalCount: Accessor<number>;
  /** Refresh diagnostics from the backend */
  refresh: () => Promise<void>;
  /** Clear all diagnostics */
  clear: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Count diagnostics matching a specific severity
 */
function countBySeverity(entries: DiagnosticEntry[], severity: string): number {
  return entries.filter((e) => e.severity === severity).length;
}

/**
 * Apply filtering options to a list of diagnostic entries
 */
function applyFilters(
  entries: DiagnosticEntry[],
  options?: UseDiagnosticsOptions
): DiagnosticEntry[] {
  if (!options) {
    return entries;
  }

  let filtered = entries;

  if (options.uri) {
    const targetUri = options.uri;
    filtered = filtered.filter((e) => e.uri === targetUri);
  }

  if (options.severity && options.severity.length > 0) {
    const severities = options.severity;
    filtered = filtered.filter((e) => severities.includes(e.severity));
  }

  if (options.source && options.source.length > 0) {
    const sources = options.source;
    filtered = filtered.filter(
      (e) => e.source !== undefined && sources.includes(e.source)
    );
  }

  return filtered;
}

// ============================================================================
// useDiagnostics Hook
// ============================================================================

/**
 * Hook for subscribing to and filtering LSP diagnostics.
 *
 * @param options - Filtering options for diagnostics
 * @returns Object with diagnostics signal, severity counts, and control methods
 *
 * @example
 * ```tsx
 * const { diagnostics, errorCount, refresh } = useDiagnostics({
 *   uri: "file:///src/app.ts",
 *   severity: ["error"],
 * });
 *
 * await refresh();
 * console.log(`Found ${errorCount()} errors`);
 * ```
 */
export function useDiagnostics(
  options?: UseDiagnosticsOptions
): UseDiagnosticsReturn {
  const [diagnostics, setDiagnostics] = createSignal<DiagnosticEntry[]>([]);
  const [errorCount, setErrorCount] = createSignal<number>(0);
  const [warningCount, setWarningCount] = createSignal<number>(0);
  const [infoCount, setInfoCount] = createSignal<number>(0);
  const [hintCount, setHintCount] = createSignal<number>(0);
  const [totalCount, setTotalCount] = createSignal<number>(0);

  let cancelled = false;

  const updateCounts = (entries: DiagnosticEntry[]): void => {
    setErrorCount(countBySeverity(entries, "error"));
    setWarningCount(countBySeverity(entries, "warning"));
    setInfoCount(countBySeverity(entries, "information"));
    setHintCount(countBySeverity(entries, "hint"));
    setTotalCount(entries.length);
  };

  const refresh = async (): Promise<void> => {
    if (cancelled) {
      return;
    }

    try {
      const raw = await invoke<DiagnosticEntry[]>("diagnostics_get");
      if (cancelled) {
        return;
      }

      const filtered = applyFilters(raw, options);
      setDiagnostics(filtered);
      updateCounts(filtered);
    } catch (_err) {
      if (!cancelled) {
        setDiagnostics([]);
        updateCounts([]);
      }
    }
  };

  const clear = (): void => {
    setDiagnostics([]);
    updateCounts([]);
  };

  onCleanup(() => {
    cancelled = true;
  });

  return {
    diagnostics,
    errorCount,
    warningCount,
    infoCount,
    hintCount,
    totalCount,
    refresh,
    clear,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default useDiagnostics;
