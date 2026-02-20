/**
 * FactoryCanvas.tsx
 * 
 * Main canvas component for the Agent Factory - a node-based workflow editor.
 * Features SVG-based rendering with pan, zoom, node/edge management, and selection.
 */

import {
  JSX,
  createSignal,
  createMemo,
  createEffect,
  onMount,
  onCleanup,
  For,
  Show,
  batch,
} from "solid-js";
import { CanvasBackground, GridPattern } from "./CanvasBackground";
import { SelectionBox, SelectionBoxBounds, isNodeInSelection } from "./SelectionBox";
import { ConnectionLine, TempConnectionLine, EdgeType, EdgeLabel } from "./ConnectionLine";
import { MiniMap, MiniMapNode, MiniMapViewport } from "./MiniMap";
import { CanvasToolbar } from "./CanvasToolbar";

// ============================================================================
// Types
// ============================================================================

export interface CanvasNode {
  /** Unique node identifier */
  id: string;
  /** Node type for rendering */
  type: string;
  /** X position in canvas coordinates */
  x: number;
  /** Y position in canvas coordinates */
  y: number;
  /** Node width */
  width: number;
  /** Node height */
  height: number;
  /** Node data/configuration */
  data?: Record<string, unknown>;
  /** Whether node is selected */
  selected?: boolean;
  /** Whether node is being dragged */
  dragging?: boolean;
  /** Input port handles */
  inputs?: CanvasPort[];
  /** Output port handles */
  outputs?: CanvasPort[];
}

export interface CanvasPort {
  /** Port identifier */
  id: string;
  /** Port label */
  label?: string;
  /** Port type for validation */
  type?: string;
  /** Whether port can accept multiple connections */
  multiple?: boolean;
}

export interface CanvasEdge {
  /** Unique edge identifier */
  id: string;
  /** Source node ID */
  source: string;
  /** Source port handle ID */
  sourceHandle?: string;
  /** Target node ID */
  target: string;
  /** Target port handle ID */
  targetHandle?: string;
  /** Edge type for styling */
  type?: EdgeType;
  /** Whether edge is animated */
  animated?: boolean;
  /** Edge label */
  label?: EdgeLabel;
  /** Whether edge is selected */
  selected?: boolean;
}

export interface CanvasViewport {
  /** X pan offset */
  x: number;
  /** Y pan offset */
  y: number;
  /** Zoom level (1 = 100%) */
  zoom: number;
}

