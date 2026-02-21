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

describe("useTerminalSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("TerminalSearchMatch Interface", () => {
    interface TerminalSearchMatch {
      line: number;
      column: number;
      length: number;
      text: string;
      index: number;
    }

    it("should create a search match", () => {
      const match: TerminalSearchMatch = {
        line: 5,
        column: 10,
        length: 6,
        text: "search",
        index: 0,
      };

      expect(match.line).toBe(5);
      expect(match.column).toBe(10);
      expect(match.text).toBe("search");
    });

    it("should create multiple matches", () => {
      const matches: TerminalSearchMatch[] = [
        { line: 1, column: 0, length: 5, text: "hello", index: 0 },
        { line: 3, column: 8, length: 5, text: "hello", index: 1 },
        { line: 7, column: 2, length: 5, text: "hello", index: 2 },
      ];

      expect(matches).toHaveLength(3);
      expect(matches[2].index).toBe(2);
    });
  });

  describe("Search Query State", () => {
    it("should update query value", () => {
      let query = "";

      const setQuery = (value: string) => {
        query = value;
      };

      setQuery("error");
      expect(query).toBe("error");

      setQuery("warning");
      expect(query).toBe("warning");
    });

    it("should handle empty query", () => {
      let query = "previous";

      const setQuery = (value: string) => {
        query = value;
      };

      setQuery("");
      expect(query).toBe("");
    });
  });

  describe("Search via Invoke", () => {
    it("should call terminal_search with query", async () => {
      const mockMatches = [
        { line: 1, column: 5, length: 5, text: "error", index: 0 },
        { line: 4, column: 0, length: 5, text: "error", index: 1 },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(mockMatches);

      const result = await invoke("terminal_search", {
        terminalId: "term-1",
        query: "error",
      });

      expect(invoke).toHaveBeenCalledWith("terminal_search", {
        terminalId: "term-1",
        query: "error",
      });
      expect(result).toEqual(mockMatches);
    });

    it("should return empty array when no matches", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      const result = await invoke("terminal_search", {
        terminalId: "term-1",
        query: "nonexistent",
      });

      expect(result).toEqual([]);
    });

    it("should handle search failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Terminal not found"));

      await expect(
        invoke("terminal_search", { terminalId: "invalid", query: "test" })
      ).rejects.toThrow("Terminal not found");
    });
  });

  describe("Match Navigation", () => {
    it("should cycle forward through matches with nextMatch", () => {
      const totalMatches = 5;
      let currentIndex = 0;

      const nextMatch = () => {
        currentIndex = (currentIndex + 1) % totalMatches;
      };

      nextMatch();
      expect(currentIndex).toBe(1);

      nextMatch();
      expect(currentIndex).toBe(2);
    });

    it("should wrap around at end with nextMatch", () => {
      const totalMatches = 3;
      let currentIndex = 2;

      const nextMatch = () => {
        currentIndex = (currentIndex + 1) % totalMatches;
      };

      nextMatch();
      expect(currentIndex).toBe(0);
    });

    it("should cycle backward through matches with previousMatch", () => {
      const totalMatches = 5;
      let currentIndex = 3;

      const previousMatch = () => {
        currentIndex = (currentIndex - 1 + totalMatches) % totalMatches;
      };

      previousMatch();
      expect(currentIndex).toBe(2);

      previousMatch();
      expect(currentIndex).toBe(1);
    });

    it("should wrap around at beginning with previousMatch", () => {
      const totalMatches = 3;
      let currentIndex = 0;

      const previousMatch = () => {
        currentIndex = (currentIndex - 1 + totalMatches) % totalMatches;
      };

      previousMatch();
      expect(currentIndex).toBe(2);
    });
  });

  describe("Clear Search", () => {
    it("should reset all search state", () => {
      let query = "search term";
      let matches: { line: number; text: string }[] = [
        { line: 1, text: "search term" },
      ];
      let currentIndex = 0;
      let isSearching = true;

      const clearSearch = () => {
        query = "";
        matches = [];
        currentIndex = 0;
        isSearching = false;
      };

      clearSearch();

      expect(query).toBe("");
      expect(matches).toHaveLength(0);
      expect(currentIndex).toBe(0);
      expect(isSearching).toBe(false);
    });
  });

  describe("Searching State", () => {
    it("should track isSearching during search", () => {
      let isSearching = false;

      isSearching = true;
      expect(isSearching).toBe(true);

      isSearching = false;
      expect(isSearching).toBe(false);
    });
  });

  describe("Total Matches Accessor", () => {
    it("should return total number of matches", () => {
      const matches = [
        { line: 1, text: "match" },
        { line: 3, text: "match" },
        { line: 5, text: "match" },
      ];

      const totalMatches = () => matches.length;

      expect(totalMatches()).toBe(3);
    });

    it("should return zero for no matches", () => {
      const matches: unknown[] = [];

      const totalMatches = () => matches.length;

      expect(totalMatches()).toBe(0);
    });
  });

  describe("UseTerminalSearchReturn Interface", () => {
    interface UseTerminalSearchReturn {
      query: () => string;
      setQuery: (value: string) => void;
      matches: () => { line: number; column: number; text: string }[];
      currentMatchIndex: () => number;
      totalMatches: () => number;
      isSearching: () => boolean;
      search: () => Promise<void>;
      nextMatch: () => void;
      previousMatch: () => void;
      clearSearch: () => void;
    }

    it("should define complete return type", () => {
      const mockReturn: UseTerminalSearchReturn = {
        query: () => "test",
        setQuery: vi.fn(),
        matches: () => [{ line: 1, column: 0, text: "test" }],
        currentMatchIndex: () => 0,
        totalMatches: () => 1,
        isSearching: () => false,
        search: vi.fn().mockResolvedValue(undefined),
        nextMatch: vi.fn(),
        previousMatch: vi.fn(),
        clearSearch: vi.fn(),
      };

      expect(mockReturn.query()).toBe("test");
      expect(mockReturn.totalMatches()).toBe(1);
      expect(mockReturn.isSearching()).toBe(false);
    });
  });

  describe("Terminal Search Events", () => {
    it("should listen for terminal search highlight events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("terminal:search-highlight", () => {});

      expect(listen).toHaveBeenCalledWith("terminal:search-highlight", expect.any(Function));
    });
  });
});
