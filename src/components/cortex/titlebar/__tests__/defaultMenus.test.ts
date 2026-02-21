import { describe, it, expect, vi } from "vitest";
import { MENU_LABELS, DEFAULT_MENUS } from "../defaultMenus";
import type { MenuItem } from "../defaultMenus";

describe("defaultMenus", () => {
  describe("MENU_LABELS", () => {
    it("should export an array of menu label strings", () => {
      expect(Array.isArray(MENU_LABELS)).toBe(true);
      expect(MENU_LABELS.length).toBeGreaterThan(0);
    });

    it("should contain the expected menu labels in order", () => {
      expect(MENU_LABELS).toEqual([
        "File", "Edit", "Selection", "View", "Go",
        "Terminal", "Help",
      ]);
    });

    it("should have exactly 7 menu labels", () => {
      expect(MENU_LABELS).toHaveLength(7);
    });

    it("should contain only string values", () => {
      MENU_LABELS.forEach((label) => {
        expect(typeof label).toBe("string");
      });
    });
  });

  describe("DEFAULT_MENUS", () => {
    it("should be a record of string keys to MenuItem arrays", () => {
      expect(typeof DEFAULT_MENUS).toBe("object");
      Object.values(DEFAULT_MENUS).forEach((items) => {
        expect(Array.isArray(items)).toBe(true);
      });
    });

    it("should have entries for all MENU_LABELS", () => {
      MENU_LABELS.forEach((label) => {
        expect(DEFAULT_MENUS).toHaveProperty(label);
        expect(DEFAULT_MENUS[label].length).toBeGreaterThan(0);
      });
    });

    it("should have additional menu entries beyond MENU_LABELS (Run, Git, Developer)", () => {
      expect(DEFAULT_MENUS).toHaveProperty("Run");
      expect(DEFAULT_MENUS).toHaveProperty("Git");
      expect(DEFAULT_MENUS).toHaveProperty("Developer");
    });

    it("should have 10 total menu categories", () => {
      expect(Object.keys(DEFAULT_MENUS)).toHaveLength(10);
    });
  });

  describe("MenuItem structure", () => {
    it("every item should have a label property", () => {
      Object.values(DEFAULT_MENUS).forEach((items) => {
        items.forEach((item) => {
          expect(item).toHaveProperty("label");
          expect(typeof item.label).toBe("string");
        });
      });
    });

    it("non-separator items should have an action function", () => {
      Object.values(DEFAULT_MENUS).forEach((items) => {
        items.forEach((item) => {
          if (!item.separator) {
            expect(typeof item.action).toBe("function");
          }
        });
      });
    });

    it("separator items should have separator: true and empty label", () => {
      Object.values(DEFAULT_MENUS).forEach((items) => {
        items.forEach((item) => {
          if (item.separator) {
            expect(item.separator).toBe(true);
            expect(item.label).toBe("");
          }
        });
      });
    });

    it("shortcut should be a string when present", () => {
      Object.values(DEFAULT_MENUS).forEach((items) => {
        items.forEach((item) => {
          if (item.shortcut !== undefined) {
            expect(typeof item.shortcut).toBe("string");
          }
        });
      });
    });
  });

  describe("File menu", () => {
    it("should contain New File, Open File, Save, Close items", () => {
      const labels = DEFAULT_MENUS.File.filter((i) => !i.separator).map((i) => i.label);
      expect(labels).toContain("New File");
      expect(labels).toContain("Open File...");
      expect(labels).toContain("Save");
      expect(labels).toContain("Close");
    });

    it("should have separators between groups", () => {
      const separators = DEFAULT_MENUS.File.filter((i) => i.separator);
      expect(separators.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Edit menu", () => {
    it("should contain Undo, Redo, Cut, Copy, Paste, Find, Replace items", () => {
      const labels = DEFAULT_MENUS.Edit.filter((i) => !i.separator).map((i) => i.label);
      expect(labels).toContain("Undo");
      expect(labels).toContain("Redo");
      expect(labels).toContain("Cut");
      expect(labels).toContain("Copy");
      expect(labels).toContain("Paste");
      expect(labels).toContain("Find");
      expect(labels).toContain("Replace");
    });
  });

  describe("Help menu", () => {
    it("should contain Welcome, Documentation, About items", () => {
      const labels = DEFAULT_MENUS.Help.filter((i) => !i.separator).map((i) => i.label);
      expect(labels).toContain("Welcome");
      expect(labels).toContain("Documentation");
      expect(labels).toContain("About");
    });
  });

  describe("Menu item actions", () => {
    it("should dispatch CustomEvent on window when action is called", () => {
      const listener = vi.fn();
      window.addEventListener("file:new", listener);

      const newFileItem = DEFAULT_MENUS.File.find((i) => i.label === "New File");
      expect(newFileItem).toBeDefined();
      expect(newFileItem!.action).toBeDefined();
      newFileItem!.action!();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toBeInstanceOf(CustomEvent);

      window.removeEventListener("file:new", listener);
    });

    it("should dispatch correct event names for different actions", () => {
      const events: string[] = [];
      const captureEvent = (name: string) => {
        const fn = () => events.push(name);
        window.addEventListener(name, fn);
        return () => window.removeEventListener(name, fn);
      };

      const cleanup1 = captureEvent("edit:undo");
      const cleanup2 = captureEvent("terminal:new");

      const undoItem = DEFAULT_MENUS.Edit.find((i) => i.label === "Undo");
      undoItem!.action!();

      const newTermItem = DEFAULT_MENUS.Terminal.find((i) => i.label === "New Terminal");
      newTermItem!.action!();

      expect(events).toContain("edit:undo");
      expect(events).toContain("terminal:new");

      cleanup1();
      cleanup2();
    });
  });

  describe("MenuItem type", () => {
    it("should satisfy the MenuItem interface", () => {
      const item: MenuItem = {
        label: "Test",
        shortcut: "⌘T",
        action: () => {},
        separator: false,
      };
      expect(item.label).toBe("Test");
      expect(item.shortcut).toBe("⌘T");
      expect(typeof item.action).toBe("function");
      expect(item.separator).toBe(false);
    });

    it("should allow minimal MenuItem with just label", () => {
      const item: MenuItem = { label: "Minimal" };
      expect(item.label).toBe("Minimal");
      expect(item.shortcut).toBeUndefined();
      expect(item.action).toBeUndefined();
      expect(item.separator).toBeUndefined();
    });
  });
});
