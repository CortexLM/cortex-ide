/**
 * BracketPairColorization - Renderless SolidJS component for bracket pair
 * colorization and bracket pair guide configuration.
 *
 * Reactively applies Monaco editor options for bracket pair colorization
 * and bracket guides based on user settings. Listens for window events
 * to toggle settings at runtime.
 *
 * This component is part of the CodeEditor refactor that splits the monolithic
 * editor into focused, composable sub-components.
 */

import { Component, createEffect, onCleanup, JSX } from "solid-js";
import { useSettings } from "@/context/SettingsContext";
import type * as Monaco from "monaco-editor";

// ============================================================================
// Types
// ============================================================================

export interface BracketPairColorizationProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  class?: string;
  style?: JSX.CSSProperties;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renderless component that configures Monaco editor's bracket pair
 * colorization and bracket pair guides via editor options.
 *
 * Event contract:
 * - "editor:toggle-bracket-colorization" → toggles bracket pair colorization
 * - "editor:toggle-bracket-guides"       → toggles bracket pair guides
 */
export const BracketPairColorization: Component<BracketPairColorizationProps> = (props) => {
  const { effectiveSettings, updateEditorSetting } = useSettings();

  const isEnabled = () => effectiveSettings().editor.bracketPairColorization ?? true;
  const guidesEnabled = () => effectiveSettings().editor.guidesBracketPairs ?? true;

  createEffect(() => {
    const editor = props.editor;
    if (!editor) return;

    const enabled = isEnabled();
    const guides = guidesEnabled();

    editor.updateOptions({
      bracketPairColorization: {
        enabled,
        independentColorPoolPerBracketType: true,
      },
      guides: {
        bracketPairs: guides,
        bracketPairsHorizontal: guides ? "active" : false,
        highlightActiveBracketPair: guides,
        indentation: true,
      },
    });
  });

  createEffect(() => {
    const handleToggle = () => {
      const newEnabled = !isEnabled();
      updateEditorSetting("bracketPairColorization", newEnabled);
    };

    const handleToggleGuides = () => {
      const newEnabled = !guidesEnabled();
      updateEditorSetting("guidesBracketPairs", newEnabled);
    };

    window.addEventListener("editor:toggle-bracket-colorization", handleToggle);
    window.addEventListener("editor:toggle-bracket-guides", handleToggleGuides);

    onCleanup(() => {
      window.removeEventListener("editor:toggle-bracket-colorization", handleToggle);
      window.removeEventListener("editor:toggle-bracket-guides", handleToggleGuides);
    });
  });

  return null;
};

export default BracketPairColorization;
