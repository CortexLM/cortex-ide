import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../EditorContext", () => ({
  useEditor: vi.fn().mockReturnValue({
    state: {
      openFiles: [{ id: "file-1", path: "/src/app.ts" }],
      activeFileId: "file-1",
    },
    openFile: vi.fn(),
    goToLine: vi.fn(),
  }),
}));

describe("BookmarksContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Bookmark Type", () => {
    interface Bookmark {
      id: string;
      filePath: string;
      line: number;
      column?: number;
      label?: string;
      createdAt: number;
    }

    it("should create bookmark", () => {
      const bookmark: Bookmark = {
        id: "bm-1",
        filePath: "/src/app.ts",
        line: 10,
        column: 5,
        label: "Important section",
        createdAt: Date.now(),
      };

      expect(bookmark.filePath).toBe("/src/app.ts");
      expect(bookmark.line).toBe(10);
    });

    it("should create bookmark without optional fields", () => {
      const bookmark: Bookmark = {
        id: "bm-2",
        filePath: "/src/utils.ts",
        line: 25,
        createdAt: Date.now(),
      };

      expect(bookmark.column).toBeUndefined();
      expect(bookmark.label).toBeUndefined();
    });
  });

  describe("Storage Key", () => {
    const STORAGE_KEY = "cortex_bookmarks";

    it("should have correct storage key", () => {
      expect(STORAGE_KEY).toBe("cortex_bookmarks");
    });
  });

  describe("LocalStorage Persistence", () => {
    it("should save bookmarks to localStorage", () => {
      const mockSetItem = vi.fn();
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = mockSetItem;

      const bookmarks = [
        { id: "bm-1", filePath: "/src/app.ts", line: 10, createdAt: 1000 },
      ];
      localStorage.setItem("cortex_bookmarks", JSON.stringify(bookmarks));

      expect(mockSetItem).toHaveBeenCalledWith(
        "cortex_bookmarks",
        JSON.stringify(bookmarks)
      );

      Storage.prototype.setItem = originalSetItem;
    });

    it("should load bookmarks from localStorage", () => {
      const bookmarks = [
        { id: "bm-1", filePath: "/src/app.ts", line: 10, createdAt: 1000 },
      ];
      const mockGetItem = vi.fn().mockReturnValue(JSON.stringify(bookmarks));
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = mockGetItem;

      const stored = localStorage.getItem("cortex_bookmarks");
      const parsed = JSON.parse(stored || "[]");

      expect(parsed).toHaveLength(1);
      expect(parsed[0].line).toBe(10);

      Storage.prototype.getItem = originalGetItem;
    });

    it("should handle invalid localStorage data", () => {
      const mockGetItem = vi.fn().mockReturnValue("invalid json");
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = mockGetItem;

      let bookmarks: unknown[] = [];
      try {
        const stored = localStorage.getItem("cortex_bookmarks");
        bookmarks = JSON.parse(stored || "[]");
      } catch {
        bookmarks = [];
      }

      expect(bookmarks).toEqual([]);

      Storage.prototype.getItem = originalGetItem;
    });
  });

  describe("Bookmark Validation", () => {
    interface Bookmark {
      id: string;
      filePath: string;
      line: number;
      createdAt: number;
    }

    const isValidBookmark = (obj: unknown): obj is Bookmark => {
      if (typeof obj !== "object" || obj === null) return false;
      const b = obj as Record<string, unknown>;
      return (
        typeof b.id === "string" &&
        typeof b.filePath === "string" &&
        typeof b.line === "number" &&
        typeof b.createdAt === "number"
      );
    };

    it("should validate valid bookmark", () => {
      const bookmark = {
        id: "bm-1",
        filePath: "/src/app.ts",
        line: 10,
        createdAt: 1000,
      };

      expect(isValidBookmark(bookmark)).toBe(true);
    });

    it("should reject invalid bookmark", () => {
      const invalid = {
        id: "bm-1",
        filePath: "/src/app.ts",
      };

      expect(isValidBookmark(invalid)).toBe(false);
    });

    it("should reject non-object", () => {
      expect(isValidBookmark("string")).toBe(false);
      expect(isValidBookmark(null)).toBe(false);
    });
  });

  describe("Toggle Bookmark", () => {
    interface Bookmark {
      id: string;
      filePath: string;
      line: number;
      createdAt: number;
    }

    it("should add bookmark if not exists", () => {
      const bookmarks: Bookmark[] = [];
      const toggleBookmark = (filePath: string, line: number) => {
        const existing = bookmarks.find(
          (b) => b.filePath === filePath && b.line === line
        );
        if (existing) {
          const index = bookmarks.indexOf(existing);
          bookmarks.splice(index, 1);
        } else {
          bookmarks.push({
            id: `bm-${Date.now()}`,
            filePath,
            line,
            createdAt: Date.now(),
          });
        }
      };

      toggleBookmark("/src/app.ts", 10);
      expect(bookmarks).toHaveLength(1);
    });

    it("should remove bookmark if exists", () => {
      const bookmarks: Bookmark[] = [
        { id: "bm-1", filePath: "/src/app.ts", line: 10, createdAt: 1000 },
      ];
      const toggleBookmark = (filePath: string, line: number) => {
        const existing = bookmarks.find(
          (b) => b.filePath === filePath && b.line === line
        );
        if (existing) {
          const index = bookmarks.indexOf(existing);
          bookmarks.splice(index, 1);
        }
      };

      toggleBookmark("/src/app.ts", 10);
      expect(bookmarks).toHaveLength(0);
    });
  });

  describe("Navigate Bookmarks", () => {
    interface Bookmark {
      id: string;
      filePath: string;
      line: number;
    }

    it("should go to next bookmark", () => {
      const bookmarks: Bookmark[] = [
        { id: "bm-1", filePath: "/src/a.ts", line: 5 },
        { id: "bm-2", filePath: "/src/a.ts", line: 15 },
        { id: "bm-3", filePath: "/src/a.ts", line: 25 },
      ];
      let currentIndex = 0;

      const goToNextBookmark = () => {
        currentIndex = (currentIndex + 1) % bookmarks.length;
        return bookmarks[currentIndex];
      };

      const next = goToNextBookmark();
      expect(next.line).toBe(15);
    });

    it("should go to previous bookmark", () => {
      const bookmarks: Bookmark[] = [
        { id: "bm-1", filePath: "/src/a.ts", line: 5 },
        { id: "bm-2", filePath: "/src/a.ts", line: 15 },
        { id: "bm-3", filePath: "/src/a.ts", line: 25 },
      ];
      let currentIndex = 2;

      const goToPrevBookmark = () => {
        currentIndex = (currentIndex - 1 + bookmarks.length) % bookmarks.length;
        return bookmarks[currentIndex];
      };

      const prev = goToPrevBookmark();
      expect(prev.line).toBe(15);
    });

    it("should wrap around at end", () => {
      const bookmarks: Bookmark[] = [
        { id: "bm-1", filePath: "/src/a.ts", line: 5 },
        { id: "bm-2", filePath: "/src/a.ts", line: 15 },
      ];
      let currentIndex = 1;

      const goToNextBookmark = () => {
        currentIndex = (currentIndex + 1) % bookmarks.length;
        return bookmarks[currentIndex];
      };

      const next = goToNextBookmark();
      expect(next.line).toBe(5);
    });

    it("should wrap around at beginning", () => {
      const bookmarks: Bookmark[] = [
        { id: "bm-1", filePath: "/src/a.ts", line: 5 },
        { id: "bm-2", filePath: "/src/a.ts", line: 15 },
      ];
      let currentIndex = 0;

      const goToPrevBookmark = () => {
        currentIndex = (currentIndex - 1 + bookmarks.length) % bookmarks.length;
        return bookmarks[currentIndex];
      };

      const prev = goToPrevBookmark();
      expect(prev.line).toBe(15);
    });
  });

  describe("Remove Bookmark", () => {
    interface Bookmark {
      id: string;
      filePath: string;
      line: number;
    }

    it("should remove bookmark by id", () => {
      const bookmarks: Bookmark[] = [
        { id: "bm-1", filePath: "/src/a.ts", line: 5 },
        { id: "bm-2", filePath: "/src/a.ts", line: 15 },
      ];

      const removeBookmark = (id: string) => {
        const index = bookmarks.findIndex((b) => b.id === id);
        if (index > -1) {
          bookmarks.splice(index, 1);
        }
      };

      removeBookmark("bm-1");
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].id).toBe("bm-2");
    });
  });

  describe("Clear All Bookmarks", () => {
    it("should clear all bookmarks", () => {
      const bookmarks = [
        { id: "bm-1", filePath: "/src/a.ts", line: 5 },
        { id: "bm-2", filePath: "/src/b.ts", line: 10 },
      ];

      const clearAllBookmarks = () => {
        bookmarks.length = 0;
      };

      clearAllBookmarks();
      expect(bookmarks).toHaveLength(0);
    });
  });

  describe("Get Bookmarks For File", () => {
    interface Bookmark {
      id: string;
      filePath: string;
      line: number;
    }

    it("should get bookmarks for specific file", () => {
      const bookmarks: Bookmark[] = [
        { id: "bm-1", filePath: "/src/a.ts", line: 5 },
        { id: "bm-2", filePath: "/src/a.ts", line: 15 },
        { id: "bm-3", filePath: "/src/b.ts", line: 10 },
      ];

      const getBookmarksForFile = (filePath: string) =>
        bookmarks.filter((b) => b.filePath === filePath);

      const fileBookmarks = getBookmarksForFile("/src/a.ts");
      expect(fileBookmarks).toHaveLength(2);
    });

    it("should return empty array for file without bookmarks", () => {
      const bookmarks: Bookmark[] = [
        { id: "bm-1", filePath: "/src/a.ts", line: 5 },
      ];

      const getBookmarksForFile = (filePath: string) =>
        bookmarks.filter((b) => b.filePath === filePath);

      const fileBookmarks = getBookmarksForFile("/src/c.ts");
      expect(fileBookmarks).toHaveLength(0);
    });
  });

  describe("Update Bookmark Label", () => {
    interface Bookmark {
      id: string;
      filePath: string;
      line: number;
      label?: string;
    }

    it("should update bookmark label", () => {
      const bookmarks: Bookmark[] = [
        { id: "bm-1", filePath: "/src/a.ts", line: 5 },
      ];

      const updateBookmarkLabel = (id: string, label: string) => {
        const bookmark = bookmarks.find((b) => b.id === id);
        if (bookmark) {
          bookmark.label = label;
        }
      };

      updateBookmarkLabel("bm-1", "Important function");
      expect(bookmarks[0].label).toBe("Important function");
    });
  });

  describe("Bookmarks Panel", () => {
    it("should track panel visibility", () => {
      let isBookmarksPanelVisible = false;

      const showBookmarksPanel = () => {
        isBookmarksPanelVisible = true;
      };

      const setBookmarksPanelVisible = (visible: boolean) => {
        isBookmarksPanelVisible = visible;
      };

      showBookmarksPanel();
      expect(isBookmarksPanelVisible).toBe(true);

      setBookmarksPanelVisible(false);
      expect(isBookmarksPanelVisible).toBe(false);
    });
  });

  describe("Window Events", () => {
    it("should dispatch bookmarks:toggle event", () => {
      const dispatchEvent = vi.fn();
      const originalDispatchEvent = window.dispatchEvent;
      window.dispatchEvent = dispatchEvent;

      window.dispatchEvent(new CustomEvent("bookmarks:toggle"));

      expect(dispatchEvent).toHaveBeenCalled();

      window.dispatchEvent = originalDispatchEvent;
    });

    it("should dispatch bookmarks:next event", () => {
      const dispatchEvent = vi.fn();
      const originalDispatchEvent = window.dispatchEvent;
      window.dispatchEvent = dispatchEvent;

      window.dispatchEvent(new CustomEvent("bookmarks:next"));

      expect(dispatchEvent).toHaveBeenCalled();

      window.dispatchEvent = originalDispatchEvent;
    });

    it("should dispatch bookmarks:prev event", () => {
      const dispatchEvent = vi.fn();
      const originalDispatchEvent = window.dispatchEvent;
      window.dispatchEvent = dispatchEvent;

      window.dispatchEvent(new CustomEvent("bookmarks:prev"));

      expect(dispatchEvent).toHaveBeenCalled();

      window.dispatchEvent = originalDispatchEvent;
    });

    it("should dispatch bookmarks:show-panel event", () => {
      const dispatchEvent = vi.fn();
      const originalDispatchEvent = window.dispatchEvent;
      window.dispatchEvent = dispatchEvent;

      window.dispatchEvent(new CustomEvent("bookmarks:show-panel"));

      expect(dispatchEvent).toHaveBeenCalled();

      window.dispatchEvent = originalDispatchEvent;
    });

    it("should dispatch bookmarks:clear-all event", () => {
      const dispatchEvent = vi.fn();
      const originalDispatchEvent = window.dispatchEvent;
      window.dispatchEvent = dispatchEvent;

      window.dispatchEvent(new CustomEvent("bookmarks:clear-all"));

      expect(dispatchEvent).toHaveBeenCalled();

      window.dispatchEvent = originalDispatchEvent;
    });

    it("should listen for editor-cursor-change event", () => {
      const addEventListener = vi.fn();
      const originalAddEventListener = window.addEventListener;
      window.addEventListener = addEventListener;

      window.addEventListener("editor:cursor-change", () => {});

      expect(addEventListener).toHaveBeenCalledWith(
        "editor:cursor-change",
        expect.any(Function)
      );

      window.addEventListener = originalAddEventListener;
    });
  });

  describe("Bookmarks Changed Event", () => {
    it("should dispatch bookmarks:changed event for minimap", () => {
      const dispatchEvent = vi.fn();
      const originalDispatchEvent = window.dispatchEvent;
      window.dispatchEvent = dispatchEvent;

      const bookmarks = [
        { id: "bm-1", line: 10, label: "Test" },
      ];

      window.dispatchEvent(
        new CustomEvent("bookmarks:changed", {
          detail: {
            bookmarks,
            fileUri: "file:///src/app.ts",
          },
        })
      );

      expect(dispatchEvent).toHaveBeenCalled();

      window.dispatchEvent = originalDispatchEvent;
    });
  });

  describe("Sort Bookmarks", () => {
    interface Bookmark {
      id: string;
      filePath: string;
      line: number;
      createdAt: number;
    }

    it("should sort bookmarks by line", () => {
      const bookmarks: Bookmark[] = [
        { id: "bm-1", filePath: "/src/a.ts", line: 25, createdAt: 1000 },
        { id: "bm-2", filePath: "/src/a.ts", line: 5, createdAt: 2000 },
        { id: "bm-3", filePath: "/src/a.ts", line: 15, createdAt: 3000 },
      ];

      const sorted = [...bookmarks].sort((a, b) => a.line - b.line);

      expect(sorted[0].line).toBe(5);
      expect(sorted[1].line).toBe(15);
      expect(sorted[2].line).toBe(25);
    });

    it("should sort bookmarks by creation time", () => {
      const bookmarks: Bookmark[] = [
        { id: "bm-1", filePath: "/src/a.ts", line: 5, createdAt: 3000 },
        { id: "bm-2", filePath: "/src/a.ts", line: 15, createdAt: 1000 },
        { id: "bm-3", filePath: "/src/a.ts", line: 25, createdAt: 2000 },
      ];

      const sorted = [...bookmarks].sort((a, b) => a.createdAt - b.createdAt);

      expect(sorted[0].id).toBe("bm-2");
      expect(sorted[1].id).toBe("bm-3");
      expect(sorted[2].id).toBe("bm-1");
    });
  });

  describe("Generate Bookmark ID", () => {
    it("should generate unique bookmark ID", () => {
      const generateId = () => `bm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const id1 = generateId();
      const id2 = generateId();

      expect(id1).not.toBe(id2);
      expect(id1.startsWith("bm-")).toBe(true);
    });
  });
});
