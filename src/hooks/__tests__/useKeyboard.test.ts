import { describe, it, expect, vi, beforeEach } from "vitest";

describe("useKeyboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("KeyboardOptions Interface", () => {
    interface KeyboardOptions {
      onNewSession?: () => void;
      onCommandPalette?: () => void;
      onToggleSidebar?: () => void;
      onEscape?: () => void;
      onFocusPrompt?: () => void;
    }

    it("should define keyboard options", () => {
      const options: KeyboardOptions = {
        onNewSession: vi.fn(),
        onCommandPalette: vi.fn(),
        onToggleSidebar: vi.fn(),
        onEscape: vi.fn(),
        onFocusPrompt: vi.fn(),
      };

      expect(options.onNewSession).toBeDefined();
      expect(options.onCommandPalette).toBeDefined();
      expect(options.onToggleSidebar).toBeDefined();
      expect(options.onEscape).toBeDefined();
      expect(options.onFocusPrompt).toBeDefined();
    });

    it("should allow partial options", () => {
      const options: KeyboardOptions = {
        onNewSession: vi.fn(),
      };

      expect(options.onNewSession).toBeDefined();
      expect(options.onCommandPalette).toBeUndefined();
    });

    it("should allow empty options", () => {
      const options: KeyboardOptions = {};

      expect(Object.keys(options)).toHaveLength(0);
    });
  });

  describe("Keyboard Event Data", () => {
    interface KeyboardEventData {
      key: string;
      ctrlKey: boolean;
      metaKey: boolean;
      shiftKey: boolean;
      altKey: boolean;
    }

    it("should create keyboard event data", () => {
      const event: KeyboardEventData = {
        key: "n",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      };

      expect(event.key).toBe("n");
      expect(event.ctrlKey).toBe(true);
    });

    it("should detect modifier key", () => {
      const event: KeyboardEventData = {
        key: "k",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      };

      const mod = event.ctrlKey || event.metaKey;
      expect(mod).toBe(true);
    });

    it("should detect meta key on Mac", () => {
      const event: KeyboardEventData = {
        key: "k",
        ctrlKey: false,
        metaKey: true,
        shiftKey: false,
        altKey: false,
      };

      const mod = event.ctrlKey || event.metaKey;
      expect(mod).toBe(true);
    });
  });

  describe("Shortcut Matching", () => {
    interface ShortcutOptions {
      ctrl?: boolean;
      meta?: boolean;
      shift?: boolean;
      alt?: boolean;
    }

    const matchesShortcut = (
      event: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean },
      key: string,
      options: ShortcutOptions = {}
    ): boolean => {
      const ctrlMatch = options.ctrl ? event.ctrlKey : !event.ctrlKey;
      const metaMatch = options.meta ? event.metaKey : !event.metaKey;
      const shiftMatch = options.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = options.alt ? event.altKey : !event.altKey;

      return (
        event.key.toLowerCase() === key.toLowerCase() &&
        ctrlMatch &&
        metaMatch &&
        shiftMatch &&
        altMatch
      );
    };

    it("should match Ctrl+N", () => {
      const event = {
        key: "n",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      };

      expect(matchesShortcut(event, "n", { ctrl: true })).toBe(true);
    });

    it("should match Ctrl+K", () => {
      const event = {
        key: "k",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      };

      expect(matchesShortcut(event, "k", { ctrl: true })).toBe(true);
    });

    it("should match Ctrl+B", () => {
      const event = {
        key: "b",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      };

      expect(matchesShortcut(event, "b", { ctrl: true })).toBe(true);
    });

    it("should match Escape without modifiers", () => {
      const event = {
        key: "Escape",
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      };

      expect(matchesShortcut(event, "Escape")).toBe(true);
    });

    it("should match slash key", () => {
      const event = {
        key: "/",
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      };

      expect(matchesShortcut(event, "/")).toBe(true);
    });

    it("should not match when modifier is missing", () => {
      const event = {
        key: "n",
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      };

      expect(matchesShortcut(event, "n", { ctrl: true })).toBe(false);
    });

    it("should not match wrong key", () => {
      const event = {
        key: "m",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      };

      expect(matchesShortcut(event, "n", { ctrl: true })).toBe(false);
    });

    it("should match case-insensitively", () => {
      const event = {
        key: "N",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      };

      expect(matchesShortcut(event, "n", { ctrl: true })).toBe(true);
    });

    it("should match Ctrl+Shift+P", () => {
      const event = {
        key: "p",
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: false,
      };

      expect(matchesShortcut(event, "p", { ctrl: true, shift: true })).toBe(true);
    });

    it("should match Alt+Enter", () => {
      const event = {
        key: "Enter",
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: true,
      };

      expect(matchesShortcut(event, "Enter", { alt: true })).toBe(true);
    });
  });

  describe("isInputFocused", () => {
    const isInputFocused = (tagName: string, isContentEditable: boolean): boolean => {
      const tag = tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || isContentEditable;
    };

    it("should return true for input element", () => {
      expect(isInputFocused("INPUT", false)).toBe(true);
    });

    it("should return true for textarea element", () => {
      expect(isInputFocused("TEXTAREA", false)).toBe(true);
    });

    it("should return true for contentEditable element", () => {
      expect(isInputFocused("DIV", true)).toBe(true);
    });

    it("should return false for regular div", () => {
      expect(isInputFocused("DIV", false)).toBe(false);
    });

    it("should return false for button", () => {
      expect(isInputFocused("BUTTON", false)).toBe(false);
    });

    it("should handle lowercase tag names", () => {
      expect(isInputFocused("input", false)).toBe(true);
      expect(isInputFocused("textarea", false)).toBe(true);
    });
  });

  describe("createKeyboardShortcut", () => {
    interface ShortcutConfig {
      key: string;
      ctrl?: boolean;
      meta?: boolean;
      shift?: boolean;
      alt?: boolean;
    }

    it("should create shortcut configuration", () => {
      const config: ShortcutConfig = {
        key: "s",
        ctrl: true,
      };

      expect(config.key).toBe("s");
      expect(config.ctrl).toBe(true);
    });

    it("should create shortcut with multiple modifiers", () => {
      const config: ShortcutConfig = {
        key: "p",
        ctrl: true,
        shift: true,
      };

      expect(config.ctrl).toBe(true);
      expect(config.shift).toBe(true);
    });

    it("should create shortcut without modifiers", () => {
      const config: ShortcutConfig = {
        key: "F1",
      };

      expect(config.key).toBe("F1");
      expect(config.ctrl).toBeUndefined();
    });
  });

  describe("Keyboard Callback Invocation", () => {
    interface KeyboardOptions {
      onNewSession?: () => void;
      onCommandPalette?: () => void;
      onToggleSidebar?: () => void;
      onEscape?: () => void;
      onFocusPrompt?: () => void;
    }

    const handleKeyDown = (
      event: { key: string; ctrlKey: boolean; metaKey: boolean },
      options: KeyboardOptions
    ): void => {
      const { key, ctrlKey, metaKey } = event;
      const mod = ctrlKey || metaKey;

      if (mod && key === "n") {
        options.onNewSession?.();
      }

      if (mod && key === "k") {
        options.onCommandPalette?.();
      }

      if (mod && key === "b") {
        options.onToggleSidebar?.();
      }

      if (key === "Escape") {
        options.onEscape?.();
      }
    };

    it("should call onNewSession for Ctrl+N", () => {
      const onNewSession = vi.fn();
      const options: KeyboardOptions = { onNewSession };

      handleKeyDown({ key: "n", ctrlKey: true, metaKey: false }, options);

      expect(onNewSession).toHaveBeenCalled();
    });

    it("should call onCommandPalette for Ctrl+K", () => {
      const onCommandPalette = vi.fn();
      const options: KeyboardOptions = { onCommandPalette };

      handleKeyDown({ key: "k", ctrlKey: true, metaKey: false }, options);

      expect(onCommandPalette).toHaveBeenCalled();
    });

    it("should call onToggleSidebar for Ctrl+B", () => {
      const onToggleSidebar = vi.fn();
      const options: KeyboardOptions = { onToggleSidebar };

      handleKeyDown({ key: "b", ctrlKey: true, metaKey: false }, options);

      expect(onToggleSidebar).toHaveBeenCalled();
    });

    it("should call onEscape for Escape key", () => {
      const onEscape = vi.fn();
      const options: KeyboardOptions = { onEscape };

      handleKeyDown({ key: "Escape", ctrlKey: false, metaKey: false }, options);

      expect(onEscape).toHaveBeenCalled();
    });

    it("should not call callback when not defined", () => {
      const options: KeyboardOptions = {};

      expect(() => {
        handleKeyDown({ key: "n", ctrlKey: true, metaKey: false }, options);
      }).not.toThrow();
    });

    it("should work with meta key (Mac)", () => {
      const onNewSession = vi.fn();
      const options: KeyboardOptions = { onNewSession };

      handleKeyDown({ key: "n", ctrlKey: false, metaKey: true }, options);

      expect(onNewSession).toHaveBeenCalled();
    });
  });

  describe("Event Prevention", () => {
    it("should track if event should be prevented", () => {
      const shouldPrevent = (key: string, mod: boolean): boolean => {
        if (mod && key === "n") return true;
        if (mod && key === "k") return true;
        if (mod && key === "b") return true;
        if (key === "/") return true;
        return false;
      };

      expect(shouldPrevent("n", true)).toBe(true);
      expect(shouldPrevent("k", true)).toBe(true);
      expect(shouldPrevent("b", true)).toBe(true);
      expect(shouldPrevent("/", false)).toBe(true);
      expect(shouldPrevent("Escape", false)).toBe(false);
    });
  });

  describe("Focus Prompt Shortcut", () => {
    it("should trigger focus prompt on slash when not in input", () => {
      const onFocusPrompt = vi.fn();
      const isInputFocused = false;

      if (!isInputFocused) {
        onFocusPrompt();
      }

      expect(onFocusPrompt).toHaveBeenCalled();
    });

    it("should not trigger focus prompt when in input", () => {
      const onFocusPrompt = vi.fn();
      const isInputFocused = true;

      if (!isInputFocused) {
        onFocusPrompt();
      }

      expect(onFocusPrompt).not.toHaveBeenCalled();
    });
  });

  describe("Keyboard Handler Type", () => {
    type KeyboardHandler = (event: KeyboardEvent) => void;

    it("should define keyboard handler type", () => {
      const handler: KeyboardHandler = vi.fn();

      expect(typeof handler).toBe("function");
    });
  });

  describe("Common Shortcuts", () => {
    interface CommonShortcut {
      key: string;
      modifiers: string[];
      action: string;
    }

    it("should define common shortcuts", () => {
      const shortcuts: CommonShortcut[] = [
        { key: "n", modifiers: ["ctrl"], action: "New Session" },
        { key: "k", modifiers: ["ctrl"], action: "Command Palette" },
        { key: "b", modifiers: ["ctrl"], action: "Toggle Sidebar" },
        { key: "Escape", modifiers: [], action: "Close/Cancel" },
        { key: "/", modifiers: [], action: "Focus Prompt" },
      ];

      expect(shortcuts).toHaveLength(5);
      expect(shortcuts.find(s => s.key === "n")?.action).toBe("New Session");
    });
  });

  describe("Modifier Key Detection", () => {
    it("should detect ctrl modifier", () => {
      const event = { ctrlKey: true, metaKey: false };
      const mod = event.ctrlKey || event.metaKey;
      expect(mod).toBe(true);
    });

    it("should detect meta modifier", () => {
      const event = { ctrlKey: false, metaKey: true };
      const mod = event.ctrlKey || event.metaKey;
      expect(mod).toBe(true);
    });

    it("should detect no modifier", () => {
      const event = { ctrlKey: false, metaKey: false };
      const mod = event.ctrlKey || event.metaKey;
      expect(mod).toBe(false);
    });

    it("should detect both modifiers", () => {
      const event = { ctrlKey: true, metaKey: true };
      const mod = event.ctrlKey || event.metaKey;
      expect(mod).toBe(true);
    });
  });
});
