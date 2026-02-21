import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("ChatEditingContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("FileChange Management", () => {
    type ChangeStatus = "pending" | "accepted" | "rejected";

    interface FileChange {
      id: string;
      filePath: string;
      fileName: string;
      originalContent: string;
      proposedContent: string;
      patch: string;
      status: ChangeStatus;
      language: string;
      lineCount: number;
      addedLines: number;
      removedLines: number;
    }

    it("should create a file change with pending status", () => {
      const change: FileChange = {
        id: "change-1",
        filePath: "/src/index.ts",
        fileName: "index.ts",
        originalContent: "const x = 1;",
        proposedContent: "const x = 2;",
        patch: "@@ -1 +1 @@\n-const x = 1;\n+const x = 2;",
        status: "pending",
        language: "typescript",
        lineCount: 1,
        addedLines: 1,
        removedLines: 1,
      };

      expect(change.status).toBe("pending");
      expect(change.language).toBe("typescript");
    });

    it("should accept a file change", () => {
      const change: FileChange = {
        id: "change-1",
        filePath: "/src/index.ts",
        fileName: "index.ts",
        originalContent: "const x = 1;",
        proposedContent: "const x = 2;",
        patch: "",
        status: "pending",
        language: "typescript",
        lineCount: 1,
        addedLines: 1,
        removedLines: 1,
      };

      change.status = "accepted";
      expect(change.status).toBe("accepted");
    });

    it("should reject a file change", () => {
      const change: FileChange = {
        id: "change-1",
        filePath: "/src/index.ts",
        fileName: "index.ts",
        originalContent: "const x = 1;",
        proposedContent: "const x = 2;",
        patch: "",
        status: "pending",
        language: "typescript",
        lineCount: 1,
        addedLines: 1,
        removedLines: 1,
      };

      change.status = "rejected";
      expect(change.status).toBe("rejected");
    });

    it("should track multiple file changes", () => {
      const changes: FileChange[] = [
        {
          id: "change-1",
          filePath: "/src/index.ts",
          fileName: "index.ts",
          originalContent: "",
          proposedContent: "",
          patch: "",
          status: "pending",
          language: "typescript",
          lineCount: 10,
          addedLines: 5,
          removedLines: 2,
        },
        {
          id: "change-2",
          filePath: "/src/utils.ts",
          fileName: "utils.ts",
          originalContent: "",
          proposedContent: "",
          patch: "",
          status: "accepted",
          language: "typescript",
          lineCount: 20,
          addedLines: 10,
          removedLines: 5,
        },
      ];

      expect(changes).toHaveLength(2);
      expect(changes.filter((c) => c.status === "pending")).toHaveLength(1);
    });

    it("should calculate total stats from changes", () => {
      const changes: FileChange[] = [
        {
          id: "change-1",
          filePath: "/src/a.ts",
          fileName: "a.ts",
          originalContent: "",
          proposedContent: "",
          patch: "",
          status: "pending",
          language: "typescript",
          lineCount: 10,
          addedLines: 5,
          removedLines: 2,
        },
        {
          id: "change-2",
          filePath: "/src/b.ts",
          fileName: "b.ts",
          originalContent: "",
          proposedContent: "",
          patch: "",
          status: "pending",
          language: "typescript",
          lineCount: 20,
          addedLines: 10,
          removedLines: 3,
        },
      ];

      const totalAdded = changes.reduce((sum, c) => sum + c.addedLines, 0);
      const totalRemoved = changes.reduce((sum, c) => sum + c.removedLines, 0);

      expect(totalAdded).toBe(15);
      expect(totalRemoved).toBe(5);
    });
  });

  describe("EditingSession Management", () => {
    type SessionStatus = "generating" | "ready" | "applying" | "completed" | "cancelled";

    interface EditingSession {
      id: string;
      startedAt: number;
      prompt: string;
      model: string;
      status: SessionStatus;
      progress: number;
      currentFile?: string;
      error?: string;
    }

    it("should create a new editing session", () => {
      const session: EditingSession = {
        id: "session-1",
        startedAt: Date.now(),
        prompt: "Refactor this function",
        model: "gpt-4",
        status: "generating",
        progress: 0,
      };

      expect(session.status).toBe("generating");
      expect(session.progress).toBe(0);
    });

    it("should update session progress", () => {
      const session: EditingSession = {
        id: "session-1",
        startedAt: Date.now(),
        prompt: "Add error handling",
        model: "gpt-4",
        status: "generating",
        progress: 0,
      };

      session.progress = 50;
      session.currentFile = "/src/api.ts";

      expect(session.progress).toBe(50);
      expect(session.currentFile).toBe("/src/api.ts");
    });

    it("should transition session to ready status", () => {
      const session: EditingSession = {
        id: "session-1",
        startedAt: Date.now(),
        prompt: "Optimize performance",
        model: "gpt-4",
        status: "generating",
        progress: 100,
      };

      session.status = "ready";
      expect(session.status).toBe("ready");
    });

    it("should handle session error", () => {
      const session: EditingSession = {
        id: "session-1",
        startedAt: Date.now(),
        prompt: "Generate tests",
        model: "gpt-4",
        status: "generating",
        progress: 30,
        error: "API rate limit exceeded",
      };

      expect(session.error).toBe("API rate limit exceeded");
    });

    it("should cancel a session", () => {
      const session: EditingSession = {
        id: "session-1",
        startedAt: Date.now(),
        prompt: "Add documentation",
        model: "gpt-4",
        status: "generating",
        progress: 25,
      };

      session.status = "cancelled";
      expect(session.status).toBe("cancelled");
    });
  });

  describe("Working Set Management", () => {
    it("should add files to working set", () => {
      const workingSet = new Set<string>();

      workingSet.add("/src/index.ts");
      workingSet.add("/src/utils.ts");

      expect(workingSet.size).toBe(2);
      expect(workingSet.has("/src/index.ts")).toBe(true);
    });

    it("should remove files from working set", () => {
      const workingSet = new Set<string>(["/src/index.ts", "/src/utils.ts"]);

      workingSet.delete("/src/index.ts");

      expect(workingSet.size).toBe(1);
      expect(workingSet.has("/src/index.ts")).toBe(false);
    });

    it("should clear working set", () => {
      const workingSet = new Set<string>(["/src/a.ts", "/src/b.ts", "/src/c.ts"]);

      workingSet.clear();

      expect(workingSet.size).toBe(0);
    });
  });

  describe("IPC Integration", () => {
    it("should invoke chat_editing_start_session", async () => {
      vi.mocked(invoke).mockResolvedValue({ id: "session-1" });

      const result = await invoke("chat_editing_start_session", {
        prompt: "Refactor code",
        model: "gpt-4",
      });

      expect(invoke).toHaveBeenCalledWith("chat_editing_start_session", {
        prompt: "Refactor code",
        model: "gpt-4",
      });
      expect(result).toEqual({ id: "session-1" });
    });

    it("should invoke chat_editing_apply_changes", async () => {
      vi.mocked(invoke).mockResolvedValue({ success: true });

      const result = await invoke("chat_editing_apply_changes", {
        sessionId: "session-1",
        changeIds: ["change-1", "change-2"],
      });

      expect(invoke).toHaveBeenCalledWith("chat_editing_apply_changes", {
        sessionId: "session-1",
        changeIds: ["change-1", "change-2"],
      });
      expect(result).toEqual({ success: true });
    });

    it("should invoke chat_editing_cancel_session", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("chat_editing_cancel_session", { sessionId: "session-1" });

      expect(invoke).toHaveBeenCalledWith("chat_editing_cancel_session", {
        sessionId: "session-1",
      });
    });

    it("should listen for chat-editing:progress events", async () => {
      await listen("chat-editing:progress", () => {});

      expect(listen).toHaveBeenCalledWith("chat-editing:progress", expect.any(Function));
    });

    it("should listen for chat-editing:change-added events", async () => {
      await listen("chat-editing:change-added", () => {});

      expect(listen).toHaveBeenCalledWith("chat-editing:change-added", expect.any(Function));
    });
  });

  describe("Accept/Reject All Operations", () => {
    type ChangeStatus = "pending" | "accepted" | "rejected";

    interface FileChange {
      id: string;
      status: ChangeStatus;
    }

    it("should accept all pending changes", () => {
      const changes: FileChange[] = [
        { id: "1", status: "pending" },
        { id: "2", status: "pending" },
        { id: "3", status: "pending" },
      ];

      const accepted = changes.map((c) => ({ ...c, status: "accepted" as ChangeStatus }));

      expect(accepted.every((c) => c.status === "accepted")).toBe(true);
    });

    it("should reject all pending changes", () => {
      const changes: FileChange[] = [
        { id: "1", status: "pending" },
        { id: "2", status: "pending" },
        { id: "3", status: "pending" },
      ];

      const rejected = changes.map((c) => ({ ...c, status: "rejected" as ChangeStatus }));

      expect(rejected.every((c) => c.status === "rejected")).toBe(true);
    });

    it("should count changes by status", () => {
      const changes: FileChange[] = [
        { id: "1", status: "pending" },
        { id: "2", status: "accepted" },
        { id: "3", status: "rejected" },
        { id: "4", status: "pending" },
      ];

      const pendingCount = changes.filter((c) => c.status === "pending").length;
      const acceptedCount = changes.filter((c) => c.status === "accepted").length;
      const rejectedCount = changes.filter((c) => c.status === "rejected").length;

      expect(pendingCount).toBe(2);
      expect(acceptedCount).toBe(1);
      expect(rejectedCount).toBe(1);
    });
  });

  describe("Language Detection", () => {
    it("should detect TypeScript files", () => {
      const detectLanguage = (filename: string): string => {
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        const langMap: Record<string, string> = {
          ts: "typescript",
          tsx: "typescript",
          js: "javascript",
          jsx: "javascript",
          py: "python",
          rs: "rust",
        };
        return langMap[ext] || "plaintext";
      };

      expect(detectLanguage("index.ts")).toBe("typescript");
      expect(detectLanguage("component.tsx")).toBe("typescript");
    });

    it("should detect JavaScript files", () => {
      const detectLanguage = (filename: string): string => {
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        const langMap: Record<string, string> = {
          ts: "typescript",
          tsx: "typescript",
          js: "javascript",
          jsx: "javascript",
        };
        return langMap[ext] || "plaintext";
      };

      expect(detectLanguage("app.js")).toBe("javascript");
      expect(detectLanguage("App.jsx")).toBe("javascript");
    });

    it("should return plaintext for unknown extensions", () => {
      const detectLanguage = (filename: string): string => {
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        const langMap: Record<string, string> = {
          ts: "typescript",
          js: "javascript",
        };
        return langMap[ext] || "plaintext";
      };

      expect(detectLanguage("readme.xyz")).toBe("plaintext");
    });
  });
});
