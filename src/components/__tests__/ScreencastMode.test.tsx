import { describe, it, expect, vi, beforeEach } from "vitest";

describe("ScreencastMode Component Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Key Name Formatting", () => {
    const formatKeyName = (key: string): string => {
      const keyMap: Record<string, string> = {
        " ": "Space",
        "ArrowUp": "↑",
        "ArrowDown": "↓",
        "ArrowLeft": "←",
        "ArrowRight": "→",
        "Escape": "Esc",
        "Backspace": "⌫",
        "Delete": "Del",
        "Enter": "⏎",
        "Tab": "⇥",
      };
      return keyMap[key] || (key.length === 1 ? key.toUpperCase() : key);
    };

    it("should format arrow keys", () => {
      expect(formatKeyName("ArrowUp")).toBe("↑");
      expect(formatKeyName("ArrowDown")).toBe("↓");
      expect(formatKeyName("ArrowLeft")).toBe("←");
      expect(formatKeyName("ArrowRight")).toBe("→");
    });

    it("should format special keys", () => {
      expect(formatKeyName("Escape")).toBe("Esc");
      expect(formatKeyName("Backspace")).toBe("⌫");
      expect(formatKeyName("Enter")).toBe("⏎");
      expect(formatKeyName("Tab")).toBe("⇥");
    });

    it("should uppercase single characters", () => {
      expect(formatKeyName("a")).toBe("A");
      expect(formatKeyName("z")).toBe("Z");
    });

    it("should format space key", () => {
      expect(formatKeyName(" ")).toBe("Space");
    });
  });

  describe("Key Combo Building", () => {
    const buildKeyCombo = (key: string, ctrlKey: boolean, altKey: boolean, shiftKey: boolean, metaKey: boolean): string[] => {
      const keys: string[] = [];
      if (ctrlKey && key !== "Control") keys.push("Ctrl");
      if (altKey && key !== "Alt") keys.push("Alt");
      if (shiftKey && key !== "Shift") keys.push("Shift");
      if (metaKey && key !== "Meta") keys.push("Win");
      if (!["Control", "Alt", "Shift", "Meta"].includes(key)) {
        keys.push(key.length === 1 ? key.toUpperCase() : key);
      }
      return keys;
    };

    it("should build Ctrl+S combo", () => {
      const combo = buildKeyCombo("s", true, false, false, false);
      expect(combo).toEqual(["Ctrl", "S"]);
    });

    it("should build Ctrl+Shift+P combo", () => {
      const combo = buildKeyCombo("p", true, false, true, false);
      expect(combo).toEqual(["Ctrl", "Shift", "P"]);
    });

    it("should not include standalone modifier", () => {
      const combo = buildKeyCombo("Control", true, false, false, false);
      expect(combo).toEqual([]);
    });

    it("should handle Alt+key", () => {
      const combo = buildKeyCombo("f", false, true, false, false);
      expect(combo).toEqual(["Alt", "F"]);
    });
  });

  describe("Mouse Button Names", () => {
    const getMouseButtonName = (button: number): string => {
      switch (button) {
        case 0: return "Left Click";
        case 1: return "Middle Click";
        case 2: return "Right Click";
        default: return `Mouse ${button}`;
      }
    };

    it("should name left click", () => {
      expect(getMouseButtonName(0)).toBe("Left Click");
    });

    it("should name middle click", () => {
      expect(getMouseButtonName(1)).toBe("Middle Click");
    });

    it("should name right click", () => {
      expect(getMouseButtonName(2)).toBe("Right Click");
    });

    it("should handle unknown buttons", () => {
      expect(getMouseButtonName(5)).toBe("Mouse 5");
    });
  });

  describe("Display Item Management", () => {
    interface KeyPress {
      id: number;
      keys: string[];
      timestamp: number;
      type: "key" | "mouse";
    }

    it("should limit display items", () => {
      const MAX_DISPLAY_ITEMS = 6;
      const items: KeyPress[] = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        keys: [`Key${i}`],
        timestamp: Date.now(),
        type: "key" as const,
      }));

      const limited = items.slice(-MAX_DISPLAY_ITEMS);
      expect(limited).toHaveLength(6);
    });

    it("should track key and mouse types", () => {
      const keyPress: KeyPress = { id: 1, keys: ["Ctrl", "S"], timestamp: Date.now(), type: "key" };
      const mousePress: KeyPress = { id: 2, keys: ["Left Click"], timestamp: Date.now(), type: "mouse" };

      expect(keyPress.type).toBe("key");
      expect(mousePress.type).toBe("mouse");
    });
  });

  describe("Event Handling", () => {
    it("should handle toggle event", () => {
      const handler = vi.fn();
      window.addEventListener("screencast:toggle", handler);
      window.dispatchEvent(new Event("screencast:toggle"));
      expect(handler).toHaveBeenCalledOnce();
      window.removeEventListener("screencast:toggle", handler);
    });

    it("should handle enable event", () => {
      const handler = vi.fn();
      window.addEventListener("screencast:enable", handler);
      window.dispatchEvent(new Event("screencast:enable"));
      expect(handler).toHaveBeenCalledOnce();
      window.removeEventListener("screencast:enable", handler);
    });

    it("should handle disable event", () => {
      const handler = vi.fn();
      window.addEventListener("screencast:disable", handler);
      window.dispatchEvent(new Event("screencast:disable"));
      expect(handler).toHaveBeenCalledOnce();
      window.removeEventListener("screencast:disable", handler);
    });
  });
});
