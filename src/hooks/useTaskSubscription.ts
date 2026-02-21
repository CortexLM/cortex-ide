import { createSignal, createEffect, onCleanup } from "solid-js";
import type { Task } from "@/components/tasks/TaskProgress";

interface UseTaskSubscriptionOptions {
  /** WebSocket URL for task updates */
  wsUrl?: string;
  /** Polling interval in ms if WebSocket is not available */
  pollInterval?: number;
  /** Initial tasks */
  initialTasks?: Task[];
}

interface UseTaskSubscriptionReturn {
  /** Current list of tasks */
  tasks: () => Task[];
  /** Whether we're currently loading */
  isLoading: () => boolean;
  /** Any error that occurred */
  error: () => string | null;
  /** Add a new task */
  addTask: (description: string) => Task;
  /** Update a task's status */
  updateTask: (id: string, updates: Partial<Task>) => void;
  /** Remove a task */
  removeTask: (id: string) => void;
  /** Clear all completed tasks */
  clearCompleted: () => void;
  /** Manually refresh tasks */
  refresh: () => Promise<void>;
}

/**
 * Hook for subscribing to real-time task updates
 */
export function useTaskSubscription(
  sessionId: string,
  options: UseTaskSubscriptionOptions = {}
): UseTaskSubscriptionReturn {
  const {
    wsUrl,
    pollInterval = 5000,
    initialTasks = [],
  } = options;

  const [tasks, setTasks] = createSignal<Task[]>(initialTasks);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  let ws: WebSocket | null = null;
  let pollTimer: number | null = null;

  // Generate a unique task ID
  const generateId = () => `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Fetch tasks from API
  const fetchTasks = async (): Promise<Task[]> => {
    try {
      const response = await fetch(`/api/v1/sessions/${sessionId}/tasks`);
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      return response.json();
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
      return [];
    }
  };

  // Refresh tasks
  const refresh = async () => {
    setIsLoading(true);
    try {
      const newTasks = await fetchTasks();
      setTasks(newTasks);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh tasks");
    } finally {
      setIsLoading(false);
    }
  };

  // Connect to WebSocket for real-time updates
  const connectWebSocket = () => {
    if (!wsUrl) return;

    try {
      ws = new WebSocket(`${wsUrl}/sessions/${sessionId}/tasks/ws`);

      ws.onopen = () => {
        if (import.meta.env.DEV) console.log("[useTaskSubscription] WebSocket connected");
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (e) {
          console.error("[useTaskSubscription] Failed to parse message:", e);
        }
      };

      ws.onerror = (event) => {
        console.error("[useTaskSubscription] WebSocket error:", event);
        setError("WebSocket connection error");
      };

      ws.onclose = () => {
        if (import.meta.env.DEV) console.log("[useTaskSubscription] WebSocket closed");
        // Attempt to reconnect after a delay
        setTimeout(connectWebSocket, 3000);
      };
    } catch (e) {
      console.error("[useTaskSubscription] Failed to connect WebSocket:", e);
      // Fall back to polling
      startPolling();
    }
  };

  // Handle WebSocket messages
  const handleWebSocketMessage = (message: {
    type: "task-added" | "task-updated" | "task-removed" | "tasks-sync";
    task?: Task;
    tasks?: Task[];
    taskId?: string;
  }) => {
    switch (message.type) {
      case "task-added":
        if (message.task) {
          setTasks((prev) => [...prev, message.task!]);
        }
        break;

      case "task-updated":
        if (message.task) {
          setTasks((prev) =>
            prev.map((t) => (t.id === message.task!.id ? { ...t, ...message.task } : t))
          );
        }
        break;

      case "task-removed":
        if (message.taskId) {
          setTasks((prev) => prev.filter((t) => t.id !== message.taskId));
        }
        break;

      case "tasks-sync":
        if (message.tasks) {
          setTasks(message.tasks);
        }
        break;
    }
  };

  // Start polling if WebSocket is not available
  const startPolling = () => {
    if (pollTimer) return;

    const poll = async () => {
      const newTasks = await fetchTasks();
      setTasks(newTasks);
    };

    pollTimer = setInterval(poll, pollInterval) as unknown as number;
    poll(); // Initial fetch
  };

  // Stop polling
  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  // Add a new task
  const addTask = (description: string): Task => {
    const task: Task = {
      id: generateId(),
      description,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    setTasks((prev) => [...prev, task]);

    // Notify server
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "add_task", task }));
    }

    return task;
  };

  // Update a task
  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, ...updates, updatedAt: new Date().toISOString() }
          : t
      )
    );

    // Notify server
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "update_task", taskId: id, updates }));
    }
  };

  // Remove a task
  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));

    // Notify server
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "remove_task", taskId: id }));
    }
  };

  // Clear completed tasks
  const clearCompleted = () => {
    const completedIds = tasks()
      .filter((t) => t.status === "completed")
      .map((t) => t.id);

    setTasks((prev) => prev.filter((t) => t.status !== "completed"));

    // Notify server
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "clear_completed", taskIds: completedIds }));
    }
  };

  // Initialize
  createEffect(() => {
    if (sessionId) {
      setIsLoading(true);
      refresh().then(() => {
        setIsLoading(false);
        // Try WebSocket, fall back to polling
        if (wsUrl) {
          connectWebSocket();
        } else {
          startPolling();
        }
      });
    }
  });

  // Cleanup
  onCleanup(() => {
    if (ws) {
      ws.close();
      ws = null;
    }
    stopPolling();
  });

  return {
    tasks,
    isLoading,
    error,
    addTask,
    updateTask,
    removeTask,
    clearCompleted,
    refresh,
  };
}
