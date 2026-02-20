/**
 * Timeline Provider
 *
 * Provides unified timeline view for files showing:
 * - Git history (commits affecting the file)
 * - Local history (file saves and edits)
 * - Merged view from multiple sources with pagination
 *
 * Features:
 * - Cursor-based pagination for efficient loading
 * - Automatic refresh on file changes
 * - Source-specific icons and colors
 * - Merge and sort from multiple providers
 */

import type {
  TimelineProvider,
  Timeline,
  TimelineItem,
  TimelineOptions,
  TimelineChangeEvent,
  TimelinePaging,
} from "@/types/scm";
import type { GitCommit } from "@/types/git";
import type { CancellationToken } from "@/types/search";
import type { Command } from "@/types/workbench";

// Local type definitions to match scm.ts definitions
// In scm.ts, Uri is defined as string
type Uri = string;

// Internal icon type for our use
interface InternalIcon {
  id: string;
  color: string;
}

// ============================================================================
// Timeline Source Types
// ============================================================================

/**
 * Source types for timeline items
 */
export type TimelineSource = "git" | "local-history" | "custom";

/**
 * Extended timeline item with source-specific metadata
 */
export interface ExtendedTimelineItem extends TimelineItem {
  /** Source type for this item */
  sourceType: TimelineSource;
  /** Git-specific: commit hash */
  commitHash?: string;
  /** Git-specific: author email */
  authorEmail?: string;
  /** Local history: file version ID */
  versionId?: string;
  /** Local history: size in bytes */
  fileSize?: number;
  /** Whether this item represents a significant change */
  isSignificant?: boolean;
}

/**
 * Timeline provider options
 */
export interface TimelineProviderOptions {
  /** Maximum items to return per page */
  defaultPageSize: number;
  /** Whether to include git history */
  includeGitHistory: boolean;
  /** Whether to include local history */
  includeLocalHistory: boolean;
  /** Minimum time between local history entries (ms) */
  localHistoryDebounceMs: number;
}

/**
 * Timeline provider dependencies
 */
export interface TimelineProviderDependencies {
  /** Get git commits for a file */
  getGitCommits: (
    filePath: string,
    options: { limit?: number; cursor?: string }
  ) => Promise<{ commits: GitCommit[]; nextCursor?: string }>;
  /** Get local history entries for a file */
  getLocalHistory: (
    filePath: string,
    options: { limit?: number; cursor?: string }
  ) => Promise<{ entries: LocalHistoryEntry[]; nextCursor?: string }>;
  /** Subscribe to file changes */
  onFileChange?: (callback: (uri: string) => void) => () => void;
  /** Subscribe to git changes */
  onGitChange?: (callback: (repoPath: string) => void) => () => void;
}

// ============================================================================
// Local History Types
// ============================================================================

/**
 * Local history entry representing a file save
 */
export interface LocalHistoryEntry {
  /** Unique identifier for this entry */
  id: string;
  /** Timestamp when the file was saved */
  timestamp: number;
  /** File path */
  filePath: string;
  /** File size in bytes */
  size: number;
  /** Optional label for significant saves */
  label?: string;
  /** Whether this was an auto-save */
  isAutoSave: boolean;
  /** Content hash for deduplication */
  contentHash?: string;
}

// ============================================================================
// Icon Definitions
// ============================================================================

/**
 * Timeline item icons by source and type
 */
export const TIMELINE_ICONS = {
  git: {
    commit: {
      id: "git-commit",
      color: "#f97316", // orange-500
    },
    merge: {
      id: "git-merge",
      color: "#8b5cf6", // violet-500
    },
    initial: {
      id: "git-branch",
      color: "#22c55e", // green-500
    },
  },
  localHistory: {
    save: {
      id: "save",
      color: "#3b82f6", // blue-500
    },
    autoSave: {
      id: "sync",
      color: "#6b7280", // gray-500
    },
    labeled: {
      id: "bookmark",
      color: "#eab308", // yellow-500
    },
  },
  custom: {
    default: {
      id: "circle-filled",
      color: "#9ca3af", // gray-400
    },
  },
} as const;

/**
 * Get icon for a timeline item based on source and type
 */
