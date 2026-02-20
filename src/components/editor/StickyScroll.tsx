/**
 * StickyScroll - SolidJS component for sticky scroll scope display.
 *
 * Shows parent scope context lines (functions, classes, etc.) pinned at the
 * top of the editor viewport as the user scrolls through code. Uses Tauri IPC
 * to resolve scope lines from the backend.
 */

import { createSignal, createEffect, onCleanup, Show, For, createMemo } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type * as Monaco from "monaco-editor";
import type { StickyScrollLineEntry } from "@/sdk/ipc";
import { editorLogger } from "@/utils/logger";

// ============================================================================
// Types
// ============================================================================

interface StickyLine {
  lineNumber: number;
  text: string;
  depth: number;
}

export interface StickyScrollProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  enabled?: boolean;
  maxLineCount?: number;
  onLineClick?: (line: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function StickyScroll(props: StickyScrollProps) {
  const [stickyLines, setStickyLines] = createSignal<StickyLine[]>([]);
  const [hoveredLine, setHoveredLine] = createSignal<number | null>(null);

  const enabled = createMemo(() => props.enabled ?? true);
  const maxLines = createMemo(() => props.maxLineCount ?? 5);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function fetchStickyLines() {
    const editor = props.editor;
    if (!editor || !enabled()) {
      setStickyLines([]);
      return;
    }

    const model = editor.getModel();
    if (!model) return;

    const ranges = editor.getVisibleRanges();
    if (ranges.length === 0) return;

    const firstVisibleLine = ranges[0].startLineNumber;
    const content = model.getValue();
    // Determine language from model
    const languageId = (model as unknown as { getLanguageId: () => string }).getLanguageId?.() || "typescript";

    try {
      const result = await invoke<StickyScrollLineEntry[]>("get_sticky_scroll_lines", {
        content,
        language: languageId,
        visibleStartLine: firstVisibleLine,
      });
      // Map backend StickyScrollLineEntry to local StickyLine type
      setStickyLines(result.slice(0, maxLines()).map((entry: StickyScrollLineEntry) => ({
        lineNumber: entry.line,
        text: entry.text,
        depth: entry.indentLevel,
      })));
    } catch (error) {
      editorLogger.warn("[StickyScroll] Failed to fetch sticky lines:", error);
      setStickyLines(computeFallbackLines(model, firstVisibleLine));
    }
  }

  function computeFallbackLines(
    model: Monaco.editor.ITextModel,
    firstVisibleLine: number,
  ): StickyLine[] {
    const result: StickyLine[] = [];
    const lineCount = model.getLineCount();

    for (let line = firstVisibleLine - 1; line >= 1 && result.length < maxLines(); line--) {
      const text = model.getLineContent(line);
      const trimmed = text.trim();
      if (!trimmed) continue;

      const indent = text.search(/\S/);
      if (indent < 0) continue;

      const isScope = /^\s*(export\s+)?(async\s+)?(function|class|interface|enum|namespace|module|struct|impl|trait|def|fn|func)\b/.test(text)
        || /^\s*(pub\s+)?(fn|struct|enum|impl|trait|mod)\b/.test(text);

      if (!isScope) continue;

      const endLine = findScopeEnd(model, line, indent, lineCount);
      if (endLine >= firstVisibleLine) {
        result.unshift({
          lineNumber: line,
          text: trimmed.replace(/\s*[{:]\s*$/, "").slice(0, 100),
          depth: Math.floor(indent / 2),
        });
      }
    }

    return result.slice(-maxLines());
  }

  function findScopeEnd(
    model: Monaco.editor.ITextModel,
    startLine: number,
    startIndent: number,
    lineCount: number,
  ): number {
    for (let i = startLine + 1; i <= lineCount; i++) {
      const text = model.getLineContent(i);
      const trimmed = text.trim();
      if (!trimmed) continue;
      const indent = text.search(/\S/);
      if (indent >= 0 && indent <= startIndent && trimmed !== "}") {
        return i - 1;
      }
    }
    return lineCount;
  }

  function handleLineClick(lineNumber: number) {
    const editor = props.editor;
    if (!editor) return;

    editor.revealLineInCenter(lineNumber);
    editor.setPosition({ lineNumber, column: 1 });
    editor.focus();
    props.onLineClick?.(lineNumber);
  }

  function debouncedFetch() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetchStickyLines();
      debounceTimer = null;
    }, 50);
  }

  createEffect(() => {
    const editor = props.editor;
    if (!editor || !enabled()) {
      setStickyLines([]);
      return;
    }

    const disposables: Monaco.IDisposable[] = [];

    disposables.push(editor.onDidScrollChange(debouncedFetch));
    disposables.push(editor.onDidChangeModelContent(debouncedFetch));
    disposables.push(editor.onDidChangeModel(() => {
      fetchStickyLines();
    }));

    fetchStickyLines();

    onCleanup(() => {
      disposables.forEach((d) => d.dispose());
      if (debounceTimer) clearTimeout(debounceTimer);
    });
  });

  return (
    <Show when={enabled() && stickyLines().length > 0}>
      <div class="absolute left-0 right-0 top-0 z-10 select-none border-b border-[var(--cortex-border,#333)] bg-[var(--cortex-bg-primary,#1e1e1e)]">
        <For each={stickyLines()}>
          {(line) => (
            <div
              class="flex h-5 cursor-pointer items-center overflow-hidden whitespace-nowrap px-2 font-mono text-xs text-[var(--cortex-text-secondary,#ccc)] transition-colors hover:bg-[var(--cortex-bg-hover,#2a2d2e)]"
              classList={{
                "bg-[var(--cortex-bg-hover,#2a2d2e)]": hoveredLine() === line.lineNumber,
              }}
              style={{ "padding-left": `${line.depth * 16 + 8}px` }}
              onClick={() => handleLineClick(line.lineNumber)}
              onMouseEnter={() => setHoveredLine(line.lineNumber)}
              onMouseLeave={() => setHoveredLine(null)}
              title={`Line ${line.lineNumber}: ${line.text}`}
            >
              <span class="mr-2 w-8 text-right tabular-nums text-[var(--cortex-text-inactive,#666)] opacity-0 transition-opacity group-hover:opacity-100">
                {line.lineNumber}
              </span>
              <span class="truncate">{line.text}</span>
            </div>
          )}
        </For>
        <div class="pointer-events-none h-1 bg-gradient-to-b from-black/20 to-transparent" />
      </div>
    </Show>
  );
}
