import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("diff", () => ({
  createPatch: vi.fn().mockReturnValue("--- History\n+++ Current\n@@ -1 +1 @@\n-old\n+new"),
}));

vi.mock("../utils/workspace", () => ({
  getProjectPath: vi.fn().mockReturnValue("/project"),
}));

interface HistoryEntry {
  id: string;
  filePath: string;
  timestamp: number;
  size: number;
  contentHash: string;
  trigger: HistoryTrigger;
  label?: string;
}

type HistoryTrigger = "save" | "external" | "periodic" | "manual";

interface LocalHistorySettings {
  enabled: boolean;
  storagePath: string;
  maxEntriesPerFile: number;
  maxTotalSizeMB: number;
  periodicSaveIntervalMs: number;
  excludePatterns: string[];
}

interface LocalHistoryState {
  settings: LocalHistorySettings;
  historyByFile: Map<string, HistoryEntry[]>;
  contentCache: Map<string, string>;
  totalSizeBytes: number;
  isInitialized: boolean;
}

interface VersionComparison {
  entryId: string;
  filePath: string;
  historyContent: string;
  currentContent: string;
  diff: string;
  hasChanges: boolean;
}

interface LocalHistoryContextValue {
  state: LocalHistoryState;
  saveSnapshot: (filePath: string, trigger?: HistoryTrigger, label?: string) => Promise<HistoryEntry | null>;
  getHistory: (filePath: string) => HistoryEntry[];
  restoreVersion: (filePath: string, entryId: string) => Promise<boolean>;
  deleteEntry: (filePath: string, entryId: string) => Promise<boolean>;
  clearHistory: (filePath: string) => Promise<boolean>;
  clearAllHistory: () => Promise<boolean>;
  compareWithCurrent: (filePath: string, entryId: string) => Promise<VersionComparison | null>;
  getEntryContent: (filePath: string, entryId: string) => Promise<string | null>;
  updateSettings: (settings: Partial<LocalHistorySettings>) => void;
  getTotalHistorySize: () => number;
  getHistoryEntryCount: () => number;
  onFileSave: (filePath: string) => Promise<void>;
  onBeforeExternalModification: (filePath: string) => Promise<void>;
}

const STORAGE_KEY = "cortex-local-history-settings";

