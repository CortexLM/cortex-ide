/**
 * Monaco Editor Providers
 *
 * This module exports all Monaco editor providers for LSP integration.
 */

export {
  createInlayHintsProvider,
  getInlayHintsEditorOptions,
  type InlayHintsProviderOptions,
} from "./InlayHintsProvider";

export {
  createCodeLensProvider,
  getCodeLensEditorOptions,
  executeCodeLensCommand,
  parseReferenceCount,
  parseImplementationCount,
  generateReferenceLens,
  generateImplementationLens,
  type CodeLensProviderOptions,
  type CodeLensProviderResult,
  type CodeLensCommandType,
} from "./CodeLensProvider";

export {
  createFoldingRangeProvider,
  getFoldingEditorOptions,
  createDefaultFoldingRanges,
  type FoldingRange,
  type FoldingRangeKind,
  type FoldingRangeProviderOptions,
  type FoldingRangeProviderResult,
} from "./FoldingRangeProvider";

export {
  createSelectionRangeProvider,
  flattenSelectionRanges,
  getSelectionRangeDepth,
  type SelectionRangeProviderOptions,
  type SelectionRangeProviderResult,
} from "./SelectionRangeProvider";

// Re-export SelectionRange from LSPContext where it's defined
export type { SelectionRange } from "@/context/LSPContext";

export {
  InlineCompletionsProvider,
  getInlineCompletionsProvider,
  resetInlineCompletionsProvider,
  createInlineCompletionsProvider,
  getInlineSuggestEditorOptions,
  getInlineCompletionKeybindings,
  type InlineProviderType,
  type InlineCompletionSettings,
  type InlineProviderStatus,
  type InlineCompletionEventType,
  type InlineCompletionEvent,
} from "./InlineCompletionsProvider";

export {
  createColorProvider,
  getColorProviderEditorOptions,
  colorToHex,
  colorToRgb,
  colorToHsl,
  hexToColor,
  rgbToColor,
  hslToColor,
  parseColor,
  getDefaultColorPresentations,
  COLOR_PROVIDER_LANGUAGES,
  type Color,
  type ColorInformation,
  type ColorPresentation,
  type ColorProviderOptions,
  type ColorProviderResult,
} from "./ColorProvider";

export {
  createDocumentLinkProvider,
  getDocumentLinkEditorOptions,
  isExternalUrl,
  isFilePath,
  normalizePath,
  resolvePath,
  getLinkTooltip,
  getLinkType,
  parseLinksFromLine,
  openLink,
  DOCUMENT_LINK_LANGUAGES,
  type DocumentLink,
  type DocumentLinkProviderOptions,
  type DocumentLinkProviderResult,
  type LinkType,
  type ParsedLink,
} from "./DocumentLinkProvider";

// Quick Access Providers
export {
  createWorkspaceSymbolsProvider,
  symbolKindToString,
  symbolKindToIcon,
  symbolKindToColor,
  getRelativePath,
  type QuickAccessItem,
  type QuickAccessItemButton,
  type QuickAccessProvider,
  type QuickAccessContextValue,
  type WorkspaceSymbolsProviderOptions,
  type WorkspaceSymbolsProviderDependencies,
  type WorkspaceSymbolData,
} from "./quickaccess";

// Quick Access - Help Provider
export { createHelpProvider } from "./quickaccess";

// Quick Access - Terminal Provider
export { createTerminalProvider } from "./quickaccess";

// Quick Access - Task Provider
export { createTaskProvider } from "./quickaccess";

// Quick Access - Debug Provider
export { createDebugProvider } from "./quickaccess";

// Quick Access - Extension Provider
export { createExtensionProvider } from "./quickaccess";

// Quick Access - Text Search Provider
export {
  createTextSearchProvider,
  type TextSearchProviderOptions,
  type TextSearchProviderDependencies,
  type TextSearchItemData,
  type SearchOptions,
  type SearchMatchResult,
  type SearchResultEntry,
  type ContentSearchResponse,
  type SearchContentOptions,
} from "./quickaccess";

// Timeline Provider
export {
  // Main factory function
  createTimelineProvider,
  createMockTimelineProvider,
  // Sub-providers
  GitHistoryProvider,
  LocalHistoryProvider,
  // Event emitter
  TimelineEventEmitter,
  // Constants and utilities
  TIMELINE_ICONS,
  TIMELINE_COMMANDS,
  DEFAULT_TIMELINE_OPTIONS,
  INITIAL_TIMELINE_STATE,
  getTimelineIcon,
  getTimelineItemContextMenu,
  formatRelativeTime,
  groupTimelineItemsByDate,
  filterTimelineItems,
  // Types
  type TimelineSource,
  type ExtendedTimelineItem,
  type TimelineProviderOptions,
  type TimelineProviderDependencies,
  type TimelineProviderResult,
  type LocalHistoryEntry,
  type TimelineViewState,
  // Re-exported SCM types
  type TimelineProvider,
  type Timeline,
  type TimelineItem,
  type TimelineOptions,
  type TimelineChangeEvent,
  type TimelinePaging,
} from "./TimelineProvider";

// Terminal Completion Provider
export {
  // Main class and factory functions
  TerminalCompletionProvider,
  getTerminalCompletionProvider,
  resetTerminalCompletionProvider,
  createTerminalCompletionProvider,
  // Utility functions
  parseCommandLine,
  getCommand,
  getCommandContext,
  isOptionToken,
  isEnvVarToken,
  isPathToken,
  createCompletionItem,
  calculateMatchScore,
  escapeForShell,
  // Types
  type ShellType,
  type TerminalCompletionContext,
  type TerminalCompletionResult,
  type ITerminalCompletionProvider,
  type TerminalCompletionProviderConfig,
  type HistoryEntry,
  type CommandFrequency,
} from "./TerminalCompletionProvider";

// Linked Editing Provider
export {
  createLinkedEditingProvider,
  getLinkedEditingEditorOptions,
  LINKED_EDITING_LANGUAGES,
  type LinkedEditingRanges,
  type LinkedEditingProviderOptions,
  type LinkedEditingProviderResult,
} from "./LinkedEditingProvider";

// Call Hierarchy Provider
export {
  createCallHierarchyProvider,
  getCallHierarchyIcon,
  formatCallHierarchyItem,
  CALL_HIERARCHY_LANGUAGES,
  type CallHierarchyItem,
  type CallHierarchyIncomingCall,
  type CallHierarchyOutgoingCall,
  type CallHierarchyProviderOptions,
  type CallHierarchyProviderResult,
} from "./CallHierarchyProvider";

// Type Hierarchy Provider
export {
  createTypeHierarchyProvider,
  getTypeHierarchyIcon,
  formatTypeHierarchyItem,
  getTypeHierarchyDirectionLabel,
  TYPE_HIERARCHY_LANGUAGES,
  type TypeHierarchyItem,
  type TypeHierarchyProviderOptions,
  type TypeHierarchyProviderResult,
  type TypeHierarchyDirection,
} from "./TypeHierarchyProvider";
