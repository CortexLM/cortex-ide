import {
  createContext,
  useContext,
  ParentComponent,
  onMount,
  onCleanup,
  batch,
} from "solid-js";
import { createStore, produce } from "solid-js/store";

// ============== Types ==============

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComputedStyle {
  property: string;
  value: string;
  inherited: boolean;
}

export interface ElementProp {
  name: string;
  value: unknown;
  type: string;
  editable: boolean;
}

export interface ElementState {
  name: string;
  value: unknown;
  type: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  warning?: boolean;
}

export interface InspectedElement {
  id: string;
  tagName: string;
  className: string;
  componentName?: string;
  bounds: ElementBounds;
  computedStyles: ComputedStyle[];
  props: ElementProp[];
  state: ElementState[];
  performanceMetrics: PerformanceMetric[];
  children: InspectedElement[];
  parent?: string;
  depth: number;
  element: HTMLElement | null;
}

export interface ElementTreeNode {
  id: string;
  tagName: string;
  className: string;
  componentName?: string;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  children: ElementTreeNode[];
}

// ============== State ==============

interface InspectorState {
  isOpen: boolean;
  isPicking: boolean;
  selectedElementId: string | null;
  hoveredElementId: string | null;
  selectedElement: InspectedElement | null;
  hoveredElement: InspectedElement | null;
  elementTree: ElementTreeNode[];
  expandedNodes: Set<string>;
  searchQuery: string;
  searchResults: string[];
  highlightedSearchResult: number;
  panelPosition: "right" | "bottom" | "left";
  panelWidth: number;
  panelHeight: number;
  showStyles: boolean;
  showProps: boolean;
  showState: boolean;
  showPerformance: boolean;
  filterCategory: "all" | "styles" | "props" | "state";
}

interface InspectorContextValue {
  state: InspectorState;
  // Panel controls
  open: () => void;
  close: () => void;
  toggle: () => void;
  setPanelPosition: (position: "right" | "bottom" | "left") => void;
  setPanelSize: (width: number, height: number) => void;
  // Picker mode
  startPicking: () => void;
  stopPicking: () => void;
  // Element selection
  selectElement: (element: HTMLElement | null) => void;
  selectElementById: (id: string) => void;
  hoverElement: (element: HTMLElement | null) => void;
  clearSelection: () => void;
  // Tree navigation
  toggleNodeExpanded: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  // Search
  setSearchQuery: (query: string) => void;
  nextSearchResult: () => void;
  prevSearchResult: () => void;
  // Live editing
  updateElementStyle: (property: string, value: string) => void;
  updateElementProp: (name: string, value: unknown) => void;
  // Display toggles
  toggleStyles: () => void;
  toggleProps: () => void;
  toggleState: () => void;
  togglePerformance: () => void;
  setFilterCategory: (category: "all" | "styles" | "props" | "state") => void;
  // Utilities
  getElementTree: () => ElementTreeNode[];
  inspectElement: (element: HTMLElement) => InspectedElement;
  getElementPerformanceMetrics: (element: HTMLElement) => PerformanceMetric[];
}

const InspectorContext = createContext<InspectorContextValue>();

// ============== Utilities ==============

function generateElementId(element: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  let depth = 0;
  const maxDepth = 10;

  while (current && depth < maxDepth) {
    let identifier = current.tagName.toLowerCase();
    if (current.id) {
      identifier += `#${current.id}`;
    } else if (current.className && typeof current.className === "string") {
      const classes = current.className.trim().split(/\s+/).slice(0, 2).join(".");
      if (classes) {
        identifier += `.${classes}`;
      }
    }
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current);
        identifier += `:nth(${index})`;
      }
    }
    parts.unshift(identifier);
    current = current.parentElement;
    depth++;
  }

  return parts.join(" > ");
}

