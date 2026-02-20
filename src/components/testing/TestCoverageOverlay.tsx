/**
 * TestCoverageOverlay.tsx
 * 
 * Monaco editor decorations for code coverage visualization.
 * - Green gutter for covered lines
 * - Red gutter for uncovered lines
 * - Yellow for partial coverage (branches)
 * - Hover shows hit count and branch info
 */

import { createEffect, onCleanup, createMemo } from "solid-js";
import * as monaco from "monaco-editor";
import { useTesting, LineCoverageData } from "@/context/TestingContext";

export interface TestCoverageOverlayProps {
  editor: monaco.editor.IStandaloneCodeEditor;
  filePath: string;
}

// CSS class names for coverage decorations
const COVERAGE_CLASSES = {
  covered: "coverage-line-covered",
  uncovered: "coverage-line-uncovered",
  partial: "coverage-line-partial",
  coveredGutter: "coverage-gutter-covered",
  uncoveredGutter: "coverage-gutter-uncovered",
  partialGutter: "coverage-gutter-partial",
} as const;

// Colors for overview ruler
const COVERAGE_COLORS = {
  covered: "var(--cortex-success)",    // Green
  uncovered: "var(--cortex-error)",  // Red
  partial: "var(--cortex-warning)",    // Yellow
} as const;

/**
 * Get decoration options for a line based on coverage status
 */
function getDecorationOptions(
  line: LineCoverageData,
  showInGutter: boolean = true
): monaco.editor.IModelDecorationOptions {
  const status = line.status;
  const color = COVERAGE_COLORS[status];
  
  // Build hover message
  let hoverMessage = `**Coverage:** ${line.hits} hit${line.hits !== 1 ? "s" : ""}`;
  if (line.branches) {
    hoverMessage += `\n\n**Branches:** ${line.branches.covered}/${line.branches.total} covered`;
    const branchPercent = Math.round((line.branches.covered / line.branches.total) * 100);
    hoverMessage += ` (${branchPercent}%)`;
  }

  const options: monaco.editor.IModelDecorationOptions = {
    isWholeLine: true,
    className: COVERAGE_CLASSES[status],
    overviewRuler: {
      color,
      position: monaco.editor.OverviewRulerLane.Left,
    },
    minimap: {
      color,
      position: monaco.editor.MinimapPosition.Gutter,
    },
    hoverMessage: {
      value: hoverMessage,
      isTrusted: true,
    },
    stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
  };

  if (showInGutter) {
    options.glyphMarginClassName = COVERAGE_CLASSES[`${status}Gutter` as keyof typeof COVERAGE_CLASSES];
    options.glyphMarginHoverMessage = {
      value: hoverMessage,
      isTrusted: true,
    };
  }

  return options;
}

/**
 * Injects coverage CSS styles into the document
 */
