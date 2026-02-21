import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexDropdownItem } from "../CortexDropdownItem";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("../CortexIcon", () => ({
  CortexIcon: (props: { name: string; size: number }) => (
    <span data-testid="cortex-icon" data-name={props.name} data-size={props.size} />
  ),
}));

describe("CortexDropdownItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders with role='menuitem'", () => {
      const { getByRole } = render(() => (
        <CortexDropdownItem label="Test Item" />
      ));
      const item = getByRole("menuitem");
      expect(item).toBeTruthy();
      expect(item.tagName.toLowerCase()).toBe("button");
    });

    it("renders label text", () => {
      const { getByText } = render(() => (
        <CortexDropdownItem label="File" />
      ));
      expect(getByText("File")).toBeTruthy();
    });

    it("renders as a button element with type='button'", () => {
      const { container } = render(() => (
        <CortexDropdownItem label="Test" />
      ));
      const button = container.querySelector("button");
      expect(button).toBeTruthy();
      expect(button?.type).toBe("button");
    });
  });

  describe("shortcut", () => {
    it("shows shortcut when showShortcut=true and shortcut is provided", () => {
      const { getByText } = render(() => (
        <CortexDropdownItem label="Save" shortcut="Ctrl+S" showShortcut={true} />
      ));
      expect(getByText("Ctrl+S")).toBeTruthy();
    });

    it("does not show shortcut when showShortcut=false", () => {
      const { queryByText } = render(() => (
        <CortexDropdownItem label="Save" shortcut="Ctrl+S" showShortcut={false} />
      ));
      expect(queryByText("Ctrl+S")).toBeFalsy();
    });

    it("does not show shortcut when showShortcut is not set", () => {
      const { queryByText } = render(() => (
        <CortexDropdownItem label="Save" shortcut="Ctrl+S" />
      ));
      expect(queryByText("Ctrl+S")).toBeFalsy();
    });

    it("does not show shortcut when shortcut text is not provided", () => {
      const { container } = render(() => (
        <CortexDropdownItem label="Save" showShortcut={true} />
      ));
      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(1);
    });
  });

  describe("right icon", () => {
    it("shows right icon when showIconRight=true and iconRight is provided", () => {
      const { container } = render(() => (
        <CortexDropdownItem label="Open" iconRight="chevron-right" showIconRight={true} />
      ));
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute("data-name")).toBe("chevron-right");
    });

    it("does not show right icon when showIconRight=false", () => {
      const { container } = render(() => (
        <CortexDropdownItem label="Open" iconRight="chevron-right" showIconRight={false} />
      ));
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon).toBeFalsy();
    });

    it("does not show right icon when iconRight is not provided", () => {
      const { container } = render(() => (
        <CortexDropdownItem label="Open" showIconRight={true} />
      ));
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon).toBeFalsy();
    });
  });

  describe("click handler", () => {
    it("calls onClick when clicked", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexDropdownItem label="Click Me" onClick={handleClick} />
      ));
      const item = getByRole("menuitem");
      await fireEvent.click(item);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("passes MouseEvent to onClick handler", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexDropdownItem label="Click Me" onClick={handleClick} />
      ));
      const item = getByRole("menuitem");
      await fireEvent.click(item);
      expect(handleClick).toHaveBeenCalledWith(expect.any(MouseEvent));
    });

    it("does not throw when onClick is not provided", async () => {
      const { getByRole } = render(() => (
        <CortexDropdownItem label="No Handler" />
      ));
      const item = getByRole("menuitem");
      expect(() => fireEvent.click(item)).not.toThrow();
    });
  });

  describe("hover state", () => {
    it("changes background color on mouse enter", async () => {
      const { getByRole } = render(() => (
        <CortexDropdownItem label="Hover Me" />
      ));
      const item = getByRole("menuitem") as HTMLElement;
      expect(item.style.background).toBe("transparent");

      await fireEvent.mouseEnter(item);
      expect(item.style.background).toBe("rgb(37, 38, 40)");
    });

    it("resets background color on mouse leave", async () => {
      const { getByRole } = render(() => (
        <CortexDropdownItem label="Hover Me" />
      ));
      const item = getByRole("menuitem") as HTMLElement;

      await fireEvent.mouseEnter(item);
      expect(item.style.background).toBe("rgb(37, 38, 40)");

      await fireEvent.mouseLeave(item);
      expect(item.style.background).toBe("transparent");
    });

    it("adds border-radius on hover", async () => {
      const { getByRole } = render(() => (
        <CortexDropdownItem label="Hover Me" />
      ));
      const item = getByRole("menuitem") as HTMLElement;
      expect(item.style.borderRadius).toBe("0px");

      await fireEvent.mouseEnter(item);
      expect(item.style.borderRadius).toBe("4px");
    });
  });

  describe("isRecentFile variant", () => {
    it("renders with column layout when isRecentFile=true", () => {
      const { getByRole } = render(() => (
        <CortexDropdownItem label="Recent File" isRecentFile={true} />
      ));
      const item = getByRole("menuitem") as HTMLElement;
      expect(item.style.flexDirection).toBe("column");
    });

    it("renders with row layout when isRecentFile=false", () => {
      const { getByRole } = render(() => (
        <CortexDropdownItem label="Normal Item" />
      ));
      const item = getByRole("menuitem") as HTMLElement;
      expect(item.style.flexDirection).toBe("row");
    });

    it("uses larger font size for isRecentFile variant", () => {
      const { getByText } = render(() => (
        <CortexDropdownItem label="Recent File" isRecentFile={true} />
      ));
      const label = getByText("Recent File") as HTMLElement;
      expect(label.style.fontSize).toBe("16px");
    });

    it("uses smaller font size for default variant", () => {
      const { getByText } = render(() => (
        <CortexDropdownItem label="Normal Item" />
      ));
      const label = getByText("Normal Item") as HTMLElement;
      expect(label.style.fontSize).toBe("12px");
    });

    it("uses larger padding for isRecentFile variant", () => {
      const { getByRole } = render(() => (
        <CortexDropdownItem label="Recent File" isRecentFile={true} />
      ));
      const item = getByRole("menuitem") as HTMLElement;
      expect(item.style.padding).toBe("8px");
    });

    it("does not show hover background for isRecentFile variant", async () => {
      const { getByRole } = render(() => (
        <CortexDropdownItem label="Recent File" isRecentFile={true} />
      ));
      const item = getByRole("menuitem") as HTMLElement;
      await fireEvent.mouseEnter(item);
      expect(item.style.background).toBe("transparent");
    });

    it("does not show shortcut in isRecentFile variant", () => {
      const { queryByText } = render(() => (
        <CortexDropdownItem
          label="Recent File"
          isRecentFile={true}
          shortcut="Ctrl+R"
          showShortcut={true}
        />
      ));
      expect(queryByText("Ctrl+R")).toBeFalsy();
    });

    it("does not show right icon in isRecentFile variant", () => {
      const { container } = render(() => (
        <CortexDropdownItem
          label="Recent File"
          isRecentFile={true}
          iconRight="chevron-right"
          showIconRight={true}
        />
      ));
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon).toBeFalsy();
    });
  });

  describe("custom style and class", () => {
    it("applies custom class", () => {
      const { getByRole } = render(() => (
        <CortexDropdownItem label="Styled" class="my-item" />
      ));
      const item = getByRole("menuitem") as HTMLElement;
      expect(item.classList.contains("my-item")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { getByRole } = render(() => (
        <CortexDropdownItem label="Styled" style={{ "margin-left": "8px" }} />
      ));
      const item = getByRole("menuitem") as HTMLElement;
      expect(item.style.marginLeft).toBe("8px");
      expect(item.style.cursor).toBe("pointer");
    });
  });
});
