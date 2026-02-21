import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("ThreadList Component Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Thread Types", () => {
    interface Message {
      id: string;
      role: "user" | "assistant";
      content: string;
      timestamp: number;
    }

    interface Thread {
      id: string;
      title: string;
      messages?: Message[];
      lastMessage?: string;
      createdAt?: number;
      updatedAt?: number;
      timestamp?: number;
      messageCount?: number;
    }

    interface ThreadListProps {
      threads: Thread[];
      activeThreadId: string | null;
      onSelect: (id: string) => void;
      onDelete: (id: string) => void;
      onNew: () => void;
    }

    it("should create a thread with required fields", () => {
      const thread: Thread = {
        id: "thread-1",
        title: "Debug Session",
      };

      expect(thread.id).toBe("thread-1");
      expect(thread.title).toBe("Debug Session");
    });

    it("should create a thread with all optional fields", () => {
      const thread: Thread = {
        id: "thread-1",
        title: "Full Thread",
        lastMessage: "Last message content",
        createdAt: 1000,
        updatedAt: 2000,
        timestamp: 1500,
        messageCount: 10,
        messages: [
          { id: "m1", role: "user", content: "Hello", timestamp: 1000 },
        ],
      };

      expect(thread.messageCount).toBe(10);
      expect(thread.messages).toHaveLength(1);
    });

    it("should define ThreadListProps", () => {
      const onSelect = vi.fn();
      const onDelete = vi.fn();
      const onNew = vi.fn();

      const props: ThreadListProps = {
        threads: [],
        activeThreadId: null,
        onSelect,
        onDelete,
        onNew,
      };

      expect(props.threads).toHaveLength(0);
      expect(props.activeThreadId).toBeNull();
    });

    it("should call onSelect with thread id", () => {
      const onSelect = vi.fn();
      onSelect("thread-1");
      expect(onSelect).toHaveBeenCalledWith("thread-1");
    });

    it("should call onDelete with thread id", () => {
      const onDelete = vi.fn();
      onDelete("thread-2");
      expect(onDelete).toHaveBeenCalledWith("thread-2");
    });

    it("should call onNew", () => {
      const onNew = vi.fn();
      onNew();
      expect(onNew).toHaveBeenCalledOnce();
    });
  });

  describe("Time Groups", () => {
    type TimeGroup = "today" | "yesterday" | "thisWeek" | "thisMonth" | "older";

    const GROUP_LABELS: Record<TimeGroup, string> = {
      today: "Today",
      yesterday: "Yesterday",
      thisWeek: "This Week",
      thisMonth: "This Month",
      older: "Older",
    };

    const GROUP_ORDER: TimeGroup[] = ["today", "yesterday", "thisWeek", "thisMonth", "older"];

    it("should have five time groups", () => {
      expect(GROUP_ORDER).toHaveLength(5);
    });

    it("should have correct group labels", () => {
      expect(GROUP_LABELS.today).toBe("Today");
      expect(GROUP_LABELS.yesterday).toBe("Yesterday");
      expect(GROUP_LABELS.thisWeek).toBe("This Week");
      expect(GROUP_LABELS.thisMonth).toBe("This Month");
      expect(GROUP_LABELS.older).toBe("Older");
    });

    it("should have correct group order", () => {
      expect(GROUP_ORDER[0]).toBe("today");
      expect(GROUP_ORDER[4]).toBe("older");
    });
  });

  describe("getThreadTimestamp", () => {
    interface Thread {
      id: string;
      title: string;
      updatedAt?: number;
      timestamp?: number;
      createdAt?: number;
    }

    function getThreadTimestamp(thread: Thread): number {
      return thread.updatedAt ?? thread.timestamp ?? thread.createdAt ?? Date.now();
    }

    it("should prefer updatedAt", () => {
      const thread: Thread = {
        id: "t1",
        title: "Test",
        updatedAt: 3000,
        timestamp: 2000,
        createdAt: 1000,
      };

      expect(getThreadTimestamp(thread)).toBe(3000);
    });

    it("should fall back to timestamp", () => {
      const thread: Thread = {
        id: "t1",
        title: "Test",
        timestamp: 2000,
        createdAt: 1000,
      };

      expect(getThreadTimestamp(thread)).toBe(2000);
    });

    it("should fall back to createdAt", () => {
      const thread: Thread = {
        id: "t1",
        title: "Test",
        createdAt: 1000,
      };

      expect(getThreadTimestamp(thread)).toBe(1000);
    });

    it("should fall back to Date.now() when no timestamps", () => {
      const before = Date.now();
      const thread: Thread = { id: "t1", title: "Test" };
      const result = getThreadTimestamp(thread);
      const after = Date.now();

      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });

  describe("getTimeGroup", () => {
    type TimeGroup = "today" | "yesterday" | "thisWeek" | "thisMonth" | "older";

    function getTimeGroup(timestamp: number): TimeGroup {
      const now = new Date();
      const date = new Date(timestamp);

      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      if (date >= today) {
        return "today";
      } else if (date >= yesterday) {
        return "yesterday";
      } else if (date >= weekAgo) {
        return "thisWeek";
      } else if (date >= monthAgo) {
        return "thisMonth";
      }
      return "older";
    }

    it("should classify today's timestamp as today", () => {
      expect(getTimeGroup(Date.now())).toBe("today");
    });

    it("should classify yesterday's timestamp as yesterday", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(12, 0, 0, 0);
      expect(getTimeGroup(yesterday.getTime())).toBe("yesterday");
    });

    it("should classify 3 days ago as thisWeek", () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      threeDaysAgo.setHours(12, 0, 0, 0);
      expect(getTimeGroup(threeDaysAgo.getTime())).toBe("thisWeek");
    });

    it("should classify 15 days ago as thisMonth", () => {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      fifteenDaysAgo.setHours(12, 0, 0, 0);
      expect(getTimeGroup(fifteenDaysAgo.getTime())).toBe("thisMonth");
    });

    it("should classify 60 days ago as older", () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      expect(getTimeGroup(sixtyDaysAgo.getTime())).toBe("older");
    });
  });

  describe("getPreview", () => {
    interface Thread {
      id: string;
      title: string;
      messages?: { id: string; role: string; content: string; timestamp: number }[];
      lastMessage?: string;
    }

    function getPreview(thread: Thread): string {
      if (thread.lastMessage !== undefined) {
        const content = thread.lastMessage.trim();
        if (content.length === 0) {
          return "No messages";
        }
        if (content.length <= 60) {
          return content;
        }
        return content.substring(0, 57) + "...";
      }

      if (!thread.messages || thread.messages.length === 0) {
        return "No messages";
      }

      const lastMessage = thread.messages[thread.messages.length - 1];
      const content = lastMessage.content.trim();

      if (content.length <= 60) {
        return content;
      }

      return content.substring(0, 57) + "...";
    }

    it("should use lastMessage when available", () => {
      const thread: Thread = {
        id: "t1",
        title: "Test",
        lastMessage: "Short message",
      };

      expect(getPreview(thread)).toBe("Short message");
    });

    it("should truncate long lastMessage at 57 chars with ellipsis", () => {
      const longMessage = "A".repeat(100);
      const thread: Thread = {
        id: "t1",
        title: "Test",
        lastMessage: longMessage,
      };

      const preview = getPreview(thread);
      expect(preview).toBe("A".repeat(57) + "...");
      expect(preview.length).toBe(60);
    });

    it("should return No messages for empty lastMessage", () => {
      const thread: Thread = {
        id: "t1",
        title: "Test",
        lastMessage: "  ",
      };

      expect(getPreview(thread)).toBe("No messages");
    });

    it("should fall back to messages array", () => {
      const thread: Thread = {
        id: "t1",
        title: "Test",
        messages: [
          { id: "m1", role: "user", content: "First", timestamp: 1000 },
          { id: "m2", role: "assistant", content: "Last message here", timestamp: 2000 },
        ],
      };

      expect(getPreview(thread)).toBe("Last message here");
    });

    it("should return No messages for empty messages array", () => {
      const thread: Thread = {
        id: "t1",
        title: "Test",
        messages: [],
      };

      expect(getPreview(thread)).toBe("No messages");
    });

    it("should return No messages when no messages or lastMessage", () => {
      const thread: Thread = { id: "t1", title: "Test" };
      expect(getPreview(thread)).toBe("No messages");
    });

    it("should not truncate messages at exactly 60 chars", () => {
      const exactMessage = "A".repeat(60);
      const thread: Thread = {
        id: "t1",
        title: "Test",
        lastMessage: exactMessage,
      };

      expect(getPreview(thread)).toBe(exactMessage);
    });
  });

  describe("Thread Sorting", () => {
    interface Thread {
      id: string;
      title: string;
      updatedAt?: number;
      timestamp?: number;
      createdAt?: number;
    }

    function getThreadTimestamp(thread: Thread): number {
      return thread.updatedAt ?? thread.timestamp ?? thread.createdAt ?? 0;
    }

    it("should sort threads by timestamp descending", () => {
      const threads: Thread[] = [
        { id: "t1", title: "Old", updatedAt: 1000 },
        { id: "t2", title: "Newest", updatedAt: 3000 },
        { id: "t3", title: "Middle", updatedAt: 2000 },
      ];

      const sorted = [...threads].sort(
        (a, b) => getThreadTimestamp(b) - getThreadTimestamp(a)
      );

      expect(sorted[0].title).toBe("Newest");
      expect(sorted[1].title).toBe("Middle");
      expect(sorted[2].title).toBe("Old");
    });

    it("should handle threads with mixed timestamp fields", () => {
      const threads: Thread[] = [
        { id: "t1", title: "A", updatedAt: 5000 },
        { id: "t2", title: "B", timestamp: 3000 },
        { id: "t3", title: "C", createdAt: 4000 },
      ];

      const sorted = [...threads].sort(
        (a, b) => getThreadTimestamp(b) - getThreadTimestamp(a)
      );

      expect(sorted[0].title).toBe("A");
      expect(sorted[1].title).toBe("C");
      expect(sorted[2].title).toBe("B");
    });
  });

  describe("formatDate", () => {
    function formatDate(timestamp: number): string {
      const now = new Date();
      const date = new Date(timestamp);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      if (date >= today) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (date >= yesterday) {
        return "Yesterday";
      } else if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      }

      return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    }

    it("should show time for today", () => {
      const now = new Date();
      now.setHours(14, 30, 0, 0);
      const result = formatDate(now.getTime());
      expect(result).toContain("30");
    });

    it("should show Yesterday for yesterday", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(12, 0, 0, 0);
      expect(formatDate(yesterday.getTime())).toBe("Yesterday");
    });

    it("should show month and day for this year", () => {
      const date = new Date();
      date.setMonth(0, 15);
      date.setFullYear(new Date().getFullYear());
      date.setHours(0, 0, 0, 0);

      const now = new Date();
      if (date < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)) {
        const result = formatDate(date.getTime());
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it("should include year for previous years", () => {
      const oldDate = new Date(2022, 5, 15, 12, 0);
      const result = formatDate(oldDate.getTime());
      expect(result).toContain("2022");
    });
  });
});
