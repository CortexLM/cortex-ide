import { createSignal, createEffect, For, Show, onMount, onCleanup, createMemo, batch } from "solid-js";
import { Icon } from "./ui/Icon";
import { useLocalHistory, formatRelativeTime, formatFullTime, type HistoryEntry } from "../context/LocalHistoryContext";
import { DiffView } from "./DiffView";
import { gitLog, gitDiffCommit, type GitCommit } from "../utils/tauri-api";
import { getProjectPath } from "../utils/workspace";

/**
 * Types for timeline items
 */
export type TimelineSourceType = "git" | "local";

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  timestamp: number;
  parents: string[];
}

export interface TimelineItem {
  id: string;
  type: TimelineSourceType;
  timestamp: number;
  title: string;
  subtitle?: string;
  author?: {
    name: string;
    email?: string;
  };
  gitCommit?: GitCommitInfo;
  localEntry?: HistoryEntry;
}

export interface DateRangeFilter {
  start: Date | null;
  end: Date | null;
}

export interface TimelineFilters {
  sources: TimelineSourceType[];
  dateRange: DateRangeFilter;
}

export interface TimelineViewProps {
  filePath: string;
  onClose?: () => void;
  onOpenInGit?: (commit: GitCommitInfo) => void;
}

/**
 * Generate avatar color from author name
 */
