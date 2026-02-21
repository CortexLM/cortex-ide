import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("ActionEntry Component Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AgentActionType", () => {
    type AgentActionType =
      | "file_read"
      | "file_edit"
      | "file_create"
      | "file_delete"
      | "terminal_command"
      | "terminal_output"
      | "thinking"
      | "tool_start"
      | "tool_complete"
      | "tool_error";

    it("should have all file action types", () => {
      const fileTypes: AgentActionType[] = ["file_read", "file_edit", "file_create", "file_delete"];
      expect(fileTypes).toHaveLength(4);
    });

    it("should have terminal action types", () => {
      const terminalTypes: AgentActionType[] = ["terminal_command", "terminal_output"];
      expect(terminalTypes).toHaveLength(2);
    });

    it("should have tool action types", () => {
      const toolTypes: AgentActionType[] = ["tool_start", "tool_complete", "tool_error"];
      expect(toolTypes).toHaveLength(3);
    });

    it("should have thinking type", () => {
      const type: AgentActionType = "thinking";
      expect(type).toBe("thinking");
    });
  });

  describe("ActionStatus", () => {
    type ActionStatus = "running" | "success" | "error" | "pending";

    it("should accept all status values", () => {
      const statuses: ActionStatus[] = ["running", "success", "error", "pending"];
      expect(statuses).toHaveLength(4);
    });
  });

  describe("ActionData Types", () => {
    interface FileReadData {
      type: "file_read";
      path: string;
      lineCount?: number;
      preview?: string;
    }

    interface FileEditData {
      type: "file_edit";
      path: string;
      linesAdded?: number;
      linesRemoved?: number;
      diff?: string;
    }

    interface FileCreateData {
      type: "file_create";
      path: string;
      lineCount?: number;
    }

    interface FileDeleteData {
      type: "file_delete";
      path: string;
    }

    interface TerminalCommandData {
      type: "terminal_command";
      command: string;
      cwd?: string;
    }

    interface TerminalOutputData {
      type: "terminal_output";
      output: string;
      exitCode?: number;
    }

    interface ThinkingData {
      type: "thinking";
      content?: string;
    }

    interface ToolStartData {
      type: "tool_start";
      toolName: string;
      args?: Record<string, unknown>;
    }

    interface ToolCompleteData {
      type: "tool_complete";
      toolName: string;
      result?: string;
      success: boolean;
    }

    interface ToolErrorData {
      type: "tool_error";
      toolName: string;
      error: string;
    }

    it("should create FileReadData", () => {
      const data: FileReadData = {
        type: "file_read",
        path: "/src/app.ts",
        lineCount: 150,
        preview: "const app = ...",
      };

      expect(data.type).toBe("file_read");
      expect(data.lineCount).toBe(150);
    });

    it("should create FileEditData", () => {
      const data: FileEditData = {
        type: "file_edit",
        path: "/src/utils.ts",
        linesAdded: 10,
        linesRemoved: 3,
        diff: "+new line\n-old line",
      };

      expect(data.linesAdded).toBe(10);
      expect(data.linesRemoved).toBe(3);
    });

    it("should create FileCreateData", () => {
      const data: FileCreateData = {
        type: "file_create",
        path: "/src/new-file.ts",
        lineCount: 25,
      };

      expect(data.type).toBe("file_create");
    });

    it("should create FileDeleteData", () => {
      const data: FileDeleteData = {
        type: "file_delete",
        path: "/src/old-file.ts",
      };

      expect(data.type).toBe("file_delete");
    });

    it("should create TerminalCommandData", () => {
      const data: TerminalCommandData = {
        type: "terminal_command",
        command: "npm test",
        cwd: "/home/user/project",
      };

      expect(data.command).toBe("npm test");
      expect(data.cwd).toBe("/home/user/project");
    });

    it("should create TerminalOutputData", () => {
      const data: TerminalOutputData = {
        type: "terminal_output",
        output: "All tests passed",
        exitCode: 0,
      };

      expect(data.exitCode).toBe(0);
    });

    it("should create ThinkingData", () => {
      const data: ThinkingData = {
        type: "thinking",
        content: "Analyzing the problem...",
      };

      expect(data.content).toBe("Analyzing the problem...");
    });

    it("should create ToolStartData", () => {
      const data: ToolStartData = {
        type: "tool_start",
        toolName: "search_files",
        args: { pattern: "*.ts", path: "/src" },
      };

      expect(data.toolName).toBe("search_files");
      expect(data.args?.pattern).toBe("*.ts");
    });

    it("should create ToolCompleteData", () => {
      const data: ToolCompleteData = {
        type: "tool_complete",
        toolName: "search_files",
        result: "Found 5 files",
        success: true,
      };

      expect(data.success).toBe(true);
    });

    it("should create ToolErrorData", () => {
      const data: ToolErrorData = {
        type: "tool_error",
        toolName: "deploy",
        error: "Permission denied",
      };

      expect(data.error).toBe("Permission denied");
    });
  });

  describe("AgentAction", () => {
    type AgentActionType = "file_read" | "file_edit" | "file_create" | "file_delete" | "terminal_command" | "terminal_output" | "thinking" | "tool_start" | "tool_complete" | "tool_error";
    type ActionStatus = "running" | "success" | "error" | "pending";

    interface AgentAction {
      id: string;
      type: AgentActionType;
      timestamp: number;
      status: ActionStatus;
      duration?: number;
      data: { type: string; [key: string]: unknown };
    }

    it("should create a complete action", () => {
      const action: AgentAction = {
        id: "act-1",
        type: "file_read",
        timestamp: Date.now(),
        status: "success",
        duration: 150,
        data: { type: "file_read", path: "/src/app.ts" },
      };

      expect(action.id).toBe("act-1");
      expect(action.duration).toBe(150);
    });

    it("should create action without duration", () => {
      const action: AgentAction = {
        id: "act-2",
        type: "thinking",
        timestamp: Date.now(),
        status: "running",
        data: { type: "thinking", content: "Processing..." },
      };

      expect(action.duration).toBeUndefined();
    });
  });

  describe("formatDuration", () => {
    function formatDuration(ms: number): string {
      if (ms < 1000) return `${ms}ms`;
      const seconds = Math.floor(ms / 1000);
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    }

    it("should format milliseconds", () => {
      expect(formatDuration(50)).toBe("50ms");
      expect(formatDuration(999)).toBe("999ms");
    });

    it("should format seconds", () => {
      expect(formatDuration(1000)).toBe("1s");
      expect(formatDuration(5000)).toBe("5s");
      expect(formatDuration(59000)).toBe("59s");
    });

    it("should format minutes and seconds", () => {
      expect(formatDuration(60000)).toBe("1m 0s");
      expect(formatDuration(90000)).toBe("1m 30s");
      expect(formatDuration(125000)).toBe("2m 5s");
    });

    it("should handle zero", () => {
      expect(formatDuration(0)).toBe("0ms");
    });
  });

  describe("formatTimestamp", () => {
    function formatTimestamp(timestamp: number): string {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }

    it("should format timestamp to time string", () => {
      const ts = new Date(2024, 0, 15, 14, 30, 45).getTime();
      const result = formatTimestamp(ts);
      expect(result).toContain("30");
      expect(result).toContain("45");
    });
  });

  describe("getFileName", () => {
    function getFileName(path: string): string {
      return path.split(/[/\\]/).pop() || path;
    }

    it("should extract filename from unix path", () => {
      expect(getFileName("/src/components/App.tsx")).toBe("App.tsx");
    });

    it("should extract filename from windows path", () => {
      expect(getFileName("C:\\Users\\src\\App.tsx")).toBe("App.tsx");
    });

    it("should return path if no separator", () => {
      expect(getFileName("file.ts")).toBe("file.ts");
    });

    it("should handle trailing separator", () => {
      const result = getFileName("/src/folder/");
      expect(result).toBeDefined();
    });
  });

  describe("truncatePath", () => {
    function truncatePath(path: string, maxLength: number = 40): string {
      if (path.length <= maxLength) return path;
      const parts = path.split(/[/\\]/);
      if (parts.length <= 2) return path.slice(-maxLength);
      return `.../${parts.slice(-2).join("/")}`;
    }

    it("should not truncate short paths", () => {
      expect(truncatePath("/src/app.ts")).toBe("/src/app.ts");
    });

    it("should truncate long paths", () => {
      const longPath = "/very/long/deeply/nested/directory/structure/file.ts";
      const result = truncatePath(longPath);
      expect(result).toBe(".../structure/file.ts");
    });

    it("should handle paths with few segments using ellipsis prefix", () => {
      const path = "/a-very-long-directory-name-that-exceeds-the-limit/file.ts";
      const result = truncatePath(path);
      expect(result).toContain("file.ts");
    });

    it("should respect custom maxLength", () => {
      const path = "/src/components/ui/Button.tsx";
      const result = truncatePath(path, 10);
      expect(result).toBe(".../ui/Button.tsx");
    });
  });

  describe("isExpandable Logic", () => {
    type AgentActionType = "file_read" | "file_edit" | "file_create" | "file_delete" | "terminal_command" | "terminal_output" | "thinking" | "tool_start" | "tool_complete" | "tool_error";

    function isExpandable(dataType: AgentActionType): boolean {
      return (
        dataType === "terminal_output" ||
        dataType === "file_edit" ||
        dataType === "thinking" ||
        dataType === "tool_complete" ||
        dataType === "tool_error"
      );
    }

    it("should be expandable for terminal_output", () => {
      expect(isExpandable("terminal_output")).toBe(true);
    });

    it("should be expandable for file_edit", () => {
      expect(isExpandable("file_edit")).toBe(true);
    });

    it("should be expandable for thinking", () => {
      expect(isExpandable("thinking")).toBe(true);
    });

    it("should be expandable for tool_complete", () => {
      expect(isExpandable("tool_complete")).toBe(true);
    });

    it("should be expandable for tool_error", () => {
      expect(isExpandable("tool_error")).toBe(true);
    });

    it("should not be expandable for file_read", () => {
      expect(isExpandable("file_read")).toBe(false);
    });

    it("should not be expandable for file_create", () => {
      expect(isExpandable("file_create")).toBe(false);
    });

    it("should not be expandable for file_delete", () => {
      expect(isExpandable("file_delete")).toBe(false);
    });

    it("should not be expandable for terminal_command", () => {
      expect(isExpandable("terminal_command")).toBe(false);
    });

    it("should not be expandable for tool_start", () => {
      expect(isExpandable("tool_start")).toBe(false);
    });
  });

  describe("actionTitle Generation", () => {
    function getFileName(path: string): string {
      return path.split(/[/\\]/).pop() || path;
    }

    function getActionTitle(data: { type: string; [key: string]: unknown }): string {
      switch (data.type) {
        case "file_read":
          return `Reading ${getFileName(data.path as string)}`;
        case "file_edit":
          return `Editing ${getFileName(data.path as string)}`;
        case "file_create":
          return `Creating ${getFileName(data.path as string)}`;
        case "file_delete":
          return `Deleting ${getFileName(data.path as string)}`;
        case "terminal_command": {
          const cmd = data.command as string;
          return `$ ${cmd.length > 50 ? cmd.slice(0, 50) + "..." : cmd}`;
        }
        case "terminal_output":
          return "Terminal Output";
        case "thinking":
          return "Thinking...";
        case "tool_start":
          return `Running ${data.toolName as string}`;
        case "tool_complete":
          return `Completed ${data.toolName as string}`;
        case "tool_error":
          return `Error in ${data.toolName as string}`;
        default:
          return "Action";
      }
    }

    it("should generate title for file_read", () => {
      expect(getActionTitle({ type: "file_read", path: "/src/app.ts" })).toBe("Reading app.ts");
    });

    it("should generate title for file_edit", () => {
      expect(getActionTitle({ type: "file_edit", path: "/src/utils.ts" })).toBe("Editing utils.ts");
    });

    it("should generate title for file_create", () => {
      expect(getActionTitle({ type: "file_create", path: "/src/new.ts" })).toBe("Creating new.ts");
    });

    it("should generate title for file_delete", () => {
      expect(getActionTitle({ type: "file_delete", path: "/src/old.ts" })).toBe("Deleting old.ts");
    });

    it("should generate title for short terminal_command", () => {
      expect(getActionTitle({ type: "terminal_command", command: "npm test" })).toBe("$ npm test");
    });

    it("should truncate long terminal_command", () => {
      const longCmd = "a".repeat(60);
      const result = getActionTitle({ type: "terminal_command", command: longCmd });
      expect(result).toBe(`$ ${"a".repeat(50)}...`);
    });

    it("should generate title for terminal_output", () => {
      expect(getActionTitle({ type: "terminal_output", output: "..." })).toBe("Terminal Output");
    });

    it("should generate title for thinking", () => {
      expect(getActionTitle({ type: "thinking" })).toBe("Thinking...");
    });

    it("should generate title for tool_start", () => {
      expect(getActionTitle({ type: "tool_start", toolName: "search" })).toBe("Running search");
    });

    it("should generate title for tool_complete", () => {
      expect(getActionTitle({ type: "tool_complete", toolName: "search" })).toBe("Completed search");
    });

    it("should generate title for tool_error", () => {
      expect(getActionTitle({ type: "tool_error", toolName: "deploy" })).toBe("Error in deploy");
    });

    it("should return Action for unknown type", () => {
      expect(getActionTitle({ type: "unknown" })).toBe("Action");
    });
  });

  describe("actionSubtitle Generation", () => {
    function truncatePath(path: string, maxLength: number = 40): string {
      if (path.length <= maxLength) return path;
      const parts = path.split(/[/\\]/);
      if (parts.length <= 2) return path.slice(-maxLength);
      return `.../${parts.slice(-2).join("/")}`;
    }

    function getActionSubtitle(data: { type: string; [key: string]: unknown }): string | undefined {
      switch (data.type) {
        case "file_read":
          return data.lineCount ? `${data.lineCount} lines` : truncatePath(data.path as string);
        case "file_edit": {
          const parts: string[] = [];
          if (data.linesAdded) parts.push(`+${data.linesAdded}`);
          if (data.linesRemoved) parts.push(`-${data.linesRemoved}`);
          return parts.length > 0 ? parts.join(" ") : truncatePath(data.path as string);
        }
        case "file_create":
          return data.lineCount ? `${data.lineCount} lines` : truncatePath(data.path as string);
        case "file_delete":
          return truncatePath(data.path as string);
        case "terminal_command":
          return data.cwd ? `in ${truncatePath(data.cwd as string, 30)}` : undefined;
        case "terminal_output":
          return data.exitCode !== undefined ? `exit ${data.exitCode}` : undefined;
        case "tool_start":
          return data.args ? `${Object.keys(data.args as Record<string, unknown>).length} args` : undefined;
        case "tool_complete":
          return (data.success as boolean) ? "success" : "failed";
        case "tool_error":
          return (data.error as string).slice(0, 40);
        default:
          return undefined;
      }
    }

    it("should show line count for file_read", () => {
      expect(getActionSubtitle({ type: "file_read", path: "/a.ts", lineCount: 100 })).toBe("100 lines");
    });

    it("should show path for file_read without lineCount", () => {
      expect(getActionSubtitle({ type: "file_read", path: "/src/app.ts" })).toBe("/src/app.ts");
    });

    it("should show diff stats for file_edit", () => {
      expect(getActionSubtitle({ type: "file_edit", path: "/a.ts", linesAdded: 5, linesRemoved: 2 })).toBe("+5 -2");
    });

    it("should show path for file_delete", () => {
      expect(getActionSubtitle({ type: "file_delete", path: "/src/old.ts" })).toBe("/src/old.ts");
    });

    it("should show cwd for terminal_command", () => {
      expect(getActionSubtitle({ type: "terminal_command", command: "ls", cwd: "/home" })).toBe("in /home");
    });

    it("should show exit code for terminal_output", () => {
      expect(getActionSubtitle({ type: "terminal_output", output: "ok", exitCode: 0 })).toBe("exit 0");
    });

    it("should show arg count for tool_start", () => {
      expect(getActionSubtitle({ type: "tool_start", toolName: "x", args: { a: 1, b: 2 } })).toBe("2 args");
    });

    it("should show success for tool_complete", () => {
      expect(getActionSubtitle({ type: "tool_complete", toolName: "x", success: true })).toBe("success");
    });

    it("should show failed for tool_complete with failure", () => {
      expect(getActionSubtitle({ type: "tool_complete", toolName: "x", success: false })).toBe("failed");
    });

    it("should show truncated error for tool_error", () => {
      const error = "A".repeat(50);
      const result = getActionSubtitle({ type: "tool_error", toolName: "x", error });
      expect(result).toBe("A".repeat(40));
    });
  });

  describe("getActionColor", () => {
    type AgentActionType = "file_read" | "file_edit" | "file_create" | "file_delete" | "terminal_command" | "terminal_output" | "thinking" | "tool_start" | "tool_complete" | "tool_error";

    function getActionColor(type: AgentActionType): string {
      switch (type) {
        case "file_read":
          return "var(--vscode-textLink-foreground)";
        case "file_edit":
          return "var(--vscode-notificationsWarningIcon-foreground)";
        case "file_create":
          return "var(--vscode-chat-linesAddedForeground)";
        case "file_delete":
          return "var(--vscode-chat-linesRemovedForeground)";
        case "terminal_command":
        case "terminal_output":
          return "var(--vscode-terminal-ansiCyan, var(--cortex-info))";
        case "thinking":
          return "var(--vscode-notificationsInfoIcon-foreground)";
        case "tool_start":
        case "tool_complete":
          return "var(--accent)";
        case "tool_error":
          return "var(--vscode-errorForeground)";
        default:
          return "var(--text-weak)";
      }
    }

    it("should return link color for file_read", () => {
      expect(getActionColor("file_read")).toBe("var(--vscode-textLink-foreground)");
    });

    it("should return warning color for file_edit", () => {
      expect(getActionColor("file_edit")).toBe("var(--vscode-notificationsWarningIcon-foreground)");
    });

    it("should return added color for file_create", () => {
      expect(getActionColor("file_create")).toBe("var(--vscode-chat-linesAddedForeground)");
    });

    it("should return removed color for file_delete", () => {
      expect(getActionColor("file_delete")).toBe("var(--vscode-chat-linesRemovedForeground)");
    });

    it("should return cyan for terminal actions", () => {
      const expected = "var(--vscode-terminal-ansiCyan, var(--cortex-info))";
      expect(getActionColor("terminal_command")).toBe(expected);
      expect(getActionColor("terminal_output")).toBe(expected);
    });

    it("should return info color for thinking", () => {
      expect(getActionColor("thinking")).toBe("var(--vscode-notificationsInfoIcon-foreground)");
    });

    it("should return accent for tool_start and tool_complete", () => {
      expect(getActionColor("tool_start")).toBe("var(--accent)");
      expect(getActionColor("tool_complete")).toBe("var(--accent)");
    });

    it("should return error color for tool_error", () => {
      expect(getActionColor("tool_error")).toBe("var(--vscode-errorForeground)");
    });
  });

  describe("expandedContent Extraction", () => {
    function getExpandedContent(data: { type: string; [key: string]: unknown }): string | undefined {
      switch (data.type) {
        case "terminal_output":
          return data.output as string;
        case "file_edit":
          return data.diff as string | undefined;
        case "thinking":
          return data.content as string | undefined;
        case "tool_complete":
          return data.result as string | undefined;
        case "tool_error":
          return data.error as string;
        default:
          return undefined;
      }
    }

    it("should return output for terminal_output", () => {
      expect(getExpandedContent({ type: "terminal_output", output: "test output" })).toBe("test output");
    });

    it("should return diff for file_edit", () => {
      expect(getExpandedContent({ type: "file_edit", path: "/a.ts", diff: "+new\n-old" })).toBe("+new\n-old");
    });

    it("should return content for thinking", () => {
      expect(getExpandedContent({ type: "thinking", content: "Analyzing..." })).toBe("Analyzing...");
    });

    it("should return result for tool_complete", () => {
      expect(getExpandedContent({ type: "tool_complete", toolName: "x", result: "Done" })).toBe("Done");
    });

    it("should return error for tool_error", () => {
      expect(getExpandedContent({ type: "tool_error", toolName: "x", error: "Failed" })).toBe("Failed");
    });

    it("should return undefined for non-expandable types", () => {
      expect(getExpandedContent({ type: "file_read", path: "/a.ts" })).toBeUndefined();
      expect(getExpandedContent({ type: "file_create", path: "/b.ts" })).toBeUndefined();
      expect(getExpandedContent({ type: "terminal_command", command: "ls" })).toBeUndefined();
    });
  });
});
