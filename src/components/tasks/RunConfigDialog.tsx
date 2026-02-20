import { createSignal, createEffect, Show, For, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { useTasks, type TaskConfig } from "@/context/TasksContext";

export function RunConfigDialog() {
  const tasks = useTasks();
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;

  // Reset state when opened
  createEffect(() => {
    if (tasks.state.showRunDialog) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef?.focus(), 10);
    }
  });

  // Reset selection when query changes
  createEffect(() => {
    query();
    setSelectedIndex(0);
  });

  const filteredTasks = createMemo(() => {
    const q = query().toLowerCase().trim();
    const allTasks = tasks.allTasks();
    
    if (!q) {
      // Show recent tasks first, then all tasks
      const recentLabels = new Set(tasks.state.recentTasks.map(r => r.taskLabel));
      const recent = allTasks.filter(t => recentLabels.has(t.label));
      const others = allTasks.filter(t => !recentLabels.has(t.label));
      return [...recent, ...others];
    }
    
    return allTasks.filter(task => {
      const label = task.label.toLowerCase();
      const command = task.command.toLowerCase();
      const group = (task.group || "").toLowerCase();
      
      return label.includes(q) || command.includes(q) || group.includes(q);
    });
  });

  const isRecentTask = (label: string) => {
    return tasks.state.recentTasks.some(r => r.taskLabel === label);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const tasksCount = filteredTasks().length;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, tasksCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const task = filteredTasks()[selectedIndex()];
      if (task) {
        handleRunTask(task);
      }
    } else if (e.key === "Escape") {
      tasks.closeRunDialog();
    }
  };

  const handleRunTask = async (task: TaskConfig) => {
    tasks.closeRunDialog();
    await tasks.runTask(task);
  };

  const handleConfigureTask = (task: TaskConfig, e: MouseEvent) => {
    e.stopPropagation();
    tasks.closeRunDialog();
    tasks.openConfigEditor(task);
  };

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case "npm": return "📦";
      case "cargo": return "🦀";
      case "shell": return "💻";
      default: return "⚡";
    }
  };

  const getGroupColor = (group: string | undefined) => {
    switch (group) {
      case "build": return "var(--cortex-info)";
      case "test": return "var(--cortex-success)";
      case "run": return "var(--cortex-info)";
      case "clean": return "var(--cortex-warning)";
      case "deploy": return "var(--cortex-error)";
      default: return "var(--text-weak)";
    }
  };

  return (
    <Show when={tasks.state.showRunDialog}>
      <div 
        class="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
        onClick={() => tasks.closeRunDialog()}
      >
        {/* Backdrop */}
        <div class="absolute inset-0 bg-black/50" />
        
        {/* Modal */}
        <div 
          class="relative w-[560px] max-h-[400px] rounded-lg shadow-2xl overflow-hidden"
          style={{ background: "var(--surface-raised)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div 
            class="flex items-center gap-3 px-4 py-3 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <Icon name="play" class="w-5 h-5 shrink-0" style={{ color: "var(--cortex-info)" }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Run task..."
              class="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--text-base)" }}
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />
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
          <div class="max-h-[320px] overflow-y-auto">
            <Show when={filteredTasks().length === 0}>
              <div class="px-4 py-8 text-center">
                <p class="text-sm mb-2" style={{ color: "var(--text-weak)" }}>
                  No tasks found
                </p>
                <button
                  onClick={() => {
                    tasks.closeRunDialog();
                    tasks.openConfigEditor();
                  }}
                  class="text-sm px-3 py-1.5 rounded"
                  style={{ background: "var(--cortex-info)20", color: "var(--cortex-info)" }}
                >
                  Create a new task
                </button>
              </div>
            </Show>

            <For each={filteredTasks()}>
              {(task, index) => (
                <div
                  class="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors group"
                  style={{
                    background: index() === selectedIndex() 
                      ? "var(--surface-active)" 
                      : "transparent",
                  }}
                  onMouseEnter={() => setSelectedIndex(index())}
                  onClick={() => handleRunTask(task)}
                >
                  {/* Type Icon */}
                  <span class="text-base shrink-0">{getTaskTypeIcon(task.type)}</span>
                  
                  {/* Task Info */}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm truncate" style={{ color: "var(--text-base)" }}>
                        {task.label}
                      </span>
                      <Show when={isRecentTask(task.label)}>
                        <Icon name="clock" class="w-3 h-3 shrink-0" style={{ color: "var(--text-weak)" }} />
                      </Show>
                      <Show when={task.isDefault}>
                        <span 
                          class="text-[10px] px-1 rounded shrink-0"
                          style={{ background: "var(--cortex-info)20", color: "var(--cortex-info)" }}
                        >
                          default
                        </span>
                      </Show>
                    </div>
                    <div class="flex items-center gap-2 text-xs" style={{ color: "var(--text-weak)" }}>
                      <span class="truncate">{task.command} {task.args?.join(" ")}</span>
                      <Show when={task.group && task.group !== "none"}>
                        <span 
                          class="px-1 rounded shrink-0"
                          style={{ background: `${getGroupColor(task.group)}20`, color: getGroupColor(task.group) }}
                        >
                          {task.group}
                        </span>
                      </Show>
                    </div>
                  </div>

                  {/* Actions */}
                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Show when={task.source === "user"}>
                      <button
                        onClick={(e) => handleConfigureTask(task, e)}
                        class="p-1.5 rounded hover:bg-[var(--surface-hover)]"
                        title="Configure"
                      >
                        <Icon name="gear" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
                      </button>
                    </Show>
                  </div>

                  {/* Run indicator */}
                  <Show when={index() === selectedIndex()}>
                    <kbd 
                      class="text-xs px-1.5 py-0.5 rounded shrink-0"
                      style={{ 
                        background: "var(--background-base)",
                        color: "var(--text-weak)",
                      }}
                    >
                      ↵
                    </kbd>
                  </Show>
                </div>
              )}
            </For>
          </div>

          {/* Footer */}
          <div 
            class="flex items-center justify-between px-4 py-2 border-t"
            style={{ "border-color": "var(--border-weak)", background: "var(--surface-base)" }}
          >
            <div class="flex items-center gap-4 text-xs" style={{ color: "var(--text-weak)" }}>
              <span class="flex items-center gap-1">
                <kbd class="px-1 py-0.5 rounded" style={{ background: "var(--surface-hover)" }}>↑↓</kbd>
                Navigate
              </span>
              <span class="flex items-center gap-1">
                <kbd class="px-1 py-0.5 rounded" style={{ background: "var(--surface-hover)" }}>↵</kbd>
                Run
              </span>
            </div>
            <button
              onClick={() => {
                tasks.closeRunDialog();
                tasks.openTasksPanel();
              }}
              class="text-xs px-2 py-1 rounded hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--text-weak)" }}
            >
              View all tasks
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Quick Run Input (Inline command runner)
// ============================================================================

