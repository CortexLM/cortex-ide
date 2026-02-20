/**
 * Source Control Management (SCM) Types
 *
 * Generic type definitions for SCM providers (not just Git).
 * These types support extensions that provide custom source control
 * implementations, timeline providers, and history views.
 */

// ============================================================================
// Common Types (defined locally to avoid circular imports)
// ============================================================================

/**
 * URI type for resource identification.
 */
type Uri = string;

/**
 * Command definition for actions.
 */
interface Command {
  command: string;
  title: string;
  tooltip?: string;
  arguments?: unknown[];
}

/**
 * Cancellation token for async operations.
 */
interface CancellationToken {
  isCancellationRequested: boolean;
  onCancellationRequested: (listener: () => void) => { dispose(): void };
}

/**
 * Event emitter type.
 */
type Event<T> = (listener: (e: T) => void) => { dispose(): void };

/**
 * Icon path for themed icons.
 */
type IconPath = string | { light: string; dark: string };

// ============================================================================
// Source Control Provider Types
// ============================================================================

/**
 * Represents a source control provider instance.
 * Extensions can register their own SCM providers using this interface.
 */
export interface SourceControl {
  /** Unique identifier for this source control instance */
  id: string;
  /** Human-readable label displayed in the UI */
  label: string;
  /** Root URI of the source control repository */
  rootUri?: Uri;
  /** Input box for commit messages */
  inputBox: SourceControlInputBox;
  /** Number of resources with changes */
  count?: number;
  /** Provider for quick diff gutters */
  quickDiffProvider?: QuickDiffProvider;
  /** Template for commit messages */
  commitTemplate?: string;
  /** Command executed when accepting input (e.g., commit) */
  acceptInputCommand?: Command;
  /** Commands shown in the status bar */
  statusBarCommands?: Command[];
  /**
   * Creates a new resource group for organizing changed resources.
   * @param id - Unique identifier for the group
   * @param label - Human-readable label for the group
   * @returns The created resource group
   */
  createResourceGroup(id: string, label: string): SourceControlResourceGroup;
  /** Disposes of the source control instance and its resources */
  dispose(): void;
}

/**
 * Input box displayed in the source control view for entering commit messages.
 */
export interface SourceControlInputBox {
  /** Current text value of the input box */
  value: string;
  /** Placeholder text shown when empty */
  placeholder: string;
  /** Whether the input box is visible */
  visible: boolean;
  /** Whether the input box is enabled for input */
  enabled: boolean;
}

// ============================================================================
// Resource Group Types
// ============================================================================

/**
 * A group of source control resources (e.g., "Staged Changes", "Changes").
 */
export interface SourceControlResourceGroup {
  /** Unique identifier for this group */
  id: string;
  /** Human-readable label displayed in the UI */
  label: string;
  /** Hide the group when it contains no resources */
  hideWhenEmpty?: boolean;
  /** List of resource states in this group */
  resourceStates: SourceControlResourceState[];
  /** Disposes of the resource group */
  dispose(): void;
}

/**
 * Represents the state of a single resource in source control.
 */
export interface SourceControlResourceState {
  /** URI of the resource */
  resourceUri: Uri;
  /** Command to execute when the resource is selected */
  command?: Command;
  /** Visual decorations for the resource */
  decorations?: SourceControlResourceDecorations;
  /** Context value for menu contributions */
  contextValue?: string;
}

/**
 * Visual decorations for a source control resource.
 */
export interface SourceControlResourceDecorations {
  /** Display resource with strikethrough text */
  strikeThrough?: boolean;
  /** Display resource with faded text */
  faded?: boolean;
  /** Tooltip text shown on hover */
  tooltip?: string;
  /** Decorations for light themes */
  light?: SourceControlResourceThemableDecorations;
  /** Decorations for dark themes */
  dark?: SourceControlResourceThemableDecorations;
  /** Icon path or URI for the resource */
  iconPath?: string | Uri;
}

/**
 * Theme-specific decorations for source control resources.
 */
export interface SourceControlResourceThemableDecorations {
  /** Icon path or URI for the specific theme */
  iconPath?: string | Uri;
}

// ============================================================================
// Quick Diff Provider Types
// ============================================================================

/**
 * Provider for quick diff gutter decorations.
 * Returns the original version of a resource for comparison.
 */
export interface QuickDiffProvider {
  /**
   * Provides the URI of the original resource for diff comparison.
   * @param uri - The URI of the modified resource
   * @param token - Cancellation token
   * @returns The URI of the original resource, or undefined if not available
   */
  provideOriginalResource(
    uri: Uri,
    token: CancellationToken
  ): Promise<Uri | undefined>;
}

// ============================================================================
// SCM History Provider Types
// ============================================================================

/**
 * Provider for SCM history in the Timeline view.
 * Enables extensions to contribute version history for files.
 */
