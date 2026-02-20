import { createSignal, For, Show, onMount } from "solid-js";
import { Icon } from "../ui/Icon";
import { 
  gitStashListEnhanced, 
  gitStashApply, 
  gitStashPop, 
  gitStashDrop, 
  gitStashCreate,
  StashEntry as TauriStashEntry
} from "../../utils/tauri-api";
import { getProjectPath } from "../../utils/workspace";

export interface StashEntry {
  index: number;
  message: string;
  branch: string | null;
  timestamp: number;
  date: string;
}

export interface StashPanelProps {
  onStashApply?: (index: number) => void;
  onStashPop?: (index: number) => void;
  onStashDrop?: (index: number) => void;
  onStashView?: (entry: StashEntry) => void;
  onCreateStash?: (message: string, includeUntracked: boolean) => void;
}

export function StashPanel(props: StashPanelProps) {
  const [stashes, setStashes] = createSignal<StashEntry[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [selectedIndex, setSelectedIndex] = createSignal<number | null>(null);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [showCreateDialog, setShowCreateDialog] = createSignal(false);
  const [newStashMessage, setNewStashMessage] = createSignal("");
  const [includeUntracked, setIncludeUntracked] = createSignal(true);
  const [expandedStash, setExpandedStash] = createSignal<number | null>(null);
  const [confirmAction, setConfirmAction] = createSignal<{ type: "drop" | "pop"; index: number } | null>(null);

  onMount(() => {
    fetchStashes();
  });

  const fetchStashes = async () => {
    setLoading(true);
    try {
      const projectPath = getProjectPath();
      const data = await gitStashListEnhanced(projectPath);
      
      // Map Tauri StashEntry to component's StashEntry interface
      const mappedStashes: StashEntry[] = data.map((s: TauriStashEntry) => ({
        index: s.index,
        message: s.message,
        branch: s.branch,
        timestamp: s.date ? new Date(s.date).getTime() / 1000 : Date.now() / 1000,
        date: s.date || new Date().toISOString(),
      }));
      
      setStashes(mappedStashes);
    } catch (err) {
      console.error("Failed to fetch stashes:", err);
    } finally {
      setLoading(false);
    }
  };

  const applyStash = async (index: number) => {
    try {
      const projectPath = getProjectPath();
      await gitStashApply(projectPath, index);
      props.onStashApply?.(index);
      fetchStashes();
    } catch (err) {
      console.error("Failed to apply stash:", err);
    }
  };

  const popStash = async (index: number) => {
    try {
      const projectPath = getProjectPath();
      await gitStashPop(projectPath, index);
      props.onStashPop?.(index);
      setConfirmAction(null);
      fetchStashes();
    } catch (err) {
      console.error("Failed to pop stash:", err);
    }
  };

  const dropStash = async (index: number) => {
    try {
      const projectPath = getProjectPath();
      await gitStashDrop(projectPath, index);
      props.onStashDrop?.(index);
      setConfirmAction(null);
      fetchStashes();
    } catch (err) {
      console.error("Failed to drop stash:", err);
    }
  };

  const createStash = async () => {
    if (!newStashMessage().trim()) return;

    try {
      const projectPath = getProjectPath();
      await gitStashCreate(projectPath, newStashMessage(), includeUntracked());
      props.onCreateStash?.(newStashMessage(), includeUntracked());
      setShowCreateDialog(false);
      setNewStashMessage("");
      fetchStashes();
    } catch (err) {
      console.error("Failed to create stash:", err);
    }
  };

  const filteredStashes = () => {
    const query = searchQuery().toLowerCase();
    if (!query) return stashes();

    return stashes().filter(stash =>
      stash.message.toLowerCase().includes(query) ||
      stash.branch?.toLowerCase().includes(query)
    );
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins} minutes ago`;
      }
      return `${diffHours} hours ago`;
    }
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const toggleExpanded = (index: number) => {
    setExpandedStash(expandedStash() === index ? null : index);
  };

  return (
    <div
      class="h-full flex flex-col overflow-hidden"
      style={{ background: "var(--background-base)" }}
    >
      {/* Header */}
      <div
        class="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-center gap-2">
          <Icon name="box-archive" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
            Stashes
          </span>
          <span
            class="text-xs px-1.5 rounded"
            style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}
          >
            {stashes().length}
          </span>
        </div>
        <div class="flex items-center gap-1">
          <button
            class="p-1.5 rounded hover:bg-white/10 transition-colors"
            onClick={() => setShowCreateDialog(true)}
            title="Create new stash"
          >
            <Icon name="plus" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          </button>
          <button
            class="p-1.5 rounded hover:bg-white/10 transition-colors"
            onClick={fetchStashes}
            disabled={loading()}
          >
            <Icon
              name="rotate"
              class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`}
              style={{ color: "var(--text-weak)" }}
            />
          </button>
        </div>
      </div>

      {/* Search */}
      <Show when={stashes().length > 0}>
        <div class="px-3 py-2 border-b" style={{ "border-color": "var(--border-weak)" }}>
          <div
            class="flex items-center gap-2 px-2 py-1.5 rounded"
            style={{ background: "var(--background-stronger)" }}
          >
            <Icon name="magnifying-glass" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
            <input
              type="text"
              placeholder="Search stashes..."
              class="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--text-base)" }}
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
            />
          </div>
        </div>
      </Show>

      {/* Content */}
      <div class="flex-1 overflow-auto">
        <Show when={loading()}>
          <div class="flex items-center justify-center h-32">
            <span style={{ color: "var(--text-weak)" }}>Loading stashes...</span>
          </div>
        </Show>

        <Show when={!loading() && filteredStashes().length === 0}>
          <div class="flex flex-col items-center justify-center h-32 gap-2">
            <Icon name="box-archive" class="w-8 h-8" style={{ color: "var(--text-weaker)" }} />
            <span style={{ color: "var(--text-weak)" }}>
              {stashes().length === 0 ? "No stashes" : "No matching stashes"}
            </span>
            <Show when={stashes().length === 0}>
              <button
                class="mt-2 px-3 py-1.5 rounded text-sm transition-colors"
                style={{ background: "var(--accent-primary)", color: "white" }}
                onClick={() => setShowCreateDialog(true)}
              >
                Create stash
              </button>
            </Show>
          </div>
        </Show>

        <Show when={!loading() && filteredStashes().length > 0}>
          <div class="py-1">
            <For each={filteredStashes()}>
              {(stash) => {
                const isExpanded = () => expandedStash() === stash.index;
                const isSelected = () => selectedIndex() === stash.index;

                return (
                  <div>
                    <div
                      class={`group px-3 py-2 cursor-pointer transition-colors ${
                        isSelected() ? "bg-white/10" : "hover:bg-white/5"
                      }`}
                      onClick={() => {
                        setSelectedIndex(stash.index);
                        toggleExpanded(stash.index);
                      }}
                    >
                      <div class="flex items-start gap-2">
                        <button
                          class="p-0.5 mt-0.5 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(stash.index);
                          }}
                        >
                          {isExpanded() ? (
                            <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                          ) : (
                            <Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                          )}
                        </button>

                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span
                              class="text-xs font-mono px-1.5 py-0.5 rounded"
                              style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}
                            >
                              stash@{`{${stash.index}}`}
                            </span>
                            <span class="text-sm truncate" style={{ color: "var(--text-base)" }}>
                              {stash.message}
                            </span>
                          </div>

                          <div class="flex items-center gap-3 mt-1">
                            <Show when={stash.branch}>
                              <span class="flex items-center gap-1 text-xs" style={{ color: "var(--text-weak)" }}>
                                <Icon name="code-branch" class="w-3 h-3" />
                                {stash.branch}
                              </span>
                            </Show>
                            <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
                              {formatTimestamp(stash.timestamp)}
                            </span>
                          </div>
                        </div>

                        {/* Quick actions */}
                        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            class="p-1.5 rounded hover:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              applyStash(stash.index);
                            }}
                            title="Apply"
                          >
                            <Icon name="download" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
                          </button>
                          <button
                            class="p-1.5 rounded hover:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmAction({ type: "pop", index: stash.index });
                            }}
                            title="Pop"
                          >
                            <Icon name="play" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
                          </button>
                          <button
                            class="p-1.5 rounded hover:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onStashView?.(stash);
                            }}
                            title="View"
                          >
                            <Icon name="eye" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
                          </button>
                          <button
                            class="p-1.5 rounded hover:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmAction({ type: "drop", index: stash.index });
                            }}
                            title="Drop"
                          >
                            <Icon name="trash" class="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded details */}
                    <Show when={isExpanded()}>
                      <div
                        class="mx-3 mb-2 p-3 rounded"
                        style={{ background: "var(--surface-base)" }}
                      >
                        <div class="space-y-3">
                          <div class="flex items-center gap-2">
                            <Icon name="clock" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
                            <span class="text-sm" style={{ color: "var(--text-base)" }}>
                              {new Date(stash.timestamp * 1000).toLocaleString()}
                            </span>
                          </div>

                          <div class="flex items-center gap-2 pt-2 border-t" style={{ "border-color": "var(--border-weak)" }}>
                            <button
                              class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors"
                              style={{ background: "var(--accent-primary)", color: "white" }}
                              onClick={() => applyStash(stash.index)}
                            >
                              <Icon name="download" class="w-4 h-4" />
                              Apply
                            </button>
                            <button
                              class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors border"
                              style={{ "border-color": "var(--border-weak)", color: "var(--text-base)" }}
                              onClick={() => setConfirmAction({ type: "pop", index: stash.index })}
                            >
                              <Icon name="play" class="w-4 h-4" />
                              Pop
                            </button>
                            <button
                              class="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors hover:bg-red-500/20"
                              style={{ color: "var(--cortex-error)" }}
                              onClick={() => setConfirmAction({ type: "drop", index: stash.index })}
                            >
                              <Icon name="trash" class="w-4 h-4" />
                              Drop
                            </button>
                          </div>
                        </div>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* Create stash dialog */}
      <Show when={showCreateDialog()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => setShowCreateDialog(false)}
        >
          <div
            class="w-96 p-4 rounded-lg shadow-xl"
            style={{ background: "var(--surface-raised)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-medium" style={{ color: "var(--text-base)" }}>
                Create Stash
              </h3>
              <button
                class="p-1 rounded hover:bg-white/10"
                onClick={() => setShowCreateDialog(false)}
              >
                <Icon name="xmark" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm mb-1.5" style={{ color: "var(--text-weak)" }}>
                  Message
                </label>
                <input
                  type="text"
                  placeholder="Stash message..."
                  class="w-full px-3 py-2 rounded text-sm outline-none"
                  style={{
                    background: "var(--background-stronger)",
                    color: "var(--text-base)",
                    border: "1px solid var(--border-weak)"
                  }}
                  value={newStashMessage()}
                  onInput={(e) => setNewStashMessage(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newStashMessage().trim()) {
                      createStash();
                    }
                  }}
                />
              </div>

              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUntracked()}
                  onChange={(e) => setIncludeUntracked(e.currentTarget.checked)}
                  class="rounded"
                />
                <span class="text-sm" style={{ color: "var(--text-base)" }}>
                  Include untracked files
                </span>
              </label>

              <div class="flex justify-end gap-2 pt-2">
                <button
                  class="px-4 py-2 rounded text-sm transition-colors"
                  style={{ color: "var(--text-weak)" }}
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </button>
                <button
                  class="px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
                  style={{ background: "var(--accent-primary)", color: "white" }}
                  disabled={!newStashMessage().trim()}
                  onClick={createStash}
                >
                  Create Stash
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Confirmation dialog */}
      <Show when={confirmAction()}>
        {(action) => (
          <div
            class="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0, 0, 0, 0.5)" }}
            onClick={() => setConfirmAction(null)}
          >
            <div
              class="w-80 p-4 rounded-lg shadow-xl"
              style={{ background: "var(--surface-raised)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 class="text-lg font-medium mb-2" style={{ color: "var(--text-base)" }}>
                {action().type === "drop" ? "Drop Stash?" : "Pop Stash?"}
              </h3>
              <p class="text-sm mb-4" style={{ color: "var(--text-weak)" }}>
                {action().type === "drop"
                  ? `This will permanently delete stash@{${action().index}}. This action cannot be undone.`
                  : `This will apply and remove stash@{${action().index}}.`}
              </p>
              <div class="flex justify-end gap-2">
                <button
                  class="px-4 py-2 rounded text-sm transition-colors"
                  style={{ color: "var(--text-weak)" }}
                  onClick={() => setConfirmAction(null)}
                >
                  Cancel
                </button>
                <button
                  class={`px-4 py-2 rounded text-sm transition-colors ${
                    action().type === "drop" ? "bg-red-500 hover:bg-red-600" : ""
                  }`}
                  style={action().type === "pop" ? { background: "var(--accent-primary)", color: "white" } : { color: "white" }}
                  onClick={() => {
                    if (action().type === "drop") {
                      dropStash(action().index);
                    } else {
                      popStash(action().index);
                    }
                  }}
                >
                  {action().type === "drop" ? "Drop" : "Pop"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}

export default StashPanel;

