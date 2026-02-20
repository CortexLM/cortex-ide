/**
 * TaskQuickPick - VS Code-style quick picker for running tasks
 *
 * Features:
 * - Fuzzy search across task labels, commands, and groups
 * - Group tasks by type (build, test, custom, recent)
 * - Show recent tasks first
 * - Keyboard navigation with preview
 * - Run in terminal vs SDK toggle
 * - Quick access to configure and refresh
 */

import { createSignal, createEffect, createMemo, Show, For } from "solid-js";
import { Icon } from "../ui/Icon";
import { useTasks, type TaskConfig, type TaskGroup } from "@/context/TasksContext";

// ============================================================================
// Types
// ============================================================================

interface TaskQuickPickItem {
  task: TaskConfig;
  isRecent: boolean;
  lastRun?: number;
  runCount?: number;
}

interface GroupedTasks {
  label: string;
  iconName: string;
  color: string;
  tasks: TaskQuickPickItem[];
}

// ============================================================================
// Main Component
// ============================================================================

export function TaskQuickPick() {
  const tasks = useTasks();
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [runInTerminal, setRunInTerminal] = createSignal(tasks.getRunInTerminalDefault());
  const [showGrouped] = createSignal(true);
  let inputRef: HTMLInputElement | undefined;

  // Reset state when dialog opens
  createEffect(() => {
    if (tasks.state.showRunDialog) {
      setQuery("");
      setSelectedIndex(0);
      setRunInTerminal(tasks.getRunInTerminalDefault());
      setTimeout(() => inputRef?.focus(), 10);
    }
  });

  // Reset selection when query changes
  createEffect(() => {
    query();
    setSelectedIndex(0);
  });

  // Get all tasks with recent info
  const allTaskItems = createMemo((): TaskQuickPickItem[] => {
    const allTasks = tasks.allTasks();
    const recentMap = new Map(
      tasks.state.recentTasks.map((r) => [r.taskLabel, r])
    );

    return allTasks.map((task) => {
      const recent = recentMap.get(task.label);
      return {
        task,
        isRecent: !!recent,
        lastRun: recent?.lastRun,
        runCount: recent?.runCount,
      };
    });
  });

  // Filter tasks based on query
  const filteredTasks = createMemo((): TaskQuickPickItem[] => {
    const q = query().toLowerCase().trim();
    const items = allTaskItems();

    if (!q) {
      // Sort by recent first, then by group priority
      return [...items].sort((a, b) => {
        // Recent tasks first
        if (a.isRecent && !b.isRecent) return -1;
        if (!a.isRecent && b.isRecent) return 1;
        if (a.isRecent && b.isRecent) {
          return (b.lastRun || 0) - (a.lastRun || 0);
        }

        // Then by group priority
        const groupPriority: Record<TaskGroup, number> = {
          build: 0,
          test: 1,
          run: 2,
          clean: 3,
          deploy: 4,
          none: 5,
        };
        const aPriority = groupPriority[a.task.group || "none"];
        const bPriority = groupPriority[b.task.group || "none"];
        if (aPriority !== bPriority) return aPriority - bPriority;

        // Then alphabetically
        return a.task.label.localeCompare(b.task.label);
      });
    }

    // Fuzzy filter
    return items
      .filter((item) => {
        const label = item.task.label.toLowerCase();
        const command = item.task.command.toLowerCase();
        const group = (item.task.group || "").toLowerCase();
        const type = item.task.type.toLowerCase();
        const args = (item.task.args || []).join(" ").toLowerCase();

        return (
          label.includes(q) ||
          command.includes(q) ||
          group.includes(q) ||
          type.includes(q) ||
          args.includes(q)
        );
      })
      .sort((a, b) => {
        // Exact matches first
        const aExact = a.task.label.toLowerCase() === q;
        const bExact = b.task.label.toLowerCase() === q;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Starts with query
        const aStarts = a.task.label.toLowerCase().startsWith(q);
        const bStarts = b.task.label.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // Recent tasks
        if (a.isRecent && !b.isRecent) return -1;
        if (!a.isRecent && b.isRecent) return 1;

        return a.task.label.localeCompare(b.task.label);
      });
  });

  // Group tasks by category
  const groupedTasks = createMemo((): GroupedTasks[] => {
    const items = filteredTasks();
    const groups: Record<string, TaskQuickPickItem[]> = {
      recent: [],
      build: [],
      test: [],
      run: [],
      other: [],
    };

    for (const item of items) {
      if (item.isRecent && !query()) {
        groups.recent.push(item);
      } else {
        const group = item.task.group || "none";
        switch (group) {
          case "build":
            groups.build.push(item);
            break;
          case "test":
            groups.test.push(item);
            break;
          case "run":
            groups.run.push(item);
            break;
          default:
            groups.other.push(item);
        }
      }
    }

    const result: GroupedTasks[] = [];

    if (groups.recent.length > 0) {
      result.push({
        label: "Recent",
        iconName: "clock",
        color: "var(--cortex-warning)",
        tasks: groups.recent.slice(0, 5),
      });
    }
    if (groups.build.length > 0) {
      result.push({
        label: "Build",
        iconName: "wrench",
        color: "var(--cortex-info)",
        tasks: groups.build,
      });
    }
    if (groups.test.length > 0) {
      result.push({
        label: "Test",
        iconName: "check",
        color: "var(--cortex-success)",
        tasks: groups.test,
      });
    }
    if (groups.run.length > 0) {
      result.push({
        label: "Run",
        iconName: "play",
        color: "var(--cortex-info)",
        tasks: groups.run,
      });
    }
    if (groups.other.length > 0) {
      result.push({
        label: "Other",
        iconName: "bolt",
        color: "var(--cortex-text-inactive)",
        tasks: groups.other,
      });
    }

    return result;
  });

  // Flat list for keyboard navigation
  const flatList = createMemo((): TaskQuickPickItem[] => {
    if (showGrouped() && !query()) {
      return groupedTasks().flatMap((g) => g.tasks);
    }
    return filteredTasks();
  });

  // Get currently selected task
  const selectedTask = createMemo(() => {
    const list = flatList();
    return list[selectedIndex()]?.task;
  });

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    const list = flatList();

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const task = selectedTask();
      if (task) {
        handleRunTask(task);
      }
    } else if (e.key === "Escape") {
      tasks.closeRunDialog();
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      toggleRunMode();
    }
  };

  // Run the selected task
  const handleRunTask = async (task: TaskConfig) => {
    tasks.closeRunDialog();

    if (runInTerminal()) {
      await tasks.runTaskInTerminal(task);
    } else if (task.isBackground) {
      await tasks.runBackgroundTask(task);
    } else {
      await tasks.runTask(task);
    }
  };

  // Toggle run mode
  const toggleRunMode = () => {
    const newValue = !runInTerminal();
    setRunInTerminal(newValue);
    tasks.setRunInTerminalDefault(newValue);
  };

  // Configure task
  const handleConfigureTask = (task: TaskConfig, e: MouseEvent) => {
    e.stopPropagation();
    tasks.closeRunDialog();
    tasks.openConfigEditor(task);
  };

  // Get task type icon
  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case "npm":
        return <Icon name="box" class="w-4 h-4" style={{ color: "var(--cortex-error)" }} />;
      case "yarn":
        return <Icon name="box" class="w-4 h-4" style={{ color: "var(--cortex-info)" }} />;
      case "cargo":
        return <Icon name="box" class="w-4 h-4" style={{ color: "var(--cortex-warning)" }} />;
      case "docker":
        return <Icon name="server" class="w-4 h-4" style={{ color: "var(--cortex-info)" }} />;
      case "make":
        return <Icon name="code" class="w-4 h-4" style={{ color: "var(--cortex-text-inactive)" }} />;
      case "shell":
      case "process":
      default:
        return <Icon name="terminal" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />;
    }
  };

  // Get group color
  const getGroupColor = (group: TaskGroup | undefined) => {
    switch (group) {
      case "build":
        return "var(--cortex-info)";
      case "test":
        return "var(--cortex-success)";
      case "run":
        return "var(--cortex-info)";
      case "clean":
        return "var(--cortex-warning)";
      case "deploy":
        return "var(--cortex-error)";
      default:
        return "var(--text-weak)";
    }
  };

  // Format relative time
  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <Show when={tasks.state.showRunDialog}>
      <div
        class="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]"
        onClick={() => tasks.closeRunDialog()}
      >
        {/* Backdrop */}
        <div class="absolute inset-0 bg-black/50" />

        {/* Dialog */}
        <div
          class="relative w-[600px] max-h-[500px] rounded-lg shadow-2xl overflow-hidden flex flex-col"
          style={{ background: "var(--surface-raised)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Header */}
          <div
            class="flex items-center gap-3 px-4 py-3 border-b shrink-0"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <Icon name="play" class="w-5 h-5 shrink-0" style={{ color: "var(--cortex-info)" }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search tasks... (type to filter)"
              class="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--text-base)" }}
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />

            {/* Run Mode Toggle */}
            <button
              onClick={toggleRunMode}
              class="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors"
              style={{
                background: runInTerminal()
                  ? "var(--cortex-info)20"
                  : "var(--surface-hover)",
                color: runInTerminal() ? "var(--cortex-info)" : "var(--text-weak)",
              }}
              title="Toggle run mode (Tab)"
            >
              {runInTerminal() ? (
                <>
                  <Icon name="terminal" class="w-3.5 h-3.5" />
                  Terminal
                </>
              ) : (
                <>
                  <Icon name="bolt" class="w-3.5 h-3.5" />
                  SDK
                </>
              )}
            </button>

            {/* Refresh */}
            <button
              onClick={() => tasks.refreshTasks()}
              class="p-1.5 rounded hover:bg-[var(--surface-hover)]"
              title="Refresh tasks"
            >
              <Icon
                name="rotate"
                class="w-4 h-4"
                style={{ color: "var(--text-weak)" }}
              />
            </button>

            <kbd
              class="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: "var(--background-base)",
                color: "var(--text-weak)",
              }}
            >
              esc
            </kbd>
          </div>

          {/* Results */}
          <div class="flex-1 overflow-y-auto">
            {/* Empty State */}
            <Show when={flatList().length === 0}>
              <div class="flex flex-col items-center justify-center py-12">
                <div
                  class="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{ background: "var(--surface-hover)" }}
                >
                  <Icon name="play" class="w-6 h-6" style={{ color: "var(--text-weak)" }} />
                </div>
                <p class="text-sm mb-2" style={{ color: "var(--text-weak)" }}>
                  {query() ? "No matching tasks" : "No tasks available"}
                </p>
                <Show when={!query()}>
                  <button
                    onClick={() => {
                      tasks.closeRunDialog();
                      tasks.openConfigEditor();
                    }}
                    class="text-xs px-3 py-1.5 rounded"
                    style={{ background: "var(--cortex-info)20", color: "var(--cortex-info)" }}
                  >
                    <Icon name="plus" class="w-3 h-3 inline mr-1" />
                    Create a task
                  </button>
                </Show>
              </div>
            </Show>

            {/* Grouped View */}
            <Show when={showGrouped() && !query() && flatList().length > 0}>
              <For each={groupedTasks()}>
                {(group) => (
                  <div>
                    {/* Group Header */}
                    <div
                      class="flex items-center gap-2 px-4 py-2 sticky top-0"
                      style={{
                        background: "var(--surface-base)",
                        "border-bottom": "1px solid var(--border-weak)",
                      }}
                    >
                      <Icon
                        name={group.iconName}
                        class="w-3.5 h-3.5"
                        style={{ color: group.color }}
                      />
                      <span
                        class="text-xs font-medium"
                        style={{ color: "var(--text-weak)" }}
                      >
                        {group.label}
                      </span>
                      <span
                        class="text-xs px-1.5 rounded"
                        style={{
                          background: "var(--surface-hover)",
                          color: "var(--text-weak)",
                        }}
                      >
                        {group.tasks.length}
                      </span>
                    </div>

                    {/* Group Tasks */}
                    <For each={group.tasks}>
                      {(item) => {
                        const globalIndex = () =>
                          flatList().findIndex((i) => i.task.label === item.task.label);
                        return (
                          <TaskPickerItem
                            item={item}
                            isSelected={selectedIndex() === globalIndex()}
                            onSelect={() => setSelectedIndex(globalIndex())}
                            onRun={() => handleRunTask(item.task)}
                            onConfigure={(e) => handleConfigureTask(item.task, e)}
                            getTypeIcon={getTaskTypeIcon}
                            getGroupColor={getGroupColor}
                            formatTime={formatRelativeTime}
                            runInTerminal={runInTerminal()}
                          />
                        );
                      }}
                    </For>
                  </div>
                )}
              </For>
            </Show>

            {/* Flat View (when searching) */}
            <Show when={query() && flatList().length > 0}>
              <For each={filteredTasks()}>
                {(item, index) => (
                  <TaskPickerItem
                    item={item}
                    isSelected={selectedIndex() === index()}
                    onSelect={() => setSelectedIndex(index())}
                    onRun={() => handleRunTask(item.task)}
                    onConfigure={(e) => handleConfigureTask(item.task, e)}
                    getTypeIcon={getTaskTypeIcon}
                    getGroupColor={getGroupColor}
                    formatTime={formatRelativeTime}
                    runInTerminal={runInTerminal()}
                    highlightQuery={query()}
                  />
                )}
              </For>
            </Show>
          </div>

          {/* Footer */}
          <div
            class="flex items-center justify-between px-4 py-2 border-t shrink-0"
            style={{
              "border-color": "var(--border-weak)",
              background: "var(--surface-base)",
            }}
          >
            <div
              class="flex items-center gap-4 text-xs"
              style={{ color: "var(--text-weak)" }}
            >
              <span class="flex items-center gap-1">
                <kbd
                  class="px-1 py-0.5 rounded"
                  style={{ background: "var(--surface-hover)" }}
                >
                  ↑↓
                </kbd>
                Navigate
              </span>
              <span class="flex items-center gap-1">
                <kbd
                  class="px-1 py-0.5 rounded"
                  style={{ background: "var(--surface-hover)" }}
                >
                  ↵
                </kbd>
                Run
              </span>
              <span class="flex items-center gap-1">
                <kbd
                  class="px-1 py-0.5 rounded"
                  style={{ background: "var(--surface-hover)" }}
                >
                  Tab
                </kbd>
                Toggle Mode
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button
                onClick={() => {
                  tasks.closeRunDialog();
                  tasks.openTasksPanel();
                }}
                class="text-xs px-2 py-1 rounded hover:bg-[var(--surface-hover)]"
                style={{ color: "var(--text-weak)" }}
              >
                All Tasks
              </button>
              <button
                onClick={() => {
                  tasks.closeRunDialog();
                  tasks.openConfigEditor();
                }}
                class="text-xs px-2 py-1 rounded hover:bg-[var(--surface-hover)]"
                style={{ color: "var(--text-weak)" }}
              >
                <Icon name="plus" class="w-3 h-3 inline mr-0.5" />
                New
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Task Picker Item Component
// ============================================================================

