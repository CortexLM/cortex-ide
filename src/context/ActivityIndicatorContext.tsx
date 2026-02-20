import {
  createContext,
  useContext,
  ParentComponent,
  onMount,
  onCleanup,
  createMemo,
} from "solid-js";
import { createStore, produce } from "solid-js/store";

// ============================================================================
// Activity Types
// ============================================================================

/** Task priority levels for sorting display order */
export type TaskPriority = "high" | "normal" | "low";

/** Task status states */
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/** Source systems that can register tasks */
export type TaskSource =
  | "lsp"
  | "git"
  | "build"
  | "format"
  | "remote"
  | "extension"
  | "auto-update"
  | "repl"
  | "debug"
  | "system"
  | "mcp"
  | "custom";

/** Individual task representation */
export interface ActivityTask {
  id: string;
  title: string;
  message?: string;
  source: TaskSource;
  status: TaskStatus;
  priority: TaskPriority;
  progress?: number; // 0-100 for determinate progress, undefined for indeterminate
  cancellable: boolean;
  startedAt: number;
  completedAt?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/** Task history entry for completed tasks */
export interface TaskHistoryEntry {
  id: string;
  title: string;
  source: TaskSource;
  status: "completed" | "failed" | "cancelled";
  startedAt: number;
  completedAt: number;
  duration: number;
  error?: string;
}

/** Options for creating a new task */
export interface CreateTaskOptions {
  title: string;
  message?: string;
  source: TaskSource;
  priority?: TaskPriority;
  progress?: number;
  cancellable?: boolean;
  metadata?: Record<string, unknown>;
}

/** Options for updating an existing task */
export interface UpdateTaskOptions {
  title?: string;
  message?: string;
  progress?: number;
  status?: TaskStatus;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// State Types
// ============================================================================

interface ActivityIndicatorState {
  tasks: ActivityTask[];
  history: TaskHistoryEntry[];
  expanded: boolean;
  maxHistorySize: number;
}

interface ActivityIndicatorContextValue {
  state: ActivityIndicatorState;

  // Task management
  createTask: (options: CreateTaskOptions) => string;
  updateTask: (taskId: string, options: UpdateTaskOptions) => void;
  completeTask: (taskId: string, error?: string) => void;
  cancelTask: (taskId: string) => void;
  removeTask: (taskId: string) => void;

  // Progress helpers
  setProgress: (taskId: string, progress: number) => void;
  setMessage: (taskId: string, message: string) => void;

  // Batch operations
  clearCompleted: () => void;
  clearHistory: () => void;
  cancelAllCancellable: () => void;

  // UI state
  toggleExpanded: () => void;
  setExpanded: (expanded: boolean) => void;

  // Computed values
  activeTasks: () => ActivityTask[];
  hasActiveTasks: () => boolean;
  activeTaskCount: () => number;
  primaryTask: () => ActivityTask | undefined;
  tasksBySource: (source: TaskSource) => ActivityTask[];
  
  // Source-specific helpers
  isSourceBusy: (source: TaskSource) => boolean;
  getSourceProgress: (source: TaskSource) => number | undefined;
}

const ActivityIndicatorContext = createContext<ActivityIndicatorContextValue>();

// ============================================================================
// Provider Implementation
// ============================================================================

export const ActivityIndicatorProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<ActivityIndicatorState>({
    tasks: [],
    history: [],
    expanded: false,
    maxHistorySize: 50,
  });

  // ============================================================================
  // Task Management
  // ============================================================================

  const createTask = (options: CreateTaskOptions): string => {
    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task: ActivityTask = {
      id,
      title: options.title,
      message: options.message,
      source: options.source,
      status: "running",
      priority: options.priority || "normal",
      progress: options.progress,
      cancellable: options.cancellable ?? false,
      startedAt: Date.now(),
      metadata: options.metadata,
    };

    setState(
      produce((s) => {
        s.tasks.push(task);
      })
    );

    return id;
  };

  const updateTask = (taskId: string, options: UpdateTaskOptions) => {
    setState(
      produce((s) => {
        const task = s.tasks.find((t) => t.id === taskId);
        if (task) {
          if (options.title !== undefined) task.title = options.title;
          if (options.message !== undefined) task.message = options.message;
          if (options.progress !== undefined) task.progress = options.progress;
          if (options.status !== undefined) task.status = options.status;
          if (options.error !== undefined) task.error = options.error;
          if (options.metadata !== undefined) {
            task.metadata = { ...task.metadata, ...options.metadata };
          }
        }
      })
    );
  };