function injectCoverageStyles(): void {
  const styleId = "coverage-decoration-styles";
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    /* Coverage line backgrounds */
    .${COVERAGE_CLASSES.covered} {
      background-color: rgba(34, 197, 94, 0.15) !important;
    }
    .${COVERAGE_CLASSES.uncovered} {
      background-color: rgba(239, 68, 68, 0.15) !important;
    }
    .${COVERAGE_CLASSES.partial} {
      background-color: rgba(234, 179, 8, 0.15) !important;
    }
    
    /* Coverage gutter icons */
    .${COVERAGE_CLASSES.coveredGutter} {
      background-color: ${COVERAGE_COLORS.covered};
      width: 4px !important;
      margin-left: 3px;
      border-radius: var(--cortex-radius-sm);
    }
    .${COVERAGE_CLASSES.uncoveredGutter} {
      background-color: ${COVERAGE_COLORS.uncovered};
      width: 4px !important;
      margin-left: 3px;
      border-radius: var(--cortex-radius-sm);
    }
    .${COVERAGE_CLASSES.partialGutter} {
      background-color: ${COVERAGE_COLORS.partial};
      width: 4px !important;
      margin-left: 3px;
      border-radius: var(--cortex-radius-sm);
    }
    
    /* Ensure glyph margin is visible when coverage is shown */
    .monaco-editor .margin-view-overlays .glyph-margin {
      width: 20px !important;
    }
  `;
  document.head.appendChild(style);
}

export function TestCoverageOverlay(props: TestCoverageOverlayProps) {
  const testing = useTesting();
  let decorationIds: string[] = [];

  // Inject styles on mount
  injectCoverageStyles();

  // Get coverage data for this file
  const coverageData = createMemo(() => {
    if (!testing.state.showCoverageDecorations) {
      return null;
    }
    return testing.getCoverageForFile(props.filePath);
  });

  // Apply decorations when coverage data changes
  createEffect(() => {
    const coverage = coverageData();
    const model = props.editor.getModel();

    if (!model) {
      // Clear decorations if no model
      decorationIds = props.editor.deltaDecorations(decorationIds, []);
      return;
    }

    if (!coverage || coverage.lines.length === 0) {
      // Clear decorations if no coverage data
      decorationIds = props.editor.deltaDecorations(decorationIds, []);
      return;
    }

    // Build new decorations
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = coverage.lines.map((line) => ({
      range: new monaco.Range(line.lineNumber, 1, line.lineNumber, 1),
      options: getDecorationOptions(line, true),
    }));

    // Apply decorations
    decorationIds = props.editor.deltaDecorations(decorationIds, newDecorations);
  });

  // Listen for coverage updates
  createEffect(() => {
    const handleCoverageUpdated = (e: Event) => {
      const { files } = (e as CustomEvent).detail as { files: string[] };
      const normalizedPath = props.filePath.replace(/\\/g, "/");
      
      // Check if this file was updated
      if (files.some(f => f.replace(/\\/g, "/") === normalizedPath || 
                         f.replace(/\\/g, "/").endsWith(normalizedPath.split("/").pop() || ""))) {
        // Force re-render by accessing state (void expression to indicate intentional discard)
        void testing.getCoverageForFile(props.filePath);
      }
    };

    const handleCoverageVisibilityChanged = (e: Event) => {
      const { visible } = (e as CustomEvent).detail as { visible: boolean };
      if (!visible) {
        // Clear decorations when coverage is hidden
        decorationIds = props.editor.deltaDecorations(decorationIds, []);
      }
    };

    const handleCoverageCleared = () => {
      decorationIds = props.editor.deltaDecorations(decorationIds, []);
    };

    window.addEventListener("testing:coverage-updated", handleCoverageUpdated);
    window.addEventListener("testing:coverage-visibility-changed", handleCoverageVisibilityChanged);
    window.addEventListener("testing:coverage-cleared", handleCoverageCleared);

    onCleanup(() => {
      window.removeEventListener("testing:coverage-updated", handleCoverageUpdated);
      window.removeEventListener("testing:coverage-visibility-changed", handleCoverageVisibilityChanged);
      window.removeEventListener("testing:coverage-cleared", handleCoverageCleared);
    });
  });

  // Cleanup decorations on unmount
  onCleanup(() => {
    if (props.editor && decorationIds.length > 0) {
      props.editor.deltaDecorations(decorationIds, []);
    }
  });

  // This component renders nothing - it only manages decorations
  return null;
}

/**
 * Hook to easily integrate coverage overlay with any Monaco editor
 */
export function useCoverageOverlay(
  editor: () => monaco.editor.IStandaloneCodeEditor | null,
  filePath: () => string | null
) {
  const testing = useTesting();
  let decorationIds: string[] = [];

  createEffect(() => {
    const ed = editor();
    const path = filePath();
    
    if (!ed || !path || !testing.state.showCoverageDecorations) {
      // Clear decorations
      if (ed && decorationIds.length > 0) {
        decorationIds = ed.deltaDecorations(decorationIds, []);
      }
      return;
    }

    const coverage = testing.getCoverageForFile(path);
    const model = ed.getModel();

    if (!model || !coverage) {
      decorationIds = ed.deltaDecorations(decorationIds, []);
      return;
    }

    // Build and apply decorations
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = coverage.lines.map((line) => ({
      range: new monaco.Range(line.lineNumber, 1, line.lineNumber, 1),
      options: getDecorationOptions(line, true),
    }));

    decorationIds = ed.deltaDecorations(decorationIds, newDecorations);
  });

  onCleanup(() => {
    const ed = editor();
    if (ed && decorationIds.length > 0) {
      ed.deltaDecorations(decorationIds, []);
    }
  });
}

export default TestCoverageOverlay;

