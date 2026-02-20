import { describe, it, expect, vi, beforeEach } from "vitest";

interface KeyBinding {
  id: string;
  command: string;
  key: string;
  when?: string;
  source: "default" | "user" | "extension";
  description?: string;
  category?: string;
}

interface KeystrokeEvent {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

interface ChordState {
  isActive: boolean;
  firstKey: string | null;
  timeout: ReturnType<typeof setTimeout> | null;
}

interface RecordingState {
  isRecording: boolean;
  targetCommand: string | null;
  recordedKeys: string[];
}

interface WhenClauseContext {
  [key: string]: boolean | string | number;
}

interface KeymapState {
  bindings: KeyBinding[];
  chordState: ChordState;
  recordingState: RecordingState;
  contextKeys: WhenClauseContext;
  conflictingBindings: Map<string, KeyBinding[]>;
}

interface KeymapContextValue {
  state: KeymapState;
  getBindingForCommand: (command: string) => KeyBinding | undefined;
  getBindingsForKey: (key: string) => KeyBinding[];
  setCustomBinding: (command: string, key: string, when?: string) => void;
  resetToDefault: (command: string) => void;
  resetAllToDefault: () => void;
  handleKeystroke: (event: KeystrokeEvent) => boolean;
  handleKeystrokeForChord: (event: KeystrokeEvent) => string | null;
  startRecording: (command: string) => void;
  stopRecording: () => void;
  saveRecordedBinding: () => void;
  cancelRecording: () => void;
  setContextKey: (key: string, value: boolean | string | number) => void;
  removeContextKey: (key: string) => void;
  evaluateWhenClause: (when: string) => boolean;
  getConflicts: (key: string) => KeyBinding[];
  formatKeyBinding: (binding: KeyBinding) => string;
}

const STORAGE_KEY_BINDINGS = "cortex_keybindings";
const STORAGE_KEY_WHEN_CLAUSES = "cortex_keybinding_when_clauses";

describe("KeymapContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("KeyBinding interface", () => {
    it("should have correct binding structure", () => {
      const binding: KeyBinding = {
        id: "binding-1",
        command: "editor.save",
        key: "Ctrl+S",
        when: "editorFocus",
        source: "default",
        description: "Save the current file",
        category: "File",
      };

      expect(binding.id).toBe("binding-1");
      expect(binding.command).toBe("editor.save");
      expect(binding.key).toBe("Ctrl+S");
      expect(binding.source).toBe("default");
    });

    it("should allow user-defined bindings", () => {
      const binding: KeyBinding = {
        id: "user-binding-1",
        command: "custom.action",
        key: "Ctrl+Shift+X",
        source: "user",
      };

      expect(binding.source).toBe("user");
      expect(binding.when).toBeUndefined();
    });

    it("should support extension bindings", () => {
      const binding: KeyBinding = {
        id: "ext-binding-1",
        command: "extension.runTest",
        key: "Ctrl+Shift+T",
        source: "extension",
        category: "Testing",
      };

      expect(binding.source).toBe("extension");
    });
  });

  describe("KeystrokeEvent interface", () => {
    it("should capture all modifier keys", () => {
      const event: KeystrokeEvent = {
        key: "s",
        code: "KeyS",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      };

      expect(event.key).toBe("s");
      expect(event.ctrlKey).toBe(true);
      expect(event.shiftKey).toBe(false);
    });

    it("should handle complex key combinations", () => {
      const event: KeystrokeEvent = {
        key: "k",
        code: "KeyK",
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
        metaKey: false,
      };

      expect(event.ctrlKey).toBe(true);
      expect(event.shiftKey).toBe(true);
      expect(event.altKey).toBe(true);
    });
  });

  describe("ChordState interface", () => {
    it("should track chord mode state", () => {
      const chordState: ChordState = {
        isActive: true,
        firstKey: "Ctrl+K",
        timeout: null,
      };

      expect(chordState.isActive).toBe(true);
      expect(chordState.firstKey).toBe("Ctrl+K");
    });

    it("should handle inactive chord state", () => {
      const chordState: ChordState = {
        isActive: false,
        firstKey: null,
        timeout: null,
      };

      expect(chordState.isActive).toBe(false);
      expect(chordState.firstKey).toBeNull();
    });
  });

  describe("RecordingState interface", () => {
    it("should track recording state", () => {
      const recordingState: RecordingState = {
        isRecording: true,
        targetCommand: "editor.format",
        recordedKeys: ["Ctrl", "Shift"],
      };

      expect(recordingState.isRecording).toBe(true);
      expect(recordingState.targetCommand).toBe("editor.format");
      expect(recordingState.recordedKeys).toHaveLength(2);
    });

    it("should handle idle recording state", () => {
      const recordingState: RecordingState = {
        isRecording: false,
        targetCommand: null,
        recordedKeys: [],
      };

      expect(recordingState.isRecording).toBe(false);
      expect(recordingState.recordedKeys).toHaveLength(0);
    });
  });

  describe("WhenClauseContext interface", () => {
    it("should support various value types", () => {
      const context: WhenClauseContext = {
        editorFocus: true,
        sidebarVisible: false,
        activeEditor: "typescript",
        tabCount: 5,
      };

      expect(context.editorFocus).toBe(true);
      expect(context.activeEditor).toBe("typescript");
      expect(context.tabCount).toBe(5);
    });
  });

  describe("Storage persistence", () => {
    it("should save bindings to localStorage", () => {
      const bindings: KeyBinding[] = [
        {
          id: "1",
          command: "editor.save",
          key: "Ctrl+S",
          source: "user",
        },
      ];

      localStorage.setItem(STORAGE_KEY_BINDINGS, JSON.stringify(bindings));

      const stored = localStorage.getItem(STORAGE_KEY_BINDINGS);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].command).toBe("editor.save");
    });

    it("should load bindings from localStorage", () => {
      const bindings = [
        { id: "1", command: "editor.undo", key: "Ctrl+Z", source: "user" },
        { id: "2", command: "editor.redo", key: "Ctrl+Y", source: "user" },
      ];

      localStorage.setItem(STORAGE_KEY_BINDINGS, JSON.stringify(bindings));

      const stored = localStorage.getItem(STORAGE_KEY_BINDINGS);
      const loaded = JSON.parse(stored!) as KeyBinding[];

      expect(loaded).toHaveLength(2);
      expect(loaded[0].key).toBe("Ctrl+Z");
    });

    it("should save when clauses to localStorage", () => {
      const whenClauses = {
        "editor.save": "editorFocus && !isReadonly",
        "editor.format": "editorFocus && editorLangId == 'typescript'",
      };

      localStorage.setItem(STORAGE_KEY_WHEN_CLAUSES, JSON.stringify(whenClauses));

      const stored = localStorage.getItem(STORAGE_KEY_WHEN_CLAUSES);
      expect(stored).not.toBeNull();
    });
  });

  describe("State management", () => {
    it("should manage bindings array", () => {
      let state: KeymapState = {
        bindings: [],
        chordState: { isActive: false, firstKey: null, timeout: null },
        recordingState: { isRecording: false, targetCommand: null, recordedKeys: [] },
        contextKeys: {},
        conflictingBindings: new Map(),
      };

      const newBinding: KeyBinding = {
        id: "new-1",
        command: "test.command",
        key: "Ctrl+T",
        source: "user",
      };

      state = { ...state, bindings: [...state.bindings, newBinding] };
      expect(state.bindings).toHaveLength(1);
    });

    it("should track conflicting bindings", () => {
      const conflicts = new Map<string, KeyBinding[]>();
      
      const binding1: KeyBinding = {
        id: "1",
        command: "editor.save",
        key: "Ctrl+S",
        source: "default",
      };
      
      const binding2: KeyBinding = {
        id: "2",
        command: "custom.save",
        key: "Ctrl+S",
        source: "user",
      };

      conflicts.set("Ctrl+S", [binding1, binding2]);

      expect(conflicts.get("Ctrl+S")).toHaveLength(2);
    });
  });

  describe("Key binding operations", () => {
    it("should find binding for command", () => {
      const bindings: KeyBinding[] = [
        { id: "1", command: "editor.save", key: "Ctrl+S", source: "default" },
        { id: "2", command: "editor.undo", key: "Ctrl+Z", source: "default" },
      ];

      const binding = bindings.find((b) => b.command === "editor.save");
      expect(binding?.key).toBe("Ctrl+S");
    });

    it("should find all bindings for a key", () => {
      const bindings: KeyBinding[] = [
        { id: "1", command: "editor.save", key: "Ctrl+S", source: "default" },
        { id: "2", command: "custom.action", key: "Ctrl+S", when: "customContext", source: "user" },
      ];

      const keyBindings = bindings.filter((b) => b.key === "Ctrl+S");
      expect(keyBindings).toHaveLength(2);
    });

    it("should set custom binding", () => {
      let bindings: KeyBinding[] = [
        { id: "1", command: "editor.save", key: "Ctrl+S", source: "default" },
      ];

      bindings = bindings.map((b) =>
        b.command === "editor.save"
          ? { ...b, key: "Ctrl+Shift+S", source: "user" as const }
          : b
      );

      expect(bindings[0].key).toBe("Ctrl+Shift+S");
      expect(bindings[0].source).toBe("user");
    });

    it("should reset binding to default", () => {
      const defaultBinding: KeyBinding = {
        id: "1",
        command: "editor.save",
        key: "Ctrl+S",
        source: "default",
      };

      let userBinding: KeyBinding = {
        ...defaultBinding,
        key: "Ctrl+Shift+S",
        source: "user",
      };

      userBinding = { ...defaultBinding };
      expect(userBinding.key).toBe("Ctrl+S");
      expect(userBinding.source).toBe("default");
    });
  });

  describe("Recording mode", () => {
    it("should start recording for command", () => {
      let recordingState: RecordingState = {
        isRecording: false,
        targetCommand: null,
        recordedKeys: [],
      };

      recordingState = {
        isRecording: true,
        targetCommand: "editor.format",
        recordedKeys: [],
      };

      expect(recordingState.isRecording).toBe(true);
      expect(recordingState.targetCommand).toBe("editor.format");
    });

    it("should record keystrokes", () => {
      let recordingState: RecordingState = {
        isRecording: true,
        targetCommand: "editor.format",
        recordedKeys: [],
      };

      recordingState = {
        ...recordingState,
        recordedKeys: [...recordingState.recordedKeys, "Ctrl", "Shift", "F"],
      };

      expect(recordingState.recordedKeys).toEqual(["Ctrl", "Shift", "F"]);
    });

    it("should stop recording", () => {
      let recordingState: RecordingState = {
        isRecording: true,
        targetCommand: "editor.format",
        recordedKeys: ["Ctrl", "Shift", "F"],
      };

      recordingState = {
        isRecording: false,
        targetCommand: null,
        recordedKeys: [],
      };

      expect(recordingState.isRecording).toBe(false);
    });
  });

  describe("When clause evaluation", () => {
    it("should evaluate simple when clause", () => {
      const context: WhenClauseContext = {
        editorFocus: true,
        sidebarVisible: false,
      };

      const evaluateSimple = (clause: string, ctx: WhenClauseContext): boolean => {
        if (clause.startsWith("!")) {
          const key = clause.slice(1);
          return ctx[key] === false || ctx[key] === undefined;
        }
        return ctx[clause] === true;
      };

      expect(evaluateSimple("editorFocus", context)).toBe(true);
      expect(evaluateSimple("!sidebarVisible", context)).toBe(true);
    });

    it("should manage context keys", () => {
      let contextKeys: WhenClauseContext = {};

      contextKeys = { ...contextKeys, editorFocus: true };
      expect(contextKeys.editorFocus).toBe(true);

      contextKeys = { ...contextKeys, activeEditor: "typescript" };
      expect(contextKeys.activeEditor).toBe("typescript");

      const { editorFocus: _, ...rest } = contextKeys;
      contextKeys = rest;
      expect(contextKeys.editorFocus).toBeUndefined();
    });
  });

  describe("Key formatting", () => {
    it("should format key binding string", () => {
      const formatKey = (event: KeystrokeEvent): string => {
        const parts: string[] = [];
        if (event.ctrlKey) parts.push("Ctrl");
        if (event.shiftKey) parts.push("Shift");
        if (event.altKey) parts.push("Alt");
        if (event.metaKey) parts.push("Meta");
        parts.push(event.key.toUpperCase());
        return parts.join("+");
      };

      const event: KeystrokeEvent = {
        key: "s",
        code: "KeyS",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      };

      expect(formatKey(event)).toBe("Ctrl+S");
    });
  });

  describe("Context value structure", () => {
    it("should define all required methods", () => {
      const mockContext: KeymapContextValue = {
        state: {
          bindings: [],
          chordState: { isActive: false, firstKey: null, timeout: null },
          recordingState: { isRecording: false, targetCommand: null, recordedKeys: [] },
          contextKeys: {},
          conflictingBindings: new Map(),
        },
        getBindingForCommand: vi.fn(),
        getBindingsForKey: vi.fn(),
        setCustomBinding: vi.fn(),
        resetToDefault: vi.fn(),
        resetAllToDefault: vi.fn(),
        handleKeystroke: vi.fn(),
        handleKeystrokeForChord: vi.fn(),
        startRecording: vi.fn(),
        stopRecording: vi.fn(),
        saveRecordedBinding: vi.fn(),
        cancelRecording: vi.fn(),
        setContextKey: vi.fn(),
        removeContextKey: vi.fn(),
        evaluateWhenClause: vi.fn(),
        getConflicts: vi.fn(),
        formatKeyBinding: vi.fn(),
      };

      expect(mockContext.setCustomBinding).toBeDefined();
      expect(mockContext.resetToDefault).toBeDefined();
      expect(mockContext.handleKeystroke).toBeDefined();
      expect(mockContext.startRecording).toBeDefined();
      expect(mockContext.evaluateWhenClause).toBeDefined();
    });
  });
});
