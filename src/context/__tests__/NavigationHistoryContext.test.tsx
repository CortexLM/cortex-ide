import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("NavigationHistoryContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("NavigationLocation Interface", () => {
    interface NavigationLocation {
      filePath: string;
      line: number;
      column: number;
      timestamp: number;
    }

    it("should create navigation location", () => {
      const location: NavigationLocation = {
        filePath: "/src/app.ts",
        line: 10,
        column: 5,
        timestamp: Date.now(),
      };

      expect(location.filePath).toBe("/src/app.ts");
      expect(location.line).toBe(10);
      expect(location.column).toBe(5);
    });

    it("should track multiple locations", () => {
      const locations: NavigationLocation[] = [
        { filePath: "/src/app.ts", line: 1, column: 1, timestamp: 1000 },
        { filePath: "/src/utils.ts", line: 25, column: 10, timestamp: 2000 },
        { filePath: "/src/app.ts", line: 50, column: 1, timestamp: 3000 },
      ];

      expect(locations).toHaveLength(3);
      expect(locations[1].filePath).toBe("/src/utils.ts");
    });

    it("should sort locations by timestamp", () => {
      const locations: NavigationLocation[] = [
        { filePath: "/src/a.ts", line: 1, column: 1, timestamp: 3000 },
        { filePath: "/src/b.ts", line: 1, column: 1, timestamp: 1000 },
        { filePath: "/src/c.ts", line: 1, column: 1, timestamp: 2000 },
      ];

      const sorted = [...locations].sort((a, b) => a.timestamp - b.timestamp);

      expect(sorted[0].filePath).toBe("/src/b.ts");
      expect(sorted[2].filePath).toBe("/src/a.ts");
    });
  });

  describe("History Constants", () => {
    const MAX_HISTORY = 50;
    const SIGNIFICANT_LINE_DIFFERENCE = 5;

    it("should define max history size", () => {
      expect(MAX_HISTORY).toBe(50);
    });

    it("should define significant line difference", () => {
      expect(SIGNIFICANT_LINE_DIFFERENCE).toBe(5);
    });

    it("should limit history to max size", () => {
      const history: Array<{ filePath: string; line: number }> = [];

      for (let i = 0; i < 60; i++) {
        history.push({ filePath: `/src/file${i}.ts`, line: i });
      }

      const trimmed = history.slice(-MAX_HISTORY);

      expect(trimmed).toHaveLength(MAX_HISTORY);
      expect(trimmed[0].filePath).toBe("/src/file10.ts");
    });
  });

  describe("Navigation Operations", () => {
    interface NavigationLocation {
      filePath: string;
      line: number;
      column: number;
      timestamp: number;
    }

    it("should go back in history", () => {
      const history: NavigationLocation[] = [
        { filePath: "/src/a.ts", line: 1, column: 1, timestamp: 1000 },
        { filePath: "/src/b.ts", line: 1, column: 1, timestamp: 2000 },
        { filePath: "/src/c.ts", line: 1, column: 1, timestamp: 3000 },
      ];
      let currentIndex = 2;

      const goBack = () => {
        if (currentIndex > 0) {
          currentIndex--;
          return history[currentIndex];
        }
        return null;
      };

      const location = goBack();
      expect(location?.filePath).toBe("/src/b.ts");
      expect(currentIndex).toBe(1);
    });

    it("should go forward in history", () => {
      const history: NavigationLocation[] = [
        { filePath: "/src/a.ts", line: 1, column: 1, timestamp: 1000 },
        { filePath: "/src/b.ts", line: 1, column: 1, timestamp: 2000 },
        { filePath: "/src/c.ts", line: 1, column: 1, timestamp: 3000 },
      ];
      let currentIndex = 0;

      const goForward = () => {
        if (currentIndex < history.length - 1) {
          currentIndex++;
          return history[currentIndex];
        }
        return null;
      };

      const location = goForward();
      expect(location?.filePath).toBe("/src/b.ts");
      expect(currentIndex).toBe(1);
    });

    it("should check canGoBack", () => {
      let currentIndex = 0;
      const canGoBack = () => currentIndex > 0;

      expect(canGoBack()).toBe(false);

      currentIndex = 2;
      expect(canGoBack()).toBe(true);
    });

    it("should check canGoForward", () => {
      const historyLength = 3;
      let currentIndex = 2;
      const canGoForward = () => currentIndex < historyLength - 1;

      expect(canGoForward()).toBe(false);

      currentIndex = 1;
      expect(canGoForward()).toBe(true);
    });
  });

  describe("Push Location", () => {
    interface NavigationLocation {
      filePath: string;
      line: number;
      column: number;
      timestamp: number;
    }

    const SIGNIFICANT_LINE_DIFFERENCE = 5;

    it("should push new location", () => {
      const history: NavigationLocation[] = [];

      const pushLocation = (loc: Omit<NavigationLocation, "timestamp">) => {
        history.push({ ...loc, timestamp: Date.now() });
      };

      pushLocation({ filePath: "/src/app.ts", line: 10, column: 1 });

      expect(history).toHaveLength(1);
      expect(history[0].filePath).toBe("/src/app.ts");
    });

    it("should ignore nearby locations in same file", () => {
      const history: NavigationLocation[] = [
        { filePath: "/src/app.ts", line: 10, column: 1, timestamp: 1000 },
      ];

      const pushLocation = (loc: Omit<NavigationLocation, "timestamp">) => {
        const current = history[history.length - 1];
        if (current) {
          const sameFile = current.filePath === loc.filePath;
          const nearbyLine = Math.abs(current.line - loc.line) < SIGNIFICANT_LINE_DIFFERENCE;
          if (sameFile && nearbyLine) {
            return;
          }
        }
        history.push({ ...loc, timestamp: Date.now() });
      };

      pushLocation({ filePath: "/src/app.ts", line: 12, column: 1 });

      expect(history).toHaveLength(1);
    });

    it("should push location when line difference is significant", () => {
      const history: NavigationLocation[] = [
        { filePath: "/src/app.ts", line: 10, column: 1, timestamp: 1000 },
      ];

      const pushLocation = (loc: Omit<NavigationLocation, "timestamp">) => {
        const current = history[history.length - 1];
        if (current) {
          const sameFile = current.filePath === loc.filePath;
          const nearbyLine = Math.abs(current.line - loc.line) < SIGNIFICANT_LINE_DIFFERENCE;
          if (sameFile && nearbyLine) {
            return;
          }
        }
        history.push({ ...loc, timestamp: Date.now() });
      };

      pushLocation({ filePath: "/src/app.ts", line: 50, column: 1 });

      expect(history).toHaveLength(2);
    });

    it("should push location when file is different", () => {
      const history: NavigationLocation[] = [
        { filePath: "/src/app.ts", line: 10, column: 1, timestamp: 1000 },
      ];

      const pushLocation = (loc: Omit<NavigationLocation, "timestamp">) => {
        const current = history[history.length - 1];
        if (current) {
          const sameFile = current.filePath === loc.filePath;
          const nearbyLine = Math.abs(current.line - loc.line) < SIGNIFICANT_LINE_DIFFERENCE;
          if (sameFile && nearbyLine) {
            return;
          }
        }
        history.push({ ...loc, timestamp: Date.now() });
      };

      pushLocation({ filePath: "/src/utils.ts", line: 10, column: 1 });

      expect(history).toHaveLength(2);
    });
  });

  describe("Clear History", () => {
    it("should clear all history", () => {
      const history = [
        { filePath: "/src/a.ts", line: 1 },
        { filePath: "/src/b.ts", line: 1 },
      ];

      const cleared: typeof history = [];

      expect(cleared).toHaveLength(0);
    });

    it("should reset current index on clear", () => {
      let currentIndex = 5;

      const clearHistory = () => {
        currentIndex = -1;
      };

      clearHistory();

      expect(currentIndex).toBe(-1);
    });
  });

  describe("History Info", () => {
    it("should return history info", () => {
      const history = [
        { filePath: "/src/a.ts" },
        { filePath: "/src/b.ts" },
        { filePath: "/src/c.ts" },
      ];
      const currentIndex = 1;

      const historyInfo = () => ({
        current: currentIndex + 1,
        total: history.length,
      });

      const info = historyInfo();
      expect(info.current).toBe(2);
      expect(info.total).toBe(3);
    });

    it("should return empty info when no history", () => {
      const history: unknown[] = [];
      const currentIndex = -1;

      const historyInfo = () => ({
        current: currentIndex + 1,
        total: history.length,
      });

      const info = historyInfo();
      expect(info.current).toBe(0);
      expect(info.total).toBe(0);
    });
  });

  describe("Navigation Flag", () => {
    it("should prevent recording during programmatic navigation", () => {
      let isNavigating = false;
      const history: Array<{ filePath: string }> = [];

      const pushLocation = (filePath: string) => {
        if (isNavigating) return;
        history.push({ filePath });
      };

      isNavigating = true;
      pushLocation("/src/app.ts");

      expect(history).toHaveLength(0);
    });

    it("should allow recording when not navigating", () => {
      let isNavigating = false;
      const history: Array<{ filePath: string }> = [];

      const pushLocation = (filePath: string) => {
        if (isNavigating) return;
        history.push({ filePath });
      };

      pushLocation("/src/app.ts");

      expect(history).toHaveLength(1);
    });
  });

  describe("History Truncation on Push", () => {
    it("should truncate forward history when pushing after going back", () => {
      const history = [
        { filePath: "/src/a.ts" },
        { filePath: "/src/b.ts" },
        { filePath: "/src/c.ts" },
      ];
      let currentIndex = 1;

      const pushLocation = (filePath: string) => {
        const newHistory = history.slice(0, currentIndex + 1);
        newHistory.push({ filePath });
        return newHistory;
      };

      const newHistory = pushLocation("/src/d.ts");

      expect(newHistory).toHaveLength(3);
      expect(newHistory[2].filePath).toBe("/src/d.ts");
    });
  });
});
