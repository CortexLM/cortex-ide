/**
 * BracketPairColorizer - SolidJS component for bracket pair colorization
 * configuration with custom color support.
 *
 * Manages bracket pair colorization and guide line settings via Monaco
 * editor options. Supports custom color palettes and configurable max
 * nesting depth.
 */

import { createEffect, onCleanup, createMemo } from "solid-js";
import type * as Monaco from "monaco-editor";

// ============================================================================
// Types
// ============================================================================

export interface BracketPairColorizerProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  enabled?: boolean;
  colors?: string[];
  maxNestingDepth?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BRACKET_COLORS = [
  "#ffd700",
  "#da70d6",
  "#179fff",
  "#00ff7f",
  "#ff6347",
  "#87ceeb",
];

// ============================================================================
// Component
// ============================================================================

export function BracketPairColorizer(props: BracketPairColorizerProps) {
  const enabled = createMemo(() => props.enabled ?? true);
  const colors = createMemo(() => props.colors ?? DEFAULT_BRACKET_COLORS);
  const maxDepth = createMemo(() => props.maxNestingDepth ?? 6);

  function applyColorization() {
    const editor = props.editor;
    const monaco = props.monaco;
    if (!editor || !monaco) return;

    const isEnabled = enabled();

    editor.updateOptions({
      bracketPairColorization: {
        enabled: isEnabled,
        independentColorPoolPerBracketType: true,
      },
      guides: {
        bracketPairs: isEnabled,
        bracketPairsHorizontal: isEnabled ? "active" : false,
        highlightActiveBracketPair: isEnabled,
        indentation: true,
      },
    });
  }

  function applyCustomThemeColors() {
    const monaco = props.monaco;
    if (!monaco || !enabled()) return;

    const bracketColors = colors();
    const depth = maxDepth();
    const rules: Monaco.editor.ITokenThemeRule[] = [];

    for (let i = 0; i < Math.min(bracketColors.length, depth); i++) {
      rules.push({
        token: `bracket.depth${i + 1}`,
        foreground: bracketColors[i].replace("#", ""),
      });
    }

    try {
      monaco.editor.defineTheme("cortex-dark-brackets", {
        base: "vs-dark",
        inherit: true,
        rules,
        colors: {},
      });
    } catch {
      /* Theme may already be defined or not applicable */
    }
  }

  createEffect(() => {
    void enabled();
    void colors();
    void maxDepth();
    void props.editor;
    applyColorization();
    applyCustomThemeColors();
  });

  createEffect(() => {
    const editor = props.editor;
    if (!editor) return;

    const handleToggle = () => {
      applyColorization();
    };

    window.addEventListener("editor-toggle-bracket-colorizer", handleToggle);

    onCleanup(() => {
      window.removeEventListener("editor-toggle-bracket-colorizer", handleToggle);
    });
  });

  return null;
}
