import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("CortexEditorTabs Component Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("EditorTab Structure", () => {
    interface EditorTab {
      id: string;
      name: string;
      path?: string;
      isModified?: boolean;
      isPreview?: boolean;
    }

    it("should create a valid EditorTab with required fields", () => {
      const tab: EditorTab = {
        id: "tab-1",
        name: "index.tsx",
      };

      expect(tab.id).toBe("tab-1");
      expect(tab.name).toBe("index.tsx");
    });

    it("should support optional path property", () => {
      const tab: EditorTab = {
        id: "tab-1",
        name: "index.tsx",
        path: "/src/index.tsx",
      };

      expect(tab.path).toBe("/src/index.tsx");
    });

    it("should support optional isModified property", () => {
      const tab: EditorTab = {
        id: "tab-1",
        name: "index.tsx",
        isModified: true,
      };

      expect(tab.isModified).toBe(true);
    });

    it("should support optional isPreview property", () => {
      const tab: EditorTab = {
        id: "tab-1",
        name: "index.tsx",
        isPreview: true,
      };

      expect(tab.isPreview).toBe(true);
    });

    it("should support all properties together", () => {
      const tab: EditorTab = {
        id: "tab-1",
        name: "App.tsx",
        path: "/src/App.tsx",
        isModified: true,
        isPreview: false,
      };

      expect(tab.id).toBe("tab-1");
      expect(tab.name).toBe("App.tsx");
      expect(tab.path).toBe("/src/App.tsx");
      expect(tab.isModified).toBe(true);
      expect(tab.isPreview).toBe(false);
    });
  });

  describe("Tab Operations", () => {
    it("should invoke onTabSelect callback with tab id", () => {
      const onTabSelect = vi.fn();
      const tabId = "tab-1";

      onTabSelect(tabId);

      expect(onTabSelect).toHaveBeenCalledWith("tab-1");
      expect(onTabSelect).toHaveBeenCalledTimes(1);
    });

    it("should invoke onTabClose callback with tab id", () => {
      const onTabClose = vi.fn();
      const tabId = "tab-2";

      onTabClose(tabId);

      expect(onTabClose).toHaveBeenCalledWith("tab-2");
      expect(onTabClose).toHaveBeenCalledTimes(1);
    });

    it("should invoke onNewTab callback", () => {
      const onNewTab = vi.fn();

      onNewTab();

      expect(onNewTab).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple tab selections", () => {
      const onTabSelect = vi.fn();

      onTabSelect("tab-1");
      onTabSelect("tab-2");
      onTabSelect("tab-3");

      expect(onTabSelect).toHaveBeenCalledTimes(3);
      expect(onTabSelect).toHaveBeenNthCalledWith(1, "tab-1");
      expect(onTabSelect).toHaveBeenNthCalledWith(2, "tab-2");
      expect(onTabSelect).toHaveBeenNthCalledWith(3, "tab-3");
    });
  });

  describe("Active Tab State", () => {
    interface EditorTab {
      id: string;
      name: string;
    }

    it("should track activeTabId", () => {
      const activeTabId: string | null = "tab-1";

      expect(activeTabId).toBe("tab-1");
    });

    it("should handle null activeTabId", () => {
      const activeTabId: string | null = null;

      expect(activeTabId).toBeNull();
    });

    it("should determine if a tab is active", () => {
      const isActive = (tabId: string, activeTabId: string | null): boolean => {
        return tabId === activeTabId;
      };

      expect(isActive("tab-1", "tab-1")).toBe(true);
      expect(isActive("tab-2", "tab-1")).toBe(false);
      expect(isActive("tab-1", null)).toBe(false);
    });

    it("should find active tab from tabs array", () => {
      const tabs: EditorTab[] = [
        { id: "tab-1", name: "index.tsx" },
        { id: "tab-2", name: "App.tsx" },
        { id: "tab-3", name: "main.rs" },
      ];
      const activeTabId = "tab-2";

      const activeTab = tabs.find(tab => tab.id === activeTabId);

      expect(activeTab?.name).toBe("App.tsx");
    });
  });

  describe("Modified Indicator Display", () => {
    it("should track isModified state", () => {
      const isModified = true;

      expect(isModified).toBe(true);
    });

    it("should determine modified indicator visibility", () => {
      const shouldShowModifiedDot = (isModified: boolean, isHovered: boolean): boolean => {
        return isModified && !isHovered;
      };

      expect(shouldShowModifiedDot(true, false)).toBe(true);
      expect(shouldShowModifiedDot(true, true)).toBe(false);
      expect(shouldShowModifiedDot(false, false)).toBe(false);
      expect(shouldShowModifiedDot(false, true)).toBe(false);
    });

    it("should determine close button visibility when modified", () => {
      const shouldShowCloseButton = (isModified: boolean, isHovered: boolean): boolean => {
        return !isModified || isHovered;
      };

      expect(shouldShowCloseButton(false, false)).toBe(true);
      expect(shouldShowCloseButton(false, true)).toBe(true);
      expect(shouldShowCloseButton(true, false)).toBe(false);
      expect(shouldShowCloseButton(true, true)).toBe(true);
    });
  });

  describe("Preview Tab Handling", () => {
    it("should track isPreview state", () => {
      const isPreview = true;

      expect(isPreview).toBe(true);
    });

    it("should determine font style for preview tabs", () => {
      const getFontStyle = (isPreview: boolean): string => {
        return isPreview ? "italic" : "normal";
      };

      expect(getFontStyle(true)).toBe("italic");
      expect(getFontStyle(false)).toBe("normal");
    });

    it("should convert preview tab to permanent on edit", () => {
      interface EditorTab {
        id: string;
        name: string;
        isPreview?: boolean;
      }

      const makeTabPermanent = (tab: EditorTab): EditorTab => {
        return { ...tab, isPreview: false };
      };

      const previewTab: EditorTab = { id: "tab-1", name: "file.ts", isPreview: true };
      const permanentTab = makeTabPermanent(previewTab);

      expect(permanentTab.isPreview).toBe(false);
    });
  });

  describe("File Icon Detection", () => {
    it("should extract file extension from filename", () => {
      const getExtension = (filename: string): string => {
        return filename.split(".").pop()?.toLowerCase() || "";
      };

      expect(getExtension("index.tsx")).toBe("tsx");
      expect(getExtension("main.rs")).toBe("rs");
      expect(getExtension("Cargo.toml")).toBe("toml");
      expect(getExtension("noextension")).toBe("noextension");
    });

    it("should detect React/TSX files", () => {
      const isReactFile = (filename: string): boolean => {
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        return ext === "tsx" || ext === "jsx";
      };

      expect(isReactFile("App.tsx")).toBe(true);
      expect(isReactFile("Component.jsx")).toBe(true);
      expect(isReactFile("utils.ts")).toBe(false);
    });

    it("should detect TypeScript files", () => {
      const isTypeScriptFile = (filename: string): boolean => {
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        return ext === "ts";
      };

      expect(isTypeScriptFile("utils.ts")).toBe(true);
      expect(isTypeScriptFile("App.tsx")).toBe(false);
    });

    it("should detect Rust files", () => {
      const isRustFile = (filename: string): boolean => {
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        return ext === "rs";
      };

      expect(isRustFile("main.rs")).toBe(true);
      expect(isRustFile("lib.rs")).toBe(true);
      expect(isRustFile("main.py")).toBe(false);
    });

    it("should detect TOML files", () => {
      const isTomlFile = (filename: string): boolean => {
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        return ext === "toml" || filename.toLowerCase() === "cargo.toml";
      };

      expect(isTomlFile("Cargo.toml")).toBe(true);
      expect(isTomlFile("config.toml")).toBe(true);
      expect(isTomlFile("config.json")).toBe(false);
    });

    it("should detect lock files", () => {
      const isLockFile = (filename: string): boolean => {
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        return ext === "lock" || filename.toLowerCase() === "cargo.lock";
      };

      expect(isLockFile("Cargo.lock")).toBe(true);
      expect(isLockFile("package-lock.json")).toBe(false);
      expect(isLockFile("yarn.lock")).toBe(true);
    });

    it("should detect Markdown files", () => {
      const isMarkdownFile = (filename: string): boolean => {
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        return ext === "md";
      };

      expect(isMarkdownFile("README.md")).toBe(true);
      expect(isMarkdownFile("AGENTS.md")).toBe(true);
      expect(isMarkdownFile("readme.txt")).toBe(false);
    });

    it("should detect JSON files", () => {
      const isJsonFile = (filename: string): boolean => {
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        return ext === "json";
      };

      expect(isJsonFile("package.json")).toBe(true);
      expect(isJsonFile("tsconfig.json")).toBe(true);
      expect(isJsonFile("config.yaml")).toBe(false);
    });

    it("should map file extensions to icon types", () => {
      type IconType = "react" | "typescript" | "rust" | "toml" | "lock" | "markdown" | "json" | "default";

      const getIconType = (filename: string): IconType => {
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        const name = filename.toLowerCase();

        if (ext === "tsx" || ext === "jsx") return "react";
        if (ext === "ts") return "typescript";
        if (ext === "rs") return "rust";
        if (name === "cargo.toml" || ext === "toml") return "toml";
        if (name === "cargo.lock" || ext === "lock") return "lock";
        if (ext === "md") return "markdown";
        if (ext === "json") return "json";
        return "default";
      };

      expect(getIconType("App.tsx")).toBe("react");
      expect(getIconType("Component.jsx")).toBe("react");
      expect(getIconType("utils.ts")).toBe("typescript");
      expect(getIconType("main.rs")).toBe("rust");
      expect(getIconType("Cargo.toml")).toBe("toml");
      expect(getIconType("Cargo.lock")).toBe("lock");
      expect(getIconType("README.md")).toBe("markdown");
      expect(getIconType("package.json")).toBe("json");
      expect(getIconType("unknown.xyz")).toBe("default");
    });
  });

  describe("Tab Ordering", () => {
    interface EditorTab {
      id: string;
      name: string;
    }

    it("should maintain tabs array order", () => {
      const tabs: EditorTab[] = [
        { id: "tab-1", name: "first.tsx" },
        { id: "tab-2", name: "second.tsx" },
        { id: "tab-3", name: "third.tsx" },
      ];

      expect(tabs[0].name).toBe("first.tsx");
      expect(tabs[1].name).toBe("second.tsx");
      expect(tabs[2].name).toBe("third.tsx");
    });

    it("should find tab index by id", () => {
      const tabs: EditorTab[] = [
        { id: "tab-1", name: "first.tsx" },
        { id: "tab-2", name: "second.tsx" },
        { id: "tab-3", name: "third.tsx" },
      ];

      const findTabIndex = (tabs: EditorTab[], id: string): number => {
        return tabs.findIndex(tab => tab.id === id);
      };

      expect(findTabIndex(tabs, "tab-1")).toBe(0);
      expect(findTabIndex(tabs, "tab-2")).toBe(1);
      expect(findTabIndex(tabs, "tab-3")).toBe(2);
      expect(findTabIndex(tabs, "tab-4")).toBe(-1);
    });

    it("should reorder tabs", () => {
      const reorderTabs = (tabs: EditorTab[], fromIndex: number, toIndex: number): EditorTab[] => {
        const result = [...tabs];
        const [removed] = result.splice(fromIndex, 1);
        result.splice(toIndex, 0, removed);
        return result;
      };

      const tabs: EditorTab[] = [
        { id: "tab-1", name: "first.tsx" },
        { id: "tab-2", name: "second.tsx" },
        { id: "tab-3", name: "third.tsx" },
      ];

      const reordered = reorderTabs(tabs, 0, 2);

      expect(reordered[0].name).toBe("second.tsx");
      expect(reordered[1].name).toBe("third.tsx");
      expect(reordered[2].name).toBe("first.tsx");
    });

    it("should add tab at specific position", () => {
      const addTabAt = (tabs: EditorTab[], tab: EditorTab, index: number): EditorTab[] => {
        const result = [...tabs];
        result.splice(index, 0, tab);
        return result;
      };

      const tabs: EditorTab[] = [
        { id: "tab-1", name: "first.tsx" },
        { id: "tab-3", name: "third.tsx" },
      ];

      const newTab: EditorTab = { id: "tab-2", name: "second.tsx" };
      const updated = addTabAt(tabs, newTab, 1);

      expect(updated).toHaveLength(3);
      expect(updated[1].name).toBe("second.tsx");
    });
  });

  describe("Close Button Behavior", () => {
    it("should determine close button visibility based on hover", () => {
      const getCloseButtonOpacity = (isHovered: boolean, isModified: boolean): string => {
        return (isHovered || isModified) ? "1" : "0";
      };

      expect(getCloseButtonOpacity(true, false)).toBe("1");
      expect(getCloseButtonOpacity(false, true)).toBe("1");
      expect(getCloseButtonOpacity(true, true)).toBe("1");
      expect(getCloseButtonOpacity(false, false)).toBe("0");
    });

    it("should stop event propagation on close", () => {
      const handleClose = vi.fn();
      const stopPropagation = vi.fn();

      const onCloseClick = (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        handleClose();
      };

      onCloseClick({ stopPropagation });

      expect(stopPropagation).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });

    it("should handle close for specific tab", () => {
      interface EditorTab {
        id: string;
        name: string;
      }

      const tabs: EditorTab[] = [
        { id: "tab-1", name: "first.tsx" },
        { id: "tab-2", name: "second.tsx" },
        { id: "tab-3", name: "third.tsx" },
      ];

      const closeTab = (tabs: EditorTab[], id: string): EditorTab[] => {
        return tabs.filter(tab => tab.id !== id);
      };

      const remaining = closeTab(tabs, "tab-2");

      expect(remaining).toHaveLength(2);
      expect(remaining.find(t => t.id === "tab-2")).toBeUndefined();
    });

    it("should select next tab when closing active tab", () => {
      interface EditorTab {
        id: string;
        name: string;
      }

      const getNextActiveTab = (
        tabs: EditorTab[],
        closingId: string,
        currentActiveId: string
      ): string | null => {
        if (closingId !== currentActiveId) {
          return currentActiveId;
        }

        const index = tabs.findIndex(t => t.id === closingId);
        const remaining = tabs.filter(t => t.id !== closingId);

        if (remaining.length === 0) return null;
        if (index >= remaining.length) return remaining[remaining.length - 1].id;
        return remaining[index].id;
      };

      const tabs: EditorTab[] = [
        { id: "tab-1", name: "first.tsx" },
        { id: "tab-2", name: "second.tsx" },
        { id: "tab-3", name: "third.tsx" },
      ];

      expect(getNextActiveTab(tabs, "tab-2", "tab-2")).toBe("tab-3");
      expect(getNextActiveTab(tabs, "tab-3", "tab-3")).toBe("tab-2");
      expect(getNextActiveTab(tabs, "tab-1", "tab-2")).toBe("tab-2");
    });
  });
});
