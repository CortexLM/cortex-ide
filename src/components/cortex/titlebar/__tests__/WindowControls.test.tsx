import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";

vi.mock("../platformDetect", () => ({
  detectPlatform: vi.fn().mockReturnValue("macos"),
}));

vi.mock("../../primitives", () => ({
  CortexTooltip: (props: { content: string; children: import("solid-js").JSX.Element }) => (
    <div data-tooltip={props.content}>{props.children}</div>
  ),
}));

import { detectPlatform } from "../platformDetect";
import { WindowControls } from "../WindowControls";

describe("WindowControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("macOS variant", () => {
    beforeEach(() => {
      vi.mocked(detectPlatform).mockReturnValue("macos");
    });

    it("should render Mac-style window controls when platform is macos", () => {
      const { container } = render(() => <WindowControls />);
      const closeBtn = container.querySelector('button[aria-label="Close"]');
      const minBtn = container.querySelector('button[aria-label="Minimize"]');
      const maxBtn = container.querySelector('button[aria-label="Maximize"]');
      expect(closeBtn).toBeTruthy();
      expect(minBtn).toBeTruthy();
      expect(maxBtn).toBeTruthy();
    });

    it("should render 3 circle buttons for macOS", () => {
      const { container } = render(() => <WindowControls />);
      const buttons = container.querySelectorAll("button");
      expect(buttons).toHaveLength(3);
      buttons.forEach((btn) => {
        expect(btn.style.borderRadius).toBe("var(--cortex-radius-full)");
        expect(btn.style.width).toBe("12px");
        expect(btn.style.height).toBe("12px");
      });
    });

    it("should call onClose when close button is clicked", async () => {
      const onClose = vi.fn();
      const { container } = render(() => <WindowControls onClose={onClose} />);
      const closeBtn = container.querySelector('button[aria-label="Close"]');
      await fireEvent.click(closeBtn!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should call onMinimize when minimize button is clicked", async () => {
      const onMinimize = vi.fn();
      const { container } = render(() => <WindowControls onMinimize={onMinimize} />);
      const minBtn = container.querySelector('button[aria-label="Minimize"]');
      await fireEvent.click(minBtn!);
      expect(onMinimize).toHaveBeenCalledTimes(1);
    });

    it("should call onMaximize when maximize button is clicked", async () => {
      const onMaximize = vi.fn();
      const { container } = render(() => <WindowControls onMaximize={onMaximize} />);
      const maxBtn = container.querySelector('button[aria-label="Maximize"]');
      await fireEvent.click(maxBtn!);
      expect(onMaximize).toHaveBeenCalledTimes(1);
    });

    it("should not render SVG icons (Mac uses colored circles)", () => {
      const { container } = render(() => <WindowControls />);
      const svgs = container.querySelectorAll("svg");
      expect(svgs).toHaveLength(0);
    });
  });

  describe("Windows variant", () => {
    beforeEach(() => {
      vi.mocked(detectPlatform).mockReturnValue("windows");
    });

    it("should render Windows-style window controls when platform is windows", () => {
      const { container } = render(() => <WindowControls />);
      const closeBtn = container.querySelector('button[aria-label="Close"]');
      const minBtn = container.querySelector('button[aria-label="Minimize"]');
      const maxBtn = container.querySelector('button[aria-label="Maximize"]');
      expect(closeBtn).toBeTruthy();
      expect(minBtn).toBeTruthy();
      expect(maxBtn).toBeTruthy();
    });

    it("should render 3 rectangular buttons for Windows", () => {
      const { container } = render(() => <WindowControls />);
      const buttons = container.querySelectorAll("button");
      expect(buttons).toHaveLength(3);
      buttons.forEach((btn) => {
        expect(btn.style.width).toBe("46px");
        expect(btn.style.height).toBe("32px");
      });
    });

    it("should render SVG icons for Windows controls", () => {
      const { container } = render(() => <WindowControls />);
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBe(3);
    });

    it("should call onClose when close button is clicked", async () => {
      const onClose = vi.fn();
      const { container } = render(() => <WindowControls onClose={onClose} />);
      const closeBtn = container.querySelector('button[aria-label="Close"]');
      await fireEvent.click(closeBtn!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should call onMinimize when minimize button is clicked", async () => {
      const onMinimize = vi.fn();
      const { container } = render(() => <WindowControls onMinimize={onMinimize} />);
      const minBtn = container.querySelector('button[aria-label="Minimize"]');
      await fireEvent.click(minBtn!);
      expect(onMinimize).toHaveBeenCalledTimes(1);
    });

    it("should call onMaximize when maximize button is clicked", async () => {
      const onMaximize = vi.fn();
      const { container } = render(() => <WindowControls onMaximize={onMaximize} />);
      const maxBtn = container.querySelector('button[aria-label="Maximize"]');
      await fireEvent.click(maxBtn!);
      expect(onMaximize).toHaveBeenCalledTimes(1);
    });
  });

  describe("Linux variant", () => {
    beforeEach(() => {
      vi.mocked(detectPlatform).mockReturnValue("linux");
    });

    it("should render Windows/Linux-style controls when platform is linux", () => {
      const { container } = render(() => <WindowControls />);
      const closeBtn = container.querySelector('button[aria-label="Close"]');
      const minBtn = container.querySelector('button[aria-label="Minimize"]');
      const maxBtn = container.querySelector('button[aria-label="Maximize"]');
      expect(closeBtn).toBeTruthy();
      expect(minBtn).toBeTruthy();
      expect(maxBtn).toBeTruthy();
    });

    it("should render rectangular buttons for Linux (same as Windows)", () => {
      const { container } = render(() => <WindowControls />);
      const buttons = container.querySelectorAll("button");
      expect(buttons).toHaveLength(3);
      buttons.forEach((btn) => {
        expect(btn.style.width).toBe("46px");
        expect(btn.style.height).toBe("32px");
      });
    });

    it("should render SVG icons for Linux controls", () => {
      const { container } = render(() => <WindowControls />);
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBe(3);
    });
  });

  describe("No callbacks provided", () => {
    it("should render without errors when no callbacks are provided", () => {
      vi.mocked(detectPlatform).mockReturnValue("macos");
      const { container } = render(() => <WindowControls />);
      expect(container.querySelectorAll("button")).toHaveLength(3);
    });

    it("should not throw when clicking buttons without callbacks", async () => {
      vi.mocked(detectPlatform).mockReturnValue("windows");
      const { container } = render(() => <WindowControls />);
      const buttons = container.querySelectorAll("button");
      for (const btn of buttons) {
        await fireEvent.click(btn);
      }
    });
  });
});
