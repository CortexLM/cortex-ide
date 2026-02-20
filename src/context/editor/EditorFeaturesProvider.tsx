/**
 * EditorFeaturesProvider - Context provider for managing editor feature state.
 *
 * Centralizes toggle state and visibility for editor sub-features such as
 * minimap, sticky scroll, breadcrumbs, bracket colorization, peek view,
 * and inline diff. Components consume this context to read/write feature flags.
 */

import { createContext, useContext, ParentProps } from "solid-js";
import { createStore } from "solid-js/store";

// ============================================================================
// Types
// ============================================================================

export type FoldingStrategy = "auto" | "indentation";

export interface EditorFeaturesState {
  minimapEnabled: boolean;
  stickyScrollEnabled: boolean;
  breadcrumbsEnabled: boolean;
  bracketColorizationEnabled: boolean;
  foldingStrategy: FoldingStrategy;
  peekViewVisible: boolean;
  inlineDiffVisible: boolean;
  maxStickyScrollLines: number;
}

export interface EditorFeaturesContextValue {
  state: EditorFeaturesState;
  toggleMinimap: () => void;
  toggleStickyScroll: () => void;
  toggleBreadcrumbs: () => void;
  toggleBracketColorization: () => void;
  setFoldingStrategy: (strategy: FoldingStrategy) => void;
  showPeekView: () => void;
  hidePeekView: () => void;
  showInlineDiff: () => void;
  hideInlineDiff: () => void;
  setMaxStickyScrollLines: (count: number) => void;
}

// ============================================================================
// Context
// ============================================================================

const EditorFeaturesContext = createContext<EditorFeaturesContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function EditorFeaturesProvider(props: ParentProps) {
  const [state, setState] = createStore<EditorFeaturesState>({
    minimapEnabled: true,
    stickyScrollEnabled: true,
    breadcrumbsEnabled: true,
    bracketColorizationEnabled: true,
    foldingStrategy: "auto",
    peekViewVisible: false,
    inlineDiffVisible: false,
    maxStickyScrollLines: 5,
  });

  const toggleMinimap = () => {
    setState("minimapEnabled", (v) => !v);
  };

  const toggleStickyScroll = () => {
    setState("stickyScrollEnabled", (v) => !v);
  };

  const toggleBreadcrumbs = () => {
    setState("breadcrumbsEnabled", (v) => !v);
  };

  const toggleBracketColorization = () => {
    setState("bracketColorizationEnabled", (v) => !v);
  };

  const setFoldingStrategy = (strategy: FoldingStrategy) => {
    setState("foldingStrategy", strategy);
  };

  const showPeekView = () => {
    setState("peekViewVisible", true);
  };

  const hidePeekView = () => {
    setState("peekViewVisible", false);
  };

  const showInlineDiff = () => {
    setState("inlineDiffVisible", true);
  };

  const hideInlineDiff = () => {
    setState("inlineDiffVisible", false);
  };

  const setMaxStickyScrollLines = (count: number) => {
    setState("maxStickyScrollLines", Math.max(1, Math.min(10, count)));
  };

  const value: EditorFeaturesContextValue = {
    state,
    toggleMinimap,
    toggleStickyScroll,
    toggleBreadcrumbs,
    toggleBracketColorization,
    setFoldingStrategy,
    showPeekView,
    hidePeekView,
    showInlineDiff,
    hideInlineDiff,
    setMaxStickyScrollLines,
  };

  return (
    <EditorFeaturesContext.Provider value={value}>
      {props.children}
    </EditorFeaturesContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useEditorFeatures(): EditorFeaturesContextValue {
  const ctx = useContext(EditorFeaturesContext);
  if (!ctx) {
    throw new Error("useEditorFeatures must be used within EditorFeaturesProvider");
  }
  return ctx;
}
