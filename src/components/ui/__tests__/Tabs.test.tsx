import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { Tabs, TabList, Tab, TabPanel } from "../Tabs";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("Tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders tabs container", () => {
      const { container } = render(() => (
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      ));
      expect(container.querySelector("div")).toBeTruthy();
    });

    it("renders tab list with role tablist", () => {
      const { getByRole } = render(() => (
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
        </Tabs>
      ));
      expect(getByRole("tablist")).toBeTruthy();
    });

    it("renders tab buttons with role tab", () => {
      const { getAllByRole } = render(() => (
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      ));
      expect(getAllByRole("tab").length).toBe(2);
    });

    it("renders tab panel with role tabpanel", () => {
      const { getByRole } = render(() => (
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
        </Tabs>
      ));
      expect(getByRole("tabpanel")).toBeTruthy();
    });

    it("renders tab text content", () => {
      const { getByText } = render(() => (
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">First Tab</Tab>
          </TabList>
          <TabPanel id="tab1">Panel Content</TabPanel>
        </Tabs>
      ));
      expect(getByText("First Tab")).toBeTruthy();
      expect(getByText("Panel Content")).toBeTruthy();
    });
  });

  describe("default tab", () => {
    it("shows default tab panel content", () => {
      const { getByText, queryByText } = render(() => (
        <Tabs defaultTab="tab2">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      ));
      expect(getByText("Content 2")).toBeTruthy();
      expect(queryByText("Content 1")).toBeNull();
    });

    it("marks default tab as selected", () => {
      const { getAllByRole } = render(() => (
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      ));
      const tabs = getAllByRole("tab");
      expect(tabs[0].getAttribute("aria-selected")).toBe("true");
      expect(tabs[1].getAttribute("aria-selected")).toBe("false");
    });
  });

  describe("tab switching", () => {
    it("switches content when tab is clicked", async () => {
      const { getAllByRole, getByText, queryByText } = render(() => (
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      ));
      expect(getByText("Content 1")).toBeTruthy();
      await fireEvent.click(getAllByRole("tab")[1]);
      expect(getByText("Content 2")).toBeTruthy();
      expect(queryByText("Content 1")).toBeNull();
    });

    it("updates aria-selected when tab is clicked", async () => {
      const { getAllByRole } = render(() => (
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      ));
      const tabs = getAllByRole("tab");
      await fireEvent.click(tabs[1]);
      expect(tabs[0].getAttribute("aria-selected")).toBe("false");
      expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    });

    it("calls onChange when tab is clicked", async () => {
      const handleChange = vi.fn();
      const { getAllByRole } = render(() => (
        <Tabs defaultTab="tab1" onChange={handleChange}>
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      ));
      await fireEvent.click(getAllByRole("tab")[1]);
      expect(handleChange).toHaveBeenCalledWith("tab2");
    });
  });

  describe("controlled mode", () => {
    it("uses activeTab prop over internal state", () => {
      const { getByText, queryByText } = render(() => (
        <Tabs activeTab="tab2">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      ));
      expect(getByText("Content 2")).toBeTruthy();
      expect(queryByText("Content 1")).toBeNull();
    });
  });

  describe("disabled tabs", () => {
    it("does not switch to disabled tab on click", async () => {
      const handleChange = vi.fn();
      const { getAllByRole, getByText } = render(() => (
        <Tabs defaultTab="tab1" onChange={handleChange}>
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2" disabled>Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      ));
      await fireEvent.click(getAllByRole("tab")[1]);
      expect(handleChange).not.toHaveBeenCalled();
      expect(getByText("Content 1")).toBeTruthy();
    });

    it("sets aria-disabled on disabled tab", () => {
      const { getAllByRole } = render(() => (
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2" disabled>Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      ));
      expect(getAllByRole("tab")[1].getAttribute("aria-disabled")).toBe("true");
    });

    it("applies reduced opacity on disabled tab", () => {
      const { getAllByRole } = render(() => (
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2" disabled>Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      ));
      const tab = getAllByRole("tab")[1] as HTMLElement;
      expect(tab.style.opacity).toBe("0.5");
    });
  });

  describe("tab panel", () => {
    it("only renders active tab panel", () => {
      const { getAllByRole } = render(() => (
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      ));
      const panels = getAllByRole("tabpanel");
      expect(panels.length).toBe(1);
    });

    it("has aria-labelledby referencing tab id", () => {
      const { getByRole } = render(() => (
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
        </Tabs>
      ));
      expect(getByRole("tabpanel").getAttribute("aria-labelledby")).toBe("tab1");
    });
  });

  describe("tab accessibility", () => {
    it("active tab has tabIndex 0", () => {
      const { getAllByRole } = render(() => (
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      ));
      expect((getAllByRole("tab")[0] as HTMLElement).tabIndex).toBe(0);
    });

    it("inactive tab has tabIndex -1", () => {
      const { getAllByRole } = render(() => (
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      ));
      expect((getAllByRole("tab")[1] as HTMLElement).tabIndex).toBe(-1);
    });
  });

  describe("custom styles", () => {
    it("merges custom style on Tabs container", () => {
      const { container } = render(() => (
        <Tabs defaultTab="tab1" style={{ "margin-top": "16px" }}>
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
        </Tabs>
      ));
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.marginTop).toBe("16px");
    });

    it("merges custom style on TabList", () => {
      const { getByRole } = render(() => (
        <Tabs defaultTab="tab1">
          <TabList style={{ "padding-top": "8px" }}>
            <Tab id="tab1">Tab 1</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
        </Tabs>
      ));
      const tablist = getByRole("tablist") as HTMLElement;
      expect(tablist.style.paddingTop).toBe("8px");
    });
  });
});