function getAvatarColor(name: string): string {
  const colors = [
    "var(--cortex-info)", "var(--cortex-success)", "var(--cortex-warning)", "var(--cortex-info)",
    "var(--cortex-error)", "var(--cortex-error)", "var(--cortex-info)", "var(--cortex-success)",
    "var(--cortex-warning)", "var(--cortex-info)", "var(--cortex-error)", "var(--cortex-success)"
  ];
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

/**
 * Format date for display in filter
 */
function formatDateForInput(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}

/**
 * Parse date from input value
 */
function parseDateFromInput(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Get filename from path
 */
function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

/**
 * Timeline View component - shows combined file history from git and local history
 */
export function TimelineView(props: TimelineViewProps) {
  const localHistory = useLocalHistory();

  const [gitCommits, setGitCommits] = createSignal<GitCommitInfo[]>([]);
  const [isLoadingGit, setIsLoadingGit] = createSignal(false);
  const [selectedItem, setSelectedItem] = createSignal<TimelineItem | null>(null);
  const [comparisonItem, setComparisonItem] = createSignal<TimelineItem | null>(null);
  const [isComparing, setIsComparing] = createSignal(false);
  const [diffContent, setDiffContent] = createSignal<string | null>(null);
  const [notification, setNotification] = createSignal<{ type: "success" | "error"; message: string } | null>(null);
  const [showFilters, setShowFilters] = createSignal(false);
  const [filters, setFilters] = createSignal<TimelineFilters>({
    sources: ["git", "local"],
    dateRange: { start: null, end: null },
  });

  // Virtualization constants and signals
  const ITEM_HEIGHT = 72; // Height of each timeline item
  const OVERSCAN = 10;

  const [scrollTop, setScrollTop] = createSignal(0);
  const [containerHeight, setContainerHeight] = createSignal(300);

  const visibleRange = createMemo(() => {
    const items = timelineItems();
    const start = Math.max(0, Math.floor(scrollTop() / ITEM_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(containerHeight() / ITEM_HEIGHT) + 2 * OVERSCAN;
    const end = Math.min(items.length, start + visibleCount);
    return { start, end };
  });

  const visibleItems = createMemo(() => {
    const items = timelineItems();
    const { start, end } = visibleRange();
    return items.slice(start, end).map((item, i) => ({
      item,
      virtualIndex: start + i,
    }));
  });

  const totalHeight = createMemo(() => timelineItems().length * ITEM_HEIGHT);

  /**
   * Fetch git commits for the current file
   */
  const fetchGitCommits = async () => {
    if (!props.filePath) return;

    setIsLoadingGit(true);
    try {
      const projectPath = getProjectPath();
      const relativePath = props.filePath.replace(projectPath, "").replace(/^[/\\]/, "");

      const data = await gitLog(projectPath, 100, relativePath);
      const commits: GitCommitInfo[] = (data || []).map((commit: GitCommit) => ({
        hash: commit.hash,
        shortHash: commit.shortHash || commit.hash.slice(0, 7),
        message: commit.message,
        author: commit.author,
        email: commit.authorEmail,
        date: commit.date,
        timestamp: new Date(commit.date).getTime(),
        parents: commit.parents || [],
      }));
      setGitCommits(commits);
    } catch (err) {
      console.error("Failed to fetch git commits for file:", err);
    } finally {
      setIsLoadingGit(false);
    }
  };

  /**
   * Get local history entries
   */
  const localEntries = createMemo(() => {
    if (!props.filePath) return [];
    return localHistory.getHistory(props.filePath);
  });

  /**
   * Combine and sort timeline items
   */
  const timelineItems = createMemo((): TimelineItem[] => {
    const items: TimelineItem[] = [];
    const activeFilters = filters();

    if (activeFilters.sources.includes("git")) {
      for (const commit of gitCommits()) {
        if (!passesDateFilter(commit.timestamp, activeFilters.dateRange)) continue;

        items.push({
          id: `git-${commit.hash}`,
          type: "git",
          timestamp: commit.timestamp,
          title: commit.message.split("\n")[0],
          subtitle: commit.shortHash,
          author: {
            name: commit.author,
            email: commit.email,
          },
          gitCommit: commit,
        });
      }
    }

    if (activeFilters.sources.includes("local")) {
      for (const entry of localEntries()) {
        if (!passesDateFilter(entry.timestamp, activeFilters.dateRange)) continue;

        const triggerLabel = getTriggerLabel(entry.trigger);
        items.push({
          id: `local-${entry.id}`,
          type: "local",
          timestamp: entry.timestamp,
          title: entry.label || triggerLabel,
          subtitle: entry.trigger !== "manual" && entry.trigger !== "save" ? triggerLabel : undefined,
          localEntry: entry,
        });
      }
    }

    items.sort((a, b) => b.timestamp - a.timestamp);
    return items;
  });

  /**
   * Check if timestamp passes date filter
   */
  function passesDateFilter(timestamp: number, dateRange: DateRangeFilter): boolean {
    if (dateRange.start && timestamp < dateRange.start.getTime()) return false;
    if (dateRange.end) {
      const endOfDay = new Date(dateRange.end);
      endOfDay.setHours(23, 59, 59, 999);
      if (timestamp > endOfDay.getTime()) return false;
    }
    return true;
  }

  /**
   * Get label for history trigger type
   */
  function getTriggerLabel(trigger: HistoryEntry["trigger"]): string {
    switch (trigger) {
      case "save":
        return "Saved";
      case "external":
        return "External Change";
      case "periodic":
        return "Auto-saved";
      case "manual":
      default:
        return "Snapshot";
    }
  }

  /**
   * Get icon for timeline item type
   */
  const getItemIcon = (item: TimelineItem) => {
    if (item.type === "git") {
      return <Icon name="code-commit" class="w-4 h-4" />;
    }
    const trigger = item.localEntry?.trigger;
    if (trigger === "save") {
      return <Icon name="floppy-disk" class="w-4 h-4" />;
    }
    if (trigger === "external") {
      return <Icon name="circle-exclamation" class="w-4 h-4" />;
    }
    if (trigger === "periodic") {
      return <Icon name="clock" class="w-4 h-4" />;
    }
    return <Icon name="file" class="w-4 h-4" />;
  };

  /**
   * Get accent color for timeline item
   */
  const getItemAccentColor = (item: TimelineItem): string => {
    if (item.type === "git") return "var(--cortex-info)";
    const trigger = item.localEntry?.trigger;
    switch (trigger) {
      case "save":
        return "var(--cortex-success)";
      case "external":
        return "var(--cortex-warning)";
      case "periodic":
        return "var(--cortex-info)";
      default:
        return "var(--cortex-text-inactive)";
    }
  };

  /**
   * Handle item selection
   */
  const handleSelectItem = (item: TimelineItem) => {
    if (selectedItem()?.id === item.id) {
      setSelectedItem(null);
      setDiffContent(null);
    } else {
      setSelectedItem(item);
      setComparisonItem(null);
      loadDiffWithCurrent(item);
    }
  };

  /**
   * Load diff between item and current file
   */
  const loadDiffWithCurrent = async (item: TimelineItem) => {
    setIsComparing(true);
    setDiffContent(null);

    try {
      if (item.type === "local" && item.localEntry) {
        const comparison = await localHistory.compareWithCurrent(props.filePath, item.localEntry.id);
        if (comparison) {
          setDiffContent(comparison.diff);
        }
      } else if (item.type === "git" && item.gitCommit) {
        const projectPath = getProjectPath();
        const relativePath = props.filePath.replace(projectPath, "").replace(/^[/\\]/, "");

        const diff = await gitDiffCommit(projectPath, relativePath, item.gitCommit.hash);
        setDiffContent(diff || "");
      }
    } catch (err) {
      console.error("Failed to load diff:", err);
      showNotification("error", "Failed to load comparison");
    } finally {
      setIsComparing(false);
    }
  };

  /**
   * Compare two versions
   */
  const handleCompareTwoVersions = async (itemA: TimelineItem, itemB: TimelineItem) => {
    setIsComparing(true);
    setDiffContent(null);

    try {
      if (itemA.type === "local" && itemB.type === "local" && itemA.localEntry && itemB.localEntry) {
        const contentA = await localHistory.getEntryContent(props.filePath, itemA.localEntry.id);
        const contentB = await localHistory.getEntryContent(props.filePath, itemB.localEntry.id);

        if (contentA !== null && contentB !== null) {
          const { createPatch } = await import("diff");
          const fileName = getFileName(props.filePath);
          const patch = createPatch(
            fileName,
            contentA,
            contentB,
            formatFullTime(itemA.timestamp),
            formatFullTime(itemB.timestamp)
          );
          setDiffContent(patch);
        }
      } else {
        showNotification("error", "Can only compare two local history versions");
      }
    } catch (err) {
      console.error("Failed to compare versions:", err);
      showNotification("error", "Failed to compare versions");
    } finally {
      setIsComparing(false);
    }
  };

  /**
   * Restore a version
   */
  const handleRestore = async (item: TimelineItem) => {
    if (item.type !== "local" || !item.localEntry) {
      showNotification("error", "Can only restore local history versions");
      return;
    }

    try {
      const success = await localHistory.restoreVersion(props.filePath, item.localEntry.id);
      if (success) {
        showNotification("success", "Version restored successfully");
        setSelectedItem(null);
        setDiffContent(null);
      } else {
        showNotification("error", "Failed to restore version");
      }
    } catch (err) {
      console.error("Failed to restore version:", err);
      showNotification("error", "Failed to restore version");
    }
  };

  /**
   * Copy commit hash to clipboard
   */
  const handleCopyHash = async (item: TimelineItem) => {
    if (item.type !== "git" || !item.gitCommit) return;

    try {
      await navigator.clipboard.writeText(item.gitCommit.hash);
      showNotification("success", "Commit hash copied");
    } catch (err) {
      console.error("Failed to copy hash:", err);
      showNotification("error", "Failed to copy hash");
    }
  };

  /**
   * Open commit in git view
   */
  const handleViewInGit = (item: TimelineItem) => {
    if (item.type !== "git" || !item.gitCommit) return;
    props.onOpenInGit?.(item.gitCommit);
  };

  /**
   * Toggle source filter
   */
  const toggleSourceFilter = (source: TimelineSourceType) => {
    setFilters((prev) => {
      const sources = prev.sources.includes(source)
        ? prev.sources.filter((s) => s !== source)
        : [...prev.sources, source];
      if (sources.length === 0) sources.push(source);
      return { ...prev, sources };
    });
  };

  /**
   * Update date range filter
   */
  const updateDateRange = (field: "start" | "end", value: string) => {
    setFilters((prev) => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [field]: parseDateFromInput(value),
      },
    }));
  };

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    setFilters({
      sources: ["git", "local"],
      dateRange: { start: null, end: null },
    });
  };

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = createMemo(() => {
    const f = filters();
    return (
      f.sources.length !== 2 ||
      f.dateRange.start !== null ||
      f.dateRange.end !== null
    );
  });

  /**
   * Show notification
   */
  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  /**
   * Refresh all data
   */
  const refresh = async () => {
    batch(() => {
      setSelectedItem(null);
      setComparisonItem(null);
      setDiffContent(null);
    });
    await Promise.all([
      fetchGitCommits(),
      localHistory.saveSnapshot(props.filePath, "manual"),
    ]);
  };

  /**
   * Set up file change listener for auto-refresh
   */
  onMount(() => {
    fetchGitCommits();

    const handleFileChange = (event: CustomEvent) => {
      if (event.detail?.path === props.filePath) {
        fetchGitCommits();
      }
    };

    const handleFileSaved = (event: CustomEvent) => {
      if (event.detail?.path === props.filePath) {
        fetchGitCommits();
      }
    };

    const handleHistoryRestored = (event: CustomEvent) => {
      if (event.detail?.filePath === props.filePath) {
        fetchGitCommits();
      }
    };

    window.addEventListener("file:changed", handleFileChange as EventListener);
    window.addEventListener("file:saved", handleFileSaved as EventListener);
    window.addEventListener("local-history:restored", handleHistoryRestored as EventListener);

    onCleanup(() => {
      window.removeEventListener("file:changed", handleFileChange as EventListener);
      window.removeEventListener("file:saved", handleFileSaved as EventListener);
      window.removeEventListener("local-history:restored", handleHistoryRestored as EventListener);
    });
  });

  createEffect(() => {
    if (props.filePath) {
      fetchGitCommits();
    }
  });

  const isLoading = () => isLoadingGit();

  return (
    <div class="flex flex-col h-full bg-background border-l border-border">
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-border bg-background-secondary">
        <div class="flex items-center gap-2 min-w-0">
          <Icon name="clock" class="w-4 h-4 text-primary flex-shrink-0" />
          <span class="text-sm font-medium text-foreground truncate">Timeline</span>
        </div>
        <div class="flex items-center gap-1">
          <button
            onClick={() => setShowFilters(!showFilters())}
            class={`p-1.5 rounded transition-colors ${
              hasActiveFilters()
                ? "bg-primary/20 text-primary"
                : "hover:bg-background-tertiary text-foreground-muted hover:text-foreground"
            }`}
            title="Filters"
          >
            <Icon name="filter" class="w-4 h-4" />
          </button>
          <button
            onClick={refresh}
            disabled={isLoading()}
            class="p-1.5 rounded hover:bg-background-tertiary text-foreground-muted hover:text-foreground transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <Icon name="rotate" class={`w-4 h-4 ${isLoading() ? "animate-spin" : ""}`} />
          </button>
          <Show when={props.onClose}>
            <button
              onClick={props.onClose}
              class="p-1.5 rounded hover:bg-background-tertiary text-foreground-muted hover:text-foreground transition-colors"
              title="Close"
            >
              <Icon name="xmark" class="w-4 h-4" />
            </button>
          </Show>
        </div>
      </div>

      {/* File info */}
      <div class="px-3 py-2 border-b border-border">
        <div class="flex items-center gap-2 text-sm text-foreground-muted">
          <Icon name="file" class="w-4 h-4 flex-shrink-0" />
          <span class="truncate font-mono text-xs" title={props.filePath}>
            {getFileName(props.filePath)}
          </span>
        </div>
      </div>

      {/* Filters panel */}
      <Show when={showFilters()}>
        <div class="px-3 py-3 border-b border-border bg-background-secondary space-y-3">
          {/* Source filters */}
          <div>
            <label class="block text-xs text-foreground-muted mb-1.5">Sources</label>
            <div class="flex items-center gap-2">
              <button
                onClick={() => toggleSourceFilter("git")}
                class={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                  filters().sources.includes("git")
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-background-tertiary text-foreground-muted border border-transparent hover:border-border"
                }`}
              >
                <Icon name="code-commit" class="w-3 h-3" />
                Git
              </button>
              <button
                onClick={() => toggleSourceFilter("local")}
                class={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                  filters().sources.includes("local")
                    ? "bg-success/20 text-success border border-success/30"
                    : "bg-background-tertiary text-foreground-muted border border-transparent hover:border-border"
                }`}
              >
                <Icon name="floppy-disk" class="w-3 h-3" />
                Local History
              </button>
            </div>
          </div>

          {/* Date range */}
          <div>
            <label class="block text-xs text-foreground-muted mb-1.5">Date Range</label>
            <div class="flex items-center gap-2">
              <div class="flex-1">
                <input
                  type="date"
                  value={formatDateForInput(filters().dateRange.start)}
                  onChange={(e) => updateDateRange("start", e.currentTarget.value)}
                  class="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary"
                  placeholder="Start date"
                />
              </div>
              <span class="text-xs text-foreground-muted">to</span>
              <div class="flex-1">
                <input
                  type="date"
                  value={formatDateForInput(filters().dateRange.end)}
                  onChange={(e) => updateDateRange("end", e.currentTarget.value)}
                  class="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary"
                  placeholder="End date"
                />
              </div>
            </div>
          </div>

          {/* Clear filters */}
          <Show when={hasActiveFilters()}>
            <button
              onClick={clearFilters}
              class="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              Clear all filters
            </button>
          </Show>
        </div>
      </Show>

      {/* Notification */}
      <Show when={notification()}>
        {(notif) => (
          <div
            class={`mx-3 mt-2 px-3 py-2 rounded text-sm flex items-center gap-2 ${
              notif().type === "success"
                ? "bg-success/10 text-success border border-success/20"
                : "bg-error/10 text-error border border-error/20"
            }`}
          >
            {notif().type === "success" ? (
              <Icon name="check" class="w-4 h-4 flex-shrink-0" />
            ) : (
              <Icon name="circle-exclamation" class="w-4 h-4 flex-shrink-0" />
            )}
            <span>{notif().message}</span>
          </div>
        )}
      </Show>

      {/* Timeline list */}
      <div class="flex-1 overflow-hidden flex flex-col">
        <div class="flex-shrink-0 max-h-[50%] overflow-hidden flex flex-col">
          <Show
            when={timelineItems().length > 0}
            fallback={
              <div class="p-4 text-center text-foreground-muted text-sm">
                <Show when={isLoading()} fallback={<span>No history available</span>}>
                  <span>Loading...</span>
                </Show>
              </div>
            }
          >
            {/* Stats */}
            <div class="flex items-center justify-between px-4 py-1 flex-shrink-0">
              <span class="text-xs text-foreground-muted">
                {timelineItems().length} item{timelineItems().length !== 1 ? "s" : ""}
              </span>
              <div class="flex items-center gap-2 text-xs text-foreground-muted">
                <Show when={filters().sources.includes("git")}>
                  <span class="flex items-center gap-1">
                    <Icon name="code-commit" class="w-3 h-3" />
                    {gitCommits().length}
                  </span>
                </Show>
                <Show when={filters().sources.includes("local")}>
                  <span class="flex items-center gap-1">
                    <Icon name="floppy-disk" class="w-3 h-3" />
                    {localEntries().length}
                  </span>
                </Show>
              </div>
            </div>

            {/* Virtualized Timeline items */}
            <div
              class="flex-1 overflow-auto p-2"
              style={{ "min-height": "200px" }}
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
              ref={(el) => {
                if (el) {
                  const observer = new ResizeObserver((entries) => {
                    for (const entry of entries) {
                      setContainerHeight(entry.contentRect.height);
                    }
                  });
                  observer.observe(el);
                  onCleanup(() => observer.disconnect());
                }
              }}
            >
              <div style={{ height: `${totalHeight()}px`, position: "relative" }}>
                <For each={visibleItems()}>
                  {({ item, virtualIndex }) => {
                    const isSelected = () => selectedItem()?.id === item.id;
                    const isComparison = () => comparisonItem()?.id === item.id;
                    const accentColor = getItemAccentColor(item);

                    return (
                      <div
                        style={{
                          position: "absolute",
                          top: `${virtualIndex * ITEM_HEIGHT}px`,
                          width: "100%",
                          height: `${ITEM_HEIGHT}px`,
                        }}
                      >
                        <div
                          class={`group rounded transition-colors h-full ${
                            isSelected()
                              ? "bg-primary/10 border border-primary/30"
                              : isComparison()
                              ? "bg-warning/10 border border-warning/30"
                              : "hover:bg-background-tertiary border border-transparent"
                          }`}
                        >
                          <button
                            onClick={() => handleSelectItem(item)}
                            class="w-full px-2 py-2 text-left h-full"
                          >
                            <div class="flex items-start gap-2">
                              {/* Timeline indicator */}
                              <div class="flex flex-col items-center pt-1">
                                <div
                                  class="w-6 h-6 rounded-full flex items-center justify-center"
                                  style={{ background: `${accentColor}20`, color: accentColor }}
                                >
                                  {getItemIcon(item)}
                                </div>
                                <div
                                  class="w-0.5 flex-1 mt-1 min-h-[8px]"
                                  style={{ background: `${accentColor}30` }}
                                />
                              </div>

                              {/* Content */}
                              <div class="flex-1 min-w-0 pt-0.5">
                                <div class="flex items-center gap-2">
                                  {/* Type badge */}
                                  <span
                                    class="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase"
                                    style={{ background: `${accentColor}20`, color: accentColor }}
                                  >
                                    {item.type}
                                  </span>

                                  {/* Timestamp */}
                                  <span
                                    class="text-xs text-foreground-muted flex items-center gap-1"
                                    title={formatFullTime(item.timestamp)}
                                  >
                                    <Icon name="clock" class="w-3 h-3" />
                                    {formatRelativeTime(item.timestamp)}
                                  </span>
                                </div>

                                {/* Title */}
                                <p class="text-sm text-foreground mt-1 truncate" title={item.title}>
                                  {item.title}
                                </p>

                                {/* Author or subtitle */}
                                <Show when={item.author || item.subtitle}>
                                  <div class="flex items-center gap-2 mt-1">
                                    <Show when={item.author}>
                                      <div class="flex items-center gap-1.5">
                                        <div
                                          class="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-medium text-white"
                                          style={{ background: getAvatarColor(item.author!.name) }}
                                          title={item.author!.email}
                                        >
                                          {item.author!.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span class="text-xs text-foreground-muted truncate max-w-32">
                                          {item.author!.name}
                                        </span>
                                      </div>
                                    </Show>
                                    <Show when={item.subtitle && !item.author}>
                                      <span class="text-xs text-foreground-muted">{item.subtitle}</span>
                                    </Show>
                                    <Show when={item.type === "git" && item.gitCommit}>
                                      <span class="text-xs font-mono text-foreground-muted">
                                        {item.gitCommit!.shortHash}
                                      </span>
                                    </Show>
                                  </div>
                                </Show>
                              </div>

                              {/* Expand indicator */}
                              <div class="pt-1">
                                {isSelected() ? (
                                  <Icon name="chevron-down" class="w-4 h-4 text-foreground-muted" />
                                ) : (
                                  <Icon name="chevron-right" class="w-4 h-4 text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* Selected item actions - rendered outside virtualized list */}
            <Show when={selectedItem()}>
              {(selected) => {
                const item = selected();
                return (
                  <div class="px-4 py-2 border-t border-border bg-background-secondary flex-shrink-0">
                    <div class="flex flex-wrap items-center gap-2">
                      {/* Compare with current - always available */}
                      <button
                        onClick={() => loadDiffWithCurrent(item)}
                        disabled={isComparing()}
                        class="flex items-center gap-1.5 px-2 py-1 text-xs bg-background-tertiary hover:bg-background rounded transition-colors disabled:opacity-50"
                        title="Compare with current"
                      >
                        <Icon name="code-branch" class="w-3 h-3" />
                        Compare
                      </button>

                      {/* Compare two versions - only for local history */}
                      <Show when={item.type === "local"}>
                        <button
                          onClick={() => {
                            if (comparisonItem()) {
                              handleCompareTwoVersions(item, comparisonItem()!);
                              setComparisonItem(null);
                            } else {
                              setComparisonItem(item);
                              showNotification("success", "Select another version to compare");
                            }
                          }}
                          class={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
                            comparisonItem()?.id === item.id
                              ? "bg-warning/20 text-warning"
                              : "bg-background-tertiary hover:bg-background"
                          }`}
                          title="Compare with another version"
                        >
                          <Icon name="calendar" class="w-3 h-3" />
                          {comparisonItem()?.id === item.id ? "Comparing..." : "Compare Two"}
                        </button>
                      </Show>

                      {/* Restore - only for local history */}
                      <Show when={item.type === "local"}>
                        <button
                          onClick={() => handleRestore(item)}
                          class="flex items-center gap-1.5 px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 transition-colors"
                          title="Restore this version"
                        >
                          <Icon name="rotate" class="w-3 h-3" />
                          Restore
                        </button>
                      </Show>

                      {/* Git-specific actions */}
                      <Show when={item.type === "git" && item.gitCommit}>
                        <button
                          onClick={() => handleCopyHash(item)}
                          class="flex items-center gap-1.5 px-2 py-1 text-xs bg-background-tertiary hover:bg-background rounded transition-colors"
                          title="Copy commit hash"
                        >
                          <Icon name="copy" class="w-3 h-3" />
                          Copy Hash
                        </button>

                        <Show when={props.onOpenInGit}>
                          <button
                            onClick={() => handleViewInGit(item)}
                            class="flex items-center gap-1.5 px-2 py-1 text-xs bg-background-tertiary hover:bg-background rounded transition-colors"
                            title="View in Git panel"
                          >
                            <Icon name="arrow-up-right-from-square" class="w-3 h-3" />
                            View in Git
                          </button>
                        </Show>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </Show>
          </Show>
        </div>

        {/* Diff preview */}
        <div class="flex-1 overflow-hidden flex flex-col border-t border-border">
          <Show
            when={selectedItem()}
            fallback={
              <div class="flex-1 flex items-center justify-center text-foreground-muted text-sm p-4">
                <div class="text-center">
                  <Icon name="code-branch" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Select an item to view changes</p>
                </div>
              </div>
            }
          >
            <div class="flex items-center justify-between px-3 py-2 border-b border-border bg-background-secondary">
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-foreground-muted">Changes</span>
                <Show when={selectedItem()?.type === "git" && selectedItem()?.gitCommit}>
                  <span class="text-xs font-mono text-foreground-muted">
                    {selectedItem()!.gitCommit!.shortHash}
                  </span>
                </Show>
              </div>
            </div>

            <div class="flex-1 overflow-auto">
              <Show when={isComparing()}>
                <div class="flex items-center justify-center h-full text-foreground-muted text-sm">
                  <Icon name="rotate" class="w-4 h-4 animate-spin mr-2" />
                  Loading comparison...
                </div>
              </Show>

              <Show when={!isComparing() && diffContent()}>
                <DiffView patch={diffContent()!} />
              </Show>

              <Show when={!isComparing() && !diffContent() && selectedItem()}>
                <div class="flex items-center justify-center h-full text-foreground-muted text-sm">
                  <Icon name="check" class="w-4 h-4 mr-2 text-success" />
                  No changes from current version
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>

      {/* Footer */}
      <div class="px-3 py-2 border-t border-border bg-background-secondary text-xs text-foreground-muted">
        <div class="flex items-center justify-between">
          <span class="flex items-center gap-1">
            <Icon name="code-commit" class="w-3 h-3" />
            {gitCommits().length} commits
          </span>
          <span class="flex items-center gap-1">
            <Icon name="floppy-disk" class="w-3 h-3" />
            {localEntries().length} local saves
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact button to open timeline for a file
 */
export function TimelineButton(props: { filePath: string; onClick: () => void }) {
  const localHistory = useLocalHistory();

  const totalCount = createMemo(() => {
    const localCount = localHistory.getHistory(props.filePath).length;
    return localCount;
  });

  return (
    <button
      onClick={props.onClick}
      class="flex items-center gap-1.5 px-2 py-1 text-xs text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
      title="View timeline"
    >
      <Icon name="clock" class="w-3.5 h-3.5" />
      <Show when={totalCount() > 0}>
        <span class="text-primary">{totalCount()}</span>
      </Show>
    </button>
  );
}

export default TimelineView;

