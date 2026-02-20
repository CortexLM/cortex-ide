/**
 * =============================================================================
 * TASK PROVIDER - task prefix
 * =============================================================================
 * 
 * Lists all tasks from tasks.json and auto-detected tasks.
 * Shows running tasks with stop button, grouped by type.
 * Accessible via "task " prefix in quick access.
 */

import type { QuickAccessProvider, QuickAccessItem, QuickAccessItemButton } from "./types";
import { Icon } from "../../components/ui/Icon";
import type { TaskConfig, TaskRun } from "@/context/TasksContext";
import type { JSX } from "solid-js";

/**
 * Task item data
 */
interface TaskItemData {
  type: "run" | "stop" | "configure";
  taskLabel?: string;
  runId?: string;
}

/**
 * Get icon for task based on its type
 */
function getTaskIcon(task: TaskConfig): (props: { style?: JSX.CSSProperties }) => JSX.Element {
  const type = task.type?.toLowerCase() || "";
  
  if (type === "npm" || type === "yarn") {
    return (props: { style?: JSX.CSSProperties }) => Icon({ name: "box", style: props.style });
  }
  if (type === "cargo") {
    return (props: { style?: JSX.CSSProperties }) => Icon({ name: "box", style: props.style });
  }
  if (type === "shell" || type === "process") {
    return (props: { style?: JSX.CSSProperties }) => Icon({ name: "terminal", style: props.style });
  }
  if (type === "make" || type === "docker") {
    return (props: { style?: JSX.CSSProperties }) => Icon({ name: "wrench", style: props.style });
  }
  
  return (props: { style?: JSX.CSSProperties }) => Icon({ name: "code", style: props.style });
}

/**
 * Get icon color based on task group
 */
function getTaskIconColor(task: TaskConfig): string | undefined {
  const group = task.group;
  
  if (group === "build") return "#22c55e"; // Green
  if (group === "test") return "#f59e0b";  // Amber
  if (group === "run") return "#3b82f6";   // Blue
  if (group === "clean") return "#ef4444"; // Red
  if (group === "deploy") return "#8b5cf6"; // Purple
  
  return undefined;
}

/**
 * Create the Task Provider
 */
export function createTaskProvider(
  getTasks: () => TaskConfig[],
  getRunningTasks: () => TaskRun[],
  runTask: (task: TaskConfig) => Promise<void>,
  stopTask: (runId: string) => void,
  hide: () => void
): QuickAccessProvider<TaskItemData> {
  
  return {
    id: "quickaccess.task",
    prefix: "task ",
    name: "Tasks",
    description: "Run or manage tasks",
    placeholder: "Search tasks to run...",

    async provideItems(query: string): Promise<QuickAccessItem<TaskItemData>[]> {
      const items: QuickAccessItem<TaskItemData>[] = [];
      const trimmedQuery = query.trim().toLowerCase();
      const tasks = getTasks();
      const runningTasks = getRunningTasks();

      // Filter tasks by query
      const filterTask = (task: TaskConfig): boolean => {
        if (!trimmedQuery) return true;
        const label = task.label.toLowerCase();
        const command = (task.command || "").toLowerCase();
        return label.includes(trimmedQuery) || command.includes(trimmedQuery);
      };

      // Running tasks first
      const runningItems = runningTasks
        .filter(run => {
          if (!trimmedQuery) return true;
          return run.taskLabel.toLowerCase().includes(trimmedQuery);
        })
        .map(run => {
          const stopButton: QuickAccessItemButton = {
            icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "stop", style: props.style }),
            tooltip: "Stop Task",
            onClick: () => stopTask(run.id),
          };

          return {
            id: `running-${run.id}`,
            label: run.taskLabel,
            description: "Running",
            detail: run.config.command,
            icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "spinner", style: props.style }),
            iconColor: "#f59e0b", // Amber for running
            buttons: [stopButton],
            data: { type: "stop" as const, runId: run.id },
          };
        });

      if (runningItems.length > 0) {
        items.push({
          id: "separator-running",
          label: "Running Tasks",
          kind: "separator",
        });
        items.push(...runningItems);
      }

      // Group available tasks by group
      const buildTasks = tasks.filter(t => t.group === "build" && filterTask(t));
      const testTasks = tasks.filter(t => t.group === "test" && filterTask(t));
      const runTasks = tasks.filter(t => t.group === "run" && filterTask(t));
      const otherTasks = tasks.filter(t => (!t.group || t.group === "none" || t.group === "clean" || t.group === "deploy") && filterTask(t));

      // Helper to convert task to item
      const toQuickPickItem = (task: TaskConfig): QuickAccessItem<TaskItemData> => {
        // Check if this task is currently running
        const isRunning = runningTasks.some(r => r.taskLabel === task.label);
        
        return {
          id: `task-${task.label}`,
          label: task.label,
          description: task.source === "auto-detected" ? "Auto-detected" : task.isDefault ? "Default" : undefined,
          detail: task.command + (task.args?.length ? ` ${task.args.join(" ")}` : ""),
          icon: isRunning ? (props: { style?: JSX.CSSProperties }) => Icon({ name: "spinner", style: props.style }) : getTaskIcon(task),
          iconColor: isRunning ? "#f59e0b" : getTaskIconColor(task),
          data: { type: "run" as const, taskLabel: task.label },
        };
      };

      // Add build tasks
      if (buildTasks.length > 0) {
        items.push({
          id: "separator-build",
          label: "Build Tasks",
          kind: "separator",
        });
        items.push(...buildTasks.map(toQuickPickItem));
      }

      // Add test tasks
      if (testTasks.length > 0) {
        items.push({
          id: "separator-test",
          label: "Test Tasks",
          kind: "separator",
        });
        items.push(...testTasks.map(toQuickPickItem));
      }

      // Add run tasks
      if (runTasks.length > 0) {
        items.push({
          id: "separator-run",
          label: "Run Tasks",
          kind: "separator",
        });
        items.push(...runTasks.map(toQuickPickItem));
      }

      // Add other tasks
      if (otherTasks.length > 0) {
        items.push({
          id: "separator-other",
          label: "Other Tasks",
          kind: "separator",
        });
        items.push(...otherTasks.map(toQuickPickItem));
      }

      // If no tasks at all
      if (items.length === 0) {
        items.push({
          id: "no-tasks",
          label: "No tasks found",
          description: "Create a tasks.json file to define tasks",
          icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "gear", style: props.style }),
          data: { type: "configure" as const },
        });
      }

      return items;
    },

    onSelect(item: QuickAccessItem<TaskItemData>): void {
      if (!item.data) return;
      
      hide();

      switch (item.data.type) {
        case "run":
          if (item.data.taskLabel) {
            const tasks = getTasks();
            const task = tasks.find(t => t.label === item.data!.taskLabel);
            if (task) {
              runTask(task);
            }
          }
          break;
        case "stop":
          if (item.data.runId) {
            stopTask(item.data.runId);
          }
          break;
        case "configure":
          // Open tasks.json - dispatch event to handle this
          window.dispatchEvent(new CustomEvent("tasks:configure"));
          break;
      }
    },

    onButtonClick(_item: QuickAccessItem<TaskItemData>, button: QuickAccessItemButton): void {
      button.onClick();
    },
  };
}

export default createTaskProvider;
