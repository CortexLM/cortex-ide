import { Show, For, createSignal } from "solid-js";
import { useDebug, type StackFrame, type Thread } from "@/context/DebugContext";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui";
import { createLogger } from "@/utils/logger";

const callStackLogger = createLogger("CallStack");

function getFrameFileName(frame: StackFrame): string {
  if (frame.source?.path) {
    return frame.source.path.split("/").pop() || frame.source.path;
  }
  return frame.source?.name || "unknown";
}

function getFrameLocation(frame: StackFrame): string {
  const file = getFrameFileName(frame);
  return `${file}:${frame.line}${frame.column > 0 ? `:${frame.column}` : ""}`;
}

function ThreadItem(props: { thread: Thread; isActive: boolean; onSelect: () => void }) {
  const stateLabel = () => props.thread.stopped ? "Paused" : "Running";
  const stateColor = () => props.thread.stopped ? "var(--cortex-warning)" : "var(--cortex-success)";

  return (
    <div
      class="flex items-center gap-1 px-2 cursor-pointer hover:bg-[var(--surface-raised)]"
      style={{
        height: "22px",
        "font-size": "12px",
        background: props.isActive ? "var(--surface-raised)" : "transparent",
      }}
      onClick={props.onSelect}
    >
      <Icon name="microchip" size={12} color="var(--text-weak)" />
      <span class="truncate" style={{ color: "var(--text-base)", "font-weight": props.isActive ? "600" : "400" }}>
        {props.thread.name}
      </span>
      <span
        style={{
          "font-size": "9px",
          "text-transform": "uppercase",
          "margin-left": "auto",
          padding: "1px 4px",
          "border-radius": "3px",
          background: stateColor(),
          color: "white",
        }}
      >
        {stateLabel()}
      </span>
    </div>
  );
}

function FrameItem(props: {
  frame: StackFrame;
  isActive: boolean;
  onSelect: () => void;
  onNavigate: () => void;
  onRestartFrame?: () => void;
}) {
  const isDeemphasized = () => props.frame.presentationHint === "deemphasize" || props.frame.presentationHint === "subtle";
  const isLabel = () => props.frame.presentationHint === "label";

  return (
    <div
      class="flex items-center gap-1 px-2 group cursor-pointer hover:bg-[var(--surface-raised)]"
      style={{
        height: "22px",
        "font-size": "12px",
        "padding-left": "20px",
        background: props.isActive ? "var(--cortex-accent-primary-15, rgba(0,120,212,0.15))" : "transparent",
        opacity: isDeemphasized() ? "0.6" : "1",
      }}
      onClick={props.onSelect}
      onDblClick={props.onNavigate}
    >
      <Show when={isLabel()}>
        <span style={{ color: "var(--text-weak)", "font-style": "italic", "font-size": "11px" }}>
          {props.frame.name}
        </span>
      </Show>
      <Show when={!isLabel()}>
        <span class="shrink-0" style={{ color: "var(--cortex-syntax-function, #dcdcaa)" }}>
          {props.frame.name}
        </span>
        <Show when={props.frame.source}>
          <span class="truncate" style={{ color: "var(--text-weak)", "margin-left": "4px" }}>
            {getFrameLocation(props.frame)}
          </span>
        </Show>
      </Show>
      <Show when={props.isActive}>
        <Icon name="arrow-right" size={10} color="var(--cortex-accent-primary)" class="shrink-0" />
      </Show>
      <Show when={props.frame.canRestart && props.onRestartFrame}>
        <div class="ml-auto shrink-0 opacity-0 group-hover:opacity-100">
          <IconButton
            size="sm"
            variant="ghost"
            onClick={(e: MouseEvent) => { e.stopPropagation(); props.onRestartFrame?.(); }}
            title="Restart Frame"
          >
            <Icon name="rotate-left" size={10} />
          </IconButton>
        </div>
      </Show>
    </div>
  );
}

export function CallStackPanel() {
  const debug = useDebug();
  const [showThreads, setShowThreads] = createSignal(true);

  const threads = () => debug.state.threads;
  const frames = () => debug.state.stackFrames;
  const activeThreadId = () => debug.state.activeThreadId;
  const activeFrameId = () => debug.state.activeFrameId;
  const hasMultipleThreads = () => threads().length > 1;

  const handleSelectThread = async (threadId: number) => {
    await debug.selectThread(threadId);
  };

  const handleSelectFrame = async (frameId: number) => {
    await debug.selectFrame(frameId);
  };

  const handleNavigateToFrame = (frame: StackFrame) => {
    if (frame.source?.path) {
      window.dispatchEvent(new CustomEvent("editor:goto", {
        detail: { path: frame.source.path, line: frame.line, column: frame.column || 1, focus: true },
      }));
    }
  };

  const handleRestartFrame = async (frameId: number) => {
    if (debug.state.capabilities?.supportsRestartFrame) {
      await debug.restartFrame(frameId);
    }
  };

  const handleCopyStack = async () => {
    const text = frames()
      .map((f) => {
        const loc = f.source?.path ? `${f.source.path}:${f.line}${f.column > 0 ? `:${f.column}` : ""}` : "unknown";
        return `${f.name} (${loc})`;
      })
      .join("\n");
    try { await navigator.clipboard.writeText(text); } catch (e) { callStackLogger.error("Clipboard write failed:", e); }
  };

  return (
    <div class="flex flex-col h-full" style={{ background: "var(--cortex-bg-primary)", color: "var(--text-base)" }}>
      <div class="flex items-center justify-between px-2 shrink-0" style={{ height: "28px", "border-bottom": "1px solid var(--surface-border)" }}>
        <span style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase" }}>Call Stack</span>
        <div class="flex gap-0.5">
          <Show when={hasMultipleThreads()}>
            <IconButton size="sm" variant="ghost" onClick={() => setShowThreads(!showThreads())} title={showThreads() ? "Hide Threads" : "Show Threads"}>
              <Icon name={showThreads() ? "eye" : "eye-slash"} size={12} />
            </IconButton>
          </Show>
          <IconButton size="sm" variant="ghost" onClick={handleCopyStack} title="Copy Call Stack">
            <Icon name="copy" size={12} />
          </IconButton>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto">
        <Show when={debug.state.isPaused} fallback={
          <div class="flex items-center justify-center p-4" style={{ color: "var(--text-weak)", "font-size": "12px" }}>
            <Show when={debug.state.isDebugging} fallback="Not debugging">
              Running...
            </Show>
          </div>
        }>
          <Show when={showThreads() && hasMultipleThreads()}>
            <For each={threads()}>
              {(thread) => (
                <ThreadItem
                  thread={thread}
                  isActive={thread.id === activeThreadId()}
                  onSelect={() => handleSelectThread(thread.id)}
                />
              )}
            </For>
            <div style={{ height: "1px", background: "var(--surface-border)", margin: "2px 0" }} />
          </Show>
          <For each={frames()}>
            {(frame) => (
              <FrameItem
                frame={frame}
                isActive={frame.id === activeFrameId()}
                onSelect={() => handleSelectFrame(frame.id)}
                onNavigate={() => handleNavigateToFrame(frame)}
                onRestartFrame={frame.canRestart ? () => handleRestartFrame(frame.id) : undefined}
              />
            )}
          </For>
          <Show when={frames().length === 0}>
            <div class="flex items-center justify-center p-4" style={{ color: "var(--text-weak)", "font-size": "12px" }}>
              No stack frames
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
