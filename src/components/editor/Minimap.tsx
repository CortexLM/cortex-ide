/**
 * Minimap - SolidJS component for minimap navigation with decorations overlay.
 *
 * Renders a scaled-down overview of the document with decoration highlights,
 * a scroll position indicator, and click-to-navigate functionality.
 */

import { createSignal, createEffect, onMount, onCleanup, createMemo } from "solid-js";
import type * as Monaco from "monaco-editor";

// ============================================================================
// Types
// ============================================================================

interface DecorationHighlight {
  startLine: number;
  endLine: number;
  color: string;
}

export interface MinimapProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  enabled?: boolean;
  onNavigate?: (line: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function Minimap(props: MinimapProps) {
  const [totalLines, setTotalLines] = createSignal(1);
  const [visibleStart, setVisibleStart] = createSignal(1);
  const [visibleEnd, setVisibleEnd] = createSignal(1);
  const [decorations, setDecorations] = createSignal<DecorationHighlight[]>([]);
  const [containerHeight, setContainerHeight] = createSignal(0);

  let canvasRef: HTMLCanvasElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  const enabled = createMemo(() => props.enabled ?? true);

  const viewportRatio = createMemo(() => {
    const total = totalLines();
    if (total <= 0) return { top: 0, height: 100 };
    const top = ((visibleStart() - 1) / total) * 100;
    const height = ((visibleEnd() - visibleStart() + 1) / total) * 100;
    return { top, height: Math.max(height, 2) };
  });

  function updateViewport() {
    const editor = props.editor;
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    setTotalLines(model.getLineCount());

    const ranges = editor.getVisibleRanges();
    if (ranges.length > 0) {
      setVisibleStart(ranges[0].startLineNumber);
      setVisibleEnd(ranges[ranges.length - 1].endLineNumber);
    }
  }

  function updateDecorations() {
    const editor = props.editor;
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    const editorDecorations = model.getAllDecorations();
    const highlights: DecorationHighlight[] = [];

    for (const dec of editorDecorations) {
      const opts = dec.options;
      if (opts.overviewRuler?.color) {
        highlights.push({
          startLine: dec.range.startLineNumber,
          endLine: dec.range.endLineNumber,
          color: String(opts.overviewRuler.color),
        });
      } else if (opts.className?.includes("error")) {
        highlights.push({
          startLine: dec.range.startLineNumber,
          endLine: dec.range.endLineNumber,
          color: "#f14c4c",
        });
      } else if (opts.className?.includes("warning")) {
        highlights.push({
          startLine: dec.range.startLineNumber,
          endLine: dec.range.endLineNumber,
          color: "#cca700",
        });
      }
    }

    setDecorations(highlights);
  }

  function renderCanvas() {
    const canvas = canvasRef;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const height = containerHeight();
    const width = canvas.width;
    const total = totalLines();

    ctx.clearRect(0, 0, width, height);

    if (total <= 0) return;

    for (const dec of decorations()) {
      const y = ((dec.startLine - 1) / total) * height;
      const h = Math.max(((dec.endLine - dec.startLine + 1) / total) * height, 2);
      ctx.fillStyle = dec.color;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(0, y, width, h);
    }

    ctx.globalAlpha = 1;
  }

  function handleClick(e: MouseEvent) {
    const container = containerRef;
    if (!container || !props.editor) return;

    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = y / rect.height;
    const line = Math.max(1, Math.round(ratio * totalLines()));

    props.editor.revealLineInCenter(line);
    props.editor.setPosition({ lineNumber: line, column: 1 });
    props.editor.focus();
    props.onNavigate?.(line);
  }

  onMount(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
        if (canvasRef) {
          canvasRef.height = entry.contentRect.height;
          canvasRef.width = entry.contentRect.width;
        }
        renderCanvas();
      }
    });

    if (containerRef) {
      observer.observe(containerRef);
    }

    onCleanup(() => observer.disconnect());
  });

  createEffect(() => {
    const editor = props.editor;
    if (!editor || !enabled()) return;

    const disposables: Monaco.IDisposable[] = [];

    disposables.push(editor.onDidScrollChange(() => {
      updateViewport();
      renderCanvas();
    }));

    disposables.push(editor.onDidChangeModelContent(() => {
      updateViewport();
      updateDecorations();
      renderCanvas();
    }));

    disposables.push(editor.onDidChangeModel(() => {
      updateViewport();
      updateDecorations();
      renderCanvas();
    }));

    disposables.push(editor.onDidChangeModelDecorations(() => {
      updateDecorations();
      renderCanvas();
    }));

    updateViewport();
    updateDecorations();
    renderCanvas();

    onCleanup(() => {
      disposables.forEach((d) => d.dispose());
    });
  });

  createEffect(() => {
    renderCanvas();
  });

  if (!enabled()) return null;

  return (
    <div
      ref={containerRef}
      class="relative h-full w-14 cursor-pointer select-none border-l border-[var(--cortex-border,#333)]"
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        class="absolute inset-0 h-full w-full"
      />
      <div
        class="absolute left-0 right-0 border border-[var(--cortex-info,#569cd6)] bg-[var(--cortex-info,#569cd6)]/20 transition-[top,height] duration-75"
        style={{
          top: `${viewportRatio().top}%`,
          height: `${viewportRatio().height}%`,
        }}
      />
    </div>
  );
}
