import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexTokenLimitDisplay } from "../CortexTokenLimitDisplay";
import type { CortexTokenLimitDisplayProps } from "../CortexTokenLimitDisplay";

vi.mock("../primitives/CortexIcon", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-color={props.color} data-size={props.size} />
  ),
}));

vi.mock("@/context/SDKContext", () => ({
  useSDK: () => ({
    state: {
      messages: [
        { metadata: { inputTokens: 500, outputTokens: 200 } },
        { metadata: { inputTokens: 300, outputTokens: 100 } },
        { metadata: null },
      ],
    },
  }),
}));

describe("CortexTokenLimitDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("Interfaces", () => {
    it("should have correct CortexTokenLimitDisplayProps interface structure", () => {
      const props: CortexTokenLimitDisplayProps = {
        modelName: "claude-sonnet-4",
        contextWindow: 200000,
        inputCostPer1K: 0.003,
        outputCostPer1K: 0.015,
        class: "custom-class",
        style: { width: "200px" },
      };

      expect(props.modelName).toBe("claude-sonnet-4");
      expect(props.contextWindow).toBe(200000);
      expect(props.inputCostPer1K).toBe(0.003);
      expect(props.outputCostPer1K).toBe(0.015);
    });

    it("should accept empty props", () => {
      const props: CortexTokenLimitDisplayProps = {};
      expect(props).toBeDefined();
    });
  });

  describe("Rendering", () => {
    it("should render trigger button with Token Limit text", () => {
      const { container } = render(() => <CortexTokenLimitDisplay />);
      expect(container.textContent).toContain("Token Limit");
    });

    it("should render gauge icon", () => {
      const { container } = render(() => <CortexTokenLimitDisplay />);
      const gaugeIcon = container.querySelector('[data-testid="icon-gauge"]');
      expect(gaugeIcon).toBeTruthy();
    });

    it("should display percentage", () => {
      const { container } = render(() => <CortexTokenLimitDisplay />);
      expect(container.textContent).toMatch(/\d+%/);
    });

    it("should render as inline-flex container", () => {
      const { container } = render(() => <CortexTokenLimitDisplay />);
      const root = container.firstElementChild as HTMLElement;
      expect(root?.style.display).toBe("inline-flex");
      expect(root?.style.position).toBe("relative");
    });

    it("should not show dropdown by default", () => {
      const { container } = render(() => <CortexTokenLimitDisplay />);
      expect(container.textContent).not.toContain("Token Usage");
      expect(container.textContent).not.toContain("Input Tokens:");
    });
  });

  describe("Dropdown Toggle", () => {
    it("should open dropdown when trigger is clicked", async () => {
      const { container } = render(() => <CortexTokenLimitDisplay />);
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);

      expect(container.textContent).toContain("Token Usage");
      expect(container.textContent).toContain("Input Tokens:");
      expect(container.textContent).toContain("Output Tokens:");
      expect(container.textContent).toContain("Total Tokens:");
    });

    it("should close dropdown when trigger is clicked again", async () => {
      const { container } = render(() => <CortexTokenLimitDisplay />);
      const button = container.querySelector("button") as HTMLButtonElement;

      await fireEvent.click(button);
      expect(container.textContent).toContain("Token Usage");

      await fireEvent.click(button);
      expect(container.textContent).not.toContain("Token Usage");
    });

    it("should close dropdown on outside click", async () => {
      const { container } = render(() => <CortexTokenLimitDisplay />);
      const button = container.querySelector("button") as HTMLButtonElement;

      await fireEvent.click(button);
      expect(container.textContent).toContain("Token Usage");

      await fireEvent.mouseDown(document.body);
      expect(container.textContent).not.toContain("Token Usage");
    });
  });

  describe("Token Data Display", () => {
    it("should show input tokens from SDK messages", async () => {
      const { container } = render(() => <CortexTokenLimitDisplay />);
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);

      expect(container.textContent).toContain("800");
    });

    it("should show output tokens from SDK messages", async () => {
      const { container } = render(() => <CortexTokenLimitDisplay />);
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);

      expect(container.textContent).toContain("300");
    });

    it("should show total tokens from SDK messages", async () => {
      const { container } = render(() => <CortexTokenLimitDisplay />);
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);

      expect(container.textContent).toContain((1100).toLocaleString());
    });

    it("should show progress bar in dropdown", async () => {
      const { container } = render(() => <CortexTokenLimitDisplay />);
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);

      const progressBars = container.querySelectorAll("div");
      const hasProgressBar = Array.from(progressBars).some(
        (el) => el.style.borderRadius === "3px" && el.style.overflow === "hidden"
      );
      expect(hasProgressBar).toBe(true);
    });
  });

  describe("Cost Section", () => {
    it("should show cost section in dropdown", async () => {
      const { container } = render(() => <CortexTokenLimitDisplay />);
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);

      expect(container.textContent).toContain("Cost");
      expect(container.textContent).toContain("Input cost / 1K tokens");
      expect(container.textContent).toContain("Output cost / 1K tokens");
    });

    it("should use custom pricing when provided", async () => {
      const { container } = render(() => (
        <CortexTokenLimitDisplay inputCostPer1K={0.01} outputCostPer1K={0.03} />
      ));
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);

      expect(container.textContent).toContain("$ 0.010");
      expect(container.textContent).toContain("$ 0.030");
    });

    it("should use model pricing when modelName is provided", async () => {
      const { container } = render(() => (
        <CortexTokenLimitDisplay modelName="gpt-4o" />
      ));
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);

      expect(container.textContent).toContain("$ 0.005");
      expect(container.textContent).toContain("$ 0.015");
    });
  });

  describe("Context Window", () => {
    it("should use custom contextWindow when provided", async () => {
      const { container } = render(() => (
        <CortexTokenLimitDisplay contextWindow={1000} />
      ));
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);
      expect(container.textContent).toContain("1.1K / 1.0K");
    });

    it("should use model context window from modelName", async () => {
      const { container } = render(() => (
        <CortexTokenLimitDisplay modelName="gpt-4" />
      ));
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);

      expect(container.textContent).toContain("8.2K");
    });

    it("should default to 200K context window for unknown models", async () => {
      const { container } = render(() => (
        <CortexTokenLimitDisplay modelName="unknown-model" />
      ));
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);
      expect(container.textContent).toContain("200.0K");
    });
  });

  describe("Color Thresholds", () => {
    it("should use normal color when percentage is below 80%", () => {
      const { container } = render(() => (
        <CortexTokenLimitDisplay contextWindow={200000} />
      ));
      const gaugeIcon = container.querySelector('[data-testid="icon-gauge"]');
      expect(gaugeIcon?.getAttribute("data-color")).toBe("var(--cortex-success)");
    });

    it("should use warning color when percentage is between 80% and 95%", () => {
      const { container } = render(() => (
        <CortexTokenLimitDisplay contextWindow={1300} />
      ));
      const gaugeIcon = container.querySelector('[data-testid="icon-gauge"]');
      expect(gaugeIcon?.getAttribute("data-color")).toBe("var(--cortex-warning)");
    });

    it("should use critical color when percentage is 95% or above", () => {
      const { container } = render(() => (
        <CortexTokenLimitDisplay contextWindow={1100} />
      ));
      const gaugeIcon = container.querySelector('[data-testid="icon-gauge"]');
      expect(gaugeIcon?.getAttribute("data-color")).toBe("var(--cortex-error)");
    });
  });

  describe("Warning Messages", () => {
    it("should show approaching warning when percentage >= 80%", async () => {
      const { container } = render(() => (
        <CortexTokenLimitDisplay contextWindow={1300} />
      ));
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);

      expect(container.textContent).toContain("Approaching token limit.");
    });

    it("should show critical warning when percentage >= 95%", async () => {
      const { container } = render(() => (
        <CortexTokenLimitDisplay contextWindow={1100} />
      ));
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);

      expect(container.textContent).toContain("Token limit nearly reached.");
    });

    it("should show warning icon in warning section", async () => {
      const { container } = render(() => (
        <CortexTokenLimitDisplay contextWindow={1300} />
      ));
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);

      const warningIcon = container.querySelector('[data-testid="icon-warning"]');
      expect(warningIcon).toBeTruthy();
    });

    it("should not show warning when percentage is below 80%", async () => {
      const { container } = render(() => (
        <CortexTokenLimitDisplay contextWindow={200000} />
      ));
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);

      expect(container.textContent).not.toContain("Approaching token limit.");
      expect(container.textContent).not.toContain("Token limit nearly reached.");
    });
  });

  describe("Model Info", () => {
    it("should show model name in footer when provided", async () => {
      const { container } = render(() => (
        <CortexTokenLimitDisplay modelName="claude-sonnet-4" />
      ));
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);

      expect(container.textContent).toContain("Model: claude-sonnet-4");
      expect(container.textContent).toContain("200.0K context");
    });

    it("should not show model info when modelName is not provided", async () => {
      const { container } = render(() => <CortexTokenLimitDisplay />);
      const button = container.querySelector("button") as HTMLButtonElement;
      await fireEvent.click(button);

      expect(container.textContent).not.toContain("Model:");
    });
  });

  describe("Styling", () => {
    it("should apply custom class", () => {
      const { container } = render(() => (
        <CortexTokenLimitDisplay class="my-class" />
      ));
      const root = container.firstElementChild as HTMLElement;
      expect(root?.className).toContain("my-class");
    });

    it("should apply custom style", () => {
      const { container } = render(() => (
        <CortexTokenLimitDisplay style={{ "margin-top": "10px" }} />
      ));
      const root = container.firstElementChild as HTMLElement;
      expect(root?.style.marginTop).toBe("10px");
    });
  });
});