  const completeTask = (taskId: string, error?: string) => {
    setState(
      produce((s) => {
        const taskIndex = s.tasks.findIndex((t) => t.id === taskId);
        if (taskIndex >= 0) {
          const task = s.tasks[taskIndex];
          const completedAt = Date.now();
          const status: TaskStatus = error ? "failed" : "completed";

          // Add to history
          const historyEntry: TaskHistoryEntry = {
            id: task.id,
            title: task.title,
            source: task.source,
            status,
            startedAt: task.startedAt,
            completedAt,
            duration: completedAt - task.startedAt,
            error,
          };

          s.history.unshift(historyEntry);
          
          // Trim history if needed
          if (s.history.length > s.maxHistorySize) {
            s.history = s.history.slice(0, s.maxHistorySize);
          }

          // Remove from active tasks
          s.tasks.splice(taskIndex, 1);
        }
      })
    );
  };

  const cancelTask = (taskId: string) => {
    setState(
      produce((s) => {
        const taskIndex = s.tasks.findIndex((t) => t.id === taskId);
        if (taskIndex >= 0) {
          const task = s.tasks[taskIndex];
          
          if (task.cancellable) {
            const completedAt = Date.now();

            // Add to history as cancelled
            const historyEntry: TaskHistoryEntry = {
              id: task.id,
              title: task.title,
              source: task.source,
              status: "cancelled",
              startedAt: task.startedAt,
              completedAt,
              duration: completedAt - task.startedAt,
            };

            s.history.unshift(historyEntry);
            
            if (s.history.length > s.maxHistorySize) {
              s.history = s.history.slice(0, s.maxHistorySize);
            }

            // Remove from active tasks
            s.tasks.splice(taskIndex, 1);

            // Emit cancellation event for listeners
            window.dispatchEvent(
              new CustomEvent("activity:task-cancelled", {
                detail: { taskId, source: task.source, metadata: task.metadata },
              })
            );
          }
        }
      })
    );
  };

  const removeTask = (taskId: string) => {
    setState(
      produce((s) => {
        s.tasks = s.tasks.filter((t) => t.id !== taskId);
      })
    );
  };

  // ============================================================================
  // Progress Helpers
  // ============================================================================

  const setProgress = (taskId: string, progress: number) => {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    updateTask(taskId, { progress: clampedProgress });
  };

  const setMessage = (taskId: string, message: string) => {
    updateTask(taskId, { message });
  };

  // ============================================================================
  // Batch Operations
  // ============================================================================

  const clearCompleted = () => {
    setState(
      produce((s) => {
        s.tasks = s.tasks.filter(
          (t) => t.status !== "completed" && t.status !== "failed"
        );
      })
    );
  };

  const clearHistory = () => {
    setState("history", []);
  };

  const cancelAllCancellable = () => {
    const cancellableTasks = state.tasks.filter((t) => t.cancellable);
    cancellableTasks.forEach((t) => cancelTask(t.id));
  };

  // ============================================================================
  // UI State
  // ============================================================================

  const toggleExpanded = () => {
    setState("expanded", !state.expanded);
  };

  const setExpanded = (expanded: boolean) => {
    setState("expanded", expanded);
  };

  // ============================================================================
  // Computed Values
  // ============================================================================

  const activeTasks = createMemo(() =>
    state.tasks
      .filter((t) => t.status === "running" || t.status === "pending")
      .sort((a, b) => {
        // Sort by priority first
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        // Then by start time (newest first for same priority)
        return b.startedAt - a.startedAt;
      })
  );

  const hasActiveTasks = createMemo(() => activeTasks().length > 0);

  const activeTaskCount = createMemo(() => activeTasks().length);

  const primaryTask = createMemo(() => activeTasks()[0]);

  const tasksBySource = (source: TaskSource) =>
    state.tasks.filter((t) => t.source === source);

  const isSourceBusy = (source: TaskSource) =>
    state.tasks.some(
      (t) => t.source === source && (t.status === "running" || t.status === "pending")
    );

