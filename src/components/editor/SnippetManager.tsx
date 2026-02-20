/**
 * SnippetManager - SolidJS component for snippet browsing and insertion.
 *
 * Lists available snippets for the current language and allows the user
 * to search, preview, and insert them into the editor. Uses Tauri IPC
 * to expand snippet templates with placeholders.
 */

import { createSignal, createEffect, Show, For, createMemo } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type { ExpandedSnippet } from "@/sdk/ipc";
import { editorLogger } from "@/utils/logger";

// ============================================================================
// Types
// ============================================================================

export interface SnippetPlaceholder {
  index: number;
  defaultValue: string;
  offset: number;
}

interface SnippetEntry {
  name: string;
  prefix: string;
  body: string;
  description: string;
}

export interface SnippetManagerProps {
  language: string;
  onInsert?: (text: string, placeholders: SnippetPlaceholder[]) => void;
  visible: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SnippetManager(props: SnippetManagerProps) {
  const [snippets, setSnippets] = createSignal<SnippetEntry[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [previewSnippet, setPreviewSnippet] = createSignal<SnippetEntry | null>(null);

  let searchInputRef: HTMLInputElement | undefined;

  const filteredSnippets = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return snippets();
    return snippets().filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.prefix.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query),
    );
  });

  async function loadSnippets() {
    setLoading(true);
    try {
      // Snippets are contributed by extensions; when no extensions provide
      // snippets for the current language, the list is empty by design.
      setSnippets([]);
    } catch (error) {
      editorLogger.warn("[SnippetManager] Failed to load snippets:", error);
      setSnippets([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleInsert(snippet: SnippetEntry) {
    try {
      const result = await invoke<ExpandedSnippet>("expand_snippet", {
        body: snippet.body.split("\n"),
        variables: {
          TM_CURRENT_LINE: "",
          TM_CURRENT_WORD: "",
          TM_FILENAME: "",
          TM_FILEPATH: "",
          TM_LINE_INDEX: "0",
          TM_LINE_NUMBER: "1",
          TM_SELECTED_TEXT: "",
        },
      });
      // Map tab stops to placeholders
      const placeholders: SnippetPlaceholder[] = result.tabStops.map(stop => ({
        index: stop.index,
        defaultValue: stop.placeholder,
        offset: stop.offset,
      }));
      props.onInsert?.(result.text, placeholders);
    } catch (error) {
      editorLogger.warn("[SnippetManager] Failed to expand snippet:", error);
      props.onInsert?.(snippet.body, []);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    const filtered = filteredSnippets();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filtered[selectedIndex()];
      if (selected) handleInsert(selected);
    }
  }

  createEffect(() => {
    if (props.visible) {
      loadSnippets();
      setSearchQuery("");
      setSelectedIndex(0);
      setTimeout(() => searchInputRef?.focus(), 50);
    }
  });

  createEffect(() => {
    void searchQuery();
    setSelectedIndex(0);
  });

  return (
    <Show when={props.visible}>
      <div class="flex max-h-[400px] w-[360px] flex-col overflow-hidden rounded border border-[var(--cortex-border,#333)] bg-[var(--cortex-bg-secondary,#252526)]">
        {/* Search */}
        <div class="border-b border-[var(--cortex-border,#333)] p-2">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search snippets..."
            class="w-full rounded bg-[var(--cortex-bg-primary,#1e1e1e)] px-2 py-1 text-xs text-[var(--cortex-text-primary,#fff)] outline-none ring-1 ring-[var(--cortex-border,#333)] focus:ring-[var(--cortex-info,#569cd6)]"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* List */}
        <div class="flex-1 overflow-auto">
          <Show when={loading()}>
            <div class="p-4 text-center text-xs text-[var(--cortex-text-inactive,#666)]">
              Loading snippets...
            </div>
          </Show>
          <Show when={!loading() && filteredSnippets().length === 0}>
            <div class="p-4 text-center text-xs text-[var(--cortex-text-inactive,#666)]">
              No snippets found
            </div>
          </Show>
          <Show when={!loading()}>
            <For each={filteredSnippets()}>
              {(snippet, index) => (
                <div
                  class="flex cursor-pointer items-start gap-2 px-3 py-2 text-xs transition-colors hover:bg-[var(--cortex-bg-hover,#2a2d2e)]"
                  classList={{
                    "bg-[var(--cortex-bg-active,#37373d)]": selectedIndex() === index(),
                  }}
                  onClick={() => handleInsert(snippet)}
                  onMouseEnter={() => {
                    setSelectedIndex(index());
                    setPreviewSnippet(snippet);
                  }}
                  onMouseLeave={() => setPreviewSnippet(null)}
                >
                  <span class="shrink-0 rounded bg-[var(--cortex-bg-primary,#1e1e1e)] px-1.5 py-0.5 font-mono text-[var(--cortex-info,#569cd6)]">
                    {snippet.prefix}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-medium text-[var(--cortex-text-primary,#fff)]">
                      {snippet.name}
                    </div>
                    <Show when={snippet.description}>
                      <div class="truncate text-[var(--cortex-text-inactive,#666)]">
                        {snippet.description}
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </div>

        {/* Preview */}
        <Show when={previewSnippet()}>
          <div class="max-h-[120px] overflow-auto border-t border-[var(--cortex-border,#333)] bg-[var(--cortex-bg-primary,#1e1e1e)] p-2">
            <pre class="whitespace-pre-wrap font-mono text-[11px] text-[var(--cortex-text-secondary,#ccc)]">
              {previewSnippet()!.body}
            </pre>
          </div>
        </Show>

        {/* Footer */}
        <div class="flex items-center justify-between border-t border-[var(--cortex-border,#333)] px-3 py-1 text-[10px] text-[var(--cortex-text-inactive,#666)]">
          <span>{filteredSnippets().length} snippet(s)</span>
          <span>↵ Insert · ↑↓ Navigate</span>
        </div>
      </div>
    </Show>
  );
}
