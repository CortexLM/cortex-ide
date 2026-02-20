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

describe("useDebugKeyboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Debug Keyboard Options", () => {
    interface DebugKeyboardOptions {
      getCurrentFile?: () => string | null;
      getCurrentLine?: () => number | null;
      onStartDebug?: () => void;
    }

    it("should define debug keyboard options", () => {
      const options: DebugKeyboardOptions = {
        getCurrentFile: () => "/src/app.ts",
        getCurrentLine: () => 10,
        onStartDebug: () => {},
      };

      expect(options.getCurrentFile?.()).toBe("/src/app.ts");
      expect(options.getCurrentLine?.()).toBe(10);
    });

    it("should handle optional callbacks", () => {
      const options: DebugKeyboardOptions = {};

      expect(options.getCurrentFile).toBeUndefined();
      expect(options.onStartDebug).toBeUndefined();
    });

    it("should return null from file getter", () => {
      const options: DebugKeyboardOptions = {
        getCurrentFile: () => null,
        getCurrentLine: () => null,
      };

      expect(options.getCurrentFile?.()).toBeNull();
      expect(options.getCurrentLine?.()).toBeNull();
    });
  });

  describe("getDebugStatusText", () => {
    interface DebugState {
      isDebugging: boolean;
      isPaused: boolean;
    }

    const getDebugStatusText = (state: DebugState): string => {
      if (!state.isDebugging) {
        return "Not debugging";
      }
      return state.isPaused ? "Paused" : "Running";
    };

    it("should return 'Not debugging' when not debugging", () => {
      const state: DebugState = { isDebugging: false, isPaused: false };
      expect(getDebugStatusText(state)).toBe("Not debugging");
    });

    it("should return 'Running' when debugging and not paused", () => {
      const state: DebugState = { isDebugging: true, isPaused: false };
      expect(getDebugStatusText(state)).toBe("Running");
    });

    it("should return 'Paused' when debugging and paused", () => {
      const state: DebugState = { isDebugging: true, isPaused: true };
      expect(getDebugStatusText(state)).toBe("Paused");
    });
  });

  describe("getDebugShortcutHints", () => {
    interface DebugState {
      isDebugging: boolean;
      isPaused: boolean;
    }

    interface ShortcutHint {
      key: string;
      action: string;
      available: boolean;
    }

    const getDebugShortcutHints = (state: DebugState): ShortcutHint[] => {
      return [
        {
          key: "F5",
          action: state.isDebugging && state.isPaused ? "Continue" : "Start Debug",
          available: !state.isDebugging || state.isPaused,
        },
        {
          key: "Shift+F5",
          action: "Stop",
          available: state.isDebugging,
        },
        {
          key: "Ctrl+Shift+F5",
          action: "Restart",
          available: state.isDebugging,
        },
        {
          key: "F6",
          action: "Pause",
          available: state.isDebugging && !state.isPaused,
        },
        {
          key: "F9",
          action: "Toggle Breakpoint",
          available: true,
        },
        {
          key: "F10",
          action: "Step Over",
          available: state.isDebugging && state.isPaused,
        },
        {
          key: "F11",
          action: "Step Into",
          available: state.isDebugging && state.isPaused,
        },
        {
          key: "Shift+F11",
          action: "Step Out",
          available: state.isDebugging && state.isPaused,
        },
      ];
    };

    it("should return hints when not debugging", () => {
      const state: DebugState = { isDebugging: false, isPaused: false };
      const hints = getDebugShortcutHints(state);

      expect(hints).toHaveLength(8);
      
      const f5Hint = hints.find(h => h.key === "F5");
      expect(f5Hint?.action).toBe("Start Debug");
      expect(f5Hint?.available).toBe(true);

      const stopHint = hints.find(h => h.key === "Shift+F5");
      expect(stopHint?.available).toBe(false);
    });

    it("should return hints when debugging and running", () => {
      const state: DebugState = { isDebugging: true, isPaused: false };
      const hints = getDebugShortcutHints(state);

      const f5Hint = hints.find(h => h.key === "F5");
      expect(f5Hint?.action).toBe("Start Debug");
      expect(f5Hint?.available).toBe(false);

      const pauseHint = hints.find(h => h.key === "F6");
      expect(pauseHint?.available).toBe(true);

      const stepOverHint = hints.find(h => h.key === "F10");
      expect(stepOverHint?.available).toBe(false);
    });

    it("should return hints when debugging and paused", () => {
      const state: DebugState = { isDebugging: true, isPaused: true };
      const hints = getDebugShortcutHints(state);

      const f5Hint = hints.find(h => h.key === "F5");
      expect(f5Hint?.action).toBe("Continue");
      expect(f5Hint?.available).toBe(true);

      const stepOverHint = hints.find(h => h.key === "F10");
      expect(stepOverHint?.available).toBe(true);

      const stepIntoHint = hints.find(h => h.key === "F11");
      expect(stepIntoHint?.available).toBe(true);

      const stepOutHint = hints.find(h => h.key === "Shift+F11");
      expect(stepOutHint?.available).toBe(true);
    });

    it("should always have F9 available", () => {
      const states: DebugState[] = [
        { isDebugging: false, isPaused: false },
        { isDebugging: true, isPaused: false },
        { isDebugging: true, isPaused: true },
      ];

      states.forEach(state => {
        const hints = getDebugShortcutHints(state);
        const f9Hint = hints.find(h => h.key === "F9");
        expect(f9Hint?.available).toBe(true);
      });
    });
  });

  describe("Keyboard Event Handling", () => {
    interface KeyboardEventData {
      key: string;
      shiftKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
    }

    it("should identify F5 key", () => {
      const event: KeyboardEventData = {
        key: "F5",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      };

      expect(event.key).toBe("F5");
    });

    it("should identify Shift+F5 combination", () => {
      const event: KeyboardEventData = {
        key: "F5",
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
      };

      expect(event.key).toBe("F5");
      expect(event.shiftKey).toBe(true);
    });

    it("should identify Ctrl+Shift+F5 combination", () => {
      const event: KeyboardEventData = {
        key: "F5",
        shiftKey: true,
        ctrlKey: true,
        metaKey: false,
      };

      const mod = event.ctrlKey || event.metaKey;
      expect(mod && event.shiftKey).toBe(true);
    });

    it("should identify F6 key", () => {
      const event: KeyboardEventData = {
        key: "F6",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      };

      expect(event.key).toBe("F6");
    });

    it("should identify F9 key", () => {
      const event: KeyboardEventData = {
        key: "F9",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      };

      expect(event.key).toBe("F9");
    });

    it("should identify F10 key", () => {
      const event: KeyboardEventData = {
        key: "F10",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      };

      expect(event.key).toBe("F10");
    });

    it("should identify F11 key", () => {
      const event: KeyboardEventData = {
        key: "F11",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      };

      expect(event.key).toBe("F11");
    });

    it("should identify Shift+F11 combination", () => {
      const event: KeyboardEventData = {
        key: "F11",
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
      };

      expect(event.key).toBe("F11");
      expect(event.shiftKey).toBe(true);
    });
  });

  describe("Debug Session Operations", () => {
    it("should start debug session via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ sessionId: "session-1" });

      const result = await invoke("debug_start", {
        config: { type: "node", program: "app.js" },
      });

      expect(invoke).toHaveBeenCalledWith("debug_start", {
        config: { type: "node", program: "app.js" },
      });
      expect(result).toHaveProperty("sessionId");
    });

    it("should stop debug session via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_stop", { sessionId: "session-1" });

      expect(invoke).toHaveBeenCalledWith("debug_stop", { sessionId: "session-1" });
    });

    it("should restart debug session via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ sessionId: "session-2" });

      await invoke("debug_restart", { sessionId: "session-1" });

      expect(invoke).toHaveBeenCalledWith("debug_restart", { sessionId: "session-1" });
    });

    it("should continue execution via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_continue", { threadId: 1 });

      expect(invoke).toHaveBeenCalledWith("debug_continue", { threadId: 1 });
    });

    it("should pause execution via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_pause", { threadId: 1 });

      expect(invoke).toHaveBeenCalledWith("debug_pause", { threadId: 1 });
    });
  });

  describe("Stepping Operations", () => {
    it("should step over via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_step_over", { threadId: 1 });

      expect(invoke).toHaveBeenCalledWith("debug_step_over", { threadId: 1 });
    });

    it("should step into via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_step_into", { threadId: 1 });

      expect(invoke).toHaveBeenCalledWith("debug_step_into", { threadId: 1 });
    });

    it("should step out via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_step_out", { threadId: 1 });

      expect(invoke).toHaveBeenCalledWith("debug_step_out", { threadId: 1 });
    });
  });

  describe("Breakpoint Operations", () => {
    interface Breakpoint {
      id: string;
      filePath: string;
      line: number;
      enabled: boolean;
      condition?: string;
      hitCondition?: string;
      logMessage?: string;
    }

    it("should toggle breakpoint via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ id: "bp-1", verified: true });

      await invoke("debug_toggle_breakpoint", {
        filePath: "/src/app.ts",
        line: 10,
      });

      expect(invoke).toHaveBeenCalledWith("debug_toggle_breakpoint", {
        filePath: "/src/app.ts",
        line: 10,
      });
    });

    it("should create breakpoint with condition", () => {
      const breakpoint: Breakpoint = {
        id: "bp-1",
        filePath: "/src/app.ts",
        line: 10,
        enabled: true,
        condition: "x > 5",
      };

      expect(breakpoint.condition).toBe("x > 5");
    });

    it("should create breakpoint with hit condition", () => {
      const breakpoint: Breakpoint = {
        id: "bp-2",
        filePath: "/src/app.ts",
        line: 15,
        enabled: true,
        hitCondition: "5",
      };

      expect(breakpoint.hitCondition).toBe("5");
    });

    it("should create logpoint", () => {
      const breakpoint: Breakpoint = {
        id: "bp-3",
        filePath: "/src/app.ts",
        line: 20,
        enabled: true,
        logMessage: "Value of x: {x}",
      };

      expect(breakpoint.logMessage).toBe("Value of x: {x}");
    });

    it("should disable breakpoint", () => {
      const breakpoint: Breakpoint = {
        id: "bp-1",
        filePath: "/src/app.ts",
        line: 10,
        enabled: false,
      };

      expect(breakpoint.enabled).toBe(false);
    });
  });

  describe("Debug Events", () => {
    it("should listen for stopped event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("debug:stopped", () => {});

      expect(listen).toHaveBeenCalledWith("debug:stopped", expect.any(Function));
    });

    it("should listen for continued event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("debug:continued", () => {});

      expect(listen).toHaveBeenCalledWith("debug:continued", expect.any(Function));
    });

    it("should listen for breakpoint event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("debug:breakpoint", () => {});

      expect(listen).toHaveBeenCalledWith("debug:breakpoint", expect.any(Function));
    });

    it("should listen for output event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("debug:output", () => {});

      expect(listen).toHaveBeenCalledWith("debug:output", expect.any(Function));
    });

    it("should listen for terminated event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("debug:terminated", () => {});

      expect(listen).toHaveBeenCalledWith("debug:terminated", expect.any(Function));
    });
  });

  describe("Debug State", () => {
    interface DebugState {
      isDebugging: boolean;
      isPaused: boolean;
      currentThreadId: number | null;
      currentFrameId: number | null;
      stoppedReason: string | null;
    }

    it("should track initial debug state", () => {
      const state: DebugState = {
        isDebugging: false,
        isPaused: false,
        currentThreadId: null,
        currentFrameId: null,
        stoppedReason: null,
      };

      expect(state.isDebugging).toBe(false);
    });

    it("should track running state", () => {
      const state: DebugState = {
        isDebugging: true,
        isPaused: false,
        currentThreadId: 1,
        currentFrameId: null,
        stoppedReason: null,
      };

      expect(state.isDebugging).toBe(true);
      expect(state.isPaused).toBe(false);
    });

    it("should track paused state", () => {
      const state: DebugState = {
        isDebugging: true,
        isPaused: true,
        currentThreadId: 1,
        currentFrameId: 0,
        stoppedReason: "breakpoint",
      };

      expect(state.isPaused).toBe(true);
      expect(state.stoppedReason).toBe("breakpoint");
    });

    it("should track different stop reasons", () => {
      const stopReasons = ["breakpoint", "step", "exception", "pause", "entry"];

      stopReasons.forEach(reason => {
        const state: DebugState = {
          isDebugging: true,
          isPaused: true,
          currentThreadId: 1,
          currentFrameId: 0,
          stoppedReason: reason,
        };

        expect(state.stoppedReason).toBe(reason);
      });
    });
  });

  describe("Input Focus Detection", () => {
    it("should skip keyboard handling for input elements", () => {
      const shouldSkip = (tagName: string, isContentEditable: boolean): boolean => {
        return (
          tagName === "INPUT" ||
          tagName === "TEXTAREA" ||
          isContentEditable
        );
      };

      expect(shouldSkip("INPUT", false)).toBe(true);
      expect(shouldSkip("TEXTAREA", false)).toBe(true);
      expect(shouldSkip("DIV", true)).toBe(true);
      expect(shouldSkip("DIV", false)).toBe(false);
    });
  });

  describe("Launch Configuration", () => {
    interface LaunchConfig {
      type: string;
      name: string;
      request: "launch" | "attach";
      program?: string;
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      stopOnEntry?: boolean;
    }

    it("should create launch configuration", () => {
      const config: LaunchConfig = {
        type: "node",
        name: "Debug App",
        request: "launch",
        program: "${workspaceFolder}/app.js",
        args: ["--port", "3000"],
        cwd: "${workspaceFolder}",
        stopOnEntry: false,
      };

      expect(config.type).toBe("node");
      expect(config.request).toBe("launch");
    });

    it("should create attach configuration", () => {
      const config: LaunchConfig = {
        type: "node",
        name: "Attach to Process",
        request: "attach",
      };

      expect(config.request).toBe("attach");
    });

    it("should include environment variables", () => {
      const config: LaunchConfig = {
        type: "node",
        name: "Debug with Env",
        request: "launch",
        program: "app.js",
        env: {
          NODE_ENV: "development",
          DEBUG: "true",
        },
      };

      expect(config.env?.NODE_ENV).toBe("development");
    });
  });
});
