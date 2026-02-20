import {
  createSignal,
  createEffect,
  createMemo,
  Show,
  For,
  onMount,
  onCleanup,
  batch,
} from "solid-js";
import { Icon } from "../ui/Icon";
import { MonacoManager } from "@/utils/monacoManager";
import type * as Monaco from "monaco-editor";

// ============================================================================
// Types and Interfaces
// ============================================================================

/** Represents a parsed conflict region in the file */
export interface ConflictRegion {
  /** Unique identifier for this conflict */
  id: string;
  /** Conflict index (1-indexed) */
  index: number;
  /** Starting line number (1-indexed) of the conflict marker <<<<<<< */
  startLine: number;
  /** Ending line number (1-indexed) of the conflict marker >>>>>>> */
  endLine: number;
  /** Line number of the separator ======= */
  separatorLine: number;
  /** Line number of the optional base marker ||||||| (for diff3 style) */
  baseMarkerLine?: number;
  /** Content from the current branch (ours) */
  oursContent: string[];
  /** Content from the incoming branch (theirs) */
  theirsContent: string[];
  /** Content from the common ancestor (base) if available */
  baseContent?: string[];
  /** Label from the ours marker (e.g., "HEAD") */
  oursLabel: string;
  /** Label from the theirs marker (e.g., "feature-branch") */
  theirsLabel: string;
  /** Whether this conflict has been resolved */
  resolved: boolean;
  /** The resolution type if resolved */
  resolution?: "ours" | "theirs" | "both" | "both-reverse" | "manual";
  /** The resolved content */
  resolvedContent?: string[];
}

/** View mode for the merge editor */
export type MergeViewMode = "three-way" | "two-way" | "result-only";

/** Props for the MergeEditor component */
export interface MergeEditorProps {
  /** The file path being merged */
  filePath: string;
  /** Raw content with conflict markers */
  conflictedContent: string;
  /** Language mode for syntax highlighting */
  language?: string;
  /** Callback when merge is saved */
  onSave?: (mergedContent: string) => void;
  /** Callback when merge is cancelled */
  onCancel?: () => void;
  /** Callback when all conflicts are resolved */
  onAllResolved?: () => void;
  /** Callback when file is marked as resolved */
  onMarkResolved?: () => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Initial view mode */
  initialViewMode?: MergeViewMode;
  /** Show base content if available (diff3 style) */
  showBase?: boolean;
}

/** Internal state for editor instances */
interface EditorInstances {
  ours: Monaco.editor.IStandaloneCodeEditor | null;
  result: Monaco.editor.IStandaloneCodeEditor | null;
  theirs: Monaco.editor.IStandaloneCodeEditor | null;
  diffEditor: Monaco.editor.IStandaloneDiffEditor | null;
}

/** Decoration collections for conflict highlighting */
interface ConflictDecorations {
  ours: string[];
  result: string[];
  theirs: string[];
}

/** CodeLens action provider */
interface ConflictCodeLensProvider {
  id: number;
  dispose: () => void;
}

// ============================================================================
// Conflict Parsing Utilities
// ============================================================================

/** Regex patterns for conflict markers */
const CONFLICT_START_PATTERN = /^<{7}\s*(.*)$/;
const CONFLICT_BASE_PATTERN = /^\|{7}\s*(.*)$/;
const CONFLICT_SEPARATOR_PATTERN = /^={7}$/;
const CONFLICT_END_PATTERN = /^>{7}\s*(.*)$/;

/**
 * Parses content with conflict markers and extracts conflict regions.
 * Supports both standard (2-way) and diff3 (3-way) conflict markers.
 * @param content - The raw file content with git conflict markers
 * @returns Object containing parsed conflicts and extracted content for each pane
 */
export function parseConflictMarkers(content: string): {
  conflicts: ConflictRegion[];
  oursContent: string;
  theirsContent: string;
  resultContent: string;
  hasBaseContent: boolean;
} {
  const lines = content.split("\n");
  const conflicts: ConflictRegion[] = [];
  const oursLines: string[] = [];
  const theirsLines: string[] = [];
  const resultLines: string[] = [];

  let inConflict = false;
  let inOurs = false;
  let inBase = false;
  let inTheirs = false;
  let currentConflict: Partial<ConflictRegion> | null = null;
  let conflictIndex = 0;
  let hasBaseContent = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    const startMatch = line.match(CONFLICT_START_PATTERN);
    const baseMatch = line.match(CONFLICT_BASE_PATTERN);
    const separatorMatch = line.match(CONFLICT_SEPARATOR_PATTERN);
    const endMatch = line.match(CONFLICT_END_PATTERN);

    if (startMatch && !inConflict) {
      // Start of a conflict region
      inConflict = true;
      inOurs = true;
      inBase = false;
      inTheirs = false;
      conflictIndex++;
      currentConflict = {
        id: `conflict-${conflictIndex}`,
        index: conflictIndex,
        startLine: lineNumber,
        oursLabel: startMatch[1]?.trim() || "HEAD",
        oursContent: [],
        theirsContent: [],
        baseContent: [],
        resolved: false,
      };
    } else if (baseMatch && inConflict && inOurs) {
      // Base marker (diff3 style)
      inOurs = false;
      inBase = true;
      hasBaseContent = true;
      if (currentConflict) {
        currentConflict.baseMarkerLine = lineNumber;
      }
    } else if (separatorMatch && inConflict && (inOurs || inBase)) {
      // Separator between ours/base and theirs
      inOurs = false;
      inBase = false;
      inTheirs = true;
      if (currentConflict) {
        currentConflict.separatorLine = lineNumber;
      }
    } else if (endMatch && inConflict && inTheirs) {
      // End of conflict region
      if (currentConflict) {
        currentConflict.endLine = lineNumber;
        currentConflict.theirsLabel = endMatch[1]?.trim() || "incoming";
        conflicts.push(currentConflict as ConflictRegion);

        // Add ours content to ours pane
        oursLines.push(...currentConflict.oursContent!);
        // Add theirs content to theirs pane
        theirsLines.push(...currentConflict.theirsContent!);
        // Keep conflict markers in result pane (will be replaced when resolved)
        for (let j = currentConflict.startLine! - 1; j < lineNumber; j++) {
          resultLines.push(lines[j]);
        }
      }
      inConflict = false;
      inOurs = false;
      inBase = false;
      inTheirs = false;
      currentConflict = null;
    } else if (inConflict) {
      // Inside a conflict region
      if (inOurs && currentConflict) {
        currentConflict.oursContent!.push(line);
      } else if (inBase && currentConflict) {
        currentConflict.baseContent!.push(line);
      } else if (inTheirs && currentConflict) {
        currentConflict.theirsContent!.push(line);
      }
    } else {
      // Regular line outside conflict
      oursLines.push(line);
      theirsLines.push(line);
      resultLines.push(line);
    }
  }

  return {
    conflicts,
    oursContent: oursLines.join("\n"),
    theirsContent: theirsLines.join("\n"),
    resultContent: resultLines.join("\n"),
    hasBaseContent,
  };
}

/**
 * Builds the result content by applying resolved conflicts to the original content.
 * @param originalContent - The original conflicted content
 * @param conflicts - Array of conflict regions with resolutions
 * @returns The merged content with conflicts resolved
 */
function buildResultContent(
  originalContent: string,
  conflicts: ConflictRegion[]
): string {
  if (conflicts.length === 0) {
    return originalContent;
  }

  const lines = originalContent.split("\n");
  const resultLines: string[] = [];
  let currentLine = 0;

  // Sort conflicts by start line
  const sortedConflicts = [...conflicts].sort((a, b) => a.startLine - b.startLine);

  for (const conflict of sortedConflicts) {
    // Add lines before this conflict
    while (currentLine < conflict.startLine - 1) {
      resultLines.push(lines[currentLine]);
      currentLine++;
    }

    // Add resolved content or keep conflict markers
    if (conflict.resolved && conflict.resolvedContent) {
      resultLines.push(...conflict.resolvedContent);
    } else {
      // Keep conflict markers if not resolved
      for (let i = conflict.startLine - 1; i < conflict.endLine; i++) {
        resultLines.push(lines[i]);
      }
    }

    // Skip past the conflict in the original
    currentLine = conflict.endLine;
  }

  // Add remaining lines after last conflict
  while (currentLine < lines.length) {
    resultLines.push(lines[currentLine]);
    currentLine++;
  }

  return resultLines.join("\n");
}

