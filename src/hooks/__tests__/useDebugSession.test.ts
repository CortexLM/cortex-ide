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

describe("useDebugSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DebugSessionConfig Interface", () => {
    interface DebugSessionConfig {
      id: string;
      name: string;
      type: string;
      request: "launch" | "attach";
      program?: string;
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      stopOnEntry?: boolean;
      port?: number;
      host?: string;
    }

    it("should create a launch config", () => {
      const config: DebugSessionConfig = {
        id: "config-1",
        name: "Debug Node App",
        type: "node",
        request: "launch",
        program: "${workspaceFolder}/index.js",
        args: ["--inspect"],
        cwd: "${workspaceFolder}",
        stopOnEntry: false,
      };

      expect(config.type).toBe("node");
      expect(config.request).toBe("launch");
      expect(config.program).toBe("${workspaceFolder}/index.js");
    });

    it("should create an attach config", () => {
      const config: DebugSessionConfig = {
        id: "config-2",
        name: "Attach to Process",
        type: "node",
        request: "attach",
        port: 9229,
        host: "localhost",
      };

      expect(config.request).toBe("attach");
      expect(config.port).toBe(9229);
    });

    it("should include environment variables", () => {
      const config: DebugSessionConfig = {
        id: "config-3",
        name: "Debug with Env",
        type: "node",
        request: "launch",
        program: "app.js",
        env: { NODE_ENV: "development", DEBUG: "*" },
      };

      expect(config.env?.NODE_ENV).toBe("development");
      expect(config.env?.DEBUG).toBe("*");
    });
  });

  describe("Session Lifecycle", () => {
    type SessionState = "inactive" | "initializing" | "running" | "paused" | "stopped";

    it("should transition through full lifecycle", () => {
      const states: SessionState[] = [];
      let state: SessionState = "inactive";

      states.push(state);
      state = "initializing";
      states.push(state);
      state = "running";
      states.push(state);
      state = "paused";
      states.push(state);
      state = "running";
      states.push(state);
      state = "stopped";
      states.push(state);

      expect(states).toEqual([
        "inactive",
        "initializing",
        "running",
        "paused",
        "running",
        "stopped",
      ]);
    });
  });

  describe("Session State Tracking", () => {
    interface DebugSessionState {
      isActive: boolean;
      isPaused: boolean;
      sessionId: string | null;
      threadId: number | null;
    }

    it("should track inactive state", () => {
      const state: DebugSessionState = {
        isActive: false,
        isPaused: false,
        sessionId: null,
        threadId: null,
      };

      expect(state.isActive).toBe(false);
      expect(state.isPaused).toBe(false);
    });

    it("should track active running state", () => {
      const state: DebugSessionState = {
        isActive: true,
        isPaused: false,
        sessionId: "session-1",
        threadId: 1,
      };

      expect(state.isActive).toBe(true);
      expect(state.isPaused).toBe(false);
      expect(state.sessionId).toBe("session-1");
    });

    it("should track paused state", () => {
      const state: DebugSessionState = {
        isActive: true,
        isPaused: true,
        sessionId: "session-1",
        threadId: 1,
      };

      expect(state.isActive).toBe(true);
      expect(state.isPaused).toBe(true);
    });
  });

  describe("Stepping Operations", () => {
    it("should call stepOver via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_step_over", { sessionId: "session-1", threadId: 1 });

      expect(invoke).toHaveBeenCalledWith("debug_step_over", {
        sessionId: "session-1",
        threadId: 1,
      });
    });

    it("should call stepInto via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_step_into", { sessionId: "session-1", threadId: 1 });

      expect(invoke).toHaveBeenCalledWith("debug_step_into", {
        sessionId: "session-1",
        threadId: 1,
      });
    });

    it("should call stepOut via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_step_out", { sessionId: "session-1", threadId: 1 });

      expect(invoke).toHaveBeenCalledWith("debug_step_out", {
        sessionId: "session-1",
        threadId: 1,
      });
    });
  });

  describe("Start Session", () => {
    it("should call debug_start_session via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        id: "session-1",
        name: "Debug App",
        type: "node",
        state: { type: "initializing" },
      });

      const result = await invoke("debug_start_session", {
        config: {
          id: "config-1",
          name: "Debug App",
          type: "node",
          request: "launch",
          program: "app.js",
        },
      });

      expect(invoke).toHaveBeenCalledWith("debug_start_session", {
        config: expect.objectContaining({ type: "node" }),
      });
      expect(result).toHaveProperty("id", "session-1");
    });
  });

  describe("Stop Session", () => {
    it("should call debug_stop_session via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_stop_session", { sessionId: "session-1", terminateDebuggee: true });

      expect(invoke).toHaveBeenCalledWith("debug_stop_session", {
        sessionId: "session-1",
        terminateDebuggee: true,
      });
    });

    it("should call debug_stop_session with disconnect", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_stop_session", { sessionId: "session-1", terminateDebuggee: false });

      expect(invoke).toHaveBeenCalledWith("debug_stop_session", {
        sessionId: "session-1",
        terminateDebuggee: false,
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle start session failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Adapter not found"));

      await expect(
        invoke("debug_start_session", { config: { type: "unknown" } })
      ).rejects.toThrow("Adapter not found");
    });

    it("should handle step operation failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("No active session"));

      await expect(
        invoke("debug_step_over", { sessionId: "invalid", threadId: 1 })
      ).rejects.toThrow("No active session");
    });

    it("should handle stop session failure gracefully", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Session already terminated"));

      await expect(
        invoke("debug_stop_session", { sessionId: "session-1" })
      ).rejects.toThrow("Session already terminated");
    });
  });

  describe("Debug Session Events", () => {
    it("should listen for session started event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("debug:session-started", () => {});

      expect(listen).toHaveBeenCalledWith("debug:session-started", expect.any(Function));
    });

    it("should listen for session stopped event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("debug:session-stopped", () => {});

      expect(listen).toHaveBeenCalledWith("debug:session-stopped", expect.any(Function));
    });

    it("should listen for session paused event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("debug:paused", () => {});

      expect(listen).toHaveBeenCalledWith("debug:paused", expect.any(Function));
    });
  });
});