interface TaskPickerItemProps {
  item: TaskQuickPickItem;
  isSelected: boolean;
  onSelect: () => void;
  onRun: () => void;
  onConfigure: (e: MouseEvent) => void;
  getTypeIcon: (type: string) => JSX.Element;
  getGroupColor: (group: TaskGroup | undefined) => string;
  formatTime: (timestamp: number) => string;
  runInTerminal: boolean;
  highlightQuery?: string;
}

function TaskPickerItem(props: TaskPickerItemProps) {
  const highlightText = (text: string) => {
    if (!props.highlightQuery) return text;

    const query = props.highlightQuery.toLowerCase();
    const index = text.toLowerCase().indexOf(query);
    if (index === -1) return text;

    return (
      <>
        {text.slice(0, index)}
        <span
          style={{
            background: "var(--cortex-warning)40",
            "border-radius": "var(--cortex-radius-sm)",
            padding: "0 1px",
          }}
        >
          {text.slice(index, index + query.length)}
        </span>
        {text.slice(index + query.length)}
      </>
    );
  };

  return (
    <div
      class="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors group"
      style={{
        background: props.isSelected ? "var(--surface-active)" : "transparent",
      }}
      onMouseEnter={props.onSelect}
      onClick={props.onRun}
    >
      {/* Type Icon */}
      <div class="shrink-0">{props.getTypeIcon(props.item.task.type)}</div>

      {/* Task Info */}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="text-sm truncate"
            style={{ color: "var(--text-base)" }}
          >
            {highlightText(props.item.task.label)}
          </span>

          <Show when={props.item.isRecent && props.item.lastRun}>
            <span
              class="text-[10px] px-1 rounded shrink-0 flex items-center gap-0.5"
              style={{ color: "var(--text-weak)" }}
            >
              <Icon name="clock" class="w-2.5 h-2.5" />
              {props.formatTime(props.item.lastRun!)}
            </span>
          </Show>

          <Show when={props.item.task.isDefault}>
            <span
              class="text-[10px] px-1 rounded shrink-0"
              style={{ background: "var(--cortex-info)20", color: "var(--cortex-info)" }}
            >
              default
            </span>
          </Show>

          <Show when={props.item.task.isBackground}>
            <span
              class="text-[10px] px-1 rounded shrink-0 flex items-center gap-0.5"
              style={{ background: "var(--cortex-success)20", color: "var(--cortex-success)" }}
            >
              <Icon name="eye" class="w-2.5 h-2.5" />
              watch
            </span>
          </Show>
        </div>

        <div
          class="flex items-center gap-2 text-xs"
          style={{ color: "var(--text-weak)" }}
        >
          <span class="truncate font-mono">
            {props.item.task.command}
            {props.item.task.args?.length
              ? " " + props.item.task.args.join(" ")
              : ""}
          </span>

          <Show
            when={props.item.task.group && props.item.task.group !== "none"}
          >
            <span
              class="px-1 rounded shrink-0"
              style={{
                background: `${props.getGroupColor(props.item.task.group)}20`,
                color: props.getGroupColor(props.item.task.group),
              }}
            >
              {props.item.task.group}
            </span>
          </Show>

          <Show when={props.item.task.source === "auto-detected"}>
            <span
              class="px-1 rounded shrink-0"
              style={{
                background: "var(--surface-hover)",
                color: "var(--text-weak)",
              }}
            >
              detected
            </span>
          </Show>
        </div>
      </div>

      {/* Actions */}
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Show when={props.item.task.source === "user"}>
          <button
            onClick={props.onConfigure}
            class="p-1.5 rounded hover:bg-[var(--surface-hover)]"
            title="Configure"
          >
            <Icon name="gear" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
          </button>
        </Show>
      </div>

      {/* Run indicator */}
      <Show when={props.isSelected}>
        <div class="flex items-center gap-1.5 shrink-0">
          <Show when={props.runInTerminal}>
            <Icon name="terminal" class="w-3 h-3" style={{ color: "var(--cortex-info)" }} />
          </Show>
          <kbd
            class="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: "var(--background-base)",
              color: "var(--text-weak)",
            }}
          >
            ↵
          </kbd>
        </div>
      </Show>
    </div>
  );
}

// Export for use in index.ts
import type { JSX } from "solid-js";

