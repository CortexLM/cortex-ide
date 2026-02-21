import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("MessageView Component Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Message Types", () => {
    interface ToolCall {
      id: string;
      name: string;
      input: Record<string, unknown>;
      output?: string;
      status: "pending" | "running" | "completed" | "error";
      durationMs?: number;
    }

    interface Attachment {
      id: string;
      name: string;
      type: "file" | "image";
      path: string;
      content?: string;
    }

    type MessagePart =
      | { type: "text"; content: string }
      | { type: "tool"; tool: ToolCall }
      | { type: "attachment"; attachment: Attachment };

    interface Message {
      id: string;
      role: "user" | "assistant" | "system";
      parts: MessagePart[];
      timestamp: number;
      reasoning?: string;
      metadata?: {
        model?: string;
        inputTokens?: number;
        outputTokens?: number;
      };
    }

    interface MessageViewProps {
      message: Message;
      isStreaming?: boolean;
    }

    it("should create a user message", () => {
      const message: Message = {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", content: "Hello, help me debug this" }],
        timestamp: Date.now(),
      };

      expect(message.role).toBe("user");
      expect(message.parts).toHaveLength(1);
      expect(message.parts[0].type).toBe("text");
    });

    it("should create an assistant message", () => {
      const message: Message = {
        id: "msg-2",
        role: "assistant",
        parts: [{ type: "text", content: "Sure, let me help you." }],
        timestamp: Date.now(),
        reasoning: "The user needs debugging help",
      };

      expect(message.role).toBe("assistant");
      expect(message.reasoning).toBe("The user needs debugging help");
    });

    it("should create a system message", () => {
      const message: Message = {
        id: "msg-0",
        role: "system",
        parts: [{ type: "text", content: "You are a helpful assistant." }],
        timestamp: Date.now(),
      };

      expect(message.role).toBe("system");
    });

    it("should support metadata with token counts", () => {
      const message: Message = {
        id: "msg-3",
        role: "assistant",
        parts: [{ type: "text", content: "Response" }],
        timestamp: Date.now(),
        metadata: {
          model: "claude-3-opus",
          inputTokens: 150,
          outputTokens: 300,
        },
      };

      expect(message.metadata?.model).toBe("claude-3-opus");
      expect(message.metadata?.inputTokens).toBe(150);
      expect(message.metadata?.outputTokens).toBe(300);
    });

    it("should support message without metadata", () => {
      const message: Message = {
        id: "msg-4",
        role: "user",
        parts: [{ type: "text", content: "Simple message" }],
        timestamp: Date.now(),
      };

      expect(message.metadata).toBeUndefined();
    });

    it("should create MessageViewProps with streaming", () => {
      const message: Message = {
        id: "msg-5",
        role: "assistant",
        parts: [{ type: "text", content: "Partial..." }],
        timestamp: Date.now(),
      };

      const props: MessageViewProps = {
        message,
        isStreaming: true,
      };

      expect(props.isStreaming).toBe(true);
      expect(props.message.id).toBe("msg-5");
    });
  });

  describe("Message Parts", () => {
    interface ToolCall {
      id: string;
      name: string;
      input: Record<string, unknown>;
      output?: string;
      status: "pending" | "running" | "completed" | "error";
      durationMs?: number;
    }

    interface Attachment {
      id: string;
      name: string;
      type: "file" | "image";
      path: string;
      content?: string;
    }

    type MessagePart =
      | { type: "text"; content: string }
      | { type: "tool"; tool: ToolCall }
      | { type: "attachment"; attachment: Attachment };

    interface Message {
      id: string;
      role: "user" | "assistant" | "system";
      parts: MessagePart[];
      timestamp: number;
    }

    it("should handle text parts", () => {
      const part: MessagePart = { type: "text", content: "Hello world" };
      expect(part.type).toBe("text");
      if (part.type === "text") {
        expect(part.content).toBe("Hello world");
      }
    });

    it("should handle tool call parts", () => {
      const tool: ToolCall = {
        id: "tool-1",
        name: "read_file",
        input: { path: "/src/app.ts" },
        output: "file contents here",
        status: "completed",
        durationMs: 150,
      };

      const part: MessagePart = { type: "tool", tool };
      expect(part.type).toBe("tool");
      if (part.type === "tool") {
        expect(part.tool.name).toBe("read_file");
        expect(part.tool.status).toBe("completed");
      }
    });

    it("should handle attachment parts", () => {
      const attachment: Attachment = {
        id: "att-1",
        name: "screenshot.png",
        type: "image",
        path: "/tmp/screenshot.png",
        content: "base64data...",
      };

      const part: MessagePart = { type: "attachment", attachment };
      expect(part.type).toBe("attachment");
      if (part.type === "attachment") {
        expect(part.attachment.name).toBe("screenshot.png");
        expect(part.attachment.type).toBe("image");
      }
    });

    it("should handle mixed parts in a message", () => {
      const message: Message = {
        id: "msg-mixed",
        role: "assistant",
        parts: [
          { type: "text", content: "Let me read the file" },
          {
            type: "tool",
            tool: {
              id: "t1",
              name: "read_file",
              input: { path: "/src/main.ts" },
              status: "completed",
            },
          },
          { type: "text", content: "Here is what I found" },
        ],
        timestamp: Date.now(),
      };

      expect(message.parts).toHaveLength(3);
      expect(message.parts[0].type).toBe("text");
      expect(message.parts[1].type).toBe("tool");
      expect(message.parts[2].type).toBe("text");
    });
  });

  describe("Text Content Extraction", () => {
    type MessagePart =
      | { type: "text"; content: string }
      | { type: "tool"; tool: { id: string; name: string; input: Record<string, unknown>; status: string } }
      | { type: "attachment"; attachment: { id: string; name: string; type: string; path: string } };

    interface Message {
      id: string;
      role: "user" | "assistant" | "system";
      parts: MessagePart[];
      timestamp: number;
    }

    function getTextContent(message: Message): string {
      return message.parts
        .filter((p): p is { type: "text"; content: string } => p.type === "text")
        .map((p) => p.content)
        .join("\n");
    }

    it("should extract text from single text part", () => {
      const message: Message = {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", content: "Hello" }],
        timestamp: Date.now(),
      };

      expect(getTextContent(message)).toBe("Hello");
    });

    it("should join multiple text parts with newlines", () => {
      const message: Message = {
        id: "msg-2",
        role: "assistant",
        parts: [
          { type: "text", content: "First paragraph" },
          { type: "text", content: "Second paragraph" },
        ],
        timestamp: Date.now(),
      };

      expect(getTextContent(message)).toBe("First paragraph\nSecond paragraph");
    });

    it("should skip non-text parts", () => {
      const message: Message = {
        id: "msg-3",
        role: "assistant",
        parts: [
          { type: "text", content: "Before tool" },
          {
            type: "tool",
            tool: { id: "t1", name: "read_file", input: {}, status: "completed" },
          },
          { type: "text", content: "After tool" },
        ],
        timestamp: Date.now(),
      };

      expect(getTextContent(message)).toBe("Before tool\nAfter tool");
    });

    it("should return empty string for no text parts", () => {
      const message: Message = {
        id: "msg-4",
        role: "assistant",
        parts: [
          {
            type: "tool",
            tool: { id: "t1", name: "exec", input: {}, status: "running" },
          },
        ],
        timestamp: Date.now(),
      };

      expect(getTextContent(message)).toBe("");
    });

    it("should return empty string for empty parts array", () => {
      const message: Message = {
        id: "msg-5",
        role: "assistant",
        parts: [],
        timestamp: Date.now(),
      };

      expect(getTextContent(message)).toBe("");
    });
  });

  describe("Tool Call Filtering", () => {
    interface ToolCall {
      id: string;
      name: string;
      input: Record<string, unknown>;
      output?: string;
      status: "pending" | "running" | "completed" | "error";
      durationMs?: number;
    }

    type MessagePart =
      | { type: "text"; content: string }
      | { type: "tool"; tool: ToolCall }
      | { type: "attachment"; attachment: { id: string; name: string; type: string; path: string } };

    it("should filter tool call parts from message", () => {
      const parts: MessagePart[] = [
        { type: "text", content: "Let me check" },
        {
          type: "tool",
          tool: { id: "t1", name: "read_file", input: { path: "/a.ts" }, status: "completed", durationMs: 50 },
        },
        {
          type: "tool",
          tool: { id: "t2", name: "write_file", input: { path: "/b.ts" }, status: "running" },
        },
        { type: "text", content: "Done" },
      ];

      const toolCalls = parts.filter(
        (p): p is { type: "tool"; tool: ToolCall } => p.type === "tool"
      );

      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0].tool.name).toBe("read_file");
      expect(toolCalls[1].tool.name).toBe("write_file");
    });

    it("should return empty array when no tool calls", () => {
      const parts: MessagePart[] = [
        { type: "text", content: "Just text" },
      ];

      const toolCalls = parts.filter(
        (p): p is { type: "tool"; tool: ToolCall } => p.type === "tool"
      );

      expect(toolCalls).toHaveLength(0);
    });
  });

  describe("Format Utilities", () => {
    function formatTime(timestamp: number): string {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    function formatDate(timestamp: number): string {
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
      } else {
        return date.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
      }
    }

    it("should format time from timestamp", () => {
      const timestamp = new Date(2024, 0, 15, 14, 30).getTime();
      const result = formatTime(timestamp);
      expect(result).toContain("30");
    });

    it("should return Today for today's date", () => {
      const now = Date.now();
      expect(formatDate(now)).toBe("Today");
    });

    it("should return Yesterday for yesterday's date", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(12, 0, 0, 0);
      expect(formatDate(yesterday.getTime())).toBe("Yesterday");
    });

    it("should return formatted date for older dates", () => {
      const oldDate = new Date(2023, 5, 15, 12, 0).getTime();
      const result = formatDate(oldDate);
      expect(result).not.toBe("Today");
      expect(result).not.toBe("Yesterday");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("Role Detection", () => {
    interface Message {
      id: string;
      role: "user" | "assistant" | "system";
      parts: { type: "text"; content: string }[];
      timestamp: number;
    }

    it("should detect user role", () => {
      const message: Message = {
        id: "m1",
        role: "user",
        parts: [{ type: "text", content: "Hi" }],
        timestamp: Date.now(),
      };

      const isUser = message.role === "user";
      const isAssistant = message.role === "assistant";
      const isSystem = message.role === "system";

      expect(isUser).toBe(true);
      expect(isAssistant).toBe(false);
      expect(isSystem).toBe(false);
    });

    it("should detect assistant role", () => {
      const message: Message = {
        id: "m2",
        role: "assistant",
        parts: [{ type: "text", content: "Hello" }],
        timestamp: Date.now(),
      };

      expect(message.role === "assistant").toBe(true);
      expect(message.role === "user").toBe(false);
    });

    it("should detect system role", () => {
      const message: Message = {
        id: "m3",
        role: "system",
        parts: [{ type: "text", content: "System prompt" }],
        timestamp: Date.now(),
      };

      expect(message.role === "system").toBe(true);
    });

    it("should map role to display name", () => {
      const roleNames: Record<string, string> = {
        user: "You",
        assistant: "Cortex",
        system: "System",
      };

      expect(roleNames["user"]).toBe("You");
      expect(roleNames["assistant"]).toBe("Cortex");
      expect(roleNames["system"]).toBe("System");
    });
  });

  describe("Snake Delay Animation", () => {
    function getSnakeDelay(index: number): number {
      const snakeOrder = [0, 1, 2, 5, 4, 3, 6, 7, 8];
      return snakeOrder.indexOf(index) * 100;
    }

    it("should return correct delay for first cell", () => {
      expect(getSnakeDelay(0)).toBe(0);
    });

    it("should return correct delay for last cell", () => {
      expect(getSnakeDelay(8)).toBe(800);
    });

    it("should follow snake order pattern", () => {
      expect(getSnakeDelay(3)).toBe(500);
      expect(getSnakeDelay(4)).toBe(400);
      expect(getSnakeDelay(5)).toBe(300);
    });

    it("should produce unique delays for all 9 cells", () => {
      const delays = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(getSnakeDelay);
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBe(9);
    });
  });
});