export function getTimelineIcon(
  source: TimelineSource,
  type?: string
): InternalIcon {
  switch (source) {
    case "git":
      if (type === "merge") return TIMELINE_ICONS.git.merge;
      if (type === "initial") return TIMELINE_ICONS.git.initial;
      return TIMELINE_ICONS.git.commit;
    case "local-history":
      if (type === "autoSave") return TIMELINE_ICONS.localHistory.autoSave;
      if (type === "labeled") return TIMELINE_ICONS.localHistory.labeled;
      return TIMELINE_ICONS.localHistory.save;
    default:
      return TIMELINE_ICONS.custom.default;
  }
}

// ============================================================================
// Event Emitter Implementation
// ============================================================================

/**
 * Simple event emitter for timeline change events
 */
export class TimelineEventEmitter {
  private listeners: Set<(event: TimelineChangeEvent) => void> = new Set();

  /**
   * Subscribe to timeline change events
   */
  subscribe(listener: (event: TimelineChangeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit a timeline change event
   */
  emit(event: TimelineChangeEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Timeline event listener error:", error);
      }
    });
  }

  /**
   * Create an Event interface for the TimelineProvider
   */
  toEvent(): (listener: (e: TimelineChangeEvent) => void) => { dispose: () => void } {
    return (listener: (e: TimelineChangeEvent) => void) => {
      const unsubscribe = this.subscribe(listener);
      return { dispose: unsubscribe };
    };
  }
}

// ============================================================================
// Git History Provider
// ============================================================================

/**
 * Provider for git commit history
 */
export class GitHistoryProvider {
  constructor(
    private getGitCommits: TimelineProviderDependencies["getGitCommits"]
  ) {}

  /**
   * Get timeline items from git history
   */
  async getItems(
    filePath: string,
    options: TimelineOptions
  ): Promise<{ items: ExtendedTimelineItem[]; nextCursor?: string }> {
    try {
      const result = await this.getGitCommits(filePath, {
        limit: options.limit,
        cursor: options.cursor,
      });

      const items: ExtendedTimelineItem[] = result.commits.map((commit) => {
        const isInitial = commit.parents.length === 0;
        const isMerge = commit.parents.length > 1;
        const type = isInitial ? "initial" : isMerge ? "merge" : "commit";
        const icon = getTimelineIcon("git", type);

        return {
          id: `git-${commit.hash}`,
          label: commit.message.split("\n")[0], // First line of commit message
          description: `${commit.author} - ${commit.shortHash}`,
          timestamp: commit.timestamp,
          source: "git",
          sourceType: "git",
          commitHash: commit.hash,
          authorEmail: commit.email,
          isSignificant: isInitial || isMerge,
          iconPath: icon.id, // Use icon id as string
          contextValue: isMerge ? "timeline:git:merge" : isInitial ? "timeline:git:initial" : "timeline:git:commit",
          command: {
            title: "Show Commit",
            command: "orion.timeline.showGitCommit",
            arguments: [commit.hash, filePath],
          },
        };
      });

      return {
        items,
        nextCursor: result.nextCursor,
      };
    } catch (error) {
      console.error("Failed to get git history:", error);
      return { items: [] };
    }
  }
}

// ============================================================================
// Local History Provider
// ============================================================================

/**
 * Provider for local file save history
 */
export class LocalHistoryProvider {
  constructor(
    private getLocalHistory: TimelineProviderDependencies["getLocalHistory"],
    private debounceMs: number = 60000 // 1 minute default
  ) {}

