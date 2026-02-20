import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexTabs } from "../CortexTabs";
import type { CortexTab } from "../CortexTabs";

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

const defaultTabs: CortexTab[] = [
  { id: "tab1", label: "Tab 1" },
  { id: "tab2", label: "Tab 2" },
  { id: "tab3", label: "Tab 3" },
];

describe("CortexTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders tablist", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" />
      ));
      const tablist = container.querySelector("[role='tablist']");
      expect(tablist).toBeTruthy();
    });

    it("renders all tab buttons", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" />
      ));
      const tabs = container.querySelectorAll("[role='tab']");
      expect(tabs.length).toBe(3);
    });

    it("renders tabs with labels", () => {
      const { getByText } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" />
      ));
      expect(getByText("Tab 1")).toBeTruthy();
      expect(getByText("Tab 2")).toBeTruthy();
      expect(getByText("Tab 3")).toBeTruthy();
    });

    it("sets correct tab ids", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" />
      ));
      const tab1 = container.querySelector("#tab-tab1");
      const tab2 = container.querySelector("#tab-tab2");
      expect(tab1).toBeTruthy();
      expect(tab2).toBeTruthy();
    });

    it("sets aria-controls on tabs", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" />
      ));
      const tab = container.querySelector("[role='tab']");
      expect(tab?.getAttribute("aria-controls")).toBe("panel-tab1");
    });
  });

  describe("active tab", () => {
    it("sets aria-selected to true for active tab", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab2" />
      ));
      const tabs = container.querySelectorAll("[role='tab']");
      expect(tabs[0].getAttribute("aria-selected")).toBe("false");
      expect(tabs[1].getAttribute("aria-selected")).toBe("true");
      expect(tabs[2].getAttribute("aria-selected")).toBe("false");
    });

    it("sets tabIndex 0 for active tab and -1 for others", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab2" />
      ));
      const tabs = container.querySelectorAll("[role='tab']");
      expect((tabs[0] as HTMLElement).tabIndex).toBe(-1);
      expect((tabs[1] as HTMLElement).tabIndex).toBe(0);
      expect((tabs[2] as HTMLElement).tabIndex).toBe(-1);
    });
  });

  describe("tab click", () => {
    it("calls onChange with tab id when tab is clicked", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" onChange={handleChange} />
      ));
      const tabs = container.querySelectorAll("[role='tab']");
      await fireEvent.click(tabs[1]);
      expect(handleChange).toHaveBeenCalledWith("tab2");
    });

    it("does not call onChange when disabled tab is clicked", async () => {
      const handleChange = vi.fn();
      const tabs: CortexTab[] = [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2", disabled: true },
      ];
      const { container } = render(() => (
        <CortexTabs tabs={tabs} activeTab="tab1" onChange={handleChange} />
      ));
      const tabElements = container.querySelectorAll("[role='tab']");
      await fireEvent.click(tabElements[1]);
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe("closable tabs", () => {
    it("renders close icon for closable tabs", () => {
      const tabs: CortexTab[] = [
        { id: "tab1", label: "Tab 1", closable: true },
        { id: "tab2", label: "Tab 2" },
      ];
      const { container } = render(() => (
        <CortexTabs tabs={tabs} activeTab="tab1" />
      ));
      const closeIcons = container.querySelectorAll("[data-testid='cortex-icon'][data-name='x']");
      expect(closeIcons.length).toBe(1);
    });

    it("does not render close icon for non-closable tabs", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" />
      ));
      const closeIcons = container.querySelectorAll("[data-testid='cortex-icon'][data-name='x']");
      expect(closeIcons.length).toBe(0);
    });

    it("calls onClose with tab id when close icon is clicked", async () => {
      const handleClose = vi.fn();
      const tabs: CortexTab[] = [
        { id: "tab1", label: "Tab 1", closable: true },
        { id: "tab2", label: "Tab 2" },
      ];
      const { container } = render(() => (
        <CortexTabs tabs={tabs} activeTab="tab1" onClose={handleClose} />
      ));
      const closeIcon = container.querySelector("[data-testid='cortex-icon'][data-name='x']");
      const closeButton = closeIcon?.closest("span");
      await fireEvent.click(closeButton!);
      expect(handleClose).toHaveBeenCalledWith("tab1");
    });

    it("does not trigger tab change when close is clicked", async () => {
      const handleChange = vi.fn();
      const handleClose = vi.fn();
      const tabs: CortexTab[] = [
        { id: "tab1", label: "Tab 1", closable: true },
      ];
      const { container } = render(() => (
        <CortexTabs tabs={tabs} activeTab="tab1" onChange={handleChange} onClose={handleClose} />
      ));
      const closeIcon = container.querySelector("[data-testid='cortex-icon'][data-name='x']");
      const closeButton = closeIcon?.closest("span");
      await fireEvent.click(closeButton!);
      expect(handleClose).toHaveBeenCalledWith("tab1");
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe("disabled tabs", () => {
    it("sets aria-disabled on disabled tabs", () => {
      const tabs: CortexTab[] = [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2", disabled: true },
      ];
      const { container } = render(() => (
        <CortexTabs tabs={tabs} activeTab="tab1" />
      ));
      const tabElements = container.querySelectorAll("[role='tab']");
      expect(tabElements[0].getAttribute("aria-disabled")).toBeFalsy();
      expect(tabElements[1].getAttribute("aria-disabled")).toBe("true");
    });

    it("applies reduced opacity for disabled tabs", () => {
      const tabs: CortexTab[] = [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2", disabled: true },
      ];
      const { container } = render(() => (
        <CortexTabs tabs={tabs} activeTab="tab1" />
      ));
      const tabElements = container.querySelectorAll("[role='tab']");
      expect((tabElements[1] as HTMLElement).style.opacity).toBe("0.5");
    });

    it("applies not-allowed cursor for disabled tabs", () => {
      const tabs: CortexTab[] = [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2", disabled: true },
      ];
      const { container } = render(() => (
        <CortexTabs tabs={tabs} activeTab="tab1" />
      ));
      const tabElements = container.querySelectorAll("[role='tab']");
      expect((tabElements[1] as HTMLElement).style.cursor).toBe("not-allowed");
    });
  });

  describe("tab badges", () => {
    it("renders badge with string value", () => {
      const tabs: CortexTab[] = [
        { id: "tab1", label: "Tab 1", badge: "new" },
      ];
      const { getByText } = render(() => (
        <CortexTabs tabs={tabs} activeTab="tab1" />
      ));
      expect(getByText("new")).toBeTruthy();
    });

    it("renders badge with number value", () => {
      const tabs: CortexTab[] = [
        { id: "tab1", label: "Tab 1", badge: 5 },
      ];
      const { getByText } = render(() => (
        <CortexTabs tabs={tabs} activeTab="tab1" />
      ));
      expect(getByText("5")).toBeTruthy();
    });

    it("does not render badge when not provided", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" />
      ));
      const badges = container.querySelectorAll("[style*='border-radius: 9px']");
      expect(badges.length).toBe(0);
    });
  });

  describe("tab icons", () => {
    it("renders icon for tabs with icon prop", () => {
      const tabs: CortexTab[] = [
        { id: "tab1", label: "Tab 1", icon: "file" },
        { id: "tab2", label: "Tab 2" },
      ];
      const { container } = render(() => (
        <CortexTabs tabs={tabs} activeTab="tab1" />
      ));
      const icons = container.querySelectorAll("[data-testid='cortex-icon'][data-name='file']");
      expect(icons.length).toBe(1);
    });

    it("renders icon with correct size for sm tabs", () => {
      const tabs: CortexTab[] = [
        { id: "tab1", label: "Tab 1", icon: "file" },
      ];
      const { container } = render(() => (
        <CortexTabs tabs={tabs} activeTab="tab1" size="sm" />
      ));
      const icon = container.querySelector("[data-testid='cortex-icon'][data-name='file']");
      expect(icon?.getAttribute("data-size")).toBe("16");
    });

    it("renders icon with correct size for md tabs", () => {
      const tabs: CortexTab[] = [
        { id: "tab1", label: "Tab 1", icon: "file" },
      ];
      const { container } = render(() => (
        <CortexTabs tabs={tabs} activeTab="tab1" size="md" />
      ));
      const icon = container.querySelector("[data-testid='cortex-icon'][data-name='file']");
      expect(icon?.getAttribute("data-size")).toBe("16");
    });
  });

  describe("variants", () => {
    it("renders default variant", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" variant="default" />
      ));
      const tablist = container.querySelector("[role='tablist']");
      expect(tablist).toBeTruthy();
    });

    it("renders pills variant with background", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" variant="pills" />
      ));
      const tablist = container.querySelector("[role='tablist']") as HTMLElement;
      expect(tablist.style.background).toContain("cortex-bg-tertiary");
    });

    it("renders underline variant", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" variant="underline" />
      ));
      const tablist = container.querySelector("[role='tablist']");
      expect(tablist).toBeTruthy();
    });

    it("applies gap for pills variant", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" variant="pills" />
      ));
      const tablist = container.querySelector("[role='tablist']") as HTMLElement;
      expect(tablist.style.gap).toBe("4px");
    });

    it("applies no gap for default variant", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" variant="default" />
      ));
      const tablist = container.querySelector("[role='tablist']") as HTMLElement;
      expect(tablist.style.gap).toBe("0px");
    });
  });

  describe("sizes", () => {
    it("applies sm size height", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" size="sm" />
      ));
      const tab = container.querySelector("[role='tab']") as HTMLElement;
      expect(tab.style.height).toBe("28px");
    });

    it("applies md size height (default)", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" />
      ));
      const tab = container.querySelector("[role='tab']") as HTMLElement;
      expect(tab.style.height).toBe("36px");
    });

    it("applies lg size height", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" size="lg" />
      ));
      const tab = container.querySelector("[role='tab']") as HTMLElement;
      expect(tab.style.height).toBe("44px");
    });

    it("applies sm size font", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" size="sm" />
      ));
      const tab = container.querySelector("[role='tab']") as HTMLElement;
      expect(tab.style.fontSize).toBe("12px");
    });

    it("applies lg size font", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" size="lg" />
      ));
      const tab = container.querySelector("[role='tab']") as HTMLElement;
      expect(tab.style.fontSize).toBe("12px");
    });
  });

  describe("keyboard navigation", () => {
    it("navigates to next tab with ArrowRight", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" onChange={handleChange} />
      ));
      const tablist = container.querySelector("[role='tablist']") as HTMLElement;
      const firstTab = container.querySelector("[role='tab']") as HTMLElement;
      firstTab.focus();
      await fireEvent.focus(firstTab);
      await fireEvent.keyDown(tablist, { key: "ArrowRight" });
      await fireEvent.keyDown(tablist, { key: "Enter" });
      expect(handleChange).toHaveBeenCalledWith("tab2");
    });

    it("navigates to previous tab with ArrowLeft", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" onChange={handleChange} />
      ));
      const tablist = container.querySelector("[role='tablist']") as HTMLElement;
      const tabs = container.querySelectorAll("[role='tab']");
      const secondTab = tabs[1] as HTMLElement;
      secondTab.focus();
      await fireEvent.focus(secondTab);
      await fireEvent.keyDown(tablist, { key: "ArrowLeft" });
      await fireEvent.keyDown(tablist, { key: "Enter" });
      expect(handleChange).toHaveBeenCalledWith("tab1");
    });

    it("selects tab with Enter key", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" onChange={handleChange} />
      ));
      const tablist = container.querySelector("[role='tablist']") as HTMLElement;
      const firstTab = container.querySelector("[role='tab']") as HTMLElement;
      firstTab.focus();
      await fireEvent.focus(firstTab);
      await fireEvent.keyDown(tablist, { key: "Enter" });
      expect(handleChange).toHaveBeenCalledWith("tab1");
    });

    it("selects tab with Space key", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" onChange={handleChange} />
      ));
      const tablist = container.querySelector("[role='tablist']") as HTMLElement;
      const firstTab = container.querySelector("[role='tab']") as HTMLElement;
      firstTab.focus();
      await fireEvent.focus(firstTab);
      await fireEvent.keyDown(tablist, { key: " " });
      expect(handleChange).toHaveBeenCalledWith("tab1");
    });

    it("jumps to first tab with Home key", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" onChange={handleChange} />
      ));
      const tablist = container.querySelector("[role='tablist']") as HTMLElement;
      const tabs = container.querySelectorAll("[role='tab']");
      const lastTab = tabs[2] as HTMLElement;
      lastTab.focus();
      await fireEvent.focus(lastTab);
      await fireEvent.keyDown(tablist, { key: "Home" });
      await fireEvent.keyDown(tablist, { key: "Enter" });
      expect(handleChange).toHaveBeenCalledWith("tab1");
    });

    it("jumps to last tab with End key", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" onChange={handleChange} />
      ));
      const tablist = container.querySelector("[role='tablist']") as HTMLElement;
      const firstTab = container.querySelector("[role='tab']") as HTMLElement;
      firstTab.focus();
      await fireEvent.focus(firstTab);
      await fireEvent.keyDown(tablist, { key: "End" });
      await fireEvent.keyDown(tablist, { key: "Enter" });
      expect(handleChange).toHaveBeenCalledWith("tab3");
    });

    it("closes closable tab with Delete key", async () => {
      const handleClose = vi.fn();
      const tabs: CortexTab[] = [
        { id: "tab1", label: "Tab 1", closable: true },
        { id: "tab2", label: "Tab 2" },
      ];
      const { container } = render(() => (
        <CortexTabs tabs={tabs} activeTab="tab1" onClose={handleClose} />
      ));
      const tablist = container.querySelector("[role='tablist']") as HTMLElement;
      const firstTab = container.querySelector("[role='tab']") as HTMLElement;
      firstTab.focus();
      await fireEvent.focus(firstTab);
      await fireEvent.keyDown(tablist, { key: "Delete" });
      expect(handleClose).toHaveBeenCalledWith("tab1");
    });
  });

  describe("orientation", () => {
    it("defaults to horizontal orientation", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" />
      ));
      const tablist = container.querySelector("[role='tablist']");
      expect(tablist?.getAttribute("aria-orientation")).toBe("horizontal");
    });

    it("supports vertical orientation", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" orientation="vertical" />
      ));
      const tablist = container.querySelector("[role='tablist']");
      expect(tablist?.getAttribute("aria-orientation")).toBe("vertical");
    });

    it("applies column flex direction for vertical orientation", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" orientation="vertical" />
      ));
      const tablist = container.querySelector("[role='tablist']") as HTMLElement;
      expect(tablist.style.flexDirection).toBe("column");
    });
  });

  describe("custom class and style", () => {
    it("applies custom class to container", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" class="custom-tabs" />
      ));
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains("custom-tabs")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" style={{ "margin-top": "10px" }} />
      ));
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.marginTop).toBe("10px");
    });
  });

  describe("fullWidth", () => {
    it("applies flex 1 to tabs when fullWidth is true", () => {
      const { container } = render(() => (
        <CortexTabs tabs={defaultTabs} activeTab="tab1" fullWidth />
      ));
      const tab = container.querySelector("[role='tab']") as HTMLElement;
      expect(tab.style.flex).toContain("1");
    });
  });
});
