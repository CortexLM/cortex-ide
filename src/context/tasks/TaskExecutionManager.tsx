import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "@/utils/logger";

const logger = createLogger("TaskExecution");

export interface VariableContext {
  workspaceFolder: string;
  file?: string;
  lineNumber?: number;
  selectedText?: string;
}

export interface TaskDependencyNode {
  label: string;
  dependsOn: string[];
  resolved: boolean;
}

export function substituteVariables(input: string, ctx: VariableContext): string {
  return input.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
    switch (varName) {
      case "workspaceFolder":
        return ctx.workspaceFolder;
      case "workspaceFolderBasename": {
        const parts = ctx.workspaceFolder.replace(/\\/g, "/").split("/");
        return parts[parts.length - 1] || "";
      }
      case "file":
        return ctx.file ?? "";
      case "fileBasename": {
        if (!ctx.file) return "";
        const parts = ctx.file.replace(/\\/g, "/").split("/");
        return parts[parts.length - 1] || "";
      }
      case "fileDirname": {
        if (!ctx.file) return "";
        const parts = ctx.file.replace(/\\/g, "/").split("/");
        return parts.slice(0, -1).join("/");
      }
      case "fileExtname": {
        if (!ctx.file) return "";
        const dot = ctx.file.lastIndexOf(".");
        return dot >= 0 ? ctx.file.slice(dot) : "";
      }
      case "fileBasenameNoExtension": {
        if (!ctx.file) return "";
        const parts = ctx.file.replace(/\\/g, "/").split("/");
        const basename = parts[parts.length - 1] || "";
        const dot = basename.lastIndexOf(".");
        return dot >= 0 ? basename.slice(0, dot) : basename;
      }
      case "relativeFile": {
        if (!ctx.file) return "";
        const ws = ctx.workspaceFolder.replace(/\\/g, "/");
        const f = ctx.file.replace(/\\/g, "/");
        return f.startsWith(ws) ? f.slice(ws.length + 1) : f;
      }
      case "relativeFileDirname": {
        if (!ctx.file) return "";
        const ws = ctx.workspaceFolder.replace(/\\/g, "/");
        const f = ctx.file.replace(/\\/g, "/");
        const rel = f.startsWith(ws) ? f.slice(ws.length + 1) : f;
        const parts = rel.split("/");
        return parts.slice(0, -1).join("/");
      }
      case "lineNumber":
        return ctx.lineNumber != null ? String(ctx.lineNumber) : "";
      case "selectedText":
        return ctx.selectedText ?? "";
      case "pathSeparator":
        return navigator.platform.startsWith("Win") ? "\\" : "/";
      default:
        if (varName.startsWith("env:")) {
          return "";
        }
        if (varName.startsWith("input:")) {
          return `\${${varName}}`;
        }
        return `\${${varName}}`;
    }
  });
}

export function resolveDependencyOrder(
  tasks: TaskDependencyNode[],
  taskLabel: string,
): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(label: string) {
    if (visited.has(label)) return;
    visited.add(label);

    const task = tasks.find((t) => t.label === label);
    if (!task) {
      logger.warn(`Dependency task '${label}' not found`);
      return;
    }

    for (const dep of task.dependsOn) {
      if (visited.has(dep) && !order.includes(dep)) {
        logger.warn(`Circular dependency detected: ${label} -> ${dep}`);
        continue;
      }
      visit(dep);
    }

    if (!order.includes(label)) {
      order.push(label);
    }
  }

  visit(taskLabel);
  return order;
}

export interface BackgroundTaskState {
  id: string;
  label: string;
  status: "running" | "idle" | "stopped";
  startedAt: number;
}

export function createBackgroundTaskTracker() {
  const [tasks, setTasks] = createSignal<BackgroundTaskState[]>([]);

  const addTask = (id: string, label: string) => {
    setTasks((prev) => [
      ...prev,
      { id, label, status: "running", startedAt: Date.now() },
    ]);
  };

  const updateStatus = (id: string, status: BackgroundTaskState["status"]) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t))
    );
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  return { tasks, addTask, updateStatus, removeTask };
}

export async function runTaskWithDependencies(
  taskName: string,
  workspacePath?: string,
): Promise<string> {
  try {
    const taskId = await invoke<string>("tasks_run_with_dependencies", {
      taskName,
      workspacePath,
    });
    logger.info(`Task '${taskName}' started with dependencies, id: ${taskId}`);
    return taskId;
  } catch (err) {
    logger.error(`Failed to run task '${taskName}' with dependencies:`, err);
    throw err;
  }
}
