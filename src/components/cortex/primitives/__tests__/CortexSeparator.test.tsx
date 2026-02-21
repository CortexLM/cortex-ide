import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@solidjs/testing-library";
import { CortexSeparator } from "../CortexSeparator";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("CortexSeparator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders a separator element", () => {
      const { getByRole } = render(() => <CortexSeparator />);
      const separator = getByRole("separator");
      expect(separator).toBeTruthy();
    });

    it("renders as a div element", () => {
      const { container } = render(() => <CortexSeparator />);
      const div = container.querySelector("div");
      expect(div).toBeTruthy();
    });

    it("renders a divider line inside", () => {
      const { getByRole } = render(() => <CortexSeparator />);
      const separator = getByRole("separator");
      const line = separator.querySelector("div");
      expect(line).toBeTruthy();
    });
  });

  describe("accessibility", () => {
    it("has role separator", () => {
      const { getByRole } = render(() => <CortexSeparator />);
      expect(getByRole("separator")).toBeTruthy();
    });
  });

  describe("styling", () => {
    it("has vertical padding", () => {
      const { getByRole } = render(() => <CortexSeparator />);
      const separator = getByRole("separator") as HTMLElement;
      expect(separator.style.padding).toBe("4px 0px");
    });

    it("has flex column layout", () => {
      const { getByRole } = render(() => <CortexSeparator />);
      const separator = getByRole("separator") as HTMLElement;
      expect(separator.style.display).toBe("flex");
      expect(separator.style.flexDirection).toBe("column");
    });

    it("stretches to fill container", () => {
      const { getByRole } = render(() => <CortexSeparator />);
      const separator = getByRole("separator") as HTMLElement;
      expect(separator.style.alignSelf).toBe("stretch");
    });

    it("renders line with full width", () => {
      const { getByRole } = render(() => <CortexSeparator />);
      const separator = getByRole("separator");
      const line = separator.querySelector("div") as HTMLElement;
      expect(line.style.width).toBe("100%");
    });

    it("renders line with 1px border", () => {
      const { getByRole } = render(() => <CortexSeparator />);
      const separator = getByRole("separator");
      const line = separator.querySelector("div") as HTMLElement;
      expect(line.style.borderBottom).toBe("1px solid rgb(46, 47, 49)");
    });
  });

  describe("custom class and style", () => {
    it("applies custom class", () => {
      const { getByRole } = render(() => (
        <CortexSeparator class="custom-separator" />
      ));
      const separator = getByRole("separator");
      expect(separator.classList.contains("custom-separator")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { getByRole } = render(() => (
        <CortexSeparator style={{ "margin-top": "10px" }} />
      ));
      const separator = getByRole("separator") as HTMLElement;
      expect(separator.style.marginTop).toBe("10px");
    });
  });
});
