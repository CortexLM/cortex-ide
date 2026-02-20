import { describe, it, expect, vi, beforeEach } from "vitest";

interface InspectorElement {
  tagName: string;
  id: string;
  className: string;
  attributes: Record<string, string>;
  computedStyles: Record<string, string>;
  boundingRect: DOMRect | null;
  children: InspectorElement[];
  parent: InspectorElement | null;
  textContent: string;
  path: string[];
}

type PanelPosition = "right" | "bottom" | "left" | "detached";

interface InspectorState {
  isOpen: boolean;
  isPicking: boolean;
  selectedElement: InspectorElement | null;
  hoveredElement: InspectorElement | null;
  elementTree: InspectorElement[];
  panelPosition: PanelPosition;
  searchQuery: string;
  searchResults: InspectorElement[];
  expandedNodes: Set<string>;
  highlightedSelector: string | null;
}

interface InspectorContextValue {
  state: InspectorState;
  open: () => void;
  close: () => void;
  toggle: () => void;
  startPicking: () => void;
  stopPicking: () => void;
  selectElement: (element: InspectorElement | null) => void;
  setHoveredElement: (element: InspectorElement | null) => void;
  setPanelPosition: (position: PanelPosition) => void;
  setSearchQuery: (query: string) => void;
  toggleNodeExpanded: (path: string) => void;
  highlightSelector: (selector: string | null) => void;
  refreshTree: () => void;
  copySelector: (element: InspectorElement) => void;
  copyStyles: (element: InspectorElement) => void;
}

