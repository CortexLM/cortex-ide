/**
 * Editor Modules - Barrel Export
 *
 * Re-exports all types, utilities, LSP providers, and editor actions
 * from the modularized CodeEditor components.
 */

// Types and interfaces
export type {
  WindowWithIdleCallback,
  InlayHintLabelPart,
  LSPInlayHint,
  LSPInlayHintsResponse,
  LSPTextEdit,
  LSPOnTypeFormattingResponse,
  LSPSelectionRange,
  LSPSelectionRangeResponse,
  LSPCodeLens,
  LSPCodeLensResult,
  LSPSemanticTokensResult,
  FormatOnTypeSettings,
  InlayHintSettings,
  UnicodeHighlightSettings,
  CodeLensSettings,
  DebugEvaluateResult,
  DebugVariable,
  DebugHoverState,
  UnicodeCategory,
  UnicodeCharacterInfo,
  CoverageStatus,
  CoverageColors,
  CoverageGlyphClasses,
  CodeEditorProps,
  ProviderDisposables,
} from "./EditorTypes";

// Constants
export {
  LANGUAGE_MAP,
  DEFAULT_FORMAT_ON_TYPE_SETTINGS,
  DEFAULT_INLAY_HINT_SETTINGS,
  DEFAULT_UNICODE_HIGHLIGHT_SETTINGS,
  COVERAGE_COLORS,
  COVERAGE_GLYPH_CLASSES,
  SEMANTIC_TOKEN_TYPES,
  SEMANTIC_TOKEN_MODIFIERS,
  TEST_PATTERNS,
} from "./EditorTypes";

// Utility functions
export {
  yieldToMain,
  executeBatched,
  debounce,
  estimateLineCount,
  toSnakeCase,
  toCamelCase,
  toPascalCase,
  toKebabCase,
  toConstantCase,
  UNICODE_TO_ASCII_MAP,
  getUnicodeCharacterInfo,
  shouldHighlightCharacter,
  findConfusableCharacters,
  formatUnicodeCategory,
  createCoverageDecoration,
  applyCoverageDecorations,
  clearCoverageDecorations,
  getDebugValueTypeClass,
  escapeDebugHtml,
  isReferenceLens,
  isImplementationLens,
  isTestLens,
  isTestLine,
  extractTestName,
} from "./EditorUtils";

// LSP Provider registration functions
export {
  registerInlayHintsProvider,
  updateInlayHintSettings,
  registerOnTypeFormattingProvider,
  updateFormatOnTypeSettings,
  registerCodeLensProvider,
  updateCodeLensSettings,
  registerSemanticTokensProvider,
  registerDebugHoverProvider,
  disposeDebugHoverProvider,
  updateDebugHoverState,
  registerLinkedEditingProviders,
  updateLinkedEditingEnabled,
  findLinkedEditingRanges,
  getTagAtPosition,
  findMatchingTag,
  registerUnicodeHoverProvider,
  registerUnicodeCodeActionProvider,
  updateUnicodeHighlightSettings,
  disposeAllProviders,
  registerAllProviders,
} from "./EditorLSP";

// Editor action setup functions
export type {
  PeekLocation,
  SmartSelectManager,
  GitDiffNavigator,
  PeekWidgetController,
} from "./EditorActions";

export {
  setupMultiCursorActions,
  setupFormatOnPaste,
  setupLinkedEditingActions,
} from "./EditorActions";