  /**
   * Get timeline items from local history
   */
  async getItems(
    filePath: string,
    options: TimelineOptions
  ): Promise<{ items: ExtendedTimelineItem[]; nextCursor?: string }> {
    try {
      const result = await this.getLocalHistory(filePath, {
        limit: options.limit,
        cursor: options.cursor,
      });

      // Filter out entries that are too close together (debounce)
      const filteredEntries = this.deduplicateEntries(result.entries);

      const items: ExtendedTimelineItem[] = filteredEntries.map((entry) => {
        const type = entry.label ? "labeled" : entry.isAutoSave ? "autoSave" : "save";
        const icon = getTimelineIcon("local-history", type);

        const description = entry.label
          ? entry.label
          : entry.isAutoSave
          ? "Auto-saved"
          : "Saved";

        return {
          id: `local-${entry.id}`,
          label: this.formatTimestamp(entry.timestamp),
          description: `${description} - ${this.formatSize(entry.size)}`,
          timestamp: entry.timestamp,
          source: "local-history",
          sourceType: "local-history",
          versionId: entry.id,
          fileSize: entry.size,
          isSignificant: !!entry.label,
          iconPath: icon.id, // Use icon id as string
          contextValue: entry.label ? "timeline:local:labeled" : "timeline:local:save",
          command: {
            title: "Show Local Version",
            command: "orion.timeline.showLocalVersion",
            arguments: [entry.id, filePath],
          },
        };
      });

      return {
        items,
        nextCursor: result.nextCursor,
      };
    } catch (error) {
      console.error("Failed to get local history:", error);
      return { items: [] };
    }
  }

