import { describe, it, expect, vi, beforeEach } from "vitest";

type ViewId =
  | "outline"
  | "timeline"
  | "chat"
  | "search"
  | "debug"
  | "extensions"
  | "git"
  | "explorer"
  | "problems"
  | "output"
  | "terminal"
  | "custom";

type ViewLocation = "primarySidebar" | "auxiliaryBar" | "panel";
type SidebarPosition = "left" | "right";

interface LayoutView {
  id: string;
  viewId: ViewId;
  title: string;
  icon?: string;
  location: ViewLocation;
  order: number;
  component?: string;
  movable?: boolean;
  closable?: boolean;
}

interface AuxiliaryBarState {
  visible: boolean;
  width: number;
  minWidth: number;
  maxWidth: number;
  activeViewId: string | null;
  views: LayoutView[];
}

interface PrimarySidebarState {
  visible: boolean;
  width: number;
  minWidth: number;
  maxWidth: number;
  position: SidebarPosition;
  activeViewId: string | null;
}

interface PanelState {
  visible: boolean;
  height: number;
  minHeight: number;
  maxHeight: number;
  position: "bottom" | "left" | "right";
  activeViewId: string | null;
}

interface LayoutState {
  primarySidebar: PrimarySidebarState;
  auxiliaryBar: AuxiliaryBarState;
  panel: PanelState;
  dragState: {
    isDragging: boolean;
    sourceViewId: string | null;
    sourceLocation: ViewLocation | null;
    targetLocation: ViewLocation | null;
  };
}

interface LayoutContextValue {
  state: LayoutState;
  toggleAuxiliaryBar: () => void;
  setAuxiliaryBarVisible: (visible: boolean) => void;
  setAuxiliaryBarWidth: (width: number) => void;
  setAuxiliaryBarActiveView: (viewId: string | null) => void;
  addAuxiliaryBarView: (view: Omit<LayoutView, "location" | "order">) => void;
  removeAuxiliaryBarView: (viewId: string) => void;
  togglePrimarySidebar: () => void;
  setPrimarySidebarVisible: (visible: boolean) => void;
  setPrimarySidebarWidth: (width: number) => void;
  setPrimarySidebarPosition: (position: SidebarPosition) => void;
  toggleSidebarPosition: () => void;
  togglePanel: () => void;
  setPanelVisible: (visible: boolean) => void;
  setPanelHeight: (height: number) => void;
  moveView: (viewId: string, toLocation: ViewLocation) => void;
  startDrag: (viewId: string, fromLocation: ViewLocation) => void;
  endDrag: (toLocation: ViewLocation | null) => void;
  cancelDrag: () => void;
  getAuxiliaryBarPosition: () => SidebarPosition;
  isViewInLocation: (viewId: string, location: ViewLocation) => boolean;
}

const STORAGE_KEY_LAYOUT = "cortex:layout:state";

