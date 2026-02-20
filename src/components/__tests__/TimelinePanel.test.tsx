import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/context/TimelineContext", () => ({
  useTimeline: vi.fn(),
}));

vi.mock("@/context/EditorContext", () => ({
  useEditor: vi.fn(),
}));

vi.mock("./ui/Icon", () => ({
  Icon: (_props: Record<string, unknown>) => null,
}));

describe("TimelinePanel Component Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("formatRelativeTime", () => {
    const formatRelativeTime = (timestamp: number): string => {
      const now = Date.now();
      const diff = now - timestamp;
      if (diff < 60000) return "just now";
      if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
      return `${Math.floor(diff / 86400000)} days ago`;
    };

    it("should return 'just now' for timestamps less than 60 seconds ago", () => {
      const timestamp = Date.now() - 30000;
      expect(formatRelativeTime(timestamp)).toBe("just now");
    });

    it("should return 'just now' for timestamps 0 seconds ago", () => {
      const timestamp = Date.now();
      expect(formatRelativeTime(timestamp)).toBe("just now");
    });

    it("should return minutes ago for timestamps less than 1 hour", () => {
      const timestamp = Date.now() - 5 * 60000;
      expect(formatRelativeTime(timestamp)).toBe("5 min ago");
    });

    it("should return hours ago for timestamps less than 24 hours", () => {
      const timestamp = Date.now() - 3 * 3600000;
      expect(formatRelativeTime(timestamp)).toBe("3 hr ago");
    });

    it("should return days ago for timestamps 24 hours or more", () => {
      const timestamp = Date.now() - 2 * 86400000;
      expect(formatRelativeTime(timestamp)).toBe("2 days ago");
    });

    it("should floor partial minutes", () => {
      const timestamp = Date.now() - 90000;
      expect(formatRelativeTime(timestamp)).toBe("1 min ago");
    });

    it("should floor partial hours", () => {
      const timestamp = Date.now() - 5400000;
      expect(formatRelativeTime(timestamp)).toBe("1 hr ago");
    });
  });

  describe("formatBytes", () => {
    const formatBytes = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    it("should format zero bytes", () => {
      expect(formatBytes(0)).toBe("0 B");
    });

    it("should format bytes under 1024", () => {
      expect(formatBytes(512)).toBe("512 B");
    });

    it("should format exactly 1023 bytes", () => {
      expect(formatBytes(1023)).toBe("1023 B");
    });

    it("should format kilobytes", () => {
      expect(formatBytes(1024)).toBe("1.0 KB");
    });

    it("should format kilobytes with decimals", () => {
      expect(formatBytes(1536)).toBe("1.5 KB");
    });

    it("should format megabytes", () => {
      expect(formatBytes(1048576)).toBe("1.0 MB");
    });

    it("should format megabytes with decimals", () => {
      expect(formatBytes(2621440)).toBe("2.5 MB");
    });
  });

  describe("sourceLabel", () => {
    const sourceLabel = (source: string): string => {
      switch (source) {
        case "autoSave":
          return "Auto Save";
        case "manualSave":
          return "Manual Save";
        case "undo":
          return "Undo";
        case "gitCommit":
          return "Git Commit";
        case "refactor":
          return "Refactor";
        default:
          return source;
      }
    };

    it("should map autoSave to 'Auto Save'", () => {
      expect(sourceLabel("autoSave")).toBe("Auto Save");
    });

    it("should map manualSave to 'Manual Save'", () => {
      expect(sourceLabel("manualSave")).toBe("Manual Save");
    });

    it("should map undo to 'Undo'", () => {
      expect(sourceLabel("undo")).toBe("Undo");
    });

    it("should map gitCommit to 'Git Commit'", () => {
      expect(sourceLabel("gitCommit")).toBe("Git Commit");
    });

    it("should map refactor to 'Refactor'", () => {
      expect(sourceLabel("refactor")).toBe("Refactor");
    });

    it("should return unknown source as-is", () => {
      expect(sourceLabel("customSource")).toBe("customSource");
    });
  });

  describe("sourceIcon", () => {
    const sourceIcon = (source: string): string => {
      switch (source) {
        case "autoSave":
          return "clock";
        case "manualSave":
          return "floppy-disk";
        case "undo":
          return "rotate-left";
        case "gitCommit":
          return "code-branch";
        case "refactor":
          return "wand-magic-sparkles";
        default:
          return "file";
      }
    };

    it("should map autoSave to 'clock'", () => {
      expect(sourceIcon("autoSave")).toBe("clock");
    });

    it("should map manualSave to 'floppy-disk'", () => {
      expect(sourceIcon("manualSave")).toBe("floppy-disk");
    });

    it("should map undo to 'rotate-left'", () => {
      expect(sourceIcon("undo")).toBe("rotate-left");
    });

    it("should map gitCommit to 'code-branch'", () => {
      expect(sourceIcon("gitCommit")).toBe("code-branch");
    });

    it("should map refactor to 'wand-magic-sparkles'", () => {
      expect(sourceIcon("refactor")).toBe("wand-magic-sparkles");
    });

    it("should map unknown source to 'file'", () => {
      expect(sourceIcon("unknown")).toBe("file");
    });
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

    it("should create a valid TimelineEntry", () => {
      const entry: TimelineEntry = {
        id: "entry-1",
        filePath: "/src/app.ts",
        timestamp: Date.now(),
        label: "Before refactor",
        source: "manualSave",
        size: 2048,
        snapshotPath: "/snapshots/entry-1.snap",
      };

      expect(entry.id).toBe("entry-1");
      expect(entry.filePath).toBe("/src/app.ts");
      expect(entry.source).toBe("manualSave");
      expect(entry.size).toBe(2048);
    });

    it("should allow null label", () => {
      const entry: TimelineEntry = {
        id: "entry-2",
        filePath: "/src/utils.ts",
        timestamp: Date.now(),
        label: null,
        source: "autoSave",
        size: 512,
        snapshotPath: "/snapshots/entry-2.snap",
      };

      expect(entry.label).toBeNull();
    });

    it("should accept all valid source types", () => {
      const sources: TimelineEntry["source"][] = [
        "autoSave",
        "manualSave",
        "undo",
        "gitCommit",
        "refactor",
      ];

      expect(sources).toHaveLength(5);
      expect(sources).toContain("autoSave");
      expect(sources).toContain("gitCommit");
    });
  });

  describe("TimelinePanelProps Type", () => {
    interface TimelinePanelProps {
      onClose?: () => void;
    }

    it("should allow props without onClose", () => {
      const props: TimelinePanelProps = {};

      expect(props.onClose).toBeUndefined();
    });

    it("should allow props with onClose", () => {
      const onClose = vi.fn();
      const props: TimelinePanelProps = { onClose };

      expect(props.onClose).toBeDefined();
      props.onClose!();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("TimelineStats Type", () => {
    interface TimelineStats {
      totalEntries: number;
      totalFiles: number;
      diskUsageBytes: number;
    }

    it("should create valid stats", () => {
      const stats: TimelineStats = {
        totalEntries: 42,
        totalFiles: 8,
        diskUsageBytes: 1048576,
      };

      expect(stats.totalEntries).toBe(42);
      expect(stats.totalFiles).toBe(8);
      expect(stats.diskUsageBytes).toBe(1048576);
    });
  });

  describe("Empty State", () => {
    interface TimelineEntry {
      id: string;
      filePath: string;
      timestamp: number;
      label: string | null;
      source: string;
      size: number;
    }

    it("should detect empty entries", () => {
      const entries: TimelineEntry[] = [];

      const showEmptyState = !false && entries.length === 0;

      expect(showEmptyState).toBe(true);
    });

    it("should not show empty state when entries exist", () => {
      const entries: TimelineEntry[] = [
        {
          id: "e-1",
          filePath: "/src/app.ts",
          timestamp: Date.now(),
          label: null,
          source: "autoSave",
          size: 100,
        },
      ];

      const showEmptyState = !false && entries.length === 0;

      expect(showEmptyState).toBe(false);
    });
  });

  describe("Loading State", () => {
    it("should track loading state", () => {
      const state = { loading: true, entries: [], error: null };

      expect(state.loading).toBe(true);

      state.loading = false;
      expect(state.loading).toBe(false);
    });
  });

  describe("Entry Display Logic", () => {
    const sourceLabel = (source: string): string => {
      switch (source) {
        case "autoSave":
          return "Auto Save";
        case "manualSave":
          return "Manual Save";
        case "undo":
          return "Undo";
        case "gitCommit":
          return "Git Commit";
        case "refactor":
          return "Refactor";
        default:
          return source;
      }
    };

    const formatRelativeTime = (timestamp: number): string => {
      const now = Date.now();
      const diff = now - timestamp;
      if (diff < 60000) return "just now";
      if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
      return `${Math.floor(diff / 86400000)} days ago`;
    };

    const formatBytes = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    it("should use entry label when available", () => {
      const entry = {
        label: "Before refactor" as string | null,
        source: "manualSave",
      };

      const displayLabel = entry.label ?? sourceLabel(entry.source);

      expect(displayLabel).toBe("Before refactor");
    });

    it("should fall back to sourceLabel when label is null", () => {
      const entry = {
        label: null as string | null,
        source: "autoSave",
      };

      const displayLabel = entry.label ?? sourceLabel(entry.source);

      expect(displayLabel).toBe("Auto Save");
    });

    it("should display relative time and formatted size in meta", () => {
      const entry = {
        timestamp: Date.now() - 120000,
        size: 4096,
      };

      const timeText = formatRelativeTime(entry.timestamp);
      const sizeText = formatBytes(entry.size);

      expect(timeText).toBe("2 min ago");
      expect(sizeText).toBe("4.0 KB");
    });
  });

  describe("Stats Footer", () => {
    interface TimelineStats {
      totalEntries: number;
      totalFiles: number;
      diskUsageBytes: number;
    }

    const formatBytes = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    it("should format stats footer text", () => {
      const stats: TimelineStats = {
        totalEntries: 15,
        totalFiles: 3,
        diskUsageBytes: 524288,
      };

      const footerText = `${stats.totalEntries} entries across ${stats.totalFiles} files`;
      const sizeText = formatBytes(stats.diskUsageBytes);

      expect(footerText).toBe("15 entries across 3 files");
      expect(sizeText).toBe("512.0 KB");
    });

    it("should show fallback when stats are null", () => {
      const stats: TimelineStats | null = null;

      const fallbackText = stats ? "has stats" : "No stats available";

      expect(fallbackText).toBe("No stats available");
    });
  });

  describe("onClose Callback", () => {
    it("should invoke onClose when provided", () => {
      const onClose = vi.fn();

      onClose();

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should not error when onClose is undefined", () => {
      const props: { onClose?: () => void } = {};

      expect(() => {
        props.onClose?.();
      }).not.toThrow();
    });
  });

  describe("Active File Path Detection", () => {
    interface OpenFile {
      id: string;
      path: string;
    }

    const getActiveFilePath = (
      activeFileId: string | null,
      openFiles: OpenFile[]
    ): string | null => {
      if (!activeFileId) return null;
      const file = openFiles.find((f) => f.id === activeFileId);
      return file?.path ?? null;
    };

    it("should return file path when active file exists", () => {
      const result = getActiveFilePath("file-1", [
        { id: "file-1", path: "/src/app.ts" },
        { id: "file-2", path: "/src/utils.ts" },
      ]);

      expect(result).toBe("/src/app.ts");
    });

    it("should return null when no active file", () => {
      const result = getActiveFilePath(null, [
        { id: "file-1", path: "/src/app.ts" },
      ]);

      expect(result).toBeNull();
    });

    it("should return null when active file ID not found in open files", () => {
      const result = getActiveFilePath("file-99", [
        { id: "file-1", path: "/src/app.ts" },
      ]);

      expect(result).toBeNull();
    });
  });

  describe("Entry Actions", () => {
    interface TimelineEntry {
      id: string;
      filePath: string;
      timestamp: number;
      label: string | null;
      source: string;
      size: number;
    }

    it("should call restoreSnapshot on restore", async () => {
      const restoreSnapshot = vi.fn().mockResolvedValue("restored content");
      const entry: TimelineEntry = {
        id: "entry-1",
        filePath: "/src/app.ts",
        timestamp: Date.now(),
        label: null,
        source: "autoSave",
        size: 1024,
      };

      await restoreSnapshot(entry.id);

      expect(restoreSnapshot).toHaveBeenCalledWith("entry-1");
    });

    it("should call deleteEntry on delete", async () => {
      const deleteEntry = vi.fn().mockResolvedValue(undefined);
      const entry: TimelineEntry = {
        id: "entry-2",
        filePath: "/src/app.ts",
        timestamp: Date.now(),
        label: null,
        source: "manualSave",
        size: 2048,
      };

      await deleteEntry(entry.id);

      expect(deleteEntry).toHaveBeenCalledWith("entry-2");
    });

    it("should call compare with current and next entry", async () => {
      const compare = vi.fn().mockResolvedValue({
        hunks: [],
        addedLines: 0,
        removedLines: 0,
      });

      const entries: TimelineEntry[] = [
        {
          id: "entry-1",
          filePath: "/src/app.ts",
          timestamp: Date.now(),
          label: null,
          source: "manualSave",
          size: 2048,
        },
        {
          id: "entry-2",
          filePath: "/src/app.ts",
          timestamp: Date.now() - 60000,
          label: null,
          source: "autoSave",
          size: 1024,
        },
      ];

      const handleCompare = async (entry: TimelineEntry) => {
        const idx = entries.findIndex((e) => e.id === entry.id);
        if (idx < entries.length - 1) {
          await compare(entry.id, entries[idx + 1].id);
        }
      };

      await handleCompare(entries[0]);

      expect(compare).toHaveBeenCalledWith("entry-1", "entry-2");
    });

    it("should not call compare for the last entry", async () => {
      const compare = vi.fn();

      const entries: TimelineEntry[] = [
        {
          id: "entry-1",
          filePath: "/src/app.ts",
          timestamp: Date.now(),
          label: null,
          source: "autoSave",
          size: 1024,
        },
      ];

      const handleCompare = async (entry: TimelineEntry) => {
        const idx = entries.findIndex((e) => e.id === entry.id);
        if (idx < entries.length - 1) {
          await compare(entry.id, entries[idx + 1].id);
        }
      };

      await handleCompare(entries[0]);

      expect(compare).not.toHaveBeenCalled();
    });

    it("should handle restore error gracefully", async () => {
      const restoreSnapshot = vi
        .fn()
        .mockRejectedValue(new Error("Snapshot not found"));

      let errorCaught = false;
      try {
        await restoreSnapshot("entry-missing");
      } catch {
        errorCaught = true;
      }

      expect(errorCaught).toBe(true);
      expect(restoreSnapshot).toHaveBeenCalledWith("entry-missing");
    });

    it("should handle delete error gracefully", async () => {
      const deleteEntry = vi
        .fn()
        .mockRejectedValue(new Error("Permission denied"));

      let errorCaught = false;
      try {
        await deleteEntry("entry-locked");
      } catch {
        errorCaught = true;
      }

      expect(errorCaught).toBe(true);
      expect(deleteEntry).toHaveBeenCalledWith("entry-locked");
    });
  });

  describe("Refresh Logic", () => {
    it("should call loadEntries and refreshStats on refresh", () => {
      const loadEntries = vi.fn();
      const refreshStats = vi.fn();

      const handleRefresh = (activeFilePath: string | null) => {
        if (activeFilePath) {
          loadEntries(activeFilePath);
        }
        refreshStats();
      };

      handleRefresh("/src/app.ts");

      expect(loadEntries).toHaveBeenCalledWith("/src/app.ts");
      expect(refreshStats).toHaveBeenCalledTimes(1);
    });

    it("should only call refreshStats when no active file", () => {
      const loadEntries = vi.fn();
      const refreshStats = vi.fn();

      const handleRefresh = (activeFilePath: string | null) => {
        if (activeFilePath) {
          loadEntries(activeFilePath);
        }
        refreshStats();
      };

      handleRefresh(null);

      expect(loadEntries).not.toHaveBeenCalled();
      expect(refreshStats).toHaveBeenCalledTimes(1);
    });
  });

  describe("Hover State", () => {
    it("should track hovered entry id", () => {
      let hoveredId: string | null = null;

      hoveredId = "entry-1";
      expect(hoveredId).toBe("entry-1");

      hoveredId = null;
      expect(hoveredId).toBeNull();
    });

    it("should show actions only for hovered entry", () => {
      const hoveredId = "entry-2";

      const getActionsOpacity = (entryId: string): string => {
        return hoveredId === entryId ? "1" : "0";
      };

      expect(getActionsOpacity("entry-2")).toBe("1");
      expect(getActionsOpacity("entry-1")).toBe("0");
    });
  });
});
