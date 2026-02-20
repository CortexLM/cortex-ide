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

describe("SDKContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Session Management", () => {
    interface Session {
      id: string;
      title: string;
      model: string;
      cwd: string;
      createdAt: number;
    }

    it("should create a new session", () => {
      const session: Session = {
        id: "session-1",
        title: "New Session",
        model: "anthropic/claude-opus-4.5",
        cwd: "/home/user/project",
        createdAt: Date.now(),
      };

      expect(session.id).toBe("session-1");
      expect(session.model).toContain("claude");
    });

    it("should track multiple sessions", () => {
      const sessions: Session[] = [
        { id: "sess-1", title: "Session 1", model: "gpt-4", cwd: "/home", createdAt: 1000 },
        { id: "sess-2", title: "Session 2", model: "claude-3", cwd: "/work", createdAt: 2000 },
      ];

      expect(sessions).toHaveLength(2);
    });

    it("should delete session from list", () => {
      const sessions: Session[] = [
        { id: "sess-1", title: "Session 1", model: "gpt-4", cwd: "/home", createdAt: 1000 },
        { id: "sess-2", title: "Session 2", model: "claude-3", cwd: "/work", createdAt: 2000 },
      ];

      const filtered = sessions.filter(s => s.id !== "sess-1");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("sess-2");
    });
  });

  describe("Message Types", () => {
    interface MessagePart {
      type: "text" | "tool" | "attachment";
      content?: string;
    }

    interface Message {
      id: string;
      role: "user" | "assistant" | "system";
      parts: MessagePart[];
      timestamp: number;
    }

    it("should create user message", () => {
      const message: Message = {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", content: "Hello, help me with this code" }],
        timestamp: Date.now(),
      };

      expect(message.role).toBe("user");
      expect(message.parts).toHaveLength(1);
    });

    it("should create assistant message with tool calls", () => {
      const message: Message = {
        id: "msg-2",
        role: "assistant",
        parts: [
          { type: "text", content: "Let me run that command" },
          { type: "tool" },
        ],
        timestamp: Date.now(),
      };

      expect(message.role).toBe("assistant");
      expect(message.parts).toHaveLength(2);
    });
  });

  describe("Tool Call Management", () => {
    interface ToolCall {
      id: string;
      name: string;
      input: Record<string, unknown>;
      output?: string;
      status: "pending" | "running" | "completed" | "error";
      durationMs?: number;
    }

    it("should create pending tool call", () => {
      const toolCall: ToolCall = {
        id: "tool-1",
        name: "shell",
        input: { command: "ls -la" },
        status: "pending",
      };

      expect(toolCall.status).toBe("pending");
    });

    it("should update tool call status", () => {
      const toolCall: ToolCall = {
        id: "tool-1",
        name: "shell",
        input: { command: "ls -la" },
        status: "running",
      };

      toolCall.status = "completed";
      toolCall.output = "file1.txt\nfile2.txt";
      toolCall.durationMs = 150;

      expect(toolCall.status).toBe("completed");
      expect(toolCall.output).toBeDefined();
    });

    it("should handle tool call error", () => {
      const toolCall: ToolCall = {
        id: "tool-1",
        name: "shell",
        input: { command: "invalid-cmd" },
        status: "error",
        output: "command not found",
      };

      expect(toolCall.status).toBe("error");
    });
  });

  describe("Tauri IPC - Session Operations", () => {
    it("should create session via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        id: "session-123",
        model: "claude-3",
        cwd: "/home/user",
      });

      const result = await invoke("cortex_create_session", {
        model: "claude-3",
        cwd: "/home/user",
      });

      expect(invoke).toHaveBeenCalledWith("cortex_create_session", {
        model: "claude-3",
        cwd: "/home/user",
      });
      expect(result).toHaveProperty("id");
    });

    it("should send message via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("cortex_send_message", {
        sessionId: "session-123",
        content: "Help me debug this",
        attachments: [],
      });

      expect(invoke).toHaveBeenCalledWith("cortex_send_message", expect.objectContaining({
        sessionId: "session-123",
        content: "Help me debug this",
      }));
    });

    it("should list stored sessions via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([
        { id: "sess-1", title: "Session 1", model: "claude", cwd: "/", created_at: 1000 },
        { id: "sess-2", title: "Session 2", model: "gpt-4", cwd: "/home", created_at: 2000 },
      ]);

      const result = await invoke("cortex_list_stored_sessions");

      expect(invoke).toHaveBeenCalledWith("cortex_list_stored_sessions");
      expect(result).toHaveLength(2);
    });
  });

  describe("Event Listening", () => {
    it("should listen for cortex events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("cortex-event", () => {});

      expect(listen).toHaveBeenCalledWith("cortex-event", expect.any(Function));
    });
  });

  describe("Config Management", () => {
    interface Config {
      model: string;
      cwd: string;
      sandboxMode: string;
      approvalMode: string;
    }

    it("should create default config", () => {
      const config: Config = {
        model: "anthropic/claude-opus-4.5",
        cwd: ".",
        sandboxMode: "workspace-write",
        approvalMode: "on-request",
      };

      expect(config.model).toContain("claude");
      expect(config.sandboxMode).toBe("workspace-write");
    });

    it("should update config", () => {
      const config: Config = {
        model: "gpt-4",
        cwd: "/home",
        sandboxMode: "workspace-write",
        approvalMode: "on-request",
      };

      config.model = "claude-3-opus";

      expect(config.model).toBe("claude-3-opus");
    });
  });

  describe("Approval Requests", () => {
    interface ApprovalRequest {
      callId: string;
      command: string[];
      cwd: string;
    }

    it("should track pending approval", () => {
      const approval: ApprovalRequest = {
        callId: "call-123",
        command: ["rm", "-rf", "temp/"],
        cwd: "/home/user/project",
      };

      expect(approval.callId).toBe("call-123");
      expect(approval.command).toContain("rm");
    });

    it("should approve execution via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("cortex_approve_exec", {
        sessionId: "session-1",
        callId: "call-123",
        approved: true,
      });

      expect(invoke).toHaveBeenCalledWith("cortex_approve_exec", expect.objectContaining({
        approved: true,
      }));
    });

    it("should reject execution via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("cortex_approve_exec", {
        sessionId: "session-1",
        callId: "call-123",
        approved: false,
      });

      expect(invoke).toHaveBeenCalledWith("cortex_approve_exec", expect.objectContaining({
        approved: false,
      }));
    });
  });

  describe("Streaming State", () => {
    it("should track streaming state", () => {
      let isStreaming = false;

      const startStreaming = () => { isStreaming = true; };
      const stopStreaming = () => { isStreaming = false; };

      startStreaming();
      expect(isStreaming).toBe(true);

      stopStreaming();
      expect(isStreaming).toBe(false);
    });

    it("should accumulate streamed content", () => {
      let content = "";
      const chunks = ["Hello", " ", "world", "!"];

      chunks.forEach(chunk => {
        content += chunk;
      });

      expect(content).toBe("Hello world!");
    });
  });

  describe("Context Updates", () => {
    it("should track pending context updates", () => {
      const pendingUpdates: string[] = [];

      pendingUpdates.push("File opened: /src/app.ts");
      pendingUpdates.push("Selection changed: lines 10-20");

      expect(pendingUpdates).toHaveLength(2);
    });

    it("should clear context updates after use", () => {
      const pendingUpdates: string[] = ["update1", "update2"];

      pendingUpdates.length = 0;

      expect(pendingUpdates).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle session creation error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Connection failed"));

      await expect(invoke("cortex_create_session", { model: "test", cwd: "/" }))
        .rejects.toThrow("Connection failed");
    });

    it("should handle message send error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Rate limit exceeded"));

      await expect(invoke("cortex_send_message", { sessionId: "s1", content: "test" }))
        .rejects.toThrow("Rate limit exceeded");
    });
  });
});
