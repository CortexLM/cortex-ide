import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexChatPanel } from "../CortexChatPanel";
import type {
  ChatPanelState,
  ChatMessage,
  ChatAction,
  ChatProgress,
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
  });

  describe("Minimized State", () => {
    it("should render minimized state", () => {
      const { container } = render(() => <CortexChatPanel state="minimized" />);
      expect(container.textContent).toContain("What would you like to build");
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

  describe("Styling", () => {
    it("should apply custom class", () => {
      const { container } = render(() => (
        <CortexChatPanel state="home" class="custom-class" />
      ));
      const panel = container.firstChild as HTMLElement;
      expect(panel?.className).toContain("custom-class");
    });

    it("should apply custom style", () => {
      const { container } = render(() => (
        <CortexChatPanel state="home" style={{ "background-color": "purple" }} />
      ));
      const panel = container.firstChild as HTMLElement;
      expect(panel?.style.backgroundColor).toBe("purple");
    });
  });
});
