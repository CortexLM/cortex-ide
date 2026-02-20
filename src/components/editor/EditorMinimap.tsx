/**
 * EditorMinimap - Renderless SolidJS component for minimap configuration.
 *
 * Currently a no-op since minimap settings are applied as part of the base
 * editor construction options in CodeEditor. This component exists as a
 * placeholder for future custom minimap rendering or overlay logic.
 *
 * This component is part of the CodeEditor refactor that splits the monolithic
 * editor into focused, composable sub-components.
 */

import type * as Monaco from "monaco-editor";

// ============================================================================
// Types
// ============================================================================

export interface EditorMinimapProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renderless component for minimap configuration and customization.
 *
 * Minimap settings (enabled, side, renderCharacters, scale, etc.) are
 * currently configured via the base editor options object. This component
 * is reserved for future enhancements such as custom minimap overlays,
 * heatmap rendering, or dynamic minimap toggling based on file size.
 */
export function EditorMinimap(
  _props: EditorMinimapProps,
): null {
  return null;
}