export function QuickRunInput() {
  const tasks = useTasks();
  const [command, setCommand] = createSignal("");
  const [isExpanded, setIsExpanded] = createSignal(false);

  const handleSubmit = async () => {
    const cmd = command().trim();
    if (!cmd) return;

    // Create a temporary task and run it
    const tempTask: TaskConfig = {
      label: `Run: ${cmd.slice(0, 30)}${cmd.length > 30 ? "..." : ""}`,
      type: "shell",
      command: cmd,
      source: "user",
    };

    await tasks.runTask(tempTask);
    setCommand("");
    setIsExpanded(false);
  };

  return (
    <Show 
      when={isExpanded()}
      fallback={
        <button
          onClick={() => setIsExpanded(true)}
          class="flex items-center gap-2 px-3 py-1.5 rounded text-xs hover:bg-[var(--surface-hover)]"
          style={{ color: "var(--text-weak)" }}
        >
          <Icon name="play" class="w-3.5 h-3.5" />
          Quick Run
        </button>
      }
    >
      <div class="flex items-center gap-2">
        <input
          type="text"
          placeholder="Enter command..."
          class="w-64 px-3 py-1.5 rounded text-xs font-mono outline-none"
          style={{ 
            background: "var(--surface-raised)",
            border: "1px solid var(--border-base)",
            color: "var(--text-base)"
          }}
          value={command()}
          onInput={(e) => setCommand(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") {
              setIsExpanded(false);
              setCommand("");
            }
          }}
          autofocus
        />
        <button
          onClick={handleSubmit}
          class="p-1.5 rounded"
          style={{ background: "var(--cortex-info)", color: "white" }}
        >
          <Icon name="play" class="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            setIsExpanded(false);
            setCommand("");
          }}
          class="p-1.5 rounded hover:bg-[var(--surface-hover)]"
        >
          <Icon name="xmark" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
        </button>
      </div>
    </Show>
  );
}

