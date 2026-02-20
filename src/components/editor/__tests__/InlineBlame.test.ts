/**
 * InlineBlame Tests
 *
 * Tests for the inline git blame component types and utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type InlineBlameMode = "off" | "currentLine" | "allLines";

interface InlineBlameOptions {
  editor: unknown | null;
  monaco: unknown | null;
  filePath: string;
  mode: InlineBlameMode;
  showMessage?: boolean;
  maxMessageLength?: number;
}

interface BlameLineInfo {
  lineNumber: number;
  author: string;
  authorEmail: string;
  date: string;
  hash: string;
  message: string;
}

interface CommitDetails {
  hash: string;
  author: string;
  authorEmail: string;
  date: string;
  message: string;
  summary: string;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears > 0)
      return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
    if (diffMonths > 0)
      return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
    if (diffWeeks > 0)
      return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    if (diffHours > 0)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    return "just now";
  } catch {
    return dateStr;
  }
}

function formatFullDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

describe("InlineBlame", () => {
  let originalDate: DateConstructor;
  const fixedNow = new Date("2025-06-15T12:00:00Z");

  beforeEach(() => {
    originalDate = global.Date;
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
    global.Date = originalDate;
  });

  describe("InlineBlameMode Types", () => {
    it("should accept 'off' as valid mode", () => {
      const mode: InlineBlameMode = "off";
      expect(mode).toBe("off");
    });

    it("should accept 'currentLine' as valid mode", () => {
      const mode: InlineBlameMode = "currentLine";
      expect(mode).toBe("currentLine");
    });

    it("should accept 'allLines' as valid mode", () => {
      const mode: InlineBlameMode = "allLines";
      expect(mode).toBe("allLines");
    });

    it("should have exactly three valid modes", () => {
      const validModes: InlineBlameMode[] = ["off", "currentLine", "allLines"];
      expect(validModes).toHaveLength(3);
      expect(validModes).toContain("off");
      expect(validModes).toContain("currentLine");
      expect(validModes).toContain("allLines");
    });
  });

  describe("InlineBlameOptions Interface", () => {
    it("should create valid options with required fields", () => {
      const options: InlineBlameOptions = {
        editor: null,
        monaco: null,
        filePath: "/path/to/file.ts",
        mode: "currentLine",
      };

      expect(options.editor).toBeNull();
      expect(options.monaco).toBeNull();
      expect(options.filePath).toBe("/path/to/file.ts");
      expect(options.mode).toBe("currentLine");
    });

    it("should create valid options with optional fields", () => {
      const options: InlineBlameOptions = {
        editor: null,
        monaco: null,
        filePath: "/path/to/file.ts",
        mode: "allLines",
        showMessage: true,
        maxMessageLength: 100,
      };

      expect(options.showMessage).toBe(true);
      expect(options.maxMessageLength).toBe(100);
    });

    it("should allow undefined for optional fields", () => {
      const options: InlineBlameOptions = {
        editor: null,
        monaco: null,
        filePath: "/test.ts",
        mode: "off",
      };

      expect(options.showMessage).toBeUndefined();
      expect(options.maxMessageLength).toBeUndefined();
    });

    it("should accept non-null editor and monaco", () => {
      const mockEditor = { getModel: vi.fn() };
      const mockMonaco = { Range: vi.fn() };

      const options: InlineBlameOptions = {
        editor: mockEditor,
        monaco: mockMonaco,
        filePath: "/test.ts",
        mode: "currentLine",
      };

      expect(options.editor).toBe(mockEditor);
      expect(options.monaco).toBe(mockMonaco);
    });
  });

  describe("BlameLineInfo Interface", () => {
    it("should create valid blame line info", () => {
      const blameInfo: BlameLineInfo = {
        lineNumber: 42,
        author: "John Doe",
        authorEmail: "john@example.com",
        date: "2025-01-15T10:30:00Z",
        hash: "abc123def456",
        message: "Fix critical bug in authentication",
      };

      expect(blameInfo.lineNumber).toBe(42);
      expect(blameInfo.author).toBe("John Doe");
      expect(blameInfo.authorEmail).toBe("john@example.com");
      expect(blameInfo.date).toBe("2025-01-15T10:30:00Z");
      expect(blameInfo.hash).toBe("abc123def456");
      expect(blameInfo.message).toBe("Fix critical bug in authentication");
    });

    it("should handle empty author email", () => {
      const blameInfo: BlameLineInfo = {
        lineNumber: 1,
        author: "Unknown",
        authorEmail: "",
        date: "2025-01-01T00:00:00Z",
        hash: "0000000",
        message: "Initial commit",
      };

      expect(blameInfo.authorEmail).toBe("");
    });

    it("should handle multi-line commit messages", () => {
      const blameInfo: BlameLineInfo = {
        lineNumber: 10,
        author: "Jane Smith",
        authorEmail: "jane@example.com",
        date: "2025-02-20T15:45:00Z",
        hash: "fedcba987654",
        message:
          "Add new feature\n\nThis implements the requested functionality.\n\nCloses #123",
      };

      expect(blameInfo.message).toContain("\n");
      expect(blameInfo.message.split("\n").length).toBeGreaterThan(1);
    });

    it("should handle line number at boundaries", () => {
      const firstLine: BlameLineInfo = {
        lineNumber: 1,
        author: "Dev",
        authorEmail: "dev@test.com",
        date: "2025-01-01T00:00:00Z",
        hash: "aaa111",
        message: "First line",
      };

      const largeLine: BlameLineInfo = {
        lineNumber: 999999,
        author: "Dev",
        authorEmail: "dev@test.com",
        date: "2025-01-01T00:00:00Z",
        hash: "bbb222",
        message: "Large line number",
      };

      expect(firstLine.lineNumber).toBe(1);
      expect(largeLine.lineNumber).toBe(999999);
    });
  });

  describe("CommitDetails Interface", () => {
    it("should create valid commit details", () => {
      const details: CommitDetails = {
        hash: "abc123def456789",
        author: "John Doe",
        authorEmail: "john@example.com",
        date: "2025-03-10T08:00:00Z",
        message: "Implement feature X\n\nDetailed description here.",
        summary: "Implement feature X",
      };

      expect(details.hash).toBe("abc123def456789");
      expect(details.author).toBe("John Doe");
      expect(details.authorEmail).toBe("john@example.com");
      expect(details.date).toBe("2025-03-10T08:00:00Z");
      expect(details.message).toBe(
        "Implement feature X\n\nDetailed description here.",
      );
      expect(details.summary).toBe("Implement feature X");
    });

    it("should have summary as first line of message", () => {
      const message =
        "Fix bug in parser\n\nThe parser was failing on edge cases.";
      const summary = message.split("\n")[0].trim();

      const details: CommitDetails = {
        hash: "xyz789",
        author: "Developer",
        authorEmail: "dev@example.com",
        date: "2025-04-01T12:00:00Z",
        message,
        summary,
      };

      expect(details.summary).toBe("Fix bug in parser");
      expect(details.message.startsWith(details.summary)).toBe(true);
    });

    it("should handle single-line message where summary equals message", () => {
      const message = "Quick fix";

      const details: CommitDetails = {
        hash: "short123",
        author: "Dev",
        authorEmail: "dev@test.com",
        date: "2025-05-01T00:00:00Z",
        message,
        summary: message,
      };

      expect(details.summary).toBe(details.message);
    });
  });

  describe("formatRelativeTime Utility", () => {
    it("should format years ago (singular)", () => {
      const oneYearAgo = new Date(fixedNow);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const result = formatRelativeTime(oneYearAgo.toISOString());
      expect(result).toBe("1 year ago");
    });

    it("should format years ago (plural)", () => {
      const twoYearsAgo = new Date(fixedNow);
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const result = formatRelativeTime(twoYearsAgo.toISOString());
      expect(result).toBe("2 years ago");
    });

    it("should format months ago (singular)", () => {
      const oneMonthAgo = new Date(fixedNow);
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 35);

      const result = formatRelativeTime(oneMonthAgo.toISOString());
      expect(result).toBe("1 month ago");
    });

    it("should format months ago (plural)", () => {
      const sixMonthsAgo = new Date(fixedNow);
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

      const result = formatRelativeTime(sixMonthsAgo.toISOString());
      expect(result).toBe("6 months ago");
    });

    it("should format weeks ago (singular)", () => {
      const oneWeekAgo = new Date(fixedNow);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 10);

      const result = formatRelativeTime(oneWeekAgo.toISOString());
      expect(result).toBe("1 week ago");
    });

    it("should format weeks ago (plural)", () => {
      const threeWeeksAgo = new Date(fixedNow);
      threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

      const result = formatRelativeTime(threeWeeksAgo.toISOString());
      expect(result).toBe("3 weeks ago");
    });

    it("should format days ago (singular)", () => {
      const oneDayAgo = new Date(fixedNow);
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const result = formatRelativeTime(oneDayAgo.toISOString());
      expect(result).toBe("1 day ago");
    });

    it("should format days ago (plural)", () => {
      const fiveDaysAgo = new Date(fixedNow);
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const result = formatRelativeTime(fiveDaysAgo.toISOString());
      expect(result).toBe("5 days ago");
    });

    it("should format hours ago (singular)", () => {
      const oneHourAgo = new Date(fixedNow);
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const result = formatRelativeTime(oneHourAgo.toISOString());
      expect(result).toBe("1 hour ago");
    });

    it("should format hours ago (plural)", () => {
      const twelveHoursAgo = new Date(fixedNow);
      twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);

      const result = formatRelativeTime(twelveHoursAgo.toISOString());
      expect(result).toBe("12 hours ago");
    });

    it("should format minutes ago (singular)", () => {
      const oneMinuteAgo = new Date(fixedNow);
      oneMinuteAgo.setMinutes(oneMinuteAgo.getMinutes() - 1);

      const result = formatRelativeTime(oneMinuteAgo.toISOString());
      expect(result).toBe("1 minute ago");
    });

    it("should format minutes ago (plural)", () => {
      const thirtyMinutesAgo = new Date(fixedNow);
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

      const result = formatRelativeTime(thirtyMinutesAgo.toISOString());
      expect(result).toBe("30 minutes ago");
    });

    it("should return 'just now' for recent times", () => {
      const justNow = new Date(fixedNow);
      justNow.setSeconds(justNow.getSeconds() - 30);

      const result = formatRelativeTime(justNow.toISOString());
      expect(result).toBe("just now");
    });

    it("should handle invalid date gracefully", () => {
      const invalidDate = "not-a-valid-date";
      const result = formatRelativeTime(invalidDate);
      expect(result).toBe("just now");
    });
  });

  describe("formatFullDate Utility", () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);
    });

    it("should format date with full details", { timeout: 30000 }, () => {
      const dateStr = "2025-12-25T15:30:00Z";
      const result = formatFullDate(dateStr);

      expect(result).toContain("December");
      expect(result).toContain("25");
      expect(result).toContain("2025");
    });

    it("should include time in formatted output", { timeout: 30000 }, () => {
      const dateStr = "2025-06-15T14:45:00Z";
      const result = formatFullDate(dateStr);

      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it("should handle invalid date gracefully", { timeout: 30000 }, () => {
      const invalidDate = "invalid-date-string";
      const result = formatFullDate(invalidDate);
      expect(result).toBe("Invalid Date");
    });

    it("should handle ISO date strings", { timeout: 30000 }, () => {
      const isoDate = "2025-01-01T00:00:00.000Z";
      const result = formatFullDate(isoDate);

      expect(result).toContain("January");
      expect(result).toContain("1");
      expect(result).toContain("2025");
    });

    it("should handle different months correctly", { timeout: 30000 }, () => {
      const months = [
        { date: "2025-01-15T12:00:00Z", expected: "January" },
        { date: "2025-06-15T12:00:00Z", expected: "June" },
        { date: "2025-12-15T12:00:00Z", expected: "December" },
      ];

      for (const { date, expected } of months) {
        const result = formatFullDate(date);
        expect(result).toContain(expected);
      }
    });
  });

  describe("Date Formatting Edge Cases", () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);
    });

    it("should handle empty string gracefully", { timeout: 30000 }, () => {
      const result = formatRelativeTime("");
      expect(result).toBe("just now");
    });

    it("should handle future dates", { timeout: 30000 }, () => {
      const futureDate = new Date(fixedNow);
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const result = formatRelativeTime(futureDate.toISOString());
      expect(result).toBe("just now");
    });

    it("should handle dates at year boundary", { timeout: 30000 }, () => {
      // Use midday UTC so local timezone offsets don't push the date to Jan 1
      const newYearsEve = "2024-12-31T12:00:00Z";
      const result = formatFullDate(newYearsEve);

      expect(result).toContain("December");
      expect(result).toContain("31");
      expect(result).toContain("2024");
    });

    it("should handle leap year dates", { timeout: 30000 }, () => {
      const leapDay = "2024-02-29T12:00:00Z";
      const result = formatFullDate(leapDay);

      expect(result).toContain("February");
      expect(result).toContain("29");
      expect(result).toContain("2024");
    });

    it("should handle very old dates", { timeout: 30000 }, () => {
      const oldDate = "2000-01-01T00:00:00Z";
      const result = formatRelativeTime(oldDate);

      expect(result).toContain("years ago");
    });

    it("should handle dates with timezone offsets", { timeout: 30000 }, () => {
      const dateWithOffset = "2025-06-15T12:00:00+05:30";
      const result = formatFullDate(dateWithOffset);

      expect(result).toContain("June");
      expect(result).toContain("2025");
    });
  });
});
