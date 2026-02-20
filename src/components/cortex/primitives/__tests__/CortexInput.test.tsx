import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexInput, CortexPromptInput } from "../CortexInput";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("../CortexIcon", () => ({
  CortexIcon: (props: { name: string; size: number; color?: string; onClick?: () => void }) => (
    <span
      data-testid="cortex-icon"
      data-name={props.name}
      data-size={props.size}
      onClick={props.onClick}
    />
  ),
}));

describe("CortexInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders with default props", () => {
      const { container } = render(() => <CortexInput />);
      const input = container.querySelector("input");
      expect(input).toBeTruthy();
    });

    it("renders with placeholder", () => {
      const { container } = render(() => <CortexInput placeholder="Enter text..." />);
      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.placeholder).toBe("Enter text...");
    });

    it("renders with value", () => {
      const { container } = render(() => <CortexInput value="test value" />);
      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.value).toBe("test value");
    });
  });

  describe("sizes", () => {
    it("renders sm size with correct height", () => {
      const { container } = render(() => <CortexInput size="sm" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.height).toBe("32px");
    });

    it("renders md size with correct height (default)", () => {
      const { container } = render(() => <CortexInput />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.height).toBe("40px");
    });

    it("renders lg size with correct height", () => {
      const { container } = render(() => <CortexInput size="lg" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.height).toBe("48px");
    });
  });

  describe("input types", () => {
    it("defaults to text type", () => {
      const { container } = render(() => <CortexInput />);
      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.type).toBe("text");
    });

    it("renders password type", () => {
      const { container } = render(() => <CortexInput type="password" />);
      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.type).toBe("password");
    });

    it("renders email type", () => {
      const { container } = render(() => <CortexInput type="email" />);
      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.type).toBe("email");
    });

    it("renders search type", () => {
      const { container } = render(() => <CortexInput type="search" />);
      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.type).toBe("search");
    });
  });

  describe("disabled state", () => {
    it("applies disabled attribute", () => {
      const { container } = render(() => <CortexInput disabled />);
      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it("applies reduced opacity when disabled", () => {
      const { container } = render(() => <CortexInput disabled />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.opacity).toBe("0.5");
    });
  });

  describe("error state", () => {
    it("applies error border style", () => {
      const { container } = render(() => <CortexInput error />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.border).toContain("cortex-input-border-error");
    });
  });

  describe("onChange handler", () => {
    it("calls onChange when input value changes", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => <CortexInput onChange={handleChange} />);
      const input = container.querySelector("input") as HTMLInputElement;
      await fireEvent.input(input, { target: { value: "new value" } });
      expect(handleChange).toHaveBeenCalledWith("new value");
    });
  });

  describe("onSubmit handler", () => {
    it("calls onSubmit when Enter is pressed", async () => {
      const handleSubmit = vi.fn();
      const { container } = render(() => (
        <CortexInput value="test" onSubmit={handleSubmit} />
      ));
      const input = container.querySelector("input") as HTMLInputElement;
      await fireEvent.keyDown(input, { key: "Enter" });
      expect(handleSubmit).toHaveBeenCalledWith("test");
    });

    it("does not call onSubmit on Shift+Enter", async () => {
      const handleSubmit = vi.fn();
      const { container } = render(() => (
        <CortexInput value="test" onSubmit={handleSubmit} />
      ));
      const input = container.querySelector("input") as HTMLInputElement;
      await fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  describe("focus handlers", () => {
    it("calls onFocus when input is focused", async () => {
      const handleFocus = vi.fn();
      const { container } = render(() => <CortexInput onFocus={handleFocus} />);
      const input = container.querySelector("input") as HTMLInputElement;
      await fireEvent.focus(input);
      expect(handleFocus).toHaveBeenCalled();
    });

    it("calls onBlur when input loses focus", async () => {
      const handleBlur = vi.fn();
      const { container } = render(() => <CortexInput onBlur={handleBlur} />);
      const input = container.querySelector("input") as HTMLInputElement;
      await fireEvent.blur(input);
      expect(handleBlur).toHaveBeenCalled();
    });

    it("applies focus border style when focused", async () => {
      const { container } = render(() => <CortexInput />);
      const input = container.querySelector("input") as HTMLInputElement;
      await fireEvent.focus(input);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.border).toContain("cortex-input-border-focus");
    });
  });

  describe("icons", () => {
    it("renders left icon", () => {
      const { container } = render(() => <CortexInput leftIcon="search" />);
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute("data-name")).toBe("search");
    });

    it("renders right icon", () => {
      const { container } = render(() => <CortexInput rightIcon="x-close" />);
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute("data-name")).toBe("x-close");
    });

    it("calls onRightIconClick when right icon is clicked", async () => {
      const handleClick = vi.fn();
      const { container } = render(() => (
        <CortexInput rightIcon="x-close" onRightIconClick={handleClick} />
      ));
      const icon = container.querySelector("[data-testid='cortex-icon']");
      await fireEvent.click(icon!);
      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe("multiline", () => {
    it("renders textarea when multiline is true", () => {
      const { container } = render(() => <CortexInput multiline />);
      const textarea = container.querySelector("textarea");
      expect(textarea).toBeTruthy();
    });

    it("does not render input when multiline is true", () => {
      const { container } = render(() => <CortexInput multiline />);
      const input = container.querySelector("input");
      expect(input).toBeFalsy();
    });

    it("applies default rows to textarea", () => {
      const { container } = render(() => <CortexInput multiline />);
      const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
      expect(textarea.rows).toBe(3);
    });

    it("applies custom rows to textarea", () => {
      const { container } = render(() => <CortexInput multiline rows={5} />);
      const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
      expect(textarea.rows).toBe(5);
    });

    it("does not submit on Enter in multiline mode", async () => {
      const handleSubmit = vi.fn();
      const { container } = render(() => (
        <CortexInput multiline value="test" onSubmit={handleSubmit} />
      ));
      const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
      await fireEvent.keyDown(textarea, { key: "Enter" });
      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  describe("autoFocus", () => {
    it("applies autofocus attribute", () => {
      const { container } = render(() => <CortexInput autoFocus />);
      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.hasAttribute("autofocus")).toBe(true);
    });
  });

  describe("custom class and style", () => {
    it("applies custom class to container", () => {
      const { container } = render(() => <CortexInput class="custom-class" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains("custom-class")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { container } = render(() => (
        <CortexInput style={{ "margin-top": "10px" }} />
      ));
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.marginTop).toBe("10px");
    });
  });
});

describe("CortexPromptInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders with default props", () => {
      const { container } = render(() => <CortexPromptInput />);
      const input = container.querySelector("input");
      expect(input).toBeTruthy();
    });

    it("renders with default placeholder", () => {
      const { container } = render(() => <CortexPromptInput />);
      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.placeholder).toBe("Send a prompt or run a command...");
    });

    it("renders with custom placeholder", () => {
      const { container } = render(() => (
        <CortexPromptInput placeholder="Ask a question..." />
      ));
      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.placeholder).toBe("Ask a question...");
    });
  });

  describe("model selector", () => {
    it("renders default model name", () => {
      const { getByText } = render(() => <CortexPromptInput />);
      expect(getByText("Claude 3.5 Sonnet")).toBeTruthy();
    });

    it("renders custom model name", () => {
      const { getByText } = render(() => (
        <CortexPromptInput modelName="GPT-4" />
      ));
      expect(getByText("GPT-4")).toBeTruthy();
    });

    it("calls onModelClick when model selector is clicked", async () => {
      const handleModelClick = vi.fn();
      const { getByText } = render(() => (
        <CortexPromptInput onModelClick={handleModelClick} />
      ));
      const modelButton = getByText("Claude 3.5 Sonnet").closest("button");
      await fireEvent.click(modelButton!);
      expect(handleModelClick).toHaveBeenCalled();
    });
  });

  describe("action buttons", () => {
    it("calls onPlusClick when plus button is clicked", async () => {
      const handlePlusClick = vi.fn();
      const { container } = render(() => (
        <CortexPromptInput onPlusClick={handlePlusClick} />
      ));
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const plusIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "plus"
      );
      const button = plusIcon?.closest("button");
      await fireEvent.click(button!);
      expect(handlePlusClick).toHaveBeenCalled();
    });

    it("calls onUploadClick when upload button is clicked", async () => {
      const handleUploadClick = vi.fn();
      const { container } = render(() => (
        <CortexPromptInput onUploadClick={handleUploadClick} />
      ));
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const uploadIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "upload"
      );
      const button = uploadIcon?.closest("button");
      await fireEvent.click(button!);
      expect(handleUploadClick).toHaveBeenCalled();
    });
  });

  describe("submit behavior", () => {
    it("calls onSubmit when send button is clicked", async () => {
      const handleSubmit = vi.fn();
      const { container } = render(() => (
        <CortexPromptInput value="test message" onSubmit={handleSubmit} />
      ));
      const sendButton = container.querySelector("button[style*='32px']");
      await fireEvent.click(sendButton!);
      expect(handleSubmit).toHaveBeenCalledWith("test message");
    });

    it("calls onSubmit when Enter is pressed", async () => {
      const handleSubmit = vi.fn();
      const { container } = render(() => (
        <CortexPromptInput value="test message" onSubmit={handleSubmit} />
      ));
      const input = container.querySelector("input") as HTMLInputElement;
      await fireEvent.keyDown(input, { key: "Enter" });
      expect(handleSubmit).toHaveBeenCalledWith("test message");
    });
  });

  describe("processing state", () => {
    it("calls onStop when send button is clicked while processing", async () => {
      const handleStop = vi.fn();
      const { container } = render(() => (
        <CortexPromptInput isProcessing onStop={handleStop} />
      ));
      const sendButton = container.querySelector("button[style*='32px']");
      await fireEvent.click(sendButton!);
      expect(handleStop).toHaveBeenCalled();
    });

    it("applies error background to send button when processing", () => {
      const { container } = render(() => <CortexPromptInput isProcessing />);
      const sendButton = container.querySelector("button[style*='32px']") as HTMLElement;
      expect(sendButton.style.background).toContain("cortex-error");
    });
  });

  describe("onChange handler", () => {
    it("calls onChange when input value changes", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexPromptInput onChange={handleChange} />
      ));
      const input = container.querySelector("input") as HTMLInputElement;
      await fireEvent.input(input, { target: { value: "new message" } });
      expect(handleChange).toHaveBeenCalledWith("new message");
    });
  });
});
