/**
 * GitHub Codespaces Panel
 * 
 * Displays and manages GitHub Codespaces with list view,
 * create functionality, and connection options.
 */

import { createSignal, For, Show, createEffect } from "solid-js";
import { Icon } from "../ui/Icon";
import {
  useCodespaces,
  type Codespace,
  type CodespaceState,
  type CreateCodespaceOptions,
  type CodespaceRepository,
  type CodespaceMachine,
} from "@/context/CodespacesContext";

// Status color mapping
const getStatusColor = (state: CodespaceState): string => {
  switch (state) {
    case "Available":
      return "var(--success)";
    case "Starting":
    case "Provisioning":
    case "Queued":
      return "var(--warning)";
    case "Shutdown":
    case "Unavailable":
      return "var(--text-weaker)";
    case "Failed":
    case "Deleted":
      return "var(--error)";
    default:
      return "var(--text-weak)";
  }
};

// Status icon mapping
function StatusIcon(props: { state: CodespaceState }) {
  const isRunning = () => props.state === "Available";
  const isLoading = () => ["Starting", "Provisioning", "Queued", "ShuttingDown", "Rebuilding"].includes(props.state);
  const isError = () => ["Failed", "Deleted"].includes(props.state);

  return (
    <Show
      when={!isLoading()}
      fallback={<Icon name="spinner" class="w-4 h-4 animate-spin" style={{ color: "var(--warning)" }} />}
    >
      <Show
        when={isRunning()}
        fallback={
          <Show
            when={isError()}
            fallback={
              <div
                class="w-2 h-2 rounded-full"
                style={{ "background-color": getStatusColor(props.state) }}
              />
            }
          >
            <Icon name="circle-exclamation" class="w-4 h-4" style={{ color: "var(--error)" }} />
          </Show>
        }
      >
        <Icon name="check" class="w-4 h-4" style={{ color: "var(--success)" }} />
      </Show>
    </Show>
  );
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface CodespacesListProps {
  codespaces: Codespace[];
  onRefresh: () => void;
  onStart: (codespace: Codespace) => void;
  onStop: (codespace: Codespace) => void;
  onDelete: (codespace: Codespace) => void;
  onOpenBrowser: (codespace: Codespace) => void;
  onOpenVSCode: (codespace: Codespace) => void;
  onConnectSSH: (codespace: Codespace) => void;
  isLoading: boolean;
}

function CodespacesList(props: CodespacesListProps) {
  const [menuOpenId, setMenuOpenId] = createSignal<number | null>(null);
  const [actionInProgress, setActionInProgress] = createSignal<number | null>(null);

  const handleStart = async (codespace: Codespace) => {
    setActionInProgress(codespace.id);
    try {
      await props.onStart(codespace);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleStop = async (codespace: Codespace) => {
    setActionInProgress(codespace.id);
    try {
      await props.onStop(codespace);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (codespace: Codespace) => {
    if (confirm(`Are you sure you want to delete "${codespace.display_name || codespace.name}"?`)) {
      setActionInProgress(codespace.id);
      try {
        await props.onDelete(codespace);
      } finally {
        setActionInProgress(null);
      }
    }
    setMenuOpenId(null);
  };

  return (
    <div class="flex-1 overflow-y-auto">
      <Show
        when={props.codespaces.length > 0}
        fallback={
          <div class="px-4 py-8 text-center">
            <Icon name="cloud" class="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-weaker)" }} />
            <p class="text-sm mb-1" style={{ color: "var(--text-weak)" }}>
              No codespaces found
            </p>
            <p class="text-xs" style={{ color: "var(--text-weaker)" }}>
              Create a new codespace to get started
            </p>
          </div>
        }
      >
        <For each={props.codespaces}>
          {(codespace) => {
            const isRunning = () => codespace.state === "Available";
            const isPending = () => ["Starting", "Provisioning", "Queued", "ShuttingDown"].includes(codespace.state);
            const isThisActionInProgress = () => actionInProgress() === codespace.id;

            return (
              <div
                class="relative group border-b transition-colors hover:bg-[var(--surface-raised)]"
                style={{ "border-color": "var(--border-weak)" }}
              >
                <div class="px-3 py-2">
                  {/* Header row */}
                  <div class="flex items-center gap-2 mb-1">
                    <StatusIcon state={codespace.state} />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>
                        {codespace.display_name || codespace.name}
                      </div>
                    </div>
                    
                    {/* Quick actions */}
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Show when={isRunning()}>
                        <button
                          onClick={() => props.onOpenBrowser(codespace)}
                          class="p-1 rounded transition-colors hover:bg-[var(--surface-overlay)]"
                          style={{ color: "var(--text-weak)" }}
                          title="Open in browser"
                        >
                          <Icon name="arrow-up-right-from-square" class="w-4 h-4" />
                        </button>
                      </Show>
                      <Show when={!isRunning() && !isPending()}>
                        <button
                          onClick={() => handleStart(codespace)}
                          disabled={isThisActionInProgress()}
                          class="p-1 rounded transition-colors hover:bg-[var(--surface-overlay)] disabled:opacity-50"
                          style={{ color: "var(--success)" }}
                          title="Start codespace"
                        >
                          <Show when={!isThisActionInProgress()} fallback={<Icon name="spinner" class="w-4 h-4 animate-spin" />}>
                            <Icon name="play" class="w-4 h-4" />
                          </Show>
                        </button>
                      </Show>
                      <Show when={isRunning()}>
                        <button
                          onClick={() => handleStop(codespace)}
                          disabled={isThisActionInProgress()}
                          class="p-1 rounded transition-colors hover:bg-[var(--surface-overlay)] disabled:opacity-50"
                          style={{ color: "var(--warning)" }}
                          title="Stop codespace"
                        >
                          <Show when={!isThisActionInProgress()} fallback={<Icon name="spinner" class="w-4 h-4 animate-spin" />}>
                            <Icon name="stop" class="w-4 h-4" />
                          </Show>
                        </button>
                      </Show>
                      <button
                        onClick={() => setMenuOpenId(menuOpenId() === codespace.id ? null : codespace.id)}
                        class="p-1 rounded transition-colors hover:bg-[var(--surface-overlay)]"
                        style={{ color: "var(--text-weak)" }}
                      >
                        <Icon name="ellipsis-vertical" class="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Repository info */}
                  <div class="flex items-center gap-2 text-xs" style={{ color: "var(--text-weak)" }}>
                    <Icon name="github" class="w-3 h-3" />
                    <span class="truncate">{codespace.repository.full_name}</span>
                    <span style={{ color: "var(--border-base)" }}>•</span>
                    <Icon name="code-branch" class="w-3 h-3" />
                    <span class="truncate">{codespace.git_status.ref}</span>
                  </div>

                  {/* Meta row */}
                  <div class="flex items-center gap-3 mt-1 text-xs" style={{ color: "var(--text-weaker)" }}>
                    <Show when={codespace.machine}>
                      <span class="flex items-center gap-1">
                        <Icon name="microchip" class="w-3 h-3" />
                        {codespace.machine?.display_name}
                      </span>
                    </Show>
                    <span class="flex items-center gap-1">
                      <Icon name="clock" class="w-3 h-3" />
                      {formatRelativeTime(codespace.last_used_at)}
                    </span>
                    <span
                      class="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide"
                      style={{
                        "background-color": `color-mix(in srgb, ${getStatusColor(codespace.state)} 20%, transparent)`,
                        color: getStatusColor(codespace.state),
                      }}
                    >
                      {codespace.state}
                    </span>
                  </div>

                  {/* Git status indicators */}
                  <Show when={codespace.git_status.has_uncommitted_changes || codespace.git_status.has_unpushed_changes}>
                    <div class="flex items-center gap-2 mt-1 text-xs" style={{ color: "var(--warning)" }}>
                      <Show when={codespace.git_status.has_uncommitted_changes}>
                        <span>• Uncommitted changes</span>
                      </Show>
                      <Show when={codespace.git_status.has_unpushed_changes}>
                        <span>• Unpushed commits</span>
                      </Show>
                    </div>
                  </Show>
                </div>

                {/* Dropdown menu */}
                <Show when={menuOpenId() === codespace.id}>
                  <div
                    class="absolute right-2 top-full z-20 py-1 rounded-md shadow-lg min-w-[180px]"
                    style={{
                      "background-color": "var(--surface-overlay)",
                      "border": "1px solid var(--border-base)",
                    }}
                  >
                    <Show when={isRunning()}>
                      <button
                        onClick={() => {
                          props.onOpenBrowser(codespace);
                          setMenuOpenId(null);
                        }}
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--surface-raised)]"
                        style={{ color: "var(--text-base)" }}
                      >
                        <Icon name="arrow-up-right-from-square" class="w-4 h-4" />
                        Open in Browser
                      </button>
                      <button
                        onClick={() => {
                          props.onOpenVSCode(codespace);
                          setMenuOpenId(null);
                        }}
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--surface-raised)]"
                        style={{ color: "var(--text-base)" }}
                      >
                        <Icon name="display" class="w-4 h-4" />
                        Open in VS Code
                      </button>
                      <button
                        onClick={() => {
                          props.onConnectSSH(codespace);
                          setMenuOpenId(null);
                        }}
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--surface-raised)]"
                        style={{ color: "var(--text-base)" }}
                      >
                        <Icon name="terminal" class="w-4 h-4" />
                        Connect via SSH
                      </button>
                      <div class="my-1 border-t" style={{ "border-color": "var(--border-weak)" }} />
                      <button
                        onClick={() => handleStop(codespace)}
                        disabled={isThisActionInProgress()}
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-50"
                        style={{ color: "var(--warning)" }}
                      >
                        <Icon name="stop" class="w-4 h-4" />
                        Stop Codespace
                      </button>
                    </Show>
                    <Show when={!isRunning() && !isPending()}>
                      <button
                        onClick={() => {
                          handleStart(codespace);
                          setMenuOpenId(null);
                        }}
                        disabled={isThisActionInProgress()}
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-50"
                        style={{ color: "var(--success)" }}
                      >
                        <Icon name="play" class="w-4 h-4" />
                        Start Codespace
                      </button>
                    </Show>
                    <div class="my-1 border-t" style={{ "border-color": "var(--border-weak)" }} />
                    <button
                      onClick={() => handleDelete(codespace)}
                      disabled={isThisActionInProgress()}
                      class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-50"
                      style={{ color: "var(--error)" }}
                    >
                      <Icon name="trash" class="w-4 h-4" />
                      Delete Codespace
                    </button>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
}

interface CreateCodespaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (options: CreateCodespaceOptions) => Promise<void>;
  searchRepositories: (query: string) => Promise<CodespaceRepository[]>;
  getMachines: (repoId: number) => Promise<CodespaceMachine[]>;
}

