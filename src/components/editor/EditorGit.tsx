/**
 * EditorGitIntegration - Renderless SolidJS component for inline git blame.
 *
 * Manages the InlineBlameManager lifecycle per file. When the active file
 * changes, the manager is re-initialized so blame annotations stay in sync
 * with the currently visible file.
 *
 * This component is part of the CodeEditor refactor that splits the monolithic
 * editor into focused, composable sub-components.
 */

import { createEffect, onCleanup } from "solid-js";
import type * as Monaco from "monaco-editor";
import { InlineBlameManager, getInlineBlameMode } from "./InlineBlame";

// ============================================================================
// Types
// ============================================================================

export interface EditorGitIntegrationProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  filePath: string | null;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renderless component that manages inline git blame decorations.
 *
 * Responsibilities:
 * - Creates and owns an InlineBlameManager instance
 * - Re-initializes blame data whenever the active file path changes
 * - Disposes the manager on component cleanup
 */
export function EditorGitIntegration(
  props: EditorGitIntegrationProps,
): null {
  let inlineBlameManager: InlineBlameManager | null = null;

  createEffect(() => {
    const editor = props.editor;
    const monaco = props.monaco;
    const filePath = props.filePath;

    if (!editor || !monaco || !filePath) {
      return;
    }

    if (!inlineBlameManager) {
      inlineBlameManager = new InlineBlameManager();
    }

    inlineBlameManager.initialize(
      editor,
      monaco,
      filePath,
      getInlineBlameMode(),
      true,
      50,
    );
  });

  onCleanup(() => {
    if (inlineBlameManager) {
      inlineBlameManager.dispose();
      inlineBlameManager = null;
    }
  });

  return null;
}
