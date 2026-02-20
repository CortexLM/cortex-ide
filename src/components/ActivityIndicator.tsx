import { Show, For, createSignal, createEffect, onCleanup } from "solid-js";
import {
  useActivityIndicator,
  type ActivityTask,
  type TaskHistoryEntry,
  type TaskSource,
} from "@/context/ActivityIndicatorContext";
import { Icon } from "./ui/Icon";
import { LoadingSpinner, ProgressBar } from "@/components/ui";

// ============================================================================
// Source Icons
// ============================================================================

function getSourceIcon(source: TaskSource) {
  switch (source) {
    case "lsp":
      return <Icon name="code" size={12} />;
    case "git":
      return <Icon name="code-branch" size={12} />;
    case "build":
      return <Icon name="terminal" size={12} />;
    case "format":
      return <Icon name="code" size={12} />;
    case "remote":
      return <Icon name="server" size={12} />;
    case "extension":
      return <Icon name="box" size={12} />;
    case "auto-update":
      return <Icon name="download" size={12} />;
    case "repl":
      return <Icon name="play" size={12} />;
    case "debug":
      return <Icon name="bolt" size={12} />;
    case "mcp":
      return <Icon name="server" size={12} />;
    case "system":
      return <Icon name="gear" size={12} />;
    default:
      return <Icon name="spinner" size={12} />;
  }
}



// ============================================================================
// Duration Formatter
// ============================================================================

