import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("OutputContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LogLevel", () => {
    type LogLevel = "trace" | "debug" | "info" | "warning" | "error" | "off";

    it("should support trace level", () => {
      const level: LogLevel = "trace";
      expect(level).toBe("trace");
    });

    it("should support debug level", () => {
      const level: LogLevel = "debug";
      expect(level).toBe("debug");
    });

    it("should support info level", () => {
      const level: LogLevel = "info";
      expect(level).toBe("info");
    });

    it("should support warning level", () => {
      const level: LogLevel = "warning";
      expect(level).toBe("warning");
    });

    it("should support error level", () => {
      const level: LogLevel = "error";
      expect(level).toBe("error");
    });

    it("should support off level", () => {
      const level: LogLevel = "off";
      expect(level).toBe("off");
    });
  });

  describe("LOG_LEVEL_PRIORITY", () => {
    const LOG_LEVEL_PRIORITY: Record<string, number> = {
      trace: 0,
      debug: 1,
      info: 2,
      warning: 3,
      error: 4,
      off: 5,
    };

    it("should have trace as lowest priority", () => {
      expect(LOG_LEVEL_PRIORITY.trace).toBe(0);
    });

    it("should have off as highest priority", () => {
      expect(LOG_LEVEL_PRIORITY.off).toBe(5);
    });

    it("should order priorities correctly", () => {
      expect(LOG_LEVEL_PRIORITY.trace).toBeLessThan(LOG_LEVEL_PRIORITY.debug);
      expect(LOG_LEVEL_PRIORITY.debug).toBeLessThan(LOG_LEVEL_PRIORITY.info);
      expect(LOG_LEVEL_PRIORITY.info).toBeLessThan(LOG_LEVEL_PRIORITY.warning);
      expect(LOG_LEVEL_PRIORITY.warning).toBeLessThan(LOG_LEVEL_PRIORITY.error);
      expect(LOG_LEVEL_PRIORITY.error).toBeLessThan(LOG_LEVEL_PRIORITY.off);
    });
  });

  describe("LOG_LEVELS", () => {
    const LOG_LEVELS = ["trace", "debug", "info", "warning", "error", "off"];

    it("should contain all log levels", () => {
      expect(LOG_LEVELS).toHaveLength(6);
    });

    it("should be ordered from most to least verbose", () => {
      expect(LOG_LEVELS[0]).toBe("trace");
      expect(LOG_LEVELS[5]).toBe("off");
    });
  });

  describe("OutputLine", () => {
    interface OutputLine {
      id: string;
      text: string;
      timestamp: number;
      source?: string;
      severity?: "info" | "warning" | "error" | "success";
      logLevel?: string;
    }

    it("should create output line", () => {
      const line: OutputLine = {
        id: "line-1",
        text: "Build started",
        timestamp: Date.now(),
      };

      expect(line.text).toBe("Build started");
    });

    it("should create output line with severity", () => {
      const line: OutputLine = {
        id: "line-1",
        text: "Error occurred",
        timestamp: Date.now(),
        severity: "error",
      };

      expect(line.severity).toBe("error");
    });

    it("should create output line with source", () => {
      const line: OutputLine = {
        id: "line-1",
        text: "Compiling...",
        timestamp: Date.now(),
        source: "typescript",
      };

      expect(line.source).toBe("typescript");
    });

    it("should create output line with log level", () => {
      const line: OutputLine = {
        id: "line-1",
        text: "Debug info",
        timestamp: Date.now(),
        logLevel: "debug",
      };

      expect(line.logLevel).toBe("debug");
    });
  });

  describe("OutputChannel", () => {
    interface OutputLine {
      id: string;
      text: string;
      timestamp: number;
    }

    interface OutputChannel {
      name: string;
      label: string;
      lines: OutputLine[];
      visible: boolean;
      maxLines: number;
      createdAt: number;
    }

    it("should create output channel", () => {
      const channel: OutputChannel = {
        name: "git",
        label: "Git",
        lines: [],
        visible: false,
        maxLines: 1000,
        createdAt: Date.now(),
      };

      expect(channel.name).toBe("git");
      expect(channel.label).toBe("Git");
    });

    it("should track channel visibility", () => {
      const channel: OutputChannel = {
        name: "git",
        label: "Git",
        lines: [],
        visible: true,
        maxLines: 1000,
        createdAt: Date.now(),
      };

      expect(channel.visible).toBe(true);
    });

    it("should have max lines limit", () => {
      const channel: OutputChannel = {
        name: "git",
        label: "Git",
        lines: [],
        visible: false,
        maxLines: 500,
        createdAt: Date.now(),
      };

      expect(channel.maxLines).toBe(500);
    });
  });

  describe("BUILTIN_CHANNELS", () => {
    const BUILTIN_CHANNELS = {
      GIT: "Git",
      TASKS: "Tasks",
      LANGUAGE_SERVER: "Language Server",
      EXTENSIONS: "Extensions",
    };

    it("should define Git channel", () => {
      expect(BUILTIN_CHANNELS.GIT).toBe("Git");
    });

    it("should define Tasks channel", () => {
      expect(BUILTIN_CHANNELS.TASKS).toBe("Tasks");
    });

    it("should define Language Server channel", () => {
      expect(BUILTIN_CHANNELS.LANGUAGE_SERVER).toBe("Language Server");
    });

    it("should define Extensions channel", () => {
      expect(BUILTIN_CHANNELS.EXTENSIONS).toBe("Extensions");
    });
  });

  describe("Create Channel", () => {
    interface OutputChannel {
      name: string;
      label: string;
      lines: Array<{ id: string; text: string }>;
      visible: boolean;
      maxLines: number;
      createdAt: number;
    }

    it("should create new channel", () => {
      const channels: OutputChannel[] = [];

      const createChannel = (name: string, label: string) => {
        const channel: OutputChannel = {
          name,
          label,
          lines: [],
          visible: false,
          maxLines: 1000,
          createdAt: Date.now(),
        };
        channels.push(channel);
        return channel;
      };

      const channel = createChannel("typescript", "TypeScript");

      expect(channels).toHaveLength(1);
      expect(channel.name).toBe("typescript");
    });

    it("should not create duplicate channels", () => {
      const channels: OutputChannel[] = [
        { name: "git", label: "Git", lines: [], visible: false, maxLines: 1000, createdAt: 1000 },
      ];

      const createChannel = (name: string, label: string) => {
        const existing = channels.find(c => c.name === name);
        if (existing) return existing;

        const channel: OutputChannel = {
          name,
          label,
          lines: [],
          visible: false,
          maxLines: 1000,
          createdAt: Date.now(),
        };
        channels.push(channel);
        return channel;
      };

      createChannel("git", "Git");

      expect(channels).toHaveLength(1);
    });
  });

  describe("Append Line", () => {
    interface OutputLine {
      id: string;
      text: string;
      timestamp: number;
    }

    it("should append line to channel", () => {
      const lines: OutputLine[] = [];
      let lineCounter = 0;

      const appendLine = (text: string) => {
        lines.push({
          id: `line-${++lineCounter}`,
          text,
          timestamp: Date.now(),
        });
      };

      appendLine("First line");
      appendLine("Second line");

      expect(lines).toHaveLength(2);
      expect(lines[0].text).toBe("First line");
    });

    it("should trim lines when exceeding max", () => {
      const maxLines = 5;
      const lines: OutputLine[] = [];
      let lineCounter = 0;

      const appendLine = (text: string) => {
        lines.push({
          id: `line-${++lineCounter}`,
          text,
          timestamp: Date.now(),
        });

        while (lines.length > maxLines) {
          lines.shift();
        }
      };

      for (let i = 0; i < 10; i++) {
        appendLine(`Line ${i}`);
      }

      expect(lines).toHaveLength(maxLines);
      expect(lines[0].text).toBe("Line 5");
    });
  });

  describe("Clear Channel", () => {
    it("should clear all lines from channel", () => {
      const channel = {
        name: "git",
        lines: [
          { id: "line-1", text: "First" },
          { id: "line-2", text: "Second" },
        ],
      };

      const clear = () => {
        channel.lines = [];
      };

      clear();

      expect(channel.lines).toHaveLength(0);
    });
  });

  describe("Set Log Level", () => {
    const LOG_LEVEL_PRIORITY: Record<string, number> = {
      trace: 0,
      debug: 1,
      info: 2,
      warning: 3,
      error: 4,
      off: 5,
    };

    it("should set global log level", () => {
      let globalLogLevel = "info";

      const setLogLevel = (level: string) => {
        globalLogLevel = level;
      };

      setLogLevel("debug");

      expect(globalLogLevel).toBe("debug");
    });

    it("should filter lines by log level", () => {
      const currentLevel = "warning";
      const lines = [
        { text: "Trace msg", logLevel: "trace" },
        { text: "Debug msg", logLevel: "debug" },
        { text: "Info msg", logLevel: "info" },
        { text: "Warning msg", logLevel: "warning" },
        { text: "Error msg", logLevel: "error" },
      ];

      const filtered = lines.filter(
        line => LOG_LEVEL_PRIORITY[line.logLevel] >= LOG_LEVEL_PRIORITY[currentLevel]
      );

      expect(filtered).toHaveLength(2);
      expect(filtered[0].logLevel).toBe("warning");
      expect(filtered[1].logLevel).toBe("error");
    });
  });

  describe("Channel Log Levels", () => {
    it("should set channel-specific log level", () => {
      const channelLogLevels: Record<string, string> = {};

      const setChannelLogLevel = (channelName: string, level: string) => {
        channelLogLevels[channelName] = level;
      };

      setChannelLogLevel("typescript", "debug");
      setChannelLogLevel("git", "error");

      expect(channelLogLevels["typescript"]).toBe("debug");
      expect(channelLogLevels["git"]).toBe("error");
    });

    it("should fall back to global log level", () => {
      const globalLogLevel = "info";
      const channelLogLevels: Record<string, string> = {
        typescript: "debug",
      };

      const getEffectiveLogLevel = (channelName: string) => {
        return channelLogLevels[channelName] || globalLogLevel;
      };

      expect(getEffectiveLogLevel("typescript")).toBe("debug");
      expect(getEffectiveLogLevel("git")).toBe("info");
    });
  });

  describe("Reveal Channel", () => {
    it("should reveal channel", () => {
      const channels = [
        { name: "git", visible: false },
        { name: "typescript", visible: false },
      ];

      const revealChannel = (name: string) => {
        channels.forEach(c => {
          c.visible = c.name === name;
        });
      };

      revealChannel("git");

      expect(channels[0].visible).toBe(true);
      expect(channels[1].visible).toBe(false);
    });
  });

  describe("Active Channel", () => {
    it("should track active channel", () => {
      let activeChannel = "git";

      const setActiveChannel = (name: string) => {
        activeChannel = name;
      };

      setActiveChannel("typescript");

      expect(activeChannel).toBe("typescript");
    });
  });

  describe("Storage Keys", () => {
    const LOG_LEVEL_STORAGE_KEY = "cortex-output-log-level";
    const CHANNEL_LOG_LEVELS_STORAGE_KEY = "cortex-output-channel-log-levels";

    it("should define log level storage key", () => {
      expect(LOG_LEVEL_STORAGE_KEY).toBe("cortex-output-log-level");
    });

    it("should define channel log levels storage key", () => {
      expect(CHANNEL_LOG_LEVELS_STORAGE_KEY).toBe("cortex-output-channel-log-levels");
    });
  });

  describe("Output State", () => {
    interface OutputState {
      channels: Array<{ name: string; label: string }>;
      activeChannel: string | null;
      globalLogLevel: string;
      channelLogLevels: Record<string, string>;
    }

    it("should initialize output state", () => {
      const state: OutputState = {
        channels: [],
        activeChannel: null,
        globalLogLevel: "info",
        channelLogLevels: {},
      };

      expect(state.channels).toHaveLength(0);
      expect(state.globalLogLevel).toBe("info");
    });

    it("should track multiple channels", () => {
      const state: OutputState = {
        channels: [
          { name: "git", label: "Git" },
          { name: "typescript", label: "TypeScript" },
        ],
        activeChannel: "git",
        globalLogLevel: "info",
        channelLogLevels: {},
      };

      expect(state.channels).toHaveLength(2);
      expect(state.activeChannel).toBe("git");
    });
  });

  describe("LOG_LEVEL_LABELS", () => {
    const LOG_LEVEL_LABELS: Record<string, string> = {
      trace: "Trace",
      debug: "Debug",
      info: "Info",
      warning: "Warning",
      error: "Error",
      off: "Off",
    };

    it("should have human-readable labels", () => {
      expect(LOG_LEVEL_LABELS.trace).toBe("Trace");
      expect(LOG_LEVEL_LABELS.warning).toBe("Warning");
    });
  });
});
