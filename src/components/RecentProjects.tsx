import { createSignal, Show, For, onMount, onCleanup, createEffect } from "solid-js";
import { Icon } from "./ui/Icon";
import { useRecentProjects, type RecentProject } from "@/context/RecentProjectsContext";

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

interface RecentProjectsModalProps {
  onClose?: () => void;
}

export function RecentProjectsModal(props: RecentProjectsModalProps) {
  const {
    filteredProjects,
    searchQuery,
    setSearchQuery,
    removeProject,
    togglePin,
    openProject,
    showRecentProjects,
    setShowRecentProjects,
  } = useRecentProjects();
  
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  const handleClose = () => {
    setShowRecentProjects(false);
    setSearchQuery("");
    props.onClose?.();
  };

  onMount(() => {
    inputRef?.focus();
  });

  createEffect(() => {
    const projects = filteredProjects();
    if (selectedIndex() >= projects.length) {
      setSelectedIndex(Math.max(0, projects.length - 1));
    }
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    const projects = filteredProjects();
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, projects.length - 1));
        scrollToSelected();
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        scrollToSelected();
        break;
      case "Enter":
        e.preventDefault();
        const selected = projects[selectedIndex()];
        if (selected) {
          openProject(selected, e.shiftKey);
        }
        break;
      case "Delete":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const selected = projects[selectedIndex()];
          if (selected) {
            removeProject(selected.id);
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
      const items = listRef.querySelectorAll("[data-project-item]");
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
    <Show when={showRecentProjects()}>
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
              placeholder="Search recent projects..."
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

          {/* Projects List */}
          <div
            ref={listRef}
            class="max-h-96 overflow-y-auto"
            style={{ "scrollbar-width": "thin" }}
          >
            <Show
              when={filteredProjects().length > 0}
              fallback={
                <div class="py-12 text-center">
                  <Icon name="folder" class="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-weaker)" }} />
                  <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                    {searchQuery() ? "No matching projects" : "No recent projects"}
                  </p>
                  <p class="text-xs mt-1" style={{ color: "var(--text-weaker)" }}>
                    {searchQuery()
                      ? "Try a different search term"
                      : "Open a folder to get started"}
                  </p>
                </div>
              }
            >
              <For each={filteredProjects()}>
                {(project, index) => (
                  <RecentProjectItem
                    project={project}
                    isSelected={selectedIndex() === index()}
                    onSelect={() => setSelectedIndex(index())}
                    onOpen={(newWindow) => openProject(project, newWindow)}
                    onRemove={() => removeProject(project.id)}
                    onTogglePin={() => togglePin(project.id)}
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
                  Shift+Enter
                </kbd>{" "}
                New Window
              </span>
            </div>
            <span>{filteredProjects().length} projects</span>
          </div>
        </div>
      </div>
    </Show>
  );
}

interface RecentProjectItemProps {
  project: RecentProject;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: (newWindow: boolean) => void;
  onRemove: () => void;
  onTogglePin: () => void;
}

