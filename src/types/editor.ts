/**
 * Editor Types
 *
 * Centralized type definitions for editor-related functionality including
 * cursor positions, selections, open files, editor groups, and splits.
 */

// ============================================================================
// Cursor and Selection Types
// ============================================================================

/**
 * Represents a cursor position in the editor.
 */
export interface CursorPosition {
  /** 1-based line number */
  line: number;
  /** 1-based column number */
  column: number;
}

/**
 * Represents a text selection range in the editor.
 */
export interface Selection {
  /** 1-based start line */
  startLine: number;
  /** 1-based start column */
  startColumn: number;
  /** 1-based end line */
  endLine: number;
  /** 1-based end column */
  endColumn: number;
}

// ============================================================================
// File Types
// ============================================================================

/**
 * Line ending types supported by the editor.
 */
export type LineEnding = "LF" | "CRLF" | "CR" | "Mixed";

/**
 * Represents an open file in the editor.
 */
export interface OpenFile {
  /** Unique identifier for the file instance */
  id: string;
  /** Full file path */
  path: string;
  /** File name (extracted from path) */
  name: string;
  /** File content */
  content: string;
  /** Detected or set programming language */
  language: string;
  /** Whether the file has unsaved modifications */
  modified: boolean;
  /** Current cursor position (legacy, prefer cursors array) */
  cursorPosition?: CursorPosition;
  /** All cursor positions (for multi-cursor support) */
  cursors?: CursorPosition[];
  /** Current selections */
  selections?: Selection[];
  /** Detected line ending */
  lineEnding?: LineEnding;
}

// ============================================================================
// Editor Layout Types
// ============================================================================

/**
 * Direction for splitting editor groups.
 */
export type SplitDirection = "horizontal" | "vertical";

/**
 * Represents an editor group containing multiple files.
 */
export interface EditorGroup {
  /** Unique group identifier */
  id: string;
  /** IDs of files open in this group */
  fileIds: string[];
  /** ID of the currently active file in this group */
  activeFileId: string | null;
  /** Ratio of space this group occupies (0-1) */
  splitRatio: number;
  /** Whether the group is locked (prevents closing) */
  locked?: boolean;
  /** Display label for the group tab bar */
  label?: string;
  /** IDs of recently closed files in this group */
  recentlyClosed?: string[];
}

/**
 * Represents a split between two editor groups.
 */
export interface EditorSplit {
  /** Unique split identifier */
  id: string;
  /** Direction of the split */
  direction: SplitDirection;
  /** ID of the first group in the split */
  firstGroupId: string;
  /** ID of the second group in the split */
  secondGroupId: string;
  /** Ratio position of the split (0-1) */
  ratio: number;
}

/**
 * Complete editor layout configuration.
 */
export interface EditorLayout {
  /** Root group ID for the layout tree */
  rootGroupId?: string;
  /** All editor groups */
  groups: EditorGroup[];
  /** All splits between groups */
  splits: EditorSplit[];
  /** ID of the currently active group */
  activeGroupId?: string;
}

// ============================================================================
// Editor State Types
// ============================================================================

/**
 * Complete editor state.
 */
export interface EditorState {
  /** All open files */
  openFiles: OpenFile[];
  /** ID of the currently active file */
  activeFileId: string | null;
  /** ID of the currently active group */
  activeGroupId: string;
  /** All editor groups */
  groups: EditorGroup[];
  /** All splits */
  splits: EditorSplit[];
  /** Number of active cursors */
  cursorCount: number;
  /** Number of active selections */
  selectionCount: number;
  /** Whether a file is currently being opened */
  isOpening: boolean;
  /** IDs of pinned tabs */
  pinnedTabs: string[];
  /** ID of the preview tab (italic title, replaced on next preview) */
  previewTab: string | null;
}

// ============================================================================
// Language Detection Types
// ============================================================================

/**
 * Mapping of file extensions to Monaco language IDs.
 */
export type LanguageMap = Record<string, string>;

/**
 * Language-specific editor override settings.
 */
export interface LanguageEditorOverride {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  tabSize?: number;
  insertSpaces?: boolean;
  wordWrap?: "off" | "on" | "wordWrapColumn" | "bounded";
  lineNumbers?: "on" | "off" | "relative" | "interval";
  minimapEnabled?: boolean;
  bracketPairColorization?: boolean;
  autoClosingBrackets?: "always" | "languageDefined" | "beforeWhitespace" | "never";
  autoIndent?: boolean;
  formatOnSave?: boolean;
  formatOnPaste?: boolean;
  cursorStyle?: "line" | "block" | "underline" | "line-thin" | "block-outline" | "underline-thin";
  renderWhitespace?: "none" | "boundary" | "selection" | "trailing" | "all";
  guidesIndentation?: boolean;
  guidesBracketPairs?: boolean;
  foldingEnabled?: boolean;
  stickyScrollEnabled?: boolean;
  linkedEditing?: boolean;
}

/**
 * Map of language IDs to their editor overrides.
 */
export type LanguageOverridesMap = Record<string, LanguageEditorOverride>;

// ============================================================================
// Find and Replace Types
// ============================================================================

/**
 * Represents a range in the editor (for matches, selections, etc.).
 */
