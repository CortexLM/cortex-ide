import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { Toggle } from "../Toggle";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("../../cortex/primitives/CortexToggle", () => ({
  CortexToggle: (props: any) => {
    return (
      <button
        role="switch"
        aria-checked={props.checked ?? false}
        aria-disabled={props.disabled}
        data-size={props.size}
        onClick={() => !props.disabled && props.onChange?.(!props.checked)}
      >
        toggle
      </button>
    );
  },
}));

describe("Toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the toggle switch", () => {
      const { getByRole } = render(() => <Toggle />);
      expect(getByRole("switch")).toBeTruthy();
    });

    it("renders with label text", () => {
      const { getByText } = render(() => <Toggle label="Dark mode" />);
      expect(getByText("Dark mode")).toBeTruthy();
    });

    it("renders with description text", () => {
      const { getByText } = render(() => (
        <Toggle label="Dark mode" description="Toggle dark theme" />
      ));
      expect(getByText("Toggle dark theme")).toBeTruthy();
    });

    it("renders without label or description", () => {
      const { getByRole } = render(() => <Toggle />);
      expect(getByRole("switch")).toBeTruthy();
    });
  });

  describe("checked state", () => {
    it("passes checked=false to inner toggle", () => {
      const { getByRole } = render(() => <Toggle checked={false} />);
      expect(getByRole("switch").getAttribute("aria-checked")).toBe("false");
    });

    it("passes checked=true to inner toggle", () => {
      const { getByRole } = render(() => <Toggle checked={true} />);
      expect(getByRole("switch").getAttribute("aria-checked")).toBe("true");
    });
  });

  describe("onChange handler", () => {
    it("calls onChange when toggle is clicked", async () => {
      const handleChange = vi.fn();
      const { getByRole } = render(() => (
        <Toggle checked={false} onChange={handleChange} />
      ));
      await fireEvent.click(getByRole("switch"));
      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it("calls onChange with false when checked toggle is clicked", async () => {
      const handleChange = vi.fn();
      const { getByRole } = render(() => (
        <Toggle checked={true} onChange={handleChange} />
      ));
      await fireEvent.click(getByRole("switch"));
      expect(handleChange).toHaveBeenCalledWith(false);
    });
  });

  describe("disabled state", () => {
    it("passes disabled to inner toggle", () => {
      const { getByRole } = render(() => <Toggle disabled />);
      expect(getByRole("switch").getAttribute("aria-disabled")).toBe("true");
    });

    it("does not call onChange when disabled", async () => {
      const handleChange = vi.fn();
      const { getByRole } = render(() => (
        <Toggle disabled onChange={handleChange} />
      ));
      await fireEvent.click(getByRole("switch"));
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe("size", () => {
    it("defaults to md size", () => {
      const { getByRole } = render(() => <Toggle />);
      expect(getByRole("switch").getAttribute("data-size")).toBe("md");
    });

    it("passes sm size to inner toggle", () => {
      const { getByRole } = render(() => <Toggle size="sm" />);
      expect(getByRole("switch").getAttribute("data-size")).toBe("sm");
    });
  });

  describe("layout", () => {
    it("uses flex layout with gap", () => {
      const { container } = render(() => <Toggle label="Label" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.display).toBe("flex");
      expect(wrapper.style.alignItems).toBe("center");
      expect(wrapper.style.gap).toBe("10px");
    });
  });

  describe("custom styles", () => {
    it("merges custom style prop", () => {
      const { container } = render(() => (
        <Toggle style={{ "margin-top": "12px" }} />
      ));
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.marginTop).toBe("12px");
    });
  });
});
