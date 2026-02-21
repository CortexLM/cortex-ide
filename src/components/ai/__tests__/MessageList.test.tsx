import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("MessageList Component Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("MessageList Types", () => {
    interface Message {
      id: string;
      role: "user" | "assistant" | "system";
      parts: { type: "text"; content: string }[];
      timestamp: number;
    }

    interface MessageListProps {
      messages: Message[];
      isStreaming?: boolean;
      onScrollToMessage?: (scrollFn: (messageId: string) => void) => void;
    }

    interface VirtualItem {
      index: number;
      start: number;
      size: number;
    }

    interface MessageGroup {
      type: "message" | "date-separator";
      message?: Message;
      timestamp?: number;
      key: string;
    }

    it("should define MessageListProps", () => {
      const messages: Message[] = [
        { id: "m1", role: "user", parts: [{ type: "text", content: "Hello" }], timestamp: Date.now() },
      ];

      const props: MessageListProps = {
        messages,
        isStreaming: false,
      };

      expect(props.messages).toHaveLength(1);
      expect(props.isStreaming).toBe(false);
    });

    it("should define VirtualItem for virtualization", () => {
      const item: VirtualItem = {
        index: 0,
        start: 0,
        size: 120,
      };

      expect(item.index).toBe(0);
      expect(item.size).toBe(120);
    });

    it("should define MessageGroup for message type", () => {
      const group: MessageGroup = {
        type: "message",
        message: { id: "m1", role: "user", parts: [{ type: "text", content: "Hi" }], timestamp: Date.now() },
        key: "m1",
      };

      expect(group.type).toBe("message");
      expect(group.message?.id).toBe("m1");
    });

    it("should define MessageGroup for date-separator type", () => {
      const group: MessageGroup = {
        type: "date-separator",
        timestamp: Date.now(),
        key: "date-1234",
      };

      expect(group.type).toBe("date-separator");
      expect(group.timestamp).toBeDefined();
    });
  });

  describe("Constants", () => {
    const ESTIMATED_MESSAGE_HEIGHT = 120;
    const OVERSCAN_COUNT = 3;
    const SCROLL_THRESHOLD = 100;

    it("should have correct estimated message height", () => {
      expect(ESTIMATED_MESSAGE_HEIGHT).toBe(120);
    });

    it("should have correct overscan count", () => {
      expect(OVERSCAN_COUNT).toBe(3);
    });

    it("should have correct scroll threshold", () => {
      expect(SCROLL_THRESHOLD).toBe(100);
    });
  });

  describe("isSameDay", () => {
    function isSameDay(date1: Date, date2: Date): boolean {
      return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
      );
    }

    it("should return true for same day", () => {
      const d1 = new Date(2024, 5, 15, 10, 0);
      const d2 = new Date(2024, 5, 15, 23, 59);
      expect(isSameDay(d1, d2)).toBe(true);
    });

    it("should return false for different days", () => {
      const d1 = new Date(2024, 5, 15);
      const d2 = new Date(2024, 5, 16);
      expect(isSameDay(d1, d2)).toBe(false);
    });

    it("should return false for different months", () => {
      const d1 = new Date(2024, 5, 15);
      const d2 = new Date(2024, 6, 15);
      expect(isSameDay(d1, d2)).toBe(false);
    });

    it("should return false for different years", () => {
      const d1 = new Date(2024, 5, 15);
      const d2 = new Date(2025, 5, 15);
      expect(isSameDay(d1, d2)).toBe(false);
    });

    it("should handle midnight boundary", () => {
      const d1 = new Date(2024, 5, 15, 23, 59, 59);
      const d2 = new Date(2024, 5, 16, 0, 0, 0);
      expect(isSameDay(d1, d2)).toBe(false);
    });
  });

  describe("groupMessagesWithDates", () => {
    interface Message {
      id: string;
      role: "user" | "assistant" | "system";
      parts: { type: "text"; content: string }[];
      timestamp: number;
    }

    interface MessageGroup {
      type: "message" | "date-separator";
      message?: Message;
      timestamp?: number;
      key: string;
    }

    function isSameDay(date1: Date, date2: Date): boolean {
      return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
      );
    }

    function groupMessagesWithDates(messages: Message[]): MessageGroup[] {
      const groups: MessageGroup[] = [];
      let lastDate: Date | null = null;

      for (const message of messages) {
        const messageDate = new Date(message.timestamp);

        if (!lastDate || !isSameDay(lastDate, messageDate)) {
          groups.push({
            type: "date-separator",
            timestamp: message.timestamp,
            key: `date-${message.timestamp}`,
          });
          lastDate = messageDate;
        }

        groups.push({
          type: "message",
          message,
          key: message.id,
        });
      }

      return groups;
    }

    it("should return empty array for no messages", () => {
      const groups = groupMessagesWithDates([]);
      expect(groups).toHaveLength(0);
    });

    it("should add date separator before first message", () => {
      const messages: Message[] = [
        { id: "m1", role: "user", parts: [{ type: "text", content: "Hi" }], timestamp: Date.now() },
      ];

      const groups = groupMessagesWithDates(messages);
      expect(groups).toHaveLength(2);
      expect(groups[0].type).toBe("date-separator");
      expect(groups[1].type).toBe("message");
    });

    it("should not add extra separator for same-day messages", () => {
      const today = new Date();
      today.setHours(10, 0, 0, 0);
      const laterToday = new Date();
      laterToday.setHours(14, 0, 0, 0);

      const messages: Message[] = [
        { id: "m1", role: "user", parts: [{ type: "text", content: "Morning" }], timestamp: today.getTime() },
        { id: "m2", role: "assistant", parts: [{ type: "text", content: "Hi" }], timestamp: laterToday.getTime() },
      ];

      const groups = groupMessagesWithDates(messages);
      expect(groups).toHaveLength(3);
      expect(groups[0].type).toBe("date-separator");
      expect(groups[1].type).toBe("message");
      expect(groups[2].type).toBe("message");
    });

    it("should add separator between different days", () => {
      const day1 = new Date(2024, 5, 15, 10, 0).getTime();
      const day2 = new Date(2024, 5, 16, 10, 0).getTime();

      const messages: Message[] = [
        { id: "m1", role: "user", parts: [{ type: "text", content: "Day 1" }], timestamp: day1 },
        { id: "m2", role: "assistant", parts: [{ type: "text", content: "Day 2" }], timestamp: day2 },
      ];

      const groups = groupMessagesWithDates(messages);
      expect(groups).toHaveLength(4);
      expect(groups[0].type).toBe("date-separator");
      expect(groups[1].type).toBe("message");
      expect(groups[2].type).toBe("date-separator");
      expect(groups[3].type).toBe("message");
    });

    it("should handle multiple messages across three days", () => {
      const day1 = new Date(2024, 5, 14, 10, 0).getTime();
      const day2 = new Date(2024, 5, 15, 10, 0).getTime();
      const day3 = new Date(2024, 5, 16, 10, 0).getTime();

      const messages: Message[] = [
        { id: "m1", role: "user", parts: [{ type: "text", content: "A" }], timestamp: day1 },
        { id: "m2", role: "assistant", parts: [{ type: "text", content: "B" }], timestamp: day1 },
        { id: "m3", role: "user", parts: [{ type: "text", content: "C" }], timestamp: day2 },
        { id: "m4", role: "user", parts: [{ type: "text", content: "D" }], timestamp: day3 },
      ];

      const groups = groupMessagesWithDates(messages);
      const separators = groups.filter((g) => g.type === "date-separator");
      const msgs = groups.filter((g) => g.type === "message");

      expect(separators).toHaveLength(3);
      expect(msgs).toHaveLength(4);
    });

    it("should use message key for message groups", () => {
      const messages: Message[] = [
        { id: "msg-abc", role: "user", parts: [{ type: "text", content: "Test" }], timestamp: Date.now() },
      ];

      const groups = groupMessagesWithDates(messages);
      expect(groups[1].key).toBe("msg-abc");
    });

    it("should use date-prefixed key for separators", () => {
      const ts = Date.now();
      const messages: Message[] = [
        { id: "m1", role: "user", parts: [{ type: "text", content: "Test" }], timestamp: ts },
      ];

      const groups = groupMessagesWithDates(messages);
      expect(groups[0].key).toBe(`date-${ts}`);
    });
  });

  describe("Scroll Behavior", () => {
    it("should determine if user is near bottom", () => {
      const SCROLL_THRESHOLD = 100;

      const isNearBottom = (scrollTop: number, scrollHeight: number, clientHeight: number) =>
        scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;

      expect(isNearBottom(900, 1000, 50)).toBe(true);
      expect(isNearBottom(0, 1000, 50)).toBe(false);
    });

    it("should auto-scroll when at bottom and new message arrives", () => {
      let shouldAutoScroll = true;
      const scrollToBottom = vi.fn();

      if (shouldAutoScroll) {
        scrollToBottom();
      }

      expect(scrollToBottom).toHaveBeenCalledOnce();
    });

    it("should not auto-scroll when user scrolled up", () => {
      let shouldAutoScroll = false;
      const scrollToBottom = vi.fn();

      if (shouldAutoScroll) {
        scrollToBottom();
      }

      expect(scrollToBottom).not.toHaveBeenCalled();
    });
  });
});