  const getSourceProgress = (source: TaskSource) => {
    const sourceTasks = tasksBySource(source).filter(
      (t) => t.status === "running" && t.progress !== undefined
    );
    if (sourceTasks.length === 0) return undefined;
    
    const totalProgress = sourceTasks.reduce((sum, t) => sum + (t.progress || 0), 0);
    return Math.round(totalProgress / sourceTasks.length);
  };

  // ============================================================================
  // Event Handlers for Integration
  // ============================================================================

  // Event handler references for cleanup
  const handleLspProgress = (e: CustomEvent) => {
    const { serverId, token, title, message, percentage, done } = e.detail;
    // taskId reserved for future use or logging: `lsp_${serverId}_${token}`

    if (done) {
      // Find and complete the task
      const existingTask = state.tasks.find((t) => t.metadata?.token === token);
      if (existingTask) {
        completeTask(existingTask.id);
      }
    } else {
      // Find or create task
      const existingTask = state.tasks.find((t) => t.metadata?.token === token);
      if (existingTask) {
        updateTask(existingTask.id, {
          title: title || existingTask.title,
          message,
          progress: percentage,
        });
      } else {
        createTask({
          title: title || "Language Server",
          message,
          source: "lsp",
          progress: percentage,
          cancellable: false,
          metadata: { serverId, token },
        });
      }
    }
  };

  // Handle Git operation events
  const handleGitOperation = (e: CustomEvent) => {
    const { operation, status, message, error } = e.detail;
    // taskId reserved for future use or logging: `git_${operation}_${Date.now()}`

    if (status === "start") {
      createTask({
        title: `Git: ${operation}`,
        message,
        source: "git",
        priority: "normal",
        cancellable: false,
        metadata: { operation },
      });
    } else if (status === "complete" || status === "error") {
      const task = state.tasks.find(
        (t) => t.source === "git" && t.metadata?.operation === operation
      );
      if (task) {
        completeTask(task.id, error);
      }
    }
  };

  // Handle build task events
  const handleBuildTask = (e: CustomEvent) => {
    const { taskLabel, status, progress, error } = e.detail;
    
    if (status === "start") {
      createTask({
        title: `Build: ${taskLabel}`,
        source: "build",
        priority: "high",
        progress,
        cancellable: true,
        metadata: { taskLabel },
      });
    } else if (status === "progress") {
      const task = state.tasks.find(
        (t) => t.source === "build" && t.metadata?.taskLabel === taskLabel
      );
      if (task) {
        updateTask(task.id, { progress });
      }
    } else if (status === "complete" || status === "error") {
      const task = state.tasks.find(
        (t) => t.source === "build" && t.metadata?.taskLabel === taskLabel
      );
      if (task) {
        completeTask(task.id, error);
      }
    }
  };

  // Handle formatter events
  const handleFormatterEvent = (e: CustomEvent) => {
    const { status, filePath, error } = e.detail;
    
    if (status === "start") {
      createTask({
        title: "Formatting",
        message: filePath,
        source: "format",
        priority: "low",
        cancellable: false,
        metadata: { filePath },
      });
    } else if (status === "complete" || status === "error") {
      const task = state.tasks.find(
        (t) => t.source === "format" && t.metadata?.filePath === filePath
      );
      if (task) {
        completeTask(task.id, error);
      }
    }
  };

  // Handle auto-update events
  const handleAutoUpdateEvent = (e: CustomEvent) => {
    const { status, progress, version, error } = e.detail;
    // taskId reserved for future use or logging: "auto_update"

    if (status === "checking") {
      createTask({
        title: "Checking for updates",
        source: "auto-update",
        priority: "low",
        cancellable: false,
        metadata: { phase: "checking" },
      });
    } else if (status === "downloading") {
      const task = state.tasks.find((t) => t.source === "auto-update");
      if (task) {
        updateTask(task.id, {
          title: `Downloading update${version ? ` v${version}` : ""}`,
          progress,
          metadata: { phase: "downloading", version },
        });
      } else {
        createTask({
          title: `Downloading update${version ? ` v${version}` : ""}`,
          source: "auto-update",
          priority: "normal",
          progress,
          cancellable: false,
          metadata: { phase: "downloading", version },
        });
      }
    } else if (status === "installing") {
      const task = state.tasks.find((t) => t.source === "auto-update");
      if (task) {
        updateTask(task.id, {
          title: `Installing update${version ? ` v${version}` : ""}`,
          progress: undefined, // Indeterminate
          metadata: { phase: "installing", version },
        });
      }
    } else if (status === "complete" || status === "error" || status === "idle") {
      const task = state.tasks.find((t) => t.source === "auto-update");
      if (task) {
        completeTask(task.id, error);
      }
    }
  };

