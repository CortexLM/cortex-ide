/**
 * TaskStatusBar - Status bar indicator for running/background tasks
 *
 * Features:
 * - Shows count of running tasks
 * - Shows background task status (watching, compiling)
 * - Click to open tasks panel
 * - Hover tooltip with task details
 * - Progress animation for running tasks
 */

import { createSignal, createMemo, Show, For, onMount, onCleanup } from "solid-js";
import { Icon } from "../ui/Icon";
import { useTasks, type TaskRun } from "@/context/TasksContext";

// ============================================================================
// Main Status Bar Component
// ============================================================================

export function TaskStatusBarItem() {
  const tasks = useTasks();
  const [showPopup, setShowPopup] = createSignal(false);
  let popupRef: HTMLDivElement | undefined;
  let buttonRef: HTMLButtonElement | undefined;

  // Close popup when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    if (
      popupRef &&
      !popupRef.contains(e.target as Node) &&
      buttonRef &&
      !buttonRef.contains(e.target as Node)
    ) {
      setShowPopup(false);
    }
  };

  onMount(() => {
    document.addEventListener("click", handleClickOutside);
    onCleanup(() => document.removeEventListener("click", handleClickOutside));
  });

  // Counts
  const runningCount = createMemo(() => tasks.state.runningTasks.length);
  const backgroundCount = createMemo(() => tasks.state.backgroundTasks.length);
  const totalCount = createMemo(() => runningCount() + backgroundCount());

  // Check if any background task is compiling
  const isCompiling = createMemo(() =>
    tasks.state.backgroundTasks.some((t) => t.backgroundStatus === "compiling")
  );

  // Get the most relevant status
  const primaryStatus = createMemo((): "idle" | "running" | "compiling" | "watching" => {
    if (runningCount() > 0) return "running";
    if (isCompiling()) return "compiling";
    if (backgroundCount() > 0) return "watching";
    return "idle";
  });

  // Get status color
  const statusColor = createMemo(() => {
    switch (primaryStatus()) {
      case "running":
        return "var(--cortex-info)";
      case "compiling":
        return "var(--cortex-warning)";
      case "watching":
        return "var(--cortex-success)";
      default:
        return "var(--text-weak)";
    }
  });

  // Don't show if nothing is running
  if (totalCount() === 0) {
    return null;
  }

  return (
    <div class="relative">
      {/* Status Bar Button */}
      <button
        ref={buttonRef}
        class="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[var(--surface-hover)] transition-colors"
        onClick={() => setShowPopup(!showPopup())}
        title={`${totalCount()} task(s) active`}
      >
        {/* Icon */}
        <Show when={primaryStatus() === "running" || primaryStatus() === "compiling"}>
          <Icon
            name="spinner"
            class="w-3.5 h-3.5 animate-spin"
            style={{ color: statusColor() }}
          />
        </Show>
        <Show when={primaryStatus() === "watching"}>
          <Icon name="eye" class="w-3.5 h-3.5" style={{ color: statusColor() }} />
        </Show>

        {/* Label */}
        <span class="text-xs" style={{ color: statusColor() }}>
          <Show when={runningCount() > 0}>
            {runningCount()} running
          </Show>
          <Show when={runningCount() > 0 && backgroundCount() > 0}>
            {" / "}
          </Show>
          <Show when={backgroundCount() > 0}>
            {backgroundCount()} watching
          </Show>
        </span>

        <Icon
          name="chevron-up"
          class="w-3 h-3 transition-transform"
          style={{
            color: "var(--text-weak)",
            transform: showPopup() ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Popup */}
      <Show when={showPopup()}>
        <div
          ref={popupRef}
          class="absolute bottom-full left-0 mb-1 w-80 rounded-lg shadow-lg overflow-hidden"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-base)",
          }}
        >
          {/* Header */}
          <div
            class="flex items-center justify-between px-3 py-2 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <span class="text-xs font-medium" style={{ color: "var(--text-base)" }}>
              Running Tasks
            </span>
            <button
              class="p-1 rounded hover:bg-[var(--surface-hover)]"
              onClick={() => tasks.openTasksPanel()}
              title="Open Tasks Panel"
            >
              <Icon name="play" class="w-3 h-3" style={{ color: "var(--text-weak)" }} />
            </button>
          </div>

          {/* Task List */}
          <div class="max-h-60 overflow-y-auto">
            {/* Running Tasks */}
            <Show when={tasks.state.runningTasks.length > 0}>
              <div class="px-2 py-1 text-[10px] font-medium" style={{ color: "var(--text-weak)" }}>
                RUNNING
              </div>
              <For each={tasks.state.runningTasks}>
                {(run) => <RunningTaskItem run={run} />}
              </For>
            </Show>

            {/* Background Tasks */}
            <Show when={tasks.state.backgroundTasks.length > 0}>
              <div class="px-2 py-1 text-[10px] font-medium" style={{ color: "var(--text-weak)" }}>
                WATCHING
              </div>
              <For each={tasks.state.backgroundTasks}>
                {(run) => <BackgroundTaskItem run={run} />}
              </For>
            </Show>
          </div>

          {/* Footer */}
          <div
            class="flex items-center justify-end gap-2 px-3 py-2 border-t"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <button
              class="text-xs px-2 py-1 rounded hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--text-weak)" }}
              onClick={() => {
                setShowPopup(false);
                tasks.openTasksPanel();
              }}
            >
              Show All
            </button>
            <button
              class="text-xs px-2 py-1 rounded hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--text-weak)" }}
              onClick={() => {
                setShowPopup(false);
                tasks.openRunDialog();
              }}
            >
              Run Task...
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Running Task Item Component
// ============================================================================

