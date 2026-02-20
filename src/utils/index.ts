export * from "./tauri";
export * from "./tauriBatch";
export * from "./format";
export * from "./systemInfo";
export * from "./workspace";
export * from "./events";
export * from "./ansiParser";

// Enhanced ANSI color utilities for debug console
export {
  // Types
  type AnsiTextStyle,
  type AnsiTextSegment,
  type AnsiThemeColors,
  type AnsiHyperlink,
  // Constants
  DEFAULT_ANSI_COLORS,
  // Functions
  parseAnsiText,
  parseSGR,
  parseOSC8,
  index256ToHex,
  rgbToHex,
  getThemeColor,
  styleToCss,
  styleToInlineCss,
  stripAnsiCodes,
  containsAnsiCodes,
  getVisibleLength,
  truncateAnsiText,
  ansiToHtml,
  formatDebugOutput,
  highlightSearchTerm,
} from "./ansiColors";

// Task and shell utilities
export * from "./taskVariables";
export * from "./shellQuoting";
export * from "./shellIntegration";
export * from "./terminalLinks";

// Settings utilities
export * from "./settingsValidation";
export * from "./settingsSearch";

// Keybinding utilities
export * from "./keybindingResolver";

// Debug utilities
export * from "./inlineValues";
export * from "./debugHover";

// Editor utilities
export * from "./findReplace";
export * from "./multiCursor";
export * from "./lineOperations";
export * from "./bracketOperations";

// High-frequency streaming utilities
export {
  StreamingManager,
  getStreamingManager,
  createTextUpdate,
  createTerminalUpdate,
  createListUpdate,
  createProgressUpdate,
  type Update,
  type TextUpdate,
  type CursorUpdate,
  type ListUpdate,
  type ProgressUpdate,
  type TerminalUpdate,
  type UpdatePriority,
  type UpdateCallback,
  type BackpressureStatus,
  type StreamingStats as StreamingManagerStats,
  type ListItem,
} from "./StreamingManager";

// Grid serialization utilities
export {
  serializeGrid,
  deserializeGrid,
  saveGridState,
  loadGridState,
  clearGridState,
  createSingleEditorLayout,
  createSplitLayout,
  create2x2Layout,
  create3ColumnLayout,
  createMainWithSideLayout,
  splitCell,
  closeCell,
  moveEditorToCell,
  type SerializedGridState,
  type GridCell,
  type EditorGridState,
} from "./gridSerializer";

// Terminal image protocol utilities
export {
  parseITerm2Image,
  parseSixelImage,
  parseKittyImage,
  detectImageProtocol,
  parseImageSequence,
  extractImageSequences,
  type ImageProtocol,
  type ImageSizeUnit,
  type InlineImage,
  type ExtractedImages,
} from "./terminalImageProtocols";

// Diff algorithm utilities
export {
  // Enum
  DiffOperation,
  // Classes
  MyersDiff,
  PatienceDiff,
  MinimalDiff,
  WordDiff,
  CharacterDiff,
  LineDiffWithContext,
  UnifiedDiffFormat,
  SideBySideDiffFormat,
  // Functions
  quickDiff,
  unifiedDiff,
  sideBySideDiff,
  textSimilarity,
  applyDiff,
  reverseDiff,
  // Types
  type DiffResult,
  type LineDiff,
  type UnifiedDiffOptions,
  type SideBySideDiff,
} from "./diffAlgorithm";
