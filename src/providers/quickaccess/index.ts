/**
 * =============================================================================
 * QUICK ACCESS PROVIDERS - Index
 * =============================================================================
 * 
 * Exports all Quick Access providers and types.
 */

// Types
export type {
  QuickAccessItem,
  QuickAccessItemButton,
  QuickAccessProvider,
  QuickAccessContextValue,
} from "./types";

// Workspace Symbols Provider
export {
  createWorkspaceSymbolsProvider,
  symbolKindToString,
  symbolKindToIcon,
  symbolKindToColor,
  getRelativePath,
  type WorkspaceSymbolsProviderOptions,
  type WorkspaceSymbolsProviderDependencies,
  type WorkspaceSymbolData,
} from "./WorkspaceSymbolsProvider";

// Help Provider
export { createHelpProvider } from "./HelpProvider";

// Terminal Provider
export { createTerminalProvider } from "./TerminalProvider";

// Task Provider
export { createTaskProvider } from "./TaskProvider";

// Debug Provider
export { createDebugProvider } from "./DebugProvider";

// Extension Provider
export { createExtensionProvider } from "./ExtensionProvider";

// Text Search Provider
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
} from "./TextSearchProvider";

// Issue Reporter Provider
export {
  createIssueReporterProvider,
  collectSystemInfo,
  formatSystemInfoForGitHub,
  buildGitHubIssueUrl,
  type IssueType,
  type IssueItemData,
  type SystemInfo,
  type IssueReporterProviderOptions,
  type IssueReporterProviderDependencies,
} from "./IssueReporterProvider";

// Editor MRU Provider
export { createEditorMRUProvider } from "./EditorMRUProvider";