  // Handle extension operations
  const handleExtensionEvent = (e: CustomEvent) => {
    const { extensionId, operation, status, error } = e.detail;
    
    if (status === "start") {
      const title =
        operation === "install"
          ? `Installing ${extensionId}`
          : operation === "update"
          ? `Updating ${extensionId}`
          : `Removing ${extensionId}`;
      createTask({
        title,
        source: "extension",
        priority: "normal",
        cancellable: false,
        metadata: { extensionId, operation },
      });
    } else if (status === "complete" || status === "error") {
      const task = state.tasks.find(
        (t) =>
          t.source === "extension" &&
          t.metadata?.extensionId === extensionId &&
          t.metadata?.operation === operation
      );
      if (task) {
        completeTask(task.id, error);
      }
    }
  };

  // Handle remote connection events
  const handleRemoteEvent = (e: CustomEvent) => {
    const { operation, status, profileId, message, error } = e.detail;
    
    if (status === "start") {
      createTask({
        title: `Remote: ${operation}`,
        message,
        source: "remote",
        priority: "high",
        cancellable: operation === "connect",
        metadata: { operation, profileId },
      });
    } else if (status === "progress") {
      const task = state.tasks.find(
        (t) => t.source === "remote" && t.metadata?.profileId === profileId
      );
      if (task) {
        updateTask(task.id, { message });
      }
    } else if (status === "complete" || status === "error") {
      const task = state.tasks.find(
        (t) => t.source === "remote" && t.metadata?.profileId === profileId
      );
      if (task) {
        completeTask(task.id, error);
      }
    }
  };

  // Handle MCP context server events
  const handleMcpEvent = (e: CustomEvent) => {
    const { serverId, operation, status, message, error } = e.detail;
    
    if (status === "start") {
      createTask({
        title: `MCP: ${operation}`,
        message,
        source: "mcp",
        priority: "normal",
        cancellable: false,
        metadata: { serverId, operation },
      });
    } else if (status === "complete" || status === "error") {
      const task = state.tasks.find(
        (t) => t.source === "mcp" && t.metadata?.serverId === serverId
      );
      if (task) {
        completeTask(task.id, error);
      }
    }
  };

  // Handle REPL execution events
  const handleReplEvent = (e: CustomEvent) => {
    const { kernelId, cellId, status, error } = e.detail;
    
    if (status === "executing") {
      createTask({
        title: "Executing cell",
        source: "repl",
        priority: "normal",
        cancellable: true,
        metadata: { kernelId, cellId },
      });
    } else if (status === "complete" || status === "error") {
      const task = state.tasks.find(
        (t) => t.source === "repl" && t.metadata?.cellId === cellId
      );
      if (task) {
        completeTask(task.id, error);
      }
    }
  };

  // Handle debug session events
  const handleDebugEvent = (e: CustomEvent) => {
    const { sessionId, status, adapter, error } = e.detail;
    
    if (status === "starting") {
      createTask({
        title: `Debug: ${adapter || "Session"}`,
        source: "debug",
        priority: "high",
        cancellable: true,
        metadata: { sessionId },
      });
    } else if (status === "running") {
      const task = state.tasks.find(
        (t) => t.source === "debug" && t.metadata?.sessionId === sessionId
      );
      if (task) {
        updateTask(task.id, { message: "Running" });
      }
    } else if (status === "stopped" || status === "error") {
      const task = state.tasks.find(
        (t) => t.source === "debug" && t.metadata?.sessionId === sessionId
      );
      if (task) {
        completeTask(task.id, error);
      }
    }
  };

