import { createSignal, onMount, onCleanup, Show, createEffect } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/design-system/tokens";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

interface TaskOutputLine {
  text: string;
  isStderr: boolean;
  timestamp: number;
}

export interface TaskOutputChannelProps {
  taskId: string;
  taskLabel?: string;
  status?: "running" | "completed" | "failed" | "cancelled";
  onClose?: () => void;
  onRerun?: () => void;
}

export function TaskOutputChannel(props: TaskOutputChannelProps) {
  const [lines, setLines] = createSignal<TaskOutputLine[]>([]);
  const [autoScroll, setAutoScroll] = createSignal(true);
  const [wordWrap, setWordWrap] = createSignal(true);
  let containerRef: HTMLDivElement | undefined;
  let unlisten: UnlistenFn | undefined;

  onMount(async () => {
    unlisten = await listen<{ taskId: string; line: string; isStderr: boolean }>(
      "task:output",
      (ev) => {
        if (ev.payload.taskId === props.taskId) {
          setLines((prev) => [
            ...prev,
            { text: ev.payload.line, isStderr: ev.payload.isStderr, timestamp: Date.now() },
          ]);
        }
      }
    );
  });

  onCleanup(() => { unlisten?.(); });

  createEffect(() => {
    if (autoScroll() && containerRef && lines().length > 0) {
      requestAnimationFrame(() => {
        if (containerRef) containerRef.scrollTop = containerRef.scrollHeight;
      });
    }
  });

  const handleScroll = () => {
    if (!containerRef) return;
    const atBottom = containerRef.scrollHeight - containerRef.scrollTop - containerRef.clientHeight < 50;
    setAutoScroll(atBottom);
  };

  const clearOutput = () => setLines([]);

  const copyOutput = async () => {
    const text = lines().map((l) => l.text).join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      console.debug("Failed to copy output");
    }
  };

  const statusColor = () => {
    switch (props.status) {
      case "running": return tokens.colors.semantic.info;
      case "completed": return tokens.colors.semantic.success;
      case "failed": return tokens.colors.semantic.error;
      case "cancelled": return tokens.colors.semantic.warning;
      default: return tokens.colors.text.muted;
    }
  };

  const statusIcon = () => {
    switch (props.status) {
      case "running": return "spinner";
      case "completed": return "circle-check";
      case "failed": return "circle-xmark";
      case "cancelled": return "ban";
      default: return "circle";
    }
  };

  return (
    <div class="flex flex-col h-full overflow-hidden" style={{ background: tokens.colors.surface.canvas }}>
      <div class="flex items-center justify-between px-3 py-1.5 border-b shrink-0" style={{ "border-color": tokens.colors.border.divider }}>
        <div class="flex items-center gap-2">
          <Icon
            name={statusIcon()}
            class={`w-4 h-4 ${props.status === "running" ? "animate-spin" : ""}`}
            style={{ color: statusColor() }}
          />
          <span class="text-sm font-medium" style={{ color: tokens.colors.text.primary }}>
            {props.taskLabel || props.taskId}
          </span>
          <Show when={props.status}>
            <span class="text-xs px-1.5 py-0.5 rounded" style={{ background: `color-mix(in srgb, ${statusColor()} 15%, transparent)`, color: statusColor() }}>
              {props.status}
            </span>
          </Show>
          <span class="text-xs" style={{ color: tokens.colors.text.muted }}>
            {lines().length} lines
          </span>
        </div>
        <div class="flex items-center gap-1">
          <button class="p-1 rounded hover:bg-white/10" onClick={() => setWordWrap(!wordWrap())} title={wordWrap() ? "Disable word wrap" : "Enable word wrap"}>
            <Icon name="text-width" class="w-3.5 h-3.5" style={{ color: wordWrap() ? tokens.colors.semantic.primary : tokens.colors.text.muted }} />
          </button>
          <button class="p-1 rounded hover:bg-white/10" onClick={() => setAutoScroll(!autoScroll())} title={autoScroll() ? "Disable auto-scroll" : "Enable auto-scroll"}>
            <Icon name="arrow-down" class="w-3.5 h-3.5" style={{ color: autoScroll() ? tokens.colors.semantic.primary : tokens.colors.text.muted }} />
          </button>
          <button class="p-1 rounded hover:bg-white/10" onClick={copyOutput} title="Copy output">
            <Icon name="copy" class="w-3.5 h-3.5" style={{ color: tokens.colors.text.muted }} />
          </button>
          <button class="p-1 rounded hover:bg-white/10" onClick={clearOutput} title="Clear output">
            <Icon name="trash" class="w-3.5 h-3.5" style={{ color: tokens.colors.text.muted }} />
          </button>
          <Show when={props.onRerun}>
            <button class="p-1 rounded hover:bg-white/10" onClick={props.onRerun} title="Rerun task" disabled={props.status === "running"}>
              <Icon name="rotate" class="w-3.5 h-3.5" style={{ color: tokens.colors.text.muted }} />
            </button>
          </Show>
          <Show when={props.onClose}>
            <button class="p-1 rounded hover:bg-white/10" onClick={props.onClose} title="Close">
              <Icon name="xmark" class="w-3.5 h-3.5" style={{ color: tokens.colors.text.muted }} />
            </button>
          </Show>
        </div>
      </div>

      <div
        ref={containerRef}
        class="flex-1 overflow-auto font-mono text-xs p-2"
        onScroll={handleScroll}
        style={{ "white-space": wordWrap() ? "pre-wrap" : "pre", "word-break": wordWrap() ? "break-all" : "normal" }}
      >
        <Show when={lines().length === 0}>
          <div class="flex items-center justify-center h-full" style={{ color: tokens.colors.text.muted }}>
            <Show when={props.status === "running"} fallback={<span>No output</span>}>
              <span>Waiting for output...</span>
            </Show>
          </div>
        </Show>
        {lines().map((line) => (
          <div style={{ color: line.isStderr ? tokens.colors.semantic.error : tokens.colors.text.primary }}>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
