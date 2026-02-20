import { createSignal, Show, For, onMount, onCleanup, createEffect } from "solid-js";
import { Icon } from "./ui/Icon";
import { useWorkspace, type RecentWorkspace } from "@/context/WorkspaceContext";

// ============================================================================
// Utility Functions
// ============================================================================

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  
  if (months > 0) return `${months} month${months > 1 ? "s" : ""} ago`;
  if (weeks > 0) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return "Just now";
}

function formatPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  
  if (parts.length > 3) {
    return "~/" + parts.slice(-3).join("/");
  }
  return normalized;
}

// ============================================================================
// RecentWorkspacesModal Component
// ============================================================================

interface RecentWorkspacesModalProps {
  open: boolean;
  onClose: () => void;
}

export function RecentWorkspacesModal(props: RecentWorkspacesModalProps) {
  const workspace = useWorkspace();
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  const filteredWorkspaces = () => {
    const query = searchQuery().toLowerCase().trim();
    const workspaces = workspace.recentWorkspaces();
    
    if (!query) {
      return workspaces;
    }
    
    return workspaces.filter(w => {
      const nameMatch = w.name.toLowerCase().includes(query);
      const pathMatch = w.path.toLowerCase().includes(query);
      return nameMatch || pathMatch;
    });
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedIndex(0);
    props.onClose();
  };

  onMount(() => {
    if (props.open) {
      inputRef?.focus();
    }
  });

  createEffect(() => {
    if (props.open) {
      inputRef?.focus();
    }
  });

  createEffect(() => {
    const workspaces = filteredWorkspaces();
    if (selectedIndex() >= workspaces.length) {
      setSelectedIndex(Math.max(0, workspaces.length - 1));
    }
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.open) return;
    
    const workspaces = filteredWorkspaces();
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, workspaces.length - 1));
        scrollToSelected();
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        scrollToSelected();
        break;
      case "Enter":
        e.preventDefault();
        const selected = workspaces[selectedIndex()];
        if (selected) {
          workspace.openRecentWorkspace(selected);
          handleClose();
        }
        break;
      case "Delete":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const selected = workspaces[selectedIndex()];
          if (selected) {
            workspace.removeFromRecentWorkspaces(selected.id);
          }
        }
        break;
      case "Escape":
        handleClose();
        break;
    }
  };

  const scrollToSelected = () => {
    if (listRef) {
      const items = listRef.querySelectorAll("[data-workspace-item]");
      const selectedItem = items[selectedIndex()] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest" });
      }
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 flex items-start justify-center pt-20 z-50"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={handleClose}
      >
        <div
          class="w-full max-w-xl rounded-lg overflow-hidden"
          style={{
            background: "var(--surface-base)",
            border: "1px solid var(--border-base)",
            "box-shadow": "0 16px 48px rgba(0,0,0,0.4)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Header */}
          <div
            class="flex items-center gap-3 px-4 py-3"
            style={{ "border-bottom": "1px solid var(--border-weak)" }}
          >
            <Icon name="magnifying-glass" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weaker)" }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search recent workspaces..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--text-base)" }}
            />
            <Show when={searchQuery()}>
              <button
                onClick={() => setSearchQuery("")}
                class="p-1 rounded hover:bg-[var(--surface-raised)] transition-colors"
              >
                <Icon name="xmark" class="w-3 h-3" style={{ color: "var(--text-weaker)" }} />
              </button>
            </Show>
          </div>

          {/* Workspaces List */}
          <div
            ref={listRef}
            class="max-h-96 overflow-y-auto"
            style={{ "scrollbar-width": "thin" }}
          >
            <Show
              when={filteredWorkspaces().length > 0}
              fallback={
                <div class="py-12 text-center">
                  <Icon name="layer-group" class="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-weaker)" }} />
                  <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                    {searchQuery() ? "No matching workspaces" : "No recent workspaces"}
                  </p>
                  <p class="text-xs mt-1" style={{ color: "var(--text-weaker)" }}>
                    {searchQuery()
                      ? "Try a different search term"
                      : "Open a folder or workspace to get started"}
                  </p>
                </div>
              }
            >
              <For each={filteredWorkspaces()}>
                {(ws, index) => (
                  <RecentWorkspaceItem
                    workspace={ws}
                    isSelected={selectedIndex() === index()}
                    onSelect={() => setSelectedIndex(index())}
                    onOpen={() => {
                      workspace.openRecentWorkspace(ws);
                      handleClose();
                    }}
                    onRemove={() => workspace.removeFromRecentWorkspaces(ws.id)}
                  />
                )}
              </For>
            </Show>
          </div>

          {/* Footer */}
          <div
            class="px-4 py-2.5 flex items-center justify-between text-xs"
            style={{
              background: "var(--background-base)",
              "border-top": "1px solid var(--border-weak)",
              color: "var(--text-weaker)",
            }}
          >
            <div class="flex items-center gap-4">
              <span>
                <kbd class="px-1 py-0.5 rounded text-xs" style={{ background: "var(--surface-raised)" }}>
                  ↑↓
                </kbd>{" "}
                Navigate
              </span>
              <span>
                <kbd class="px-1 py-0.5 rounded text-xs" style={{ background: "var(--surface-raised)" }}>
                  Enter
                </kbd>{" "}
                Open
              </span>
              <span>
                <kbd class="px-1 py-0.5 rounded text-xs" style={{ background: "var(--surface-raised)" }}>
                  Ctrl+Del
                </kbd>{" "}
                Remove
              </span>
            </div>
            <div class="flex items-center gap-4">
              <span>{filteredWorkspaces().length} workspaces</span>
              <Show when={workspace.recentWorkspaces().length > 0}>
                <button
                  onClick={() => workspace.clearRecentWorkspaces()}
                  class="text-xs hover:underline"
                  style={{ color: "var(--text-weaker)" }}
                >
                  Clear All
                </button>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// RecentWorkspaceItem Component
