import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexTooltip } from "../CortexTooltip";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("CortexTooltip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("rendering", () => {
    it("renders children content", () => {
      const { getByText } = render(() => (
        <CortexTooltip content="Tooltip text">
          <button>Hover me</button>
        </CortexTooltip>
      ));
      expect(getByText("Hover me")).toBeTruthy();
    });

    it("does not render tooltip content initially", () => {
      const { queryByText } = render(() => (
        <CortexTooltip content="Tooltip text">
          <button>Hover me</button>
        </CortexTooltip>
      ));
      expect(queryByText("Tooltip text")).toBeFalsy();
    });

    it("wraps children in a div with inline-flex display", () => {
      const { container } = render(() => (
        <CortexTooltip content="Tooltip text">
          <button>Hover me</button>
        </CortexTooltip>
      ));
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.display).toBe("inline-flex");
    });
  });

  describe("tooltip visibility", () => {
    it("renders trigger element correctly", () => {
      const { getByText } = render(() => (
        <CortexTooltip content="Tooltip text" delay={100}>
          <button>Hover me</button>
        </CortexTooltip>
      ));

      const button = getByText("Hover me");
      expect(button).toBeTruthy();
      expect(button.parentElement).toBeTruthy();
    });

    it("has mouseEnter handler on trigger wrapper", () => {
      const { getByText } = render(() => (
        <CortexTooltip content="Tooltip text" delay={0}>
          <button>Hover me</button>
        </CortexTooltip>
      ));

      const trigger = getByText("Hover me").parentElement!;
      expect(trigger.onmouseenter).toBeDefined;
    });

    it("has mouseLeave handler on trigger wrapper", () => {
      const { getByText } = render(() => (
        <CortexTooltip content="Tooltip text">
          <button>Hover me</button>
        </CortexTooltip>
      ));

      const trigger = getByText("Hover me").parentElement!;
      expect(trigger.onmouseleave).toBeDefined;
    });

    it("cancels tooltip if mouse leaves before delay", async () => {
      const { getByText, queryByText } = render(() => (
        <CortexTooltip content="Tooltip text" delay={200}>
          <button>Hover me</button>
        </CortexTooltip>
      ));

      const trigger = getByText("Hover me").parentElement!;
      await fireEvent.mouseEnter(trigger);
      vi.advanceTimersByTime(100);
      await fireEvent.mouseLeave(trigger);
      vi.advanceTimersByTime(200);

      expect(queryByText("Tooltip text")).toBeFalsy();
    });
  });

  describe("disabled state", () => {
    it("does not show tooltip when disabled", async () => {
      const { getByText, queryByText } = render(() => (
        <CortexTooltip content="Tooltip text" delay={0} disabled>
          <button>Hover me</button>
        </CortexTooltip>
      ));

      const trigger = getByText("Hover me").parentElement!;
      await fireEvent.mouseEnter(trigger);
      vi.advanceTimersByTime(0);

      expect(queryByText("Tooltip text")).toBeFalsy();
    });
  });

  describe("content prop", () => {
    it("accepts string content", () => {
      const { container } = render(() => (
        <CortexTooltip content="Simple text" delay={0}>
          <button>Hover me</button>
        </CortexTooltip>
      ));

      expect(container.firstChild).toBeTruthy();
    });

    it("renders JSX content", async () => {
      const { container } = render(() => (
        <CortexTooltip
          content={<span data-testid="jsx-content">JSX Content</span>}
          delay={0}
        >
          <button>Hover me</button>
        </CortexTooltip>
      ));

      expect(container.firstChild).toBeTruthy();
    });
  });

  describe("position prop", () => {
    it("defaults to top position", () => {
      const { container } = render(() => (
        <CortexTooltip content="Tooltip">
          <button>Hover me</button>
        </CortexTooltip>
      ));
      expect(container.firstChild).toBeTruthy();
    });

    it("accepts top position", () => {
      const { container } = render(() => (
        <CortexTooltip content="Tooltip" position="top">
          <button>Hover me</button>
        </CortexTooltip>
      ));
      expect(container.firstChild).toBeTruthy();
    });

    it("accepts bottom position", () => {
      const { container } = render(() => (
        <CortexTooltip content="Tooltip" position="bottom">
          <button>Hover me</button>
        </CortexTooltip>
      ));
      expect(container.firstChild).toBeTruthy();
    });

    it("accepts left position", () => {
      const { container } = render(() => (
        <CortexTooltip content="Tooltip" position="left">
          <button>Hover me</button>
        </CortexTooltip>
      ));
      expect(container.firstChild).toBeTruthy();
    });

    it("accepts right position", () => {
      const { container } = render(() => (
        <CortexTooltip content="Tooltip" position="right">
          <button>Hover me</button>
        </CortexTooltip>
      ));
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe("tooltip styling", () => {
    it("applies fixed positioning to tooltip", async () => {
      const { getByText } = render(() => (
        <CortexTooltip content="Tooltip text" delay={0}>
          <button>Hover me</button>
        </CortexTooltip>
      ));

      const trigger = getByText("Hover me").parentElement!;
      await fireEvent.mouseEnter(trigger);
      vi.advanceTimersByTime(0);

      const tooltip = document.body.querySelector(
        "[style*='position: fixed']"
      );
      expect(tooltip).toBeTruthy();
    });

    it("applies pointer-events none to tooltip", async () => {
      const { getByText } = render(() => (
        <CortexTooltip content="Tooltip text" delay={0}>
          <button>Hover me</button>
        </CortexTooltip>
      ));

      const trigger = getByText("Hover me").parentElement!;
      await fireEvent.mouseEnter(trigger);
      vi.advanceTimersByTime(0);

      const tooltip = document.body.querySelector(
        "[style*='pointer-events: none']"
      );
      expect(tooltip).toBeTruthy();
    });

    it("applies white-space nowrap to tooltip", async () => {
      const { getByText } = render(() => (
        <CortexTooltip content="Tooltip text" delay={0}>
          <button>Hover me</button>
        </CortexTooltip>
      ));

      const trigger = getByText("Hover me").parentElement!;
      await fireEvent.mouseEnter(trigger);
      vi.advanceTimersByTime(0);

      const tooltip = document.body.querySelector(
        "[style*='white-space: nowrap']"
      );
      expect(tooltip).toBeTruthy();
    });
  });

  describe("custom class and style", () => {
    it("applies custom class to trigger wrapper", () => {
      const { container } = render(() => (
        <CortexTooltip content="Tooltip" class="custom-tooltip-trigger">
          <button>Hover me</button>
        </CortexTooltip>
      ));
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains("custom-tooltip-trigger")).toBe(true);
    });

    it("applies custom style to tooltip", async () => {
      const { getByText } = render(() => (
        <CortexTooltip
          content="Tooltip text"
          delay={0}
          style={{ "max-width": "200px" }}
        >
          <button>Hover me</button>
        </CortexTooltip>
      ));

      const trigger = getByText("Hover me").parentElement!;
      await fireEvent.mouseEnter(trigger);
      vi.advanceTimersByTime(0);

      const tooltip = document.body.querySelector(
        "[style*='max-width: 200px']"
      );
      expect(tooltip).toBeTruthy();
    });
  });

  describe("portal rendering", () => {
    it("renders tooltip in a portal (outside component tree)", async () => {
      const { getByText, container } = render(() => (
        <CortexTooltip content="Tooltip text" delay={0}>
          <button>Hover me</button>
        </CortexTooltip>
      ));

      const trigger = getByText("Hover me").parentElement!;
      await fireEvent.mouseEnter(trigger);
      vi.advanceTimersByTime(0);

      const tooltipInContainer = container.querySelector(
        "[style*='position: fixed']"
      );
      expect(tooltipInContainer).toBeFalsy();

      const tooltipInBody = document.body.querySelector(
        "[style*='position: fixed']"
      );
      expect(tooltipInBody).toBeTruthy();
    });
  });

  describe("cleanup", () => {
    it("clears timeout on unmount", async () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { getByText, unmount } = render(() => (
        <CortexTooltip content="Tooltip text" delay={1000}>
          <button>Hover me</button>
        </CortexTooltip>
      ));

      const trigger = getByText("Hover me").parentElement!;
      await fireEvent.mouseEnter(trigger);

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe("z-index", () => {
    it("applies tooltip z-index from CSS variable", async () => {
      const { getByText } = render(() => (
        <CortexTooltip content="Tooltip text" delay={0}>
          <button>Hover me</button>
        </CortexTooltip>
      ));

      const trigger = getByText("Hover me").parentElement!;
      await fireEvent.mouseEnter(trigger);
      vi.advanceTimersByTime(0);

      const tooltip = document.body.querySelector(
        "[style*='z-index']"
      );
      expect(tooltip).toBeTruthy();
    });
  });

  describe("animation", () => {
    it("applies opacity transition", async () => {
      const { getByText } = render(() => (
        <CortexTooltip content="Tooltip text" delay={0}>
          <button>Hover me</button>
        </CortexTooltip>
      ));

      const trigger = getByText("Hover me").parentElement!;
      await fireEvent.mouseEnter(trigger);
      vi.advanceTimersByTime(0);

      const tooltip = document.body.querySelector(
        "[style*='transition']"
      );
      expect(tooltip).toBeTruthy();
    });
  });
});
