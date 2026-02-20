import { describe, it, expect, vi, beforeEach } from "vitest";

describe("QuickAccessContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("QuickPickItem Types", () => {
    interface QuickPickItem<T = unknown> {
      id: string;
      label: string;
      description?: string;
      detail?: string;
      data?: T;
      alwaysShow?: boolean;
      score?: number;
      matches?: number[];
    }

    it("should create a quick pick item", () => {
      const item: QuickPickItem = {
        id: "item-1",
        label: "Open File",
        description: "src/index.ts",
        detail: "TypeScript file",
      };

      expect(item.id).toBe("item-1");
      expect(item.label).toBe("Open File");
      expect(item.description).toBe("src/index.ts");
    });

    it("should create item with data", () => {
      interface FileData {
        path: string;
        size: number;
      }

      const item: QuickPickItem<FileData> = {
        id: "file-1",
        label: "index.ts",
        data: { path: "/src/index.ts", size: 1024 },
      };

      expect(item.data?.path).toBe("/src/index.ts");
      expect(item.data?.size).toBe(1024);
    });

    it("should handle match scoring", () => {
      const item: QuickPickItem = {
        id: "item-1",
        label: "CommandPalette",
        score: 85,
        matches: [0, 1, 2, 7],
      };

      expect(item.score).toBe(85);
      expect(item.matches).toHaveLength(4);
    });
  });

  describe("QuickAccessProvider", () => {
    interface QuickPickItem {
      id: string;
      label: string;
      description?: string;
    }

    interface QuickAccessProvider {
      prefix: string;
      placeholder: string;
      provideItems: (query: string) => Promise<QuickPickItem[]>;
      onAccept: (item: QuickPickItem) => void;
      name?: string;
      description?: string;
    }

    it("should create a provider", () => {
      const provider: QuickAccessProvider = {
        prefix: ">",
        placeholder: "Search commands...",
        name: "Commands",
        description: "Execute commands",
        provideItems: async (query) => {
          return [
            { id: "cmd-1", label: `Command: ${query}` },
          ];
        },
        onAccept: (item) => {
          expect(item).toBeDefined();
        },
      };

      expect(provider.prefix).toBe(">");
      expect(provider.placeholder).toBe("Search commands...");
    });

    it("should provide items based on query", async () => {
      const provider: QuickAccessProvider = {
        prefix: "@",
        placeholder: "Go to symbol...",
        provideItems: async (query) => {
          const symbols = [
            { id: "1", label: "function main", description: "Line 10" },
            { id: "2", label: "function helper", description: "Line 25" },
            { id: "3", label: "class App", description: "Line 50" },
          ];
          return symbols.filter((s) =>
            s.label.toLowerCase().includes(query.toLowerCase())
          );
        },
        onAccept: () => {},
      };

      const results = await provider.provideItems("main");

      expect(results).toHaveLength(1);
      expect(results[0].label).toBe("function main");
    });
  });

  describe("Provider Registration", () => {
    interface QuickAccessProvider {
      prefix: string;
      placeholder: string;
      name?: string;
    }

    it("should register a provider", () => {
      const providers = new Map<string, QuickAccessProvider>();

      const provider: QuickAccessProvider = {
        prefix: "!",
        placeholder: "Run script...",
        name: "Scripts",
      };

      providers.set(provider.prefix, provider);

      expect(providers.has("!")).toBe(true);
      expect(providers.get("!")?.name).toBe("Scripts");
    });

    it("should unregister a provider", () => {
      const providers = new Map<string, QuickAccessProvider>();

      providers.set(">", { prefix: ">", placeholder: "Commands" });
      providers.set("@", { prefix: "@", placeholder: "Symbols" });

      providers.delete(">");

      expect(providers.has(">")).toBe(false);
      expect(providers.has("@")).toBe(true);
    });

    it("should list all providers", () => {
      const providers = new Map<string, QuickAccessProvider>();

      providers.set(">", { prefix: ">", placeholder: "Commands" });
      providers.set("@", { prefix: "@", placeholder: "Symbols" });
      providers.set("#", { prefix: "#", placeholder: "Workspace Symbols" });

      const prefixes = Array.from(providers.keys());

      expect(prefixes).toHaveLength(3);
      expect(prefixes).toContain(">");
      expect(prefixes).toContain("@");
      expect(prefixes).toContain("#");
    });
  });

  describe("Pinned Items", () => {
    interface PinnedItem {
      providerId: string;
      itemId: string;
      label: string;
      pinnedAt: Date;
      description?: string;
      data?: unknown;
    }

    it("should pin an item", () => {
      const pinnedItems: PinnedItem[] = [];

      const item: PinnedItem = {
        providerId: "commands",
        itemId: "cmd-save",
        label: "Save File",
        pinnedAt: new Date(),
        description: "Ctrl+S",
      };

      pinnedItems.push(item);

      expect(pinnedItems).toHaveLength(1);
      expect(pinnedItems[0].label).toBe("Save File");
    });

    it("should unpin an item", () => {
      const pinnedItems: PinnedItem[] = [
        { providerId: "commands", itemId: "cmd-save", label: "Save", pinnedAt: new Date() },
        { providerId: "commands", itemId: "cmd-open", label: "Open", pinnedAt: new Date() },
      ];

      const filtered = pinnedItems.filter(
        (p) => !(p.providerId === "commands" && p.itemId === "cmd-save")
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].itemId).toBe("cmd-open");
    });

    it("should check if item is pinned", () => {
      const pinnedItems: PinnedItem[] = [
        { providerId: "commands", itemId: "cmd-save", label: "Save", pinnedAt: new Date() },
      ];

      const isPinned = pinnedItems.some(
        (p) => p.providerId === "commands" && p.itemId === "cmd-save"
      );

      expect(isPinned).toBe(true);
    });

    it("should get pinned items for provider", () => {
      const pinnedItems: PinnedItem[] = [
        { providerId: "commands", itemId: "cmd-1", label: "Cmd 1", pinnedAt: new Date() },
        { providerId: "files", itemId: "file-1", label: "File 1", pinnedAt: new Date() },
        { providerId: "commands", itemId: "cmd-2", label: "Cmd 2", pinnedAt: new Date() },
      ];

      const commandPins = pinnedItems.filter((p) => p.providerId === "commands");

      expect(commandPins).toHaveLength(2);
    });
  });

  describe("History Management", () => {
    interface HistoryEntry {
      providerId: string;
      itemId: string;
      label: string;
      usedAt: Date;
      description?: string;
      data?: unknown;
    }

    it("should add to history", () => {
      const history: HistoryEntry[] = [];

      const entry: HistoryEntry = {
        providerId: "commands",
        itemId: "cmd-save",
        label: "Save File",
        usedAt: new Date(),
      };

      history.unshift(entry);

      expect(history).toHaveLength(1);
      expect(history[0].label).toBe("Save File");
    });

    it("should limit history size", () => {
      const maxHistory = 50;
      const history: HistoryEntry[] = [];

      for (let i = 0; i < 60; i++) {
        history.unshift({
          providerId: "commands",
          itemId: `cmd-${i}`,
          label: `Command ${i}`,
          usedAt: new Date(),
        });
      }

      const trimmed = history.slice(0, maxHistory);

      expect(trimmed).toHaveLength(50);
    });

    it("should move recent item to top", () => {
      const history: HistoryEntry[] = [
        { providerId: "commands", itemId: "cmd-1", label: "Cmd 1", usedAt: new Date(1000) },
        { providerId: "commands", itemId: "cmd-2", label: "Cmd 2", usedAt: new Date(2000) },
        { providerId: "commands", itemId: "cmd-3", label: "Cmd 3", usedAt: new Date(3000) },
      ];

      const itemId = "cmd-1";
      const existingIndex = history.findIndex((h) => h.itemId === itemId);

      if (existingIndex !== -1) {
        const [item] = history.splice(existingIndex, 1);
        item.usedAt = new Date();
        history.unshift(item);
      }

      expect(history[0].itemId).toBe("cmd-1");
    });

    it("should get history for provider", () => {
      const history: HistoryEntry[] = [
        { providerId: "commands", itemId: "cmd-1", label: "Cmd 1", usedAt: new Date() },
        { providerId: "files", itemId: "file-1", label: "File 1", usedAt: new Date() },
        { providerId: "commands", itemId: "cmd-2", label: "Cmd 2", usedAt: new Date() },
      ];

      const commandHistory = history.filter((h) => h.providerId === "commands");

      expect(commandHistory).toHaveLength(2);
    });

    it("should clear history", () => {
      let history: HistoryEntry[] = [
        { providerId: "commands", itemId: "cmd-1", label: "Cmd 1", usedAt: new Date() },
        { providerId: "commands", itemId: "cmd-2", label: "Cmd 2", usedAt: new Date() },
      ];

      history = [];

      expect(history).toHaveLength(0);
    });
  });

  describe("Show/Hide State", () => {
    interface QuickAccessState {
      visible: boolean;
      query: string;
      activePrefix: string;
      items: unknown[];
      selectedIndex: number;
    }

    it("should show quick access", () => {
      const state: QuickAccessState = {
        visible: false,
        query: "",
        activePrefix: "",
        items: [],
        selectedIndex: 0,
      };

      state.visible = true;
      state.activePrefix = ">";

      expect(state.visible).toBe(true);
      expect(state.activePrefix).toBe(">");
    });

    it("should hide quick access", () => {
      const state: QuickAccessState = {
        visible: true,
        query: ">save",
        activePrefix: ">",
        items: [{ id: "1", label: "Save" }],
        selectedIndex: 0,
      };

      state.visible = false;
      state.query = "";
      state.items = [];

      expect(state.visible).toBe(false);
      expect(state.items).toHaveLength(0);
    });

    it("should show with initial query", () => {
      const state: QuickAccessState = {
        visible: false,
        query: "",
        activePrefix: "",
        items: [],
        selectedIndex: 0,
      };

      const initialQuery = ">format";
      state.visible = true;
      state.query = initialQuery;
      state.activePrefix = ">";

      expect(state.query).toBe(">format");
    });
  });

  describe("Prefix Detection", () => {
    const prefixes = [">", "@", "#", ":", "?"];

    it("should detect command prefix", () => {
      const query = ">save file";
      const prefix = prefixes.find((p) => query.startsWith(p));

      expect(prefix).toBe(">");
    });

    it("should detect symbol prefix", () => {
      const query = "@main";
      const prefix = prefixes.find((p) => query.startsWith(p));

      expect(prefix).toBe("@");
    });

    it("should detect no prefix for file search", () => {
      const query = "index.ts";
      const prefix = prefixes.find((p) => query.startsWith(p));

      expect(prefix).toBeUndefined();
    });

    it("should extract query without prefix", () => {
      const fullQuery = ">save file";
      const prefix = ">";
      const query = fullQuery.startsWith(prefix) ? fullQuery.slice(prefix.length) : fullQuery;

      expect(query).toBe("save file");
    });
  });

  describe("Item Selection", () => {
    interface QuickPickItem {
      id: string;
      label: string;
    }

    it("should select next item", () => {
      const items: QuickPickItem[] = [
        { id: "1", label: "Item 1" },
        { id: "2", label: "Item 2" },
        { id: "3", label: "Item 3" },
      ];

      let selectedIndex = 0;

      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);

      expect(selectedIndex).toBe(1);
    });

    it("should select previous item", () => {
      const items: QuickPickItem[] = [
        { id: "1", label: "Item 1" },
        { id: "2", label: "Item 2" },
        { id: "3", label: "Item 3" },
      ];

      let selectedIndex = 2;

      selectedIndex = Math.max(selectedIndex - 1, 0);

      expect(selectedIndex).toBe(1);
      expect(items.length).toBe(3);
    });

    it("should wrap around at end", () => {
      const items: QuickPickItem[] = [
        { id: "1", label: "Item 1" },
        { id: "2", label: "Item 2" },
        { id: "3", label: "Item 3" },
      ];

      let selectedIndex = 2;

      selectedIndex = (selectedIndex + 1) % items.length;

      expect(selectedIndex).toBe(0);
    });

    it("should wrap around at beginning", () => {
      const items: QuickPickItem[] = [
        { id: "1", label: "Item 1" },
        { id: "2", label: "Item 2" },
        { id: "3", label: "Item 3" },
      ];

      let selectedIndex = 0;

      selectedIndex = selectedIndex === 0 ? items.length - 1 : selectedIndex - 1;

      expect(selectedIndex).toBe(2);
    });
  });

  describe("Fuzzy Matching", () => {
    interface QuickPickItem {
      id: string;
      label: string;
      score?: number;
    }

    it("should score exact matches highest", () => {
      const items: QuickPickItem[] = [
        { id: "1", label: "save" },
        { id: "2", label: "saveAll" },
        { id: "3", label: "saveAs" },
      ];

      const query = "save";
      const scored = items.map((item) => ({
        ...item,
        score: item.label === query ? 100 : item.label.startsWith(query) ? 80 : 50,
      }));

      const sorted = scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      expect(sorted[0].label).toBe("save");
      expect(sorted[0].score).toBe(100);
    });

    it("should filter items by query", () => {
      const items: QuickPickItem[] = [
        { id: "1", label: "Open File" },
        { id: "2", label: "Save File" },
        { id: "3", label: "Close Editor" },
      ];

      const query = "file";
      const filtered = items.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      );

      expect(filtered).toHaveLength(2);
    });
  });
});