export interface FactoryCanvasProps {
  /** Nodes to render */
  nodes: CanvasNode[];
  /** Edges to render */
  edges: CanvasEdge[];
  /** Current viewport state */
  viewport?: CanvasViewport;
  /** Grid pattern type */
  gridPattern?: GridPattern;
  /** Grid cell size */
  gridSize?: number;
  /** Whether grid is visible */
  gridVisible?: boolean;
  /** Whether snap to grid is enabled */
  snapToGrid?: boolean;
  /** Whether minimap is visible */
  minimapVisible?: boolean;
  /** Whether toolbar is visible */
  toolbarVisible?: boolean;
  /** Whether the canvas is read-only */
  readOnly?: boolean;
  /** Min zoom level */
  minZoom?: number;
  /** Max zoom level */
  maxZoom?: number;
  /** Custom node renderer */
  nodeRenderer?: (node: CanvasNode) => JSX.Element;
  /** Node selection change handler */
  onNodeSelect?: (nodeIds: string[], additive: boolean) => void;
  /** Node position change handler */
  onNodeDrag?: (nodeId: string, x: number, y: number) => void;
  /** Node drag end handler */
  onNodeDragEnd?: (nodeIds: string[], positions: { id: string; x: number; y: number }[]) => void;
  /** Node double click handler */
  onNodeDoubleClick?: (nodeId: string) => void;
  /** Node context menu handler */
  onNodeContextMenu?: (nodeId: string, e: MouseEvent) => void;
  /** Edge selection handler */
  onEdgeSelect?: (edgeId: string | null) => void;
  /** Edge creation handler */
  onEdgeCreate?: (source: string, sourceHandle: string, target: string, targetHandle: string) => void;
  /** Edge deletion handler */
  onEdgeDelete?: (edgeId: string) => void;
  /** Edge context menu handler */
  onEdgeContextMenu?: (edgeId: string, e: MouseEvent) => void;
  /** Viewport change handler */
  onViewportChange?: (viewport: CanvasViewport) => void;
  /** Canvas click handler (for deselection) */
  onCanvasClick?: () => void;
  /** Canvas context menu handler */
  onCanvasContextMenu?: (e: MouseEvent, position: { x: number; y: number }) => void;
  /** Delete selected handler */
  onDeleteSelected?: () => void;
  /** Copy handler */
  onCopy?: () => void;
  /** Paste handler */
  onPaste?: (position: { x: number; y: number }) => void;
  /** Undo handler */
  onUndo?: () => void;
  /** Redo handler */
  onRedo?: () => void;
  /** Can undo */
  canUndo?: boolean;
  /** Can redo */
  canRedo?: boolean;
  /** Custom style overrides */
  style?: JSX.CSSProperties;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MIN_ZOOM = 0.1;
const DEFAULT_MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;
const PAN_SPEED = 1;

// ============================================================================
// Component
// ============================================================================

export function FactoryCanvas(props: FactoryCanvasProps) {
  // Refs
  let containerRef: HTMLDivElement | undefined;
  let svgRef: SVGSVGElement | undefined;

  // State
  const [viewport, setViewport] = createSignal<CanvasViewport>(
    props.viewport ?? { x: 0, y: 0, zoom: 1 }
  );
  const [containerSize, setContainerSize] = createSignal({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = createSignal(false);
  const [isDraggingNode, setIsDraggingNode] = createSignal(false);
  const [isSelecting, setIsSelecting] = createSignal(false);
  const [isConnecting, setIsConnecting] = createSignal(false);
  const [selectionBounds, setSelectionBounds] = createSignal<SelectionBoxBounds | null>(null);
  const [connectionStart, setConnectionStart] = createSignal<{
    nodeId: string;
    portId: string;
    x: number;
    y: number;
  } | null>(null);
  const [connectionEnd, setConnectionEnd] = createSignal<{ x: number; y: number } | null>(null);
  const [hoveredEdge, setHoveredEdge] = createSignal<string | null>(null);
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 });
  const [panStart, setPanStart] = createSignal({ x: 0, y: 0 });
  const [lastMousePos, setLastMousePos] = createSignal({ x: 0, y: 0 });

  // Derived state
  const minZoom = () => props.minZoom ?? DEFAULT_MIN_ZOOM;
  const maxZoom = () => props.maxZoom ?? DEFAULT_MAX_ZOOM;
  const gridSize = () => props.gridSize ?? 20;
  const gridVisible = () => props.gridVisible ?? true;
  const snapToGrid = () => props.snapToGrid ?? false;
  const readOnly = () => props.readOnly ?? false;

  const selectedNodes = createMemo(() => props.nodes.filter((n) => n.selected));
  const selectedEdges = createMemo(() => props.edges.filter((e) => e.selected));
  const hasSelection = createMemo(() => selectedNodes().length > 0 || selectedEdges().length > 0);

  // Sync viewport from props
  createEffect(() => {
    if (props.viewport) {
      setViewport(props.viewport);
    }
  });

  // ============================================================================
  // Coordinate Transforms
  // ============================================================================

  /** Convert screen coordinates to canvas coordinates */
  const screenToCanvas = (screenX: number, screenY: number): { x: number; y: number } => {
    const vp = viewport();
    const rect = containerRef?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    const x = (screenX - rect.left - vp.x) / vp.zoom;
    const y = (screenY - rect.top - vp.y) / vp.zoom;
    return { x, y };
  };

  /** Convert canvas coordinates to screen coordinates */
  const canvasToScreen = (canvasX: number, canvasY: number): { x: number; y: number } => {
    const vp = viewport();
    const x = canvasX * vp.zoom + vp.x;
    const y = canvasY * vp.zoom + vp.y;
    return { x, y };
  };

  /** Snap position to grid if enabled */
  const snapPosition = (x: number, y: number): { x: number; y: number } => {
    if (!snapToGrid()) return { x, y };
    const size = gridSize();
    return {
      x: Math.round(x / size) * size,
      y: Math.round(y / size) * size,
    };
  };

  /** Get port center position in canvas coordinates */
  const getPortPosition = (
    node: CanvasNode,
    portId: string,
    isOutput: boolean
  ): { x: number; y: number } => {
    const ports = isOutput ? node.outputs : node.inputs;
    const portIndex = ports?.findIndex((p) => p.id === portId) ?? 0;
    const portCount = ports?.length ?? 1;
    const portSpacing = node.height / (portCount + 1);

    return {
      x: isOutput ? node.x + node.width : node.x,
      y: node.y + portSpacing * (portIndex + 1),
    };
  };

  // ============================================================================
  // Viewport Operations
  // ============================================================================

  const updateViewport = (newViewport: Partial<CanvasViewport>) => {
    const vp = { ...viewport(), ...newViewport };
    // Clamp zoom
    vp.zoom = Math.max(minZoom(), Math.min(maxZoom(), vp.zoom));
    setViewport(vp);
    props.onViewportChange?.(vp);
  };

  const zoomIn = () => {
    const centerX = containerSize().width / 2;
    const centerY = containerSize().height / 2;
    zoomAt(centerX, centerY, ZOOM_STEP);
  };

  const zoomOut = () => {
    const centerX = containerSize().width / 2;
    const centerY = containerSize().height / 2;
    zoomAt(centerX, centerY, -ZOOM_STEP);
  };

  const zoomReset = () => {
    updateViewport({ zoom: 1 });
  };

  const zoomAt = (screenX: number, screenY: number, delta: number) => {
    const vp = viewport();
    const newZoom = Math.max(minZoom(), Math.min(maxZoom(), vp.zoom + delta));
    const zoomRatio = newZoom / vp.zoom;

    // Zoom towards mouse position
    const newX = screenX - (screenX - vp.x) * zoomRatio;
    const newY = screenY - (screenY - vp.y) * zoomRatio;

    updateViewport({ x: newX, y: newY, zoom: newZoom });
  };

  const fitView = () => {
    if (props.nodes.length === 0) {
      updateViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }

    // Calculate bounds of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of props.nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }

    const padding = 50;
    const nodesWidth = maxX - minX + padding * 2;
    const nodesHeight = maxY - minY + padding * 2;

    const size = containerSize();
    const zoom = Math.min(
      size.width / nodesWidth,
      size.height / nodesHeight,
      1.5 // Max fit zoom
    );

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    updateViewport({
      x: size.width / 2 - centerX * zoom,
      y: size.height / 2 - centerY * zoom,
      zoom,
    });
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      zoomAt(e.clientX - (containerRef?.getBoundingClientRect().left ?? 0), 
             e.clientY - (containerRef?.getBoundingClientRect().top ?? 0), 
             delta);
    } else {
      // Pan
      const vp = viewport();
      updateViewport({
        x: vp.x - e.deltaX * PAN_SPEED,
        y: vp.y - e.deltaY * PAN_SPEED,
      });
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return; // Left click only

    const target = e.target as HTMLElement;
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    setLastMousePos({ x: e.clientX, y: e.clientY });

    // Check if clicking on a port
    if (target.closest("[data-port]") && !readOnly()) {
      const portEl = target.closest("[data-port]") as HTMLElement;
      const nodeId = portEl.dataset.nodeId!;
      const portId = portEl.dataset.portId!;
      const isOutput = portEl.dataset.isOutput === "true";

      if (isOutput) {
        // Start connection from output port
        const node = props.nodes.find((n) => n.id === nodeId);
        if (node) {
          const portPos = getPortPosition(node, portId, true);
          setConnectionStart({ nodeId, portId, x: portPos.x, y: portPos.y });
          setConnectionEnd(canvasPos);
          setIsConnecting(true);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    }

    // Check if clicking on a node
    const nodeEl = target.closest("[data-node-id]") as HTMLElement;
    if (nodeEl && !readOnly()) {
      const nodeId = nodeEl.dataset.nodeId!;
      const node = props.nodes.find((n) => n.id === nodeId);

      if (node) {
        // Handle selection
        const additive = e.shiftKey || e.ctrlKey || e.metaKey;
        if (!node.selected) {
          props.onNodeSelect?.([nodeId], additive);
        }

        // Start dragging
        setDragOffset({
          x: canvasPos.x - node.x,
          y: canvasPos.y - node.y,
        });
        setIsDraggingNode(true);
        e.preventDefault();
        return;
      }
    }

    // Check if clicking on the canvas (not a node)
    if ((target as Element) === svgRef || target.closest(".factory-canvas-background")) {
      if (e.shiftKey) {
        // Start selection box
        setSelectionBounds({
          startX: canvasPos.x,
          startY: canvasPos.y,
          endX: canvasPos.x,
          endY: canvasPos.y,
        });
        setIsSelecting(true);
      } else if (e.button === 0 && !e.ctrlKey) {
        // Start panning or deselect
        setPanStart({ x: e.clientX - viewport().x, y: e.clientY - viewport().y });
        setIsPanning(true);

        // Deselect if not shift-clicking
        props.onCanvasClick?.();
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    if (isPanning()) {
      updateViewport({
        x: e.clientX - panStart().x,
        y: e.clientY - panStart().y,
      });
    } else if (isDraggingNode() && !readOnly()) {
      // Move all selected nodes
      const snappedPos = snapPosition(canvasPos.x - dragOffset().x, canvasPos.y - dragOffset().y);

      for (const node of selectedNodes()) {
        const deltaX = snappedPos.x - props.nodes.find((n) => n.id === selectedNodes()[0].id)!.x;
        const deltaY = snappedPos.y - props.nodes.find((n) => n.id === selectedNodes()[0].id)!.y;

        props.onNodeDrag?.(node.id, node.x + deltaX, node.y + deltaY);
      }
    } else if (isSelecting()) {
      setSelectionBounds((prev) => prev ? { ...prev, endX: canvasPos.x, endY: canvasPos.y } : null);
    } else if (isConnecting()) {
      setConnectionEnd(canvasPos);
    }

    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (isDraggingNode()) {
      // Finalize node positions
      const positions = selectedNodes().map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
      }));
      props.onNodeDragEnd?.(
        selectedNodes().map((n) => n.id),
        positions
      );
    }

    if (isSelecting()) {
      // Select nodes within selection box
      const bounds = selectionBounds();
      if (bounds) {
        const selectedIds = props.nodes
          .filter((node) =>
            isNodeInSelection(
              { x: node.x, y: node.y, width: node.width, height: node.height },
              bounds
            )
          )
          .map((n) => n.id);

        if (selectedIds.length > 0) {
          props.onNodeSelect?.(selectedIds, e.shiftKey);
        }
      }
    }

    if (isConnecting()) {
      // Check if we're over a valid input port
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
      const portEl = target?.closest("[data-port]") as HTMLElement;

      if (portEl && portEl.dataset.isOutput === "false") {
        const targetNodeId = portEl.dataset.nodeId!;
        const targetPortId = portEl.dataset.portId!;
        const start = connectionStart();

        if (start && targetNodeId !== start.nodeId) {
          props.onEdgeCreate?.(start.nodeId, start.portId, targetNodeId, targetPortId);
        }
      }
    }

    // Reset all interaction states
    batch(() => {
      setIsPanning(false);
      setIsDraggingNode(false);
      setIsSelecting(false);
      setIsConnecting(false);
      setSelectionBounds(null);
      setConnectionStart(null);
      setConnectionEnd(null);
    });
  };

  const handleDoubleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const nodeEl = target.closest("[data-node-id]") as HTMLElement;

    if (nodeEl) {
      props.onNodeDoubleClick?.(nodeEl.dataset.nodeId!);
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();

    const target = e.target as HTMLElement;
    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    // Check for node
    const nodeEl = target.closest("[data-node-id]") as HTMLElement;
    if (nodeEl) {
      props.onNodeContextMenu?.(nodeEl.dataset.nodeId!, e);
      return;
    }

    // Check for edge
    const edgeEl = target.closest("[data-edge-id]") as HTMLElement;
    if (edgeEl) {
      props.onEdgeContextMenu?.(edgeEl.dataset.edgeId!, e);
      return;
    }

    // Canvas context menu
    props.onCanvasContextMenu?.(e, canvasPos);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (readOnly()) return;

    const isCtrl = e.ctrlKey || e.metaKey;

    switch (e.key) {
      case "Delete":
      case "Backspace":
        if (hasSelection()) {
          props.onDeleteSelected?.();
          e.preventDefault();
        }
        break;

      case "c":
        if (isCtrl && hasSelection()) {
          props.onCopy?.();
          e.preventDefault();
        }
        break;

      case "v":
        if (isCtrl) {
          const pos = screenToCanvas(lastMousePos().x, lastMousePos().y);
          props.onPaste?.(pos);
          e.preventDefault();
        }
        break;

      case "z":
        if (isCtrl && !e.shiftKey) {
          props.onUndo?.();
          e.preventDefault();
        } else if (isCtrl && e.shiftKey) {
          props.onRedo?.();
          e.preventDefault();
        }
        break;

      case "y":
        if (isCtrl) {
          props.onRedo?.();
          e.preventDefault();
        }
        break;

      case "a":
        if (isCtrl) {
          props.onNodeSelect?.(props.nodes.map((n) => n.id), false);
          e.preventDefault();
        }
        break;

      case "Escape":
        props.onNodeSelect?.([], false);
        props.onEdgeSelect?.(null);
        break;

      case "0":
        if (isCtrl) {
          fitView();
          e.preventDefault();
        }
        break;

      case "=":
      case "+":
        if (isCtrl) {
          zoomIn();
          e.preventDefault();
        }
        break;

      case "-":
        if (isCtrl) {
          zoomOut();
          e.preventDefault();
        }
        break;

      case "g":
        if (!isCtrl) {
          if (e.shiftKey) {
            // Toggle snap to grid would need external handler
          } else {
            // Toggle grid would need external handler
          }
        }
        break;
    }
  };

  // ============================================================================
  // Touch Support
  // ============================================================================

  let lastTouchDistance = 0;

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom start
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      lastTouchDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
    } else if (e.touches.length === 1) {
      // Single touch - simulate mouse down
      const touch = e.touches[0];
      handleMouseDown(new MouseEvent("mousedown", {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
      }));
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const center = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };

      const scale = distance / lastTouchDistance;
      const rect = containerRef?.getBoundingClientRect();
      if (rect) {
        zoomAt(center.x - rect.left, center.y - rect.top, (scale - 1) * viewport().zoom);
      }

      lastTouchDistance = distance;
      e.preventDefault();
    } else if (e.touches.length === 1) {
      // Single touch - simulate mouse move
      const touch = e.touches[0];
      handleMouseMove(new MouseEvent("mousemove", {
        clientX: touch.clientX,
        clientY: touch.clientY,
      }));
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length === 0) {
      handleMouseUp(new MouseEvent("mouseup", {
        clientX: lastMousePos().x,
        clientY: lastMousePos().y,
      }));
    }
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(() => {
    // Set initial size
    if (containerRef) {
      const rect = containerRef.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    }

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    if (containerRef) {
      resizeObserver.observe(containerRef);
    }

    // Keyboard events
    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      resizeObserver.disconnect();
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderDefaultNode = (node: CanvasNode) => {
    return (
      <foreignObject
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        style={{ overflow: "visible" }}
      >
        <div
          data-node-id={node.id}
          style={{
            width: `${node.width}px`,
            height: `${node.height}px`,
            background: node.selected
              ? "var(--jb-surface-selected, var(--cortex-bg-hover))"
              : "var(--ui-panel-bg, var(--cortex-bg-secondary))",
            border: node.selected
              ? "2px solid var(--accent-primary, var(--cortex-info))"
              : "1px solid var(--jb-border-default, rgba(255, 255, 255, 0.08))",
            "border-radius": "var(--jb-radius-lg, 12px)",
            "box-shadow": node.selected
              ? "0 0 0 3px var(--accent-muted, rgba(59, 130, 246, 0.3))"
              : "var(--jb-shadow-popup, 0px 8px 16px rgba(0, 0, 0, 0.45))",
            cursor: node.dragging ? "grabbing" : "grab",
            "user-select": "none",
            display: "flex",
            "flex-direction": "column",
            overflow: "hidden",
          }}
        >
          {/* Node header */}
          <div
            style={{
              padding: "10px 14px",
              "border-bottom": "1px solid var(--jb-border-default)",
              "font-size": "12px",
              "font-weight": "600",
              color: "var(--jb-text-body-color, var(--cortex-text-secondary))",
              background: "var(--jb-surface-hover, var(--cortex-bg-hover))",
              "border-radius": "var(--jb-radius-lg, 12px) var(--jb-radius-lg, 12px) 0 0",
            }}
          >
            {(node.data?.label as string) || node.type}
          </div>

          {/* Node body */}
          <div
            style={{
              flex: "1",
              padding: "8px 12px",
              "font-size": "11px",
              color: "var(--jb-text-muted-color, var(--cortex-text-inactive))",
            }}
          >
            {node.id}
          </div>
        </div>

        {/* Input ports */}
        <For each={node.inputs}>
          {(port, index) => {
            return (
              <div
                data-port
                data-node-id={node.id}
                data-port-id={port.id}
                data-is-output="false"
                style={{
                  position: "absolute",
                  left: "-6px",
                  top: `${((index() + 1) * node.height) / ((node.inputs?.length ?? 0) + 1) - 6}px`,
                  width: "12px",
                  height: "12px",
                  "border-radius": "var(--cortex-radius-full)",
                  background: "var(--jb-panel, var(--cortex-bg-secondary))",
                  border: "2px solid var(--accent-primary, var(--cortex-info))",
                  cursor: "crosshair",
                }}
              />
            );
          }}
        </For>

        {/* Output ports */}
        <For each={node.outputs}>
          {(port, index) => {
            return (
              <div
                data-port
                data-node-id={node.id}
                data-port-id={port.id}
                data-is-output="true"
                style={{
                  position: "absolute",
                  right: "-6px",
                  top: `${((index() + 1) * node.height) / ((node.outputs?.length ?? 0) + 1) - 6}px`,
                  width: "12px",
                  height: "12px",
                  "border-radius": "var(--cortex-radius-full)",
                  background: "var(--accent-primary, var(--cortex-info))",
                  border: "2px solid var(--jb-panel, var(--cortex-bg-secondary))",
                  cursor: "crosshair",
                }}
              />
            );
          }}
        </For>
      </foreignObject>
    );
  };

  const getEdgePositions = (edge: CanvasEdge) => {
    const sourceNode = props.nodes.find((n) => n.id === edge.source);
    const targetNode = props.nodes.find((n) => n.id === edge.target);

    if (!sourceNode || !targetNode) return null;

    const sourcePos = getPortPosition(sourceNode, edge.sourceHandle ?? "output", true);
    const targetPos = getPortPosition(targetNode, edge.targetHandle ?? "input", false);

    return { sourcePos, targetPos };
  };

  // ============================================================================
  // Minimap Data
  // ============================================================================

  const minimapNodes = createMemo<MiniMapNode[]>(() =>
    props.nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      selected: node.selected,
      color: node.selected ? undefined : "var(--jb-text-muted-color)",
    }))
  );

  const minimapViewport = createMemo<MiniMapViewport>(() => {
    const vp = viewport();
    const size = containerSize();
    return {
      x: -vp.x / vp.zoom,
      y: -vp.y / vp.zoom,
      width: size.width / vp.zoom,
      height: size.height / vp.zoom,
    };
  });

  const handleMinimapNavigate = (x: number, y: number) => {
    const size = containerSize();
    const vp = viewport();
    updateViewport({
      x: -x * vp.zoom + size.width / 2,
      y: -y * vp.zoom + size.height / 2,
    });
  };

  const handleMinimapViewportDrag = (deltaX: number, deltaY: number) => {
    const vp = viewport();
    updateViewport({
      x: vp.x - deltaX * vp.zoom,
      y: vp.y - deltaY * vp.zoom,
    });
  };

  // ============================================================================
  // Render
  // ============================================================================

  const containerStyle = (): JSX.CSSProperties => ({
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    background: "var(--jb-canvas, var(--cortex-bg-secondary))",
    "user-select": "none",
    cursor: isPanning() ? "grabbing" : isConnecting() ? "crosshair" : "default",
    outline: "none",
    ...props.style,
  });

  const svgTransform = () => {
    const vp = viewport();
    return `translate(${vp.x}, ${vp.y}) scale(${vp.zoom})`;
  };

  return (
    <div
      ref={containerRef}
      class="factory-canvas"
      style={containerStyle()}
      tabIndex={0}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDblClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="application"
      aria-label="Workflow canvas"
    >
      {/* Grid Background */}
      <CanvasBackground
        pattern={props.gridPattern}
        gridSize={gridSize()}
        zoom={viewport().zoom}
        panX={viewport().x}
        panY={viewport().y}
        visible={gridVisible()}
      />

      {/* Main SVG Canvas */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          top: "0",
          left: "0",
        }}
      >
        <g transform={svgTransform()}>
          {/* Edges layer */}
          <g class="factory-edges-layer">
            <For each={props.edges}>
              {(edge) => {
                const positions = getEdgePositions(edge);
                if (!positions) return null;

                return (
                  <ConnectionLine
                    id={edge.id}
                    sourceX={positions.sourcePos.x}
                    sourceY={positions.sourcePos.y}
                    targetX={positions.targetPos.x}
                    targetY={positions.targetPos.y}
                    sourceNodeId={edge.source}
                    targetNodeId={edge.target}
                    sourceHandle={edge.sourceHandle}
                    targetHandle={edge.targetHandle}
                    type={edge.type}
                    selected={edge.selected}
                    hovered={hoveredEdge() === edge.id}
                    animated={edge.animated}
                    label={edge.label}
                    onClick={() => props.onEdgeSelect?.(edge.id)}
                    onMouseEnter={() => setHoveredEdge(edge.id)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    onContextMenu={(e) => props.onEdgeContextMenu?.(edge.id, e)}
                  />
                );
              }}
            </For>

            {/* Temporary connection line */}
            <Show when={isConnecting() && connectionStart() && connectionEnd()}>
              <TempConnectionLine
                sourceX={connectionStart()!.x}
                sourceY={connectionStart()!.y}
                targetX={connectionEnd()!.x}
                targetY={connectionEnd()!.y}
              />
            </Show>
          </g>

          {/* Nodes layer */}
          <g class="factory-nodes-layer">
            <For each={props.nodes}>
              {(node) =>
                props.nodeRenderer ? props.nodeRenderer(node) : renderDefaultNode(node)
              }
            </For>
          </g>
        </g>
      </svg>

      {/* Selection Box */}
      <Show when={isSelecting()}>
        {(() => {
          const bounds = selectionBounds();
          if (!bounds) return null;

          // Convert to screen coordinates
          const start = canvasToScreen(bounds.startX, bounds.startY);
          const end = canvasToScreen(bounds.endX, bounds.endY);

          return (
            <SelectionBox
              active={true}
              bounds={{
                startX: start.x,
                startY: start.y,
                endX: end.x,
                endY: end.y,
              }}
            />
          );
        })()}
      </Show>

      {/* Toolbar */}
      <Show when={props.toolbarVisible !== false}>
        <CanvasToolbar
          zoom={viewport().zoom}
          gridVisible={gridVisible()}
          snapToGrid={snapToGrid()}
          canUndo={props.canUndo ?? false}
          canRedo={props.canRedo ?? false}
          hasSelection={hasSelection()}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={zoomReset}
          onFitView={fitView}
          onUndo={props.onUndo}
          onRedo={props.onRedo}
          onDeleteSelected={props.onDeleteSelected}
        />
      </Show>

      {/* Minimap */}
      <Show when={props.minimapVisible !== false}>
        <MiniMap
          nodes={minimapNodes()}
          viewport={minimapViewport()}
          onNavigate={handleMinimapNavigate}
          onViewportDrag={handleMinimapViewportDrag}
        />
      </Show>
    </div>
  );
}

export default FactoryCanvas;