// ============================================================================

interface RecentWorkspaceItemProps {
  workspace: RecentWorkspace;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onRemove: () => void;
}

function RecentWorkspaceItem(props: RecentWorkspaceItemProps) {
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    // Could add a context menu here in the future
    props.onRemove();
  };

  return (
    <div
      data-workspace-item
      class="group flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
      style={{
        background: props.isSelected ? "var(--surface-raised)" : "transparent",
      }}
      onClick={props.onOpen}
      onContextMenu={handleContextMenu}
      onMouseEnter={props.onSelect}
    >
      {/* Icon */}
      <div
        class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "var(--background-base)" }}
      >
        <Show when={props.workspace.isWorkspaceFile || props.workspace.folderCount > 1} fallback={
          <Icon name="folder" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
        }>
          <Icon name="layer-group" class="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
        </Show>
      </div>

      {/* Info */}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="text-sm font-medium truncate"
            style={{ color: "var(--text-base)" }}
          >
            {props.workspace.name}
          </span>
          <Show when={props.workspace.folderCount > 1}>
            <span
              class="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: "var(--surface-raised)",
                color: "var(--text-weaker)",
              }}
            >
              {props.workspace.folderCount} folders
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-2 mt-0.5">
          <span
            class="text-xs truncate"
            style={{ color: "var(--text-weaker)" }}
          >
            {formatPath(props.workspace.path)}
          </span>
          <span
            class="text-xs shrink-0 flex items-center gap-1"
            style={{ color: "var(--text-weaker)" }}
          >
            <Icon name="clock" class="w-3 h-3" />
            {formatRelativeTime(props.workspace.lastOpened)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div
        class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={props.onRemove}
          class="p-1.5 rounded hover:bg-[var(--background-base)] transition-colors"
          title="Remove from recent"
        >
                  <Icon name="trash" class="w-3.5 h-3.5" style={{ color: "var(--text-weaker)" }} />
        </button>
      </div>

      {/* Arrow indicator when selected */}
      <Show when={props.isSelected}>
        <Icon name="chevron-right" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weaker)" }} />
      </Show>
    </div>
  );
}

// ============================================================================
// RecentWorkspacesList Component
// ============================================================================

interface RecentWorkspacesListProps {
  maxItems?: number;
  showEmpty?: boolean;
  onWorkspaceOpen?: () => void;
}

export function RecentWorkspacesList(props: RecentWorkspacesListProps) {
  const workspace = useWorkspace();

  const displayWorkspaces = () => {
    const workspaces = workspace.recentWorkspaces();
    return props.maxItems ? workspaces.slice(0, props.maxItems) : workspaces;
  };

  return (
    <Show
      when={displayWorkspaces().length > 0}
      fallback={
        <Show when={props.showEmpty !== false}>
          <div
            class="text-center py-12 rounded-lg"
            style={{
              background: "var(--surface-base)",
              border: "1px dashed var(--border-weak)",
            }}
          >
            <Icon name="layer-group" class="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-weaker)" }} />
            <p class="text-sm" style={{ color: "var(--text-weaker)" }}>
              No recent workspaces
            </p>
            <p class="text-xs mt-1" style={{ color: "var(--text-weaker)" }}>
              Open a folder or workspace to get started
            </p>
          </div>
        </Show>
      }
    >
      <div
        class="rounded-lg overflow-hidden"
        style={{
          background: "var(--surface-base)",
          border: "1px solid var(--border-weak)",
        }}
      >
        <For each={displayWorkspaces()}>
          {(ws, index) => (
            <div
              class="group w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-raised)] cursor-pointer"
              style={{
                "border-top": index() > 0 ? "1px solid var(--border-weak)" : "none",
              }}
              onClick={() => {
                workspace.openRecentWorkspace(ws);
                props.onWorkspaceOpen?.();
              }}
            >
              <Show when={ws.isWorkspaceFile || ws.folderCount > 1} fallback={
                <Icon name="folder" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weaker)" }} />
              }>
                <Icon name="layer-group" class="w-4 h-4 shrink-0" style={{ color: "var(--accent-primary)" }} />
              </Show>
              <div class="flex-1 min-w-0 text-left">
                <div class="flex items-center gap-2">
                  <span class="text-sm truncate" style={{ color: "var(--text-base)" }}>
                    {ws.name}
                  </span>
                  <Show when={ws.folderCount > 1}>
                    <span
                      class="text-xs px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        background: "var(--surface-raised)",
                        color: "var(--text-weaker)",
                      }}
                    >
                      {ws.folderCount} folders
                    </span>
                  </Show>
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-xs truncate" style={{ color: "var(--text-weaker)" }}>
                    {formatPath(ws.path)}
                  </span>
                  <span class="text-xs shrink-0" style={{ color: "var(--text-weaker)" }}>
                    · {formatRelativeTime(ws.lastOpened)}
                  </span>
                </div>
              </div>
              <div
                class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => workspace.removeFromRecentWorkspaces(ws.id)}
                  class="p-1.5 rounded hover:bg-[var(--background-base)] transition-colors"
                  title="Remove"
                >
          <Icon name="trash" class="w-3.5 h-3.5" style={{ color: "var(--text-weaker)" }} />
                </button>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

// ============================================================================
// Export Types
// ============================================================================

export type { RecentWorkspace };
