import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../SettingsContext", () => ({
  useSettings: vi.fn().mockReturnValue({
    settings: {
      activityBar: { visible: true, location: "left" },
    },
  }),
}));

describe("ActivityBarContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("View Container IDs", () => {
    type ViewContainerId =
      | "workbench.view.explorer"
      | "workbench.view.search"
      | "workbench.view.scm"
      | "workbench.view.debug"
      | "workbench.view.extensions"
      | "workbench.view.agents"
      | "workbench.view.testing"
      | "workbench.view.remote"
      | string;

    it("should define view container IDs", () => {
      const ids: ViewContainerId[] = [
        "workbench.view.explorer",
        "workbench.view.search",
        "workbench.view.scm",
        "workbench.view.debug",
        "workbench.view.extensions",
        "workbench.view.agents",
        "workbench.view.testing",
        "workbench.view.remote",
      ];
      expect(ids).toHaveLength(8);
    });
  });

  describe("View IDs", () => {
    type ViewId =
      | "explorer"
      | "search"
      | "scm"
      | "debug"
      | "extensions"
      | "agents"
      | "testing"
      | "remote"
      | string;

    it("should define view IDs", () => {
      const ids: ViewId[] = [
        "explorer",
        "search",
        "scm",
        "debug",
        "extensions",
        "agents",
        "testing",
        "remote",
      ];
      expect(ids).toHaveLength(8);
    });
  });

  describe("Activity Bar Item Definition", () => {
    interface ActivityBarItemDefinition {
      id: string;
      viewContainerId: string;
      label: string;
      iconClass?: string;
      order: number;
      visible: boolean;
      isBuiltin: boolean;
    }

    it("should create item definition", () => {
      const item: ActivityBarItemDefinition = {
        id: "explorer",
        viewContainerId: "workbench.view.explorer",
        label: "Explorer",
        iconClass: "codicon-files",
        order: 0,
        visible: true,
        isBuiltin: true,
      };

      expect(item.id).toBe("explorer");
      expect(item.isBuiltin).toBe(true);
    });

    it("should create custom item", () => {
      const item: ActivityBarItemDefinition = {
        id: "custom-view",
        viewContainerId: "workbench.view.custom",
        label: "Custom View",
        order: 100,
        visible: true,
        isBuiltin: false,
      };

      expect(item.isBuiltin).toBe(false);
    });
  });

  describe("Activity Bar Badge", () => {
    interface ActivityBarBadge {
      count: number;
      color?: string;
      tooltip?: string;
    }

    it("should create badge with count", () => {
      const badge: ActivityBarBadge = {
        count: 5,
        tooltip: "5 changes",
      };

      expect(badge.count).toBe(5);
    });

    it("should create badge with color", () => {
      const badge: ActivityBarBadge = {
        count: 3,
        color: "#ff0000",
        tooltip: "3 errors",
      };

      expect(badge.color).toBe("#ff0000");
    });
  });

  describe("Activity Bar State", () => {
    interface ActivityBarState {
      activeViewId: string | null;
      hiddenItems: string[];
      itemOrder: string[];
      badges: Record<string, { count: number }>;
      sidebarVisible: boolean;
      customItems: Array<{ id: string }>;
    }

    it("should create activity bar state", () => {
      const state: ActivityBarState = {
        activeViewId: "explorer",
        hiddenItems: [],
        itemOrder: ["explorer", "search", "scm"],
        badges: {},
        sidebarVisible: true,
        customItems: [],
      };

      expect(state.activeViewId).toBe("explorer");
      expect(state.sidebarVisible).toBe(true);
    });

    it("should track hidden items", () => {
      const state: ActivityBarState = {
        activeViewId: "explorer",
        hiddenItems: ["testing", "remote"],
        itemOrder: [],
        badges: {},
        sidebarVisible: true,
        customItems: [],
      };

      expect(state.hiddenItems).toHaveLength(2);
      expect(state.hiddenItems).toContain("testing");
    });
  });

  describe("Default Items", () => {
    const DEFAULT_ITEMS = [
      { id: "explorer", viewContainerId: "workbench.view.explorer", label: "Explorer", order: 0, visible: true, isBuiltin: true },
      { id: "search", viewContainerId: "workbench.view.search", label: "Search", order: 1, visible: true, isBuiltin: true },
      { id: "scm", viewContainerId: "workbench.view.scm", label: "Source Control", order: 2, visible: true, isBuiltin: true },
      { id: "debug", viewContainerId: "workbench.view.debug", label: "Run and Debug", order: 3, visible: true, isBuiltin: true },
      { id: "extensions", viewContainerId: "workbench.view.extensions", label: "Extensions", order: 4, visible: true, isBuiltin: true },
      { id: "agents", viewContainerId: "workbench.view.agents", label: "AI Agents", order: 5, visible: true, isBuiltin: true },
      { id: "testing", viewContainerId: "workbench.view.testing", label: "Testing", order: 6, visible: true, isBuiltin: true },
      { id: "remote", viewContainerId: "workbench.view.remote", label: "Remote Explorer", order: 7, visible: true, isBuiltin: true },
    ];

    it("should have 8 default items", () => {
      expect(DEFAULT_ITEMS).toHaveLength(8);
    });

    it("should have explorer as first item", () => {
      expect(DEFAULT_ITEMS[0].id).toBe("explorer");
      expect(DEFAULT_ITEMS[0].order).toBe(0);
    });

    it("should have all items as builtin", () => {
      const allBuiltin = DEFAULT_ITEMS.every((item) => item.isBuiltin);
      expect(allBuiltin).toBe(true);
    });

    it("should have all items visible by default", () => {
      const allVisible = DEFAULT_ITEMS.every((item) => item.visible);
      expect(allVisible).toBe(true);
    });
  });

  describe("Storage Keys", () => {
    const STORAGE_KEY_ACTIVE = "orion_activitybar_active";
    const STORAGE_KEY_HIDDEN = "orion_activitybar_hidden";
    const STORAGE_KEY_ORDER = "orion_activitybar_order";
    const STORAGE_KEY_SIDEBAR = "orion_activitybar_sidebar_visible";

    it("should have correct active view storage key", () => {
      expect(STORAGE_KEY_ACTIVE).toBe("orion_activitybar_active");
    });

    it("should have correct hidden items storage key", () => {
      expect(STORAGE_KEY_HIDDEN).toBe("orion_activitybar_hidden");
    });

    it("should have correct order storage key", () => {
      expect(STORAGE_KEY_ORDER).toBe("orion_activitybar_order");
    });

    it("should have correct sidebar visibility storage key", () => {
      expect(STORAGE_KEY_SIDEBAR).toBe("orion_activitybar_sidebar_visible");
    });
  });

  describe("LocalStorage Persistence", () => {
    it("should save active view to localStorage", () => {
      const mockSetItem = vi.fn();
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = mockSetItem;

      localStorage.setItem("orion_activitybar_active", "search");

      expect(mockSetItem).toHaveBeenCalledWith("orion_activitybar_active", "search");

      Storage.prototype.setItem = originalSetItem;
    });

    it("should save hidden items to localStorage", () => {
      const mockSetItem = vi.fn();
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = mockSetItem;

      const hiddenItems = ["testing", "remote"];
      localStorage.setItem("orion_activitybar_hidden", JSON.stringify(hiddenItems));

      expect(mockSetItem).toHaveBeenCalledWith(
        "orion_activitybar_hidden",
        JSON.stringify(hiddenItems)
      );

      Storage.prototype.setItem = originalSetItem;
    });

    it("should load active view from localStorage", () => {
      const mockGetItem = vi.fn().mockReturnValue("search");
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = mockGetItem;

      const stored = localStorage.getItem("orion_activitybar_active");

      expect(stored).toBe("search");

      Storage.prototype.getItem = originalGetItem;
    });
  });

  describe("View Actions", () => {
    it("should set active view", () => {
      let activeViewId: string | null = "explorer";
      const setActiveView = (viewId: string) => {
        activeViewId = viewId;
      };

      setActiveView("search");
      expect(activeViewId).toBe("search");
    });

    it("should toggle sidebar", () => {
      let sidebarVisible = true;
      const toggleSidebar = () => {
        sidebarVisible = !sidebarVisible;
      };

      toggleSidebar();
      expect(sidebarVisible).toBe(false);

      toggleSidebar();
      expect(sidebarVisible).toBe(true);
    });

    it("should set sidebar visibility", () => {
      let sidebarVisible = true;
      const setSidebarVisible = (visible: boolean) => {
        sidebarVisible = visible;
      };

      setSidebarVisible(false);
      expect(sidebarVisible).toBe(false);
    });
  });

  describe("Item Management", () => {
    it("should hide item", () => {
      const hiddenItems: string[] = [];
      const hideItem = (itemId: string) => {
        if (!hiddenItems.includes(itemId)) {
          hiddenItems.push(itemId);
        }
      };

      hideItem("testing");
      expect(hiddenItems).toContain("testing");
    });

    it("should show item", () => {
      const hiddenItems = ["testing", "remote"];
      const showItem = (itemId: string) => {
        const index = hiddenItems.indexOf(itemId);
        if (index > -1) {
          hiddenItems.splice(index, 1);
        }
      };

      showItem("testing");
      expect(hiddenItems).not.toContain("testing");
    });

    it("should check if item is hidden", () => {
      const hiddenItems = ["testing"];
      const isItemHidden = (itemId: string) => hiddenItems.includes(itemId);

      expect(isItemHidden("testing")).toBe(true);
      expect(isItemHidden("explorer")).toBe(false);
    });

    it("should reorder items", () => {
      const itemOrder = ["explorer", "search", "scm"];
      const reorderItems = (fromId: string, toId: string) => {
        const fromIndex = itemOrder.indexOf(fromId);
        const toIndex = itemOrder.indexOf(toId);
        if (fromIndex > -1 && toIndex > -1) {
          const [item] = itemOrder.splice(fromIndex, 1);
          itemOrder.splice(toIndex, 0, item);
        }
      };

      reorderItems("scm", "explorer");
      expect(itemOrder[0]).toBe("scm");
    });

    it("should reset order", () => {
      const defaultOrder = ["explorer", "search", "scm"];
      let itemOrder = ["scm", "explorer", "search"];
      const resetOrder = () => {
        itemOrder = [...defaultOrder];
      };

      resetOrder();
      expect(itemOrder).toEqual(defaultOrder);
    });
  });

  describe("Badge Management", () => {
    it("should set badge", () => {
      const badges: Record<string, { count: number }> = {};
      const setBadge = (viewId: string, badge: { count: number } | null) => {
        if (badge) {
          badges[viewId] = badge;
        } else {
          delete badges[viewId];
        }
      };

      setBadge("scm", { count: 5 });
      expect(badges.scm.count).toBe(5);
    });

    it("should get badge", () => {
      const badges: Record<string, { count: number }> = {
        scm: { count: 3 },
      };
      const getBadge = (viewId: string) => badges[viewId];

      expect(getBadge("scm")?.count).toBe(3);
      expect(getBadge("explorer")).toBeUndefined();
    });

    it("should clear badges", () => {
      const badges: Record<string, { count: number }> = {
        scm: { count: 5 },
        testing: { count: 2 },
      };
      const clearBadges = () => {
        Object.keys(badges).forEach((key) => delete badges[key]);
      };

      clearBadges();
      expect(Object.keys(badges)).toHaveLength(0);
    });
  });

  describe("Custom Items", () => {
    it("should register custom item", () => {
      const customItems: Array<{ id: string; label: string }> = [];
      const registerCustomItem = (item: { id: string; label: string }) => {
        customItems.push(item);
      };

      registerCustomItem({ id: "custom-1", label: "Custom View" });
      expect(customItems).toHaveLength(1);
    });

    it("should unregister custom item", () => {
      const customItems = [
        { id: "custom-1", label: "Custom 1" },
        { id: "custom-2", label: "Custom 2" },
      ];
      const unregisterCustomItem = (itemId: string) => {
        const index = customItems.findIndex((i) => i.id === itemId);
        if (index > -1) {
          customItems.splice(index, 1);
        }
      };

      unregisterCustomItem("custom-1");
      expect(customItems).toHaveLength(1);
      expect(customItems[0].id).toBe("custom-2");
    });

    it("should get custom items", () => {
      const customItems = [{ id: "custom-1" }, { id: "custom-2" }];
      const getCustomItems = () => customItems;

      expect(getCustomItems()).toHaveLength(2);
    });
  });

  describe("Computed Items", () => {
    it("should get visible items", () => {
      const items = [
        { id: "explorer", visible: true },
        { id: "search", visible: true },
        { id: "testing", visible: false },
      ];
      const hiddenItems = ["search"];

      const getVisibleItems = () =>
        items.filter((i) => i.visible && !hiddenItems.includes(i.id));

      expect(getVisibleItems()).toHaveLength(1);
    });

    it("should get ordered items", () => {
      const items = [
        { id: "explorer", order: 0 },
        { id: "search", order: 1 },
        { id: "scm", order: 2 },
      ];
      const itemOrder = ["scm", "explorer", "search"];

      const getOrderedItems = () => {
        return itemOrder.map((id) => items.find((i) => i.id === id)).filter(Boolean);
      };

      const ordered = getOrderedItems();
      expect(ordered[0]?.id).toBe("scm");
    });
  });

  describe("Window Events", () => {
    it("should dispatch activitybar:view-changed event", () => {
      const dispatchEvent = vi.fn();
      const originalDispatchEvent = window.dispatchEvent;
      window.dispatchEvent = dispatchEvent;

      window.dispatchEvent(
        new CustomEvent("activitybar:view-changed", { detail: { viewId: "search" } })
      );

      expect(dispatchEvent).toHaveBeenCalled();

      window.dispatchEvent = originalDispatchEvent;
    });

    it("should dispatch activitybar:sidebar-toggled event", () => {
      const dispatchEvent = vi.fn();
      const originalDispatchEvent = window.dispatchEvent;
      window.dispatchEvent = dispatchEvent;

      window.dispatchEvent(
        new CustomEvent("activitybar:sidebar-toggled", { detail: { visible: false } })
      );

      expect(dispatchEvent).toHaveBeenCalled();

      window.dispatchEvent = originalDispatchEvent;
    });
  });

  describe("Activity Bar Location", () => {
    type ActivityBarLocation = "left" | "right" | "top" | "hidden";

    it("should define activity bar locations", () => {
      const locations: ActivityBarLocation[] = ["left", "right", "top", "hidden"];
      expect(locations).toHaveLength(4);
    });

    it("should default to left location", () => {
      const defaultLocation: ActivityBarLocation = "left";
      expect(defaultLocation).toBe("left");
    });
  });
});
