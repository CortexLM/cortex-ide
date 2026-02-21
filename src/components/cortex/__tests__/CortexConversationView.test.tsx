import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexConversationView } from "../CortexConversationView";
import type { Message } from "../CortexConversationView";

vi.mock("../primitives/CortexInput", () => ({
  CortexPromptInput: (props: {
    value?: string;
    placeholder?: string;
    onChange?: (v: string) => void;
    onSubmit?: (v: string) => void;
    onStop?: () => void;
    isProcessing?: boolean;
    modelName?: string;
    onModelClick?: () => void;
  }) => (
    <div data-testid="prompt-input">
      <input
        data-testid="prompt-text-input"
        value={props.value || ""}
        placeholder={props.placeholder}
        onInput={(e) => props.onChange?.(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") props.onSubmit?.(props.value || "");
        }}
      />
      <button data-testid="stop-button" onClick={props.onStop}>Stop</button>
      <span data-testid="model-name">{props.modelName}</span>
      {props.isProcessing && <span data-testid="processing-indicator">Processing</span>}
    </div>
  ),
}));

vi.mock("../vibe/VibeTabBar", () => ({
  VibeTabBar: (props: { tabs: { id: string; label: string }[]; activeId: string; onTabChange: (id: string) => void; trailing?: any }) => (
    <div data-testid="vibe-tab-bar">
      {props.tabs.map((tab: { id: string; label: string }) => (
        <button
          data-testid={`tab-${tab.id}`}
          data-active={props.activeId === tab.id}
          onClick={() => props.onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
      {props.trailing}
    </div>
  ),
}));

vi.mock("../vibe/MessageBubble", () => ({
  MessageBubble: (props: { message: { id: string; role: string; content: string }; isStreaming?: boolean }) => (
    <div data-testid={`message-${props.message.id}`} data-role={props.message.role} data-streaming={props.isStreaming}>
      <span data-testid={`message-content-${props.message.id}`}>{props.message.content}</span>
      {props.isStreaming && <span data-testid="streaming-indicator">Streaming...</span>}
    </div>
  ),
}));

describe("CortexConversationView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  const baseMessages: Message[] = [
    { id: "1", role: "user", content: "Build a todo app" },
    { id: "2", role: "assistant", content: "I'll create a todo app for you." },
    { id: "3", role: "user", content: "Add dark mode" },
    { id: "4", role: "assistant", content: "Adding dark mode support now." },
  ];

  describe("Renders message list", () => {
    it("should render all messages", () => {
      const { container } = render(() => (
        <CortexConversationView messages={baseMessages} />
      ));

      expect(container.textContent).toContain("Build a todo app");
      expect(container.textContent).toContain("I'll create a todo app for you.");
      expect(container.textContent).toContain("Add dark mode");
      expect(container.textContent).toContain("Adding dark mode support now.");
    });

    it("should render empty state when no messages", () => {
      const { container } = render(() => (
        <CortexConversationView messages={[]} />
      ));

      expect(container.querySelector("[data-testid^='message-']")).toBeNull();
    });

    it("should render first user message in task bubble (not via MessageBubble)", () => {
      const { container, queryByTestId } = render(() => (
        <CortexConversationView messages={baseMessages} />
      ));

      expect(container.textContent).toContain("Build a todo app");
      expect(queryByTestId("message-1")).toBeNull();
    });

    it("should render subsequent messages via MessageBubble", () => {
      const { getByTestId } = render(() => (
        <CortexConversationView messages={baseMessages} />
      ));

      expect(getByTestId("message-2")).toBeTruthy();
      expect(getByTestId("message-3")).toBeTruthy();
      expect(getByTestId("message-4")).toBeTruthy();
    });
  });

  describe("Input area for new messages", () => {
    it("should render prompt input", () => {
      const { getByTestId } = render(() => (
        <CortexConversationView messages={[]} />
      ));

      expect(getByTestId("prompt-input")).toBeTruthy();
    });

    it("should pass inputValue to prompt input", () => {
      const { getByTestId } = render(() => (
        <CortexConversationView messages={[]} inputValue="test value" />
      ));

      const input = getByTestId("prompt-text-input") as HTMLInputElement;
      expect(input.value).toBe("test value");
    });

    it("should call onInputChange when input changes", async () => {
      const onInputChange = vi.fn();
      const { getByTestId } = render(() => (
        <CortexConversationView messages={[]} onInputChange={onInputChange} />
      ));

      const input = getByTestId("prompt-text-input");
      await fireEvent.input(input, { target: { value: "hello" } });

      expect(onInputChange).toHaveBeenCalledWith("hello");
    });

    it("should call onSubmit when Enter is pressed", async () => {
      const onSubmit = vi.fn();
      const { getByTestId } = render(() => (
        <CortexConversationView messages={[]} inputValue="my prompt" onSubmit={onSubmit} />
      ));

      const input = getByTestId("prompt-text-input");
      await fireEvent.keyDown(input, { key: "Enter" });

      expect(onSubmit).toHaveBeenCalledWith("my prompt");
    });

    it("should call onStop when stop button is clicked", async () => {
      const onStop = vi.fn();
      const { getByTestId } = render(() => (
        <CortexConversationView messages={[]} isProcessing={true} onStop={onStop} />
      ));

      await fireEvent.click(getByTestId("stop-button"));
      expect(onStop).toHaveBeenCalled();
    });

    it("should display model name", () => {
      const { getByTestId } = render(() => (
        <CortexConversationView messages={[]} modelName="gpt-4o" />
      ));

      expect(getByTestId("model-name").textContent).toBe("gpt-4o");
    });

    it("should display default model name when not provided", () => {
      const { getByTestId } = render(() => (
        <CortexConversationView messages={[]} />
      ));

      expect(getByTestId("model-name").textContent).toBe("claude-opus-4.5");
    });

    it("should show placeholder text in input", () => {
      const { getByTestId } = render(() => (
        <CortexConversationView messages={[]} />
      ));

      const input = getByTestId("prompt-text-input") as HTMLInputElement;
      expect(input.placeholder).toBe("Send a prompt or run a command...");
    });
  });

  describe("Message bubbles display user/assistant differently", () => {
    it("should render first user message as task bubble outside MessageBubble", () => {
      const messages: Message[] = [
        { id: "u1", role: "user", content: "Create a dashboard" },
        { id: "a1", role: "assistant", content: "Working on it..." },
      ];

      const { queryByTestId, container } = render(() => (
        <CortexConversationView messages={messages} />
      ));

      expect(container.textContent).toContain("Create a dashboard");
      expect(queryByTestId("message-u1")).toBeNull();
    });

    it("should render assistant messages via MessageBubble with role=assistant", () => {
      const messages: Message[] = [
        { id: "u1", role: "user", content: "Hello" },
        { id: "a1", role: "assistant", content: "Hi there" },
      ];

      const { getByTestId } = render(() => (
        <CortexConversationView messages={messages} />
      ));

      const bubble = getByTestId("message-a1");
      expect(bubble.getAttribute("data-role")).toBe("assistant");
    });

    it("should render subsequent user messages via MessageBubble", () => {
      const messages: Message[] = [
        { id: "u1", role: "user", content: "First" },
        { id: "a1", role: "assistant", content: "Response" },
        { id: "u2", role: "user", content: "Second" },
      ];

      const { getByTestId } = render(() => (
        <CortexConversationView messages={messages} />
      ));

      const bubble = getByTestId("message-u2");
      expect(bubble.getAttribute("data-role")).toBe("user");
    });

    it("should not render task bubble when first message is assistant", () => {
      const messages: Message[] = [
        { id: "a1", role: "assistant", content: "Welcome!" },
      ];

      const { getByTestId } = render(() => (
        <CortexConversationView messages={messages} />
      ));

      expect(getByTestId("message-a1")).toBeTruthy();
    });
  });

  describe("Streaming state shows typing indicator", () => {
    it("should pass isStreaming=true to last assistant message when processing", () => {
      const messages: Message[] = [
        { id: "u1", role: "user", content: "Hello" },
        { id: "a1", role: "assistant", content: "Working..." },
      ];

      const { getByTestId } = render(() => (
        <CortexConversationView messages={messages} isProcessing={true} />
      ));

      const bubble = getByTestId("message-a1");
      expect(bubble.getAttribute("data-streaming")).toBe("true");
      expect(getByTestId("streaming-indicator")).toBeTruthy();
    });

    it("should not show streaming when not processing", () => {
      const messages: Message[] = [
        { id: "u1", role: "user", content: "Hello" },
        { id: "a1", role: "assistant", content: "Done." },
      ];

      const { getByTestId, queryByTestId } = render(() => (
        <CortexConversationView messages={messages} isProcessing={false} />
      ));

      const bubble = getByTestId("message-a1");
      expect(bubble.getAttribute("data-streaming")).toBe("false");
      expect(queryByTestId("streaming-indicator")).toBeNull();
    });

    it("should not show streaming on non-last message", () => {
      const messages: Message[] = [
        { id: "u1", role: "user", content: "Hello" },
        { id: "a1", role: "assistant", content: "First response" },
        { id: "u2", role: "user", content: "Follow up" },
      ];

      const { getByTestId } = render(() => (
        <CortexConversationView messages={messages} isProcessing={true} />
      ));

      const bubble = getByTestId("message-a1");
      expect(bubble.getAttribute("data-streaming")).toBe("false");
    });

    it("should not show streaming when last message is user", () => {
      const messages: Message[] = [
        { id: "u1", role: "user", content: "Hello" },
        { id: "a1", role: "assistant", content: "Response" },
        { id: "u2", role: "user", content: "Another question" },
      ];

      const { getByTestId } = render(() => (
        <CortexConversationView messages={messages} isProcessing={true} />
      ));

      const userBubble = getByTestId("message-u2");
      expect(userBubble.getAttribute("data-streaming")).toBe("false");
    });

    it("should show processing indicator in prompt input", () => {
      const { getByTestId } = render(() => (
        <CortexConversationView messages={[]} isProcessing={true} />
      ));

      expect(getByTestId("processing-indicator")).toBeTruthy();
    });
  });

  describe("Code blocks in messages render correctly", () => {
    it("should pass code blocks through message data", () => {
      const messages: Message[] = [
        {
          id: "a1",
          role: "assistant",
          content: "Here is the code",
          codeBlocks: [{ language: "typescript", code: "const x = 1;" }],
        },
      ];

      const { getByTestId } = render(() => (
        <CortexConversationView messages={messages} />
      ));

      expect(getByTestId("message-a1")).toBeTruthy();
      expect(getByTestId("message-content-a1").textContent).toBe("Here is the code");
    });

    it("should render messages with reasoning", () => {
      const messages: Message[] = [
        {
          id: "a1",
          role: "assistant",
          content: "Result",
          reasoning: "I thought about it carefully",
        },
      ];

      const { getByTestId } = render(() => (
        <CortexConversationView messages={messages} />
      ));

      expect(getByTestId("message-a1")).toBeTruthy();
    });

    it("should render messages with file diffs", () => {
      const messages: Message[] = [
        {
          id: "a1",
          role: "assistant",
          content: "Updated files",
          fileDiffs: [{ path: "src/main.ts", additions: 10, deletions: 3 }],
        },
      ];

      const { getByTestId } = render(() => (
        <CortexConversationView messages={messages} />
      ));

      expect(getByTestId("message-a1")).toBeTruthy();
    });
  });

  describe("Tab bar", () => {
    it("should render tab bar with default tabs", () => {
      const { getByTestId } = render(() => (
        <CortexConversationView messages={[]} />
      ));

      expect(getByTestId("vibe-tab-bar")).toBeTruthy();
      expect(getByTestId("tab-all_changes")).toBeTruthy();
      expect(getByTestId("tab-current_task")).toBeTruthy();
      expect(getByTestId("tab-review")).toBeTruthy();
    });

    it("should call onTabChange when tab is clicked", async () => {
      const onTabChange = vi.fn();
      const { getByTestId } = render(() => (
        <CortexConversationView messages={[]} onTabChange={onTabChange} />
      ));

      await fireEvent.click(getByTestId("tab-current_task"));
      expect(onTabChange).toHaveBeenCalledWith("current_task");
    });

    it("should use activeTab prop as default active tab", () => {
      const { getByTestId } = render(() => (
        <CortexConversationView messages={[]} activeTab="review" />
      ));

      const reviewTab = getByTestId("tab-review");
      expect(reviewTab.getAttribute("data-active")).toBe("true");
    });
  });

  describe("Status display", () => {
    it("should render status badge when status is provided", () => {
      const { container } = render(() => (
        <CortexConversationView messages={[]} status="in_progress" />
      ));

      expect(container.textContent).toContain("In Progress");
    });

    it("should render ready_to_merge status", () => {
      const { container } = render(() => (
        <CortexConversationView messages={[]} status="ready_to_merge" />
      ));

      expect(container.textContent).toContain("Ready to merge");
    });

    it("should render merged status", () => {
      const { container } = render(() => (
        <CortexConversationView messages={[]} status="merged" />
      ));

      expect(container.textContent).toContain("Merged");
    });

    it("should render error status", () => {
      const { container } = render(() => (
        <CortexConversationView messages={[]} status="error" />
      ));

      expect(container.textContent).toContain("Error");
    });
  });

  describe("Styling", () => {
    it("should apply custom class", () => {
      const { container } = render(() => (
        <CortexConversationView messages={[]} class="custom-class" />
      ));

      const root = container.firstChild as HTMLElement;
      expect(root?.className).toContain("custom-class");
    });

    it("should apply custom style", () => {
      const { container } = render(() => (
        <CortexConversationView messages={[]} style={{ "background-color": "red" }} />
      ));

      const root = container.firstChild as HTMLElement;
      expect(root?.style.backgroundColor).toBe("red");
    });
  });
});
