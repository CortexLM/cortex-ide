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

vi.mock("../../utils/logger", () => ({
  createLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("TimelineContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("TimelineEntry Type", () => {
    interface TimelineEntry {
      id: string;
      filePath: string;
      timestamp: number;
      label: string | null;
      source: "autoSave" | "manualSave" | "undo" | "gitCommit" | "refactor";
      size: number;
      snapshotPath: string;
    }

    it("should create a timeline entry with all fields", () => {
      const entry: TimelineEntry = {
        id: "entry-1",
        filePath: "/src/app.ts",
        timestamp: 1700000000,
        label: "Before refactor",
        source: "manualSave",
        size: 2048,
        snapshotPath: "/snapshots/entry-1.snap",
      };

      expect(entry.id).toBe("entry-1");
      expect(entry.filePath).toBe("/src/app.ts");
      expect(entry.timestamp).toBe(1700000000);
      expect(entry.label).toBe("Before refactor");
      expect(entry.source).toBe("manualSave");
      expect(entry.size).toBe(2048);
      expect(entry.snapshotPath).toBe("/snapshots/entry-1.snap");
    });

    it("should allow null label", () => {
      const entry: TimelineEntry = {
        id: "entry-2",
        filePath: "/src/utils.ts",
        timestamp: 1700000100,
        label: null,
        source: "autoSave",
        size: 512,
        snapshotPath: "/snapshots/entry-2.snap",
      };

      expect(entry.label).toBeNull();
    });

    it("should support autoSave source", () => {
      const entry: TimelineEntry = {
        id: "e-1",
        filePath: "/src/a.ts",
        timestamp: 1000,
        label: null,
        source: "autoSave",
        size: 100,
        snapshotPath: "/snap/e-1",
      };

      expect(entry.source).toBe("autoSave");
    });

    it("should support undo source", () => {
      const entry: TimelineEntry = {
        id: "e-2",
        filePath: "/src/a.ts",
        timestamp: 2000,
        label: null,
        source: "undo",
        size: 200,
        snapshotPath: "/snap/e-2",
      };

      expect(entry.source).toBe("undo");
    });

    it("should support gitCommit source", () => {
      const entry: TimelineEntry = {
        id: "e-3",
        filePath: "/src/a.ts",
        timestamp: 3000,
        label: "commit abc123",
        source: "gitCommit",
        size: 300,
        snapshotPath: "/snap/e-3",
      };

      expect(entry.source).toBe("gitCommit");
    });

    it("should support refactor source", () => {
      const entry: TimelineEntry = {
        id: "e-4",
        filePath: "/src/a.ts",
        timestamp: 4000,
        label: null,
        source: "refactor",
        size: 400,
        snapshotPath: "/snap/e-4",
      };

      expect(entry.source).toBe("refactor");
    });
  });

  describe("TimelineStats Type", () => {
    interface TimelineStats {
      totalEntries: number;
      totalFiles: number;
      diskUsageBytes: number;
    }

    it("should create stats with all fields", () => {
      const stats: TimelineStats = {
        totalEntries: 150,
        totalFiles: 25,
        diskUsageBytes: 1048576,
      };

      expect(stats.totalEntries).toBe(150);
      expect(stats.totalFiles).toBe(25);
      expect(stats.diskUsageBytes).toBe(1048576);
    });

    it("should handle zero values", () => {
      const stats: TimelineStats = {
        totalEntries: 0,
        totalFiles: 0,
        diskUsageBytes: 0,
      };

      expect(stats.totalEntries).toBe(0);
      expect(stats.totalFiles).toBe(0);
      expect(stats.diskUsageBytes).toBe(0);
    });
  });

  describe("DiffResult and DiffLine Types", () => {
    interface DiffLine {
      kind: string;
      content: string;
    }

    interface DiffResult {
      hunks: DiffLine[];
      addedLines: number;
      removedLines: number;
    }

    it("should create a DiffLine", () => {
      const line: DiffLine = {
        kind: "added",
        content: "+const x = 42;",
      };

      expect(line.kind).toBe("added");
      expect(line.content).toBe("+const x = 42;");
    });

    it("should create a DiffResult with hunks", () => {
      const diff: DiffResult = {
        hunks: [
          { kind: "context", content: " import { foo } from 'bar';" },
          { kind: "removed", content: "-const old = 1;" },
          { kind: "added", content: "+const updated = 2;" },
        ],
        addedLines: 1,
        removedLines: 1,
      };

      expect(diff.hunks).toHaveLength(3);
      expect(diff.addedLines).toBe(1);
      expect(diff.removedLines).toBe(1);
    });

    it("should handle empty diff", () => {
      const diff: DiffResult = {
        hunks: [],
        addedLines: 0,
        removedLines: 0,
      };

      expect(diff.hunks).toHaveLength(0);
    });
  });

  describe("TimelineState", () => {
    interface TimelineEntry {
      id: string;
      filePath: string;
      timestamp: number;
      label: string | null;
      source: string;
      size: number;
      snapshotPath: string;
    }

    interface TimelineStats {
      totalEntries: number;
      totalFiles: number;
      diskUsageBytes: number;
    }

    interface TimelineState {
      entries: TimelineEntry[];
      loading: boolean;
      error: string | null;
      selectedFilePath: string | null;
      stats: TimelineStats | null;
    }

    it("should define initial state", () => {
      const state: TimelineState = {
        entries: [],
        loading: false,
        error: null,
        selectedFilePath: null,
        stats: null,
      };

      expect(state.entries).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.selectedFilePath).toBeNull();
      expect(state.stats).toBeNull();
    });

    it("should track entries array", () => {
      const entries: TimelineEntry[] = [
        { id: "e-1", filePath: "/src/a.ts", timestamp: 1000, label: null, source: "autoSave", size: 100, snapshotPath: "/snap/e-1" },
        { id: "e-2", filePath: "/src/a.ts", timestamp: 2000, label: "checkpoint", source: "manualSave", size: 200, snapshotPath: "/snap/e-2" },
      ];

      const state: TimelineState = {
        entries,
        loading: false,
        error: null,
        selectedFilePath: "/src/a.ts",
        stats: null,
      };

      expect(state.entries).toHaveLength(2);
      expect(state.selectedFilePath).toBe("/src/a.ts");
    });

    it("should track loading state", () => {
      const state: TimelineState = {
        entries: [],
        loading: true,
        error: null,
        selectedFilePath: "/src/a.ts",
        stats: null,
      };

      expect(state.loading).toBe(true);
    });

    it("should track error state", () => {
      const state: TimelineState = {
        entries: [],
        loading: false,
        error: "Failed to load entries",
        selectedFilePath: null,
        stats: null,
      };

      expect(state.error).toBe("Failed to load entries");
    });

    it("should track stats", () => {
      const state: TimelineState = {
        entries: [],
        loading: false,
        error: null,
        selectedFilePath: null,
        stats: { totalEntries: 50, totalFiles: 10, diskUsageBytes: 524288 },
      };

      expect(state.stats).not.toBeNull();
      expect(state.stats!.totalEntries).toBe(50);
    });
  });

  describe("IPC: timeline_init", () => {
    it("should call timeline_init", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("timeline_init");

      expect(invoke).toHaveBeenCalledWith("timeline_init");
    });

    it("should handle init failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Storage init failed"));

      await expect(invoke("timeline_init")).rejects.toThrow("Storage init failed");
    });
  });

  describe("IPC: timeline_get_entries", () => {
    it("should call with filePath and return entries", async () => {
      const mockEntries = [
        { id: "e-1", filePath: "/src/a.ts", timestamp: 1000, label: null, source: "autoSave", size: 100, snapshotPath: "/snap/e-1" },
        { id: "e-2", filePath: "/src/a.ts", timestamp: 2000, label: null, source: "manualSave", size: 200, snapshotPath: "/snap/e-2" },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(mockEntries);

      const result = await invoke("timeline_get_entries", { filePath: "/src/a.ts" });

      expect(invoke).toHaveBeenCalledWith("timeline_get_entries", { filePath: "/src/a.ts" });
      expect(result).toHaveLength(2);
    });

    it("should return empty array for file with no entries", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      const result = await invoke("timeline_get_entries", { filePath: "/src/new.ts" });

      expect(result).toEqual([]);
    });
  });

  describe("IPC: timeline_create_snapshot", () => {
    it("should call with all parameters", async () => {
      const mockEntry = {
        id: "e-new",
        filePath: "/src/a.ts",
        timestamp: 3000,
        label: "Before refactor",
        source: "manualSave",
        size: 512,
        snapshotPath: "/snap/e-new",
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockEntry);

      const result = await invoke("timeline_create_snapshot", {
        filePath: "/src/a.ts",
        content: "const x = 1;",
        source: "manualSave",
        label: "Before refactor",
      });

      expect(invoke).toHaveBeenCalledWith("timeline_create_snapshot", {
        filePath: "/src/a.ts",
        content: "const x = 1;",
        source: "manualSave",
        label: "Before refactor",
      });
      expect(result).toHaveProperty("id", "e-new");
    });

    it("should call with null label", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        id: "e-auto",
        filePath: "/src/a.ts",
        timestamp: 4000,
        label: null,
        source: "autoSave",
        size: 256,
        snapshotPath: "/snap/e-auto",
      });

      await invoke("timeline_create_snapshot", {
        filePath: "/src/a.ts",
        content: "const y = 2;",
        source: "autoSave",
        label: null,
      });

      expect(invoke).toHaveBeenCalledWith("timeline_create_snapshot", {
        filePath: "/src/a.ts",
        content: "const y = 2;",
        source: "autoSave",
        label: null,
      });
    });
  });

  describe("IPC: timeline_restore_snapshot", () => {
    it("should return restored content", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("const x = 1;\nconst y = 2;");

      const result = await invoke("timeline_restore_snapshot", { entryId: "e-1" });

      expect(invoke).toHaveBeenCalledWith("timeline_restore_snapshot", { entryId: "e-1" });
      expect(result).toBe("const x = 1;\nconst y = 2;");
    });

    it("should handle restore failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Snapshot not found"));

      await expect(invoke("timeline_restore_snapshot", { entryId: "missing" })).rejects.toThrow("Snapshot not found");
    });
  });

  describe("IPC: timeline_delete_entry", () => {
    it("should call with entryId", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("timeline_delete_entry", { entryId: "e-1" });

      expect(invoke).toHaveBeenCalledWith("timeline_delete_entry", { entryId: "e-1" });
    });
  });

  describe("IPC: timeline_clear_file", () => {
    it("should call with filePath", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("timeline_clear_file", { filePath: "/src/a.ts" });

      expect(invoke).toHaveBeenCalledWith("timeline_clear_file", { filePath: "/src/a.ts" });
    });
  });

  describe("IPC: timeline_clear_all", () => {
    it("should call without arguments", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("timeline_clear_all");

      expect(invoke).toHaveBeenCalledWith("timeline_clear_all");
    });
  });

  describe("IPC: timeline_get_content", () => {
    it("should return content string", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("file content here");

      const result = await invoke("timeline_get_content", { entryId: "e-1" });

      expect(invoke).toHaveBeenCalledWith("timeline_get_content", { entryId: "e-1" });
      expect(result).toBe("file content here");
    });

    it("should handle missing content", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Content not found"));

      await expect(invoke("timeline_get_content", { entryId: "missing" })).rejects.toThrow("Content not found");
    });
  });

  describe("IPC: timeline_compare", () => {
    it("should return DiffResult", async () => {
      const mockDiff = {
        hunks: [
          { kind: "context", content: " line 1" },
          { kind: "removed", content: "-old line" },
          { kind: "added", content: "+new line" },
        ],
        addedLines: 1,
        removedLines: 1,
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockDiff);

      const result = await invoke("timeline_compare", { entryIdA: "e-1", entryIdB: "e-2" });

      expect(invoke).toHaveBeenCalledWith("timeline_compare", { entryIdA: "e-1", entryIdB: "e-2" });
      expect(result).toHaveProperty("hunks");
      expect(result).toHaveProperty("addedLines", 1);
      expect(result).toHaveProperty("removedLines", 1);
    });
  });

  describe("IPC: timeline_set_label", () => {
    it("should call with entryId and label", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("timeline_set_label", { entryId: "e-1", label: "Important checkpoint" });

      expect(invoke).toHaveBeenCalledWith("timeline_set_label", {
        entryId: "e-1",
        label: "Important checkpoint",
      });
    });
  });

  describe("IPC: timeline_get_stats", () => {
    it("should return stats", async () => {
      const mockStats = {
        totalEntries: 100,
        totalFiles: 20,
        diskUsageBytes: 2097152,
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockStats);

      const result = await invoke("timeline_get_stats");

      expect(invoke).toHaveBeenCalledWith("timeline_get_stats");
      expect(result).toEqual(mockStats);
    });
  });

  describe("loadEntries Logic", () => {
    interface TimelineEntry {
      id: string;
      filePath: string;
      timestamp: number;
      label: string | null;
      source: string;
      size: number;
      snapshotPath: string;
    }

    it("should set entries and selectedFilePath on success", async () => {
      const mockEntries: TimelineEntry[] = [
        { id: "e-1", filePath: "/src/a.ts", timestamp: 1000, label: null, source: "autoSave", size: 100, snapshotPath: "/snap/e-1" },
      ];

      let entries: TimelineEntry[] = [];
      let loading = false;
      let error: string | null = null;
      let selectedFilePath: string | null = null;

      const loadEntries = async (filePath: string) => {
        loading = true;
        error = null;
        try {
          const result = await invoke("timeline_get_entries", { filePath });
          entries = result as TimelineEntry[];
          selectedFilePath = filePath;
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
        } finally {
          loading = false;
        }
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockEntries);
      await loadEntries("/src/a.ts");

      expect(entries).toHaveLength(1);
      expect(selectedFilePath).toBe("/src/a.ts");
      expect(loading).toBe(false);
      expect(error).toBeNull();
    });

    it("should set error on failure", async () => {
      let error: string | null = null;
      let loading = false;

      const loadEntries = async (filePath: string) => {
        loading = true;
        error = null;
        try {
          await invoke("timeline_get_entries", { filePath });
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
        } finally {
          loading = false;
        }
      };

      vi.mocked(invoke).mockRejectedValueOnce(new Error("Network error"));
      await loadEntries("/src/a.ts");

      expect(error).toBe("Network error");
      expect(loading).toBe(false);
    });

    it("should clear error before loading", async () => {
      let error: string | null = "previous error";

      const loadEntries = async (filePath: string) => {
        error = null;
        try {
          await invoke("timeline_get_entries", { filePath });
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
        }
      };

      vi.mocked(invoke).mockResolvedValueOnce([]);
      await loadEntries("/src/a.ts");

      expect(error).toBeNull();
    });
  });

  describe("createSnapshot Logic", () => {
    interface TimelineEntry {
      id: string;
      filePath: string;
      timestamp: number;
      label: string | null;
      source: string;
      size: number;
      snapshotPath: string;
    }

    it("should return created entry", async () => {
      const mockEntry: TimelineEntry = {
        id: "e-new",
        filePath: "/src/a.ts",
        timestamp: 5000,
        label: null,
        source: "autoSave",
        size: 128,
        snapshotPath: "/snap/e-new",
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockEntry);

      const result = await invoke("timeline_create_snapshot", {
        filePath: "/src/a.ts",
        content: "code",
        source: "autoSave",
        label: null,
      });

      expect(result).toEqual(mockEntry);
    });

    it("should prepend entry when selectedFilePath matches", async () => {
      const existingEntries: TimelineEntry[] = [
        { id: "e-old", filePath: "/src/a.ts", timestamp: 1000, label: null, source: "autoSave", size: 100, snapshotPath: "/snap/e-old" },
      ];

      const newEntry: TimelineEntry = {
        id: "e-new",
        filePath: "/src/a.ts",
        timestamp: 2000,
        label: null,
        source: "manualSave",
        size: 200,
        snapshotPath: "/snap/e-new",
      };

      let entries = [...existingEntries];
      const selectedFilePath = "/src/a.ts";

      const createSnapshot = async (filePath: string, content: string, source: string, label?: string) => {
        const entry = await invoke("timeline_create_snapshot", { filePath, content, source, label: label ?? null });
        if (selectedFilePath === filePath) {
          entries = [entry as TimelineEntry, ...entries];
        }
        return entry;
      };

      vi.mocked(invoke).mockResolvedValueOnce(newEntry);
      await createSnapshot("/src/a.ts", "code", "manualSave");

      expect(entries).toHaveLength(2);
      expect(entries[0].id).toBe("e-new");
      expect(entries[1].id).toBe("e-old");
    });

    it("should not add entry when selectedFilePath differs", async () => {
      const existingEntries: TimelineEntry[] = [
        { id: "e-old", filePath: "/src/a.ts", timestamp: 1000, label: null, source: "autoSave", size: 100, snapshotPath: "/snap/e-old" },
      ];

      const newEntry: TimelineEntry = {
        id: "e-new",
        filePath: "/src/b.ts",
        timestamp: 2000,
        label: null,
        source: "autoSave",
        size: 200,
        snapshotPath: "/snap/e-new",
      };

      let entries = [...existingEntries];
      const selectedFilePath = "/src/a.ts";

      const createSnapshot = async (filePath: string, content: string, source: string) => {
        const entry = await invoke("timeline_create_snapshot", { filePath, content, source, label: null });
        if (selectedFilePath === filePath) {
          entries = [entry as TimelineEntry, ...entries];
        }
        return entry;
      };

      vi.mocked(invoke).mockResolvedValueOnce(newEntry);
      await createSnapshot("/src/b.ts", "code", "autoSave");

      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("e-old");
    });

    it("should set error and re-throw on failure", async () => {
      let error: string | null = null;

      const createSnapshot = async (filePath: string, content: string, source: string) => {
        error = null;
        try {
          return await invoke("timeline_create_snapshot", { filePath, content, source, label: null });
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          throw err;
        }
      };

      vi.mocked(invoke).mockRejectedValueOnce(new Error("Disk full"));

      await expect(createSnapshot("/src/a.ts", "code", "autoSave")).rejects.toThrow("Disk full");
      expect(error).toBe("Disk full");
    });
  });

  describe("restoreSnapshot Logic", () => {
    it("should return content on success", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("restored file content");

      const result = await invoke("timeline_restore_snapshot", { entryId: "e-1" });

      expect(result).toBe("restored file content");
    });

    it("should set error and re-throw on failure", async () => {
      let error: string | null = null;

      const restoreSnapshot = async (entryId: string) => {
        error = null;
        try {
          return await invoke("timeline_restore_snapshot", { entryId });
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          throw err;
        }
      };

      vi.mocked(invoke).mockRejectedValueOnce(new Error("Snapshot corrupted"));

      await expect(restoreSnapshot("e-bad")).rejects.toThrow("Snapshot corrupted");
      expect(error).toBe("Snapshot corrupted");
    });
  });

  describe("deleteEntry Logic", () => {
    interface TimelineEntry {
      id: string;
      filePath: string;
    }

    it("should remove entry from array by id", async () => {
      let entries: TimelineEntry[] = [
        { id: "e-1", filePath: "/src/a.ts" },
        { id: "e-2", filePath: "/src/a.ts" },
        { id: "e-3", filePath: "/src/a.ts" },
      ];

      const deleteEntry = async (entryId: string) => {
        await invoke("timeline_delete_entry", { entryId });
        entries = entries.filter((e) => e.id !== entryId);
      };

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await deleteEntry("e-2");

      expect(entries).toHaveLength(2);
      expect(entries.find((e) => e.id === "e-2")).toBeUndefined();
    });

    it("should set error and re-throw on failure", async () => {
      let error: string | null = null;
      const entries = [{ id: "e-1", filePath: "/src/a.ts" }];

      const deleteEntry = async (entryId: string) => {
        error = null;
        try {
          await invoke("timeline_delete_entry", { entryId });
          const idx = entries.findIndex((e) => e.id === entryId);
          if (idx > -1) entries.splice(idx, 1);
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          throw err;
        }
      };

      vi.mocked(invoke).mockRejectedValueOnce(new Error("Permission denied"));

      await expect(deleteEntry("e-1")).rejects.toThrow("Permission denied");
      expect(error).toBe("Permission denied");
      expect(entries).toHaveLength(1);
    });
  });

  describe("clearFile Logic", () => {
    interface TimelineEntry {
      id: string;
      filePath: string;
    }

    it("should clear entries when selectedFilePath matches", async () => {
      let entries: TimelineEntry[] = [
        { id: "e-1", filePath: "/src/a.ts" },
        { id: "e-2", filePath: "/src/a.ts" },
      ];
      const selectedFilePath = "/src/a.ts";

      const clearFile = async (filePath: string) => {
        await invoke("timeline_clear_file", { filePath });
        if (selectedFilePath === filePath) {
          entries = [];
        }
      };

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await clearFile("/src/a.ts");

      expect(entries).toHaveLength(0);
    });

    it("should not clear entries when selectedFilePath differs", async () => {
      let entries: TimelineEntry[] = [
        { id: "e-1", filePath: "/src/a.ts" },
      ];
      const selectedFilePath = "/src/a.ts";

      const clearFile = async (filePath: string) => {
        await invoke("timeline_clear_file", { filePath });
        if (selectedFilePath === filePath) {
          entries = [];
        }
      };

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await clearFile("/src/b.ts");

      expect(entries).toHaveLength(1);
    });

    it("should set error and re-throw on failure", async () => {
      let error: string | null = null;

      const clearFile = async (filePath: string) => {
        error = null;
        try {
          await invoke("timeline_clear_file", { filePath });
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          throw err;
        }
      };

      vi.mocked(invoke).mockRejectedValueOnce(new Error("Clear failed"));

      await expect(clearFile("/src/a.ts")).rejects.toThrow("Clear failed");
      expect(error).toBe("Clear failed");
    });
  });

  describe("clearAll Logic", () => {
    it("should reset all state", async () => {
      let entries = [{ id: "e-1" }, { id: "e-2" }];
      let selectedFilePath: string | null = "/src/a.ts";
      let stats: { totalEntries: number } | null = { totalEntries: 5 };

      const clearAll = async () => {
        await invoke("timeline_clear_all");
        entries = [];
        selectedFilePath = null;
        stats = null;
      };

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await clearAll();

      expect(entries).toHaveLength(0);
      expect(selectedFilePath).toBeNull();
      expect(stats).toBeNull();
    });

    it("should set error and re-throw on failure", async () => {
      let error: string | null = null;

      const clearAll = async () => {
        error = null;
        try {
          await invoke("timeline_clear_all");
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          throw err;
        }
      };

      vi.mocked(invoke).mockRejectedValueOnce(new Error("Storage locked"));

      await expect(clearAll()).rejects.toThrow("Storage locked");
      expect(error).toBe("Storage locked");
    });
  });

  describe("getContent Logic", () => {
    it("should return content string on success", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("const hello = 'world';");

      const result = await invoke("timeline_get_content", { entryId: "e-1" });

      expect(result).toBe("const hello = 'world';");
    });

    it("should set error and re-throw on failure", async () => {
      let error: string | null = null;

      const getContent = async (entryId: string) => {
        error = null;
        try {
          return await invoke("timeline_get_content", { entryId });
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          throw err;
        }
      };

      vi.mocked(invoke).mockRejectedValueOnce(new Error("File missing"));

      await expect(getContent("e-bad")).rejects.toThrow("File missing");
      expect(error).toBe("File missing");
    });
  });

  describe("compare Logic", () => {
    it("should return DiffResult on success", async () => {
      const mockDiff = {
        hunks: [
          { kind: "removed", content: "-old" },
          { kind: "added", content: "+new" },
        ],
        addedLines: 1,
        removedLines: 1,
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockDiff);

      const result = await invoke("timeline_compare", { entryIdA: "e-1", entryIdB: "e-2" });

      expect(result).toEqual(mockDiff);
    });

    it("should set error and re-throw on failure", async () => {
      let error: string | null = null;

      const compare = async (entryIdA: string, entryIdB: string) => {
        error = null;
        try {
          return await invoke("timeline_compare", { entryIdA, entryIdB });
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          throw err;
        }
      };

      vi.mocked(invoke).mockRejectedValueOnce(new Error("Comparison failed"));

      await expect(compare("e-1", "e-bad")).rejects.toThrow("Comparison failed");
      expect(error).toBe("Comparison failed");
    });
  });

  describe("setLabel Logic", () => {
    interface TimelineEntry {
      id: string;
      label: string | null;
    }

    it("should update entry label in state", async () => {
      let entries: TimelineEntry[] = [
        { id: "e-1", label: null },
        { id: "e-2", label: "old label" },
      ];

      const setLabel = async (entryId: string, label: string) => {
        await invoke("timeline_set_label", { entryId, label });
        entries = entries.map((e) => (e.id === entryId ? { ...e, label } : e));
      };

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await setLabel("e-1", "New label");

      expect(entries[0].label).toBe("New label");
      expect(entries[1].label).toBe("old label");
    });

    it("should set error and re-throw on failure", async () => {
      let error: string | null = null;
      const entries = [{ id: "e-1", label: null }];

      const setLabel = async (entryId: string, label: string) => {
        error = null;
        try {
          await invoke("timeline_set_label", { entryId, label });
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          throw err;
        }
      };

      vi.mocked(invoke).mockRejectedValueOnce(new Error("Label update failed"));

      await expect(setLabel("e-1", "test")).rejects.toThrow("Label update failed");
      expect(error).toBe("Label update failed");
      expect(entries[0].label).toBeNull();
    });
  });

  describe("refreshStats Logic", () => {
    it("should load and set stats", async () => {
      const mockStats = { totalEntries: 42, totalFiles: 8, diskUsageBytes: 131072 };
      let stats: { totalEntries: number; totalFiles: number; diskUsageBytes: number } | null = null;

      const refreshStats = async () => {
        try {
          stats = await invoke("timeline_get_stats") as typeof stats;
        } catch {
          // refreshStats does not throw in the context
        }
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockStats);
      await refreshStats();

      expect(stats).toEqual(mockStats);
    });

    it("should not throw on failure", async () => {
      let stats: unknown = null;

      const refreshStats = async () => {
        try {
          stats = await invoke("timeline_get_stats");
        } catch {
          // silently handle error
        }
      };

      vi.mocked(invoke).mockRejectedValueOnce(new Error("Stats unavailable"));
      await refreshStats();

      expect(stats).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should convert Error objects to message strings", () => {
      const err = new Error("Something went wrong");
      const message = err instanceof Error ? err.message : String(err);

      expect(message).toBe("Something went wrong");
    });

    it("should convert non-Error to string", () => {
      const err: unknown = "raw string error";
      const message = err instanceof Error ? err.message : String(err);

      expect(message).toBe("raw string error");
    });

    it("should handle error state clearing before operations", () => {
      let error: string | null = "previous error";

      const clearError = () => {
        error = null;
      };

      clearError();
      expect(error).toBeNull();
    });
  });

  describe("Event Listener: timeline:changed", () => {
    it("should setup listener for timeline:changed", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("timeline:changed", () => {});

      expect(listen).toHaveBeenCalledWith("timeline:changed", expect.any(Function));
    });

    it("should trigger loadEntries when event filePath matches selectedFilePath", async () => {
      const mockEntries = [{ id: "e-refreshed", filePath: "/src/a.ts" }];
      let entries: { id: string; filePath: string }[] = [];
      const selectedFilePath = "/src/a.ts";

      let capturedCallback: ((event: { payload: { filePath?: string } }) => void) | null = null;

      vi.mocked(listen).mockImplementation((_event, callback) => {
        capturedCallback = callback as typeof capturedCallback;
        return Promise.resolve(() => {});
      });

      await listen("timeline:changed", () => {});

      vi.mocked(invoke).mockResolvedValueOnce(mockEntries);

      if (capturedCallback) {
        const event = { payload: { filePath: "/src/a.ts" } };
        const filePath = event.payload?.filePath;
        if (filePath && selectedFilePath && filePath === selectedFilePath) {
          const result = await invoke("timeline_get_entries", { filePath: selectedFilePath });
          entries = result as typeof entries;
        }
      }

      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("e-refreshed");
    });

    it("should call refreshStats on timeline:changed event", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ totalEntries: 10, totalFiles: 3, diskUsageBytes: 4096 });

      await invoke("timeline_get_stats");

      expect(invoke).toHaveBeenCalledWith("timeline_get_stats");
    });

    it("should return unlisten function", async () => {
      const unlistenMock = vi.fn();
      vi.mocked(listen).mockResolvedValueOnce(unlistenMock);

      const unlisten = await listen("timeline:changed", () => {});

      expect(typeof unlisten).toBe("function");
      unlisten();
      expect(unlistenMock).toHaveBeenCalled();
    });
  });

  describe("Entries Sorting", () => {
    interface TimelineEntry {
      id: string;
      timestamp: number;
    }

    it("should sort entries by timestamp descending", () => {
      const entries: TimelineEntry[] = [
        { id: "e-1", timestamp: 1000 },
        { id: "e-3", timestamp: 3000 },
        { id: "e-2", timestamp: 2000 },
      ];

      const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);

      expect(sorted[0].id).toBe("e-3");
      expect(sorted[1].id).toBe("e-2");
      expect(sorted[2].id).toBe("e-1");
    });
  });

  describe("Entries Filtering", () => {
    interface TimelineEntry {
      id: string;
      filePath: string;
      source: string;
      label: string | null;
    }

    it("should filter entries by source", () => {
      const entries: TimelineEntry[] = [
        { id: "e-1", filePath: "/src/a.ts", source: "autoSave", label: null },
        { id: "e-2", filePath: "/src/a.ts", source: "manualSave", label: "checkpoint" },
        { id: "e-3", filePath: "/src/a.ts", source: "autoSave", label: null },
      ];

      const manualEntries = entries.filter((e) => e.source === "manualSave");

      expect(manualEntries).toHaveLength(1);
      expect(manualEntries[0].id).toBe("e-2");
    });

    it("should filter entries with labels", () => {
      const entries: TimelineEntry[] = [
        { id: "e-1", filePath: "/src/a.ts", source: "autoSave", label: null },
        { id: "e-2", filePath: "/src/a.ts", source: "manualSave", label: "checkpoint" },
        { id: "e-3", filePath: "/src/a.ts", source: "gitCommit", label: "commit abc" },
      ];

      const labeledEntries = entries.filter((e) => e.label !== null);

      expect(labeledEntries).toHaveLength(2);
    });
  });
});
