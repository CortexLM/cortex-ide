import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "solid-js";

vi.mock("@/context/QuickAccessContext", () => ({
  useQuickAccess: () => ({
    show: vi.fn(),
    hide: vi.fn(),
    isVisible: () => false,
    registerProvider: vi.fn(),
    providers: new Map(),
    pinnedItems: [],
    pinItem: vi.fn(),
    unpinItem: vi.fn(),
    isPinned: vi.fn().mockReturnValue(false),
    getHistory: vi.fn().mockReturnValue([]),
    clearHistory: vi.fn(),
  }),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    return el;
  },
}));

describe("QuickAccessWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export QuickAccessWidget component", async () => {
    const { QuickAccessWidget } = await import("../QuickAccessWidget");
    expect(QuickAccessWidget).toBeDefined();
    expect(typeof QuickAccessWidget).toBe("function");
  });

  it("should render without crashing", async () => {
    const { QuickAccessWidget } = await import("../QuickAccessWidget");
    
    createRoot((dispose) => {
      const element = QuickAccessWidget({});
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should accept initialPrefix prop", async () => {
    const { QuickAccessWidget } = await import("../QuickAccessWidget");
    
    createRoot((dispose) => {
      const element = QuickAccessWidget({ initialPrefix: ">" });
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should accept showShortcut prop", async () => {
    const { QuickAccessWidget } = await import("../QuickAccessWidget");
    
    createRoot((dispose) => {
      const element = QuickAccessWidget({ showShortcut: false });
      expect(element).toBeDefined();
      dispose();
    });
  });
});

describe("QuickAccessItem", () => {
  it("should export QuickAccessItem component", async () => {
    const { QuickAccessItem } = await import("../QuickAccessItem");
    expect(QuickAccessItem).toBeDefined();
    expect(typeof QuickAccessItem).toBe("function");
  });

  it("should render an item", async () => {
    const { QuickAccessItem } = await import("../QuickAccessItem");
    
    createRoot((dispose) => {
      const element = QuickAccessItem({
        item: {
          id: "1",
          label: "Test Item",
          description: "A test item",
        },
        isSelected: false,
      });
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should handle selection state", async () => {
    const { QuickAccessItem } = await import("../QuickAccessItem");
    
    createRoot((dispose) => {
      const element = QuickAccessItem({
        item: {
          id: "1",
          label: "Selected Item",
          matches: [0, 1, 2],
        },
        isSelected: true,
        isPinned: true,
      });
      expect(element).toBeDefined();
      dispose();
    });
  });
});
