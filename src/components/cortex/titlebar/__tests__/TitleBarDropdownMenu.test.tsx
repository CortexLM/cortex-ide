import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { TitleBarDropdownMenu } from "../TitleBarDropdownMenu";
import type { MenuItem } from "../defaultMenus";

describe("TitleBarDropdownMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  const sampleItems: MenuItem[] = [
    { label: "New File", shortcut: "⌘N", action: vi.fn() },
    { label: "Open File...", shortcut: "⌘O", action: vi.fn() },
    { separator: true, label: "" },
    { label: "Save", shortcut: "⌘S", action: vi.fn() },
    { label: "Close", action: vi.fn() },
  ];

  describe("Rendering", () => {
    it("should render a dropdown container", () => {
      const { container } = render(() => (
        <TitleBarDropdownMenu items={sampleItems} onItemClick={vi.fn()} />
      ));
      const dropdown = container.firstElementChild;
      expect(dropdown).toBeTruthy();
      const style = dropdown?.getAttribute("style") || "";
      expect(style).toContain("position:absolute");
    });

    it("should render all non-separator items as buttons", () => {
      const { container } = render(() => (
        <TitleBarDropdownMenu items={sampleItems} onItemClick={vi.fn()} />
      ));
      const buttons = container.querySelectorAll("button");
      const nonSeparatorItems = sampleItems.filter((i) => !i.separator);
      expect(buttons).toHaveLength(nonSeparatorItems.length);
    });

    it("should render item labels", () => {
      const { container } = render(() => (
        <TitleBarDropdownMenu items={sampleItems} onItemClick={vi.fn()} />
      ));
      expect(container.textContent).toContain("New File");
      expect(container.textContent).toContain("Open File...");
      expect(container.textContent).toContain("Save");
      expect(container.textContent).toContain("Close");
    });

    it("should render shortcuts when present", () => {
      const { container } = render(() => (
        <TitleBarDropdownMenu items={sampleItems} onItemClick={vi.fn()} />
      ));
      expect(container.textContent).toContain("⌘N");
      expect(container.textContent).toContain("⌘O");
      expect(container.textContent).toContain("⌘S");
    });

    it("should not render shortcut for items without shortcut", () => {
      const items: MenuItem[] = [
        { label: "No Shortcut Item", action: vi.fn() },
      ];
      const { container } = render(() => (
        <TitleBarDropdownMenu items={items} onItemClick={vi.fn()} />
      ));
      const button = container.querySelector("button");
      const spans = button?.querySelectorAll("span");
      expect(spans).toHaveLength(1);
      expect(spans?.[0].textContent).toBe("No Shortcut Item");
    });

    it("should render separator items as divider lines, not buttons", () => {
      const { container } = render(() => (
        <TitleBarDropdownMenu items={sampleItems} onItemClick={vi.fn()} />
      ));
      const allChildren = container.firstElementChild?.children;
      expect(allChildren).toBeTruthy();
      const separatorCount = sampleItems.filter((i) => i.separator).length;
      const buttonCount = container.querySelectorAll("button").length;
      expect(allChildren!.length).toBe(buttonCount + separatorCount);
    });

    it("should render with empty items array", () => {
      const { container } = render(() => (
        <TitleBarDropdownMenu items={[]} onItemClick={vi.fn()} />
      ));
      const buttons = container.querySelectorAll("button");
      expect(buttons).toHaveLength(0);
    });
  });

  describe("Styling", () => {
    it("should have correct dropdown container styles", () => {
      const { container } = render(() => (
        <TitleBarDropdownMenu items={sampleItems} onItemClick={vi.fn()} />
      ));
      const dropdown = container.firstElementChild as HTMLElement;
      const style = dropdown.getAttribute("style") || "";
      expect(style).toContain("min-width:243px");
      expect(style).toMatch(/(#1C1C1D|rgb\(28,\s*28,\s*29\))/i);
      expect(style).toContain("border-radius:8px");
      expect(style).toContain("z-index:9999");
    });

    it("should have correct item button styles", () => {
      const { container } = render(() => (
        <TitleBarDropdownMenu items={sampleItems} onItemClick={vi.fn()} />
      ));
      const button = container.querySelector("button");
      expect(button?.style.display).toBe("flex");
      expect(button?.style.alignItems).toBe("center");
      expect(button?.style.justifyContent).toBe("space-between");
      expect(button?.style.fontSize).toBe("12px");
    });

    it("separator divider should render a divider element", () => {
      const { container } = render(() => (
        <TitleBarDropdownMenu items={sampleItems} onItemClick={vi.fn()} />
      ));
      const allChildren = Array.from(container.firstElementChild!.children);
      const separatorWrapper = allChildren.find(
        (el) => !el.querySelector("button")
      ) as HTMLElement;
      expect(separatorWrapper).toBeTruthy();
      expect(separatorWrapper.querySelector("button")).toBeNull();
    });
  });

  describe("Interactions", () => {
    it("should call onItemClick when a menu item is clicked", async () => {
      const onItemClick = vi.fn();
      const { container } = render(() => (
        <TitleBarDropdownMenu items={sampleItems} onItemClick={onItemClick} />
      ));
      const firstButton = container.querySelector("button");
      await fireEvent.click(firstButton!);
      expect(onItemClick).toHaveBeenCalledTimes(1);
      expect(onItemClick).toHaveBeenCalledWith(sampleItems[0]);
    });

    it("should call onItemClick with the correct item for each button", async () => {
      const onItemClick = vi.fn();
      const { container } = render(() => (
        <TitleBarDropdownMenu items={sampleItems} onItemClick={onItemClick} />
      ));
      const buttons = container.querySelectorAll("button");
      const nonSeparatorItems = sampleItems.filter((i) => !i.separator);

      for (let i = 0; i < buttons.length; i++) {
        await fireEvent.click(buttons[i]);
        expect(onItemClick).toHaveBeenLastCalledWith(nonSeparatorItems[i]);
      }
    });

    it("should call onMouseEnter when mouse enters the dropdown", async () => {
      const onMouseEnter = vi.fn();
      const { container } = render(() => (
        <TitleBarDropdownMenu
          items={sampleItems}
          onItemClick={vi.fn()}
          onMouseEnter={onMouseEnter}
        />
      ));
      await fireEvent.mouseEnter(container.firstElementChild!);
      expect(onMouseEnter).toHaveBeenCalledTimes(1);
    });

    it("should call onMouseLeave when mouse leaves the dropdown", async () => {
      const onMouseLeave = vi.fn();
      const { container } = render(() => (
        <TitleBarDropdownMenu
          items={sampleItems}
          onItemClick={vi.fn()}
          onMouseLeave={onMouseLeave}
        />
      ));
      await fireEvent.mouseLeave(container.firstElementChild!);
      expect(onMouseLeave).toHaveBeenCalledTimes(1);
    });

    it("should change background on item hover", async () => {
      const { container } = render(() => (
        <TitleBarDropdownMenu items={sampleItems} onItemClick={vi.fn()} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      expect(button.style.background).toBe("transparent");

      await fireEvent.mouseEnter(button);
      expect(button.style.background).toMatch(/rgb\(37,\s*38,\s*40\)|#252628/i);

      await fireEvent.mouseLeave(button);
      expect(button.style.background).toBe("transparent");
    });

    it("should change border-radius on item hover", async () => {
      const { container } = render(() => (
        <TitleBarDropdownMenu items={sampleItems} onItemClick={vi.fn()} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      expect(["0", "0px"]).toContain(button.style.borderRadius);

      await fireEvent.mouseEnter(button);
      expect(button.style.borderRadius).toBe("4px");

      await fireEvent.mouseLeave(button);
      expect(["0", "0px"]).toContain(button.style.borderRadius);
    });
  });

  describe("Edge cases", () => {
    it("should handle items with only separators", () => {
      const items: MenuItem[] = [
        { separator: true, label: "" },
        { separator: true, label: "" },
      ];
      const { container } = render(() => (
        <TitleBarDropdownMenu items={items} onItemClick={vi.fn()} />
      ));
      const buttons = container.querySelectorAll("button");
      expect(buttons).toHaveLength(0);
    });

    it("should handle items without actions", async () => {
      const items: MenuItem[] = [
        { label: "No Action" },
      ];
      const onItemClick = vi.fn();
      const { container } = render(() => (
        <TitleBarDropdownMenu items={items} onItemClick={onItemClick} />
      ));
      const button = container.querySelector("button");
      await fireEvent.click(button!);
      expect(onItemClick).toHaveBeenCalledWith(items[0]);
    });
  });
});
