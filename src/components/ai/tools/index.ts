/**
 * Tool Visualization Components
 * 
 * Specialized components for displaying agent tool executions in the Orion desktop app.
 * Similar to Zed's tool visualization approach.
 */

// ============================================================================
// Core Tool Components
// ============================================================================

export {
  ToolCard,
  type ToolCardProps,
  type ToolStatus,
} from "./ToolCard";

export {
  DiffViewer,
  type DiffViewerProps,
} from "./DiffViewer";

export {
  TerminalViewer,
  type TerminalViewerProps,
} from "./TerminalViewer";

export {
  FileReadViewer,
  type FileReadViewerProps,
} from "./FileReadViewer";

export {
  SearchResultsViewer,
  type SearchResultsViewerProps,
  type SearchMatch,
  type FileSearchResult,
} from "./SearchResultsViewer";