/**
 * Extracts clean content for a specific side (ours or theirs) from conflicted content.
 * @param originalContent - The original conflicted content
 * @param conflicts - Array of conflict regions
 * @param side - Which side to extract ("ours" or "theirs")
 * @returns Clean content with only the specified side's changes
 */
function extractSideContent(
  originalContent: string,
  conflicts: ConflictRegion[],
  side: "ours" | "theirs"
): string {
  if (conflicts.length === 0) {
    return originalContent;
  }

  const lines = originalContent.split("\n");
  const resultLines: string[] = [];
  let currentLine = 0;

  const sortedConflicts = [...conflicts].sort((a, b) => a.startLine - b.startLine);

  for (const conflict of sortedConflicts) {
    // Add lines before this conflict
    while (currentLine < conflict.startLine - 1) {
      resultLines.push(lines[currentLine]);
      currentLine++;
    }

    // Add the selected side's content
    const content = side === "ours" ? conflict.oursContent : conflict.theirsContent;
    resultLines.push(...content);

    // Skip past the conflict in the original
    currentLine = conflict.endLine;
  }

  // Add remaining lines after last conflict
  while (currentLine < lines.length) {
    resultLines.push(lines[currentLine]);
    currentLine++;
  }

  return resultLines.join("\n");
}

/**
 * Calculate line mapping between original conflicted content and clean side content.
 * Used for synchronized scrolling. (Prepared for advanced scroll sync)
 */
// function calculateLineMapping(
//   conflicts: ConflictRegion[],
//   totalLines: number
// ): Map<number, { ours: number; theirs: number }> {
//   const mapping = new Map<number, { ours: number; theirs: number }>();
//   let oursOffset = 0;
//   let theirsOffset = 0;
//   let currentConflict = 0;
//   for (let line = 1; line <= totalLines; line++) {
//     const conflict = conflicts[currentConflict];
//     if (conflict && line >= conflict.startLine && line <= conflict.endLine) {
//       const conflictLines = conflict.endLine - conflict.startLine + 1;
//       const oursLines = conflict.oursContent.length;
//       const theirsLines = conflict.theirsContent.length;
//       mapping.set(line, {
//         ours: conflict.startLine - oursOffset,
//         theirs: conflict.startLine - theirsOffset,
//       });
//       if (line === conflict.endLine) {
//         oursOffset += conflictLines - oursLines;
//         theirsOffset += conflictLines - theirsLines;
//         currentConflict++;
//       }
//     } else {
//       mapping.set(line, {
//         ours: line - oursOffset,
//         theirs: line - theirsOffset,
//       });
//     }
//   }
//   return mapping;
// }

// ============================================================================
// MergeEditor Component
// ============================================================================

/**
 * MergeEditor - A production-quality 3-way merge editor for resolving Git conflicts.
 *
 * Features:
 * - Three synchronized Monaco editor panes (Ours, Result, Theirs)
 * - Two-way diff view mode for comparing changes
 * - Automatic conflict marker parsing (supports both 2-way and diff3 3-way markers)
 * - Per-conflict resolution buttons (Accept Current, Accept Incoming, Accept Both)
 * - CodeLens-style inline buttons above each conflict
 * - Manual editing in the result pane
 * - Synchronized scrolling between panes
 * - Keyboard navigation between conflicts (F7/Shift+F7)
 * - Bulk actions (Accept All Current, Accept All Incoming)
 * - Conflict count and resolved indicator
 * - Save merged result and mark as resolved
 * - Fullscreen mode
 */