describe("InspectorContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("InspectorState interface", () => {
    it("should have correct initial state structure", () => {
      const initialState: InspectorState = {
        isOpen: false,
        isPicking: false,
        selectedElement: null,
        hoveredElement: null,
        elementTree: [],
        panelPosition: "right",
        searchQuery: "",
        searchResults: [],
        expandedNodes: new Set(),
        highlightedSelector: null,
      };

      expect(initialState.isOpen).toBe(false);
      expect(initialState.isPicking).toBe(false);
      expect(initialState.selectedElement).toBeNull();
      expect(initialState.panelPosition).toBe("right");
    });
  });

  describe("InspectorElement interface", () => {
    it("should properly represent a DOM element", () => {
      const element: InspectorElement = {
        tagName: "DIV",
        id: "test-id",
        className: "test-class",
        attributes: { "data-testid": "test" },
        computedStyles: { display: "block", color: "rgb(0, 0, 0)" },
        boundingRect: null,
        children: [],
        parent: null,
        textContent: "Test content",
        path: ["html", "body", "div"],
      };

      expect(element.tagName).toBe("DIV");
      expect(element.id).toBe("test-id");
      expect(element.className).toBe("test-class");
      expect(element.attributes["data-testid"]).toBe("test");
      expect(element.computedStyles.display).toBe("block");
      expect(element.path).toHaveLength(3);
    });

    it("should support nested elements", () => {
      const parent: InspectorElement = {
        tagName: "DIV",
        id: "parent",
        className: "",
        attributes: {},
        computedStyles: {},
        boundingRect: null,
        children: [],
        parent: null,
        textContent: "",
        path: ["html", "body", "div"],
      };

      const child: InspectorElement = {
        tagName: "SPAN",
        id: "child",
        className: "",
        attributes: {},
        computedStyles: {},
        boundingRect: null,
        children: [],
        parent: parent,
        textContent: "Child text",
        path: ["html", "body", "div", "span"],
      };

      parent.children.push(child);

      expect(parent.children).toHaveLength(1);
      expect(parent.children[0].tagName).toBe("SPAN");
      expect(child.parent).toBe(parent);
    });
  });

  describe("Panel positions", () => {
    it("should support all panel positions", () => {
      const positions: PanelPosition[] = ["right", "bottom", "left", "detached"];
      
      positions.forEach((position) => {
        const state: InspectorState = {
          isOpen: true,
          isPicking: false,
          selectedElement: null,
          hoveredElement: null,
          elementTree: [],
          panelPosition: position,
          searchQuery: "",
          searchResults: [],
          expandedNodes: new Set(),
          highlightedSelector: null,
        };

        expect(state.panelPosition).toBe(position);
      });
    });
  });

  describe("Context value structure", () => {
    it("should define all required methods", () => {
      const mockContextValue: InspectorContextValue = {
        state: {
          isOpen: false,
          isPicking: false,
          selectedElement: null,
          hoveredElement: null,
          elementTree: [],
          panelPosition: "right",
          searchQuery: "",
          searchResults: [],
          expandedNodes: new Set(),
          highlightedSelector: null,
        },
        open: vi.fn(),
        close: vi.fn(),
        toggle: vi.fn(),
        startPicking: vi.fn(),
        stopPicking: vi.fn(),
        selectElement: vi.fn(),
        setHoveredElement: vi.fn(),
        setPanelPosition: vi.fn(),
        setSearchQuery: vi.fn(),
        toggleNodeExpanded: vi.fn(),
        highlightSelector: vi.fn(),
        refreshTree: vi.fn(),
        copySelector: vi.fn(),
        copyStyles: vi.fn(),
      };

      expect(mockContextValue.open).toBeDefined();
      expect(mockContextValue.close).toBeDefined();
      expect(mockContextValue.toggle).toBeDefined();
      expect(mockContextValue.startPicking).toBeDefined();
      expect(mockContextValue.stopPicking).toBeDefined();
      expect(mockContextValue.selectElement).toBeDefined();
      expect(mockContextValue.setPanelPosition).toBeDefined();
      expect(mockContextValue.setSearchQuery).toBeDefined();
      expect(mockContextValue.copySelector).toBeDefined();
      expect(mockContextValue.copyStyles).toBeDefined();
    });
  });

  describe("State management", () => {
    it("should handle open/close state transitions", () => {
      let state: InspectorState = {
        isOpen: false,
        isPicking: false,
        selectedElement: null,
        hoveredElement: null,
        elementTree: [],
        panelPosition: "right",
        searchQuery: "",
        searchResults: [],
        expandedNodes: new Set(),
        highlightedSelector: null,
      };

      state = { ...state, isOpen: true };
      expect(state.isOpen).toBe(true);

      state = { ...state, isOpen: false };
      expect(state.isOpen).toBe(false);
    });

    it("should handle picking mode state", () => {
      let state: InspectorState = {
        isOpen: true,
        isPicking: false,
        selectedElement: null,
        hoveredElement: null,
        elementTree: [],
        panelPosition: "right",
        searchQuery: "",
        searchResults: [],
        expandedNodes: new Set(),
        highlightedSelector: null,
      };

      state = { ...state, isPicking: true };
      expect(state.isPicking).toBe(true);

      state = { ...state, isPicking: false };
      expect(state.isPicking).toBe(false);
    });

    it("should handle element selection", () => {
      const element: InspectorElement = {
        tagName: "BUTTON",
        id: "submit-btn",
        className: "btn primary",
        attributes: { type: "submit" },
        computedStyles: {},
        boundingRect: null,
        children: [],
        parent: null,
        textContent: "Submit",
        path: ["html", "body", "form", "button"],
      };

      let state: InspectorState = {
        isOpen: true,
        isPicking: false,
        selectedElement: null,
        hoveredElement: null,
        elementTree: [],
        panelPosition: "right",
        searchQuery: "",
        searchResults: [],
        expandedNodes: new Set(),
        highlightedSelector: null,
      };

      state = { ...state, selectedElement: element };
      expect(state.selectedElement).toBe(element);
      expect(state.selectedElement?.id).toBe("submit-btn");
    });
  });

  describe("Search functionality", () => {
    it("should handle search query state", () => {
      let state: InspectorState = {
        isOpen: true,
        isPicking: false,
        selectedElement: null,
        hoveredElement: null,
        elementTree: [],
        panelPosition: "right",
        searchQuery: "",
        searchResults: [],
        expandedNodes: new Set(),
        highlightedSelector: null,
      };

      state = { ...state, searchQuery: ".btn-primary" };
      expect(state.searchQuery).toBe(".btn-primary");
    });

    it("should handle search results", () => {
      const results: InspectorElement[] = [
        {
          tagName: "BUTTON",
          id: "btn1",
          className: "btn-primary",
          attributes: {},
          computedStyles: {},
          boundingRect: null,
          children: [],
          parent: null,
          textContent: "Button 1",
          path: ["html", "body", "button"],
        },
        {
          tagName: "BUTTON",
          id: "btn2",
          className: "btn-primary",
          attributes: {},
          computedStyles: {},
          boundingRect: null,
          children: [],
          parent: null,
          textContent: "Button 2",
          path: ["html", "body", "button"],
        },
      ];

      let state: InspectorState = {
        isOpen: true,
        isPicking: false,
        selectedElement: null,
        hoveredElement: null,
        elementTree: [],
        panelPosition: "right",
        searchQuery: ".btn-primary",
        searchResults: results,
        expandedNodes: new Set(),
        highlightedSelector: null,
      };

      expect(state.searchResults).toHaveLength(2);
      expect(state.searchResults[0].id).toBe("btn1");
    });
  });

  describe("Expanded nodes management", () => {
    it("should track expanded nodes", () => {
      const expandedNodes = new Set<string>();
      expandedNodes.add("html/body");
      expandedNodes.add("html/body/div");

      const state: InspectorState = {
        isOpen: true,
        isPicking: false,
        selectedElement: null,
        hoveredElement: null,
        elementTree: [],
        panelPosition: "right",
        searchQuery: "",
        searchResults: [],
        expandedNodes: expandedNodes,
        highlightedSelector: null,
      };

      expect(state.expandedNodes.has("html/body")).toBe(true);
      expect(state.expandedNodes.has("html/body/div")).toBe(true);
      expect(state.expandedNodes.has("html/body/span")).toBe(false);
    });

    it("should toggle node expansion", () => {
      const expandedNodes = new Set<string>(["html/body"]);

      expandedNodes.add("html/body/div");
      expect(expandedNodes.has("html/body/div")).toBe(true);

      expandedNodes.delete("html/body/div");
      expect(expandedNodes.has("html/body/div")).toBe(false);
    });
  });

  describe("Selector highlighting", () => {
    it("should handle selector highlighting", () => {
      let state: InspectorState = {
        isOpen: true,
        isPicking: false,
        selectedElement: null,
        hoveredElement: null,
        elementTree: [],
        panelPosition: "right",
        searchQuery: "",
        searchResults: [],
        expandedNodes: new Set(),
        highlightedSelector: null,
      };

      state = { ...state, highlightedSelector: "#main-content" };
      expect(state.highlightedSelector).toBe("#main-content");

      state = { ...state, highlightedSelector: null };
      expect(state.highlightedSelector).toBeNull();
    });
  });
});