function getComponentName(element: HTMLElement): string | undefined {
  // Try to find SolidJS component name from data attributes or other markers
  const dataComponent = element.getAttribute("data-component");
  if (dataComponent) return dataComponent;

  // Check for common framework markers
  const solidMarker = element.getAttribute("data-solid-component");
  if (solidMarker) return solidMarker;

  // Try to infer from class names (common pattern: Component_xyz)
  if (element.className && typeof element.className === "string") {
    const match = element.className.match(/^([A-Z][a-zA-Z]+)(?:_|$)/);
    if (match) return match[1];
  }

  return undefined;
}

function getComputedStyles(element: HTMLElement): ComputedStyle[] {
  const computed = window.getComputedStyle(element);
  const styles: ComputedStyle[] = [];

  // Priority styles to show first
  const priorityProps = [
    "display",
    "position",
    "width",
    "height",
    "margin",
    "padding",
    "border",
    "background",
    "color",
    "font-size",
    "font-family",
    "flex",
    "grid",
    "gap",
    "z-index",
    "opacity",
    "transform",
    "transition",
    "overflow",
    "box-sizing",
  ];

  for (const prop of priorityProps) {
    const value = computed.getPropertyValue(prop);
    if (value && value !== "none" && value !== "auto" && value !== "normal") {
      styles.push({
        property: prop,
        value,
        inherited: false,
      });
    }
  }

  return styles;
}

function getElementProps(element: HTMLElement): ElementProp[] {
  const props: ElementProp[] = [];

  // Standard HTML attributes
  const attributes = element.attributes;
  for (let i = 0; i < attributes.length; i++) {
    const attr = attributes[i];
    if (!attr.name.startsWith("data-inspector-")) {
      props.push({
        name: attr.name,
        value: attr.value,
        type: "string",
        editable: true,
      });
    }
  }

  // Special element properties
  if (element instanceof HTMLInputElement) {
    props.push(
      { name: "value", value: element.value, type: "string", editable: true },
      { name: "checked", value: element.checked, type: "boolean", editable: true },
      { name: "disabled", value: element.disabled, type: "boolean", editable: true }
    );
  }

  if (element instanceof HTMLSelectElement) {
    props.push(
      { name: "value", value: element.value, type: "string", editable: true },
      { name: "selectedIndex", value: element.selectedIndex, type: "number", editable: true }
    );
  }

  if (element instanceof HTMLTextAreaElement) {
    props.push({ name: "value", value: element.value, type: "string", editable: true });
  }

  return props;
}

function getElementState(_element: HTMLElement): ElementState[] {
  // In a real implementation, this would hook into SolidJS internals
  // For now, we provide what we can observe from the DOM
  const states: ElementState[] = [];

  // Check for common reactive state patterns in data attributes
  const attrs = _element.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (attr.name.startsWith("data-state-")) {
      const stateName = attr.name.replace("data-state-", "");
      let value: unknown = attr.value;
      try {
        value = JSON.parse(attr.value);
      } catch (err) {
        console.debug("[Inspector] JSON parse failed:", err);
      }
      states.push({
        name: stateName,
        value,
        type: typeof value,
      });
    }
  }

  return states;
}

function buildElementTree(
  element: HTMLElement,
  depth: number,
  expandedNodes: Set<string>,
  maxDepth: number = 15
): ElementTreeNode[] {
  if (depth > maxDepth) return [];

  const nodes: ElementTreeNode[] = [];
  const children = Array.from(element.children) as HTMLElement[];

  for (const child of children) {
    // Skip inspector elements
    if (child.hasAttribute("data-inspector-ui")) continue;
    // Skip script and style elements
    if (child.tagName === "SCRIPT" || child.tagName === "STYLE") continue;

    const id = generateElementId(child);
    const hasChildren = child.children.length > 0;
    const expanded = expandedNodes.has(id);

    const node: ElementTreeNode = {
      id,
      tagName: child.tagName.toLowerCase(),
      className: typeof child.className === "string" ? child.className : "",
      componentName: getComponentName(child),
      depth,
      hasChildren,
      expanded,
      children: expanded ? buildElementTree(child, depth + 1, expandedNodes, maxDepth) : [],
    };

    nodes.push(node);
  }

  return nodes;
}