function CreateCodespaceDialog(props: CreateCodespaceDialogProps) {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [repositories, setRepositories] = createSignal<CodespaceRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = createSignal<CodespaceRepository | null>(null);
  const [machines, setMachines] = createSignal<CodespaceMachine[]>([]);
  const [selectedMachine, setSelectedMachine] = createSignal<string>("");
  const [branch, setBranch] = createSignal("");
  const [displayName, setDisplayName] = createSignal("");
  const [isSearching, setIsSearching] = createSignal(false);
  const [isLoadingMachines, setIsLoadingMachines] = createSignal(false);
  const [isCreating, setIsCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Search repositories with debounce
  let searchTimeout: number | null = null;
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (query.length < 2) {
      setRepositories([]);
      return;
    }

    searchTimeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await props.searchRepositories(query);
        setRepositories(results);
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setIsSearching(false);
      }
    }, 300) as unknown as number;
  };

  // Load machines when repository is selected
  createEffect(async () => {
    const repo = selectedRepo();
    if (!repo) {
      setMachines([]);
      return;
    }

    setIsLoadingMachines(true);
    setBranch(repo.default_branch);
    try {
      const machs = await props.getMachines(repo.id);
      setMachines(machs);
      if (machs.length > 0) {
        setSelectedMachine(machs[0].name);
      }
    } catch (e) {
      console.error("Failed to load machines:", e);
    } finally {
      setIsLoadingMachines(false);
    }
  });

  const handleCreate = async () => {
    const repo = selectedRepo();
    if (!repo) return;

    setIsCreating(true);
    setError(null);

    try {
      await props.onCreate({
        repository_id: repo.id,
        ref: branch() || repo.default_branch,
        machine: selectedMachine() || undefined,
        display_name: displayName() || undefined,
      });
      props.onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsCreating(false);
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ "background-color": "rgba(0, 0, 0, 0.5)" }}
        onClick={handleBackdropClick}
      >
        <div
          class="w-full max-w-lg rounded-lg shadow-xl overflow-hidden"
          style={{
            "background-color": "var(--surface-base)",
            "border": "1px solid var(--border-base)",
          }}
        >
          {/* Header */}
          <div
            class="flex items-center justify-between px-4 py-3 border-b"
            style={{ "border-color": "var(--border-base)" }}
          >
            <h2 class="text-base font-semibold" style={{ color: "var(--text-base)" }}>
              Create New Codespace
            </h2>
            <button
              onClick={props.onClose}
              class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
            >
              <Icon name="xmark" class="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div class="p-4 space-y-4">
            {/* Repository search */}
            <div>
              <label class="block text-xs font-medium mb-1" style={{ color: "var(--text-weak)" }}>
                Repository
              </label>
              <div class="relative">
                <Icon
                  name="magnifying-glass"
                  class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "var(--text-weaker)" }}
                />
                <input
                  type="text"
                  value={searchQuery()}
                  onInput={(e) => handleSearchChange(e.currentTarget.value)}
                  placeholder="Search repositories..."
                  class="w-full pl-10 pr-3 py-2 rounded-md text-sm"
                  style={{
                    "background-color": "var(--surface-raised)",
                    "border": "1px solid var(--border-base)",
                    color: "var(--text-base)",
                  }}
                />
                <Show when={isSearching()}>
                  <Icon
                    name="spinner"
                    class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin"
                    style={{ color: "var(--text-weaker)" }}
                  />
                </Show>
              </div>

              {/* Repository results */}
              <Show when={repositories().length > 0 && !selectedRepo()}>
                <div
                  class="mt-2 max-h-40 overflow-y-auto rounded-md"
                  style={{
                    "background-color": "var(--surface-raised)",
                    "border": "1px solid var(--border-base)",
                  }}
                >
                  <For each={repositories()}>
                    {(repo) => (
                      <button
                        onClick={() => {
                          setSelectedRepo(repo);
                          setSearchQuery(repo.full_name);
                        }}
                        class="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-overlay)]"
                      >
                        <img
                          src={repo.owner.avatar_url}
                          alt=""
                          class="w-5 h-5 rounded-full"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="text-sm truncate" style={{ color: "var(--text-base)" }}>
                            {repo.full_name}
                          </div>
                        </div>
                        <Show when={repo.private}>
                          <span
                            class="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              "background-color": "var(--surface-overlay)",
                              color: "var(--text-weak)",
                            }}
                          >
                            Private
                          </span>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              {/* Selected repository */}
              <Show when={selectedRepo()}>
                <div
                  class="mt-2 flex items-center gap-2 px-3 py-2 rounded-md"
                  style={{
                    "background-color": "var(--surface-raised)",
                    "border": "1px solid var(--accent)",
                  }}
                >
                  <img
                    src={selectedRepo()!.owner.avatar_url}
                    alt=""
                    class="w-5 h-5 rounded-full"
                  />
                  <span class="flex-1 text-sm" style={{ color: "var(--text-base)" }}>
                    {selectedRepo()!.full_name}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedRepo(null);
                      setSearchQuery("");
                    }}
                    class="p-0.5 rounded hover:bg-[var(--surface-overlay)]"
                    style={{ color: "var(--text-weak)" }}
                  >
                    <Icon name="xmark" class="w-4 h-4" />
                  </button>
                </div>
              </Show>
            </div>

            {/* Branch */}
            <Show when={selectedRepo()}>
              <div>
                <label class="block text-xs font-medium mb-1" style={{ color: "var(--text-weak)" }}>
                  Branch
                </label>
                <input
                  type="text"
                  value={branch()}
                  onInput={(e) => setBranch(e.currentTarget.value)}
                  placeholder={selectedRepo()?.default_branch || "main"}
                  class="w-full px-3 py-2 rounded-md text-sm"
                  style={{
                    "background-color": "var(--surface-raised)",
                    "border": "1px solid var(--border-base)",
                    color: "var(--text-base)",
                  }}
                />
              </div>

              {/* Machine type */}
              <div>
                <label class="block text-xs font-medium mb-1" style={{ color: "var(--text-weak)" }}>
                  Machine Type
                </label>
                <Show when={!isLoadingMachines()} fallback={
                  <div class="flex items-center gap-2 py-2" style={{ color: "var(--text-weak)" }}>
                    <Icon name="spinner" class="w-4 h-4 animate-spin" />
                    <span class="text-sm">Loading machines...</span>
                  </div>
                }>
                  <select
                    value={selectedMachine()}
                    onChange={(e) => setSelectedMachine(e.currentTarget.value)}
                    class="w-full px-3 py-2 rounded-md text-sm"
                    style={{
                      "background-color": "var(--surface-raised)",
                      "border": "1px solid var(--border-base)",
                      color: "var(--text-base)",
                    }}
                  >
                    <For each={machines()}>
                      {(machine) => (
                        <option value={machine.name}>
                          {machine.display_name} - {machine.cpus} cores, {Math.round(machine.memory_in_bytes / 1024 / 1024 / 1024)}GB RAM
                        </option>
                      )}
                    </For>
                  </select>
                </Show>
              </div>

              {/* Display name */}
              <div>
                <label class="block text-xs font-medium mb-1" style={{ color: "var(--text-weak)" }}>
                  Display Name (optional)
                </label>
                <input
                  type="text"
                  value={displayName()}
                  onInput={(e) => setDisplayName(e.currentTarget.value)}
                  placeholder="My codespace"
                  class="w-full px-3 py-2 rounded-md text-sm"
                  style={{
                    "background-color": "var(--surface-raised)",
                    "border": "1px solid var(--border-base)",
                    color: "var(--text-base)",
                  }}
                />
              </div>
            </Show>

            {/* Error */}
            <Show when={error()}>
              <div
                class="px-3 py-2 rounded-md text-sm"
                style={{
                  "background-color": "color-mix(in srgb, var(--error) 10%, transparent)",
                  color: "var(--error)",
                }}
              >
                {error()}
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div
            class="flex items-center justify-end gap-2 px-4 py-3 border-t"
            style={{ "border-color": "var(--border-base)" }}
          >
            <button
              onClick={props.onClose}
              class="px-4 py-1.5 rounded-md text-sm transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-base)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!selectedRepo() || isCreating()}
              class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                "background-color": "var(--accent)",
                color: "white",
              }}
            >
              <Show when={!isCreating()} fallback={
                <span class="flex items-center gap-2">
                  <Icon name="spinner" class="w-4 h-4 animate-spin" />
                  Creating...
                </span>
              }>
                Create Codespace
              </Show>
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