  /**
   * Deduplicate entries based on content hash and debounce time
   */
  private deduplicateEntries(entries: LocalHistoryEntry[]): LocalHistoryEntry[] {
    const result: LocalHistoryEntry[] = [];
    let lastTimestamp = 0;
    const seenHashes = new Set<string>();

    for (const entry of entries) {
      // Skip if same content hash
      if (entry.contentHash && seenHashes.has(entry.contentHash)) {
        continue;
      }

      // Skip if too close to last entry (unless it's labeled)
      if (!entry.label && entry.timestamp - lastTimestamp < this.debounceMs) {
        continue;
      }

      result.push(entry);
      lastTimestamp = entry.timestamp;
      if (entry.contentHash) {
        seenHashes.add(entry.contentHash);
      }
    }

    return result;
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - timestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return `Yesterday ${date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString(undefined, {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  /**
   * Format file size for display
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// ============================================================================
// Merged Timeline Provider
// ============================================================================

/**
 * Default options for timeline provider
 */
export const DEFAULT_TIMELINE_OPTIONS: TimelineProviderOptions = {
  defaultPageSize: 50,
  includeGitHistory: true,
  includeLocalHistory: true,
  localHistoryDebounceMs: 60000,
};

/**
 * Result of creating a timeline provider
 */
export interface TimelineProviderResult {
  /** The timeline provider instance */
  provider: TimelineProvider;
  /** Refresh the timeline for a specific URI or all URIs */
  refresh: (uri?: string) => void;
  /** Dispose of all subscriptions */
  dispose: () => void;
}

/**
 * Create a unified timeline provider that merges git and local history
 */
export function createTimelineProvider(
  dependencies: TimelineProviderDependencies,
  options: Partial<TimelineProviderOptions> = {}
): TimelineProviderResult {
  const opts = { ...DEFAULT_TIMELINE_OPTIONS, ...options };
  const eventEmitter = new TimelineEventEmitter();
  const disposables: (() => void)[] = [];

  // Create sub-providers
  const gitProvider = opts.includeGitHistory
    ? new GitHistoryProvider(dependencies.getGitCommits)
    : null;

  const localProvider = opts.includeLocalHistory
    ? new LocalHistoryProvider(
        dependencies.getLocalHistory,
        opts.localHistoryDebounceMs
      )
    : null;

  // Set up file change listener
  if (dependencies.onFileChange) {
    const unsubscribe = dependencies.onFileChange((uri) => {
      eventEmitter.emit({ uri });
    });
    disposables.push(unsubscribe);
  }

  // Set up git change listener
  if (dependencies.onGitChange) {
    const unsubscribe = dependencies.onGitChange((_repoPath) => {
      // Reset all timelines when git changes
      eventEmitter.emit({ reset: true });
    });
    disposables.push(unsubscribe);
  }

  // Cursor encoding/decoding for pagination
  const encodeCursor = (gitCursor?: string, localCursor?: string): string | undefined => {
    if (!gitCursor && !localCursor) return undefined;
    return Buffer.from(
      JSON.stringify({ git: gitCursor, local: localCursor })
    ).toString("base64");
  };

  const decodeCursor = (
    cursor?: string
  ): { git?: string; local?: string } => {
    if (!cursor) return {};
    try {
      return JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
    } catch {
      return {};
    }
  };

  // Main provider implementation
  const provider: TimelineProvider = {
    id: "orion.timeline",
    label: "Timeline",
    onDidChange: eventEmitter.toEvent(),

    async provideTimeline(
      uri: Uri,
      timelineOptions: TimelineOptions,
      _token: CancellationToken
    ): Promise<Timeline | undefined> {
      // Uri is a string in scm.ts
      const filePath = uri;
      const limit = timelineOptions.limit ?? opts.defaultPageSize;
      const cursors = decodeCursor(timelineOptions.cursor);

      // Fetch from both providers in parallel
      const emptyResult: { items: ExtendedTimelineItem[]; nextCursor?: string } = { items: [] };
      const [gitResult, localResult] = await Promise.all([
        gitProvider?.getItems(filePath, { limit, cursor: cursors.git }) ??
          Promise.resolve(emptyResult),
        localProvider?.getItems(filePath, { limit, cursor: cursors.local }) ??
          Promise.resolve(emptyResult),
      ]);

      // Merge and sort items by timestamp (newest first)
      const allItems = [...gitResult.items, ...localResult.items].sort(
        (a, b) => b.timestamp - a.timestamp
      );

      // Take only the requested limit
      const items = allItems.slice(0, limit);

      // Determine pagination info
      const hasMore =
        allItems.length > limit ||
        gitResult.nextCursor !== undefined ||
        localResult.nextCursor !== undefined;

      const paging: TimelinePaging | undefined = hasMore
        ? {
            cursor: encodeCursor(
              gitResult.nextCursor,
              localResult.nextCursor
            ),
          }
        : undefined;

      return {
        items: items as TimelineItem[],
        paging,
      };
    },
  };

  // Refresh function
  const refresh = (uri?: string) => {
    if (uri) {
      eventEmitter.emit({ uri });
    } else {
      eventEmitter.emit({ reset: true });
    }
  };

  // Dispose function
  const dispose = () => {
    disposables.forEach((d) => d());
    disposables.length = 0;
  };

  return {
    provider,
    refresh,
    dispose,
  };
}

// ============================================================================
// Timeline View State
// ============================================================================

/**
 * State for the timeline view component
 */
export interface TimelineViewState {
  /** Currently selected file URI */
  selectedUri: string | null;
  /** Loaded timeline items */
  items: ExtendedTimelineItem[];
  /** Whether more items can be loaded */
  hasMore: boolean;
  /** Pagination cursor for loading more */
  cursor?: string;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Filter by source */
  sourceFilter: TimelineSource | "all";
  /** Whether to show only significant items */
  showSignificantOnly: boolean;
}

/**
 * Initial state for timeline view
 */
export const INITIAL_TIMELINE_STATE: TimelineViewState = {
  selectedUri: null,
  items: [],
  hasMore: false,
  cursor: undefined,
  isLoading: false,
  error: null,
  sourceFilter: "all",
  showSignificantOnly: false,
};

/**
 * Filter timeline items based on view state
 */
export function filterTimelineItems(
  items: ExtendedTimelineItem[],
  state: Pick<TimelineViewState, "sourceFilter" | "showSignificantOnly">
): ExtendedTimelineItem[] {
  return items.filter((item) => {
    // Filter by source
    if (state.sourceFilter !== "all" && item.sourceType !== state.sourceFilter) {
      return false;
    }

    // Filter by significance
    if (state.showSignificantOnly && !item.isSignificant) {
      return false;
    }

    return true;
  });
}

// ============================================================================
// Timeline Commands
// ============================================================================

/**
 * Commands available for timeline items
 */
export const TIMELINE_COMMANDS = {
  showGitCommit: "orion.timeline.showGitCommit",
  showLocalVersion: "orion.timeline.showLocalVersion",
  compareWithCurrent: "orion.timeline.compareWithCurrent",
  compareWithPrevious: "orion.timeline.compareWithPrevious",
  restoreVersion: "orion.timeline.restoreVersion",
  copyCommitHash: "orion.timeline.copyCommitHash",
  labelLocalVersion: "orion.timeline.labelLocalVersion",
  deleteLocalVersion: "orion.timeline.deleteLocalVersion",
  refresh: "orion.timeline.refresh",
  filterBySource: "orion.timeline.filterBySource",
  toggleSignificantOnly: "orion.timeline.toggleSignificantOnly",
} as const;

/**
 * Get context menu items for a timeline item
 */
export function getTimelineItemContextMenu(
  item: ExtendedTimelineItem
): Command[] {
  const commands: Command[] = [];

  // Common commands
  commands.push({
    title: "Compare with Current",
    command: TIMELINE_COMMANDS.compareWithCurrent,
    arguments: [item],
  });

  commands.push({
    title: "Compare with Previous",
    command: TIMELINE_COMMANDS.compareWithPrevious,
    arguments: [item],
  });

  // Git-specific commands
  if (item.sourceType === "git" && item.commitHash) {
    commands.push({
      title: "Copy Commit Hash",
      command: TIMELINE_COMMANDS.copyCommitHash,
      arguments: [item.commitHash],
    });
  }

  // Local history-specific commands
  if (item.sourceType === "local-history" && item.versionId) {
    commands.push({
      title: "Restore This Version",
      command: TIMELINE_COMMANDS.restoreVersion,
      arguments: [item.versionId],
    });

    commands.push({
      title: "Add Label...",
      command: TIMELINE_COMMANDS.labelLocalVersion,
      arguments: [item.versionId],
    });

    commands.push({
      title: "Delete This Version",
      command: TIMELINE_COMMANDS.deleteLocalVersion,
      arguments: [item.versionId],
    });
  }

  return commands;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format a relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (weeks < 4) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
  return `${years} year${years > 1 ? "s" : ""} ago`;
}

/**
 * Group timeline items by date
 */
export function groupTimelineItemsByDate(
  items: ExtendedTimelineItem[]
): Map<string, ExtendedTimelineItem[]> {
  const groups = new Map<string, ExtendedTimelineItem[]>();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const item of items) {
    const itemDate = new Date(item.timestamp);
    let groupKey: string;

    if (itemDate >= today) {
      groupKey = "Today";
    } else if (itemDate >= yesterday) {
      groupKey = "Yesterday";
    } else if (itemDate >= lastWeek) {
      groupKey = "Last 7 Days";
    } else {
      groupKey = itemDate.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(item);
  }

  return groups;
}

/**
 * Create a mock timeline provider for testing
 */
export function createMockTimelineProvider(): TimelineProviderResult {
  const mockGitCommits = async (
    _filePath: string,
    options: { limit?: number; cursor?: string }
  ) => {
    const commits: GitCommit[] = [];
    const start = options.cursor ? parseInt(options.cursor, 10) : 0;
    const limit = options.limit ?? 10;

    for (let i = 0; i < limit; i++) {
      const index = start + i;
      commits.push({
        hash: `abc${index}def${index}`,
        shortHash: `abc${index}`,
        author: "Test Author",
        email: "test@example.com",
        timestamp: Date.now() - index * 3600000,
        message: `Commit message ${index}\n\nDetailed description here.`,
        parents: index > 0 ? [`abc${index - 1}def${index - 1}`] : [],
      });
    }

    return {
      commits,
      nextCursor: start + limit < 100 ? String(start + limit) : undefined,
    };
  };

  const mockLocalHistory = async (
    _filePath: string,
    options: { limit?: number; cursor?: string }
  ) => {
    const entries: LocalHistoryEntry[] = [];
    const start = options.cursor ? parseInt(options.cursor, 10) : 0;
    const limit = options.limit ?? 10;

    for (let i = 0; i < limit; i++) {
      const index = start + i;
      entries.push({
        id: `local-${index}`,
        timestamp: Date.now() - index * 1800000,
        filePath: "/test/file.ts",
        size: 1024 + index * 100,
        isAutoSave: index % 3 === 0,
        label: index % 5 === 0 ? `Checkpoint ${index}` : undefined,
      });
    }

    return {
      entries,
      nextCursor: start + limit < 50 ? String(start + limit) : undefined,
    };
  };

  return createTimelineProvider({
    getGitCommits: mockGitCommits,
    getLocalHistory: mockLocalHistory,
  });
}

// ============================================================================
// Exports
// ============================================================================

export type {
  TimelineProvider,
  Timeline,
  TimelineItem,
  TimelineOptions,
  TimelineChangeEvent,
  TimelinePaging,
};
