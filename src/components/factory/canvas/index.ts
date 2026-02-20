/**
 * Factory Canvas Components
 * 
 * Node-based workflow editor canvas for the Agent Factory.
 * Similar to n8n or React Flow.
 */

// Main canvas component
export { FactoryCanvas } from "./FactoryCanvas";
export type {
  FactoryCanvasProps,
  CanvasNode,
  CanvasPort,
  CanvasEdge,
  CanvasViewport,
} from "./FactoryCanvas";

// Canvas background/grid
export { CanvasBackground } from "./CanvasBackground";
export type {
  CanvasBackgroundProps,
  GridPattern,
} from "./CanvasBackground";

// Canvas toolbar
export { CanvasToolbar } from "./CanvasToolbar";
export type { CanvasToolbarProps } from "./CanvasToolbar";

// Connection/edge rendering
export { ConnectionLine, TempConnectionLine } from "./ConnectionLine";
export type {
  ConnectionLineProps,
  TempConnectionLineProps,
  EdgeType,
  EdgeLabel,
} from "./ConnectionLine";

// Selection box for multi-select
export { SelectionBox, isNodeInSelection } from "./SelectionBox";
export type {
  SelectionBoxProps,
  SelectionBoxBounds,
} from "./SelectionBox";

// Minimap overview
export { MiniMap } from "./MiniMap";
export type {
  MiniMapProps,
  MiniMapNode,
  MiniMapViewport,
} from "./MiniMap";

// Default export
export { default } from "./FactoryCanvas";