export interface ScmHistoryProvider {
  /** Action button shown in the history view */
  actionButton?: ScmActionButton;
  /** Currently selected history item group (e.g., current branch) */
  currentHistoryItemGroup?: ScmHistoryItemGroup;
  /** Event fired when the action button changes */
  onDidChangeActionButton?: Event<void>;
  /** Event fired when the current history item group changes */
  onDidChangeCurrentHistoryItemGroup?: Event<void>;
  /**
   * Provides history items for a given group.
   * @param historyItemGroupId - ID of the history item group (e.g., branch)
   * @param options - Pagination and filtering options
   * @param token - Cancellation token
   * @returns Array of history items
   */
  provideHistoryItems(
    historyItemGroupId: string,
    options: ScmHistoryOptions,
    token: CancellationToken
  ): Promise<ScmHistoryItem[]>;
  /**
   * Provides the file changes for a specific history item.
   * @param historyItemId - ID of the history item (e.g., commit hash)
   * @param token - Cancellation token
   * @returns Array of file changes
   */
  provideHistoryItemChanges(
    historyItemId: string,
    token: CancellationToken
  ): Promise<ScmHistoryItemChange[]>;
  /**
   * Resolves the common ancestor between two history item groups.
   * @param historyItemGroupId1 - First group ID (e.g., branch name)
   * @param historyItemGroupId2 - Second group ID
   * @param token - Cancellation token
   * @returns The common ancestor history item, or undefined if not found
   */
  resolveHistoryItemGroupCommonAncestor(
    historyItemGroupId1: string,
    historyItemGroupId2: string,
    token: CancellationToken
  ): Promise<ScmHistoryItem | undefined>;
}

/**
 * Represents a single history item (e.g., a commit).
 */
export interface ScmHistoryItem {
  /** Unique identifier (e.g., commit hash) */
  id: string;
  /** Parent history item IDs (e.g., parent commit hashes) */
  parentIds: string[];
  /** Primary label (e.g., commit message first line) */
  label: string;
  /** Additional description (e.g., full commit message) */
  description?: string;
  /** Icon for the history item */
  icon?: IconPath;
  /** Timestamp in milliseconds since epoch */
  timestamp?: number;
  /** Author name */
  author?: string;
}

/**
 * Represents a group of history items (e.g., a branch).
 */
export interface ScmHistoryItemGroup {
  /** Unique identifier (e.g., branch name) */
  id: string;
  /** Human-readable label */
  label: string;
  /** Upstream reference if tracking a remote */
  upstream?: ScmHistoryItemGroupUpstream;
}

/**
 * Upstream reference for a history item group.
 */
export interface ScmHistoryItemGroupUpstream {
  /** Unique identifier of the upstream (e.g., remote branch name) */
  id: string;
  /** Human-readable label */
  label: string;
}

/**
 * Represents a file change within a history item.
 */
export interface ScmHistoryItemChange {
  /** URI of the changed file */
  uri: Uri;
  /** Original URI (for viewing the old version) */
  originalUri?: Uri;
  /** Modified URI (for viewing the new version) */
  modifiedUri?: Uri;
  /** URI after rename (if the file was renamed) */
  renameUri?: Uri;
}

/**
 * Options for fetching history items.
 */
export interface ScmHistoryOptions {
  /** Cursor for pagination (e.g., last item ID) */
  cursor?: string;
  /** Maximum number of items to return */
  limit?: number;
}

/**
 * Action button displayed in the SCM history view.
 */
export interface ScmActionButton {
  /** Primary command to execute */
  command: Command;
  /** Secondary commands grouped in submenus */
  secondaryCommands?: Command[][];
  /** Whether the button is currently enabled */
  enabled: boolean;
  /** Description shown as tooltip or subtitle */
  description?: string;
}

// ============================================================================
// Timeline Provider Types
// ============================================================================

/**
 * Provider for timeline items displayed in the Timeline view.
 * Can provide version history, annotations, or other time-based information.
 */
export interface TimelineProvider {
  /** Unique identifier for this timeline provider */
  id: string;
  /** Human-readable label */
  label: string;
  /** Event fired when timeline items change */
  onDidChange?: Event<TimelineChangeEvent>;
  /**
   * Provides timeline items for a given resource.
   * @param uri - URI of the resource to get timeline for
   * @param options - Pagination and filtering options
   * @param token - Cancellation token
   * @returns Timeline with items, or undefined if not available
   */
  provideTimeline(
    uri: Uri,
    options: TimelineOptions,
    token: CancellationToken
  ): Promise<Timeline | undefined>;
}

/**
 * Represents a timeline with items and pagination info.
 */
export interface Timeline {
  /** Array of timeline items */
  items: TimelineItem[];
  /** Pagination information for loading more items */
  paging?: TimelinePaging;
}

/**
 * A single item in the timeline (e.g., a commit, save, annotation).
 */
export interface TimelineItem {
  /** Unique identifier for this item */
  id: string;
  /** Primary label displayed in the UI */
  label: string;
  /** Additional description text */
  description?: string;
  /** Timestamp in milliseconds since epoch */
  timestamp: number;
  /** Source of this timeline item (e.g., provider ID) */
  source: string;
  /** Command executed when the item is selected */
  command?: Command;
  /** Icon for the timeline item */
  iconPath?: IconPath;
  /** Context value for menu contributions */
  contextValue?: string;
}

/**
 * Options for fetching timeline items.
 */
export interface TimelineOptions {
  /** Cursor for pagination */
  cursor?: string;
  /** Maximum number of items to return */
  limit?: number;
}

/**
 * Pagination information for timeline.
 */
export interface TimelinePaging {
  /** Cursor for fetching the next page */
  cursor?: string;
}

/**
 * Event fired when timeline items change.
 */
export interface TimelineChangeEvent {
  /** URI of the resource whose timeline changed (undefined for all resources) */
  uri?: Uri;
  /** Whether to reset/reload all timeline items */
  reset?: boolean;
}


