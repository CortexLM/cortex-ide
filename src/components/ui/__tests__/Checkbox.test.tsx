import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { Checkbox } from "../Checkbox";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("Checkbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders with role checkbox", () => {
      const { getByRole } = render(() => <Checkbox />);
      expect(getByRole("checkbox")).toBeTruthy();
    });

    it("renders label text when provided", () => {
      const { getByText } = render(() => <Checkbox label="Accept terms" />);
      expect(getByText("Accept terms")).toBeTruthy();
    });

    it("renders description text when provided", () => {
      const { getByText } = render(() => (
        <Checkbox label="Option" description="A detailed description" />
      ));
      expect(getByText("A detailed description")).toBeTruthy();
    });

    it("renders without label or description", () => {
      const { getByRole } = render(() => <Checkbox />);
      expect(getByRole("checkbox")).toBeTruthy();
    });
  });

  describe("checked state", () => {
    it("sets aria-checked to false when unchecked", () => {
      const { getByRole } = render(() => <Checkbox checked={false} />);
      expect(getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
    });

    it("sets aria-checked to true when checked", () => {
      const { getByRole } = render(() => <Checkbox checked={true} />);
      expect(getByRole("checkbox").getAttribute("aria-checked")).toBe("true");
    });

    it("sets aria-checked to mixed when indeterminate", () => {
      const { getByRole } = render(() => <Checkbox indeterminate={true} />);
      expect(getByRole("checkbox").getAttribute("aria-checked")).toBe("mixed");
    });

    it("renders checkmark SVG when checked", () => {
      const { container } = render(() => <Checkbox checked={true} />);
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBe(1);
    });

    it("renders dash SVG when indeterminate", () => {
      const { container } = render(() => <Checkbox indeterminate={true} />);
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBe(1);
    });

    it("renders no SVG when unchecked and not indeterminate", () => {
      const { container } = render(() => <Checkbox checked={false} />);
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBe(0);
    });
  });

  describe("onChange handler", () => {
    it("calls onChange with true when clicking unchecked checkbox", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <Checkbox checked={false} onChange={handleChange} />
      ));
      await fireEvent.click(container.firstChild as HTMLElement);
      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it("calls onChange with false when clicking checked checkbox", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <Checkbox checked={true} onChange={handleChange} />
      ));
      await fireEvent.click(container.firstChild as HTMLElement);
      expect(handleChange).toHaveBeenCalledWith(false);
    });

    it("calls onChange on Space key", async () => {
      const handleChange = vi.fn();
      const { getByRole } = render(() => (
        <Checkbox checked={false} onChange={handleChange} />
      ));
      await fireEvent.keyDown(getByRole("checkbox"), { key: " " });
      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it("calls onChange on Enter key", async () => {
      const handleChange = vi.fn();
      const { getByRole } = render(() => (
        <Checkbox checked={false} onChange={handleChange} />
      ));
      await fireEvent.keyDown(getByRole("checkbox"), { key: "Enter" });
      expect(handleChange).toHaveBeenCalledWith(true);
    });
  });

  describe("disabled state", () => {
    it("sets aria-disabled when disabled", () => {
      const { getByRole } = render(() => <Checkbox disabled />);
      expect(getByRole("checkbox").getAttribute("aria-disabled")).toBe("true");
    });

    it("does not call onChange when disabled", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <Checkbox disabled onChange={handleChange} />
      ));
      await fireEvent.click(container.firstChild as HTMLElement);
      expect(handleChange).not.toHaveBeenCalled();
    });

    it("does not call onChange on keydown when disabled", async () => {
      const handleChange = vi.fn();
      const { getByRole } = render(() => (
        <Checkbox disabled onChange={handleChange} />
      ));
      await fireEvent.keyDown(getByRole("checkbox"), { key: " " });
      expect(handleChange).not.toHaveBeenCalled();
    });

    it("sets tabIndex to -1 when disabled", () => {
      const { getByRole } = render(() => <Checkbox disabled />);
      expect((getByRole("checkbox") as HTMLElement).tabIndex).toBe(-1);
    });

    it("applies not-allowed cursor when disabled", () => {
      const { container } = render(() => <Checkbox disabled />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.cursor).toBe("not-allowed");
    });

    it("applies reduced opacity when disabled", () => {
      const { container } = render(() => <Checkbox disabled />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.opacity).toBe("0.5");
    });
  });

  describe("accessibility", () => {
    it("has role checkbox", () => {
      const { getByRole } = render(() => <Checkbox />);
      expect(getByRole("checkbox")).toBeTruthy();
    });

    it("uses label as aria-label when provided", () => {
      const { getByRole } = render(() => <Checkbox label="My checkbox" />);
      expect(getByRole("checkbox").getAttribute("aria-label")).toBe("My checkbox");
    });

    it("uses explicit aria-label over label", () => {
      const { getByRole } = render(() => (
        <Checkbox label="Label" aria-label="Custom label" />
      ));
      expect(getByRole("checkbox").getAttribute("aria-label")).toBe("Custom label");
    });

    it("is focusable when not disabled", () => {
      const { getByRole } = render(() => <Checkbox />);
      expect((getByRole("checkbox") as HTMLElement).tabIndex).toBe(0);
    });
  });

  describe("custom styles", () => {
    it("merges custom style prop", () => {
      const { container } = render(() => (
        <Checkbox style={{ "margin-top": "10px" }} />
      ));
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.marginTop).toBe("10px");
    });
  });
});