function formatDuration(ms: number | undefined): string {
  if (ms === undefined || ms === null || isNaN(ms)) return "-";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ============================================================================
// Task Item Component
// ============================================================================

interface TaskItemProps {
  task: ActivityTask;
  onCancel?: (taskId: string) => void;
  compact?: boolean;
}

function TaskItem(props: TaskItemProps) {
  return (
    <div
      class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors group"
      style={{ "min-height": "32px" }}
    >
      {/* Source icon with spinner overlay for running tasks */}
      <div class="relative flex-shrink-0">
        <span style={{ color: "var(--text-weak)" }}>
          {getSourceIcon(props.task.source)}
        </span>
        <Show when={props.task.status === "running"}>
          <div class="absolute inset-0 flex items-center justify-center">
            <LoadingSpinner
              size={14}
              style={{ color: "var(--accent)" }}
            />
          </div>
        </Show>
      </div>

      {/* Task info */}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="text-xs font-medium truncate"
            style={{ color: "var(--text-base)" }}
          >
            {props.task.title}
          </span>
          <Show when={props.task.progress !== undefined}>
            <span
              class="text-[10px] tabular-nums"
              style={{ color: "var(--text-weak)" }}
            >
              {Math.round(props.task.progress!)}%
            </span>
          </Show>
        </div>
        <Show when={props.task.message && !props.compact}>
          <p
            class="text-[10px] truncate"
            style={{ color: "var(--text-weaker)" }}
          >
            {props.task.message}
          </p>
        </Show>
        {/* Progress bar */}
        <Show when={props.task.progress !== undefined}>
          <div
            class="h-1 rounded-full mt-1 overflow-hidden"
            style={{ background: "var(--surface-raised)" }}
          >
            <div
              class="h-full rounded-full transition-all duration-300"
              style={{
                background: "var(--accent)",
                width: `${props.task.progress}%`,
              }}
            />
          </div>
        </Show>
      </div>

      {/* Cancel button */}
      <Show when={props.task.cancellable && props.onCancel}>
        <button
          class="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
          style={{ color: "var(--text-weak)" }}
          onClick={(e) => {
            e.stopPropagation();
            props.onCancel?.(props.task.id);
          }}
          title="Cancel task"
        >
          <Icon name="xmark" size={14} />
        </button>
      </Show>
    </div>
  );
}

// ============================================================================
// History Item Component
// ============================================================================

interface HistoryItemProps {
  entry: TaskHistoryEntry;
}

function HistoryItem(props: HistoryItemProps) {
  const statusIcon = () => {
    switch (props.entry.status) {
      case "completed":
        return <Icon name="check" size={12} style={{ color: "var(--success)" }} />;
      case "failed":
        return <Icon name="circle-exclamation" size={12} style={{ color: "var(--error)" }} />;
      case "cancelled":
        return <Icon name="xmark" size={12} style={{ color: "var(--warning)" }} />;
    }
  };

  return (
    <div
      class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
      title={props.entry.error || undefined}
    >
      {/* Status icon */}
      <div class="flex-shrink-0">{statusIcon()}</div>

      {/* Source icon */}
      <span style={{ color: "var(--text-weaker)" }}>
        {getSourceIcon(props.entry.source)}
      </span>

      {/* Info */}
      <div class="flex-1 min-w-0">
        <span
          class="text-xs truncate block"
          style={{ color: "var(--text-weak)" }}
        >
          {props.entry.title}
        </span>
      </div>

      {/* Duration */}
      <span
        class="text-[10px] tabular-nums flex-shrink-0"
        style={{ color: "var(--text-weaker)" }}
      >
        {formatDuration(props.entry.duration)}
      </span>

      {/* Time ago */}
      <span
        class="text-[10px] flex-shrink-0"
        style={{ color: "var(--text-weaker)" }}
      >
        {formatRelativeTime(props.entry.completedAt)}
      </span>
    </div>
  );
}

// ============================================================================
// Activity Indicator (Status Bar)
// ============================================================================

export function ActivityIndicator() {
  const activity = useActivityIndicator();
  const [showPopup, setShowPopup] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<"active" | "history">("active");
  let popupRef: HTMLDivElement | undefined;
  let triggerRef: HTMLButtonElement | undefined;

  // Close popup when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    if (
      popupRef &&
      triggerRef &&
      !popupRef.contains(e.target as Node) &&
      !triggerRef.contains(e.target as Node)
    ) {
      setShowPopup(false);
    }
  };

  createEffect(() => {
    if (showPopup()) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  // Auto-switch to active tab when tasks start
  createEffect(() => {
    if (activity.hasActiveTasks() && activeTab() === "history") {
      setActiveTab("active");
    }
  });

  const primaryTask = () => activity.primaryTask();
  const activeTasks = () => activity.activeTasks();
  const history = () => activity.state.history;

  // Don't render if no active tasks and no history
  const shouldRender = () => activity.hasActiveTasks() || history().length > 0;

  return (
    <Show when={shouldRender()}>
      <div class="relative">
        {/* Trigger Button */}
        <button
          ref={triggerRef}
          class="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/5 transition-colors"
          style={{
            color: activity.hasActiveTasks()
              ? "var(--accent)"
              : "var(--text-weak)",
          }}
          onClick={() => setShowPopup(!showPopup())}
          title={
            activity.hasActiveTasks()
              ? `${activity.activeTaskCount()} active task${activity.activeTaskCount() > 1 ? "s" : ""}`
              : "View task history"
          }
        >
          {/* Spinner or history icon - uses VS Code codicon-spin (1.5s, steps(30)) */}
          <Show
            when={activity.hasActiveTasks()}
            fallback={<Icon name="clock" size={14} />}
          >
            <LoadingSpinner size={14} />
          </Show>

          {/* Primary task label */}
          <Show when={primaryTask()}>
            <span class="text-xs max-w-32 truncate">
              {primaryTask()!.title}
              <Show when={primaryTask()!.progress !== undefined}>
                <span class="ml-1 tabular-nums">
                  ({Math.round(primaryTask()!.progress!)}%)
                </span>
              </Show>
            </span>
          </Show>

          {/* Additional task count */}
          <Show when={activity.activeTaskCount() > 1}>
            <span
              class="text-[10px] px-1 rounded"
              style={{
                background: "var(--surface-raised)",
                color: "var(--text-weak)",
              }}
            >
              +{activity.activeTaskCount() - 1}
            </span>
          </Show>

          {/* Expand indicator */}
          <Show when={showPopup()} fallback={<Icon name="chevron-up" size={12} />}>
            <Icon name="chevron-down" size={12} />
          </Show>
        </button>

        {/* Popup Panel */}
        <Show when={showPopup()}>
          <div
            ref={popupRef}
            class="absolute bottom-full right-0 mb-1 w-80 rounded-lg shadow-xl overflow-hidden z-50"
            style={{
              background: "var(--surface-base)",
              border: "1px solid var(--border-weak)",
            }}
          >
            {/* Header with tabs */}
            <div
              class="flex items-center gap-1 px-2 py-1.5"
              style={{
                background: "var(--surface-raised)",
                "border-bottom": "1px solid var(--border-weak)",
              }}
            >
              <button
                class="px-2 py-1 rounded text-xs font-medium transition-colors"
                style={{
                  background:
                    activeTab() === "active"
                      ? "var(--accent)"
                      : "transparent",
                  color:
                    activeTab() === "active" ? "white" : "var(--text-weak)",
                }}
                onClick={() => setActiveTab("active")}
              >
                Active
                <Show when={activity.activeTaskCount() > 0}>
                  <span class="ml-1 px-1 rounded-full text-[10px]" style={{
                    background: activeTab() === "active" ? "white/20" : "var(--surface-base)",
                  }}>
                    {activity.activeTaskCount()}
                  </span>
                </Show>
              </button>
              <button
                class="px-2 py-1 rounded text-xs font-medium transition-colors"
                style={{
                  background:
                    activeTab() === "history"
                      ? "var(--accent)"
                      : "transparent",
                  color:
                    activeTab() === "history" ? "white" : "var(--text-weak)",
                }}
                onClick={() => setActiveTab("history")}
              >
                History
                <Show when={history().length > 0}>
                  <span class="ml-1 px-1 rounded-full text-[10px]" style={{
                    background: activeTab() === "history" ? "white/20" : "var(--surface-base)",
                  }}>
                    {history().length}
                  </span>
                </Show>
              </button>

              <div class="flex-1" />

              {/* Clear history button */}
              <Show when={activeTab() === "history" && history().length > 0}>
                <button
                  class="p-1 rounded hover:bg-white/10 transition-colors"
                  style={{ color: "var(--text-weak)" }}
                  onClick={() => activity.clearHistory()}
                  title="Clear history"
                >
                  <Icon name="trash" size={14} />
                </button>
              </Show>
            </div>

            {/* Content */}
            <div class="max-h-64 overflow-y-auto">
              <Show when={activeTab() === "active"}>
                <Show
                  when={activeTasks().length > 0}
                  fallback={
                    <div
                      class="px-3 py-6 text-center text-xs"
                      style={{ color: "var(--text-weaker)" }}
                    >
                      No active tasks
                    </div>
                  }
                >
                  <div class="p-1">
                    <For each={activeTasks()}>
                      {(task) => (
                        <TaskItem
                          task={task}
                          onCancel={(id) => activity.cancelTask(id)}
                        />
                      )}
                    </For>
                  </div>
                </Show>
              </Show>

              <Show when={activeTab() === "history"}>
                <Show
                  when={history().length > 0}
                  fallback={
                    <div
                      class="px-3 py-6 text-center text-xs"
                      style={{ color: "var(--text-weaker)" }}
                    >
                      No task history
                    </div>
                  }
                >
                  <div class="p-1">
                    <For each={history()}>
                      {(entry) => <HistoryItem entry={entry} />}
                    </For>
                  </div>
                </Show>
              </Show>
            </div>

            {/* Footer with summary */}
            <Show when={activeTasks().length > 0}>
              <div
                class="px-3 py-2 flex items-center justify-between"
                style={{
                  background: "var(--surface-raised)",
                  "border-top": "1px solid var(--border-weak)",
                }}
              >
                <span
                  class="text-[10px]"
                  style={{ color: "var(--text-weaker)" }}
                >
                  {activeTasks().filter((t) => t.cancellable).length > 0 && (
                    <button
                      class="hover:underline"
                      style={{ color: "var(--text-weak)" }}
                      onClick={() => activity.cancelAllCancellable()}
                    >
                      Cancel all
                    </button>
                  )}
                </span>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
}

// ============================================================================
// Minimal Activity Indicator (for tight spaces)
// ============================================================================

export function ActivityIndicatorMinimal() {
  const activity = useActivityIndicator();

  return (
    <Show when={activity.hasActiveTasks()}>
      <div
        class="flex items-center gap-1"
        title={activity.primaryTask()?.title}
      >
        {/* VS Code codicon-spin: 1.5s cycle with steps(30) for CPU efficiency */}
        <LoadingSpinner
          size={12}
          style={{ color: "var(--accent)" }}
        />
        <Show when={activity.activeTaskCount() > 1}>
          <span
            class="text-[10px] tabular-nums"
            style={{ color: "var(--text-weak)" }}
          >
            {activity.activeTaskCount()}
          </span>
        </Show>
      </div>
    </Show>
  );
}

// ============================================================================
// Activity Progress Bar (for determinate progress display)
// Uses VS Code spec: 2px height, 4s infinite animation, GPU-optimized transforms
// Long-running mode activates after 10s (throttle to steps(100))
// ============================================================================

interface ActivityProgressBarProps {
  source?: TaskSource;
}

export function ActivityProgressBar(props: ActivityProgressBarProps) {
  const activity = useActivityIndicator();

  const progress = () => {
    if (props.source) {
      return activity.getSourceProgress(props.source);
    }
    const primary = activity.primaryTask();
    return primary?.progress;
  };

  const isActive = () => {
    if (props.source) {
      return activity.isSourceBusy(props.source);
    }
    return activity.hasActiveTasks();
  };

  // Use VS Code-spec ProgressBar component with:
  // - 2px height horizontal bar
  // - 4-second infinite animation with GPU transforms
  // - Long-running mode after 10s (steps(100) for CPU efficiency)
  // - Discrete mode for determinate progress (100ms transitions)
  return (
    <ProgressBar
      mode={progress() !== undefined ? "discrete" : "infinite"}
      value={progress() ?? 0}
      visible={isActive()}
    />
  );
}