function RecentProjectItem(props: RecentProjectItemProps) {
  return (
    <div
      data-project-item
      class="group flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
      style={{
        background: props.isSelected ? "var(--surface-raised)" : "transparent",
      }}
      onClick={() => props.onOpen(false)}
      onMouseEnter={props.onSelect}
    >
      {/* Icon */}
      <div
        class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "var(--background-base)" }}
      >
        <Icon name="folder" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
      </div>

      {/* Info */}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="text-sm font-medium truncate"
            style={{ color: "var(--text-base)" }}
          >
            {props.project.name}
          </span>
          <Show when={props.project.pinned}>
            <Icon name="star" class="w-3 h-3 shrink-0" style={{ color: "var(--accent-primary)" }} />
          </Show>
        </div>
        <div class="flex items-center gap-2 mt-0.5">
          <span
            class="text-xs truncate"
            style={{ color: "var(--text-weaker)" }}
          >
            {formatPath(props.project.path)}
          </span>
          <span
            class="text-xs shrink-0 flex items-center gap-1"
            style={{ color: "var(--text-weaker)" }}
          >
            <Icon name="clock" class="w-3 h-3" />
            {formatRelativeTime(props.project.lastOpened)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div
        class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={props.onTogglePin}
          class="p-1.5 rounded hover:bg-[var(--background-base)] transition-colors"
          title={props.project.pinned ? "Unpin project" : "Pin project"}
        >
          <Icon name="star" class="w-3.5 h-3.5" style={{
              color: props.project.pinned
                ? "var(--accent-primary)"
                : "var(--text-weaker)",
            }} />
        </button>
        <button
          onClick={() => props.onOpen(true)}
          class="p-1.5 rounded hover:bg-[var(--background-base)] transition-colors"
          title="Open in new window"
        >
          <Icon name="arrow-up-right-from-square" class="w-3.5 h-3.5" style={{ color: "var(--text-weaker)" }} />
        </button>
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

interface RecentProjectsListProps {
  maxItems?: number;
  showEmpty?: boolean;
  onProjectOpen?: () => void;
}

export function RecentProjectsList(props: RecentProjectsListProps) {
  const {
    filteredProjects,
    removeProject,
    togglePin,
    openProject,
  } = useRecentProjects();

  const displayProjects = () => {
    const projects = filteredProjects();
    return props.maxItems ? projects.slice(0, props.maxItems) : projects;
  };

  return (
    <Show
      when={displayProjects().length > 0}
      fallback={
        <Show when={props.showEmpty !== false}>
          <div
            class="text-center py-12 rounded-lg"
            style={{
              background: "var(--surface-base)",
              border: "1px dashed var(--border-weak)",
            }}
          >
              <Icon name="folder" class="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-weaker)" }} />
            <p class="text-sm" style={{ color: "var(--text-weaker)" }}>
              No recent projects
            </p>
            <p class="text-xs mt-1" style={{ color: "var(--text-weaker)" }}>
              Open a folder to get started
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
        <For each={displayProjects()}>
          {(project, index) => (
            <div
              class="group w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-raised)] cursor-pointer"
              style={{
                "border-top":
                  index() > 0 ? "1px solid var(--border-weak)" : "none",
              }}
              onClick={() => {
                openProject(project);
                props.onProjectOpen?.();
              }}
            >
              <Icon name="folder" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weaker)" }} />
              <div class="flex-1 min-w-0 text-left">
                <div class="flex items-center gap-2">
                  <span
                    class="text-sm truncate"
                    style={{ color: "var(--text-base)" }}
                  >
                    {project.name}
                  </span>
                  <Show when={project.pinned}>
                    <Icon name="star" class="w-3 h-3 shrink-0" style={{ color: "var(--accent-primary)" }} />
                  </Show>
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span
                    class="text-xs truncate"
                    style={{ color: "var(--text-weaker)" }}
                  >
                    {formatPath(project.path)}
                  </span>
                  <span
                    class="text-xs shrink-0"
                    style={{ color: "var(--text-weaker)" }}
                  >
                    · {formatRelativeTime(project.lastOpened)}
                  </span>
                </div>
              </div>
              <div
                class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => togglePin(project.id)}
                  class="p-1.5 rounded hover:bg-[var(--background-base)] transition-colors"
                  title={project.pinned ? "Unpin" : "Pin"}
                >
                  <Icon name="star" class="w-3.5 h-3.5" style={{
                      color: project.pinned
                        ? "var(--accent-primary)"
                        : "var(--text-weaker)",
                    }} />
                </button>
                <button
                  onClick={() => removeProject(project.id)}
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

interface WelcomePageRecentProjectsProps {
  onOpenFolder: () => void;
}

export function WelcomePageRecentProjects(props: WelcomePageRecentProjectsProps) {
  const {
    pinnedProjects,
    unpinnedProjects,
    searchQuery,
    setSearchQuery,
    setShowRecentProjects,
  } = useRecentProjects();

  const hasPinnedProjects = () => pinnedProjects().length > 0;
  const hasUnpinnedProjects = () => unpinnedProjects().length > 0;
  const hasAnyProjects = () => hasPinnedProjects() || hasUnpinnedProjects();

  return (
    <div class="space-y-6">
      {/* Search bar for recent projects */}
      <Show when={hasAnyProjects()}>
        <div class="relative">
          <Icon name="magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-weaker)" }} />
          <input
            type="text"
            placeholder="Search recent projects..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            onFocus={() => setShowRecentProjects(true)}
            class="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg"
            style={{
              background: "var(--surface-base)",
              border: "1px solid var(--border-weak)",
              color: "var(--text-base)",
            }}
          />
        </div>
      </Show>

      {/* Pinned Projects Section */}
      <Show when={hasPinnedProjects()}>
        <div>
          <div class="flex items-center gap-2 mb-3">
            <Icon name="star" class="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
            <span class="text-xs font-medium" style={{ color: "var(--text-weak)" }}>
              Pinned Projects
            </span>
          </div>
          <RecentProjectsList maxItems={5} showEmpty={false} />
        </div>
      </Show>

      {/* Recent Projects Section */}
      <div>
        <div class="flex items-center gap-2 mb-3">
            <Icon name="clock" class="w-4 h-4" style={{ color: "var(--text-weaker)" }} />
          <span class="text-xs font-medium" style={{ color: "var(--text-weak)" }}>
            Recent Projects
          </span>
          <Show when={hasAnyProjects()}>
            <button
              onClick={() => setShowRecentProjects(true)}
              class="ml-auto text-xs hover:underline"
              style={{ color: "var(--accent-primary)" }}
            >
              View All
            </button>
          </Show>
        </div>

        <Show
          when={hasAnyProjects()}
          fallback={
            <div
              class="text-center py-12 rounded-lg"
              style={{
                background: "var(--surface-base)",
                border: "1px dashed var(--border-weak)",
              }}
            >
              <Icon name="folder" class="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-weaker)" }} />
              <p class="text-sm" style={{ color: "var(--text-weaker)" }}>
                No recent projects
              </p>
              <p class="text-xs mt-1" style={{ color: "var(--text-weaker)" }}>
                Open a folder to get started
              </p>
              <button
                onClick={props.onOpenFolder}
                class="mt-4 px-4 py-2 text-sm rounded-lg transition-colors"
                style={{
                  background: "var(--surface-raised)",
                  color: "var(--text-base)",
                }}
              >
                Open Folder
              </button>
            </div>
          }
        >
          <RecentProjectsList maxItems={10} showEmpty={false} />
        </Show>
      </div>

      {/* Keyboard shortcuts hint */}
      <div class="text-center">
        <p class="text-xs" style={{ color: "var(--text-weaker)" }}>
          Press{" "}
          <kbd
            class="px-1.5 py-0.5 rounded text-xs"
            style={{ background: "var(--surface-base)" }}
          >
            Ctrl+Shift+E
          </kbd>{" "}
          to search recent projects
        </p>
      </div>
    </div>
  );
}
