import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatDate,
  formatTime,
  formatRelativeTime,
  formatBytes,
  formatDuration,
  truncate,
  slugify,
} from "../format";

describe("format", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("formatDate", () => {
    it("returns formatted time for today", () => {
      const now = Date.now();
      const result = formatDate(now);
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
    it("returns Yesterday for yesterday", () => {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      expect(formatDate(yesterday)).toBe("Yesterday");
    });
    it("returns days ago for 2-6 days", () => {
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      expect(formatDate(threeDaysAgo)).toBe("3 days ago");
    });
    it("returns locale date string for 7+ days", () => {
      const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
      const result = formatDate(tenDaysAgo);
      expect(typeof result).toBe("string");
      expect(result).not.toContain("ago");
    });
  });

  describe("formatTime", () => {
    it("returns formatted time string", () => {
      const result = formatTime(Date.now());
      expect(typeof result).toBe("string");
    });
  });

  describe("formatRelativeTime", () => {
    it("returns just now for < 60 seconds", () => {
      expect(formatRelativeTime(Date.now() - 30 * 1000)).toBe("just now");
    });
    it("returns minutes ago", () => {
      expect(formatRelativeTime(Date.now() - 5 * 60 * 1000)).toBe("5m ago");
    });
    it("returns hours ago", () => {
      expect(formatRelativeTime(Date.now() - 3 * 60 * 60 * 1000)).toBe("3h ago");
    });
    it("returns days ago", () => {
      expect(formatRelativeTime(Date.now() - 2 * 24 * 60 * 60 * 1000)).toBe("2d ago");
    });
    it("returns date for 7+ days", () => {
      const result = formatRelativeTime(Date.now() - 10 * 24 * 60 * 60 * 1000);
      expect(result).not.toContain("ago");
    });
  });

  describe("formatBytes", () => {
    it("formats 0 bytes", () => {
      expect(formatBytes(0)).toBe("0 B");
    });
    it("formats bytes", () => {
      expect(formatBytes(500)).toBe("500 B");
    });
    it("formats kilobytes", () => {
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
    });
    it("formats megabytes", () => {
      expect(formatBytes(1048576)).toBe("1 MB");
    });
    it("formats gigabytes", () => {
      expect(formatBytes(1073741824)).toBe("1 GB");
    });
    it("formats terabytes", () => {
      expect(formatBytes(1099511627776)).toBe("1 TB");
    });
  });

  describe("formatDuration", () => {
    it("formats seconds", () => {
      expect(formatDuration(5000)).toBe("5s");
    });
    it("formats minutes and seconds", () => {
      expect(formatDuration(65000)).toBe("1m 5s");
    });
    it("formats hours and minutes", () => {
      expect(formatDuration(3660000)).toBe("1h 1m");
    });
    it("formats zero", () => {
      expect(formatDuration(0)).toBe("0s");
    });
  });

  describe("truncate", () => {
    it("returns string unchanged if within length", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });
    it("truncates with ellipsis", () => {
      expect(truncate("hello world", 8)).toBe("hello...");
    });
    it("handles exact length", () => {
      expect(truncate("hello", 5)).toBe("hello");
    });
  });

  describe("slugify", () => {
    it("converts to lowercase kebab-case", () => {
      expect(slugify("Hello World")).toBe("hello-world");
    });
    it("removes special characters", () => {
      expect(slugify("Hello, World!")).toBe("hello-world");
    });
    it("collapses multiple separators", () => {
      expect(slugify("hello   world")).toBe("hello-world");
    });
    it("trims leading/trailing hyphens", () => {
      expect(slugify("-hello-")).toBe("hello");
    });
  });
});
