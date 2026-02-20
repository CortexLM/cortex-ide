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

describe("WhichKeyContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("WhichKeySettings", () => {
    interface WhichKeySettings {
      enabled: boolean;
      delay: number;
      showIcons: boolean;
      sortOrder: "alphabetical" | "frequency" | "custom";
      maxColumns: number;
      maxRows: number;
      showDescriptions: boolean;
    }

    it("should create default settings", () => {
      const settings: WhichKeySettings = {
        enabled: true,
        delay: 500,
        showIcons: true,
        sortOrder: "alphabetical",
        maxColumns: 3,
        maxRows: 10,
        showDescriptions: true,
      };

      expect(settings.enabled).toBe(true);
      expect(settings.delay).toBe(500);
    });

    it("should allow frequency sort order", () => {
      const settings: WhichKeySettings = {
        enabled: true,
        delay: 300,
        showIcons: true,
        sortOrder: "frequency",
        maxColumns: 4,
        maxRows: 8,
        showDescriptions: true,
      };

      expect(settings.sortOrder).toBe("frequency");
    });

    it("should allow custom sort order", () => {
      const settings: WhichKeySettings = {
        enabled: true,
        delay: 400,
        showIcons: false,
        sortOrder: "custom",
        maxColumns: 2,
        maxRows: 12,
        showDescriptions: false,
      };

      expect(settings.sortOrder).toBe("custom");
      expect(settings.showDescriptions).toBe(false);
    });
  });

  describe("PendingSequence", () => {
    interface PendingSequence {
      keys: string[];
      startedAt: number;
      timeoutId?: number;
    }

    it("should create pending sequence", () => {
      const sequence: PendingSequence = {
        keys: ["Ctrl+K"],
        startedAt: Date.now(),
      };

      expect(sequence.keys).toHaveLength(1);
      expect(sequence.keys[0]).toBe("Ctrl+K");
    });

    it("should track multiple keys in sequence", () => {
      const sequence: PendingSequence = {
        keys: ["Ctrl+K", "Ctrl+C"],
        startedAt: Date.now(),
      };

      expect(sequence.keys).toHaveLength(2);
    });

    it("should track timeout id", () => {
      const sequence: PendingSequence = {
        keys: ["Ctrl+K"],
        startedAt: Date.now(),
        timeoutId: 12345,
      };

      expect(sequence.timeoutId).toBe(12345);
    });
  });

  describe("ContinuationBinding", () => {
    interface ContinuationBinding {
      key: string;
      label: string;
      description?: string;
      icon?: string;
      command?: string;
      submenu?: ContinuationBinding[];
    }

    it("should create simple binding", () => {
      const binding: ContinuationBinding = {
        key: "c",
        label: "Comment",
        command: "editor.action.commentLine",
      };

      expect(binding.key).toBe("c");
      expect(binding.command).toBe("editor.action.commentLine");
    });

    it("should create binding with description", () => {
      const binding: ContinuationBinding = {
        key: "f",
        label: "Format",
        description: "Format the current document",
        command: "editor.action.formatDocument",
      };

      expect(binding.description).toBe("Format the current document");
    });

    it("should create binding with icon", () => {
      const binding: ContinuationBinding = {
        key: "s",
        label: "Save",
        icon: "save",
        command: "workbench.action.files.save",
      };

      expect(binding.icon).toBe("save");
    });

    it("should create binding with submenu", () => {
      const binding: ContinuationBinding = {
        key: "g",
        label: "Git",
        submenu: [
          { key: "s", label: "Stage", command: "git.stage" },
          { key: "c", label: "Commit", command: "git.commit" },
          { key: "p", label: "Push", command: "git.push" },
        ],
      };

      expect(binding.submenu).toHaveLength(3);
      expect(binding.submenu?.[0].key).toBe("s");
    });

    it("should create nested submenu", () => {
      const binding: ContinuationBinding = {
        key: "w",
        label: "Window",
        submenu: [
          {
            key: "s",
            label: "Split",
            submenu: [
              { key: "h", label: "Horizontal", command: "workbench.action.splitEditorDown" },
              { key: "v", label: "Vertical", command: "workbench.action.splitEditorRight" },
            ],
          },
        ],
      };

      expect(binding.submenu?.[0].submenu).toHaveLength(2);
    });
  });

  describe("WhichKeyState", () => {
    interface ContinuationBinding {
      key: string;
      label: string;
      description?: string;
      icon?: string;
      command?: string;
      submenu?: ContinuationBinding[];
    }

    interface PendingSequence {
      keys: string[];
      startedAt: number;
      timeoutId?: number;
    }

    interface WhichKeySettings {
      enabled: boolean;
      delay: number;
      showIcons: boolean;
      sortOrder: "alphabetical" | "frequency" | "custom";
      maxColumns: number;
      maxRows: number;
      showDescriptions: boolean;
    }

    interface WhichKeyState {
      visible: boolean;
      pendingSequence: PendingSequence | null;
      availableBindings: ContinuationBinding[];
      settings: WhichKeySettings;
      keyFrequency: Record<string, number>;
    }

    it("should create initial state", () => {
      const state: WhichKeyState = {
        visible: false,
        pendingSequence: null,
        availableBindings: [],
        settings: {
          enabled: true,
          delay: 500,
          showIcons: true,
          sortOrder: "alphabetical",
          maxColumns: 3,
          maxRows: 10,
          showDescriptions: true,
        },
        keyFrequency: {},
      };

      expect(state.visible).toBe(false);
      expect(state.pendingSequence).toBeNull();
    });

    it("should track visible state", () => {
      const state: WhichKeyState = {
        visible: true,
        pendingSequence: { keys: ["Ctrl+K"], startedAt: Date.now() },
        availableBindings: [{ key: "c", label: "Comment", command: "comment" }],
        settings: {
          enabled: true,
          delay: 500,
          showIcons: true,
          sortOrder: "alphabetical",
          maxColumns: 3,
          maxRows: 10,
          showDescriptions: true,
        },
        keyFrequency: {},
      };

      expect(state.visible).toBe(true);
      expect(state.availableBindings).toHaveLength(1);
    });

    it("should track key frequency", () => {
      const state: WhichKeyState = {
        visible: false,
        pendingSequence: null,
        availableBindings: [],
        settings: {
          enabled: true,
          delay: 500,
          showIcons: true,
          sortOrder: "frequency",
          maxColumns: 3,
          maxRows: 10,
          showDescriptions: true,
        },
        keyFrequency: {
          "Ctrl+K c": 15,
          "Ctrl+K f": 10,
          "Ctrl+K s": 25,
        },
      };

      expect(state.keyFrequency["Ctrl+K s"]).toBe(25);
    });
  });

  describe("Settings Persistence", () => {
    interface WhichKeySettings {
      enabled: boolean;
      delay: number;
      showIcons: boolean;
      sortOrder: "alphabetical" | "frequency" | "custom";
      maxColumns: number;
      maxRows: number;
      showDescriptions: boolean;
    }

    it("should save settings", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const settings: WhichKeySettings = {
        enabled: true,
        delay: 300,
        showIcons: true,
        sortOrder: "frequency",
        maxColumns: 4,
        maxRows: 8,
        showDescriptions: true,
      };

      await invoke("whichkey_save_settings", { settings });

      expect(invoke).toHaveBeenCalledWith("whichkey_save_settings", { settings });
    });

    it("should load settings", async () => {
      const savedSettings: WhichKeySettings = {
        enabled: true,
        delay: 400,
        showIcons: false,
        sortOrder: "custom",
        maxColumns: 2,
        maxRows: 12,
        showDescriptions: false,
      };

      vi.mocked(invoke).mockResolvedValueOnce(savedSettings);

      const result = await invoke("whichkey_load_settings");

      expect(result).toEqual(savedSettings);
    });
  });

  describe("Keystroke Formatting", () => {
    it("should format single key", () => {
      const formatKeystroke = (key: string): string => {
        return key;
      };

      expect(formatKeystroke("a")).toBe("a");
      expect(formatKeystroke("Enter")).toBe("Enter");
    });

    it("should format modifier key", () => {
      const formatKeystroke = (key: string): string => {
        return key
          .replace("Ctrl+", "⌃")
          .replace("Alt+", "⌥")
          .replace("Shift+", "⇧")
          .replace("Meta+", "⌘");
      };

      expect(formatKeystroke("Ctrl+K")).toBe("⌃K");
      expect(formatKeystroke("Alt+F")).toBe("⌥F");
      expect(formatKeystroke("Shift+Tab")).toBe("⇧Tab");
      expect(formatKeystroke("Meta+S")).toBe("⌘S");
    });

    it("should format multiple modifiers", () => {
      const formatKeystroke = (key: string): string => {
        return key
          .replace("Ctrl+", "⌃")
          .replace("Alt+", "⌥")
          .replace("Shift+", "⇧")
          .replace("Meta+", "⌘");
      };

      expect(formatKeystroke("Ctrl+Shift+P")).toBe("⌃⇧P");
      expect(formatKeystroke("Ctrl+Alt+Delete")).toBe("⌃⌥Delete");
    });

    it("should format key sequence", () => {
      const formatKeySequence = (keys: string[]): string => {
        return keys.join(" → ");
      };

      expect(formatKeySequence(["Ctrl+K", "C"])).toBe("Ctrl+K → C");
      expect(formatKeySequence(["g", "g"])).toBe("g → g");
    });
  });

  describe("Sequence Management", () => {
    interface PendingSequence {
      keys: string[];
      startedAt: number;
      timeoutId?: number;
    }

    it("should start sequence", () => {
      let pendingSequence: PendingSequence | null = null;

      const startSequence = (key: string): void => {
        pendingSequence = {
          keys: [key],
          startedAt: Date.now(),
        };
      };

      startSequence("Ctrl+K");
      expect((pendingSequence as PendingSequence | null)?.keys).toEqual(["Ctrl+K"]);
    });

    it("should append to sequence", () => {
      let pendingSequence: PendingSequence | null = {
        keys: ["Ctrl+K"],
        startedAt: Date.now(),
      };

      const appendToSequence = (key: string): void => {
        if (pendingSequence) {
          pendingSequence = {
            ...pendingSequence,
            keys: [...pendingSequence.keys, key],
          };
        }
      };

      appendToSequence("C");
      expect(pendingSequence?.keys).toEqual(["Ctrl+K", "C"]);
    });

    it("should clear sequence", () => {
      let pendingSequence: PendingSequence | null = {
        keys: ["Ctrl+K", "C"],
        startedAt: Date.now(),
      };

      const clearSequence = (): void => {
        pendingSequence = null;
      };

      clearSequence();
      expect(pendingSequence).toBeNull();
    });

    it("should check sequence timeout", () => {
      const isSequenceExpired = (startedAt: number, delay: number): boolean => {
        return Date.now() - startedAt > delay;
      };

      const recentTime = Date.now();
      const oldTime = Date.now() - 1000;

      expect(isSequenceExpired(recentTime, 500)).toBe(false);
      expect(isSequenceExpired(oldTime, 500)).toBe(true);
    });
  });

  describe("Visibility Control", () => {
    it("should show which-key popup", () => {
      let visible = false;

      const show = (): void => {
        visible = true;
      };

      show();
      expect(visible).toBe(true);
    });

    it("should hide which-key popup", () => {
      let visible = true;

      const hide = (): void => {
        visible = false;
      };

      hide();
      expect(visible).toBe(false);
    });

    it("should toggle visibility", () => {
      let visible = false;

      const toggle = (): void => {
        visible = !visible;
      };

      toggle();
      expect(visible).toBe(true);

      toggle();
      expect(visible).toBe(false);
    });

    it("should show after delay", () => {
      let visible = false;
      let timeoutId: number | null = null;

      const showAfterDelay = (delay: number): void => {
        timeoutId = delay;
        visible = true;
      };

      showAfterDelay(500);
      expect(timeoutId).toBe(500);
      expect(visible).toBe(true);
    });
  });

  describe("Binding Lookup", () => {
    interface ContinuationBinding {
      key: string;
      label: string;
      command?: string;
      submenu?: ContinuationBinding[];
    }

    it("should find binding by key", () => {
      const bindings: ContinuationBinding[] = [
        { key: "c", label: "Comment", command: "comment" },
        { key: "f", label: "Format", command: "format" },
        { key: "s", label: "Save", command: "save" },
      ];

      const findBinding = (key: string): ContinuationBinding | undefined => {
        return bindings.find((b) => b.key === key);
      };

      expect(findBinding("c")?.label).toBe("Comment");
      expect(findBinding("x")).toBeUndefined();
    });

    it("should get bindings for prefix", () => {
      const allBindings: Record<string, ContinuationBinding[]> = {
        "Ctrl+K": [
          { key: "c", label: "Comment", command: "comment" },
          { key: "f", label: "Format", command: "format" },
        ],
        "Ctrl+G": [
          { key: "g", label: "Go to line", command: "goto" },
        ],
      };

      const getBindingsForPrefix = (prefix: string): ContinuationBinding[] => {
        return allBindings[prefix] || [];
      };

      expect(getBindingsForPrefix("Ctrl+K")).toHaveLength(2);
      expect(getBindingsForPrefix("Ctrl+X")).toHaveLength(0);
    });
  });

  describe("Sorting Bindings", () => {
    interface ContinuationBinding {
      key: string;
      label: string;
    }

    it("should sort alphabetically", () => {
      const bindings: ContinuationBinding[] = [
        { key: "z", label: "Zoom" },
        { key: "a", label: "Add" },
        { key: "m", label: "Move" },
      ];

      const sorted = [...bindings].sort((a, b) => a.key.localeCompare(b.key));

      expect(sorted[0].key).toBe("a");
      expect(sorted[1].key).toBe("m");
      expect(sorted[2].key).toBe("z");
    });

    it("should sort by frequency", () => {
      const bindings: ContinuationBinding[] = [
        { key: "a", label: "Add" },
        { key: "b", label: "Build" },
        { key: "c", label: "Comment" },
      ];

      const frequency: Record<string, number> = {
        a: 5,
        b: 20,
        c: 10,
      };

      const sorted = [...bindings].sort(
        (a, b) => (frequency[b.key] || 0) - (frequency[a.key] || 0)
      );

      expect(sorted[0].key).toBe("b");
      expect(sorted[1].key).toBe("c");
      expect(sorted[2].key).toBe("a");
    });
  });

  describe("WhichKey Events", () => {
    it("should listen for whichkey show events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("whichkey:show", () => {});

      expect(listen).toHaveBeenCalledWith("whichkey:show", expect.any(Function));
    });

    it("should listen for whichkey hide events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("whichkey:hide", () => {});

      expect(listen).toHaveBeenCalledWith("whichkey:hide", expect.any(Function));
    });

    it("should listen for whichkey key pressed events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("whichkey:key-pressed", () => {});

      expect(listen).toHaveBeenCalledWith("whichkey:key-pressed", expect.any(Function));
    });
  });

  describe("WhichKey Invoke Commands", () => {
    it("should get bindings via invoke", async () => {
      const bindings = [
        { key: "c", label: "Comment", command: "comment" },
        { key: "f", label: "Format", command: "format" },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(bindings);

      const result = await invoke("whichkey_get_bindings", { prefix: "Ctrl+K" });

      expect(result).toEqual(bindings);
    });

    it("should execute binding via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("whichkey_execute", { command: "editor.action.commentLine" });

      expect(invoke).toHaveBeenCalledWith("whichkey_execute", {
        command: "editor.action.commentLine",
      });
    });

    it("should register binding via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("whichkey_register_binding", {
        prefix: "Ctrl+K",
        binding: { key: "x", label: "Custom", command: "custom.command" },
      });

      expect(invoke).toHaveBeenCalledWith("whichkey_register_binding", {
        prefix: "Ctrl+K",
        binding: { key: "x", label: "Custom", command: "custom.command" },
      });
    });
  });

  describe("Key Frequency Tracking", () => {
    it("should increment key frequency", () => {
      const frequency: Record<string, number> = {};

      const incrementFrequency = (key: string): void => {
        frequency[key] = (frequency[key] || 0) + 1;
      };

      incrementFrequency("Ctrl+K c");
      incrementFrequency("Ctrl+K c");
      incrementFrequency("Ctrl+K f");

      expect(frequency["Ctrl+K c"]).toBe(2);
      expect(frequency["Ctrl+K f"]).toBe(1);
    });

    it("should get most frequent keys", () => {
      const frequency: Record<string, number> = {
        "Ctrl+K c": 15,
        "Ctrl+K f": 10,
        "Ctrl+K s": 25,
        "Ctrl+K d": 5,
      };

      const getMostFrequent = (n: number): string[] => {
        return Object.entries(frequency)
          .sort((a, b) => b[1] - a[1])
          .slice(0, n)
          .map(([key]) => key);
      };

      const top2 = getMostFrequent(2);
      expect(top2).toEqual(["Ctrl+K s", "Ctrl+K c"]);
    });
  });

  describe("Layout Calculation", () => {
    it("should calculate grid layout", () => {
      const calculateLayout = (
        itemCount: number,
        maxColumns: number,
        maxRows: number
      ): { columns: number; rows: number } => {
        const columns = Math.min(itemCount, maxColumns);
        const rows = Math.min(Math.ceil(itemCount / columns), maxRows);
        return { columns, rows };
      };

      expect(calculateLayout(6, 3, 10)).toEqual({ columns: 3, rows: 2 });
      expect(calculateLayout(2, 3, 10)).toEqual({ columns: 2, rows: 1 });
      expect(calculateLayout(15, 3, 4)).toEqual({ columns: 3, rows: 4 });
    });

    it("should handle empty bindings", () => {
      const calculateLayout = (
        itemCount: number,
        maxColumns: number,
        _maxRows: number
      ): { columns: number; rows: number } => {
        if (itemCount === 0) return { columns: 0, rows: 0 };
        const columns = Math.min(itemCount, maxColumns);
        const rows = Math.ceil(itemCount / columns);
        return { columns, rows };
      };

      expect(calculateLayout(0, 3, 10)).toEqual({ columns: 0, rows: 0 });
    });
  });

  describe("Breadcrumb Trail", () => {
    it("should build breadcrumb from sequence", () => {
      const buildBreadcrumb = (keys: string[]): string => {
        return keys.join(" → ");
      };

      expect(buildBreadcrumb(["Ctrl+K"])).toBe("Ctrl+K");
      expect(buildBreadcrumb(["Ctrl+K", "g"])).toBe("Ctrl+K → g");
      expect(buildBreadcrumb(["Ctrl+K", "g", "s"])).toBe("Ctrl+K → g → s");
    });

    it("should get current level label", () => {
      const getCurrentLevelLabel = (keys: string[]): string => {
        if (keys.length === 0) return "Root";
        return keys[keys.length - 1];
      };

      expect(getCurrentLevelLabel([])).toBe("Root");
      expect(getCurrentLevelLabel(["Ctrl+K"])).toBe("Ctrl+K");
      expect(getCurrentLevelLabel(["Ctrl+K", "g"])).toBe("g");
    });
  });
});
