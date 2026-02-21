import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@solidjs/testing-library";
import { ProgressBar } from "../ProgressBar";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

function getTrackAndFill(container: HTMLElement) {
  const allDivs = container.querySelectorAll("div");
  const track = allDivs[1] as HTMLElement;
  const fill = allDivs[2] as HTMLElement;
  return { track, fill };
}

describe("ProgressBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the progress bar container", () => {
      const { container } = render(() => <ProgressBar value={50} />);
      const divs = container.querySelectorAll("div");
      expect(divs.length).toBeGreaterThan(0);
    });

    it("renders track and fill elements", () => {
      const { container } = render(() => <ProgressBar value={50} />);
      const divs = container.querySelectorAll("div");
      expect(divs.length).toBeGreaterThanOrEqual(3);
    });

    it("is visible by default", () => {
      const { container } = render(() => <ProgressBar value={50} />);
      const wrapper = container.querySelector("div") as HTMLElement;
      expect(wrapper).toBeTruthy();
    });
  });

  describe("fill percentage", () => {
    it("shows 0% fill for value 0", () => {
      const { container } = render(() => <ProgressBar value={0} />);
      const { fill } = getTrackAndFill(container);
      expect(fill.style.width).toBe("0%");
    });

    it("shows 50% fill for value 50", () => {
      const { container } = render(() => <ProgressBar value={50} />);
      const { fill } = getTrackAndFill(container);
      expect(fill.style.width).toBe("50%");
    });

    it("shows 100% fill for value 100", () => {
      const { container } = render(() => <ProgressBar value={100} />);
      const { fill } = getTrackAndFill(container);
      expect(fill.style.width).toBe("100%");
    });

    it("clamps fill at 100% for values over max", () => {
      const { container } = render(() => <ProgressBar value={150} />);
      const { fill } = getTrackAndFill(container);
      expect(fill.style.width).toBe("100%");
    });

    it("clamps fill at 0% for negative values", () => {
      const { container } = render(() => <ProgressBar value={-10} />);
      const { fill } = getTrackAndFill(container);
      expect(fill.style.width).toBe("0%");
    });

    it("calculates percentage based on custom max", () => {
      const { container } = render(() => <ProgressBar value={25} max={50} />);
      const { fill } = getTrackAndFill(container);
      expect(fill.style.width).toBe("50%");
    });
  });

  describe("label", () => {
    it("shows percentage label when showLabel is true", () => {
      const { getByText } = render(() => (
        <ProgressBar value={75} showLabel />
      ));
      expect(getByText("75%")).toBeTruthy();
    });

    it("does not show label by default", () => {
      const { container } = render(() => <ProgressBar value={75} />);
      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(0);
    });

    it("does not show label in infinite mode", () => {
      const { container } = render(() => (
        <ProgressBar value={50} showLabel mode="infinite" />
      ));
      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(0);
    });
  });

  describe("variants", () => {
    it("applies default variant color", () => {
      const { container } = render(() => <ProgressBar value={50} variant="default" />);
      const { fill } = getTrackAndFill(container);
      expect(fill.style.background).toContain("jb-text-muted-color");
    });

    it("applies primary variant color", () => {
      const { container } = render(() => <ProgressBar value={50} variant="primary" />);
      const { fill } = getTrackAndFill(container);
      expect(fill.style.background).toContain("jb-border-focus");
    });

    it("applies success variant color", () => {
      const { container } = render(() => <ProgressBar value={50} variant="success" />);
      const { fill } = getTrackAndFill(container);
      expect(fill.style.background).toContain("cortex-success");
    });

    it("applies error variant color", () => {
      const { container } = render(() => <ProgressBar value={50} variant="error" />);
      const { fill } = getTrackAndFill(container);
      expect(fill.style.background).toContain("cortex-error");
    });
  });

  describe("sizes", () => {
    it("applies sm size height (default)", () => {
      const { container } = render(() => <ProgressBar value={50} />);
      const { track } = getTrackAndFill(container);
      expect(track.style.height).toBe("4px");
    });

    it("applies md size height", () => {
      const { container } = render(() => <ProgressBar value={50} size="md" />);
      const { track } = getTrackAndFill(container);
      expect(track.style.height).toBe("6px");
    });
  });

  describe("modes", () => {
    it("uses discrete mode by default", () => {
      const { container } = render(() => <ProgressBar value={50} />);
      const { fill } = getTrackAndFill(container);
      expect(fill.style.width).toBe("50%");
      expect(fill.style.animation).toBeFalsy();
    });

    it("uses animation in infinite mode", () => {
      const { container } = render(() => <ProgressBar value={50} mode="infinite" />);
      const { fill } = getTrackAndFill(container);
      expect(fill.style.animation).toContain("progress-infinite");
      expect(fill.style.width).toBe("30%");
    });
  });

  describe("visibility", () => {
    it("hides when visible is false", () => {
      const { container } = render(() => <ProgressBar value={50} visible={false} />);
      const divs = container.querySelectorAll("div");
      expect(divs.length).toBe(0);
    });

    it("shows when visible is true", () => {
      const { container } = render(() => <ProgressBar value={50} visible={true} />);
      const divs = container.querySelectorAll("div");
      expect(divs.length).toBeGreaterThan(0);
    });
  });

  describe("custom styles", () => {
    it("merges custom style prop", () => {
      const { container } = render(() => (
        <ProgressBar value={50} style={{ "margin-top": "12px" }} />
      ));
      const wrapper = container.querySelector("div") as HTMLElement;
      expect(wrapper.style.marginTop).toBe("12px");
    });
  });
});
