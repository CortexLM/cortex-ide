import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexChatPanel } from "../CortexChatPanel";
import type {
  ChatPanelState,
  ChatMessage,
  ChatAction,
  ChatProgress,
  ChatToolCall,
  CortexChatPanelProps,
} from "../CortexChatPanel";

vi.mock("../primitives", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
  CortexButton: (props: { children?: any; onClick?: () => void; variant?: string; size?: string; [key: string]: any }) => (
    <button data-testid="cortex-button" data-variant={props.variant} data-size={props.size} onClick={props.onClick}>
      {props.children}
    </button>
  ),
  CortexPromptInput: (props: {
    value?: string;
    placeholder?: string;
    onChange?: (v: string) => void;
    onSubmit?: (v: string) => void;
    onStop?: () => void;
    isProcessing?: boolean;
    modelName?: string;
    onModelClick?: () => void;
    onPlusClick?: () => void;
    onUploadClick?: () => void;
  }) => (
    <div data-testid="prompt-input">
      <input
        data-testid="prompt-text-input"
        value={props.value || ""}
        placeholder={props.placeholder}
        onInput={(e) => props.onChange?.(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            props.onSubmit?.(props.value || "");
          }
        }}
      />
      <button data-testid="stop-button" onClick={props.onStop}>
        Stop
      </button>
      <span data-testid="model-name">{props.modelName}</span>
      <button data-testid="model-button" onClick={props.onModelClick}>
        Model
      </button>
      <button data-testid="plus-button" onClick={props.onPlusClick}>
        Plus
      </button>
      <button data-testid="upload-button" onClick={props.onUploadClick}>
        Upload
      </button>
      {props.isProcessing && <span data-testid="processing-indicator">Processing</span>}
    </div>
  ),
}));

