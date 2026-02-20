/**
 * PeekView - SolidJS component for inline definition/references peek.
 *
 * Shows an embedded code preview panel within the editor with navigation
 * between multiple results. Supports close, navigate-to-file, and
 * prev/next result cycling.
 */

import { createSignal, createEffect, onCleanup, Show, For, createMemo } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type * as Monaco from "monaco-editor";
import { editorLogger } from "@/utils/logger";

// ============================================================================
// Types
// ============================================================================

export interface PeekLocation {
  uri: string;
  range: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
}

export interface PeekViewProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  locations: PeekLocation[];
  visible: boolean;
  onClose?: () => void;
  onNavigate?: (location: PeekLocation) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PEEK_CONTEXT_BEFORE = 3;
const PEEK_CONTEXT_AFTER = 10;

// ============================================================================
// Helpers
// ============================================================================

function extractFileName(uri: string): string {
  const path = uri.replace(/^file:\/\//, "");
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || uri;
}

async function fetchContent(uri: string): Promise<string> {
  try {
    const path = uri.replace(/^file:\/\//, "");
    return await invoke<string>("read_file", { path });
  } catch (error) {
    editorLogger.warn("[PeekView] Failed to fetch file content:", error);
    return "// Unable to load file content";
  }
}

// ============================================================================
// Component
// ============================================================================

export function PeekView(props: PeekViewProps) {
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [content, setContent] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const currentLocation = createMemo(() => {
    const locs = props.locations;
    const idx = currentIndex();
    return locs.length > 0 ? locs[idx] : null;
  });

  const totalResults = createMemo(() => props.locations.length);

  async function loadContent(location: PeekLocation) {
    setLoading(true);
    try {
      const text = await fetchContent(location.uri);
      setContent(text);
    } finally {
      setLoading(false);
    }
  }

  function goToPrevious() {
    const total = totalResults();
    if (total <= 1) return;
    setCurrentIndex((i) => (i === 0 ? total - 1 : i - 1));
  }

  function goToNext() {
    const total = totalResults();
    if (total <= 1) return;
    setCurrentIndex((i) => (i + 1) % total);
  }

  function navigateToLocation() {
    const loc = currentLocation();
    if (loc) {
      props.onNavigate?.(loc);
    }
  }

  function handleClose() {
    props.onClose?.();
  }

  function getPreviewLines(): string[] {
    const loc = currentLocation();
    if (!loc) return [];

    const lines = content().split("\n");
    const start = Math.max(0, loc.range.startLine - 1 - PEEK_CONTEXT_BEFORE);
    const end = Math.min(lines.length, loc.range.endLine + PEEK_CONTEXT_AFTER);
    return lines.slice(start, end);
  }

  function getStartLineNumber(): number {
    const loc = currentLocation();
    if (!loc) return 1;
    return Math.max(1, loc.range.startLine - PEEK_CONTEXT_BEFORE);
  }

  createEffect(() => {
    const loc = currentLocation();
    if (loc && props.visible) {
      loadContent(loc);
    }
  });

  createEffect(() => {
    if (!props.visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      } else if (e.key === "ArrowUp" && e.altKey) {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowDown" && e.altKey) {
        e.preventDefault();
        goToNext();
      } else if (e.key === "Enter") {
        e.preventDefault();
        navigateToLocation();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown, true));
  });

  createEffect(() => {
    if (props.visible) {
      setCurrentIndex(0);
    }
  });

  return (
    <Show when={props.visible && props.locations.length > 0}>
      <div class="overflow-hidden rounded border border-[var(--cortex-border,#333)] bg-[var(--cortex-bg-secondary,#252526)]">
        {/* Header */}
        <div class="flex h-7 items-center justify-between border-b border-[var(--cortex-border,#333)] bg-[var(--cortex-bg-primary,#1e1e1e)] px-2 text-xs">
          <div class="flex items-center gap-2 overflow-hidden">
            <span class="truncate font-medium text-[var(--cortex-text-primary,#fff)]">
              {currentLocation() ? extractFileName(currentLocation()!.uri) : ""}
            </span>
            <Show when={currentLocation()}>
              <span class="text-[var(--cortex-text-inactive,#666)]">
                :{currentLocation()!.range.startLine}
              </span>
            </Show>
          </div>

          <div class="flex items-center gap-1">
            <Show when={totalResults() > 1}>
              <button
                class="rounded p-0.5 text-[var(--cortex-text-secondary,#ccc)] hover:bg-[var(--cortex-bg-hover,#2a2d2e)]"
                onClick={goToPrevious}
                title="Previous (Alt+↑)"
              >
                ▲
              </button>
              <span class="min-w-[40px] text-center tabular-nums text-[var(--cortex-text-inactive,#666)]">
                {currentIndex() + 1}/{totalResults()}
              </span>
              <button
                class="rounded p-0.5 text-[var(--cortex-text-secondary,#ccc)] hover:bg-[var(--cortex-bg-hover,#2a2d2e)]"
                onClick={goToNext}
                title="Next (Alt+↓)"
              >
                ▼
              </button>
            </Show>
            <button
              class="rounded p-0.5 text-[var(--cortex-text-secondary,#ccc)] hover:bg-[var(--cortex-bg-hover,#2a2d2e)]"
              onClick={navigateToLocation}
              title="Go to file (Enter)"
            >
              ↗
            </button>
            <button
              class="rounded p-0.5 text-[var(--cortex-text-secondary,#ccc)] hover:bg-[var(--cortex-bg-hover,#2a2d2e)]"
              onClick={handleClose}
              title="Close (Escape)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div class="max-h-[300px] overflow-auto">
          <Show when={loading()}>
            <div class="flex items-center justify-center p-4 text-xs text-[var(--cortex-text-inactive,#666)]">
              Loading...
            </div>
          </Show>
          <Show when={!loading()}>
            <div class="overflow-x-auto font-mono text-xs">
              <For each={getPreviewLines()}>
                {(line, idx) => {
                  const lineNum = getStartLineNumber() + idx();
                  const loc = currentLocation();
                  const isHighlighted = loc
                    ? lineNum >= loc.range.startLine && lineNum <= loc.range.endLine
                    : false;
                  return (
                    <div
                      class="flex whitespace-pre"
                      classList={{
                        "bg-[var(--cortex-info,#569cd6)]/10": isHighlighted,
                      }}
                    >
                      <span class="inline-block w-10 shrink-0 select-none pr-2 text-right tabular-nums text-[var(--cortex-text-inactive,#666)]">
                        {lineNum}
                      </span>
                      <span class="text-[var(--cortex-text-primary,#d4d4d4)]">{line}</span>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