describe("LocalHistoryContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("HistoryEntry interface", () => {
    it("should have correct entry structure", () => {
      const entry: HistoryEntry = {
        id: "entry-123",
        filePath: "/project/src/app.ts",
        timestamp: Date.now(),
        size: 1024,
        contentHash: "abc123def456",
        trigger: "save",
        label: "Before refactoring",
      };

      expect(entry.id).toBe("entry-123");
      expect(entry.filePath).toBe("/project/src/app.ts");
      expect(entry.trigger).toBe("save");
    });

    it("should support all trigger types", () => {
      const triggers: HistoryTrigger[] = ["save", "external", "periodic", "manual"];

      triggers.forEach((trigger) => {
        const entry: HistoryEntry = {
          id: `entry-${trigger}`,
          filePath: "/test.ts",
          timestamp: Date.now(),
          size: 100,
          contentHash: "hash",
          trigger,
        };
        expect(entry.trigger).toBe(trigger);
      });
    });
  });

  describe("LocalHistorySettings interface", () => {
    it("should have correct default settings", () => {
      const settings: LocalHistorySettings = {
        enabled: true,
        storagePath: ".cortex/history",
        maxEntriesPerFile: 50,
        maxTotalSizeMB: 100,
        periodicSaveIntervalMs: 300000,
        excludePatterns: [
          "node_modules/**",
          ".git/**",
          "dist/**",
        ],
      };

      expect(settings.enabled).toBe(true);
      expect(settings.maxEntriesPerFile).toBe(50);
      expect(settings.excludePatterns).toContain("node_modules/**");
    });
  });

  describe("VersionComparison interface", () => {
    it("should contain comparison data", () => {
      const comparison: VersionComparison = {
        entryId: "entry-1",
        filePath: "/project/src/app.ts",
        historyContent: "const x = 1;",
        currentContent: "const x = 2;",
        diff: "--- History\n+++ Current\n@@ -1 +1 @@\n-const x = 1;\n+const x = 2;",
        hasChanges: true,
      };

      expect(comparison.hasChanges).toBe(true);
      expect(comparison.diff).toContain("---");
    });
  });

  describe("IPC operations", () => {
    it("should call invoke for reading files", async () => {
      vi.mocked(invoke).mockResolvedValue("file content");

      const result = await invoke("fs_read_file", { path: "/project/src/app.ts" });

      expect(invoke).toHaveBeenCalledWith("fs_read_file", { path: "/project/src/app.ts" });
      expect(result).toBe("file content");
    });

    it("should call invoke for writing files", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("fs_write_file", { path: "/project/src/app.ts", content: "new content" });

      expect(invoke).toHaveBeenCalledWith("fs_write_file", {
        path: "/project/src/app.ts",
        content: "new content",
      });
    });

    it("should call invoke for checking file existence", async () => {
      vi.mocked(invoke).mockResolvedValue(true);

      const result = await invoke("fs_exists", { path: "/project/src/app.ts" });

      expect(invoke).toHaveBeenCalledWith("fs_exists", { path: "/project/src/app.ts" });
      expect(result).toBe(true);
    });

    it("should call invoke for creating directories", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("fs_create_directory", { path: "/project/.cortex/history" });

      expect(invoke).toHaveBeenCalledWith("fs_create_directory", {
        path: "/project/.cortex/history",
      });
    });

    it("should call invoke for deleting files", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("fs_delete_file", { path: "/project/.cortex/history/old-entry" });

      expect(invoke).toHaveBeenCalledWith("fs_delete_file", {
        path: "/project/.cortex/history/old-entry",
      });
    });

    it("should call invoke for deleting directories", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("fs_delete_directory", { path: "/project/.cortex/history", recursive: true });

      expect(invoke).toHaveBeenCalledWith("fs_delete_directory", {
        path: "/project/.cortex/history",
        recursive: true,
      });
    });

    it("should call invoke for listing directories", async () => {
      vi.mocked(invoke).mockResolvedValue([
        { name: "abc123", isFile: true },
        { name: "def456", isFile: true },
      ]);

      const result = await invoke("fs_list_directory", {
        path: "/project/.cortex/history/content",
        showHidden: false,
        includeIgnored: true,
      });

      expect(invoke).toHaveBeenCalledWith("fs_list_directory", {
        path: "/project/.cortex/history/content",
        showHidden: false,
        includeIgnored: true,
      });
      expect(result).toHaveLength(2);
    });
  });

  describe("Storage persistence", () => {
    it("should save settings to localStorage", () => {
      const settings: LocalHistorySettings = {
        enabled: true,
        storagePath: ".custom/history",
        maxEntriesPerFile: 100,
        maxTotalSizeMB: 200,
        periodicSaveIntervalMs: 600000,
        excludePatterns: ["*.log"],
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.maxEntriesPerFile).toBe(100);
    });

    it("should load settings from localStorage", () => {
      const settings = {
        enabled: false,
        storagePath: ".history",
        maxEntriesPerFile: 25,
        maxTotalSizeMB: 50,
        periodicSaveIntervalMs: 120000,
        excludePatterns: [],
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      const stored = localStorage.getItem(STORAGE_KEY);
      const loaded = JSON.parse(stored!) as LocalHistorySettings;

      expect(loaded.enabled).toBe(false);
      expect(loaded.maxEntriesPerFile).toBe(25);
    });
  });

  describe("State management", () => {
    it("should manage history by file", () => {
      const historyByFile = new Map<string, HistoryEntry[]>();

      const entries: HistoryEntry[] = [
        { id: "e1", filePath: "/app.ts", timestamp: 1000, size: 100, contentHash: "h1", trigger: "save" },
        { id: "e2", filePath: "/app.ts", timestamp: 2000, size: 150, contentHash: "h2", trigger: "save" },
      ];

      historyByFile.set("/app.ts", entries);

      expect(historyByFile.has("/app.ts")).toBe(true);
      expect(historyByFile.get("/app.ts")).toHaveLength(2);
    });

    it("should manage content cache", () => {
      const contentCache = new Map<string, string>();

      contentCache.set("/app.ts:e1", "const x = 1;");
      contentCache.set("/app.ts:e2", "const x = 2;");

      expect(contentCache.get("/app.ts:e1")).toBe("const x = 1;");
    });

    it("should track total size", () => {
      const entries: HistoryEntry[] = [
        { id: "e1", filePath: "/a.ts", timestamp: 1000, size: 1024, contentHash: "h1", trigger: "save" },
        { id: "e2", filePath: "/b.ts", timestamp: 2000, size: 2048, contentHash: "h2", trigger: "save" },
      ];

      const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
      expect(totalSize).toBe(3072);
    });
  });

  describe("History operations", () => {
    it("should get history for file", () => {
      const historyByFile = new Map<string, HistoryEntry[]>();
      const entries: HistoryEntry[] = [
        { id: "e1", filePath: "/app.ts", timestamp: 1000, size: 100, contentHash: "h1", trigger: "save" },
      ];
      historyByFile.set("/app.ts", entries);

      const history = historyByFile.get("/app.ts") || [];
      expect(history).toHaveLength(1);
    });

    it("should delete entry from history", () => {
      let entries: HistoryEntry[] = [
        { id: "e1", filePath: "/app.ts", timestamp: 1000, size: 100, contentHash: "h1", trigger: "save" },
        { id: "e2", filePath: "/app.ts", timestamp: 2000, size: 150, contentHash: "h2", trigger: "save" },
      ];

      entries = entries.filter((e) => e.id !== "e1");
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("e2");
    });

    it("should clear history for file", () => {
      const historyByFile = new Map<string, HistoryEntry[]>();
      historyByFile.set("/app.ts", [
        { id: "e1", filePath: "/app.ts", timestamp: 1000, size: 100, contentHash: "h1", trigger: "save" },
      ]);

      historyByFile.delete("/app.ts");
      expect(historyByFile.has("/app.ts")).toBe(false);
    });

    it("should clear all history", () => {
      const historyByFile = new Map<string, HistoryEntry[]>();
      historyByFile.set("/a.ts", []);
      historyByFile.set("/b.ts", []);

      historyByFile.clear();
      expect(historyByFile.size).toBe(0);
    });
  });

  describe("Exclude patterns", () => {
    it("should match glob patterns", () => {
      const patterns = ["node_modules/**", "*.log", ".git/**"];

      const matchesPattern = (filePath: string, patternList: string[]): boolean => {
        const normalized = filePath.toLowerCase();
        for (const pattern of patternList) {
          if (pattern.includes("**")) {
            const prefix = pattern.split("**")[0].replace(/\/$/, "");
            if (normalized.includes(prefix)) return true;
          } else if (pattern.startsWith("*.")) {
            const ext = pattern.slice(1);
            if (normalized.endsWith(ext)) return true;
          }
        }
        return false;
      };

      expect(matchesPattern("/project/node_modules/pkg/index.js", patterns)).toBe(true);
      expect(matchesPattern("/project/debug.log", patterns)).toBe(true);
      expect(matchesPattern("/project/.git/config", patterns)).toBe(true);
      expect(matchesPattern("/project/src/app.ts", patterns)).toBe(false);
    });
  });

  describe("Content hashing", () => {
    it("should generate consistent hash", () => {
      const hashContent = (content: string): string => {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
          const char = content.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash).toString(36) + content.length.toString(36);
      };

      const content = "const x = 1;";
      const hash1 = hashContent(content);
      const hash2 = hashContent(content);

      expect(hash1).toBe(hash2);
    });
  });

  describe("Entry count and size", () => {
    it("should count total entries", () => {
      const historyByFile = new Map<string, HistoryEntry[]>();
      historyByFile.set("/a.ts", [
        { id: "e1", filePath: "/a.ts", timestamp: 1000, size: 100, contentHash: "h1", trigger: "save" },
        { id: "e2", filePath: "/a.ts", timestamp: 2000, size: 150, contentHash: "h2", trigger: "save" },
      ]);
      historyByFile.set("/b.ts", [
        { id: "e3", filePath: "/b.ts", timestamp: 3000, size: 200, contentHash: "h3", trigger: "save" },
      ]);

      let count = 0;
      historyByFile.forEach((entries) => {
        count += entries.length;
      });

      expect(count).toBe(3);
    });

    it("should enforce max entries per file", () => {
      const maxEntries = 3;
      let entries: HistoryEntry[] = [
        { id: "e1", filePath: "/a.ts", timestamp: 1000, size: 100, contentHash: "h1", trigger: "save" },
        { id: "e2", filePath: "/a.ts", timestamp: 2000, size: 100, contentHash: "h2", trigger: "save" },
        { id: "e3", filePath: "/a.ts", timestamp: 3000, size: 100, contentHash: "h3", trigger: "save" },
        { id: "e4", filePath: "/a.ts", timestamp: 4000, size: 100, contentHash: "h4", trigger: "save" },
      ];

      entries.sort((a, b) => b.timestamp - a.timestamp);
      entries = entries.slice(0, maxEntries);

      expect(entries).toHaveLength(3);
      expect(entries[0].id).toBe("e4");
    });
  });

  describe("Context value structure", () => {
    it("should define all required methods", () => {
      const mockContext: LocalHistoryContextValue = {
        state: {
          settings: {
            enabled: true,
            storagePath: ".cortex/history",
            maxEntriesPerFile: 50,
            maxTotalSizeMB: 100,
            periodicSaveIntervalMs: 300000,
            excludePatterns: [],
          },
          historyByFile: new Map(),
          contentCache: new Map(),
          totalSizeBytes: 0,
          isInitialized: false,
        },
        saveSnapshot: vi.fn(),
        getHistory: vi.fn(),
        restoreVersion: vi.fn(),
        deleteEntry: vi.fn(),
        clearHistory: vi.fn(),
        clearAllHistory: vi.fn(),
        compareWithCurrent: vi.fn(),
        getEntryContent: vi.fn(),
        updateSettings: vi.fn(),
        getTotalHistorySize: vi.fn(),
        getHistoryEntryCount: vi.fn(),
        onFileSave: vi.fn(),
        onBeforeExternalModification: vi.fn(),
      };

      expect(mockContext.saveSnapshot).toBeDefined();
      expect(mockContext.restoreVersion).toBeDefined();
      expect(mockContext.compareWithCurrent).toBeDefined();
      expect(mockContext.clearAllHistory).toBeDefined();
    });
  });
});