export function CodespacesPanel() {
  const codespaces = useCodespaces();
  const [showCreateDialog, setShowCreateDialog] = createSignal(false);

  // Handle actions
  const handleStart = async (cs: Codespace) => {
    try {
      await codespaces.startCodespace(cs.name);
    } catch (e) {
      console.error("Failed to start codespace:", e);
    }
  };

  const handleStop = async (cs: Codespace) => {
    try {
      await codespaces.stopCodespace(cs.name);
    } catch (e) {
      console.error("Failed to stop codespace:", e);
    }
  };

  const handleDelete = async (cs: Codespace) => {
    try {
      await codespaces.deleteCodespace(cs.name);
    } catch (e) {
      console.error("Failed to delete codespace:", e);
    }
  };

  const handleCreate = async (options: CreateCodespaceOptions) => {
    await codespaces.createCodespace(options);
  };

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div
        class="flex items-center justify-between px-3 py-2 border-b"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <span class="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-weak)" }}>
          GitHub Codespaces
        </span>
        <div class="flex items-center gap-1">
          <Show when={codespaces.isAuthenticated()}>
            <button
              onClick={() => codespaces.refreshCodespaces()}
              disabled={codespaces.state.isLoading}
              class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-50"
              style={{ color: "var(--text-weak)" }}
              title="Refresh"
            >
              <Icon name="rotate" class="w-4 h-4" classList={{ "animate-spin": codespaces.state.isLoading }} />
            </button>
            <button
              onClick={() => setShowCreateDialog(true)}
              class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title="Create codespace"
            >
              <Icon name="plus" class="w-4 h-4" />
            </button>
          </Show>
        </div>
      </div>

      {/* Content */}
      <Show
        when={codespaces.isAuthenticated()}
        fallback={
          <div class="flex-1 flex flex-col items-center justify-center px-4 py-8">
            <Icon name="github" class="w-12 h-12 mb-4" style={{ color: "var(--text-weaker)" }} />
            <h3 class="text-sm font-medium mb-2" style={{ color: "var(--text-base)" }}>
              Sign in to GitHub
            </h3>
            <p class="text-xs text-center mb-4" style={{ color: "var(--text-weak)" }}>
              Connect your GitHub account to manage your codespaces
            </p>
            <button
              onClick={() => codespaces.authenticate()}
              disabled={codespaces.state.isAuthenticating}
              class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                "background-color": "var(--accent)",
                color: "white",
              }}
            >
              <Show when={!codespaces.state.isAuthenticating} fallback={
                <>
                  <Icon name="spinner" class="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              }>
                <Icon name="github" class="w-4 h-4" />
                Sign in with GitHub
              </Show>
            </button>
            <Show when={codespaces.state.error}>
              <p class="mt-3 text-xs text-center" style={{ color: "var(--error)" }}>
                {codespaces.state.error}
              </p>
            </Show>
          </div>
        }
      >
        {/* User info */}
        <div
          class="flex items-center gap-2 px-3 py-2 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <Show when={codespaces.getUser()}>
            <img
              src={codespaces.getUser()!.avatar_url}
              alt=""
              class="w-5 h-5 rounded-full"
            />
            <span class="flex-1 text-xs truncate" style={{ color: "var(--text-base)" }}>
              {codespaces.getUser()!.login}
            </span>
          </Show>
          <button
            onClick={() => codespaces.logout()}
            class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Sign out"
          >
            <Icon name="arrow-right-from-bracket" class="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Error banner */}
        <Show when={codespaces.state.error}>
          <div
            class="px-3 py-2 text-xs"
            style={{
              "background-color": "color-mix(in srgb, var(--error) 10%, transparent)",
              color: "var(--error)",
            }}
          >
            {codespaces.state.error}
          </div>
        </Show>

        {/* Codespaces list */}
        <CodespacesList
          codespaces={codespaces.state.codespaces}
          onRefresh={() => codespaces.refreshCodespaces()}
          onStart={handleStart}
          onStop={handleStop}
          onDelete={handleDelete}
          onOpenBrowser={(cs) => codespaces.openInBrowser(cs)}
          onOpenVSCode={(cs) => codespaces.openInVSCode(cs)}
          onConnectSSH={(cs) => codespaces.connectViaSSH(cs)}
          isLoading={codespaces.state.isLoading}
        />

        {/* Create dialog */}
        <CreateCodespaceDialog
          isOpen={showCreateDialog()}
          onClose={() => setShowCreateDialog(false)}
          onCreate={handleCreate}
          searchRepositories={codespaces.searchRepositories}
          getMachines={codespaces.getAvailableMachines}
        />
      </Show>
    </div>
  );
}