function findElementById(id: string, root: HTMLElement = document.body): HTMLElement | null {
  const parts = id.split(" > ");
  let current: HTMLElement | null = root;

  for (const part of parts) {
    if (!current) break;

    const match = part.match(/^([a-z0-9]+)(?:#([^.:\s]+))?(?:\.([^:\s]+))?(?::nth\((\d+)\))?$/i);
    if (!match) continue;

    const [, tagName, id, classStr, nthIndex] = match;
    const children = Array.from(current.children) as HTMLElement[];

    let candidates = children.filter(
      (c) => c.tagName.toLowerCase() === tagName.toLowerCase()
    );

    if (id) {
      candidates = candidates.filter((c) => c.id === id);
    }

    if (classStr) {
      const classes = classStr.split(".");
      candidates = candidates.filter((c) =>
        classes.every((cls) => c.classList.contains(cls))
      );
    }

    if (nthIndex !== undefined) {
      const index = parseInt(nthIndex, 10);
      current = candidates[index] || null;
    } else {
      current = candidates[0] || null;
    }
  }

  return current;
}

// ============== Provider ==============

export const InspectorProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<InspectorState>({
    isOpen: false,
    isPicking: false,
    selectedElementId: null,
    hoveredElementId: null,
    selectedElement: null,
    hoveredElement: null,
    elementTree: [],
    expandedNodes: new Set<string>(),
    searchQuery: "",
    searchResults: [],
    highlightedSearchResult: 0,
    panelPosition: "right",
    panelWidth: 350,
    panelHeight: 300,
    showStyles: true,
    showProps: true,
    showState: true,
    showPerformance: true,
    filterCategory: "all",
  });

  let overlayElement: HTMLDivElement | null = null;
  let hoveredOverlayElement: HTMLDivElement | null = null;

  const inspectElement = (element: HTMLElement): InspectedElement => {
    const id = generateElementId(element);
    const rect = element.getBoundingClientRect();

    return {
      id,
      tagName: element.tagName.toLowerCase(),
      className: typeof element.className === "string" ? element.className : "",
      componentName: getComponentName(element),
      bounds: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      computedStyles: getComputedStyles(element),
      props: getElementProps(element),
      state: getElementState(element),
      performanceMetrics: getElementPerformanceMetrics(element),
      children: [],
      parent: element.parentElement ? generateElementId(element.parentElement) : undefined,
      depth: 0,
      element,
    };
  };

  const getElementPerformanceMetrics = (element: HTMLElement): PerformanceMetric[] => {
    const metrics: PerformanceMetric[] = [];
    const rect = element.getBoundingClientRect();

    // DOM metrics
    metrics.push({
      name: "Child Count",
      value: element.childElementCount,
      unit: "elements",
      warning: element.childElementCount > 100,
    });

    metrics.push({
      name: "DOM Depth",
      value: getElementDepth(element),
      unit: "levels",
      warning: getElementDepth(element) > 20,
    });

    // Size metrics
    metrics.push({
      name: "Rendered Width",
      value: Math.round(rect.width),
      unit: "px",
    });

    metrics.push({
      name: "Rendered Height",
      value: Math.round(rect.height),
      unit: "px",
    });

    // Estimate reflow cost based on children
    const reflowCost = estimateReflowCost(element);
    metrics.push({
      name: "Est. Reflow Cost",
      value: reflowCost,
      unit: "score",
      warning: reflowCost > 50,
    });

    // Check for potential performance issues
    const computed = window.getComputedStyle(element);

    if (computed.position === "fixed" || computed.position === "sticky") {
      metrics.push({
        name: "Fixed/Sticky Position",
        value: 1,
        unit: "detected",
        warning: true,
      });
    }

    if (computed.willChange && computed.willChange !== "auto") {
      metrics.push({
        name: "Will-Change Layers",
        value: computed.willChange.split(",").length,
        unit: "layers",
      });
    }

    return metrics;
  };

  const getElementDepth = (element: HTMLElement): number => {
    let depth = 0;
    let current: HTMLElement | null = element;
    while (current && current !== document.body) {
      depth++;
      current = current.parentElement;
    }
    return depth;
  };

  const estimateReflowCost = (element: HTMLElement): number => {
    // Simple heuristic based on descendants and complexity
    let score = 0;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT);
    let count = 0;

    while (walker.nextNode() && count < 500) {
      count++;
      const el = walker.currentNode as HTMLElement;
      const computed = window.getComputedStyle(el);

      // Penalize complex layouts
      if (computed.display === "flex" || computed.display === "grid") score += 2;
      if (computed.position === "absolute" || computed.position === "relative") score += 1;
      if (el.style.cssText.length > 0) score += 1;
    }

    return Math.min(100, score);
  };

  const createHighlightOverlay = (): HTMLDivElement => {
    const overlay = document.createElement("div");
    overlay.setAttribute("data-inspector-ui", "true");
    overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 99999;
      background: rgba(99, 102, 241, 0.15);
      border: 2px solid #6366f1;
      border-radius: 2px;
      transition: all 0.1s ease-out;
    `;
    document.body.appendChild(overlay);
    return overlay;
  };

  const createHoveredOverlay = (): HTMLDivElement => {
    const overlay = document.createElement("div");
    overlay.setAttribute("data-inspector-ui", "true");
    overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 99998;
      background: rgba(34, 211, 238, 0.1);
      border: 1px dashed #22d3ee;
      border-radius: 2px;
      transition: all 0.05s ease-out;
    `;
    document.body.appendChild(overlay);
    return overlay;
  };

  const updateOverlay = (
    overlay: HTMLDivElement | null,
    element: HTMLElement | null,
    visible: boolean
  ) => {
    if (!overlay) return;

    if (!visible || !element) {
      overlay.style.display = "none";
      return;
    }

    const rect = element.getBoundingClientRect();
    overlay.style.display = "block";
    overlay.style.left = `${rect.x}px`;
    overlay.style.top = `${rect.y}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  };

  const refreshElementTree = () => {
    setState("elementTree", buildElementTree(document.body, 0, state.expandedNodes));
  };

  const searchElements = (query: string): string[] => {
    if (!query.trim()) return [];

    const results: string[] = [];
    const lowerQuery = query.toLowerCase();

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let count = 0;
    const maxResults = 100;

    while (walker.nextNode() && count < maxResults) {
      const element = walker.currentNode as HTMLElement;
      if (element.hasAttribute("data-inspector-ui")) continue;

      const id = generateElementId(element);
      const tagName = element.tagName.toLowerCase();
      const className = typeof element.className === "string" ? element.className.toLowerCase() : "";
      const elementId = element.id?.toLowerCase() || "";
      const componentName = getComponentName(element)?.toLowerCase() || "";

      if (
        tagName.includes(lowerQuery) ||
        className.includes(lowerQuery) ||
        elementId.includes(lowerQuery) ||
        componentName.includes(lowerQuery) ||
        id.toLowerCase().includes(lowerQuery)
      ) {
        results.push(id);
        count++;
      }
    }

    return results;
  };

  // Event handlers for picker mode
  const handlePickerMouseMove = (e: MouseEvent) => {
    if (!state.isPicking) return;

    const target = e.target as HTMLElement;
    if (target.hasAttribute("data-inspector-ui")) return;

    hoverElement(target);
  };

  const handlePickerClick = (e: MouseEvent) => {
    if (!state.isPicking) return;

    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    if (target.hasAttribute("data-inspector-ui")) return;

    selectElement(target);
    stopPicking();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Toggle inspector: Ctrl+Shift+I
    if (e.ctrlKey && e.shiftKey && e.key === "I") {
      e.preventDefault();
      toggle();
      return;
    }

    // Cancel picking: Escape
    if (e.key === "Escape" && state.isPicking) {
      e.preventDefault();
      stopPicking();
      return;
    }

    // Close inspector: Escape when not picking
    if (e.key === "Escape" && state.isOpen && !state.isPicking) {
      e.preventDefault();
      close();
      return;
    }
  };

  // Context actions
  const open = () => {
    batch(() => {
      setState("isOpen", true);
      refreshElementTree();
    });
  };

  const close = () => {
    batch(() => {
      setState("isOpen", false);
      setState("isPicking", false);
      setState("hoveredElementId", null);
      setState("hoveredElement", null);
    });
    updateOverlay(overlayElement, null, false);
    updateOverlay(hoveredOverlayElement, null, false);
  };

  const toggle = () => {
    if (state.isOpen) {
      close();
    } else {
      open();
    }
  };

  const setPanelPosition = (position: "right" | "bottom" | "left") => {
    setState("panelPosition", position);
  };

  const setPanelSize = (width: number, height: number) => {
    batch(() => {
      setState("panelWidth", width);
      setState("panelHeight", height);
    });
  };

  const startPicking = () => {
    setState("isPicking", true);
    document.body.style.cursor = "crosshair";
  };

  const stopPicking = () => {
    setState("isPicking", false);
    document.body.style.cursor = "";
    updateOverlay(hoveredOverlayElement, null, false);
    setState("hoveredElementId", null);
    setState("hoveredElement", null);
  };

  const selectElement = (element: HTMLElement | null) => {
    if (!element) {
      clearSelection();
      return;
    }

    const inspected = inspectElement(element);
    batch(() => {
      setState("selectedElementId", inspected.id);
      setState("selectedElement", inspected);
    });
    updateOverlay(overlayElement, element, true);

    // Auto-expand path to element in tree
    let current: HTMLElement | null = element;
    const nodesToExpand = new Set<string>(state.expandedNodes);
    while (current && current !== document.body) {
      nodesToExpand.add(generateElementId(current));
      current = current.parentElement;
    }
    setState(
      produce((s) => {
        s.expandedNodes = nodesToExpand;
      })
    );
    refreshElementTree();
  };

  const selectElementById = (id: string) => {
    const element = findElementById(id);
    if (element) {
      selectElement(element);
    }
  };

  const hoverElement = (element: HTMLElement | null) => {
    if (!element) {
      setState("hoveredElementId", null);
      setState("hoveredElement", null);
      updateOverlay(hoveredOverlayElement, null, false);
      return;
    }

    const inspected = inspectElement(element);
    batch(() => {
      setState("hoveredElementId", inspected.id);
      setState("hoveredElement", inspected);
    });
    updateOverlay(hoveredOverlayElement, element, true);
  };

  const clearSelection = () => {
    batch(() => {
      setState("selectedElementId", null);
      setState("selectedElement", null);
    });
    updateOverlay(overlayElement, null, false);
  };

  const toggleNodeExpanded = (id: string) => {
    setState(
      produce((s) => {
        if (s.expandedNodes.has(id)) {
          s.expandedNodes.delete(id);
        } else {
          s.expandedNodes.add(id);
        }
      })
    );
    refreshElementTree();
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: ElementTreeNode[]) => {
      for (const node of nodes) {
        if (node.hasChildren) {
          allIds.add(node.id);
        }
        collectIds(node.children);
      }
    };
    collectIds(state.elementTree);
    setState(
      produce((s) => {
        s.expandedNodes = allIds;
      })
    );
    refreshElementTree();
  };

  const collapseAll = () => {
    setState(
      produce((s) => {
        s.expandedNodes = new Set<string>();
      })
    );
    refreshElementTree();
  };

  const setSearchQuery = (query: string) => {
    batch(() => {
      setState("searchQuery", query);
      setState("searchResults", searchElements(query));
      setState("highlightedSearchResult", 0);
    });
  };

  const nextSearchResult = () => {
    if (state.searchResults.length === 0) return;
    const next = (state.highlightedSearchResult + 1) % state.searchResults.length;
    setState("highlightedSearchResult", next);
    selectElementById(state.searchResults[next]);
  };

  const prevSearchResult = () => {
    if (state.searchResults.length === 0) return;
    const prev =
      (state.highlightedSearchResult - 1 + state.searchResults.length) %
      state.searchResults.length;
    setState("highlightedSearchResult", prev);
    selectElementById(state.searchResults[prev]);
  };

  const updateElementStyle = (property: string, value: string) => {
    const element = state.selectedElement?.element;
    if (!element) return;

    element.style.setProperty(property, value);

    // Refresh inspected element data
    const updated = inspectElement(element);
    setState("selectedElement", updated);
  };

  const updateElementProp = (name: string, value: unknown) => {
    const element = state.selectedElement?.element;
    if (!element) return;

    if (name === "value" && element instanceof HTMLInputElement) {
      element.value = String(value);
    } else if (name === "checked" && element instanceof HTMLInputElement) {
      element.checked = Boolean(value);
    } else if (name === "disabled") {
      (element as HTMLInputElement).disabled = Boolean(value);
    } else {
      element.setAttribute(name, String(value));
    }

    // Refresh inspected element data
    const updated = inspectElement(element);
    setState("selectedElement", updated);
  };

  const toggleStyles = () => setState("showStyles", !state.showStyles);
  const toggleProps = () => setState("showProps", !state.showProps);
  const toggleState = () => setState("showState", !state.showState);
  const togglePerformance = () => setState("showPerformance", !state.showPerformance);

  const setFilterCategory = (category: "all" | "styles" | "props" | "state") => {
    setState("filterCategory", category);
  };

  const getElementTree = (): ElementTreeNode[] => {
    return state.elementTree;
  };

  // Lifecycle
  onMount(() => {
    overlayElement = createHighlightOverlay();
    hoveredOverlayElement = createHoveredOverlay();

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousemove", handlePickerMouseMove, true);
    document.addEventListener("click", handlePickerClick, true);

    // Listen for custom event to open inspector
    const openHandler = () => open();
    window.addEventListener("inspector:open", openHandler);

    // Listen for custom event to toggle inspector
    const toggleHandler = () => toggle();
    window.addEventListener("inspector:toggle", toggleHandler);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousemove", handlePickerMouseMove, true);
      document.removeEventListener("click", handlePickerClick, true);
      window.removeEventListener("inspector:open", openHandler);
      window.removeEventListener("inspector:toggle", toggleHandler);

      overlayElement?.remove();
      hoveredOverlayElement?.remove();
    });
  });

  return (
    <InspectorContext.Provider
      value={{
        state,
        open,
        close,
        toggle,
        setPanelPosition,
        setPanelSize,
        startPicking,
        stopPicking,
        selectElement,
        selectElementById,
        hoverElement,
        clearSelection,
        toggleNodeExpanded,
        expandAll,
        collapseAll,
        setSearchQuery,
        nextSearchResult,
        prevSearchResult,
        updateElementStyle,
        updateElementProp,
        toggleStyles,
        toggleProps,
        toggleState,
        togglePerformance,
        setFilterCategory,
        getElementTree,
        inspectElement,
        getElementPerformanceMetrics,
      }}
    >
      {props.children}
    </InspectorContext.Provider>
  );
};

export function useInspector() {
  const context = useContext(InspectorContext);
  if (!context) {
    throw new Error("useInspector must be used within InspectorProvider");
  }
  return context;
}

// Utility to open inspector from anywhere
export function openInspector(): void {
  window.dispatchEvent(new CustomEvent("inspector:open"));
}

// Utility to toggle inspector from anywhere
export function toggleInspector(): void {
  window.dispatchEvent(new CustomEvent("inspector:toggle"));
}
