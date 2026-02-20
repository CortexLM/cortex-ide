/**
 * useCoverage Hook
 *
 * Extracted from CodeEditor.tsx - manages code coverage decorations
 * for displaying test coverage information in the editor gutter.
 */

import type * as Monaco from "monaco-editor";

export type LineCoverageStatus = "covered" | "uncovered" | "partial";

export interface LineCoverageData {
  lineNumber: number;
  status: LineCoverageStatus;
  hits?: number;
  branches?: { covered: number; total: number };
}

export interface CoverageSettings {
  enabled: boolean;
  showInGutter: boolean;
  showInOverviewRuler: boolean;
  showInMinimap: boolean;
}

const DEFAULT_COVERAGE_SETTINGS: CoverageSettings = {
  enabled: true,
  showInGutter: true,
  showInOverviewRuler: true,
  showInMinimap: true,
};

function getCoverageColor(status: LineCoverageStatus): string {
  switch (status) {
    case "covered":
      return "var(--cortex-success, #22c55e)";
    case "uncovered":
      return "var(--cortex-error, #ef4444)";
    case "partial":
      return "var(--cortex-warning, #f59e0b)";
    default:
      return "transparent";
  }
}

function getCoverageGlyphClass(status: LineCoverageStatus): string {
  switch (status) {
    case "covered":
      return "coverage-glyph-covered";
    case "uncovered":
      return "coverage-glyph-uncovered";
    case "partial":
      return "coverage-glyph-partial";
    default:
      return "";
  }
}

function createCoverageDecoration(
  lineNumber: number,
  status: LineCoverageStatus,
  hits: number | undefined,
  branches: { covered: number; total: number } | undefined,
  monaco: typeof Monaco,
  settings: CoverageSettings
): Monaco.editor.IModelDeltaDecoration | null {
  const color = getCoverageColor(status);
  const glyphClass = getCoverageGlyphClass(status);

  let hoverMessage = "";
  if (status === "covered") {
    hoverMessage = hits !== undefined ? `Covered (${hits} hits)` : "Covered";
  } else if (status === "uncovered") {
    hoverMessage = "Not covered";
  } else if (status === "partial") {
    if (branches) {
      hoverMessage = `Partial coverage: ${branches.covered}/${branches.total} branches`;
    } else {
      hoverMessage = "Partially covered";
    }
  }

  const options: Monaco.editor.IModelDecorationOptions = {
    isWholeLine: true,
    hoverMessage: { value: hoverMessage },
  };

  if (settings.showInGutter) {
    options.glyphMarginClassName = glyphClass;
    options.glyphMarginHoverMessage = { value: hoverMessage };
  }

  if (settings.showInOverviewRuler) {
    options.overviewRuler = {
      color: color,
      position: monaco.editor.OverviewRulerLane.Left,
    };
  }

  if (settings.showInMinimap) {
    options.minimap = {
      color: color,
      position: monaco.editor.MinimapPosition.Gutter,
    };
  }

  return {
    range: new monaco.Range(lineNumber, 1, lineNumber, 1),
    options,
  };
}

export interface CoverageManager {
  dispose: () => void;
  updateSettings: (settings: Partial<CoverageSettings>) => void;
  getSettings: () => CoverageSettings;
  applyCoverage: (coverageLines: LineCoverageData[]) => void;
  clearCoverage: () => void;
}

export function createCoverageManager(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  initialSettings?: Partial<CoverageSettings>
): CoverageManager {
  let settings: CoverageSettings = { ...DEFAULT_COVERAGE_SETTINGS, ...initialSettings };
  let coverageDecorations: string[] = [];

  return {
    dispose: () => {
      coverageDecorations = editor.deltaDecorations(coverageDecorations, []);
    },
    updateSettings: (newSettings: Partial<CoverageSettings>) => {
      settings = { ...settings, ...newSettings };
    },
    getSettings: () => ({ ...settings }),
    applyCoverage: (coverageLines: LineCoverageData[]) => {
      if (!settings.enabled) {
        coverageDecorations = editor.deltaDecorations(coverageDecorations, []);
        return;
      }

      const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];

      for (const line of coverageLines) {
        const decoration = createCoverageDecoration(
          line.lineNumber,
          line.status,
          line.hits,
          line.branches,
          monaco,
          settings
        );
        if (decoration) {
          newDecorations.push(decoration);
        }
      }

      coverageDecorations = editor.deltaDecorations(coverageDecorations, newDecorations);
    },
    clearCoverage: () => {
      coverageDecorations = editor.deltaDecorations(coverageDecorations, []);
    },
  };
}

export function getCoverageEditorStyles(): string {
  return `
    .coverage-glyph-covered {
      background-color: var(--cortex-success, #22c55e);
      width: 4px !important;
      margin-left: 3px;
      border-radius: 1px;
    }
    .coverage-glyph-uncovered {
      background-color: var(--cortex-error, #ef4444);
      width: 4px !important;
      margin-left: 3px;
      border-radius: 1px;
    }
    .coverage-glyph-partial {
      background-color: var(--cortex-warning, #f59e0b);
      width: 4px !important;
      margin-left: 3px;
      border-radius: 1px;
    }
  `;
}
