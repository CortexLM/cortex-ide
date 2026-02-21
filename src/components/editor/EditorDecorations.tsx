/**
 * EditorDecorations - Renderless SolidJS component for editor decoration management.
 *
 * This component serves as a thin wrapper / documentation layer for the various
 * decoration systems used by the CodeEditor. In the current architecture,
 * decorations are primarily managed through window events dispatched by
 * EditorEventHandlers and applied directly to the Monaco editor instance.
 *
 * Decoration categories managed via events:
 *
 * 1. **Debug Inline Values**
 *    - Event: "debug:inline-values-updated" / "debug:cleared"
 *    - Shows variable values inline during debugging sessions
 *    - Uses Monaco `afterLineContent` decorations
 *
 * 2. **Test Coverage**
 *    - Events: "testing:coverage-updated" / "testing:coverage-cleared"
 *             / "testing:coverage-visibility-changed"
 *    - Highlights covered/uncovered lines with gutter indicators
 *    - Managed via `applyCoverageDecorations` / `clearCoverageDecorations`
 *
 * 3. **Buffer Search Highlights**
 *    - Event: "buffer-search:highlights"
 *    - Highlights search matches with current-match emphasis
 *    - Uses overview ruler and minimap indicators
 *
 * 4. **Linked Editing Ranges**
 *    - Managed by `setupLinkedEditing` in the main editor
 *    - Highlights matching HTML/JSX tag pairs for synchronized editing
 *
 * 5. **Git Gutter Decorations**
 *    - Managed by the separate `GitGutterDecorations` component
 *    - Shows added/modified/deleted indicators in the gutter
 *
 * 6. **Inline Git Blame**
 *    - Managed by the separate `EditorGitIntegration` component
 *    - Shows blame annotations after line content
 *
 * This component is part of the CodeEditor refactor that splits the monolithic
 * editor into focused, composable sub-components. It currently acts as a
 * placeholder for future centralized decoration management.
 */

import type * as Monaco from "monaco-editor";

// ============================================================================
// Types
// ============================================================================

export interface EditorDecorationsProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renderless component that documents and coordinates editor decorations.
 *
 * Currently a no-op — decoration lifecycle is handled by event listeners
 * registered in the main CodeEditor setup. This component exists to:
 * - Provide a clear ownership boundary for decoration concerns
 * - Serve as the future home for centralized decoration management
 * - Document the decoration patterns used across the editor
 */
export function EditorDecorations(
  _props: EditorDecorationsProps,
): null {
  return null;
}