export function MergeEditor(props: MergeEditorProps) {
  // Container refs for Monaco editor mounting
  let oursContainerRef: HTMLDivElement | undefined;
  let resultContainerRef: HTMLDivElement | undefined;
  let theirsContainerRef: HTMLDivElement | undefined;
  let diffContainerRef: HTMLDivElement | undefined;

  // Monaco instance
  const [monaco, setMonaco] = createSignal<typeof Monaco | null>(null);
  const [isEditorReady, setIsEditorReady] = createSignal(false);

  // Editor instances
  const [editors, setEditors] = createSignal<EditorInstances>({
    ours: null,
    result: null,
    theirs: null,
    diffEditor: null,
  });

  // Conflict state
  const [conflicts, setConflicts] = createSignal<ConflictRegion[]>([]);
  const [currentConflictIndex, setCurrentConflictIndex] = createSignal(0);

  // Decorations for conflict highlighting
  const [decorations, setDecorations] = createSignal<ConflictDecorations>({
    ours: [],
    result: [],
    theirs: [],
  });

  // CodeLens provider reference
  let codeLensProvider: ConflictCodeLensProvider | null = null;

  // UI state
  const [viewMode, setViewMode] = createSignal<MergeViewMode>(
    props.initialViewMode || "three-way"
  );
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [syncScrolling, setSyncScrolling] = createSignal(true);
  const [showInlineActions, _setShowInlineActions] = createSignal(true);
  const [_showDiffDecorations, _setShowDiffDecorations] = createSignal(true);
  const [_hasBaseContent, setHasBaseContent] = createSignal(false);

  // Parsed content
  const [oursContent, setOursContent] = createSignal("");
  const [theirsContent, setTheirsContent] = createSignal("");
  const [resultContent, setResultContent] = createSignal("");

  // Track if scroll sync is in progress to prevent loops
  let isScrollSyncing = false;

  // ============================================================================
  // Computed Values
  // ============================================================================

  /** Total number of conflicts */
  const conflictCount = createMemo(() => conflicts().length);

  /** Number of resolved conflicts */
  const resolvedCount = createMemo(() =>
    conflicts().filter((c) => c.resolved).length
  );

  /** Whether all conflicts are resolved */
  const allResolved = createMemo(
    () => conflictCount() > 0 && resolvedCount() === conflictCount()
  );

  /** Number of remaining unresolved conflicts */
  const remainingCount = createMemo(() => conflictCount() - resolvedCount());

  /** Current conflict being viewed */
  const currentConflict = createMemo(() => {
    const idx = currentConflictIndex();
    const allConflicts = conflicts();
    return allConflicts[idx] || null;
  });

  /** Labels for ours and theirs from first conflict */
  const labels = createMemo(() => {
    const allConflicts = conflicts();
    if (allConflicts.length === 0) {
      return { ours: "Current (Ours)", theirs: "Incoming (Theirs)" };
    }
    return {
      ours: allConflicts[0].oursLabel || "HEAD",
      theirs: allConflicts[0].theirsLabel || "incoming",
    };
  });

  /** Progress percentage */
  const progressPercent = createMemo(() => {
    if (conflictCount() === 0) return 100;
    return Math.round((resolvedCount() / conflictCount()) * 100);
  });

  /** File name from path */
  const fileName = createMemo(() => {
    const parts = props.filePath.split(/[/\\]/);
    return parts[parts.length - 1];
  });

  // ============================================================================
  // Monaco Editor Setup
  // ============================================================================

  /** Detect language from file extension */
  function detectLanguage(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const languageMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescriptreact",
      js: "javascript",
      jsx: "javascriptreact",
      py: "python",
      rs: "rust",
      go: "go",
      java: "java",
      kt: "kotlin",
      c: "c",
      cpp: "cpp",
      h: "cpp",
      hpp: "cpp",
      cs: "csharp",
      rb: "ruby",
      php: "php",
      swift: "swift",
      json: "json",
      yaml: "yaml",
      yml: "yaml",
      xml: "xml",
      html: "html",
      css: "css",
      scss: "scss",
      less: "less",
      md: "markdown",
      sql: "sql",
      sh: "shell",
      bash: "shell",
      zsh: "shell",
      vue: "vue",
      svelte: "svelte",
    };
    return languageMap[ext] || "plaintext";
  }

  /** Initialize Monaco editors */
  onMount(async () => {
    try {
      const monacoInstance = await MonacoManager.getInstance().ensureLoaded();
      setMonaco(monacoInstance);

      // Parse initial content
      const parsed = parseConflictMarkers(props.conflictedContent);
      batch(() => {
        setConflicts(parsed.conflicts);
        setOursContent(
          extractSideContent(props.conflictedContent, parsed.conflicts, "ours")
        );
        setTheirsContent(
          extractSideContent(props.conflictedContent, parsed.conflicts, "theirs")
        );
        setResultContent(
          buildResultContent(props.conflictedContent, parsed.conflicts)
        );
        setHasBaseContent(parsed.hasBaseContent);
      });

      // Define merge editor theme
      monacoInstance.editor.defineTheme("merge-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": "var(--cortex-bg-primary)",
          "editorLineNumber.foreground": "var(--cortex-bg-active)",
          "editorGutter.background": "var(--cortex-bg-primary)",
        },
      });

      // Create editor options
      const commonOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {
        language: props.language || detectLanguage(props.filePath),
        theme: "merge-dark",
        minimap: { enabled: false },
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fontSize: 13,
        fontFamily:
          "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, monospace",
        renderWhitespace: "selection",
        wordWrap: "off",
        glyphMargin: true,
        folding: true,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 4,
        scrollbar: {
          vertical: "visible",
          horizontal: "visible",
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
        padding: { top: 8 },
      };

      // Create ours editor (read-only)
      if (oursContainerRef) {
        const oursEditor = monacoInstance.editor.create(oursContainerRef, {
          ...commonOptions,
          value: oursContent(),
          readOnly: true,
        });

        // Sync scroll from ours editor
        oursEditor.onDidScrollChange((scrollEvent: Monaco.IScrollEvent) => {
          if (!syncScrolling() || isScrollSyncing) return;
          isScrollSyncing = true;
          const eds = editors();
          if (eds.result) eds.result.setScrollTop(scrollEvent.scrollTop);
          if (eds.theirs) eds.theirs.setScrollTop(scrollEvent.scrollTop);
          setTimeout(() => {
            isScrollSyncing = false;
          }, 10);
        });

        setEditors((prev) => ({ ...prev, ours: oursEditor }));
      }

      // Create result editor (editable)
      if (resultContainerRef) {
        const resultEditor = monacoInstance.editor.create(resultContainerRef, {
          ...commonOptions,
          value: resultContent(),
          readOnly: props.readOnly || false,
        });

        // Track manual edits
        resultEditor.onDidChangeModelContent(() => {
          const content = resultEditor.getValue();
          setResultContent(content);
          
          // Check if user manually edited a conflict region
          // (could mark as manual resolution)
        });

        // Sync scroll from result editor
        resultEditor.onDidScrollChange((scrollEvent: Monaco.IScrollEvent) => {
          if (!syncScrolling() || isScrollSyncing) return;
          isScrollSyncing = true;
          const eds = editors();
          if (eds.ours) eds.ours.setScrollTop(scrollEvent.scrollTop);
          if (eds.theirs) eds.theirs.setScrollTop(scrollEvent.scrollTop);
          setTimeout(() => {
            isScrollSyncing = false;
          }, 10);
        });

        setEditors((prev) => ({ ...prev, result: resultEditor }));
      }

      // Create theirs editor (read-only)
      if (theirsContainerRef) {
        const theirsEditor = monacoInstance.editor.create(theirsContainerRef, {
          ...commonOptions,
          value: theirsContent(),
          readOnly: true,
        });

        // Sync scroll from theirs editor
        theirsEditor.onDidScrollChange((scrollEvent: Monaco.IScrollEvent) => {
          if (!syncScrolling() || isScrollSyncing) return;
          isScrollSyncing = true;
          const eds = editors();
          if (eds.ours) eds.ours.setScrollTop(scrollEvent.scrollTop);
          if (eds.result) eds.result.setScrollTop(scrollEvent.scrollTop);
          setTimeout(() => {
            isScrollSyncing = false;
          }, 10);
        });

        setEditors((prev) => ({ ...prev, theirs: theirsEditor }));
      }

      // Register keyboard shortcuts
      const resultEd = editors().result;
      if (resultEd) {
        // F7 - Next conflict
        resultEd.addCommand(monacoInstance.KeyCode.F7, () => {
          navigateToNextConflict();
        });

        // Shift+F7 - Previous conflict
        resultEd.addCommand(
          monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.F7,
          () => {
            navigateToPreviousConflict();
          }
        );

        // Ctrl+Shift+A - Accept current for this conflict
        resultEd.addCommand(
          monacoInstance.KeyMod.CtrlCmd |
            monacoInstance.KeyMod.Shift |
            monacoInstance.KeyCode.KeyA,
          () => {
            acceptCurrent();
          }
        );

        // Ctrl+Shift+I - Accept incoming for this conflict
        resultEd.addCommand(
          monacoInstance.KeyMod.CtrlCmd |
            monacoInstance.KeyMod.Shift |
            monacoInstance.KeyCode.KeyI,
          () => {
            acceptIncoming();
          }
        );

        // Ctrl+Shift+B - Accept both for this conflict
        resultEd.addCommand(
          monacoInstance.KeyMod.CtrlCmd |
            monacoInstance.KeyMod.Shift |
            monacoInstance.KeyCode.KeyB,
          () => {
            acceptBoth();
          }
        );
      }

      // Apply initial decorations
      setIsEditorReady(true);
      applyConflictDecorations();
      registerCodeLensProvider(monacoInstance);

      // Navigate to first conflict
      if (parsed.conflicts.length > 0) {
        navigateToConflict(0);
      }
    } catch (error) {
      console.error("Failed to initialize Monaco editor:", error);
    }
  });

  /** Cleanup Monaco editors on unmount */
  onCleanup(() => {
    const eds = editors();
    eds.ours?.dispose?.();
    eds.result?.dispose?.();
    eds.theirs?.dispose?.();
    eds.diffEditor?.dispose?.();

    if (codeLensProvider) {
      codeLensProvider.dispose();
    }
  });

  // ============================================================================
  // CodeLens Provider for Inline Conflict Actions
  // ============================================================================

  /** Register CodeLens provider for inline conflict actions */
  function registerCodeLensProvider(monacoInstance: typeof Monaco) {
    const eds = editors();
    const resultEditor = eds.result;
    if (!resultEditor) return;

    // Dispose existing provider
    if (codeLensProvider) {
      codeLensProvider.dispose();
    }

    const provider = monacoInstance.languages.registerCodeLensProvider("*", {
      provideCodeLenses: (model) => {
        if (!showInlineActions()) return { lenses: [], dispose: () => {} };

        const allConflicts = conflicts();
        const lenses: Monaco.languages.CodeLens[] = [];

        allConflicts.forEach((conflict, _idx) => {
          if (conflict.resolved) return;

          // Find the actual line in the current model content
          const content = model.getValue();
          const lines = content.split("\n");
          let actualLine = 1;

          // Search for conflict start marker
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(CONFLICT_START_PATTERN)) {
              // Check if this is our conflict by comparing labels
              const match = lines[i].match(CONFLICT_START_PATTERN);
              if (match && match[1]?.trim() === conflict.oursLabel) {
                actualLine = i + 1;
                break;
              }
            }
          }

          // Accept Current action
          lenses.push({
            range: new monacoInstance.Range(actualLine, 1, actualLine, 1),
            command: {
              id: `merge.acceptCurrent.${conflict.id}`,
              title: `$(arrow-left) Accept Current (${conflict.oursLabel})`,
              arguments: [conflict.id, "ours"],
            },
          });

          // Accept Incoming action
          lenses.push({
            range: new monacoInstance.Range(actualLine, 1, actualLine, 1),
            command: {
              id: `merge.acceptIncoming.${conflict.id}`,
              title: `$(arrow-right) Accept Incoming (${conflict.theirsLabel})`,
              arguments: [conflict.id, "theirs"],
            },
          });

          // Accept Both action
          lenses.push({
            range: new monacoInstance.Range(actualLine, 1, actualLine, 1),
            command: {
              id: `merge.acceptBoth.${conflict.id}`,
              title: "$(git-merge) Accept Both",
              arguments: [conflict.id, "both"],
            },
          });

          // Compare action
          lenses.push({
            range: new monacoInstance.Range(actualLine, 1, actualLine, 1),
            command: {
              id: `merge.compare.${conflict.id}`,
              title: "$(eye) Compare",
              arguments: [conflict.id, "compare"],
            },
          });
        });

        return {
          lenses,
          dispose: () => {},
        };
      },
      resolveCodeLens: (_, codeLens) => codeLens,
    });

    codeLensProvider = {
      id: Date.now(),
      dispose: () => provider.dispose(),
    };
  }

  // ============================================================================
  // Conflict Decorations
  // ============================================================================

  /** Apply decorations to highlight conflict regions in all editors */
  function applyConflictDecorations() {
    const monacoInstance = monaco();
    const eds = editors();
    if (!monacoInstance || !isEditorReady()) return;

    const allConflicts = conflicts();
    const currentIdx = currentConflictIndex();

    // Decorations for result editor (showing conflict markers)
    const resultDecorations: Monaco.editor.IModelDeltaDecoration[] = [];

    allConflicts.forEach((conflict, index) => {
      const isActive = index === currentIdx;

      if (!conflict.resolved) {
        // Find the conflict lines in the current result content
        const resultValue = eds.result?.getValue() || "";
        const resultLines = resultValue.split("\n");

        let conflictStartInResult = -1;
        let conflictEndInResult = -1;
        let conflictSeparatorInResult = -1;
        let foundConflicts = 0;

        for (let i = 0; i < resultLines.length; i++) {
          if (resultLines[i].match(CONFLICT_START_PATTERN)) {
            foundConflicts++;
            if (foundConflicts === conflict.index) {
              conflictStartInResult = i + 1;
            }
          }
          if (foundConflicts === conflict.index) {
            if (resultLines[i].match(CONFLICT_SEPARATOR_PATTERN)) {
              conflictSeparatorInResult = i + 1;
            }
            if (resultLines[i].match(CONFLICT_END_PATTERN)) {
              conflictEndInResult = i + 1;
              break;
            }
          }
        }

        if (conflictStartInResult > 0 && conflictEndInResult > 0) {
          // Highlight conflict start marker
          resultDecorations.push({
            range: new monacoInstance.Range(
              conflictStartInResult,
              1,
              conflictStartInResult,
              1
            ),
            options: {
              isWholeLine: true,
              className: isActive
                ? "merge-line-marker-start-active"
                : "merge-line-marker-start",
              glyphMarginClassName: isActive
                ? "merge-glyph-ours-active"
                : "merge-glyph-ours",
              overviewRuler: {
                color: "var(--cortex-success)",
                position: monacoInstance.editor.OverviewRulerLane.Left,
              },
            },
          });

          // Highlight ours content
          for (
            let line = conflictStartInResult + 1;
            line < (conflictSeparatorInResult || conflictEndInResult);
            line++
          ) {
            resultDecorations.push({
              range: new monacoInstance.Range(line, 1, line, 1),
              options: {
                isWholeLine: true,
                className: isActive
                  ? "merge-line-ours-active"
                  : "merge-line-ours",
              },
            });
          }

          // Highlight separator
          if (conflictSeparatorInResult > 0) {
            resultDecorations.push({
              range: new monacoInstance.Range(
                conflictSeparatorInResult,
                1,
                conflictSeparatorInResult,
                1
              ),
              options: {
                isWholeLine: true,
                className: "merge-line-separator",
              },
            });

            // Highlight theirs content
            for (
              let line = conflictSeparatorInResult + 1;
              line < conflictEndInResult;
              line++
            ) {
              resultDecorations.push({
                range: new monacoInstance.Range(line, 1, line, 1),
                options: {
                  isWholeLine: true,
                  className: isActive
                    ? "merge-line-theirs-active"
                    : "merge-line-theirs",
                },
              });
            }
          }

          // Highlight conflict end marker
          resultDecorations.push({
            range: new monacoInstance.Range(
              conflictEndInResult,
              1,
              conflictEndInResult,
              1
            ),
            options: {
              isWholeLine: true,
              className: isActive
                ? "merge-line-marker-end-active"
                : "merge-line-marker-end",
              glyphMarginClassName: isActive
                ? "merge-glyph-theirs-active"
                : "merge-glyph-theirs",
              overviewRuler: {
                color: "var(--cortex-info)",
                position: monacoInstance.editor.OverviewRulerLane.Right,
              },
            },
          });
        }
      } else {
        // Show resolved indicator in glyph margin
        // For resolved conflicts, find where the resolved content starts
        // (Note: resultValue and resolvedStartLine prepared for future use in line mapping)
        void eds.result?.getValue(); // Used to verify editor state
        let lineCount = 0;

        // Calculate the approximate start line based on preceding content
        const sortedConflicts = [...allConflicts].sort(
          (a, b) => a.startLine - b.startLine
        );
        const conflictIndexInSorted = sortedConflicts.findIndex(
          (c) => c.id === conflict.id
        );

        for (let i = 0; i < conflictIndexInSorted; i++) {
          const c = sortedConflicts[i];
          if (c.resolved && c.resolvedContent) {
            lineCount += c.resolvedContent.length;
          } else {
            lineCount += c.endLine - c.startLine + 1;
          }
        }
        // Add non-conflict lines before this conflict
        lineCount += conflict.startLine - 1;
        for (let i = 0; i < conflictIndexInSorted; i++) {
          const c = sortedConflicts[i];
          lineCount -= c.endLine - c.startLine + 1;
        }

        if (conflict.resolvedContent && conflict.resolvedContent.length > 0) {
          for (let i = 0; i < conflict.resolvedContent.length; i++) {
            resultDecorations.push({
              range: new monacoInstance.Range(
                lineCount + i + 1,
                1,
                lineCount + i + 1,
                1
              ),
              options: {
                isWholeLine: true,
                className: "merge-line-resolved",
                glyphMarginClassName:
                  i === 0 ? "merge-glyph-resolved" : undefined,
              },
            });
          }
        }
      }
    });

    // Apply decorations to result editor
    if (eds.result) {
      const prevDecorations = decorations();
      setDecorations((prev) => ({
        ...prev,
        result: eds.result!.deltaDecorations(
          prevDecorations.result,
          resultDecorations
        ),
      }));
    }
  }

  // Update decorations when conflicts change
  createEffect(() => {
    conflicts();
    currentConflictIndex();
    if (isEditorReady()) {
      applyConflictDecorations();
    }
  });

  // ============================================================================
  // Conflict Navigation
  // ============================================================================

  /** Navigate to a specific conflict by index */
  function navigateToConflict(index: number) {
    const allConflicts = conflicts();
    if (index < 0 || index >= allConflicts.length) return;

    setCurrentConflictIndex(index);
    const conflict = allConflicts[index];

    const eds = editors();
    if (!eds.result) return;

    // Find the actual line in the result editor
    const resultValue = eds.result.getValue();
    const resultLines = resultValue.split("\n");
    let targetLine = 1;
    let foundConflicts = 0;

    for (let i = 0; i < resultLines.length; i++) {
      if (resultLines[i].match(CONFLICT_START_PATTERN)) {
        foundConflicts++;
        if (foundConflicts === conflict.index) {
          targetLine = i + 1;
          break;
        }
      }
    }

    // Scroll to the conflict
    eds.result.revealLineInCenter(targetLine);

    // Sync other editors
    if (syncScrolling()) {
      const scrollTop = eds.result.getScrollTop();
      if (eds.ours) eds.ours.setScrollTop(scrollTop);
      if (eds.theirs) eds.theirs.setScrollTop(scrollTop);
    }
  }

  /** Navigate to next conflict */
  function navigateToNextConflict() {
    const current = currentConflictIndex();
    const total = conflictCount();
    if (total === 0) return;

    const next = (current + 1) % total;
    navigateToConflict(next);
  }

  /** Navigate to previous conflict */
  function navigateToPreviousConflict() {
    const current = currentConflictIndex();
    const total = conflictCount();
    if (total === 0) return;

    const prev = current === 0 ? total - 1 : current - 1;
    navigateToConflict(prev);
  }

  /** Navigate to next unresolved conflict - prepared for keyboard navigation feature */
  // function navigateToNextUnresolved() {
  //   const allConflicts = conflicts();
  //   const current = currentConflictIndex();
  //   for (let i = current + 1; i < allConflicts.length; i++) {
  //     if (!allConflicts[i].resolved) {
  //       navigateToConflict(i);
  //       return;
  //     }
  //   }
  //   for (let i = 0; i <= current; i++) {
  //     if (!allConflicts[i].resolved) {
  //       navigateToConflict(i);
  //       return;
  //     }
  //   }
  // }

  // ============================================================================
  // Conflict Resolution
  // ============================================================================

  /** Resolve current conflict by accepting "ours" (current branch) */
  function acceptCurrent() {
    const conflict = currentConflict();
    if (!conflict || conflict.resolved) return;

    resolveConflict(conflict.id, "ours", conflict.oursContent);
  }

  /** Resolve current conflict by accepting "theirs" (incoming changes) */
  function acceptIncoming() {
    const conflict = currentConflict();
    if (!conflict || conflict.resolved) return;

    resolveConflict(conflict.id, "theirs", conflict.theirsContent);
  }

  /** Resolve current conflict by accepting both (ours followed by theirs) */
  function acceptBoth() {
    const conflict = currentConflict();
    if (!conflict || conflict.resolved) return;

    const combined = [...conflict.oursContent, ...conflict.theirsContent];
    resolveConflict(conflict.id, "both", combined);
  }

  /** Resolve current conflict by accepting both (theirs followed by ours) - UI action pending */
  // function acceptBothReverse() {
  //   const conflict = currentConflict();
  //   if (!conflict || conflict.resolved) return;
  //   const combined = [...conflict.theirsContent, ...conflict.oursContent];
  //   resolveConflict(conflict.id, "both-reverse", combined);
  // }

  /** Accept all remaining conflicts with current (ours) */
  function acceptAllCurrent() {
    const allConflicts = conflicts();
    const unresolvedConflicts = allConflicts.filter((c) => !c.resolved);

    batch(() => {
      for (const conflict of unresolvedConflicts) {
        resolveConflictSilent(conflict.id, "ours", conflict.oursContent);
      }
    });

    // Update result content once at the end
    const updatedConflicts = conflicts();
    const newResult = buildResultContent(
      props.conflictedContent,
      updatedConflicts
    );
    setResultContent(newResult);

    const eds = editors();
    if (eds.result) {
      eds.result.setValue(newResult);
    }

    applyConflictDecorations();

    if (updatedConflicts.every((c) => c.resolved)) {
      props.onAllResolved?.();
    }
  }

  /** Accept all remaining conflicts with incoming (theirs) */
  function acceptAllIncoming() {
    const allConflicts = conflicts();
    const unresolvedConflicts = allConflicts.filter((c) => !c.resolved);

    batch(() => {
      for (const conflict of unresolvedConflicts) {
        resolveConflictSilent(conflict.id, "theirs", conflict.theirsContent);
      }
    });

    // Update result content once at the end
    const updatedConflicts = conflicts();
    const newResult = buildResultContent(
      props.conflictedContent,
      updatedConflicts
    );
    setResultContent(newResult);

    const eds = editors();
    if (eds.result) {
      eds.result.setValue(newResult);
    }

    applyConflictDecorations();

    if (updatedConflicts.every((c) => c.resolved)) {
      props.onAllResolved?.();
    }
  }

  /** Resolve a conflict without triggering side effects (for batch operations) */
  function resolveConflictSilent(
    conflictId: string,
    resolution: "ours" | "theirs" | "both" | "both-reverse" | "manual",
    resolvedContent: string[]
  ) {
    setConflicts((prev) =>
      prev.map((c) => {
        if (c.id !== conflictId) return c;
        return {
          ...c,
          resolved: true,
          resolution,
          resolvedContent,
        };
      })
    );
  }

  /** Apply a resolution to a specific conflict */
  function resolveConflict(
    conflictId: string,
    resolution: "ours" | "theirs" | "both" | "both-reverse" | "manual",
    resolvedContent: string[]
  ) {
    setConflicts((prev) =>
      prev.map((c) => {
        if (c.id !== conflictId) return c;
        return {
          ...c,
          resolved: true,
          resolution,
          resolvedContent,
        };
      })
    );

    // Update result content
    const updatedConflicts = conflicts();
    const newResult = buildResultContent(
      props.conflictedContent,
      updatedConflicts
    );
    setResultContent(newResult);

    // Update result editor
    const eds = editors();
    if (eds.result) {
      const position = eds.result.getPosition();
      const scrollTop = eds.result.getScrollTop();
      eds.result.setValue(newResult);
      if (position) eds.result.setPosition(position);
      eds.result.setScrollTop(scrollTop);
    }

    // Move to next unresolved conflict
    const nextUnresolved = updatedConflicts.findIndex(
      (c, i) => i > currentConflictIndex() && !c.resolved
    );
    if (nextUnresolved !== -1) {
      navigateToConflict(nextUnresolved);
    } else {
      // Check for earlier unresolved conflicts
      const earlierUnresolved = updatedConflicts.findIndex((c) => !c.resolved);
      if (earlierUnresolved !== -1) {
        navigateToConflict(earlierUnresolved);
      } else {
        // All resolved
        props.onAllResolved?.();
      }
    }

    // Re-apply decorations
    applyConflictDecorations();
  }

  /** Unresolve a conflict (reset to unresolved state) */
  function unresolveConflict(conflictId: string) {
    setConflicts((prev) =>
      prev.map((c) => {
        if (c.id !== conflictId) return c;
        return {
          ...c,
          resolved: false,
          resolution: undefined,
          resolvedContent: undefined,
        };
      })
    );

    // Rebuild result content
    const updatedConflicts = conflicts();
    const newResult = buildResultContent(
      props.conflictedContent,
      updatedConflicts
    );
    setResultContent(newResult);

    const eds = editors();
    if (eds.result) {
      eds.result.setValue(newResult);
    }

    applyConflictDecorations();
  }

  /** Reset all resolutions */
  function resetAllResolutions() {
    setConflicts((prev) =>
      prev.map((c) => ({
        ...c,
        resolved: false,
        resolution: undefined,
        resolvedContent: undefined,
      }))
    );

    // Rebuild result content
    setResultContent(props.conflictedContent);

    const eds = editors();
    if (eds.result) {
      eds.result.setValue(props.conflictedContent);
    }

    applyConflictDecorations();
    navigateToConflict(0);
  }

  // ============================================================================
  // Save and Cancel Actions
  // ============================================================================

  /** Save the merged result */
  async function handleSave() {
    setIsSaving(true);
    try {
      const mergedContent = resultContent();
      await props.onSave?.(mergedContent);
    } finally {
      setIsSaving(false);
    }
  }

  /** Mark as resolved (even if conflicts remain - user takes responsibility) */
  function handleMarkResolved() {
    props.onMarkResolved?.();
  }

  /** Cancel the merge */
  function handleCancel() {
    props.onCancel?.();
  }

  // ============================================================================
  // View Mode Handling
  // ============================================================================

  /** Switch between view modes */
  function switchViewMode(mode: MergeViewMode) {
    setViewMode(mode);

    // If switching to two-way, initialize diff editor
    if (mode === "two-way") {
      initializeDiffEditor();
    }
  }

  /** Initialize Monaco diff editor for two-way view */
  async function initializeDiffEditor() {
    const monacoInstance = monaco();
    if (!monacoInstance || !diffContainerRef) return;

    const eds = editors();
    if (eds.diffEditor) {
      eds.diffEditor.dispose();
    }

    const diffEditor = monacoInstance.editor.createDiffEditor(diffContainerRef, {
      theme: "merge-dark",
      automaticLayout: true,
      renderSideBySide: true,
      enableSplitViewResizing: true,
      ignoreTrimWhitespace: false,
      readOnly: true,
      fontSize: 13,
      fontFamily:
        "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, monospace",
      minimap: { enabled: false },
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
    });

    const language = props.language || detectLanguage(props.filePath);
    const originalModel = monacoInstance.editor.createModel(
      oursContent(),
      language
    );
    const modifiedModel = monacoInstance.editor.createModel(
      theirsContent(),
      language
    );

    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    setEditors((prev) => ({ ...prev, diffEditor }));
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /** Copy result content to clipboard */
  async function copyResultToClipboard() {
    try {
      await navigator.clipboard.writeText(resultContent());
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  }

  /** Get resolution badge for a conflict */
  function getResolutionBadge(
    resolution?: "ours" | "theirs" | "both" | "both-reverse" | "manual"
  ): { text: string; color: string } {
    switch (resolution) {
      case "ours":
        return { text: "Current", color: "var(--cortex-success)" };
      case "theirs":
        return { text: "Incoming", color: "var(--cortex-info)" };
      case "both":
        return { text: "Both", color: "var(--cortex-info)" };
      case "both-reverse":
        return { text: "Both (rev)", color: "var(--cortex-info)" };
      case "manual":
        return { text: "Manual", color: "var(--cortex-warning)" };
      default:
        return { text: "", color: "" };
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      class={`merge-editor ${isFullscreen() ? "merge-editor-fullscreen" : ""}`}
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        background: "var(--background-base, var(--cortex-bg-primary))",
        overflow: "hidden",
        "font-family": "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div
        class="merge-editor-header"
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "8px 16px",
          "border-bottom": "1px solid var(--border-weak, #333)",
          background: "var(--surface-base, var(--cortex-bg-hover))",
          "flex-shrink": "0",
          gap: "16px",
        }}
      >
        {/* Title and file info */}
        <div style={{ display: "flex", "align-items": "center", gap: "12px", "min-width": "0", flex: "1" }}>
          <Icon
            name="code-merge"
            style={{ width: "20px", height: "20px", color: "var(--cortex-warning)", "flex-shrink": "0" }}
          />
          <div style={{ "min-width": "0" }}>
            <h2
              style={{
                margin: "0",
                "font-size": "14px",
                "font-weight": "600",
                color: "var(--text-strong, #fff)",
              }}
            >
              Merge Conflicts
            </h2>
            <p
              style={{
                margin: "0",
                "font-size": "12px",
                color: "var(--text-weak, #888)",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
              }}
              title={props.filePath}
            >
              {fileName()}
            </p>
          </div>
        </div>

        {/* Progress bar and conflict counter */}
        <div style={{ display: "flex", "align-items": "center", gap: "16px" }}>
          {/* Progress indicator */}
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <div
              style={{
                width: "100px",
                height: "4px",
                "border-radius": "var(--cortex-radius-sm)",
                background: "var(--surface-active, #333)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPercent()}%`,
                  height: "100%",
                  background: allResolved() ? "var(--cortex-success)" : "var(--cortex-warning)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <span
              style={{
                "font-size": "12px",
                color: allResolved() ? "var(--cortex-success)" : "var(--text-weak, #888)",
                "white-space": "nowrap",
              }}
            >
              {resolvedCount()}/{conflictCount()}
            </span>
            <Show when={allResolved()}>
              <Icon name="check" style={{ width: "14px", height: "14px", color: "var(--cortex-success)" }} />
            </Show>
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
            <button
              class="merge-nav-btn"
              onClick={navigateToPreviousConflict}
              disabled={conflictCount() === 0}
              title="Previous conflict (Shift+F7)"
              style={{
                padding: "6px",
                "border-radius": "var(--cortex-radius-sm)",
                background: "transparent",
                border: "none",
                cursor: conflictCount() === 0 ? "not-allowed" : "pointer",
                opacity: conflictCount() === 0 ? "0.5" : "1",
                color: "var(--text-weak, #888)",
              }}
            >
              <Icon name="chevron-up" style={{ width: "16px", height: "16px" }} />
            </button>
            <span
              style={{
                "font-size": "11px",
                color: "var(--text-weak, #888)",
                "min-width": "40px",
                "text-align": "center",
              }}
            >
              {conflictCount() > 0
                ? `${currentConflictIndex() + 1}/${conflictCount()}`
                : "0/0"}
            </span>
            <button
              class="merge-nav-btn"
              onClick={navigateToNextConflict}
              disabled={conflictCount() === 0}
              title="Next conflict (F7)"
              style={{
                padding: "6px",
                "border-radius": "var(--cortex-radius-sm)",
                background: "transparent",
                border: "none",
                cursor: conflictCount() === 0 ? "not-allowed" : "pointer",
                opacity: conflictCount() === 0 ? "0.5" : "1",
                color: "var(--text-weak, #888)",
              }}
            >
              <Icon name="chevron-down" style={{ width: "16px", height: "16px" }} />
            </button>
          </div>

          {/* View mode toggle */}
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "border-radius": "var(--cortex-radius-sm)",
              background: "var(--surface-active, #333)",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => switchViewMode("three-way")}
              style={{
                padding: "6px 10px",
                border: "none",
                background: viewMode() === "three-way" ? "var(--accent, var(--cortex-info))" : "transparent",
                color: viewMode() === "three-way" ? "white" : "var(--text-weak, #888)",
                cursor: "pointer",
                "font-size": "11px",
              }}
              title="3-way merge view"
            >
              <Icon name="columns" style={{ width: "14px", height: "14px" }} />
            </button>
            <button
              onClick={() => switchViewMode("two-way")}
              style={{
                padding: "6px 10px",
                border: "none",
                background: viewMode() === "two-way" ? "var(--accent, var(--cortex-info))" : "transparent",
                color: viewMode() === "two-way" ? "white" : "var(--text-weak, #888)",
                cursor: "pointer",
                "font-size": "11px",
              }}
              title="2-way diff view"
            >
              <Icon name="eye" style={{ width: "14px", height: "14px" }} />
            </button>
            <button
              onClick={() => switchViewMode("result-only")}
              style={{
                padding: "6px 10px",
                border: "none",
                background: viewMode() === "result-only" ? "var(--accent, var(--cortex-info))" : "transparent",
                color: viewMode() === "result-only" ? "white" : "var(--text-weak, #888)",
                cursor: "pointer",
                "font-size": "11px",
              }}
              title="Result only view"
            >
              <Icon name="code" style={{ width: "14px", height: "14px" }} />
            </button>
          </div>

          {/* Settings */}
          <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
            <button
              onClick={() => setSyncScrolling(!syncScrolling())}
              title={syncScrolling() ? "Disable synchronized scrolling" : "Enable synchronized scrolling"}
              style={{
                padding: "6px",
                "border-radius": "var(--cortex-radius-sm)",
                background: syncScrolling() ? "rgba(90, 193, 254, 0.2)" : "transparent",
                border: "none",
                color: syncScrolling() ? "var(--cortex-info)" : "var(--text-weak, #888)",
                cursor: "pointer",
              }}
            >
              <Icon name="rotate" style={{ width: "14px", height: "14px" }} />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen())}
              title={isFullscreen() ? "Exit fullscreen" : "Fullscreen"}
              style={{
                padding: "6px",
                "border-radius": "var(--cortex-radius-sm)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-weak, #888)",
              }}
            >
              {isFullscreen() ? (
                <Icon name="minimize" style={{ width: "16px", height: "16px" }} />
              ) : (
                <Icon name="maximize" style={{ width: "16px", height: "16px" }} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Conflict action bar */}
      <Show when={currentConflict() && viewMode() !== "two-way"}>
        <div
          class="merge-action-bar"
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: "8px 16px",
            "border-bottom": "1px solid var(--border-weak, #333)",
            background: "var(--surface-raised, var(--cortex-bg-hover))",
            "flex-shrink": "0",
          }}
        >
          {/* Current conflict actions */}
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <span style={{ "font-size": "12px", color: "var(--text-weak, #888)", "margin-right": "8px" }}>
              Conflict {currentConflict()!.index}:
            </span>

            {/* Accept Current (Ours) */}
            <button
              class="merge-action-btn merge-action-ours"
              onClick={acceptCurrent}
              disabled={currentConflict()?.resolved}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "6px",
                padding: "6px 12px",
                "border-radius": "var(--cortex-radius-sm)",
                background:
                  currentConflict()?.resolved && currentConflict()?.resolution === "ours"
                    ? "rgba(46, 160, 67, 0.3)"
                    : "rgba(46, 160, 67, 0.15)",
                border:
                  currentConflict()?.resolved && currentConflict()?.resolution === "ours"
                    ? "2px solid var(--cortex-success)"
                    : "1px solid rgba(46, 160, 67, 0.3)",
                color: "var(--cortex-success)",
                cursor: currentConflict()?.resolved ? "default" : "pointer",
                opacity:
                  currentConflict()?.resolved && currentConflict()?.resolution !== "ours"
                    ? "0.5"
                    : "1",
                "font-size": "12px",
                "font-weight": "500",
              }}
            >
              <Icon name="arrow-left" style={{ width: "14px", height: "14px" }} />
              Current
            </button>

            {/* Accept Both */}
            <button
              class="merge-action-btn merge-action-both"
              onClick={acceptBoth}
              disabled={currentConflict()?.resolved}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "6px",
                padding: "6px 12px",
                "border-radius": "var(--cortex-radius-sm)",
                background:
                  currentConflict()?.resolved && currentConflict()?.resolution === "both"
                    ? "rgba(163, 113, 247, 0.3)"
                    : "rgba(163, 113, 247, 0.15)",
                border:
                  currentConflict()?.resolved && currentConflict()?.resolution === "both"
                    ? "2px solid var(--cortex-info)"
                    : "1px solid rgba(163, 113, 247, 0.3)",
                color: "var(--cortex-info)",
                cursor: currentConflict()?.resolved ? "default" : "pointer",
                opacity:
                  currentConflict()?.resolved && currentConflict()?.resolution !== "both"
                    ? "0.5"
                    : "1",
                "font-size": "12px",
                "font-weight": "500",
              }}
            >
              <Icon name="code-merge" style={{ width: "14px", height: "14px" }} />
              Both
            </button>

            {/* Accept Incoming (Theirs) */}
            <button
              class="merge-action-btn merge-action-theirs"
              onClick={acceptIncoming}
              disabled={currentConflict()?.resolved}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "6px",
                padding: "6px 12px",
                "border-radius": "var(--cortex-radius-sm)",
                background:
                  currentConflict()?.resolved && currentConflict()?.resolution === "theirs"
                    ? "rgba(56, 139, 253, 0.3)"
                    : "rgba(56, 139, 253, 0.15)",
                border:
                  currentConflict()?.resolved && currentConflict()?.resolution === "theirs"
                    ? "2px solid var(--cortex-info)"
                    : "1px solid rgba(56, 139, 253, 0.3)",
                color: "var(--cortex-info)",
                cursor: currentConflict()?.resolved ? "default" : "pointer",
                opacity:
                  currentConflict()?.resolved && currentConflict()?.resolution !== "theirs"
                    ? "0.5"
                    : "1",
                "font-size": "12px",
                "font-weight": "500",
              }}
            >
              Incoming
              <Icon name="arrow-right" style={{ width: "14px", height: "14px" }} />
            </button>

            {/* Reset button (when resolved) */}
            <Show when={currentConflict()?.resolved}>
              <button
                class="merge-action-btn merge-action-reset"
                onClick={() =>
                  currentConflict() && unresolveConflict(currentConflict()!.id)
                }
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "6px",
                  padding: "6px 12px",
                  "border-radius": "var(--cortex-radius-sm)",
                  background: "transparent",
                  border: "1px solid var(--border-weak, #333)",
                  color: "var(--text-weak, #888)",
                  cursor: "pointer",
                  "font-size": "12px",
                }}
              >
                Reset
              </button>
            </Show>
          </div>

          {/* Bulk actions */}
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <Show when={remainingCount() > 1}>
              <span style={{ "font-size": "11px", color: "var(--text-weak, #888)", "margin-right": "4px" }}>
                All remaining:
              </span>
              <button
                onClick={acceptAllCurrent}
                style={{
                  padding: "4px 8px",
                  "border-radius": "var(--cortex-radius-sm)",
                  background: "transparent",
                  border: "1px solid rgba(46, 160, 67, 0.3)",
                  color: "var(--cortex-success)",
                  cursor: "pointer",
                  "font-size": "11px",
                }}
              >
                Accept All Current
              </button>
              <button
                onClick={acceptAllIncoming}
                style={{
                  padding: "4px 8px",
                  "border-radius": "var(--cortex-radius-sm)",
                  background: "transparent",
                  border: "1px solid rgba(56, 139, 253, 0.3)",
                  color: "var(--cortex-info)",
                  cursor: "pointer",
                  "font-size": "11px",
                }}
              >
                Accept All Incoming
              </button>
            </Show>
            <Show when={resolvedCount() > 0}>
              <button
                onClick={resetAllResolutions}
                style={{
                  padding: "4px 8px",
                  "border-radius": "var(--cortex-radius-sm)",
                  background: "transparent",
                  border: "1px solid var(--border-weak, #333)",
                  color: "var(--text-weak, #888)",
                  cursor: "pointer",
                  "font-size": "11px",
                }}
              >
                Reset All
              </button>
            </Show>
          </div>
        </div>
      </Show>

      {/* Editor panes */}
      <div
        class="merge-editor-panes"
        style={{
          display: viewMode() === "two-way" ? "none" : "flex",
          flex: "1",
          overflow: "hidden",
        }}
      >
        {/* Ours pane (left) */}
        <Show when={viewMode() === "three-way"}>
          <div
            class="merge-pane merge-pane-ours"
            style={{
              flex: "1",
              display: "flex",
              "flex-direction": "column",
              "border-right": "1px solid var(--border-weak, #333)",
              overflow: "hidden",
              "min-width": "0",
            }}
          >
            <div
              class="merge-pane-header"
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                padding: "6px 12px",
                background: "rgba(46, 160, 67, 0.1)",
                "border-bottom": "1px solid rgba(46, 160, 67, 0.3)",
                "flex-shrink": "0",
              }}
            >
              <span
                style={{
                  "font-size": "12px",
                  "font-weight": "500",
                  color: "var(--cortex-success)",
                }}
              >
                Current ({labels().ours})
              </span>
              <span
                style={{
                  "font-size": "10px",
                  color: "var(--text-weak, #888)",
                }}
              >
                Read Only
              </span>
            </div>
            <div
              ref={oursContainerRef}
              class="merge-editor-container"
              style={{ flex: "1", overflow: "hidden" }}
            />
          </div>
        </Show>

        {/* Result pane (center or full width in result-only mode) */}
        <div
          class="merge-pane merge-pane-result"
          style={{
            flex: viewMode() === "result-only" ? "1" : "1.2",
            display: "flex",
            "flex-direction": "column",
            "border-right": viewMode() === "three-way" ? "1px solid var(--border-weak, #333)" : "none",
            overflow: "hidden",
            "min-width": "0",
          }}
        >
          <div
            class="merge-pane-header"
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              padding: "6px 12px",
              background: "rgba(163, 113, 247, 0.1)",
              "border-bottom": "1px solid rgba(163, 113, 247, 0.3)",
              "flex-shrink": "0",
            }}
          >
            <span
              style={{
                "font-size": "12px",
                "font-weight": "500",
                color: "var(--cortex-info)",
              }}
            >
              Result (Merged Output)
            </span>
            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              <Show when={!allResolved()}>
                <span
                  style={{
                    "font-size": "10px",
                    color: "var(--cortex-warning)",
                  }}
                >
                  {remainingCount()} conflict{remainingCount() !== 1 ? "s" : ""} remaining
                </span>
              </Show>
              <button
                onClick={copyResultToClipboard}
                title="Copy to clipboard"
                style={{
                  padding: "4px",
                  "border-radius": "var(--cortex-radius-sm)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-weak, #888)",
                }}
              >
                <Icon name="copy" style={{ width: "14px", height: "14px" }} />
              </button>
            </div>
          </div>
          <div
            ref={resultContainerRef}
            class="merge-editor-container"
            style={{ flex: "1", overflow: "hidden" }}
          />
        </div>

        {/* Theirs pane (right) */}
        <Show when={viewMode() === "three-way"}>
          <div
            class="merge-pane merge-pane-theirs"
            style={{
              flex: "1",
              display: "flex",
              "flex-direction": "column",
              overflow: "hidden",
              "min-width": "0",
            }}
          >
            <div
              class="merge-pane-header"
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                padding: "6px 12px",
                background: "rgba(56, 139, 253, 0.1)",
                "border-bottom": "1px solid rgba(56, 139, 253, 0.3)",
                "flex-shrink": "0",
              }}
            >
              <span
                style={{
                  "font-size": "12px",
                  "font-weight": "500",
                  color: "var(--cortex-info)",
                }}
              >
                Incoming ({labels().theirs})
              </span>
              <span
                style={{
                  "font-size": "10px",
                  color: "var(--text-weak, #888)",
                }}
              >
                Read Only
              </span>
            </div>
            <div
              ref={theirsContainerRef}
              class="merge-editor-container"
              style={{ flex: "1", overflow: "hidden" }}
            />
          </div>
        </Show>
      </div>

      {/* Two-way diff view */}
      <Show when={viewMode() === "two-way"}>
        <div
          class="merge-diff-pane"
          style={{
            flex: "1",
            display: "flex",
            "flex-direction": "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              "flex-shrink": "0",
            }}
          >
            <div
              style={{
                flex: "1",
                padding: "6px 12px",
                background: "rgba(46, 160, 67, 0.1)",
                "border-bottom": "1px solid rgba(46, 160, 67, 0.3)",
                "text-align": "center",
              }}
            >
              <span style={{ "font-size": "12px", "font-weight": "500", color: "var(--cortex-success)" }}>
                Current ({labels().ours})
              </span>
            </div>
            <div
              style={{
                flex: "1",
                padding: "6px 12px",
                background: "rgba(56, 139, 253, 0.1)",
                "border-bottom": "1px solid rgba(56, 139, 253, 0.3)",
                "text-align": "center",
              }}
            >
              <span style={{ "font-size": "12px", "font-weight": "500", color: "var(--cortex-info)" }}>
                Incoming ({labels().theirs})
              </span>
            </div>
          </div>
          <div
            ref={diffContainerRef}
            style={{ flex: "1", overflow: "hidden" }}
          />
        </div>
      </Show>

      {/* Conflict list sidebar - optional, shown on larger screens */}
      <Show when={conflictCount() > 3 && viewMode() !== "two-way"}>
        <div
          class="merge-conflict-list"
          style={{
            position: "absolute",
            right: "16px",
            bottom: "80px",
            width: "200px",
            "max-height": "200px",
            "border-radius": "var(--cortex-radius-md)",
            background: "var(--surface-raised, var(--cortex-bg-hover))",
            border: "1px solid var(--border-weak, #333)",
            overflow: "hidden",
            "box-shadow": "0 4px 12px rgba(0, 0, 0, 0.3)",
            "z-index": "10",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              "border-bottom": "1px solid var(--border-weak, #333)",
              "font-size": "11px",
              "font-weight": "500",
              color: "var(--text-weak, #888)",
            }}
          >
            Conflicts
          </div>
          <div style={{ "max-height": "160px", "overflow-y": "auto" }}>
            <For each={conflicts()}>
              {(conflict, index) => (
                <button
                  onClick={() => navigateToConflict(index())}
                  style={{
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "space-between",
                    width: "100%",
                    padding: "6px 12px",
                    border: "none",
                    background: currentConflictIndex() === index()
                      ? "var(--surface-active, #333)"
                      : "transparent",
                    cursor: "pointer",
                    "text-align": "left",
                  }}
                >
                  <span
                    style={{
                      "font-size": "12px",
                      color: "var(--text-base, #ccc)",
                    }}
                  >
                    Conflict {conflict.index}
                  </span>
                  <Show when={conflict.resolved}>
                    <span
                      style={{
                        "font-size": "10px",
                        padding: "2px 6px",
                        "border-radius": "var(--cortex-radius-sm)",
                        background: `${getResolutionBadge(conflict.resolution).color}20`,
                        color: getResolutionBadge(conflict.resolution).color,
                      }}
                    >
                      {getResolutionBadge(conflict.resolution).text}
                    </span>
                  </Show>
                  <Show when={!conflict.resolved}>
                    <Icon
                      name="triangle-exclamation"
                      style={{ width: "12px", height: "12px", color: "var(--cortex-warning)" }}
                    />
                  </Show>
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Footer with save/cancel actions */}
      <div
        class="merge-editor-footer"
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "12px 16px",
          "border-top": "1px solid var(--border-weak, #333)",
          background: "var(--surface-base, var(--cortex-bg-hover))",
          "flex-shrink": "0",
        }}
      >
        {/* Left side: status info */}
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <Show when={!allResolved()}>
            <Icon name="triangle-exclamation" style={{ width: "14px", height: "14px", color: "var(--cortex-warning)" }} />
            <span
              style={{
                "font-size": "12px",
                color: "var(--cortex-warning)",
              }}
            >
              {remainingCount()} conflict{remainingCount() !== 1 ? "s" : ""} remaining
            </span>
          </Show>
          <Show when={allResolved()}>
            <Icon name="check" style={{ width: "14px", height: "14px", color: "var(--cortex-success)" }} />
            <span
              style={{
                "font-size": "12px",
                color: "var(--cortex-success)",
              }}
            >
              All conflicts resolved
            </span>
          </Show>
        </div>

        {/* Right side: actions */}
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <button
            class="merge-btn merge-btn-cancel"
            onClick={handleCancel}
            style={{
              padding: "8px 16px",
              "border-radius": "var(--cortex-radius-sm)",
              background: "transparent",
              border: "1px solid var(--border-weak, #333)",
              color: "var(--text-weak, #888)",
              cursor: "pointer",
              "font-size": "13px",
            }}
          >
            Cancel
          </button>

          {/* Mark as resolved button (for manual override) */}
          <Show when={props.onMarkResolved && !allResolved()}>
            <button
              class="merge-btn merge-btn-mark-resolved"
              onClick={handleMarkResolved}
              title="Mark as resolved even with remaining conflicts (use with caution)"
              style={{
                padding: "8px 16px",
                "border-radius": "var(--cortex-radius-sm)",
                background: "transparent",
                border: "1px solid var(--cortex-warning)",
                color: "var(--cortex-warning)",
                cursor: "pointer",
                "font-size": "13px",
              }}
            >
              Mark as Resolved
            </button>
          </Show>

          <button
            class="merge-btn merge-btn-save"
            onClick={handleSave}
            disabled={isSaving()}
            style={{
              display: "flex",
              "align-items": "center",
              gap: "6px",
              padding: "8px 16px",
              "border-radius": "var(--cortex-radius-sm)",
              background: allResolved()
                ? "var(--accent, var(--cortex-info))"
                : "var(--surface-active, #333)",
              border: "none",
              color: allResolved() ? "white" : "var(--text-weak, #888)",
              cursor: isSaving() ? "wait" : "pointer",
              "font-size": "13px",
              "font-weight": "500",
            }}
          >
            <Show when={isSaving()}>
              <Icon name="spinner" style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />
            </Show>
            <Show when={!isSaving()}>
              <Icon name="floppy-disk" style={{ width: "14px", height: "14px" }} />
            </Show>
            {isSaving() ? "Saving..." : "Save Merged Result"}
          </button>
        </div>
      </div>

      {/* Styles for decorations and fullscreen */}
      <style>{`
        .merge-editor-fullscreen {
          position: fixed !important;
          inset: 0 !important;
          z-index: 100 !important;
        }

        /* Hover effects for buttons */
        .merge-nav-btn:hover:not(:disabled) {
          background: var(--surface-active, #333) !important;
        }

        .merge-action-btn:hover:not(:disabled) {
          filter: brightness(1.1);
        }

        .merge-btn-cancel:hover {
          background: var(--surface-active, #333) !important;
          color: var(--text-base, #ccc) !important;
        }

        .merge-btn-save:hover:not(:disabled) {
          filter: brightness(1.1);
        }

        .merge-btn-mark-resolved:hover {
          background: rgba(255, 143, 63, 0.1) !important;
        }

        /* Monaco editor decoration styles */
        .merge-line-marker-start {
          background: rgba(46, 160, 67, 0.2) !important;
        }

        .merge-line-marker-start-active {
          background: rgba(46, 160, 67, 0.3) !important;
        }

        .merge-line-marker-end {
          background: rgba(56, 139, 253, 0.2) !important;
        }

        .merge-line-marker-end-active {
          background: rgba(56, 139, 253, 0.3) !important;
        }

        .merge-line-ours {
          background: rgba(46, 160, 67, 0.1) !important;
        }

        .merge-line-ours-active {
          background: rgba(46, 160, 67, 0.2) !important;
        }

        .merge-line-theirs {
          background: rgba(56, 139, 253, 0.1) !important;
        }

        .merge-line-theirs-active {
          background: rgba(56, 139, 253, 0.2) !important;
        }

        .merge-line-separator {
          background: rgba(255, 255, 255, 0.05) !important;
        }

        .merge-line-resolved {
          background: rgba(163, 113, 247, 0.1) !important;
        }

        /* Glyph margin decorations */
        .merge-glyph-ours,
        .merge-glyph-ours-active {
          background: var(--cortex-success) !important;
          width: 4px !important;
          margin-left: 4px !important;
          border-radius: var(--cortex-radius-sm) !important;
        }

        .merge-glyph-theirs,
        .merge-glyph-theirs-active {
          background: var(--cortex-info) !important;
          width: 4px !important;
          margin-left: 4px !important;
          border-radius: var(--cortex-radius-sm) !important;
        }

        .merge-glyph-resolved {
          background: var(--cortex-info) !important;
          width: 4px !important;
          margin-left: 4px !important;
          border-radius: var(--cortex-radius-sm) !important;
        }

        /* Active states have more intense colors */
        .merge-glyph-ours-active,
        .merge-glyph-theirs-active {
          width: 6px !important;
          margin-left: 3px !important;
        }

        /* Conflict list scrollbar */
        .merge-conflict-list::-webkit-scrollbar {
          width: 6px;
        }

        .merge-conflict-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .merge-conflict-list::-webkit-scrollbar-thumb {
          background: var(--border-weak, #333);
          border-radius: var(--cortex-radius-sm);
        }

        /* Spinner animation */
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Focus styles */
        .merge-action-btn:focus,
        .merge-btn:focus {
          outline: 2px solid var(--accent, var(--cortex-info));
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}

export default MergeEditor;