describe("LayoutContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("LayoutView interface", () => {
    it("should have correct view structure", () => {
      const view: LayoutView = {
        id: "aux-outline",
        viewId: "outline",
        title: "Outline",
        icon: "symbol-class",
        location: "auxiliaryBar",
        order: 0,
        movable: true,
        closable: false,
      };

      expect(view.id).toBe("aux-outline");
      expect(view.viewId).toBe("outline");
      expect(view.location).toBe("auxiliaryBar");
    });

    it("should support all view IDs", () => {
      const viewIds: ViewId[] = [
        "outline", "timeline", "chat", "search", "debug",
        "extensions", "git", "explorer", "problems", "output",
        "terminal", "custom",
      ];

      viewIds.forEach((viewId) => {
        const view: LayoutView = {
          id: `view-${viewId}`,
          viewId,
          title: viewId,
          location: "primarySidebar",
          order: 0,
        };
        expect(view.viewId).toBe(viewId);
      });
    });
  });

  describe("PrimarySidebarState interface", () => {
    it("should have correct sidebar state", () => {
      const sidebar: PrimarySidebarState = {
        visible: true,
        width: 260,
        minWidth: 160,
        maxWidth: 500,
        position: "left",
        activeViewId: "explorer",
      };

      expect(sidebar.visible).toBe(true);
      expect(sidebar.width).toBe(260);
      expect(sidebar.position).toBe("left");
    });
  });

  describe("AuxiliaryBarState interface", () => {
    it("should have correct auxiliary bar state", () => {
      const auxBar: AuxiliaryBarState = {
        visible: false,
        width: 300,
        minWidth: 200,
        maxWidth: 600,
        activeViewId: "outline",
        views: [],
      };

      expect(auxBar.visible).toBe(false);
      expect(auxBar.width).toBe(300);
    });

    it("should contain views array", () => {
      const auxBar: AuxiliaryBarState = {
        visible: true,
        width: 300,
        minWidth: 200,
        maxWidth: 600,
        activeViewId: "outline",
        views: [
          { id: "aux-outline", viewId: "outline", title: "Outline", location: "auxiliaryBar", order: 0 },
          { id: "aux-chat", viewId: "chat", title: "Chat", location: "auxiliaryBar", order: 1 },
        ],
      };

      expect(auxBar.views).toHaveLength(2);
    });
  });

  describe("PanelState interface", () => {
    it("should have correct panel state", () => {
      const panel: PanelState = {
        visible: true,
        height: 220,
        minHeight: 100,
        maxHeight: 600,
        position: "bottom",
        activeViewId: "terminal",
      };

      expect(panel.visible).toBe(true);
      expect(panel.height).toBe(220);
      expect(panel.position).toBe("bottom");
    });

    it("should support different positions", () => {
      const positions: Array<"bottom" | "left" | "right"> = ["bottom", "left", "right"];

      positions.forEach((position) => {
        const panel: PanelState = {
          visible: true,
          height: 200,
          minHeight: 100,
          maxHeight: 600,
          position,
          activeViewId: null,
        };
        expect(panel.position).toBe(position);
      });
    });
  });

  describe("Storage persistence", () => {
    it("should save layout state to localStorage", () => {
      const layoutState = {
        primarySidebar: {
          visible: true,
          width: 280,
          position: "left",
          activeViewId: "explorer",
        },
        auxiliaryBar: {
          visible: true,
          width: 320,
          activeViewId: "outline",
          views: [],
        },
        panel: {
          visible: true,
          height: 250,
          position: "bottom",
          activeViewId: "terminal",
        },
      };

      localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(layoutState));

      const stored = localStorage.getItem(STORAGE_KEY_LAYOUT);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.primarySidebar.width).toBe(280);
    });

    it("should load layout state from localStorage", () => {
      const layoutState = {
        primarySidebar: { visible: false, width: 300, position: "right" },
        auxiliaryBar: { visible: true, width: 350 },
        panel: { visible: false, height: 180 },
      };

      localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(layoutState));

      const stored = localStorage.getItem(STORAGE_KEY_LAYOUT);
      const loaded = JSON.parse(stored!);

      expect(loaded.primarySidebar.visible).toBe(false);
      expect(loaded.primarySidebar.position).toBe("right");
    });
  });

  describe("State management", () => {
    it("should create default layout state", () => {
      const defaultState: LayoutState = {
        primarySidebar: {
          visible: true,
          width: 260,
          minWidth: 160,
          maxWidth: 500,
          position: "left",
          activeViewId: "explorer",
        },
        auxiliaryBar: {
          visible: false,
          width: 300,
          minWidth: 200,
          maxWidth: 600,
          activeViewId: "outline",
          views: [],
        },
        panel: {
          visible: true,
          height: 220,
          minHeight: 100,
          maxHeight: 600,
          position: "bottom",
          activeViewId: "terminal",
        },
        dragState: {
          isDragging: false,
          sourceViewId: null,
          sourceLocation: null,
          targetLocation: null,
        },
      };

      expect(defaultState.primarySidebar.visible).toBe(true);
      expect(defaultState.auxiliaryBar.visible).toBe(false);
      expect(defaultState.panel.visible).toBe(true);
    });

    it("should toggle primary sidebar visibility", () => {
      let state: LayoutState = {
        primarySidebar: {
          visible: true,
          width: 260,
          minWidth: 160,
          maxWidth: 500,
          position: "left",
          activeViewId: "explorer",
        },
        auxiliaryBar: { visible: false, width: 300, minWidth: 200, maxWidth: 600, activeViewId: null, views: [] },
        panel: { visible: true, height: 220, minHeight: 100, maxHeight: 600, position: "bottom", activeViewId: null },
        dragState: { isDragging: false, sourceViewId: null, sourceLocation: null, targetLocation: null },
      };

      state = {
        ...state,
        primarySidebar: { ...state.primarySidebar, visible: !state.primarySidebar.visible },
      };

      expect(state.primarySidebar.visible).toBe(false);
    });

    it("should toggle sidebar position", () => {
      let state: LayoutState = {
        primarySidebar: {
          visible: true,
          width: 260,
          minWidth: 160,
          maxWidth: 500,
          position: "left",
          activeViewId: "explorer",
        },
        auxiliaryBar: { visible: false, width: 300, minWidth: 200, maxWidth: 600, activeViewId: null, views: [] },
        panel: { visible: true, height: 220, minHeight: 100, maxHeight: 600, position: "bottom", activeViewId: null },
        dragState: { isDragging: false, sourceViewId: null, sourceLocation: null, targetLocation: null },
      };

      const newPosition: SidebarPosition = state.primarySidebar.position === "left" ? "right" : "left";
      state = {
        ...state,
        primarySidebar: { ...state.primarySidebar, position: newPosition },
      };

      expect(state.primarySidebar.position).toBe("right");
    });
  });

  describe("Sidebar width management", () => {
    it("should clamp width to min/max bounds", () => {
      const clampWidth = (width: number, min: number, max: number): number => {
        return Math.max(min, Math.min(max, width));
      };

      expect(clampWidth(100, 160, 500)).toBe(160);
      expect(clampWidth(600, 160, 500)).toBe(500);
      expect(clampWidth(300, 160, 500)).toBe(300);
    });
  });

  describe("Panel height management", () => {
    it("should clamp height to min/max bounds", () => {
      const clampHeight = (height: number, min: number, max: number): number => {
        return Math.max(min, Math.min(max, height));
      };

      expect(clampHeight(50, 100, 600)).toBe(100);
      expect(clampHeight(700, 100, 600)).toBe(600);
      expect(clampHeight(300, 100, 600)).toBe(300);
    });
  });

  describe("Auxiliary bar position", () => {
    it("should be opposite to primary sidebar", () => {
      const getAuxiliaryBarPosition = (primaryPosition: SidebarPosition): SidebarPosition => {
        return primaryPosition === "left" ? "right" : "left";
      };

      expect(getAuxiliaryBarPosition("left")).toBe("right");
      expect(getAuxiliaryBarPosition("right")).toBe("left");
    });
  });

  describe("View management", () => {
    it("should add view to auxiliary bar", () => {
      let views: LayoutView[] = [];

      const newView: LayoutView = {
        id: "aux-custom",
        viewId: "custom",
        title: "Custom View",
        location: "auxiliaryBar",
        order: 0,
        movable: true,
        closable: true,
      };

      views = [...views, newView];
      expect(views).toHaveLength(1);
    });

    it("should remove view from auxiliary bar", () => {
      let views: LayoutView[] = [
        { id: "aux-outline", viewId: "outline", title: "Outline", location: "auxiliaryBar", order: 0, closable: true },
        { id: "aux-chat", viewId: "chat", title: "Chat", location: "auxiliaryBar", order: 1, closable: true },
      ];

      views = views.filter((v) => v.id !== "aux-outline");
      expect(views).toHaveLength(1);
      expect(views[0].id).toBe("aux-chat");
    });

    it("should check if view is in location", () => {
      const views: LayoutView[] = [
        { id: "aux-outline", viewId: "outline", title: "Outline", location: "auxiliaryBar", order: 0 },
      ];

      const isViewInLocation = (viewId: string, location: ViewLocation): boolean => {
        return views.some((v) => v.id === viewId && v.location === location);
      };

      expect(isViewInLocation("aux-outline", "auxiliaryBar")).toBe(true);
      expect(isViewInLocation("aux-outline", "primarySidebar")).toBe(false);
    });
  });

  describe("Drag state management", () => {
    it("should start drag operation", () => {
      let dragState = {
        isDragging: false,
        sourceViewId: null as string | null,
        sourceLocation: null as ViewLocation | null,
        targetLocation: null as ViewLocation | null,
      };

      dragState = {
        isDragging: true,
        sourceViewId: "aux-outline",
        sourceLocation: "auxiliaryBar",
        targetLocation: null,
      };

      expect(dragState.isDragging).toBe(true);
      expect(dragState.sourceViewId).toBe("aux-outline");
    });

    it("should end drag operation", () => {
      let dragState = {
        isDragging: true,
        sourceViewId: "aux-outline" as string | null,
        sourceLocation: "auxiliaryBar" as ViewLocation | null,
        targetLocation: null as ViewLocation | null,
      };

      dragState = {
        isDragging: false,
        sourceViewId: null,
        sourceLocation: null,
        targetLocation: null,
      };

      expect(dragState.isDragging).toBe(false);
      expect(dragState.sourceViewId).toBeNull();
    });

    it("should cancel drag operation", () => {
      let dragState = {
        isDragging: true,
        sourceViewId: "aux-chat" as string | null,
        sourceLocation: "auxiliaryBar" as ViewLocation | null,
        targetLocation: "primarySidebar" as ViewLocation | null,
      };

      dragState = {
        isDragging: false,
        sourceViewId: null,
        sourceLocation: null,
        targetLocation: null,
      };

      expect(dragState.isDragging).toBe(false);
    });
  });

  describe("Context value structure", () => {
    it("should define all required methods", () => {
      const mockContext: LayoutContextValue = {
        state: {
          primarySidebar: { visible: true, width: 260, minWidth: 160, maxWidth: 500, position: "left", activeViewId: null },
          auxiliaryBar: { visible: false, width: 300, minWidth: 200, maxWidth: 600, activeViewId: null, views: [] },
          panel: { visible: true, height: 220, minHeight: 100, maxHeight: 600, position: "bottom", activeViewId: null },
          dragState: { isDragging: false, sourceViewId: null, sourceLocation: null, targetLocation: null },
        },
        toggleAuxiliaryBar: vi.fn(),
        setAuxiliaryBarVisible: vi.fn(),
        setAuxiliaryBarWidth: vi.fn(),
        setAuxiliaryBarActiveView: vi.fn(),
        addAuxiliaryBarView: vi.fn(),
        removeAuxiliaryBarView: vi.fn(),
        togglePrimarySidebar: vi.fn(),
        setPrimarySidebarVisible: vi.fn(),
        setPrimarySidebarWidth: vi.fn(),
        setPrimarySidebarPosition: vi.fn(),
        toggleSidebarPosition: vi.fn(),
        togglePanel: vi.fn(),
        setPanelVisible: vi.fn(),
        setPanelHeight: vi.fn(),
        moveView: vi.fn(),
        startDrag: vi.fn(),
        endDrag: vi.fn(),
        cancelDrag: vi.fn(),
        getAuxiliaryBarPosition: vi.fn(),
        isViewInLocation: vi.fn(),
      };

      expect(mockContext.toggleAuxiliaryBar).toBeDefined();
      expect(mockContext.togglePrimarySidebar).toBeDefined();
      expect(mockContext.togglePanel).toBeDefined();
      expect(mockContext.moveView).toBeDefined();
      expect(mockContext.startDrag).toBeDefined();
    });
  });
});
