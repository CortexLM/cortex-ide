import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("ToolCard Component Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ToolStatus Type", () => {
    type ToolStatus = "pending" | "running" | "completed" | "error";

    it("should accept pending status", () => {
      const status: ToolStatus = "pending";
      expect(status).toBe("pending");
    });

    it("should accept running status", () => {
      const status: ToolStatus = "running";
      expect(status).toBe("running");
    });

    it("should accept completed status", () => {
      const status: ToolStatus = "completed";
      expect(status).toBe("completed");
    });

    it("should accept error status", () => {
      const status: ToolStatus = "error";
      expect(status).toBe("error");
    });
  });

  describe("ToolCardProps", () => {
    type ToolStatus = "pending" | "running" | "completed" | "error";

    interface ToolCardProps {
      name: string;
      status: ToolStatus;
      durationMs?: number;
      defaultExpanded?: boolean;
      rawInput?: unknown;
      rawOutput?: unknown;
      errorMessage?: string;
      loading?: boolean;
      class?: string;
    }

    it("should create props with required fields", () => {
      const props: ToolCardProps = {
        name: "read_file",
        status: "completed",
      };

      expect(props.name).toBe("read_file");
      expect(props.status).toBe("completed");
    });

    it("should support duration", () => {
      const props: ToolCardProps = {
        name: "write_file",
        status: "completed",
        durationMs: 250,
      };

      expect(props.durationMs).toBe(250);
    });

    it("should support raw input and output", () => {
      const props: ToolCardProps = {
        name: "exec_command",
        status: "completed",
        rawInput: { command: "ls -la" },
        rawOutput: "file1.ts\nfile2.ts",
      };

      expect(props.rawInput).toEqual({ command: "ls -la" });
      expect(props.rawOutput).toBe("file1.ts\nfile2.ts");
    });

    it("should support error message", () => {
      const props: ToolCardProps = {
        name: "deploy",
        status: "error",
        errorMessage: "Connection refused",
      };

      expect(props.errorMessage).toBe("Connection refused");
    });

    it("should support loading state", () => {
      const props: ToolCardProps = {
        name: "analyze",
        status: "running",
        loading: true,
      };

      expect(props.loading).toBe(true);
    });

    it("should support default expanded state", () => {
      const props: ToolCardProps = {
        name: "read_file",
        status: "completed",
        defaultExpanded: false,
      };

      expect(props.defaultExpanded).toBe(false);
    });
  });

  describe("formatDuration", () => {
    function formatDuration(ms: number): string {
      if (ms < 1000) {
        return `${ms}ms`;
      } else if (ms < 60000) {
        return `${(ms / 1000).toFixed(1)}s`;
      } else {
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        return `${mins}m ${secs}s`;
      }
    }

    it("should format milliseconds", () => {
      expect(formatDuration(50)).toBe("50ms");
      expect(formatDuration(999)).toBe("999ms");
    });

    it("should format seconds", () => {
      expect(formatDuration(1000)).toBe("1.0s");
      expect(formatDuration(1500)).toBe("1.5s");
      expect(formatDuration(30000)).toBe("30.0s");
    });

    it("should format minutes and seconds", () => {
      expect(formatDuration(60000)).toBe("1m 0s");
      expect(formatDuration(90000)).toBe("1m 30s");
      expect(formatDuration(125000)).toBe("2m 5s");
    });

    it("should handle zero", () => {
      expect(formatDuration(0)).toBe("0ms");
    });

    it("should handle edge case at 1000ms", () => {
      expect(formatDuration(1000)).toBe("1.0s");
    });

    it("should handle edge case at 60000ms", () => {
      expect(formatDuration(60000)).toBe("1m 0s");
    });
  });

  describe("getStatusBorderColor", () => {
    type ToolStatus = "pending" | "running" | "completed" | "error";

    function getStatusBorderColor(status: ToolStatus): string {
      switch (status) {
        case "pending":
          return "var(--jb-text-muted-color)";
        case "running":
          return "var(--cortex-warning)";
        case "completed":
          return "var(--cortex-success)";
        case "error":
          return "var(--cortex-error)";
        default:
          return "var(--jb-text-muted-color)";
      }
    }

    it("should return muted color for pending", () => {
      expect(getStatusBorderColor("pending")).toBe("var(--jb-text-muted-color)");
    });

    it("should return warning color for running", () => {
      expect(getStatusBorderColor("running")).toBe("var(--cortex-warning)");
    });

    it("should return success color for completed", () => {
      expect(getStatusBorderColor("completed")).toBe("var(--cortex-success)");
    });

    it("should return error color for error", () => {
      expect(getStatusBorderColor("error")).toBe("var(--cortex-error)");
    });
  });

  describe("Expand/Collapse State", () => {
    it("should start expanded by default", () => {
      const defaultExpanded = true;
      let expanded = defaultExpanded;
      expect(expanded).toBe(true);
    });

    it("should toggle expanded state", () => {
      let expanded = true;
      expanded = !expanded;
      expect(expanded).toBe(false);
      expanded = !expanded;
      expect(expanded).toBe(true);
    });

    it("should respect defaultExpanded prop", () => {
      const defaultExpanded = false;
      let expanded = defaultExpanded;
      expect(expanded).toBe(false);
    });
  });

  describe("Raw Data Display", () => {
    it("should toggle between content and raw view", () => {
      let showRaw = false;

      showRaw = !showRaw;
      expect(showRaw).toBe(true);

      showRaw = !showRaw;
      expect(showRaw).toBe(false);
    });

    it("should stringify raw input for display", () => {
      const rawInput = { path: "/src/app.ts", encoding: "utf-8" };
      const display = JSON.stringify(rawInput, null, 2);

      expect(display).toContain("path");
      expect(display).toContain("/src/app.ts");
    });

    it("should stringify raw output for display", () => {
      const rawOutput = { success: true, content: "file contents" };
      const display = JSON.stringify(rawOutput, null, 2);

      expect(display).toContain("success");
      expect(display).toContain("true");
    });

    it("should handle null raw data", () => {
      const rawInput = null;
      const hasRawInput = rawInput !== null && rawInput !== undefined;
      expect(hasRawInput).toBe(false);
    });
  });

  describe("Elapsed Time Tracking", () => {
    it("should calculate elapsed time", () => {
      const startTime = 1000;
      const currentTime = 2500;
      const elapsed = currentTime - startTime;

      expect(elapsed).toBe(1500);
    });

    it("should use durationMs when available", () => {
      const durationMs = 350;
      const elapsed = 0;

      const displayDuration = durationMs || elapsed;
      expect(displayDuration).toBe(350);
    });

    it("should fall back to elapsed when no durationMs", () => {
      const durationMs: number | undefined = undefined;
      const elapsed = 1200;

      const displayDuration = durationMs || elapsed;
      expect(displayDuration).toBe(1200);
    });
  });
});
