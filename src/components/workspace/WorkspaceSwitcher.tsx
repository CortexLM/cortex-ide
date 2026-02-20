import {
  Component,
  For,
  Show,
  createSignal,
  createMemo,
  onMount,
} from "solid-js";
import {
  useWorkspace,
  type RecentWorkspace,
} from "@/context/WorkspaceContext";
import {
  CortexButton,
  CortexIcon,
  CortexInput,
} from "@/components/cortex/primitives";

export interface WorkspaceSwitcherProps {
  class?: string;
  onClose?: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function truncatePath(path: string, maxSegments = 3): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= maxSegments) return normalized;
  return "~/" + parts.slice(-maxSegments).join("/");
}

export const WorkspaceSwitcher: Component<WorkspaceSwitcherProps> = (props) => {
  const workspace = useWorkspace();
  const [searchQuery, setSearchQuery] = createSignal("");
  let searchInputRef: HTMLInputElement | undefined;

  onMount(() => {
    searchInputRef?.focus();
  });

  const filteredWorkspaces = createMemo(() => {
    const all = workspace.recentWorkspaces();
    const query = searchQuery().toLowerCase().trim();
    if (!query) return all;
    return all.filter(
      (w) =>
        w.name.toLowerCase().includes(query) ||
        w.path.toLowerCase().includes(query),
    );
  });

  const hasWorkspaces = createMemo(() => workspace.recentWorkspaces().length > 0);

  const handleOpen = (w: RecentWorkspace) => {
    void workspace.openRecentWorkspace(w);
    props.onClose?.();
  };

  const handleRemove = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    workspace.removeFromRecentWorkspaces(id);
  };

  const handleClearAll = () => {
    workspace.clearRecentWorkspaces();
  };

  return (
    <div
      class={`flex flex-col h-full ${props.class ?? ""}`}
    >
      <div class="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-primary,#313244)]">
        <CortexIcon
          name="briefcase"
          size={14}
          style={{ color: "var(--text-secondary, #a6adc8)" }}
        />
        <span class="flex-1 text-xs font-semibold text-[var(--text-primary,#cdd6f4)]">
          Recent Workspaces
        </span>
        <CortexButton
          variant="ghost"
          size="xs"
          onClick={handleClearAll}
          icon="trash-2"
          title="Clear all recent workspaces"
          disabled={!hasWorkspaces()}
        />
        <Show when={props.onClose}>
          <CortexButton
            variant="ghost"
            size="xs"
            onClick={() => props.onClose?.()}
            icon="x"
            title="Close"
          />
        </Show>
      </div>

      <div class="px-2 py-2">
        <CortexInput
          type="search"
          placeholder="Search workspaces..."
          value={searchQuery()}
          onChange={setSearchQuery}
          leftIcon="search"
          size="sm"
        />
      </div>

      <div class="flex-1 overflow-y-auto px-1 pb-1">
        <For each={filteredWorkspaces()}>
          {(w) => (
            <div
              class="group flex items-center gap-2.5 px-3 py-2.5 mx-1 mb-0.5 rounded-md cursor-pointer transition-colors hover:bg-[var(--bg-hover,#262637)]"
              onClick={() => handleOpen(w)}
            >
              <CortexIcon
                name={w.isWorkspaceFile ? "file-text" : "folder"}
                size={16}
                style={{ color: "var(--text-secondary, #a6adc8)" }}
              />

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-[13px] font-medium text-[var(--text-primary,#cdd6f4)] truncate">
                    {w.name}
                  </span>
                  <Show when={w.folderCount > 1}>
                    <span class="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-[var(--bg-active,#313244)] text-[var(--text-secondary,#a6adc8)]">
                      {w.folderCount} folders
                    </span>
                  </Show>
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-[11px] text-[var(--text-tertiary,#6c7086)] truncate">
                    {truncatePath(w.path)}
                  </span>
                  <span class="shrink-0 text-[11px] text-[var(--text-tertiary,#6c7086)]">
                    {formatRelativeTime(w.lastOpened)}
                  </span>
                </div>
              </div>

              <CortexButton
                variant="ghost"
                size="xs"
                onClick={(e: MouseEvent) => handleRemove(e, w.id)}
                icon="x"
                title="Remove from recent"
              />
            </div>
          )}
        </For>

        <Show when={filteredWorkspaces().length === 0}>
          <div class="flex flex-col items-center gap-2 py-8 px-4">
            <CortexIcon
              name={searchQuery() ? "search" : "briefcase"}
              size={24}
              style={{ color: "var(--text-secondary, #a6adc8)", opacity: "0.4" }}
            />
            <span class="text-[13px] text-[var(--text-secondary,#a6adc8)]">
              {searchQuery()
                ? "No workspaces match your search"
                : "No recent workspaces"}
            </span>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default WorkspaceSwitcher;
