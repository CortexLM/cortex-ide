/**
 * useTerminalSearch - Terminal search with match highlighting
 *
 * Provides a reactive search interface for terminal content, supporting
 * query management, match navigation, and search execution via Tauri IPC.
 *
 * Features:
 * - Reactive query and match state
 * - Forward and backward match navigation
 * - Search execution via backend invoke
 * - Loading state tracking
 * - Clear and reset utilities
 *
 * @example
 * ```tsx
 * function TerminalSearchBar(props: { terminalId: string }) {
 *   const {
 *     query, setQuery, matches, currentMatchIndex,
 *     totalMatches, isSearching, nextMatch, previousMatch,
 *     search, clearSearch,
 *   } = useTerminalSearch();
 *
 *   const handleInput = (value: string) => {
 *     setQuery(value);
 *     void search(props.terminalId);
 *   };
 *
 *   return (
 *     <div>
 *       <input
 *         value={query()}
 *         onInput={(e) => handleInput(e.currentTarget.value)}
 *       />
 *       <span>{currentMatchIndex() + 1} / {totalMatches()}</span>
 *       <button onClick={previousMatch}>Prev</button>
 *       <button onClick={nextMatch}>Next</button>
 *       <button onClick={clearSearch}>Clear</button>
 *     </div>
 *   );
 * }
 * ```
 */

import {
  createSignal,
  type Accessor,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================

/** A single search match within terminal content */
export interface TerminalSearchMatch {
  /** Line number where the match was found */
  line: number;
  /** Starting column of the match */
  startCol: number;
  /** Ending column of the match (exclusive) */
  endCol: number;
  /** The matched text content */
  text: string;
}

/** Return type for useTerminalSearch hook */
export interface UseTerminalSearchReturn {
  /** Current search query */
  query: Accessor<string>;
  /** Update the search query */
  setQuery: (q: string) => void;
  /** List of search matches */
  matches: Accessor<TerminalSearchMatch[]>;
  /** Index of the currently highlighted match */
  currentMatchIndex: Accessor<number>;
  /** Total number of matches found */
  totalMatches: Accessor<number>;
  /** Whether a search is currently in progress */
  isSearching: Accessor<boolean>;
  /** Navigate to the next match */
  nextMatch: () => void;
  /** Navigate to the previous match */
  previousMatch: () => void;
  /** Execute a search in the specified terminal */
  search: (terminalId: string) => Promise<void>;
  /** Clear all search state */
  clearSearch: () => void;
}

// ============================================================================
// useTerminalSearch Hook
// ============================================================================

/**
 * Hook for searching terminal content with match navigation.
 *
 * @returns Object with search state signals and control methods
 *
 * @example
 * ```tsx
 * const { query, setQuery, search, nextMatch, totalMatches } = useTerminalSearch();
 *
 * setQuery("error");
 * await search("terminal-1");
 * console.log(`Found ${totalMatches()} matches`);
 * nextMatch();
 * ```
 */
export function useTerminalSearch(): UseTerminalSearchReturn {
  const [query, setQuerySignal] = createSignal<string>("");
  const [matches, setMatches] = createSignal<TerminalSearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = createSignal<number>(0);
  const [totalMatches, setTotalMatches] = createSignal<number>(0);
  const [isSearching, setIsSearching] = createSignal<boolean>(false);

  const setQuery = (q: string): void => {
    setQuerySignal(q);
  };

  const nextMatch = (): void => {
    const total = totalMatches();
    if (total === 0) {
      return;
    }

    setCurrentMatchIndex((prev) => (prev + 1) % total);
  };

  const previousMatch = (): void => {
    const total = totalMatches();
    if (total === 0) {
      return;
    }

    setCurrentMatchIndex((prev) => (prev - 1 + total) % total);
  };

  const search = async (terminalId: string): Promise<void> => {
    const currentQuery = query();
    if (!currentQuery) {
      setMatches([]);
      setTotalMatches(0);
      setCurrentMatchIndex(0);
      return;
    }

    setIsSearching(true);

    try {
      const results = await invoke<TerminalSearchMatch[]>("terminal_search", {
        terminalId,
        query: currentQuery,
      });

      setMatches(results);
      setTotalMatches(results.length);
      setCurrentMatchIndex(0);
    } catch (_err) {
      setMatches([]);
      setTotalMatches(0);
      setCurrentMatchIndex(0);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = (): void => {
    setQuerySignal("");
    setMatches([]);
    setCurrentMatchIndex(0);
    setTotalMatches(0);
    setIsSearching(false);
  };

  return {
    query,
    setQuery,
    matches,
    currentMatchIndex,
    totalMatches,
    isSearching,
    nextMatch,
    previousMatch,
    search,
    clearSearch,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default useTerminalSearch;