describe("CortexChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("Interfaces", () => {
    it("should have correct ChatPanelState type", () => {
      const states: ChatPanelState[] = ["home", "minimized", "expanded"];
      expect(states).toContain("home");
      expect(states).toContain("minimized");
      expect(states).toContain("expanded");
    });

    it("should have correct ChatMessage interface structure", () => {
      const message: ChatMessage = {
        id: "msg-1",
        type: "user",
        content: "Hello, AI!",
        timestamp: new Date(),
        actions: [{ id: "action-1", label: "Copy", icon: "copy" }],
        isThinking: false,
        progress: [{ id: "step-1", label: "Processing", status: "completed" }],
      };

      expect(message.id).toBe("msg-1");
      expect(message.type).toBe("user");
      expect(message.content).toBe("Hello, AI!");
      expect(message.actions).toHaveLength(1);
      expect(message.progress).toHaveLength(1);
    });

    it("should have correct ChatAction interface structure", () => {
      const action: ChatAction = {
        id: "action-1",
        label: "Copy",
        icon: "copy",
        onClick: vi.fn(),
      };

      expect(action.id).toBe("action-1");
      expect(action.label).toBe("Copy");
      expect(action.icon).toBe("copy");
      expect(typeof action.onClick).toBe("function");
    });

    it("should have correct ChatProgress interface structure", () => {
      const progress: ChatProgress = {
        id: "step-1",
        label: "Analyzing code",
        status: "running",
      };

      expect(progress.id).toBe("step-1");
      expect(progress.label).toBe("Analyzing code");
      expect(progress.status).toBe("running");
    });

    it("should have correct ChatToolCall interface structure", () => {
      const toolCall: ChatToolCall = {
        name: "edit_file",
        status: "completed",
        filesEdited: 3,
        onUndo: vi.fn(),
        onReview: vi.fn(),
      };

      expect(toolCall.name).toBe("edit_file");
      expect(toolCall.status).toBe("completed");
      expect(toolCall.filesEdited).toBe(3);
      expect(typeof toolCall.onUndo).toBe("function");
      expect(typeof toolCall.onReview).toBe("function");
    });

    it("should have correct CortexChatPanelProps interface structure", () => {
      const props: CortexChatPanelProps = {
        state: "home",
        messages: [],
        inputValue: "",
        onInputChange: vi.fn(),
        onSubmit: vi.fn(),
        onStop: vi.fn(),
        isProcessing: false,
        modelName: "Claude 3.5",
        modelIcon: "brain",
        onModelClick: vi.fn(),
        onPlusClick: vi.fn(),
        onUploadClick: vi.fn(),
        onBuildClick: vi.fn(),
        onImportCodeClick: vi.fn(),
        onImportDesignClick: vi.fn(),
        class: "custom-class",
        style: { width: "400px" },
      };

      expect(props.state).toBe("home");
      expect(props.modelName).toBe("Claude 3.5");
    });

    it("should support all ChatProgress status values", () => {
      const statuses: ChatProgress["status"][] = ["pending", "running", "completed", "error"];
      expect(statuses).toHaveLength(4);
    });

    it("should support all ChatToolCall status values", () => {
      const statuses: ChatToolCall["status"][] = ["running", "completed", "error"];
      expect(statuses).toHaveLength(3);
    });
  });

  describe("Home State", () => {
    it("should render home state by default", () => {
      const { container } = render(() => <CortexChatPanel />);
      expect(container.textContent).toContain("What would you like to build");
    });

    it("should render home state when state is home", () => {
      const { container } = render(() => <CortexChatPanel state="home" />);
      expect(container.textContent).toContain("What would you like to build");
      expect(container.textContent).toContain("Start a conversation or open a project");
    });

    it("should render prompt input in home state", () => {
      const { getByTestId } = render(() => <CortexChatPanel state="home" />);
      expect(getByTestId("prompt-input")).toBeTruthy();
    });

    it("should render quick action buttons in home state", () => {
      const { container } = render(() => <CortexChatPanel state="home" />);
      expect(container.textContent).toContain("Build");
      expect(container.textContent).toContain("Import Code");
      expect(container.textContent).toContain("Import Design");
    });

    it("should call onBuildClick when Build button is clicked", async () => {
      const onBuildClick = vi.fn();
      const { container } = render(() => (
        <CortexChatPanel state="home" onBuildClick={onBuildClick} />
      ));

      const buildButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Build")
      );
      if (buildButton) {
        await fireEvent.click(buildButton);
      }

      expect(onBuildClick).toHaveBeenCalled();
    });

    it("should call onImportCodeClick when Import Code button is clicked", async () => {
      const onImportCodeClick = vi.fn();
      const { container } = render(() => (
        <CortexChatPanel state="home" onImportCodeClick={onImportCodeClick} />
      ));

      const importButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Import Code")
      );
      if (importButton) {
        await fireEvent.click(importButton);
      }

      expect(onImportCodeClick).toHaveBeenCalled();
    });

    it("should call onImportDesignClick when Import Design button is clicked", async () => {
      const onImportDesignClick = vi.fn();
      const { container } = render(() => (
        <CortexChatPanel state="home" onImportDesignClick={onImportDesignClick} />
      ));

      const importButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Import Design")
      );
      if (importButton) {
        await fireEvent.click(importButton);
      }

      expect(onImportDesignClick).toHaveBeenCalled();
    });

    it("should render logo image in home state", () => {
      const { container } = render(() => <CortexChatPanel state="home" />);
      const logo = container.querySelector("img");
      expect(logo).toBeTruthy();
      expect(logo?.getAttribute("src")).toBe("/assets/claude-logo.svg");
    });

    it("should render title as h1 with 56px font size", () => {
      const { container } = render(() => <CortexChatPanel state="home" />);
      const h1 = container.querySelector("h1");
      expect(h1).toBeTruthy();
      expect(h1?.style.fontSize).toBe("56px");
      expect(h1?.style.fontWeight).toBe("500");
    });

    it("should render subtitle as p element", () => {
      const { container } = render(() => <CortexChatPanel state="home" />);
      const subtitle = container.querySelector("p");
      expect(subtitle).toBeTruthy();
      expect(subtitle?.textContent).toBe("Start a conversation or open a project");
    });

    it("should center content in home state", () => {
      const { container } = render(() => <CortexChatPanel state="home" />);
      const root = container.firstElementChild as HTMLElement;
      expect(root?.style.alignItems).toBe("center");
      expect(root?.style.justifyContent).toBe("center");
    });
  });

  describe("Minimized State", () => {
    it("should render minimized state", () => {
      const { container } = render(() => <CortexChatPanel state="minimized" />);
      expect(container.textContent).toContain("What would you like to build");
    });

    it("should render minimized title as h2", () => {
      const { container } = render(() => <CortexChatPanel state="minimized" />);
      const h2 = container.querySelector("h2");
      expect(h2).toBeTruthy();
      expect(h2?.textContent).toBe("What would you like to build?");
    });

    it("should render subtitle in minimized state", () => {
      const { container } = render(() => <CortexChatPanel state="minimized" />);
      const subtitle = container.querySelector("p");
      expect(subtitle?.textContent).toBe("Start a conversation or open a project");
    });

    it("should render prompt input in minimized state", () => {
      const { getByTestId } = render(() => <CortexChatPanel state="minimized" />);
      expect(getByTestId("prompt-input")).toBeTruthy();
    });

    it("should have absolute positioning in minimized state", () => {
      const { container } = render(() => <CortexChatPanel state="minimized" />);
      const panel = container.firstElementChild as HTMLElement;
      const style = panel?.getAttribute("style") || "";
      expect(style).toContain("position:absolute");
    });

    it("should have correct dimensions in minimized state", () => {
      const { container } = render(() => <CortexChatPanel state="minimized" />);
      const panel = container.firstElementChild as HTMLElement;
      const style = panel?.getAttribute("style") || "";
      expect(style).toContain("width:369px");
      expect(style).toContain("height:297px");
    });

    it("should have bottom-left positioning", () => {
      const { container } = render(() => <CortexChatPanel state="minimized" />);
      const panel = container.firstElementChild as HTMLElement;
      const style = panel?.getAttribute("style") || "";
      expect(style).toContain("left:");
      expect(style).toContain("bottom:");
    });

    it("should have border-radius 16px", () => {
      const { container } = render(() => <CortexChatPanel state="minimized" />);
      const panel = container.firstElementChild as HTMLElement;
      const style = panel?.getAttribute("style") || "";
      expect(style).toContain("border-radius:16px");
    });

    it("should not render Build/Import buttons in minimized state", () => {
      const { container } = render(() => <CortexChatPanel state="minimized" />);
      expect(container.textContent).not.toContain("Import Code");
      expect(container.textContent).not.toContain("Import Design");
    });
  });

  describe("Expanded State", () => {
    it("should render expanded state with messages", () => {
      const messages: ChatMessage[] = [
        { id: "1", type: "user", content: "Hello!" },
        { id: "2", type: "agent", content: "Hi there!" },
      ];

      const { container } = render(() => (
        <CortexChatPanel state="expanded" messages={messages} />
      ));

      expect(container.textContent).toContain("Hello!");
      expect(container.textContent).toContain("Hi there!");
    });

    it("should render prompt input in expanded state", () => {
      const { getByTestId } = render(() => <CortexChatPanel state="expanded" />);
      expect(getByTestId("prompt-input")).toBeTruthy();
    });

    it("should render thinking indicator when message is thinking", () => {
      const messages: ChatMessage[] = [
        { id: "1", type: "agent", content: "", isThinking: true },
      ];

      const { container } = render(() => (
        <CortexChatPanel state="expanded" messages={messages} />
      ));

      expect(container.textContent).toContain("Thinking...");
    });

    it("should render progress items", () => {
      const messages: ChatMessage[] = [
        {
          id: "1",
          type: "agent",
          content: "Working...",
          progress: [
            { id: "step-1", label: "Analyzing", status: "completed" },
            { id: "step-2", label: "Generating", status: "running" },
          ],
        },
      ];

      const { container } = render(() => (
        <CortexChatPanel state="expanded" messages={messages} />
      ));

      expect(container.textContent).toContain("Analyzing");
      expect(container.textContent).toContain("Generating");
    });

    it("should render action buttons on messages", async () => {
      const onClick = vi.fn();
      const messages: ChatMessage[] = [
        {
          id: "1",
          type: "agent",
          content: "Here is the code",
          actions: [{ id: "copy", label: "Copy", onClick }],
        },
      ];

      const { container } = render(() => (
        <CortexChatPanel state="expanded" messages={messages} />
      ));

      const copyButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Copy")
      );
      expect(copyButton).toBeTruthy();

      if (copyButton) {
        await fireEvent.click(copyButton);
      }
      expect(onClick).toHaveBeenCalled();
    });

    it("should render empty state when messages array is empty", () => {
      const { getByTestId } = render(() => (
        <CortexChatPanel state="expanded" messages={[]} />
      ));
      expect(getByTestId("prompt-input")).toBeTruthy();
    });

    it("should render messages in order", () => {
      const messages: ChatMessage[] = [
        { id: "1", type: "user", content: "First message" },
        { id: "2", type: "agent", content: "Second message" },
        { id: "3", type: "user", content: "Third message" },
      ];

      const { container } = render(() => (
        <CortexChatPanel state="expanded" messages={messages} />
      ));

      const text = container.textContent || "";
      const firstIdx = text.indexOf("First message");
      const secondIdx = text.indexOf("Second message");
      const thirdIdx = text.indexOf("Third message");
      expect(firstIdx).toBeLessThan(secondIdx);
      expect(secondIdx).toBeLessThan(thirdIdx);
    });

    it("should have absolute positioning in expanded state", () => {
      const { container } = render(() => (
        <CortexChatPanel state="expanded" />
      ));
      const panel = container.firstElementChild as HTMLElement;
      const style = panel?.getAttribute("style") || "";
      expect(style).toContain("position:");
    });

    it("should have max-height in expanded state", () => {
      const { container } = render(() => (
        <CortexChatPanel state="expanded" />
      ));
      const panel = container.firstElementChild as HTMLElement;
      const style = panel?.getAttribute("style") || "";
      expect(style).toContain("max-height:");
    });

    it("should have scrollable message area", () => {
      const { container } = render(() => (
        <CortexChatPanel state="expanded" messages={[]} />
      ));
      const scrollArea = Array.from(container.querySelectorAll("div")).find(
        (el) => el.style.overflowY === "auto"
      );
      expect(scrollArea).toBeTruthy();
    });

    it("should render tool calls in messages", () => {
      const messages: ChatMessage[] = [
        {
          id: "1",
          type: "agent",
          content: "Done editing",
          toolCalls: [
            { name: "edit_file", status: "completed", filesEdited: 2 },
          ],
        },
      ];

      const { container } = render(() => (
        <CortexChatPanel state="expanded" messages={messages} />
      ));

      expect(container.textContent).toContain("Done editing");
    });

    it("should render code blocks in messages", () => {
      const messages: ChatMessage[] = [
        {
          id: "1",
          type: "agent",
          content: "Here is the code",
          codeBlocks: [{ language: "typescript", code: "const x = 1;" }],
        },
      ];

      const { container } = render(() => (
        <CortexChatPanel state="expanded" messages={messages} />
      ));

      expect(container.textContent).toContain("Here is the code");
    });

    it("should handle messages without optional fields", () => {
      const messages: ChatMessage[] = [
        { id: "1", type: "user", content: "Simple message" },
      ];

      const { container } = render(() => (
        <CortexChatPanel state="expanded" messages={messages} />
      ));

      expect(container.textContent).toContain("Simple message");
    });
  });

  describe("Input Handling", () => {
    it("should call onInputChange when input changes", async () => {
      const onInputChange = vi.fn();

      const { getByTestId } = render(() => (
        <CortexChatPanel state="home" onInputChange={onInputChange} />
      ));

      const input = getByTestId("prompt-text-input");
      await fireEvent.input(input, { target: { value: "test" } });

      expect(onInputChange).toHaveBeenCalledWith("test");
    });

    it("should call onSubmit when Enter is pressed", async () => {
      const onSubmit = vi.fn();

      const { getByTestId } = render(() => (
        <CortexChatPanel state="home" inputValue="test prompt" onSubmit={onSubmit} />
      ));

      const input = getByTestId("prompt-text-input");
      await fireEvent.keyDown(input, { key: "Enter" });

      expect(onSubmit).toHaveBeenCalledWith("test prompt");
    });

    it("should call onStop when stop button is clicked", async () => {
      const onStop = vi.fn();

      const { getByTestId } = render(() => (
        <CortexChatPanel state="home" isProcessing={true} onStop={onStop} />
      ));

      const stopButton = getByTestId("stop-button");
      await fireEvent.click(stopButton);

      expect(onStop).toHaveBeenCalled();
    });

    it("should show processing indicator when isProcessing is true", () => {
      const { getByTestId } = render(() => (
        <CortexChatPanel state="home" isProcessing={true} />
      ));

      expect(getByTestId("processing-indicator")).toBeTruthy();
    });

    it("should not show processing indicator when isProcessing is false", () => {
      const { queryByTestId } = render(() => (
        <CortexChatPanel state="home" isProcessing={false} />
      ));

      expect(queryByTestId("processing-indicator")).toBeFalsy();
    });

    it("should pass placeholder text to prompt input", () => {
      const { getByTestId } = render(() => (
        <CortexChatPanel state="home" />
      ));

      const input = getByTestId("prompt-text-input");
      expect(input.getAttribute("placeholder")).toBe("Send a prompt or run a command...");
    });

    it("should pass input value to prompt input", () => {
      const { getByTestId } = render(() => (
        <CortexChatPanel state="home" inputValue="current value" />
      ));

      const input = getByTestId("prompt-text-input") as HTMLInputElement;
      expect(input.value).toBe("current value");
    });
  });

  describe("Model Selection", () => {
    it("should display model name", () => {
      const { getByTestId } = render(() => (
        <CortexChatPanel state="home" modelName="Claude 3.5 Sonnet" />
      ));

      expect(getByTestId("model-name").textContent).toBe("Claude 3.5 Sonnet");
    });

    it("should call onModelClick when model button is clicked", async () => {
      const onModelClick = vi.fn();

      const { getByTestId } = render(() => (
        <CortexChatPanel state="home" onModelClick={onModelClick} />
      ));

      await fireEvent.click(getByTestId("model-button"));

      expect(onModelClick).toHaveBeenCalled();
    });

    it("should display model name in minimized state", () => {
      const { getByTestId } = render(() => (
        <CortexChatPanel state="minimized" modelName="GPT-4o" />
      ));

      expect(getByTestId("model-name").textContent).toBe("GPT-4o");
    });

    it("should display model name in expanded state", () => {
      const { getByTestId } = render(() => (
        <CortexChatPanel state="expanded" modelName="Claude Opus" />
      ));

      expect(getByTestId("model-name").textContent).toBe("Claude Opus");
    });
  });

  describe("Action Buttons", () => {
    it("should call onPlusClick when plus button is clicked", async () => {
      const onPlusClick = vi.fn();

      const { getByTestId } = render(() => (
        <CortexChatPanel state="home" onPlusClick={onPlusClick} />
      ));

      await fireEvent.click(getByTestId("plus-button"));

      expect(onPlusClick).toHaveBeenCalled();
    });

    it("should call onUploadClick when upload button is clicked", async () => {
      const onUploadClick = vi.fn();

      const { getByTestId } = render(() => (
        <CortexChatPanel state="home" onUploadClick={onUploadClick} />
      ));

      await fireEvent.click(getByTestId("upload-button"));

      expect(onUploadClick).toHaveBeenCalled();
    });
  });

  describe("State Transitions", () => {
    it("should render different content for each state", () => {
      const { container: homeContainer } = render(() => (
        <CortexChatPanel state="home" />
      ));
      const homeH1 = homeContainer.querySelector("h1");
      expect(homeH1).toBeTruthy();
      cleanup();

      const { container: minContainer } = render(() => (
        <CortexChatPanel state="minimized" />
      ));
      const minH2 = minContainer.querySelector("h2");
      expect(minH2).toBeTruthy();
      cleanup();

      const { container: expContainer } = render(() => (
        <CortexChatPanel state="expanded" messages={[{ id: "1", type: "user", content: "test" }]} />
      ));
      expect(expContainer.textContent).toContain("test");
    });

    it("should default to home state when state is undefined", () => {
      const { container } = render(() => <CortexChatPanel />);
      const h1 = container.querySelector("h1");
      expect(h1).toBeTruthy();
      expect(container.textContent).toContain("What would you like to build");
    });
  });

  describe("Styling", () => {
    it("should apply custom class in home state", () => {
      const { container } = render(() => (
        <CortexChatPanel state="home" class="custom-class" />
      ));
      const panel = container.firstChild as HTMLElement;
      expect(panel?.className).toContain("custom-class");
    });

    it("should apply custom style in home state", () => {
      const { container } = render(() => (
        <CortexChatPanel state="home" style={{ "background-color": "purple" }} />
      ));
      const panel = container.firstChild as HTMLElement;
      expect(panel?.style.backgroundColor).toBe("purple");
    });

    it("should apply custom class in minimized state", () => {
      const { container } = render(() => (
        <CortexChatPanel state="minimized" class="mini-class" />
      ));
      const panel = container.firstChild as HTMLElement;
      expect(panel?.className).toContain("mini-class");
    });

    it("should apply custom style in minimized state", () => {
      const { container } = render(() => (
        <CortexChatPanel state="minimized" style={{ opacity: "0.5" }} />
      ));
      const panel = container.firstChild as HTMLElement;
      expect(panel?.style.opacity).toBe("0.5");
    });

    it("should apply custom class in expanded state", () => {
      const { container } = render(() => (
        <CortexChatPanel state="expanded" class="expanded-class" />
      ));
      const panel = container.firstChild as HTMLElement;
      expect(panel?.className).toContain("expanded-class");
    });

    it("should apply custom style in expanded state", () => {
      const { container } = render(() => (
        <CortexChatPanel state="expanded" style={{ "border-color": "blue" }} />
      ));
      const panel = container.firstChild as HTMLElement;
      expect(panel?.style.borderColor).toBe("blue");
    });

    it("should have full width and height in home state", () => {
      const { container } = render(() => (
        <CortexChatPanel state="home" />
      ));
      const panel = container.firstChild as HTMLElement;
      expect(panel?.style.width).toBe("100%");
      expect(panel?.style.height).toBe("100%");
    });

    it("should have 369px width in expanded state", () => {
      const { container } = render(() => (
        <CortexChatPanel state="expanded" />
      ));
      const panel = container.firstChild as HTMLElement;
      const style = panel?.getAttribute("style") || "";
      expect(style).toContain("width:");
    });
  });
});