  onMount(() => {
    // Register all event listeners synchronously
    window.addEventListener("lsp:progress", handleLspProgress as EventListener);
    window.addEventListener("git:operation", handleGitOperation as EventListener);
    window.addEventListener("build:task", handleBuildTask as EventListener);
    window.addEventListener("formatter:event", handleFormatterEvent as EventListener);
    window.addEventListener("auto-update:event", handleAutoUpdateEvent as EventListener);
    window.addEventListener("extension:event", handleExtensionEvent as EventListener);
    window.addEventListener("remote:event", handleRemoteEvent as EventListener);
    window.addEventListener("mcp:event", handleMcpEvent as EventListener);
    window.addEventListener("repl:execution", handleReplEvent as EventListener);
    window.addEventListener("debug:event", handleDebugEvent as EventListener);

    // Load history from localStorage
    try {
      const savedHistory = localStorage.getItem("cortex_activity_history");
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory) as TaskHistoryEntry[];
        // Validate and filter entries to ensure they have required fields
        const validEntries = parsed.filter(entry => 
          entry && 
          typeof entry.id === 'string' &&
          typeof entry.title === 'string' &&
          typeof entry.duration === 'number' &&
          typeof entry.startedAt === 'number' &&
          typeof entry.completedAt === 'number'
        );
        setState("history", validEntries.slice(0, state.maxHistorySize));
      }
    } catch (e) {
      console.error("[ActivityIndicator] Failed to load history:", e);
    }

    // Cleanup - must be inside onMount for proper reactive context
    onCleanup(() => {
      window.removeEventListener("lsp:progress", handleLspProgress as EventListener);
      window.removeEventListener("git:operation", handleGitOperation as EventListener);
      window.removeEventListener("build:task", handleBuildTask as EventListener);
      window.removeEventListener("formatter:event", handleFormatterEvent as EventListener);
      window.removeEventListener("auto-update:event", handleAutoUpdateEvent as EventListener);
      window.removeEventListener("extension:event", handleExtensionEvent as EventListener);
      window.removeEventListener("remote:event", handleRemoteEvent as EventListener);
      window.removeEventListener("mcp:event", handleMcpEvent as EventListener);
      window.removeEventListener("repl:execution", handleReplEvent as EventListener);
      window.removeEventListener("debug:event", handleDebugEvent as EventListener);

      // Save history to localStorage
      try {
        localStorage.setItem("cortex_activity_history", JSON.stringify(state.history));
      } catch (e) {
        console.error("[ActivityIndicator] Failed to save history:", e);
      }
    });
  });

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: ActivityIndicatorContextValue = {
    state,
    createTask,
    updateTask,
    completeTask,
    cancelTask,
    removeTask,
    setProgress,
    setMessage,
    clearCompleted,
    clearHistory,
    cancelAllCancellable,
    toggleExpanded,
    setExpanded,
    activeTasks,
    hasActiveTasks,
    activeTaskCount,
    primaryTask,
    tasksBySource,
    isSourceBusy,
    getSourceProgress,
  };

  return (
    <ActivityIndicatorContext.Provider value={value}>
      {props.children}
    </ActivityIndicatorContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

export function useActivityIndicator() {
  const ctx = useContext(ActivityIndicatorContext);
  if (!ctx) {
    throw new Error(
      "useActivityIndicator must be used within ActivityIndicatorProvider"
    );
  }
  return ctx;
}

// ============================================================================
// Helper Hook for Registering Tasks
// ============================================================================

/**
 * Hook for easily registering and managing a task within a component.
 * Automatically cleans up the task when the component unmounts.
 */
export function useTask(source: TaskSource) {
  const activity = useActivityIndicator();
  let currentTaskId: string | null = null;

  const start = (title: string, options?: Partial<CreateTaskOptions>): string => {
    // Complete any existing task from this hook
    if (currentTaskId) {
      activity.completeTask(currentTaskId);
    }

    currentTaskId = activity.createTask({
      title,
      source,
      ...options,
    });

    return currentTaskId;
  };

  const update = (options: UpdateTaskOptions) => {
    if (currentTaskId) {
      activity.updateTask(currentTaskId, options);
    }
  };

  const progress = (value: number) => {
    if (currentTaskId) {
      activity.setProgress(currentTaskId, value);
    }
  };

  const message = (msg: string) => {
    if (currentTaskId) {
      activity.setMessage(currentTaskId, msg);
    }
  };

  const complete = (error?: string) => {
    if (currentTaskId) {
      activity.completeTask(currentTaskId, error);
      currentTaskId = null;
    }
  };

  const cancel = () => {
    if (currentTaskId) {
      activity.cancelTask(currentTaskId);
      currentTaskId = null;
    }
  };

  // Cleanup on unmount
  onCleanup(() => {
    if (currentTaskId) {
      activity.removeTask(currentTaskId);
    }
  });

  return {
    start,
    update,
    progress,
    message,
    complete,
    cancel,
    get taskId() {
      return currentTaskId;
    },
  };
}
