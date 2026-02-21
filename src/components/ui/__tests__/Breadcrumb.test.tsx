import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { Breadcrumb } from "../Breadcrumb";
import type { BreadcrumbItem } from "../Breadcrumb";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

const simpleItems: BreadcrumbItem[] = [
  { id: "home", label: "Home", onClick: vi.fn() },
  { id: "docs", label: "Docs", onClick: vi.fn() },
  { id: "api", label: "API" },
];

describe("Breadcrumb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders a nav element", () => {
      const { container } = render(() => <Breadcrumb items={simpleItems} />);
      const nav = container.querySelector("nav");
      expect(nav).toBeTruthy();
    });

    it("has aria-label Breadcrumb", () => {
      const { container } = render(() => <Breadcrumb items={simpleItems} />);
      const nav = container.querySelector("nav");
      expect(nav?.getAttribute("aria-label")).toBe("Breadcrumb");
    });

    it("renders all item labels", () => {
      const { getByText } = render(() => <Breadcrumb items={simpleItems} />);
      expect(getByText("Home")).toBeTruthy();
      expect(getByText("Docs")).toBeTruthy();
      expect(getByText("API")).toBeTruthy();
    });

    it("renders correct number of items", () => {
      const items: BreadcrumbItem[] = [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ];
      const { getByText } = render(() => <Breadcrumb items={items} />);
      expect(getByText("A")).toBeTruthy();
      expect(getByText("B")).toBeTruthy();
    });
  });

  describe("separators", () => {
    it("renders separator spans between items", () => {
      const { container } = render(() => <Breadcrumb items={simpleItems} />);
      const separators = container.querySelectorAll("[aria-hidden='true']");
      expect(separators.length).toBe(simpleItems.length - 1);
    });

    it("renders custom separator", () => {
      const { getAllByText } = render(() => (
        <Breadcrumb items={simpleItems} separator={<span>/</span>} />
      ));
      const separators = getAllByText("/");
      expect(separators.length).toBe(simpleItems.length - 1);
    });

    it("separators have aria-hidden", () => {
      const { container } = render(() => <Breadcrumb items={simpleItems} />);
      const separatorSpans = container.querySelectorAll("[aria-hidden='true']");
      expect(separatorSpans.length).toBe(simpleItems.length - 1);
    });
  });

  describe("collapsing", () => {
    it("shows all items when count is within maxItems", () => {
      const { getByText } = render(() => (
        <Breadcrumb items={simpleItems} maxItems={5} />
      ));
      expect(getByText("Home")).toBeTruthy();
      expect(getByText("Docs")).toBeTruthy();
      expect(getByText("API")).toBeTruthy();
    });

    it("collapses items when count exceeds maxItems", () => {
      const items: BreadcrumbItem[] = [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
        { id: "c", label: "Gamma" },
        { id: "d", label: "Delta" },
        { id: "e", label: "Epsilon" },
      ];
      const { getByText, queryByText } = render(() => (
        <Breadcrumb items={items} maxItems={3} />
      ));
      expect(getByText("Alpha")).toBeTruthy();
      expect(getByText("Epsilon")).toBeTruthy();
      expect(queryByText("Beta")).toBeNull();
      expect(queryByText("Gamma")).toBeNull();
    });

    it("shows ellipsis button when collapsed", () => {
      const items: BreadcrumbItem[] = [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
        { id: "c", label: "Gamma" },
        { id: "d", label: "Delta" },
      ];
      const { container } = render(() => (
        <Breadcrumb items={items} maxItems={2} />
      ));
      const ellipsisBtn = container.querySelector("[aria-label='Show all breadcrumbs']");
      expect(ellipsisBtn).toBeTruthy();
    });

    it("expands all items when ellipsis is clicked", async () => {
      const items: BreadcrumbItem[] = [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
        { id: "c", label: "Gamma" },
        { id: "d", label: "Delta" },
      ];
      const { container, getByText } = render(() => (
        <Breadcrumb items={items} maxItems={2} />
      ));
      const ellipsisBtn = container.querySelector("[aria-label='Show all breadcrumbs']")!;
      await fireEvent.click(ellipsisBtn);
      expect(getByText("Alpha")).toBeTruthy();
      expect(getByText("Beta")).toBeTruthy();
      expect(getByText("Gamma")).toBeTruthy();
      expect(getByText("Delta")).toBeTruthy();
    });
  });

  describe("click handlers", () => {
    it("calls onClick for non-last items", async () => {
      const onClick = vi.fn();
      const items: BreadcrumbItem[] = [
        { id: "home", label: "Home", onClick },
        { id: "current", label: "Current" },
      ];
      const { getByText } = render(() => <Breadcrumb items={items} />);
      await fireEvent.click(getByText("Home"));
      expect(onClick).toHaveBeenCalled();
    });

    it("does not call onClick for last item", async () => {
      const onClick = vi.fn();
      const items: BreadcrumbItem[] = [
        { id: "home", label: "Home" },
        { id: "current", label: "Current", onClick },
      ];
      const { getByText } = render(() => <Breadcrumb items={items} />);
      await fireEvent.click(getByText("Current"));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("last item", () => {
    it("marks last item with aria-current page", () => {
      const { container } = render(() => <Breadcrumb items={simpleItems} />);
      const currentItems = container.querySelectorAll("[aria-current='page']");
      expect(currentItems.length).toBe(1);
    });
  });

  describe("link items", () => {
    it("renders anchor element for items with href", () => {
      const items: BreadcrumbItem[] = [
        { id: "home", label: "Home", href: "/home" },
        { id: "current", label: "Current" },
      ];
      const { container } = render(() => <Breadcrumb items={items} />);
      const link = container.querySelector("a");
      expect(link).toBeTruthy();
      expect(link?.getAttribute("href")).toBe("/home");
    });

    it("does not render anchor for last item even with href", () => {
      const items: BreadcrumbItem[] = [
        { id: "current", label: "Current", href: "/current" },
      ];
      const { container } = render(() => <Breadcrumb items={items} />);
      const link = container.querySelector("a");
      expect(link).toBeNull();
    });
  });

  describe("custom styles", () => {
    it("merges custom style prop", () => {
      const { container } = render(() => (
        <Breadcrumb items={simpleItems} style={{ "padding-left": "8px" }} />
      ));
      const nav = container.querySelector("nav") as HTMLElement;
      expect(nav.style.paddingLeft).toBe("8px");
    });
  });
});