interface RunningTaskItemProps {
  run: TaskRun;
}

function RunningTaskItem(props: RunningTaskItemProps) {
  const tasks = useTasks();

  const formatDuration = (start: number) => {
    const duration = Date.now() - start;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(0)}s`;
    return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
  };

  return (
    <div
      class="flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-hover)] group"
    >
      <Icon name="spinner" class="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: "var(--cortex-info)" }} />

      <div class="flex-1 min-w-0">
        <div class="text-xs truncate" style={{ color: "var(--text-base)" }}>
          {props.run.taskLabel}
        </div>
        <div class="text-[10px]" style={{ color: "var(--text-weak)" }}>
          Running for {formatDuration(props.run.startedAt)}
        </div>
      </div>

      <button
        class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20"
        onClick={() => tasks.cancelTask(props.run.id)}
        title="Cancel"
      >
        <Icon name="stop" class="w-3 h-3 text-red-400" />
      </button>
    </div>
  );
}

// ============================================================================
// Background Task Item Component
// ============================================================================

interface BackgroundTaskItemProps {
  run: TaskRun;
}

function BackgroundTaskItem(props: BackgroundTaskItemProps) {
  const tasks = useTasks();

  const getStatusIcon = () => {
    switch (props.run.backgroundStatus) {
      case "watching":
        return <Icon name="eye" class="w-3.5 h-3.5" style={{ color: "var(--cortex-success)" }} />;
      case "compiling":
        return <Icon name="spinner" class="w-3.5 h-3.5 animate-spin" style={{ color: "var(--cortex-warning)" }} />;
      case "error":
        return <Icon name="xmark" class="w-3.5 h-3.5" style={{ color: "var(--cortex-error)" }} />;
      default:
        return <Icon name="eye" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />;
    }
  };

  const getStatusText = () => {
    switch (props.run.backgroundStatus) {
      case "watching":
        return "Watching";
      case "compiling":
        return "Compiling...";
      case "error":
        return "Error";
      default:
        return "Running";
    }
  };

  return (
    <div
      class="flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-hover)] group"
    >
      {getStatusIcon()}

      <div class="flex-1 min-w-0">
        <div class="text-xs truncate" style={{ color: "var(--text-base)" }}>
          {props.run.taskLabel}
        </div>
        <div class="text-[10px]" style={{ color: "var(--text-weak)" }}>
          {getStatusText()}
        </div>
      </div>

      <button
        class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20"
        onClick={() => tasks.stopBackgroundTask(props.run.id)}
        title="Stop"
      >
        <Icon name="stop" class="w-3 h-3 text-red-400" />
      </button>
    </div>
  );
}

// ============================================================================
// Compact Status Bar (for minimal display)
// ============================================================================

export function TaskStatusBarCompact() {
  const tasks = useTasks();

  const runningCount = createMemo(() => tasks.state.runningTasks.length);
  const backgroundCount = createMemo(() => tasks.state.backgroundTasks.length);
  const totalCount = createMemo(() => runningCount() + backgroundCount());

  const isCompiling = createMemo(() =>
    tasks.state.backgroundTasks.some((t) => t.backgroundStatus === "compiling")
  );

  // Don't show if nothing is running
  if (totalCount() === 0) {
    return null;
  }

  return (
    <button
      class="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--surface-hover)]"
      onClick={() => tasks.openTasksPanel()}
      title={`${totalCount()} task(s) active`}
    >
      <Show when={runningCount() > 0 || isCompiling()}>
        <Icon name="spinner" class="w-3 h-3 animate-spin" style={{ color: isCompiling() ? "var(--cortex-warning)" : "var(--cortex-info)" }} />
      </Show>
      <Show when={runningCount() === 0 && backgroundCount() > 0 && !isCompiling()}>
        <Icon name="eye" class="w-3 h-3" style={{ color: "var(--cortex-success)" }} />
      </Show>
      <span class="text-[10px]" style={{ color: "var(--text-weak)" }}>
        {totalCount()}
      </span>
    </button>
  );
}

// ============================================================================
// Export all components
// ============================================================================

export default TaskStatusBarItem;

