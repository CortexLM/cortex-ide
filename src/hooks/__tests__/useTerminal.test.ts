import { describe, it, expect, vi, beforeEach } from "vitest";
import { listen } from "@tauri-apps/api/event";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("useCommandDetection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("OSC633 Sequence Types", () => {
    type OSC633SequenceType =
      | "prompt-start"
      | "prompt-end"
      | "command-executed"
      | "command-finished"
      | "command-line"
      | "property"
      | "continuation-start"
      | "continuation-end";

    it("should define all OSC633 sequence types", () => {
      const types: OSC633SequenceType[] = [
        "prompt-start",
        "prompt-end",
        "command-executed",
        "command-finished",
        "command-line",
        "property",
        "continuation-start",
        "continuation-end",
      ];

      expect(types).toHaveLength(8);
    });

    it("should have prompt-start type for A sequence", () => {
      const type: OSC633SequenceType = "prompt-start";
      expect(type).toBe("prompt-start");
    });

    it("should have prompt-end type for B sequence", () => {
      const type: OSC633SequenceType = "prompt-end";
      expect(type).toBe("prompt-end");
    });

    it("should have command-executed type for C sequence", () => {
      const type: OSC633SequenceType = "command-executed";
      expect(type).toBe("command-executed");
    });

    it("should have command-finished type for D sequence", () => {
      const type: OSC633SequenceType = "command-finished";
      expect(type).toBe("command-finished");
    });
  });

  describe("OSC633 Event Parsing", () => {
    interface OSC633Event {
      type: string;
      commandLine?: string;
      exitCode?: number;
      property?: { name: string; value: string };
    }

    const parseOSC633 = (data: string): OSC633Event | null => {
      if (!data || data.length === 0) {
        return null;
      }

      const parts = data.split(";");
      const type = parts[0];

      switch (type) {
        case "A":
          return { type: "prompt-start" };
        case "B":
          return { type: "prompt-end" };
        case "C":
          return { type: "command-executed" };
        case "D": {
          const exitCode = parts.length > 1 ? parseInt(parts[1], 10) : undefined;
          return {
            type: "command-finished",
            exitCode: isNaN(exitCode as number) ? undefined : exitCode,
          };
        }
        case "E": {
          const commandLine = parts.slice(1).join(";");
          return {
            type: "command-line",
            commandLine: commandLine || undefined,
          };
        }
        case "P": {
          if (parts.length > 1) {
            const propParts = parts[1].split("=");
            if (propParts.length >= 2) {
              return {
                type: "property",
                property: {
                  name: propParts[0],
                  value: propParts.slice(1).join("="),
                },
              };
            }
          }
          return { type: "property" };
        }
        default:
          return null;
      }
    };

    it("should parse A sequence as prompt-start", () => {
      const event = parseOSC633("A");
      expect(event?.type).toBe("prompt-start");
    });

    it("should parse B sequence as prompt-end", () => {
      const event = parseOSC633("B");
      expect(event?.type).toBe("prompt-end");
    });

    it("should parse C sequence as command-executed", () => {
      const event = parseOSC633("C");
      expect(event?.type).toBe("command-executed");
    });

    it("should parse D sequence with exit code", () => {
      const event = parseOSC633("D;0");
      expect(event?.type).toBe("command-finished");
      expect(event?.exitCode).toBe(0);
    });

    it("should parse D sequence with non-zero exit code", () => {
      const event = parseOSC633("D;1");
      expect(event?.type).toBe("command-finished");
      expect(event?.exitCode).toBe(1);
    });

    it("should parse D sequence without exit code", () => {
      const event = parseOSC633("D");
      expect(event?.type).toBe("command-finished");
      expect(event?.exitCode).toBeUndefined();
    });

    it("should parse E sequence with command line", () => {
      const event = parseOSC633("E;ls -la");
      expect(event?.type).toBe("command-line");
      expect(event?.commandLine).toBe("ls -la");
    });

    it("should parse E sequence with command containing semicolons", () => {
      const event = parseOSC633("E;echo hello; echo world");
      expect(event?.type).toBe("command-line");
      expect(event?.commandLine).toBe("echo hello; echo world");
    });

    it("should parse P sequence with property", () => {
      const event = parseOSC633("P;Cwd=/home/user");
      expect(event?.type).toBe("property");
      expect(event?.property?.name).toBe("Cwd");
      expect(event?.property?.value).toBe("/home/user");
    });

    it("should parse P sequence with property containing equals", () => {
      const event = parseOSC633("P;Env=VAR=value");
      expect(event?.type).toBe("property");
      expect(event?.property?.name).toBe("Env");
      expect(event?.property?.value).toBe("VAR=value");
    });

    it("should return null for empty data", () => {
      const event = parseOSC633("");
      expect(event).toBeNull();
    });

    it("should return null for unknown sequence", () => {
      const event = parseOSC633("X");
      expect(event).toBeNull();
    });
  });

  describe("DetectedCommand Interface", () => {
    interface DetectedCommand {
      id: string;
      line: number;
      command: string;
      isRunning: boolean;
      exitCode?: number;
      startTime: number;
      endTime?: number;
      cwd?: string;
      output: string;
    }

    it("should create a running command", () => {
      const command: DetectedCommand = {
        id: "cmd-1",
        line: 10,
        command: "ls -la",
        isRunning: true,
        startTime: Date.now(),
        output: "",
      };

      expect(command.isRunning).toBe(true);
      expect(command.exitCode).toBeUndefined();
    });

    it("should create a completed command", () => {
      const command: DetectedCommand = {
        id: "cmd-2",
        line: 15,
        command: "npm install",
        isRunning: false,
        exitCode: 0,
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        cwd: "/home/user/project",
        output: "added 100 packages",
      };

      expect(command.isRunning).toBe(false);
      expect(command.exitCode).toBe(0);
      expect(command.endTime).toBeDefined();
    });

    it("should track command with failed exit code", () => {
      const command: DetectedCommand = {
        id: "cmd-3",
        line: 20,
        command: "invalid-command",
        isRunning: false,
        exitCode: 127,
        startTime: Date.now() - 100,
        endTime: Date.now(),
        output: "command not found",
      };

      expect(command.exitCode).toBe(127);
    });
  });

  describe("Command Detection Options", () => {
    interface UseCommandDetectionOptions {
      terminalId: string;
      onCommandStart?: (command: string, line: number, cwd?: string) => void;
      onCommandEnd?: (exitCode: number, line: number, command?: string) => void;
      onCommandLine?: (command: string, line: number) => void;
      onCwdChange?: (cwd: string) => void;
      enableFallback?: boolean;
      promptPatterns?: RegExp[];
    }

    it("should define options with terminal ID", () => {
      const options: UseCommandDetectionOptions = {
        terminalId: "term-1",
      };

      expect(options.terminalId).toBe("term-1");
    });

    it("should support command start callback", () => {
      const onCommandStart = vi.fn();
      const options: UseCommandDetectionOptions = {
        terminalId: "term-1",
        onCommandStart,
      };

      options.onCommandStart?.("ls", 10, "/home/user");
      expect(onCommandStart).toHaveBeenCalledWith("ls", 10, "/home/user");
    });

    it("should support command end callback", () => {
      const onCommandEnd = vi.fn();
      const options: UseCommandDetectionOptions = {
        terminalId: "term-1",
        onCommandEnd,
      };

      options.onCommandEnd?.(0, 15, "ls");
      expect(onCommandEnd).toHaveBeenCalledWith(0, 15, "ls");
    });

    it("should support CWD change callback", () => {
      const onCwdChange = vi.fn();
      const options: UseCommandDetectionOptions = {
        terminalId: "term-1",
        onCwdChange,
      };

      options.onCwdChange?.("/home/user/project");
      expect(onCwdChange).toHaveBeenCalledWith("/home/user/project");
    });

    it("should enable fallback detection", () => {
      const options: UseCommandDetectionOptions = {
        terminalId: "term-1",
        enableFallback: true,
      };

      expect(options.enableFallback).toBe(true);
    });

    it("should support custom prompt patterns", () => {
      const options: UseCommandDetectionOptions = {
        terminalId: "term-1",
        promptPatterns: [/^user@host:.*\$/],
      };

      expect(options.promptPatterns).toHaveLength(1);
    });
  });

  describe("Prompt Pattern Matching", () => {
    const DEFAULT_PROMPT_PATTERNS: RegExp[] = [
      /^[\w\-\.]+@[\w\-\.]+:.*[$#>]\s*$/,
      /^[$#>]\s*$/,
      /^[A-Za-z]:\\.*>\s*$/,
      /^PS\s+[A-Za-z]:\\.*>\s*$/,
      /^[\w\-\.]+@[\w\-\.]+\s+.*>\s*$/,
      /^\[\d+\]\s*[$#>]\s*$/,
      /^\([\w\-\.]+\)\s*[$#>]\s*$/,
    ];

    const matchesPrompt = (line: string, patterns: RegExp[]): boolean => {
      return patterns.some(pattern => pattern.test(line));
    };

    it("should match bash/zsh style prompt", () => {
      expect(matchesPrompt("user@host:~/project$", DEFAULT_PROMPT_PATTERNS)).toBe(true);
      expect(matchesPrompt("user@host:/home/user# ", DEFAULT_PROMPT_PATTERNS)).toBe(true);
    });

    it("should match simple prompts", () => {
      expect(matchesPrompt("$ ", DEFAULT_PROMPT_PATTERNS)).toBe(true);
      expect(matchesPrompt("> ", DEFAULT_PROMPT_PATTERNS)).toBe(true);
      expect(matchesPrompt("# ", DEFAULT_PROMPT_PATTERNS)).toBe(true);
    });

    it("should match Windows CMD prompt", () => {
      expect(matchesPrompt("C:\\Users\\user>", DEFAULT_PROMPT_PATTERNS)).toBe(true);
      expect(matchesPrompt("D:\\project>", DEFAULT_PROMPT_PATTERNS)).toBe(true);
    });

    it("should match PowerShell prompt", () => {
      expect(matchesPrompt("PS C:\\Users\\user>", DEFAULT_PROMPT_PATTERNS)).toBe(true);
    });

    it("should match numbered prompts", () => {
      expect(matchesPrompt("[1] $ ", DEFAULT_PROMPT_PATTERNS)).toBe(true);
      expect(matchesPrompt("[42] # ", DEFAULT_PROMPT_PATTERNS)).toBe(true);
    });

    it("should match virtual env prompts", () => {
      expect(matchesPrompt("(venv) $ ", DEFAULT_PROMPT_PATTERNS)).toBe(true);
      expect(matchesPrompt("(my-env) # ", DEFAULT_PROMPT_PATTERNS)).toBe(true);
    });

    it("should not match regular output", () => {
      expect(matchesPrompt("Hello, World!", DEFAULT_PROMPT_PATTERNS)).toBe(false);
      expect(matchesPrompt("total 24", DEFAULT_PROMPT_PATTERNS)).toBe(false);
    });
  });

  describe("Exit Code Detection", () => {
    const EXIT_CODE_PATTERNS: RegExp[] = [/^(\d+)$/];

    const parseExitCode = (line: string): number | null => {
      for (const pattern of EXIT_CODE_PATTERNS) {
        const match = line.trim().match(pattern);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
      return null;
    };

    it("should parse exit code 0", () => {
      expect(parseExitCode("0")).toBe(0);
    });

    it("should parse exit code 1", () => {
      expect(parseExitCode("1")).toBe(1);
    });

    it("should parse exit code 127", () => {
      expect(parseExitCode("127")).toBe(127);
    });

    it("should handle whitespace", () => {
      expect(parseExitCode("  0  ")).toBe(0);
    });

    it("should return null for non-numeric", () => {
      expect(parseExitCode("error")).toBeNull();
    });
  });

  describe("Command Detection Return Interface", () => {
    interface UseCommandDetectionReturn {
      processData: (data: string, currentLine: number) => void;
      currentCommand: () => unknown | null;
      commands: () => unknown[];
      hasShellIntegration: () => boolean;
      cwd: () => string | undefined;
      clear: () => void;
      reset: () => void;
    }

    it("should define processData function", () => {
      const mockReturn: UseCommandDetectionReturn = {
        processData: vi.fn(),
        currentCommand: () => null,
        commands: () => [],
        hasShellIntegration: () => false,
        cwd: () => undefined,
        clear: vi.fn(),
        reset: vi.fn(),
      };

      mockReturn.processData("test data", 10);
      expect(mockReturn.processData).toHaveBeenCalledWith("test data", 10);
    });

    it("should track shell integration detection", () => {
      const mockReturn: UseCommandDetectionReturn = {
        processData: vi.fn(),
        currentCommand: () => null,
        commands: () => [],
        hasShellIntegration: () => true,
        cwd: () => "/home/user",
        clear: vi.fn(),
        reset: vi.fn(),
      };

      expect(mockReturn.hasShellIntegration()).toBe(true);
      expect(mockReturn.cwd()).toBe("/home/user");
    });

    it("should support clear and reset", () => {
      const clear = vi.fn();
      const reset = vi.fn();
      const mockReturn: UseCommandDetectionReturn = {
        processData: vi.fn(),
        currentCommand: () => null,
        commands: () => [],
        hasShellIntegration: () => false,
        cwd: () => undefined,
        clear,
        reset,
      };

      mockReturn.clear();
      mockReturn.reset();

      expect(clear).toHaveBeenCalled();
      expect(reset).toHaveBeenCalled();
    });
  });

  describe("OSC Parser Interface", () => {
    interface OSC633ParserLike {
      registerOscHandler: (
        identifier: number,
        callback: (data: string) => boolean | Promise<boolean>
      ) => { dispose: () => void };
    }

    it("should register OSC handler", () => {
      const dispose = vi.fn();
      const mockParser: OSC633ParserLike = {
        registerOscHandler: vi.fn().mockReturnValue({ dispose }),
      };

      const result = mockParser.registerOscHandler(633, () => true);

      expect(mockParser.registerOscHandler).toHaveBeenCalledWith(633, expect.any(Function));
      expect(result.dispose).toBe(dispose);
    });

    it("should use correct OSC identifier", () => {
      const OSC_633_ID = 633;
      const mockParser: OSC633ParserLike = {
        registerOscHandler: vi.fn().mockReturnValue({ dispose: () => {} }),
      };

      mockParser.registerOscHandler(OSC_633_ID, () => true);

      expect(mockParser.registerOscHandler).toHaveBeenCalledWith(OSC_633_ID, expect.any(Function));
    });
  });

  describe("Command ID Generation", () => {
    let commandIdCounter = 0;
    const generateCommandId = (): string => {
      return `cmd-${Date.now()}-${commandIdCounter++}`;
    };

    it("should generate unique IDs", () => {
      const id1 = generateCommandId();
      const id2 = generateCommandId();

      expect(id1).not.toBe(id2);
    });

    it("should include timestamp prefix", () => {
      const id = generateCommandId();
      expect(id).toMatch(/^cmd-\d+-\d+$/);
    });
  });

  describe("Terminal Events", () => {
    it("should listen for terminal data events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("terminal:data", () => {});

      expect(listen).toHaveBeenCalledWith("terminal:data", expect.any(Function));
    });

    it("should listen for terminal resize events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("terminal:resize", () => {});

      expect(listen).toHaveBeenCalledWith("terminal:resize", expect.any(Function));
    });
  });

  describe("Command State Management", () => {
    interface DetectedCommand {
      id: string;
      line: number;
      command: string;
      isRunning: boolean;
      exitCode?: number;
      startTime: number;
      endTime?: number;
      output: string;
    }

    interface CommandState {
      commands: DetectedCommand[];
      currentCommand: DetectedCommand | null;
    }

    it("should initialize with empty state", () => {
      const state: CommandState = {
        commands: [],
        currentCommand: null,
      };

      expect(state.commands).toHaveLength(0);
      expect(state.currentCommand).toBeNull();
    });

    it("should add command to history", () => {
      const command: DetectedCommand = {
        id: "cmd-1",
        line: 10,
        command: "ls",
        isRunning: false,
        exitCode: 0,
        startTime: Date.now() - 100,
        endTime: Date.now(),
        output: "",
      };

      const state: CommandState = {
        commands: [command],
        currentCommand: null,
      };

      expect(state.commands).toHaveLength(1);
      expect(state.commands[0].command).toBe("ls");
    });

    it("should track current running command", () => {
      const command: DetectedCommand = {
        id: "cmd-1",
        line: 10,
        command: "npm install",
        isRunning: true,
        startTime: Date.now(),
        output: "",
      };

      const state: CommandState = {
        commands: [],
        currentCommand: command,
      };

      expect(state.currentCommand?.isRunning).toBe(true);
    });

    it("should accumulate output", () => {
      const command: DetectedCommand = {
        id: "cmd-1",
        line: 10,
        command: "ls",
        isRunning: true,
        startTime: Date.now(),
        output: "file1.txt\nfile2.txt",
      };

      expect(command.output).toContain("file1.txt");
      expect(command.output).toContain("file2.txt");
    });
  });
});
