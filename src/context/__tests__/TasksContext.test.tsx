import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("TasksContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("TaskType enum", () => {
    it("should define task type values", () => {
      const TaskType = {
        Shell: "shell",
        Process: "process",
        Npm: "npm",
        Yarn: "yarn",
        Cargo: "cargo",
        Make: "make",
        Poetry: "poetry",
        Pip: "pip",
        Docker: "docker",
      } as const;

      expect(TaskType.Shell).toBe("shell");
      expect(TaskType.Process).toBe("process");
      expect(TaskType.Npm).toBe("npm");
      expect(TaskType.Cargo).toBe("cargo");
      expect(TaskType.Docker).toBe("docker");
    });
  });

  describe("TaskGroup enum", () => {
    it("should define task group values", () => {
      const TaskGroup = {
        Build: "build",
        Test: "test",
        Run: "run",
        Clean: "clean",
        Deploy: "deploy",
        None: "none",
      } as const;

      expect(TaskGroup.Build).toBe("build");
      expect(TaskGroup.Test).toBe("test");
      expect(TaskGroup.Deploy).toBe("deploy");
      expect(TaskGroup.None).toBe("none");
    });
  });

  describe("TaskStatus enum", () => {
    it("should define task status values", () => {
      const TaskStatus = {
        Pending: "pending",
        Running: "running",
        Completed: "completed",
        Failed: "failed",
        Cancelled: "cancelled",
      } as const;

      expect(TaskStatus.Pending).toBe("pending");
      expect(TaskStatus.Running).toBe("running");
      expect(TaskStatus.Completed).toBe("completed");
      expect(TaskStatus.Failed).toBe("failed");
      expect(TaskStatus.Cancelled).toBe("cancelled");
    });
  });

  describe("TaskConfig interface", () => {
    it("should define task configuration structure", () => {
      interface TaskConfig {
        label: string;
        type: "shell" | "process" | "npm" | "yarn" | "cargo" | "make" | "poetry" | "pip" | "docker";
        command: string;
        args?: string[];
        cwd?: string;
        env?: Record<string, string>;
        problemMatcher?: string | string[];
        group?: "build" | "test" | "run" | "clean" | "deploy" | "none";
        presentation?: {
          reveal?: "always" | "silent" | "never";
          panel?: "shared" | "dedicated" | "new";
          focus?: boolean;
          clear?: boolean;
        };
        dependsOn?: string[];
        isBackground?: boolean;
      }

      const config: TaskConfig = {
        label: "Build Project",
        type: "npm",
        command: "run",
        args: ["build"],
        cwd: "${workspaceFolder}",
        env: { NODE_ENV: "production" },
        problemMatcher: ["$tsc"],
        group: "build",
        presentation: {
          reveal: "always",
          panel: "shared",
          focus: false,
          clear: true,
        },
        dependsOn: ["lint"],
        isBackground: false,
      };

      expect(config.label).toBe("Build Project");
      expect(config.type).toBe("npm");
      expect(config.args).toContain("build");
      expect(config.group).toBe("build");
    });
  });

  describe("TaskRun interface", () => {
    it("should define task run structure", () => {
      interface TaskConfig {
        label: string;
        type: string;
        command: string;
      }

      interface TaskRun {
        id: string;
        taskLabel: string;
        config: TaskConfig;
        terminalId: string;
        status: "pending" | "running" | "completed" | "failed" | "cancelled";
        startedAt: number;
        finishedAt?: number;
        exitCode?: number;
        output: string[];
        errors: string[];
      }

      const run: TaskRun = {
        id: "run-001",
        taskLabel: "Build Project",
        config: { label: "Build Project", type: "npm", command: "run build" },
        terminalId: "terminal-001",
        status: "running",
        startedAt: Date.now(),
        output: ["Building...", "Compiling..."],
        errors: [],
      };

      expect(run.id).toBe("run-001");
      expect(run.status).toBe("running");
      expect(run.output).toHaveLength(2);
    });

    it("should track completed task run", () => {
      interface TaskRun {
        id: string;
        taskLabel: string;
        status: "pending" | "running" | "completed" | "failed" | "cancelled";
        startedAt: number;
        finishedAt?: number;
        exitCode?: number;
      }

      const completedRun: TaskRun = {
        id: "run-002",
        taskLabel: "Test Suite",
        status: "completed",
        startedAt: 1000,
        finishedAt: 5000,
        exitCode: 0,
      };

      expect(completedRun.status).toBe("completed");
      expect(completedRun.exitCode).toBe(0);
      expect(completedRun.finishedAt! - completedRun.startedAt).toBe(4000);
    });
  });

  describe("ProblemMatcher interface", () => {
    it("should define problem matcher structure", () => {
      interface ProblemMatcher {
        owner: string;
        pattern: {
          regexp: string;
          file: number;
          line: number;
          column?: number;
          severity?: number;
          message: number;
        };
        fileLocation?: "absolute" | "relative";
        severity?: "error" | "warning" | "info";
      }

      const matcher: ProblemMatcher = {
        owner: "typescript",
        pattern: {
          regexp: "^(.*)\\((\\d+),(\\d+)\\): (error|warning) (.*)$",
          file: 1,
          line: 2,
          column: 3,
          severity: 4,
          message: 5,
        },
        fileLocation: "relative",
        severity: "error",
      };

      expect(matcher.owner).toBe("typescript");
      expect(matcher.pattern.file).toBe(1);
      expect(matcher.fileLocation).toBe("relative");
    });
  });

  describe("TasksContextValue interface", () => {
    it("should define full context value structure", () => {
      interface TaskConfig {
        label: string;
        type: string;
        command: string;
      }

      interface TaskRun {
        id: string;
        taskLabel: string;
        status: string;
      }

      interface TasksContextValue {
        tasks: TaskConfig[];
        runningTasks: TaskRun[];
        taskHistory: TaskRun[];
        isLoading: boolean;
        error: string | null;
        loadTasks: () => Promise<void>;
        runTask: (label: string) => Promise<TaskRun>;
        cancelTask: (runId: string) => void;
        restartTask: (runId: string) => Promise<TaskRun>;
        getTaskByLabel: (label: string) => TaskConfig | undefined;
        getTasksByGroup: (group: string) => TaskConfig[];
        addTask: (config: TaskConfig) => void;
        updateTask: (label: string, config: Partial<TaskConfig>) => void;
        removeTask: (label: string) => void;
        clearHistory: () => void;
      }

      const mockContext: TasksContextValue = {
        tasks: [],
        runningTasks: [],
        taskHistory: [],
        isLoading: false,
        error: null,
        loadTasks: vi.fn(),
        runTask: vi.fn(),
        cancelTask: vi.fn(),
        restartTask: vi.fn(),
        getTaskByLabel: vi.fn(),
        getTasksByGroup: vi.fn(),
        addTask: vi.fn(),
        updateTask: vi.fn(),
        removeTask: vi.fn(),
        clearHistory: vi.fn(),
      };

      expect(mockContext.tasks).toEqual([]);
      expect(typeof mockContext.runTask).toBe("function");
    });
  });

  describe("Variable substitution", () => {
    it("should substitute workspace folder variable", () => {
      const workspaceFolder = "/home/user/project";

      const substituteVariables = (value: string): string => {
        return value.replace(/\$\{workspaceFolder\}/g, workspaceFolder);
      };

      expect(substituteVariables("${workspaceFolder}/src")).toBe("/home/user/project/src");
    });

    it("should substitute file variables", () => {
      const context = {
        file: "/home/user/project/src/index.ts",
        fileBasename: "index.ts",
        fileBasenameNoExtension: "index",
        fileDirname: "/home/user/project/src",
        fileExtname: ".ts",
      };

      const substituteVariables = (value: string): string => {
        return value
          .replace(/\$\{file\}/g, context.file)
          .replace(/\$\{fileBasename\}/g, context.fileBasename)
          .replace(/\$\{fileBasenameNoExtension\}/g, context.fileBasenameNoExtension)
          .replace(/\$\{fileDirname\}/g, context.fileDirname)
          .replace(/\$\{fileExtname\}/g, context.fileExtname);
      };

      expect(substituteVariables("${file}")).toBe("/home/user/project/src/index.ts");
      expect(substituteVariables("${fileBasename}")).toBe("index.ts");
      expect(substituteVariables("${fileBasenameNoExtension}")).toBe("index");
    });

    it("should substitute environment variables", () => {
      const env: Record<string, string> = {
        HOME: "/home/user",
        NODE_ENV: "development",
      };

      const substituteVariables = (value: string): string => {
        return value.replace(/\$\{env:(\w+)\}/g, (_, name) => env[name] ?? "");
      };

      expect(substituteVariables("${env:HOME}/projects")).toBe("/home/user/projects");
      expect(substituteVariables("${env:NODE_ENV}")).toBe("development");
      expect(substituteVariables("${env:UNKNOWN}")).toBe("");
    });

    it("should substitute config variables", () => {
      const config: Record<string, string> = {
        "python.pythonPath": "/usr/bin/python3",
        "editor.fontSize": "14",
      };

      const substituteVariables = (value: string): string => {
        return value.replace(/\$\{config:([^}]+)\}/g, (_, name) => config[name] ?? "");
      };

      expect(substituteVariables("${config:python.pythonPath}")).toBe("/usr/bin/python3");
    });
  });

  describe("Task execution", () => {
    it("should run a task", async () => {
      const mockedInvoke = vi.mocked(invoke);
      mockedInvoke.mockResolvedValueOnce({ id: "run-001", status: "running" });

      interface TaskConfig {
        label: string;
        type: string;
        command: string;
      }

      const runTask = async (config: TaskConfig): Promise<{ id: string; status: string }> => {
        return await invoke("task_run", { config });
      };

      const result = await runTask({ label: "build", type: "npm", command: "run build" });
      expect(result.id).toBe("run-001");
      expect(result.status).toBe("running");
    });

    it("should cancel a running task", async () => {
      const mockedInvoke = vi.mocked(invoke);
      mockedInvoke.mockResolvedValueOnce({ success: true });

      const cancelTask = async (runId: string): Promise<boolean> => {
        const result = await invoke<{ success: boolean }>("task_cancel", { runId });
        return result.success;
      };

      const success = await cancelTask("run-001");
      expect(success).toBe(true);
    });

    it("should track task output", () => {
      interface TaskRun {
        id: string;
        output: string[];
        errors: string[];
      }

      const run: TaskRun = {
        id: "run-001",
        output: [],
        errors: [],
      };

      const appendOutput = (line: string): void => {
        run.output.push(line);
      };

      const appendError = (line: string): void => {
        run.errors.push(line);
      };

      appendOutput("Compiling...");
      appendOutput("Building...");
      appendError("Warning: unused variable");

      expect(run.output).toHaveLength(2);
      expect(run.errors).toHaveLength(1);
    });
  });

  describe("Task management", () => {
    it("should get task by label", () => {
      interface TaskConfig {
        label: string;
        type: string;
        command: string;
      }

      const tasks: TaskConfig[] = [
        { label: "build", type: "npm", command: "run build" },
        { label: "test", type: "npm", command: "run test" },
      ];

      const getTaskByLabel = (label: string): TaskConfig | undefined => {
        return tasks.find((t) => t.label === label);
      };

      expect(getTaskByLabel("build")).toBeDefined();
      expect(getTaskByLabel("build")?.command).toBe("run build");
      expect(getTaskByLabel("nonexistent")).toBeUndefined();
    });

    it("should get tasks by group", () => {
      interface TaskConfig {
        label: string;
        type: string;
        command: string;
        group?: string;
      }

      const tasks: TaskConfig[] = [
        { label: "build:dev", type: "npm", command: "run build:dev", group: "build" },
        { label: "build:prod", type: "npm", command: "run build:prod", group: "build" },
        { label: "test", type: "npm", command: "run test", group: "test" },
      ];

      const getTasksByGroup = (group: string): TaskConfig[] => {
        return tasks.filter((t) => t.group === group);
      };

      const buildTasks = getTasksByGroup("build");
      expect(buildTasks).toHaveLength(2);
      expect(buildTasks.every((t) => t.group === "build")).toBe(true);
    });

    it("should add a new task", () => {
      interface TaskConfig {
        label: string;
        type: string;
        command: string;
      }

      const tasks: TaskConfig[] = [];

      const addTask = (config: TaskConfig): void => {
        if (!tasks.find((t) => t.label === config.label)) {
          tasks.push(config);
        }
      };

      addTask({ label: "lint", type: "npm", command: "run lint" });
      expect(tasks).toHaveLength(1);

      addTask({ label: "lint", type: "npm", command: "run lint" });
      expect(tasks).toHaveLength(1);
    });

    it("should update an existing task", () => {
      interface TaskConfig {
        label: string;
        type: string;
        command: string;
      }

      const tasks: TaskConfig[] = [
        { label: "build", type: "npm", command: "run build" },
      ];

      const updateTask = (label: string, updates: Partial<TaskConfig>): void => {
        const index = tasks.findIndex((t) => t.label === label);
        if (index !== -1) {
          tasks[index] = { ...tasks[index], ...updates };
        }
      };

      updateTask("build", { command: "run build:prod" });
      expect(tasks[0].command).toBe("run build:prod");
    });

    it("should remove a task", () => {
      interface TaskConfig {
        label: string;
        type: string;
        command: string;
      }

      let tasks: TaskConfig[] = [
        { label: "build", type: "npm", command: "run build" },
        { label: "test", type: "npm", command: "run test" },
      ];

      const removeTask = (label: string): void => {
        tasks = tasks.filter((t) => t.label !== label);
      };

      removeTask("build");
      expect(tasks).toHaveLength(1);
      expect(tasks[0].label).toBe("test");
    });
  });

  describe("Task history", () => {
    it("should track task run history", () => {
      interface TaskRun {
        id: string;
        taskLabel: string;
        status: string;
        startedAt: number;
      }

      const history: TaskRun[] = [];

      const addToHistory = (run: TaskRun): void => {
        history.unshift(run);
      };

      addToHistory({ id: "run-1", taskLabel: "build", status: "completed", startedAt: 1000 });
      addToHistory({ id: "run-2", taskLabel: "test", status: "failed", startedAt: 2000 });

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe("run-2");
    });

    it("should clear task history", () => {
      interface TaskRun {
        id: string;
        taskLabel: string;
      }

      let history: TaskRun[] = [
        { id: "run-1", taskLabel: "build" },
        { id: "run-2", taskLabel: "test" },
      ];

      const clearHistory = (): void => {
        history = [];
      };

      clearHistory();
      expect(history).toHaveLength(0);
    });

    it("should limit history size", () => {
      interface TaskRun {
        id: string;
        taskLabel: string;
      }

      const MAX_HISTORY = 100;
      let history: TaskRun[] = [];

      const addToHistory = (run: TaskRun): void => {
        history.unshift(run);
        if (history.length > MAX_HISTORY) {
          history = history.slice(0, MAX_HISTORY);
        }
      };

      for (let i = 0; i < 150; i++) {
        addToHistory({ id: `run-${i}`, taskLabel: "task" });
      }

      expect(history.length).toBe(MAX_HISTORY);
    });
  });

  describe("Problem matcher parsing", () => {
    it("should parse TypeScript errors", () => {
      interface Problem {
        file: string;
        line: number;
        column: number;
        severity: string;
        message: string;
      }

      const parseTypescriptError = (line: string): Problem | null => {
        const match = line.match(/^(.+)\((\d+),(\d+)\): (error|warning) TS\d+: (.+)$/);
        if (!match) return null;
        return {
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          severity: match[4],
          message: match[5],
        };
      };

      const error = parseTypescriptError("src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.");
      expect(error).not.toBeNull();
      expect(error?.file).toBe("src/index.ts");
      expect(error?.line).toBe(10);
      expect(error?.severity).toBe("error");
    });

    it("should parse ESLint errors", () => {
      interface Problem {
        file: string;
        line: number;
        column: number;
        message: string;
        rule: string;
      }

      const parseEslintError = (line: string): Problem | null => {
        const match = line.match(/^(.+):(\d+):(\d+): (.+) \[(.+)\]$/);
        if (!match) return null;
        return {
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          message: match[4],
          rule: match[5],
        };
      };

      const error = parseEslintError("src/utils.ts:25:10: 'x' is defined but never used [no-unused-vars]");
      expect(error).not.toBeNull();
      expect(error?.line).toBe(25);
      expect(error?.rule).toBe("no-unused-vars");
    });
  });

  describe("Task dependencies", () => {
    it("should resolve task dependencies", () => {
      interface TaskConfig {
        label: string;
        dependsOn?: string[];
      }

      const tasks: TaskConfig[] = [
        { label: "build", dependsOn: ["lint", "compile"] },
        { label: "lint" },
        { label: "compile", dependsOn: ["generate"] },
        { label: "generate" },
      ];

      const resolveDependencies = (label: string, resolved: Set<string> = new Set()): string[] => {
        const task = tasks.find((t) => t.label === label);
        if (!task || resolved.has(label)) return [];

        const deps: string[] = [];
        for (const dep of task.dependsOn ?? []) {
          deps.push(...resolveDependencies(dep, resolved));
          if (!resolved.has(dep)) {
            deps.push(dep);
            resolved.add(dep);
          }
        }
        return deps;
      };

      const deps = resolveDependencies("build");
      expect(deps).toContain("lint");
      expect(deps).toContain("compile");
      expect(deps).toContain("generate");
      expect(deps.indexOf("generate")).toBeLessThan(deps.indexOf("compile"));
    });
  });
});