export interface EditorRange {
  /** 1-based start line number */
  startLineNumber: number;
  /** 1-based start column */
  startColumn: number;
  /** 1-based end line number */
  endLineNumber: number;
  /** 1-based end column */
  endColumn: number;
}

/**
 * Represents a single find/replace match in the editor.
 */
export interface FindReplaceMatch {
  /** Range of the match in the document */
  range: EditorRange;
  /** Unique decoration ID for highlighting this match */
  decorationId: string;
}

/**
 * State for the Find and Replace widget.
 */
export interface FindReplaceState {
  /** Current search query */
  query: string;
  /** Whether to use regular expression matching */
  isRegex: boolean;
  /** Whether the search is case sensitive */
  isCaseSensitive: boolean;
  /** Whether to match whole words only */
  isWholeWord: boolean;
  /** Pattern to use for replacement */
  replacePattern: string;
  /** Whether to preserve case during replacement */
  preserveCase: boolean;
  /** Whether to search only within the current selection */
  searchInSelection: boolean;
}

// ============================================================================
// Parameter Hints / Signature Help Types
// ============================================================================

/**
 * Information about a single parameter in a function signature.
 */
export interface ParameterInformation {
  /** Display label for the parameter (e.g., "name: string") */
  label: string;
  /** Documentation/description for the parameter */
  documentation?: string;
}

/**
 * Information about a function signature.
 */
export interface SignatureInformation {
  /** Full signature label (e.g., "function foo(a: string, b: number): void") */
  label: string;
  /** Documentation/description for the function */
  documentation?: string;
  /** List of parameters in this signature */
  parameters: ParameterInformation[];
  /** Index of the currently active parameter (0-based) */
  activeParameter: number;
}

/**
 * State for parameter hints / signature help widget.
 */
export interface ParameterHintsState {
  /** Available function signatures (overloads) */
  signatures: SignatureInformation[];
  /** Index of the currently active signature (0-based) */
  activeSignature: number;
  /** Index of the currently active parameter (0-based) */
  activeParameter: number;
}

// ============================================================================
// Rename Widget Types
// ============================================================================

/**
 * Represents a single location where a rename will be applied.
 */
export interface RenameLocation {
  /** URI of the file containing this location */
  uri: string;
  /** Range of the text to be renamed */
  range: EditorRange;
  /** New text to replace the old identifier */
  newText: string;
}

/**
 * State for the rename refactoring widget.
 */
export interface RenameWidgetState {
  /** Original name being renamed */
  oldName: string;
  /** New name entered by the user */
  newName: string;
  /** Whether to show a preview of changes before applying */
  preview: boolean;
  /** All locations where the rename will be applied */
  locations: RenameLocation[];
}

// ============================================================================
// Sticky Scroll Types
// ============================================================================

/**
 * Represents a single line in the sticky scroll header.
 */
export interface StickyScrollLine {
  /** 1-based line number in the document */
  lineNumber: number;
  /** Nesting depth (0 = top level, 1 = first nested scope, etc.) */
  depth: number;
  /** Text content to display for this line */
  text: string;
}

/**
 * State for the sticky scroll feature.
 */
export interface StickyScrollState {
  /** Lines currently visible in the sticky scroll header */
  lines: StickyScrollLine[];
  /** Maximum number of lines to show in sticky scroll */
  maxLineCount: number;
}

// ============================================================================
// Light Bulb (Quick Actions) Types
// ============================================================================

/**
 * Represents a code action available at the current position.
 */
export interface CodeAction {
  /** Display title for the action */
  title: string;
  /** Kind of action (e.g., "quickfix", "refactor", "source.organizeImports") */
  kind?: string;
  /** Whether this is the preferred action */
  isPreferred?: boolean;
  /** Whether this action is disabled */
  disabled?: {
    /** Reason why the action is disabled */
    reason: string;
  };
}

/**
 * State for the light bulb widget showing available code actions.
 */
export interface LightBulbState {
  /** Whether the light bulb is currently visible */
  visible: boolean;
  /** Position where the light bulb is displayed */
  position: CursorPosition;
  /** Available code actions at this position */
  actions: CodeAction[];
}

// ============================================================================
// Multi-Cursor and Column Selection Types
// ============================================================================

/**
 * State for column (block) selection mode.
 */
export interface ColumnSelectionState {
  /** Starting line number (1-based) */
  startLine: number;
  /** Starting column number (1-based) */
  startColumn: number;
  /** Ending line number (1-based) */
  endLine: number;
  /** Ending column number (1-based) */
  endColumn: number;
}

/**
 * State for multi-cursor editing.
 */
export interface MultiCursorState {
  /** All cursor positions */
  cursors: CursorPosition[];
  /** Index of the primary cursor (the one that shows parameter hints, etc.) */
  primaryIndex: number;
}

// ============================================================================
// Linked Editing Types
// ============================================================================

/**
 * State for linked editing ranges (e.g., editing HTML tag pairs).
 */
export interface LinkedEditingRangesState {
  /** Ranges that are linked for simultaneous editing */
  ranges: EditorRange[];
  /** Optional word pattern that defines what constitutes a "word" for linked editing */
  wordPattern?: string;
}
