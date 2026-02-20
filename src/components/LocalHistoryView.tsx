import { createSignal, createEffect, For, Show, onMount, onCleanup } from "solid-js";
import { Icon } from "./ui/Icon";
import { useLocalHistory, formatBytes, formatRelativeTime, formatFullTime, type HistoryEntry, type VersionComparison } from "../context/LocalHistoryContext";
import { DiffView } from "./DiffView";

interface LocalHistoryViewProps {
  filePath: string;
  onClose?: () => void;
}

/**
 * Panel component for viewing and managing local file history
 */
export function LocalHistoryView(props: LocalHistoryViewProps) {
  const localHistory = useLocalHistory();
  
  const [entries, setEntries] = createSignal<HistoryEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = createSignal<string | null>(null);
  const [comparison, setComparison] = createSignal<VersionComparison | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isComparing, setIsComparing] = createSignal(false);
  const [showDiff, setShowDiff] = createSignal(true);
  const [confirmDelete, setConfirmDelete] = createSignal<string | null>(null);
  const [confirmClear, setConfirmClear] = createSignal(false);
  const [notification, setNotification] = createSignal<{ type: "success" | "error"; message: string } | null>(null);

  /**
   * Load history entries for the current file
   */
  const loadEntries = async () => {
    setIsLoading(true);
    try {
      await localHistory.saveSnapshot(props.filePath, "manual");
      const history = localHistory.getHistory(props.filePath);
      setEntries(history);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle entry selection and load comparison
   */
  const selectEntry = async (entryId: string) => {
    if (selectedEntryId() === entryId) {
      setSelectedEntryId(null);
      setComparison(null);
      return;
    }
    
    setSelectedEntryId(entryId);
    setIsComparing(true);
    
    try {
      const comp = await localHistory.compareWithCurrent(props.filePath, entryId);
      setComparison(comp);
    } finally {
      setIsComparing(false);
    }
  };

  /**
   * Restore a specific version
   */
  const restoreVersion = async (entryId: string) => {
    setIsLoading(true);
    try {
      const success = await localHistory.restoreVersion(props.filePath, entryId);
      if (success) {
        showNotification("success", "Version restored successfully");
        await loadEntries();
        setSelectedEntryId(null);
        setComparison(null);
      } else {
        showNotification("error", "Failed to restore version");
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete a specific entry
   */
  const deleteEntry = async (entryId: string) => {
    setIsLoading(true);
    try {
      const success = await localHistory.deleteEntry(props.filePath, entryId);
      if (success) {
        showNotification("success", "Entry deleted");
        await loadEntries();
        if (selectedEntryId() === entryId) {
          setSelectedEntryId(null);
          setComparison(null);
        }
      } else {
        showNotification("error", "Failed to delete entry");
      }
    } finally {
      setIsLoading(false);
      setConfirmDelete(null);
    }
  };

  /**
   * Clear all history for this file
   */
  const clearHistory = async () => {
    setIsLoading(true);
    try {
      const success = await localHistory.clearHistory(props.filePath);
      if (success) {
        showNotification("success", "History cleared");
        setEntries([]);
        setSelectedEntryId(null);
        setComparison(null);
      } else {
        showNotification("error", "Failed to clear history");
      }
    } finally {
      setIsLoading(false);
      setConfirmClear(false);
    }
  };

  /**
   * Display a notification
   */
  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  /**
   * Get filename from path
   */
  const fileName = () => {
    const path = props.filePath;
    return path.split("/").pop() || path.split("\\").pop() || path;
  };

  /**
   * Get trigger icon name
   */
  const getTriggerIconName = (trigger: HistoryEntry["trigger"]): string => {
    switch (trigger) {
      case "save":
        return "floppy-disk";
      case "external":
        return "circle-exclamation";
      case "periodic":
        return "clock";
      case "manual":
      default:
        return "code-branch";
    }
  };

  /**
   * Get trigger label
   */
  const getTriggerLabel = (trigger: HistoryEntry["trigger"]) => {
    switch (trigger) {
      case "save":
        return "Saved";
      case "external":
        return "External";
      case "periodic":
        return "Auto";
      case "manual":
      default:
        return "Manual";
    }
  };

  createEffect(() => {
    if (props.filePath) {
      loadEntries();
    }
  });

  onMount(() => {
    const handleHistoryRestored = (event: CustomEvent) => {
      if (event.detail?.filePath === props.filePath) {
        loadEntries();
      }
    };
    
    window.addEventListener("local-history:restored", handleHistoryRestored as EventListener);
    
    onCleanup(() => {
      window.removeEventListener("local-history:restored", handleHistoryRestored as EventListener);
    });
  });

  return (
    <div class="flex flex-col h-full bg-background border-l border-border">
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-border bg-background-secondary">
        <div class="flex items-center gap-2 min-w-0">
          <Icon name="clock" class="w-4 h-4 text-primary flex-shrink-0" />
          <span class="text-sm font-medium text-foreground truncate">Local History</span>
        </div>
        <div class="flex items-center gap-1">
          <button
            onClick={loadEntries}
            disabled={isLoading()}
            class="p-1.5 rounded hover:bg-background-tertiary text-foreground-muted hover:text-foreground transition-colors disabled:opacity-50"
            title="Refresh history"
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
            {fileName()}
          </span>
        </div>
      </div>

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

      {/* Content */}
      <div class="flex-1 overflow-hidden flex flex-col">
        {/* Entry list */}
        <div class="flex-shrink-0 max-h-[40%] overflow-y-auto border-b border-border">
          <Show
            when={entries().length > 0}
            fallback={
              <div class="p-4 text-center text-foreground-muted text-sm">
                <Show when={isLoading()} fallback={<span>No history available</span>}>
                  <span>Loading...</span>
                </Show>
              </div>
            }
          >
            <div class="p-2 space-y-1">
              {/* Clear all button */}
              <div class="flex items-center justify-between px-2 py-1 mb-2">
                <span class="text-xs text-foreground-muted">
                  {entries().length} version{entries().length !== 1 ? "s" : ""}
                </span>
                <Show when={!confirmClear()}>
                  <button
                    onClick={() => setConfirmClear(true)}
                    class="text-xs text-error hover:text-error/80 transition-colors"
                  >
                    Clear all
                  </button>
                </Show>
                <Show when={confirmClear()}>
                  <div class="flex items-center gap-2">
                    <button
                      onClick={clearHistory}
                      class="text-xs px-2 py-0.5 bg-error text-white rounded hover:bg-error/90 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      class="text-xs text-foreground-muted hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </Show>
              </div>

              <For each={entries()}>
                {(entry) => (
                  <div
                    class={`group rounded transition-colors ${
                      selectedEntryId() === entry.id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-background-tertiary border border-transparent"
                    }`}
                  >
                    <button
                      onClick={() => selectEntry(entry.id)}
                      class="w-full px-2 py-1.5 text-left"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 min-w-0">
                          <span
                            class={`flex-shrink-0 ${
                              selectedEntryId() === entry.id
                                ? "text-primary"
                                : "text-foreground-muted"
                            }`}
                          >
                            {selectedEntryId() === entry.id ? (
                              <Icon name="chevron-down" class="w-3 h-3" />
                            ) : (
                              <Icon name="chevron-right" class="w-3 h-3" />
                            )}
                          </span>
                          <span
                            class={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                              entry.trigger === "save"
                                ? "bg-success/10 text-success"
                                : entry.trigger === "external"
                                ? "bg-warning/10 text-warning"
                                : entry.trigger === "periodic"
                                ? "bg-info/10 text-info"
                                : "bg-primary/10 text-primary"
                            }`}
                            title={getTriggerLabel(entry.trigger)}
                          >
                            <Icon name={getTriggerIconName(entry.trigger)} class="w-3 h-3" />
                          </span>
                          <span
                            class="text-sm text-foreground truncate"
                            title={formatFullTime(entry.timestamp)}
                          >
                            {formatRelativeTime(entry.timestamp)}
                          </span>
                        </div>
                        <span class="text-xs text-foreground-muted flex-shrink-0">
                          {formatBytes(entry.size)}
                        </span>
                      </div>
                      <Show when={entry.label}>
                        <div class="mt-1 pl-5 text-xs text-foreground-muted truncate">
                          {entry.label}
                        </div>
                      </Show>
                    </button>

                    {/* Entry actions */}
                    <Show when={selectedEntryId() === entry.id}>
                      <div class="px-2 pb-2 flex items-center gap-2">
                        <button
                          onClick={() => restoreVersion(entry.id)}
                          disabled={isLoading()}
                          class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          <Icon name="rotate" class="w-3 h-3" />
                          Restore
                        </button>
                        <Show when={confirmDelete() !== entry.id}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete(entry.id);
                            }}
                            disabled={isLoading()}
                            class="p-1.5 text-error hover:bg-error/10 rounded transition-colors disabled:opacity-50"
                            title="Delete this version"
                          >
                            <Icon name="trash" class="w-3.5 h-3.5" />
                          </button>
                        </Show>
                        <Show when={confirmDelete() === entry.id}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteEntry(entry.id);
                            }}
                            disabled={isLoading()}
                            class="px-2 py-1 text-xs bg-error text-white rounded hover:bg-error/90 transition-colors disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete(null);
                            }}
                            class="px-2 py-1 text-xs text-foreground-muted hover:text-foreground transition-colors"
                          >
                            Cancel
                          </button>
                        </Show>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Diff preview */}
        <div class="flex-1 overflow-hidden flex flex-col">
          <Show
            when={selectedEntryId()}
            fallback={
              <div class="flex-1 flex items-center justify-center text-foreground-muted text-sm p-4">
                <div class="text-center">
                  <Icon name="code-branch" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Select a version to compare</p>
                </div>
              </div>
            }
          >
            <div class="flex items-center justify-between px-3 py-2 border-b border-border bg-background-secondary">
              <span class="text-xs font-medium text-foreground-muted">Diff Preview</span>
              <button
                onClick={() => setShowDiff(!showDiff())}
                class="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                {showDiff() ? "Hide diff" : "Show diff"}
              </button>
            </div>

            <div class="flex-1 overflow-auto p-2">
              <Show when={isComparing()}>
                <div class="flex items-center justify-center h-full text-foreground-muted text-sm">
                  <Icon name="rotate" class="w-4 h-4 animate-spin mr-2" />
                  Loading comparison...
                </div>
              </Show>

              <Show when={!isComparing() && comparison()}>
                {(comp) => (
                  <Show
                    when={comp().hasChanges}
                    fallback={
                      <div class="flex items-center justify-center h-full text-foreground-muted text-sm">
                        <Icon name="check" class="w-4 h-4 mr-2 text-success" />
                        No changes from current version
                      </div>
                    }
                  >
                    <Show when={showDiff()}>
                      <DiffView patch={comp().diff} />
                    </Show>
                    <Show when={!showDiff()}>
                      <div class="text-xs text-foreground-muted text-center py-4">
                        Diff hidden. Click "Show diff" to view changes.
                      </div>
                    </Show>
                  </Show>
                )}
              </Show>
            </div>
          </Show>
        </div>
      </div>

      {/* Footer stats */}
      <div class="px-3 py-2 border-t border-border bg-background-secondary text-xs text-foreground-muted">
        <div class="flex items-center justify-between">
          <span>
            Total: {localHistory.getHistoryEntryCount()} versions
          </span>
          <span>
            {formatBytes(localHistory.getTotalHistorySize())}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact button to open local history for a file
 */
export function LocalHistoryButton(props: { filePath: string; onClick: () => void }) {
  const localHistory = useLocalHistory();
  
  const entryCount = () => localHistory.getHistory(props.filePath).length;

  return (
    <button
      onClick={props.onClick}
      class="flex items-center gap-1.5 px-2 py-1 text-xs text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
      title="View local history"
    >
      <Icon name="clock" class="w-3.5 h-3.5" />
      <Show when={entryCount() > 0}>
        <span class="text-primary">{entryCount()}</span>
      </Show>
    </button>
  );
}

/**
 * Settings panel for local history configuration
 */
export function LocalHistorySettings() {
  const localHistory = useLocalHistory();
  
  const [enabled, setEnabled] = createSignal(localHistory.state.settings.enabled);
  const [maxEntries, setMaxEntries] = createSignal(localHistory.state.settings.maxEntriesPerFile);
  const [maxSize, setMaxSize] = createSignal(localHistory.state.settings.maxTotalSizeMB);
  const [intervalMinutes, setIntervalMinutes] = createSignal(
    Math.round(localHistory.state.settings.periodicSaveIntervalMs / 60000)
  );

  const handleSave = () => {
    localHistory.updateSettings({
      enabled: enabled(),
      maxEntriesPerFile: maxEntries(),
      maxTotalSizeMB: maxSize(),
      periodicSaveIntervalMs: intervalMinutes() * 60000,
    });
  };

  const handleClearAll = async () => {
    if (confirm("Are you sure you want to clear all local history? This cannot be undone.")) {
      await localHistory.clearAllHistory();
    }
  };

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium text-foreground">Local History</h3>
          <p class="text-xs text-foreground-muted mt-0.5">
            Automatically save file versions for recovery
          </p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled()}
            onChange={(e) => {
              setEnabled(e.currentTarget.checked);
              handleSave();
            }}
            class="sr-only peer"
          />
          <div class="w-9 h-5 bg-background-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-foreground-muted after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-white"></div>
        </label>
      </div>

      <Show when={enabled()}>
        <div class="space-y-3 pl-0 border-l-2 border-primary/20">
          <div class="pl-3">
            <label class="block text-xs text-foreground-muted mb-1">
              Max versions per file
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={maxEntries()}
              onChange={(e) => {
                setMaxEntries(parseInt(e.currentTarget.value) || 50);
                handleSave();
              }}
              class="w-full px-2 py-1.5 text-sm bg-background border border-border rounded focus:outline-none focus:border-primary"
            />
          </div>

          <div class="pl-3">
            <label class="block text-xs text-foreground-muted mb-1">
              Max total storage (MB)
            </label>
            <input
              type="number"
              min="10"
              max="1000"
              value={maxSize()}
              onChange={(e) => {
                setMaxSize(parseInt(e.currentTarget.value) || 100);
                handleSave();
              }}
              class="w-full px-2 py-1.5 text-sm bg-background border border-border rounded focus:outline-none focus:border-primary"
            />
          </div>

          <div class="pl-3">
            <label class="block text-xs text-foreground-muted mb-1">
              Auto-save interval (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={intervalMinutes()}
              onChange={(e) => {
                setIntervalMinutes(parseInt(e.currentTarget.value) || 5);
                handleSave();
              }}
              class="w-full px-2 py-1.5 text-sm bg-background border border-border rounded focus:outline-none focus:border-primary"
            />
          </div>

          <div class="pl-3 pt-2">
            <div class="flex items-center justify-between text-xs text-foreground-muted">
              <span>
                Current usage: {formatBytes(localHistory.getTotalHistorySize())} / {maxSize()} MB
              </span>
              <span>{localHistory.getHistoryEntryCount()} versions</span>
            </div>
          </div>

          <div class="pl-3 pt-2">
            <button
              onClick={handleClearAll}
              class="text-xs text-error hover:text-error/80 transition-colors"
            >
              Clear all history
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
