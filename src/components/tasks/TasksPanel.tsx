import { createSignal, Show, For, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { useTasks, type TaskConfig, type TaskGroup, type TaskRun, type RunOnSaveConfig, type BackgroundTaskStatus } from "@/context/TasksContext";
import { Button, IconButton, Input } from "@/components/ui";

interface TaskGroupSection {
  group: TaskGroup;
  label: string;
  tasks: TaskConfig[];
}

export function TasksPanel() {
  const tasks = useTasks();
  const [expandedGroups, setExpandedGroups] = createSignal<Set<string>>(new Set(["build", "test", "run", "recent"]));
  const [activeTab, setActiveTab] = createSignal<"all" | "running" | "background" | "history" | "runOnSave">("all");
  
  // Run on Save form state
  const [newRunOnSaveTask, setNewRunOnSaveTask] = createSignal<string>("");
  const [newRunOnSavePattern, setNewRunOnSavePattern] = createSignal<string>("**/*");
  const [newRunOnSaveDelay, setNewRunOnSaveDelay] = createSignal<number>(500);

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const groupedTasks = createMemo((): TaskGroupSection[] => {
    const allTasks = tasks.allTasks();
    const groups: Record<TaskGroup, TaskConfig[]> = {
      build: [],
      test: [],
      run: [],
      clean: [],
      deploy: [],
      none: [],
    };

    for (const task of allTasks) {
      const group = task.group || "none";
      groups[group].push(task);
    }

    const sections: TaskGroupSection[] = [
      { group: "build" as TaskGroup, label: "Build", tasks: groups.build },
      { group: "test" as TaskGroup, label: "Test", tasks: groups.test },
      { group: "run" as TaskGroup, label: "Run", tasks: groups.run },
      { group: "clean" as TaskGroup, label: "Clean", tasks: groups.clean },
      { group: "deploy" as TaskGroup, label: "Deploy", tasks: groups.deploy },
      { group: "none" as TaskGroup, label: "Other", tasks: groups.none },
    ];
    return sections.filter(g => g.tasks.length > 0);
  });

  const recentTasks = createMemo(() => {
    const allTasks = tasks.allTasks();
    return tasks.state.recentTasks
      .map(recent => {
        const task = allTasks.find(t => t.label === recent.taskLabel);
        return task ? { ...recent, task } : null;
      })
      .filter((r): r is { taskLabel: string; lastRun: number; runCount: number; task: TaskConfig } => r !== null)
      .slice(0, 5);
  });

  const handleRunTask = async (task: TaskConfig) => {
    await tasks.runTask(task);
    tasks.closeTasksPanel();
  };

  const handleRunTaskInTerminal = async (task: TaskConfig) => {
    await tasks.runTaskInTerminal(task);
    tasks.closeTasksPanel();
  };

  const handleEditTask = (task: TaskConfig) => {
    tasks.openConfigEditor(task);
  };

  const handleDeleteTask = (task: TaskConfig) => {
    if (task.source === "user") {
      tasks.removeTask(task.label);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (start: number, end?: number) => {
    const duration = (end || Date.now()) - start;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
  };

  const getStatusIcon = (status: TaskRun["status"]) => {
    switch (status) {
      case "running": return <Icon name="play" class="w-3.5 h-3.5 text-blue-400 animate-pulse" />;
      case "completed": return <Icon name="check" class="w-3.5 h-3.5 text-green-400" />;
      case "failed": return <Icon name="circle-exclamation" class="w-3.5 h-3.5 text-red-400" />;
      case "cancelled": return <Icon name="stop" class="w-3.5 h-3.5 text-yellow-400" />;
      default: return <Icon name="clock" class="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const getBackgroundStatusIcon = (status: BackgroundTaskStatus | undefined) => {
    switch (status) {
      case "watching": return <Icon name="eye" class="w-3.5 h-3.5 text-green-400" />;
      case "compiling": return <Icon name="spinner" class="w-3.5 h-3.5 text-blue-400 animate-spin" />;
      case "idle": return <Icon name="pause" class="w-3.5 h-3.5 text-gray-400" />;
      case "error": return <Icon name="circle-exclamation" class="w-3.5 h-3.5 text-red-400" />;
      default: return <Icon name="eye" class="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const getBackgroundStatusText = (status: BackgroundTaskStatus | undefined) => {
    switch (status) {
      case "watching": return "Watching...";
      case "compiling": return "Compiling...";
      case "idle": return "Idle";
      case "error": return "Error";
      default: return "Running";
    }
  };

  const handleRunBackgroundTask = async (task: TaskConfig) => {
    await tasks.runBackgroundTask(task);
  };

  const handleStopBackgroundTask = (runId: string) => {
    tasks.stopBackgroundTask(runId);
  };

  return (
    <Show when={tasks.state.showTasksPanel}>
      <div 
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={(e) => { if (e.target === e.currentTarget) tasks.closeTasksPanel(); }}
      >
        <div 
          class="w-[600px] max-h-[80vh] flex flex-col rounded-lg shadow-xl overflow-hidden"
          style={{ background: "var(--surface-base)", border: "1px solid var(--border-base)" }}
        >
          {/* Header */}
          <div 
            class="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ "border-color": "var(--border-base)" }}
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded flex items-center justify-center" style={{ background: "var(--cortex-info)20" }}>
                <Icon name="play" class="w-4 h-4" style={{ color: "var(--cortex-info)" }} />
              </div>
              <div>
                <h2 class="font-semibold" style={{ color: "var(--text-strong)" }}>Tasks</h2>
                <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                  {tasks.allTasks().length} tasks available
                </p>
              </div>
            </div>
            
            <div class="flex items-center gap-2">
              <IconButton
                onClick={() => tasks.refreshTasks()}
                tooltip="Refresh tasks"
              >
                <Icon name="rotate" class="w-4 h-4" />
              </IconButton>
              <IconButton
                onClick={() => tasks.openConfigEditor()}
                tooltip="New task"
              >
                <Icon name="plus" class="w-4 h-4" />
              </IconButton>
              <IconButton
                onClick={() => tasks.closeTasksPanel()}
              >
                <Icon name="xmark" class="w-5 h-5" />
              </IconButton>
            </div>
          </div>

          {/* Tabs */}
          <div class="flex border-b shrink-0" style={{ "border-color": "var(--border-base)" }}>
            <Button
              variant="ghost"
              style={{
                "border-radius": "0",
                color: activeTab() === "all" ? "var(--text-strong)" : "var(--text-weak)",
                "border-bottom": activeTab() === "all" ? "2px solid var(--cortex-info)" : "2px solid transparent",
              }}
              onClick={() => setActiveTab("all")}
            >
              All Tasks
            </Button>
            <Button
              variant="ghost"
              style={{
                "border-radius": "0",
                color: activeTab() === "running" ? "var(--text-strong)" : "var(--text-weak)",
                "border-bottom": activeTab() === "running" ? "2px solid var(--cortex-info)" : "2px solid transparent",
              }}
              onClick={() => setActiveTab("running")}
            >
              Running ({tasks.state.runningTasks.length})
            </Button>
            <Button
              variant="ghost"
              icon={<Icon name="eye" class="w-3.5 h-3.5" />}
              style={{
                "border-radius": "0",
                color: activeTab() === "background" ? "var(--text-strong)" : "var(--text-weak)",
                "border-bottom": activeTab() === "background" ? "2px solid var(--cortex-info)" : "2px solid transparent",
              }}
              onClick={() => setActiveTab("background")}
            >
              Watching
              <Show when={tasks.state.backgroundTasks.length > 0}>
                <span class="text-xs px-1 rounded" style={{ background: "var(--cortex-success)20", color: "var(--cortex-success)" }}>
                  {tasks.state.backgroundTasks.length}
                </span>
              </Show>
            </Button>
            <Button
              variant="ghost"
              style={{
                "border-radius": "0",
                color: activeTab() === "history" ? "var(--text-strong)" : "var(--text-weak)",
                "border-bottom": activeTab() === "history" ? "2px solid var(--cortex-info)" : "2px solid transparent",
              }}
              onClick={() => setActiveTab("history")}
            >
              History
            </Button>
            <Button
              variant="ghost"
              icon={<Icon name="floppy-disk" class="w-3.5 h-3.5" />}
              style={{
                "border-radius": "0",
                color: activeTab() === "runOnSave" ? "var(--text-strong)" : "var(--text-weak)",
                "border-bottom": activeTab() === "runOnSave" ? "2px solid var(--cortex-info)" : "2px solid transparent",
              }}
              onClick={() => setActiveTab("runOnSave")}
            >
              Run on Save
              <Show when={tasks.state.runOnSave.length > 0}>
                <span class="text-xs px-1 rounded" style={{ background: "var(--surface-hover)" }}>
                  {tasks.state.runOnSave.length}
                </span>
              </Show>
            </Button>
          </div>

          {/* Content */}
          <div class="flex-1 overflow-y-auto">
            <Show when={activeTab() === "all"}>
              {/* Recent Tasks */}
              <Show when={recentTasks().length > 0}>
                <div class="border-b" style={{ "border-color": "var(--border-base)" }}>
                  <Button
                    variant="ghost"
                    style={{ width: "100%", "justify-content": "flex-start", "border-radius": "0" }}
                    onClick={() => toggleGroup("recent")}
                  >
                    {expandedGroups().has("recent") ? (
                      <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                    ) : (
                      <Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                    )}
                    <Icon name="clock" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                    <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>Recent</span>
                    <span class="text-xs px-1.5 rounded" style={{ background: "var(--surface-hover)", color: "var(--text-weak)" }}>
                      {recentTasks().length}
                    </span>
                  </Button>
                  
                  <Show when={expandedGroups().has("recent")}>
                    <div class="pb-2">
                      <For each={recentTasks()}>
                        {(item) => (
                          <TaskItem
                            task={item.task}
                            onRun={() => handleRunTask(item.task)}
                            onRunInTerminal={() => handleRunTaskInTerminal(item.task)}
                            onEdit={() => handleEditTask(item.task)}
                            onDelete={() => handleDeleteTask(item.task)}
                            subtitle={`Last run: ${formatTime(item.lastRun)}`}
                          />
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </Show>

              {/* Grouped Tasks */}
              <For each={groupedTasks()}>
                {(section) => (
                  <div class="border-b" style={{ "border-color": "var(--border-base)" }}>
                    <Button
                      variant="ghost"
                      style={{ width: "100%", "justify-content": "flex-start", "border-radius": "0" }}
                      onClick={() => toggleGroup(section.group)}
                    >
                      {expandedGroups().has(section.group) ? (
                        <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                      ) : (
                        <Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                      )}
                      <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                        {section.label}
                      </span>
                      <span class="text-xs px-1.5 rounded" style={{ background: "var(--surface-hover)", color: "var(--text-weak)" }}>
                        {section.tasks.length}
                      </span>
                    </Button>
                    
                    <Show when={expandedGroups().has(section.group)}>
                      <div class="pb-2">
                        <For each={section.tasks}>
                          {(task) => (
                            <TaskItem
                              task={task}
                              onRun={() => handleRunTask(task)}
                              onRunInTerminal={() => handleRunTaskInTerminal(task)}
                              onEdit={() => handleEditTask(task)}
                              onDelete={() => handleDeleteTask(task)}
                            />
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                )}
              </For>

              {/* Empty State */}
              <Show when={tasks.allTasks().length === 0}>
                <div class="flex flex-col items-center justify-center py-12">
                  <div class="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "var(--surface-hover)" }}>
                    <Icon name="play" class="w-8 h-8" style={{ color: "var(--text-weak)" }} />
                  </div>
                  <p class="text-sm font-medium mb-1" style={{ color: "var(--text-strong)" }}>
                    No tasks found
                  </p>
                  <p class="text-xs mb-4" style={{ color: "var(--text-weak)" }}>
                    Create a task or open a project to auto-detect tasks
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => tasks.openConfigEditor()}
                  >
                    Create Task
                  </Button>
                </div>
              </Show>
            </Show>

            {/* Running Tasks Tab */}
            <Show when={activeTab() === "running"}>
              <Show when={tasks.state.runningTasks.length === 0}>
                <div class="flex flex-col items-center justify-center py-12">
                  <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                    No tasks currently running
                  </p>
                </div>
              </Show>

              <For each={tasks.state.runningTasks}>
                {(run) => (
                  <div 
                    class="flex items-center gap-3 px-4 py-3 border-b hover:bg-[var(--surface-hover)]"
                    style={{ "border-color": "var(--border-base)" }}
                  >
                    {getStatusIcon(run.status)}
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium truncate" style={{ color: "var(--text-strong)" }}>
                        {run.taskLabel}
                      </div>
                      <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                        Running for {formatDuration(run.startedAt)}
                      </div>
                    </div>
                    <IconButton
                      onClick={() => tasks.cancelTask(run.id)}
                      tooltip="Cancel"
                    >
                      <Icon name="stop" class="w-4 h-4 text-red-400" />
                    </IconButton>
                  </div>
                )}
              </For>
            </Show>

            {/* Background/Watching Tasks Tab */}
            <Show when={activeTab() === "background"}>
              {/* Available Background Tasks Section */}
              <div class="border-b" style={{ "border-color": "var(--border-base)" }}>
                <div class="px-4 py-2 text-xs font-medium" style={{ color: "var(--text-weak)" }}>
                  Available Background Tasks
                </div>
                <Show when={tasks.backgroundTasks().length === 0}>
                  <div class="px-4 py-3 text-sm" style={{ color: "var(--text-weak)" }}>
                    No background tasks configured. Tasks with <code class="px-1 rounded" style={{ background: "var(--surface-hover)" }}>isBackground: true</code> will appear here.
                  </div>
                </Show>
                <For each={tasks.backgroundTasks()}>
                  {(task) => {
                    const isRunning = () => tasks.state.backgroundTasks.some(r => r.taskLabel === task.label);
                    return (
                      <div 
                        class="flex items-center gap-3 px-4 py-2 mx-2 rounded hover:bg-[var(--surface-hover)] group"
                      >
                        <Icon name="eye" class="w-4 h-4" style={{ color: isRunning() ? "var(--cortex-success)" : "var(--text-weak)" }} />
                        <div class="flex-1 min-w-0">
                          <div class="text-sm truncate" style={{ color: "var(--text-base)" }}>
                            {task.label}
                          </div>
                          <div class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
                            {task.command} {task.args?.join(" ")}
                          </div>
                        </div>
                        <Show when={!isRunning()}>
                          <IconButton
                            onClick={() => handleRunBackgroundTask(task)}
                            tooltip="Start watching"
                          >
                            <Icon name="play" class="w-3.5 h-3.5" style={{ color: "var(--cortex-success)" }} />
                          </IconButton>
                        </Show>
                        <Show when={isRunning()}>
                          <span class="text-xs px-1.5 rounded" style={{ background: "var(--cortex-success)20", color: "var(--cortex-success)" }}>
                            Running
                          </span>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>

              {/* Running Background Tasks Section */}
              <div class="px-4 py-2 text-xs font-medium" style={{ color: "var(--text-weak)" }}>
                Running Watchers ({tasks.state.backgroundTasks.length})
              </div>
              
              <Show when={tasks.state.backgroundTasks.length === 0}>
                <div class="flex flex-col items-center justify-center py-8">
                  <div class="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--surface-hover)" }}>
                    <Icon name="eye" class="w-6 h-6" style={{ color: "var(--text-weak)" }} />
                  </div>
                  <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                    No background tasks running
                  </p>
                  <p class="text-xs mt-1" style={{ color: "var(--text-weak)" }}>
                    Start a background task to watch for changes
                  </p>
                </div>
              </Show>

              <For each={tasks.state.backgroundTasks}>
                {(run) => (
                  <div 
                    class="flex items-center gap-3 px-4 py-3 border-b hover:bg-[var(--surface-hover)]"
                    style={{ "border-color": "var(--border-base)" }}
                  >
                    {getBackgroundStatusIcon(run.backgroundStatus)}
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium truncate" style={{ color: "var(--text-strong)" }}>
                          {run.taskLabel}
                        </span>
                        <span 
                          class="text-xs px-1.5 py-0.5 rounded"
                          style={{ 
                            background: run.backgroundStatus === "compiling" ? "var(--cortex-info)20" : 
                                       run.backgroundStatus === "watching" ? "var(--cortex-success)20" : 
                                       run.backgroundStatus === "error" ? "var(--cortex-error)20" : "var(--surface-hover)",
                            color: run.backgroundStatus === "compiling" ? "var(--cortex-info)" : 
                                   run.backgroundStatus === "watching" ? "var(--cortex-success)" : 
                                   run.backgroundStatus === "error" ? "var(--cortex-error)" : "var(--text-weak)",
                          }}
                        >
                          {getBackgroundStatusText(run.backgroundStatus)}
                        </span>
                      </div>
                      <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                        Running for {formatDuration(run.startedAt)}
                        {run.lastCompileEnd && ` • Last compile: ${formatTime(run.lastCompileEnd)}`}
                      </div>
                    </div>
                    <IconButton
                      onClick={() => handleStopBackgroundTask(run.id)}
                      tooltip="Stop watching"
                    >
                      <Icon name="stop" class="w-4 h-4 text-red-400" />
                    </IconButton>
                  </div>
                )}
              </For>
            </Show>

            {/* History Tab */}
            <Show when={activeTab() === "history"}>
              <Show when={tasks.state.taskHistory.length === 0}>
                <div class="flex flex-col items-center justify-center py-12">
                  <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                    No task history
                  </p>
                </div>
              </Show>

              <For each={tasks.state.taskHistory.slice(0, 50)}>
                {(run) => (
                  <div 
                    class="flex items-center gap-3 px-4 py-3 border-b hover:bg-[var(--surface-hover)]"
                    style={{ "border-color": "var(--border-base)" }}
                  >
                    {getStatusIcon(run.status)}
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium truncate" style={{ color: "var(--text-strong)" }}>
                        {run.taskLabel}
                      </div>
                      <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                        {formatTime(run.startedAt)} • {formatDuration(run.startedAt, run.finishedAt)}
                        {run.exitCode !== undefined && ` • Exit code: ${run.exitCode}`}
                      </div>
                    </div>
                    <IconButton
                      onClick={() => tasks.rerunTask(run)}
                      tooltip="Rerun"
                    >
                      <Icon name="play" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                    </IconButton>
                  </div>
                )}
              </For>
            </Show>

            {/* Run on Save Tab */}
            <Show when={activeTab() === "runOnSave"}>
              {/* Global Toggle */}
              <div 
                class="flex items-center justify-between px-4 py-3 border-b"
                style={{ "border-color": "var(--border-base)" }}
              >
                <div class="flex items-center gap-2">
                  <Icon name="floppy-disk" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                  <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                    Enable Run on Save
                  </span>
                </div>
                <IconButton
                  onClick={() => tasks.toggleRunOnSaveEnabled()}
                  tooltip={tasks.state.runOnSaveEnabled ? "Disable" : "Enable"}
                >
                  {tasks.state.runOnSaveEnabled ? (
                    <Icon name="toggle-on" class="w-6 h-6" style={{ color: "var(--cortex-success)" }} />
                  ) : (
                    <Icon name="toggle-off" class="w-6 h-6" style={{ color: "var(--text-weak)" }} />
                  )}
                </IconButton>
              </div>

              {/* Add New Config Form */}
              <div class="px-4 py-3 border-b" style={{ "border-color": "var(--border-base)" }}>
                <div class="text-xs font-medium mb-2" style={{ color: "var(--text-weak)" }}>
                  Add Run on Save Rule
                </div>
                <div class="flex flex-col gap-2">
                  <div class="flex gap-2">
                    <select
                      value={newRunOnSaveTask()}
                      onChange={(e) => setNewRunOnSaveTask(e.currentTarget.value)}
                      class="flex-1 px-2 py-1.5 text-sm rounded border"
                      style={{
                        background: "var(--surface-hover)",
                        "border-color": "var(--border-base)",
                        color: "var(--text-base)",
                      }}
                    >
                      <option value="">Select a task...</option>
                      <For each={tasks.allTasks()}>
                        {(task) => (
                          <option value={task.label}>{task.label}</option>
                        )}
                      </For>
                    </select>
                  </div>
                  <div class="flex gap-2">
                    <Input
                      type="text"
                      value={newRunOnSavePattern()}
                      onInput={(e) => setNewRunOnSavePattern(e.currentTarget.value)}
                      placeholder="Glob pattern (e.g., **/*.ts)"
                      style={{ flex: "1" }}
                    />
                    <Input
                      type="number"
                      value={newRunOnSaveDelay()}
                      onInput={(e) => setNewRunOnSaveDelay(parseInt(e.currentTarget.value) || 500)}
                      min={0}
                      max={10000}
                      step={100}
                      style={{ width: "80px" }}
                      title="Debounce delay (ms)"
                    />
                    <IconButton
                      onClick={() => {
                        if (newRunOnSaveTask() && newRunOnSavePattern()) {
                          tasks.addRunOnSave(newRunOnSaveTask(), newRunOnSavePattern(), newRunOnSaveDelay());
                          setNewRunOnSaveTask("");
                          setNewRunOnSavePattern("**/*");
                          setNewRunOnSaveDelay(500);
                        }
                      }}
                      disabled={!newRunOnSaveTask() || !newRunOnSavePattern()}
                      style={{ background: "var(--cortex-info)", color: "white" }}
                    >
                      <Icon name="plus" class="w-4 h-4" />
                    </IconButton>
                  </div>
                  <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                    Pattern examples: <code class="px-1 rounded" style={{ background: "var(--surface-hover)" }}>*.ts</code>{" "}
                    <code class="px-1 rounded" style={{ background: "var(--surface-hover)" }}>**/*.{"{ts,tsx}"}</code>{" "}
                    <code class="px-1 rounded" style={{ background: "var(--surface-hover)" }}>src/**/*</code>
                  </div>
                </div>
              </div>

              {/* Existing Configs */}
              <Show when={tasks.state.runOnSave.length === 0}>
                <div class="flex flex-col items-center justify-center py-12">
                  <div class="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "var(--surface-hover)" }}>
                    <Icon name="floppy-disk" class="w-8 h-8" style={{ color: "var(--text-weak)" }} />
                  </div>
                  <p class="text-sm font-medium mb-1" style={{ color: "var(--text-strong)" }}>
                    No run on save rules
                  </p>
                  <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                    Add a rule above to automatically run tasks when files are saved
                  </p>
                </div>
              </Show>

              <For each={tasks.state.runOnSave}>
                {(config) => (
                  <RunOnSaveItem
                    config={config}
                    taskLabel={tasks.allTasks().find(t => t.label === config.taskId)?.label || config.taskId}
                    onToggle={() => tasks.updateRunOnSave(config.id, { enabled: !config.enabled })}
                    onDelete={() => tasks.removeRunOnSave(config.id)}
                  />
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Task Item Component
// ============================================================================

interface TaskItemProps {
  task: TaskConfig;
  onRun: () => void;
  onRunInTerminal: () => void;
  onEdit: () => void;
  onDelete: () => void;
  subtitle?: string;
}

function TaskItem(props: TaskItemProps) {
  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case "npm": return "📦";
      case "cargo": return "🦀";
      case "shell": return "💻";
      default: return "⚡";
    }
  };

  return (
    <div 
      class="flex items-center gap-3 px-4 py-2 mx-2 rounded hover:bg-[var(--surface-hover)] cursor-pointer group"
      onClick={props.onRun}
    >
      <span class="text-base">{getTaskTypeIcon(props.task.type)}</span>
      
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm truncate" style={{ color: "var(--text-base)" }}>
            {props.task.label}
          </span>
          <Show when={props.task.isDefault}>
            <span class="text-[10px] px-1 rounded" style={{ background: "var(--cortex-info)20", color: "var(--cortex-info)" }}>
              default
            </span>
          </Show>
          <Show when={props.task.isBackground}>
            <span class="text-[10px] px-1 rounded flex items-center gap-0.5" style={{ background: "var(--cortex-success)20", color: "var(--cortex-success)" }}>
              <Icon name="eye" class="w-2.5 h-2.5" />
              watch
            </span>
          </Show>
          <Show when={props.task.source === "auto-detected"}>
            <span class="text-[10px] px-1 rounded" style={{ background: "var(--surface-hover)", color: "var(--text-weak)" }}>
              detected
            </span>
          </Show>
        </div>
        <Show when={props.subtitle}>
          <div class="text-xs" style={{ color: "var(--text-weak)" }}>
            {props.subtitle}
          </div>
        </Show>
        <Show when={!props.subtitle && props.task.command}>
          <div class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
            {props.task.command} {props.task.args?.join(" ")}
          </div>
        </Show>
      </div>

      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconButton
          onClick={(e) => { e.stopPropagation(); props.onRun(); }}
          tooltip="Run"
          size="sm"
        >
          <Icon name="play" class="w-3.5 h-3.5" style={{ color: "var(--cortex-success)" }} />
        </IconButton>
        <IconButton
          onClick={(e) => { e.stopPropagation(); props.onRunInTerminal(); }}
          tooltip="Run in Terminal"
          size="sm"
        >
          <Icon name="terminal" class="w-3.5 h-3.5" style={{ color: "var(--cortex-info)" }} />
        </IconButton>
        <Show when={props.task.source === "user"}>
          <IconButton
            onClick={(e) => { e.stopPropagation(); props.onEdit(); }}
            tooltip="Edit"
            size="sm"
          >
            <Icon name="gear" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
          </IconButton>
          <IconButton
            onClick={(e) => { e.stopPropagation(); props.onDelete(); }}
            tooltip="Delete"
            size="sm"
          >
            <Icon name="trash" class="w-3.5 h-3.5 text-red-400" />
          </IconButton>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// Run on Save Item Component
// ============================================================================

interface RunOnSaveItemProps {
  config: RunOnSaveConfig;
  taskLabel: string;
  onToggle: () => void;
  onDelete: () => void;
}

function RunOnSaveItem(props: RunOnSaveItemProps) {
  return (
    <div 
      class="flex items-center gap-3 px-4 py-3 border-b hover:bg-[var(--surface-hover)] group"
      style={{ 
        "border-color": "var(--border-base)",
        opacity: props.config.enabled ? 1 : 0.6,
      }}
    >
      <IconButton
        onClick={props.onToggle}
        tooltip={props.config.enabled ? "Disable" : "Enable"}
        size="sm"
      >
        {props.config.enabled ? (
          <Icon name="toggle-on" class="w-5 h-5" style={{ color: "var(--cortex-success)" }} />
        ) : (
          <Icon name="toggle-off" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
        )}
      </IconButton>
      
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>
            {props.taskLabel}
          </span>
          <span class="text-xs px-1.5 rounded" style={{ background: "var(--surface-hover)", color: "var(--text-weak)" }}>
            {props.config.delay}ms
          </span>
        </div>
        <div class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
          <code class="px-1 rounded" style={{ background: "var(--surface-hover)" }}>
            {props.config.globPattern}
          </code>
        </div>
      </div>

      <IconButton
        onClick={props.onDelete}
        tooltip="Delete"
        size="sm"
        style={{ opacity: 0 }}
        class="group-hover:opacity-100 transition-opacity"
      >
        <Icon name="trash" class="w-3.5 h-3.5 text-red-400" />
      </IconButton>
    </div>
  );
}


