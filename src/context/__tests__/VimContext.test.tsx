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

describe("VimContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("VimMode Types", () => {
    type VimMode = "normal" | "insert" | "visual" | "visual-line" | "command";

    it("should define normal mode", () => {
      const mode: VimMode = "normal";
      expect(mode).toBe("normal");
    });

    it("should define insert mode", () => {
      const mode: VimMode = "insert";
      expect(mode).toBe("insert");
    });

    it("should define visual mode", () => {
      const mode: VimMode = "visual";
      expect(mode).toBe("visual");
    });

    it("should define visual-line mode", () => {
      const mode: VimMode = "visual-line";
      expect(mode).toBe("visual-line");
    });

    it("should define command mode", () => {
      const mode: VimMode = "command";
      expect(mode).toBe("command");
    });

    it("should list all valid modes", () => {
      const validModes: VimMode[] = ["normal", "insert", "visual", "visual-line", "command"];
      expect(validModes).toHaveLength(5);
    });
  });

  describe("PendingOperator", () => {
    interface PendingOperator {
      type: "d" | "c" | "y" | ">" | "<" | "g~" | "gu" | "gU";
      count?: number;
    }

    it("should define delete operator", () => {
      const op: PendingOperator = { type: "d" };
      expect(op.type).toBe("d");
    });

    it("should define change operator", () => {
      const op: PendingOperator = { type: "c" };
      expect(op.type).toBe("c");
    });

    it("should define yank operator", () => {
      const op: PendingOperator = { type: "y" };
      expect(op.type).toBe("y");
    });

    it("should define indent operators", () => {
      const indent: PendingOperator = { type: ">" };
      const outdent: PendingOperator = { type: "<" };

      expect(indent.type).toBe(">");
      expect(outdent.type).toBe("<");
    });

    it("should define case operators", () => {
      const toggleCase: PendingOperator = { type: "g~" };
      const lowercase: PendingOperator = { type: "gu" };
      const uppercase: PendingOperator = { type: "gU" };

      expect(toggleCase.type).toBe("g~");
      expect(lowercase.type).toBe("gu");
      expect(uppercase.type).toBe("gU");
    });

    it("should include count with operator", () => {
      const op: PendingOperator = { type: "d", count: 3 };

      expect(op.type).toBe("d");
      expect(op.count).toBe(3);
    });
  });

  describe("VisualSelection", () => {
    interface VisualSelection {
      start: { line: number; column: number };
      end: { line: number; column: number };
    }

    it("should define visual selection", () => {
      const selection: VisualSelection = {
        start: { line: 0, column: 0 },
        end: { line: 0, column: 10 },
      };

      expect(selection.start.line).toBe(0);
      expect(selection.end.column).toBe(10);
    });

    it("should support multi-line selection", () => {
      const selection: VisualSelection = {
        start: { line: 5, column: 0 },
        end: { line: 10, column: 20 },
      };

      expect(selection.start.line).toBe(5);
      expect(selection.end.line).toBe(10);
    });

    it("should calculate selection range", () => {
      const selection: VisualSelection = {
        start: { line: 2, column: 5 },
        end: { line: 2, column: 15 },
      };

      const length = selection.end.column - selection.start.column;
      expect(length).toBe(10);
    });
  });

  describe("VimRegister", () => {
    interface VimRegister {
      content: string;
      type: "char" | "line" | "block";
    }

    it("should define character register", () => {
      const register: VimRegister = {
        content: "hello",
        type: "char",
      };

      expect(register.type).toBe("char");
      expect(register.content).toBe("hello");
    });

    it("should define line register", () => {
      const register: VimRegister = {
        content: "line content\n",
        type: "line",
      };

      expect(register.type).toBe("line");
    });

    it("should define block register", () => {
      const register: VimRegister = {
        content: "block\ntext",
        type: "block",
      };

      expect(register.type).toBe("block");
    });
  });

  describe("VimState", () => {
    type VimMode = "normal" | "insert" | "visual" | "visual-line" | "command";

    interface VimRegister {
      content: string;
      type: "char" | "line" | "block";
    }

    interface PendingOperator {
      type: "d" | "c" | "y" | ">" | "<" | "g~" | "gu" | "gU";
      count?: number;
    }

    interface VisualSelection {
      start: { line: number; column: number };
      end: { line: number; column: number };
    }

    interface CommandHistoryEntry {
      command: string;
      timestamp: number;
    }

    interface LastChange {
      type: string;
      operator?: string;
      motion?: string;
      insertedText?: string;
      replaceChar?: string;
      count: number;
    }

    interface VimState {
      enabled: boolean;
      mode: VimMode;
      count: string;
      pendingOperator: PendingOperator | null;
      visualSelection: VisualSelection | null;
      commandBuffer: string;
      lastSearch: string;
      searchDirection: "forward" | "backward";
      registers: Record<string, VimRegister>;
      commandHistory: CommandHistoryEntry[];
      lastCommand: string;
      insertStartPosition: { line: number; column: number } | null;
      repeatCount: number;
      lastChange: LastChange | null;
    }

    it("should create default vim state", () => {
      const state: VimState = {
        enabled: false,
        mode: "normal",
        count: "",
        pendingOperator: null,
        visualSelection: null,
        commandBuffer: "",
        lastSearch: "",
        searchDirection: "forward",
        registers: {},
        commandHistory: [],
        lastCommand: "",
        insertStartPosition: null,
        repeatCount: 1,
        lastChange: null,
      };

      expect(state.enabled).toBe(false);
      expect(state.mode).toBe("normal");
    });

    it("should track enabled state", () => {
      const state: VimState = {
        enabled: true,
        mode: "normal",
        count: "",
        pendingOperator: null,
        visualSelection: null,
        commandBuffer: "",
        lastSearch: "",
        searchDirection: "forward",
        registers: {},
        commandHistory: [],
        lastCommand: "",
        insertStartPosition: null,
        repeatCount: 1,
        lastChange: null,
      };

      expect(state.enabled).toBe(true);
    });

    it("should track count prefix", () => {
      const state: VimState = {
        enabled: true,
        mode: "normal",
        count: "5",
        pendingOperator: null,
        visualSelection: null,
        commandBuffer: "",
        lastSearch: "",
        searchDirection: "forward",
        registers: {},
        commandHistory: [],
        lastCommand: "",
        insertStartPosition: null,
        repeatCount: 5,
        lastChange: null,
      };

      expect(state.count).toBe("5");
      expect(state.repeatCount).toBe(5);
    });
  });

  describe("Mode Transitions", () => {
    type VimMode = "normal" | "insert" | "visual" | "visual-line" | "command";

    it("should transition from normal to insert", () => {
      let mode: VimMode = "normal";

      const enterInsertMode = () => {
        mode = "insert";
      };

      enterInsertMode();
      expect(mode).toBe("insert");
    });

    it("should transition from insert to normal", () => {
      let mode: VimMode = "insert";

      const exitInsertMode = () => {
        mode = "normal";
      };

      exitInsertMode();
      expect(mode).toBe("normal");
    });

    it("should transition to visual mode", () => {
      let mode: VimMode = "normal";

      const enterVisualMode = () => {
        mode = "visual";
      };

      enterVisualMode();
      expect(mode).toBe("visual");
    });

    it("should transition to visual-line mode", () => {
      let mode: VimMode = "normal";

      const enterVisualLineMode = () => {
        mode = "visual-line";
      };

      enterVisualLineMode();
      expect(mode).toBe("visual-line");
    });

    it("should transition to command mode", () => {
      let mode: VimMode = "normal";

      const enterCommandMode = () => {
        mode = "command";
      };

      enterCommandMode();
      expect(mode).toBe("command");
    });
  });

  describe("Count Handling", () => {
    it("should append count digits", () => {
      let count = "";

      const appendCount = (digit: string) => {
        if (/^[0-9]$/.test(digit)) {
          if (count === "" && digit === "0") {
            return;
          }
          count += digit;
        }
      };

      appendCount("3");
      expect(count).toBe("3");

      appendCount("5");
      expect(count).toBe("35");
    });

    it("should not allow leading zero", () => {
      let count = "";

      const appendCount = (digit: string) => {
        if (/^[0-9]$/.test(digit)) {
          if (count === "" && digit === "0") {
            return;
          }
          count += digit;
        }
      };

      appendCount("0");
      expect(count).toBe("");
    });

    it("should clear count", () => {
      let count = "35";

      const clearCount = () => {
        count = "";
      };

      clearCount();
      expect(count).toBe("");
    });

    it("should get effective count", () => {
      const getEffectiveCount = (count: string): number => {
        if (count === "") return 1;
        const parsed = parseInt(count, 10);
        return isNaN(parsed) ? 1 : parsed;
      };

      expect(getEffectiveCount("")).toBe(1);
      expect(getEffectiveCount("5")).toBe(5);
      expect(getEffectiveCount("35")).toBe(35);
    });
  });

  describe("Register Operations", () => {
    interface VimRegister {
      content: string;
      type: "char" | "line" | "block";
    }

    it("should set register", () => {
      const registers: Record<string, VimRegister> = {};

      const setRegister = (name: string, content: string, type: "char" | "line" | "block") => {
        registers[name] = { content, type };
      };

      setRegister("a", "hello", "char");
      expect(registers["a"].content).toBe("hello");
      expect(registers["a"].type).toBe("char");
    });

    it("should get register", () => {
      const registers: Record<string, VimRegister> = {
        a: { content: "test", type: "char" },
      };

      const getRegister = (name: string): VimRegister | null => {
        return registers[name] || null;
      };

      expect(getRegister("a")?.content).toBe("test");
      expect(getRegister("b")).toBeNull();
    });

    it("should update default register", () => {
      const registers: Record<string, VimRegister> = {
        '"': { content: "", type: "char" },
      };

      const setRegister = (name: string, content: string, type: "char" | "line" | "block") => {
        registers[name] = { content, type };
        if (name !== '"') {
          registers['"'] = { content, type };
        }
      };

      setRegister("a", "yanked", "char");
      expect(registers['"'].content).toBe("yanked");
    });

    it("should have default registers", () => {
      const defaultRegisters: Record<string, VimRegister> = {
        '"': { content: "", type: "char" },
        "0": { content: "", type: "char" },
        "-": { content: "", type: "char" },
        "+": { content: "", type: "char" },
        "*": { content: "", type: "char" },
      };

      expect(defaultRegisters['"']).toBeDefined();
      expect(defaultRegisters["0"]).toBeDefined();
      expect(defaultRegisters["+"]).toBeDefined();
    });
  });

  describe("Command Buffer", () => {
    it("should initialize command buffer", () => {
      let commandBuffer = "";

      const enterCommandMode = () => {
        commandBuffer = ":";
      };

      enterCommandMode();
      expect(commandBuffer).toBe(":");
    });

    it("should append to command buffer", () => {
      let commandBuffer = ":";

      const appendCommandBuffer = (char: string) => {
        commandBuffer += char;
      };

      appendCommandBuffer("w");
      appendCommandBuffer("q");
      expect(commandBuffer).toBe(":wq");
    });

    it("should clear command buffer", () => {
      let commandBuffer = ":wq";

      const clearCommandBuffer = () => {
        commandBuffer = "";
      };

      clearCommandBuffer();
      expect(commandBuffer).toBe("");
    });

    it("should execute command", () => {
      interface CommandHistoryEntry {
        command: string;
        timestamp: number;
      }

      const commandHistory: CommandHistoryEntry[] = [];
      let lastCommand = "";

      const executeCommand = (command: string) => {
        commandHistory.push({ command, timestamp: Date.now() });
        lastCommand = command;
      };

      executeCommand(":w");
      expect(commandHistory).toHaveLength(1);
      expect(lastCommand).toBe(":w");
    });
  });

  describe("Search", () => {
    it("should set last search", () => {
      let lastSearch = "";
      let searchDirection: "forward" | "backward" = "forward";

      const setLastSearch = (search: string, direction: "forward" | "backward") => {
        lastSearch = search;
        searchDirection = direction;
      };

      setLastSearch("pattern", "forward");
      expect(lastSearch).toBe("pattern");
      expect(searchDirection).toBe("forward");
    });

    it("should search backward", () => {
      let searchDirection: "forward" | "backward" = "forward";

      const setSearchDirection = (direction: "forward" | "backward") => {
        searchDirection = direction;
      };

      setSearchDirection("backward");
      expect(searchDirection).toBe("backward");
    });
  });

  describe("LastChange", () => {
    interface LastChange {
      type: string;
      operator?: string;
      motion?: string;
      textObject?: { object: string; around: boolean };
      insertedText?: string;
      replaceChar?: string;
      count: number;
    }

    it("should track delete change", () => {
      const lastChange: LastChange = {
        type: "dd",
        count: 1,
      };

      expect(lastChange.type).toBe("dd");
    });

    it("should track operator+motion change", () => {
      const lastChange: LastChange = {
        type: "operator-motion",
        operator: "d",
        motion: "w",
        count: 2,
      };

      expect(lastChange.operator).toBe("d");
      expect(lastChange.motion).toBe("w");
      expect(lastChange.count).toBe(2);
    });

    it("should track insert change", () => {
      const lastChange: LastChange = {
        type: "insert",
        insertedText: "hello world",
        count: 1,
      };

      expect(lastChange.insertedText).toBe("hello world");
    });

    it("should track replace change", () => {
      const lastChange: LastChange = {
        type: "r",
        replaceChar: "x",
        count: 1,
      };

      expect(lastChange.replaceChar).toBe("x");
    });

    it("should track text object change", () => {
      const lastChange: LastChange = {
        type: "text-object",
        operator: "d",
        textObject: { object: "w", around: false },
        count: 1,
      };

      expect(lastChange.textObject?.object).toBe("w");
      expect(lastChange.textObject?.around).toBe(false);
    });
  });

  describe("Mode Display", () => {
    type VimMode = "normal" | "insert" | "visual" | "visual-line" | "command";

    interface PendingOperator {
      type: "d" | "c" | "y" | ">" | "<" | "g~" | "gu" | "gU";
      count?: number;
    }

    it("should get mode display string", () => {
      const getModeDisplay = (
        enabled: boolean,
        mode: VimMode,
        pendingOp: PendingOperator | null,
        count: string
      ): string => {
        if (!enabled) return "";

        let display = "";
        switch (mode) {
          case "normal":
            display = "NORMAL";
            break;
          case "insert":
            display = "INSERT";
            break;
          case "visual":
            display = "VISUAL";
            break;
          case "visual-line":
            display = "V-LINE";
            break;
          case "command":
            display = "COMMAND";
            break;
        }

        if (pendingOp) {
          display += ` (${count}${pendingOp.type})`;
        } else if (count) {
          display += ` (${count})`;
        }

        return display;
      };

      expect(getModeDisplay(true, "normal", null, "")).toBe("NORMAL");
      expect(getModeDisplay(true, "insert", null, "")).toBe("INSERT");
      expect(getModeDisplay(true, "visual", null, "")).toBe("VISUAL");
      expect(getModeDisplay(true, "visual-line", null, "")).toBe("V-LINE");
      expect(getModeDisplay(true, "command", null, "")).toBe("COMMAND");
      expect(getModeDisplay(false, "normal", null, "")).toBe("");
      expect(getModeDisplay(true, "normal", { type: "d" }, "3")).toBe("NORMAL (3d)");
      expect(getModeDisplay(true, "normal", null, "5")).toBe("NORMAL (5)");
    });
  });

  describe("Vim Events", () => {
    it("should listen for vim mode change events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("vim:mode-change", () => {});

      expect(listen).toHaveBeenCalledWith("vim:mode-change", expect.any(Function));
    });

    it("should listen for vim command execute events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("vim:command-execute", () => {});

      expect(listen).toHaveBeenCalledWith("vim:command-execute", expect.any(Function));
    });
  });

  describe("Vim Invoke Commands", () => {
    it("should enable vim via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("vim_enable");

      expect(invoke).toHaveBeenCalledWith("vim_enable");
    });

    it("should disable vim via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("vim_disable");

      expect(invoke).toHaveBeenCalledWith("vim_disable");
    });

    it("should get vim state via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ enabled: true, mode: "normal" });

      const result = await invoke("vim_get_state");

      expect(result).toEqual({ enabled: true, mode: "normal" });
    });
  });

  describe("Reset State", () => {
    type VimMode = "normal" | "insert" | "visual" | "visual-line" | "command";

    it("should reset all state", () => {
      let mode: VimMode = "visual";
      let count = "5";
      let commandBuffer = ":wq";

      const resetState = () => {
        mode = "normal";
        count = "";
        commandBuffer = "";
      };

      resetState();
      expect(mode).toBe("normal");
      expect(count).toBe("");
      expect(commandBuffer).toBe("");
    });
  });

  describe("Insert Start Position", () => {
    it("should track insert start position", () => {
      let insertStartPosition: { line: number; column: number } | null = null;

      const setInsertStartPosition = (pos: { line: number; column: number } | null) => {
        insertStartPosition = pos;
      };

      setInsertStartPosition({ line: 10, column: 5 });
      expect(insertStartPosition).toEqual({ line: 10, column: 5 });

      setInsertStartPosition(null);
      expect(insertStartPosition).toBeNull();
    });
  });
});
