/**
 * =============================================================================
 * ORION LAYOUT SYSTEM - Main Export
 * =============================================================================
 * 
 * This is the main entry point for the Orion Layout System.
 * Import layout components and hooks from here:
 * 
 *   import { Panel, SplitView, useLayoutStore } from '@/layout';
 * 
 * =============================================================================
 */

// Layout Engine
export {
  layoutState,
  setLayoutState,
  layoutActions,
  splitActions,
  globalLayoutActions,
  layoutSelectors,
  useLayoutStore,
} from "./engine/LayoutStore";

export type {
  DockPosition,
  SplitOrientation,
  PanelState,
  SplitState,
  LayoutState,
} from "./engine/LayoutStore";

// Containers
export { Panel } from "./containers/Panel";
export type { PanelProps, PanelPosition } from "./containers/Panel";

export { SplitView, HSplit, VSplit } from "./containers/SplitView";
export type { SplitViewProps } from "./containers/SplitView";

// Hooks
export { useResize, getResizeHandleStyle } from "./hooks/useResize";
export type { UseResizeOptions, UseResizeReturn, ResizeDirection } from "./hooks/useResize";

export {
  useContainerQuery,
  useContainerSize,
  useIsCompact,
  useContainerSizeClass,
} from "./hooks/useContainerQuery";
export type {
  ContainerSize,
  ContainerBreakpoints,
  CustomBreakpoint,
  UseContainerQueryOptions,
  UseContainerQueryReturn,
} from "./hooks/useContainerQuery";
