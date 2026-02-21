import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { ChatMessageBubble } from "../CortexChatMessageBubble";
import type { ChatMessage } from "../CortexChatPanel";

vi.mock("../primitives", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
}));

vi.mock("@/utils/shikiHighlighter", () => ({
  highlightCode: vi.fn().mockResolvedValue('<span class="highlighted">code</span>'),
  normalizeLanguage: vi.fn((lang: string) => lang),
}));

describe("CortexChatMessageBubble", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  const createUserMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
    id: "msg-user-1",
    type: "user",
    content: "Hello, can you help me?",
    ...overrides,
  });

  const createAssistantMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
    id: "msg-agent-1",
    type: "agent",
    content: "Of course! How can I help you today?",
    ...overrides,
  });

  describe("Renders user message with correct alignment", () => {
    it("should render user message content", () => {
      const message = createUserMessage();
      const { container } = render(() => <ChatMessageBubble message={message} />);

      expect(container.textContent).toContain("Hello, can you help me?");
    });

    it("should apply user message background style", () => {
      const message = createUserMessage();
      const { container } = render(() => <ChatMessageBubble message={message} />);

      const bubble = container.firstChild as HTMLElement;
      expect(bubble.style.background).toBe("var(--cortex-chat-user-msg-bg)");
    });

    it("should apply border-radius for user messages", () => {
      const message = createUserMessage();
      const { container } = render(() => <ChatMessageBubble message={message} />);

      const bubble = container.firstChild as HTMLElement;
      expect(bubble.style.borderRadius).toBe("var(--cortex-sidebar-radius, 12px)");
    });

    it("should render user message with padding", () => {
      const message = createUserMessage();
      const { container } = render(() => <ChatMessageBubble message={message} />);

      const bubble = container.firstChild as HTMLElement;
      expect(bubble.style.padding).toBe("12px");
    });
  });

  describe("Renders assistant message with correct alignment", () => {
    it("should render assistant message content", () => {
      const message = createAssistantMessage();
      const { container } = render(() => <ChatMessageBubble message={message} />);

      expect(container.textContent).toContain("Of course! How can I help you today?");
    });

    it("should apply transparent background for assistant messages", () => {
      const message = createAssistantMessage();
      const { container } = render(() => <ChatMessageBubble message={message} />);

      const bubble = container.firstChild as HTMLElement;
      expect(bubble.style.background).toBe("transparent");
    });

    it("should not apply border-radius for assistant messages", () => {
      const message = createAssistantMessage();
      const { container } = render(() => <ChatMessageBubble message={message} />);

      const bubble = container.firstChild as HTMLElement;
      expect(bubble.style.borderRadius).toMatch(/^0(px)?$/);
    });

    it("should render assistant message with gap for sub-elements", () => {
      const message = createAssistantMessage();
      const { container } = render(() => <ChatMessageBubble message={message} />);

      const bubble = container.firstChild as HTMLElement;
      expect(bubble.style.gap).toBe("4px");
    });
  });

  describe("Renders code blocks with syntax highlighting placeholder", () => {
    it("should render code block content", () => {
      const message = createAssistantMessage({
        codeBlocks: [{ language: "typescript", code: "const x: number = 42;" }],
      });

      const { container } = render(() => <ChatMessageBubble message={message} />);

      expect(container.textContent).toContain("const x: number = 42;");
    });

    it("should render code block language label", () => {
      const message = createAssistantMessage({
        codeBlocks: [{ language: "typescript", code: "const x = 1;" }],
      });

      const { container } = render(() => <ChatMessageBubble message={message} />);

      expect(container.textContent).toContain("typescript");
    });

    it("should render multiple code blocks", () => {
      const message = createAssistantMessage({
        codeBlocks: [
          { language: "typescript", code: "const a = 1;" },
          { language: "css", code: ".container { display: flex; }" },
        ],
      });

      const { container } = render(() => <ChatMessageBubble message={message} />);

      expect(container.textContent).toContain("const a = 1;");
      expect(container.textContent).toContain(".container { display: flex; }");
    });

    it("should render fallback code when highlighting is loading", () => {
      const message = createAssistantMessage({
        codeBlocks: [{ language: "python", code: "print('hello')" }],
      });

      const { container } = render(() => <ChatMessageBubble message={message} />);

      const codeElement = container.querySelector("code");
      expect(codeElement?.textContent).toContain("print('hello')");
    });

    it("should render 'code' as default language label when language is empty", () => {
      const message = createAssistantMessage({
        codeBlocks: [{ language: "", code: "some code" }],
      });

      const { container } = render(() => <ChatMessageBubble message={message} />);

      expect(container.textContent).toContain("code");
    });
  });

  describe("Renders markdown content", () => {
    it("should render plain text content", () => {
      const message = createAssistantMessage({ content: "This is a simple response." });
      const { container } = render(() => <ChatMessageBubble message={message} />);

      expect(container.textContent).toContain("This is a simple response.");
    });

    it("should render content as paragraph element", () => {
      const message = createAssistantMessage({ content: "Paragraph content" });
      const { container } = render(() => <ChatMessageBubble message={message} />);

      const paragraph = container.querySelector("p");
      expect(paragraph).toBeTruthy();
      expect(paragraph?.textContent).toContain("Paragraph content");
    });

    it("should preserve whitespace in content", () => {
      const message = createAssistantMessage({ content: "Line 1\nLine 2" });
      const { container } = render(() => <ChatMessageBubble message={message} />);

      const paragraph = container.querySelector("p");
      expect(paragraph?.style.whiteSpace).toBe("pre-wrap");
    });

    it("should render thinking indicator when isThinking is true", () => {
      const message = createAssistantMessage({ isThinking: true, content: "" });
      const { container } = render(() => <ChatMessageBubble message={message} />);

      expect(container.textContent).toContain("Thinking...");
    });

    it("should render thinking indicator with star icon", () => {
      const message = createAssistantMessage({ isThinking: true, content: "" });
      const { getByTestId } = render(() => <ChatMessageBubble message={message} />);

      expect(getByTestId("icon-star")).toBeTruthy();
    });

    it("should toggle thinking expanded state when clicked", async () => {
      const message = createAssistantMessage({ isThinking: true, content: "" });
      const { container } = render(() => <ChatMessageBubble message={message} />);

      const thinkingButton = container.querySelector("button");
      expect(thinkingButton?.textContent).toContain("▸ Thinking...");

      if (thinkingButton) {
        await fireEvent.click(thinkingButton);
      }

      expect(thinkingButton?.textContent).toContain("▾ Thinking...");
    });

    it("should render progress items", () => {
      const message = createAssistantMessage({
        progress: [
          { id: "p1", label: "Analyzing code", status: "completed" },
          { id: "p2", label: "Generating output", status: "running" },
        ],
      });

      const { container } = render(() => <ChatMessageBubble message={message} />);

      expect(container.textContent).toContain("Analyzing code");
      expect(container.textContent).toContain("Generating output");
    });

    it("should render tool calls", () => {
      const message = createAssistantMessage({
        toolCalls: [
          { name: "read_file", status: "completed", filesEdited: 2 },
          { name: "write_file", status: "running" },
        ],
      });

      const { container } = render(() => <ChatMessageBubble message={message} />);

      expect(container.textContent).toContain("read_file");
      expect(container.textContent).toContain("write_file");
      expect(container.textContent).toContain("Edited 2 files");
    });

    it("should render action buttons", () => {
      const onClick = vi.fn();
      const message = createAssistantMessage({
        actions: [
          { id: "a1", label: "Review", icon: "eye", onClick },
        ],
      });

      const { container } = render(() => <ChatMessageBubble message={message} />);

      expect(container.textContent).toContain("Review");
    });

    it("should call action onClick when action button is clicked", async () => {
      const onClick = vi.fn();
      const message = createAssistantMessage({
        actions: [
          { id: "a1", label: "Review", onClick },
        ],
      });

      const { container } = render(() => <ChatMessageBubble message={message} />);

      const actionButton = Array.from(container.querySelectorAll("button")).find(
        btn => btn.textContent?.includes("Review")
      );
      if (actionButton) {
        await fireEvent.click(actionButton);
      }

      expect(onClick).toHaveBeenCalled();
    });
  });

  describe("Copy button works", () => {
    it("should render copy button on code blocks", () => {
      const message = createAssistantMessage({
        codeBlocks: [{ language: "typescript", code: "const x = 1;" }],
      });

      const { getByTestId } = render(() => <ChatMessageBubble message={message} />);

      expect(getByTestId("icon-copy")).toBeTruthy();
    });

    it("should have copy button with correct title", () => {
      const message = createAssistantMessage({
        codeBlocks: [{ language: "typescript", code: "const x = 1;" }],
      });

      const { container } = render(() => <ChatMessageBubble message={message} />);

      const copyButton = container.querySelector("button[title='Copy code']");
      expect(copyButton).toBeTruthy();
    });

    it("should change icon to check after copy", async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      const message = createAssistantMessage({
        codeBlocks: [{ language: "typescript", code: "const x = 1;" }],
      });

      const { container, getByTestId } = render(() => <ChatMessageBubble message={message} />);

      const copyButton = container.querySelector("button[title='Copy code']");
      if (copyButton) {
        await fireEvent.click(copyButton);
      }

      expect(getByTestId("icon-check")).toBeTruthy();
    });

    it("should copy code content to clipboard", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText },
      });

      const message = createAssistantMessage({
        codeBlocks: [{ language: "typescript", code: "const x = 1;" }],
      });

      const { container } = render(() => <ChatMessageBubble message={message} />);

      const copyButton = container.querySelector("button[title='Copy code']");
      if (copyButton) {
        await fireEvent.click(copyButton);
      }

      expect(writeText).toHaveBeenCalledWith("const x = 1;");
    });

    it("should show 'Copied!' title after copy", async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      const message = createAssistantMessage({
        codeBlocks: [{ language: "typescript", code: "const x = 1;" }],
      });

      const { container } = render(() => <ChatMessageBubble message={message} />);

      const copyButton = container.querySelector("button[title='Copy code']") as HTMLButtonElement;
      if (copyButton) {
        await fireEvent.click(copyButton);
      }

      expect(copyButton?.title).toBe("Copied!");
    });

    it("should render undo button for tool calls with onUndo", () => {
      const onUndo = vi.fn();
      const message = createAssistantMessage({
        toolCalls: [
          { name: "edit_file", status: "completed", onUndo },
        ],
      });

      const { container } = render(() => <ChatMessageBubble message={message} />);

      expect(container.textContent).toContain("Undo Changes");
    });

    it("should call onUndo when undo button is clicked", async () => {
      const onUndo = vi.fn();
      const message = createAssistantMessage({
        toolCalls: [
          { name: "edit_file", status: "completed", onUndo },
        ],
      });

      const { container } = render(() => <ChatMessageBubble message={message} />);

      const undoButton = Array.from(container.querySelectorAll("button")).find(
        btn => btn.textContent?.includes("Undo Changes")
      );
      if (undoButton) {
        await fireEvent.click(undoButton);
      }

      expect(onUndo).toHaveBeenCalled();
    });
  });

  describe("Styling", () => {
    it("should use column flex direction", () => {
      const message = createUserMessage();
      const { container } = render(() => <ChatMessageBubble message={message} />);

      const bubble = container.firstChild as HTMLElement;
      expect(bubble.style.display).toBe("flex");
      expect(bubble.style.flexDirection).toBe("column");
    });

    it("should render content with proper font size", () => {
      const message = createAssistantMessage();
      const { container } = render(() => <ChatMessageBubble message={message} />);

      const paragraph = container.querySelector("p") as HTMLElement;
      expect(paragraph?.style.fontSize).toBe("14px");
    });
  });
});
