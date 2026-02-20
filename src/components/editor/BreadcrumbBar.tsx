/**
 * BreadcrumbBar - SolidJS component showing file path + symbol breadcrumbs.
 *
 * Displays hierarchical path segments from workspace root to the current
 * symbol at the cursor position. Segments are clickable for navigation.
 * Uses Tauri IPC to resolve breadcrumb paths from the backend.
 */

import { createSignal, createEffect, Show, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type { BreadcrumbSegment as BreadcrumbSegmentType } from "@/sdk/ipc";
import { editorLogger } from "@/utils/logger";

// ============================================================================
// Types
// ============================================================================

export interface BreadcrumbSegment {
  name: string;
  path: string;
  kind: "file" | "directory" | "symbol" | "module" | "class" | "function";
  line?: number;
  column?: number;
}

export interface BreadcrumbBarProps {
  filePath: string;
  line: number;
  column: number;
  workspaceRoot?: string;
  onNavigate?: (segment: BreadcrumbSegment) => void;
}

// ============================================================================
// Component
// ============================================================================

export function BreadcrumbBar(props: BreadcrumbBarProps) {
  const [segments, setSegments] = createSignal<BreadcrumbSegment[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [hoveredIndex, setHoveredIndex] = createSignal<number | null>(null);

  async function fetchBreadcrumbs() {
    if (!props.filePath) {
      setSegments([]);
      return;
    }

    setLoading(true);
    try {
      const result = await invoke<BreadcrumbSegmentType[]>("get_breadcrumb_path", {
        filePath: props.filePath,
        line: props.line,
        column: props.column,
      });
      // Map the backend response to our local BreadcrumbSegment type
      setSegments(result.map(s => ({
        name: s.name,
        path: props.filePath,
        kind: s.kind as BreadcrumbSegment["kind"],
        line: s.line,
        column: s.column,
      })));
    } catch (error) {
      editorLogger.warn("[BreadcrumbBar] Failed to fetch breadcrumbs:", error);
      setSegments(buildFallbackSegments(props.filePath, props.workspaceRoot));
    } finally {
      setLoading(false);
    }
  }

  function buildFallbackSegments(filePath: string, workspaceRoot?: string): BreadcrumbSegment[] {
    let relativePath = filePath;
    if (workspaceRoot && filePath.startsWith(workspaceRoot)) {
      relativePath = filePath.slice(workspaceRoot.length).replace(/^[/\\]/, "");
    }

    const parts = relativePath.split(/[/\\]/).filter(Boolean);
    const result: BreadcrumbSegment[] = [];
    let currentPath = workspaceRoot ?? "";

    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      result.push({
        name: parts[i],
        path: currentPath,
        kind: isLast ? "file" : "directory",
      });
    }

    return result;
  }

  function handleSegmentClick(segment: BreadcrumbSegment) {
    props.onNavigate?.(segment);
  }

  function getSegmentIcon(kind: BreadcrumbSegment["kind"]): string {
    switch (kind) {
      case "directory": return "📁";
      case "file": return "📄";
      case "symbol": return "🔣";
      case "module": return "📦";
      case "class": return "🔷";
      case "function": return "ƒ";
    }
  }

  createEffect(() => {
    void props.filePath;
    void props.line;
    void props.column;
    fetchBreadcrumbs();
  });

  return (
    <div class="flex h-[22px] items-center overflow-hidden border-b border-[var(--cortex-border,#333)] bg-[var(--cortex-bg-primary,#1e1e1e)] px-2 text-xs">
      <Show when={loading()}>
        <span class="animate-pulse text-[var(--cortex-text-inactive,#666)]">Loading...</span>
      </Show>

      <Show when={!loading()}>
        <nav class="flex items-center gap-0 overflow-hidden" aria-label="Breadcrumb">
          <For each={segments()}>
            {(segment, index) => (
              <>
                <Show when={index() > 0}>
                  <span class="mx-1 text-[var(--cortex-text-inactive,#666)]" aria-hidden="true">
                    ›
                  </span>
                </Show>
                <button
                  class="flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[var(--cortex-text-secondary,#ccc)] transition-colors hover:bg-[var(--cortex-bg-hover,#2a2d2e)] hover:text-[var(--cortex-text-primary,#fff)]"
                  classList={{
                    "bg-[var(--cortex-bg-hover,#2a2d2e)]": hoveredIndex() === index(),
                    "font-medium text-[var(--cortex-text-primary,#fff)]": index() === segments().length - 1,
                  }}
                  onClick={() => handleSegmentClick(segment)}
                  onMouseEnter={() => setHoveredIndex(index())}
                  onMouseLeave={() => setHoveredIndex(null)}
                  title={segment.path}
                >
                  <span class="text-[10px]" aria-hidden="true">{getSegmentIcon(segment.kind)}</span>
                  <span class="max-w-[120px] truncate">{segment.name}</span>
                </button>
              </>
            )}
          </For>
        </nav>
      </Show>
    </div>
  );
}