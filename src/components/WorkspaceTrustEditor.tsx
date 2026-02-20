import { Show, For, createSignal, createMemo, batch } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  useWorkspaceTrust,
  TrustedFolder,
  TrustDecision,
} from "../context/WorkspaceTrustContext";

// ============================================================================
// Types
// ============================================================================

export interface WorkspaceTrustEditorProps {
  /** Custom class name */
  class?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Tab to show initially */
  initialTab?: "folders" | "settings" | "history";
}

type TabId = "folders" | "settings" | "history";

// ============================================================================
// Tab Button Component
// ============================================================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  count?: number;
}

function TabButton(props: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      class={`
        flex items-center gap-2 px-4 py-2
        text-sm font-medium
        border-b-2 transition-colors
        ${
          props.active
            ? "border-indigo-500 text-indigo-400"
            : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
        }
      `}
    >
      <Icon name={props.icon} class="w-4 h-4" />
      <span>{props.label}</span>
      <Show when={props.count !== undefined && props.count > 0}>
        <span
          class={`
            px-1.5 py-0.5 text-xs rounded-full
            ${props.active ? "bg-indigo-900/50 text-indigo-300" : "bg-zinc-700 text-zinc-400"}
          `}
        >
          {props.count}
        </span>
      </Show>
    </button>
  );
}

// ============================================================================
// Trusted Folder Item Component
// ============================================================================

interface TrustedFolderItemProps {
  folder: TrustedFolder;
  onRemove: (path: string) => void;
  onEdit: (path: string) => void;
}

function TrustedFolderItem(props: TrustedFolderItemProps) {
  const [isHovered, setIsHovered] = createSignal(false);

  const folderName = createMemo(() => {
    const parts = props.folder.path.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || props.folder.path;
  });

  const formattedDate = createMemo(() => {
    const date = new Date(props.folder.trustedAt);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  });

  return (
    <div
      class="
        flex items-center gap-3 p-3
        bg-zinc-800/50 hover:bg-zinc-800
        border border-zinc-700/50 rounded-lg
        transition-colors group
      "
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div class="p-2 bg-green-900/30 rounded-lg">
        <Icon name="folder-open" class="w-5 h-5 text-green-400" />
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-medium text-zinc-200 truncate">{folderName()}</span>
          <Show when={props.folder.trustParent}>
            <span class="px-1.5 py-0.5 text-xs bg-indigo-900/50 text-indigo-300 rounded">
              + Parent
            </span>
          </Show>
        </div>
        <p class="text-xs text-zinc-500 truncate mt-0.5">{props.folder.path}</p>
        <Show when={props.folder.description}>
          <p class="text-xs text-zinc-400 mt-1">{props.folder.description}</p>
        </Show>
      </div>

      <div class="flex items-center gap-1 text-xs text-zinc-500">
        <span>Trusted {formattedDate()}</span>
      </div>

      <div
        class={`
          flex items-center gap-1
          transition-opacity
          ${isHovered() ? "opacity-100" : "opacity-0"}
        `}
      >
        <button
          type="button"
          onClick={() => props.onEdit(props.folder.path)}
          class="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
          title="Edit trust settings"
        >
          <Icon name="pen" class="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => props.onRemove(props.folder.path)}
          class="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
          title="Remove trust"
        >
          <Icon name="trash" class="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Trust Decision History Item
// ============================================================================

interface TrustDecisionItemProps {
  decision: TrustDecision;
}

function TrustDecisionItem(props: TrustDecisionItemProps) {
  const folderName = createMemo(() => {
    const parts = props.decision.workspacePath.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || props.decision.workspacePath;
  });

  const formattedDate = createMemo(() => {
    const date = new Date(props.decision.decidedAt);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  });

  const isTrusted = () => props.decision.trustLevel === "trusted";

  return (
    <div
      class={`
        flex items-center gap-3 p-3
        border rounded-lg
        ${
          isTrusted()
            ? "bg-green-900/10 border-green-800/30"
            : "bg-amber-900/10 border-amber-800/30"
        }
      `}
    >
      <div
        class={`p-2 rounded-lg ${isTrusted() ? "bg-green-900/30" : "bg-amber-900/30"}`}
      >
        {isTrusted() ? (
          <Icon name="shield" class="w-4 h-4 text-green-400" />
        ) : (
          <Icon name="lock" class="w-4 h-4 text-amber-400" />
        )}
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-medium text-zinc-200 truncate">{folderName()}</span>
          <span
            class={`
              px-1.5 py-0.5 text-xs rounded
              ${isTrusted() ? "bg-green-900/50 text-green-300" : "bg-amber-900/50 text-amber-300"}
            `}
          >
            {isTrusted() ? "Trusted" : "Restricted"}
          </span>
        </div>
        <p class="text-xs text-zinc-500 truncate mt-0.5">
          {props.decision.workspacePath}
        </p>
      </div>

      <div class="text-xs text-zinc-500">{formattedDate()}</div>
    </div>
  );
}

// ============================================================================
// Settings Toggle Component
// ============================================================================

interface SettingsToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  warning?: string;
}

function SettingsToggle(props: SettingsToggleProps) {
  return (
    <div
      class={`
        flex items-start gap-4 p-4
        bg-zinc-800/30 border border-zinc-700/50 rounded-lg
        ${props.disabled ? "opacity-50" : ""}
      `}
    >
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <span class="font-medium text-zinc-200">{props.label}</span>
          <Show when={props.warning}>
            <span class="px-1.5 py-0.5 text-xs bg-amber-900/50 text-amber-300 rounded flex items-center gap-1">
              <Icon name="triangle-exclamation" class="w-3 h-3" />
              {props.warning}
            </span>
          </Show>
        </div>
        <p class="text-sm text-zinc-400 mt-1">{props.description}</p>
      </div>

      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={props.checked}
          onChange={(e) => props.onChange(e.currentTarget.checked)}
          disabled={props.disabled}
          class="sr-only peer"
        />
        <div
          class="
            w-11 h-6 bg-zinc-700 rounded-full
            peer-checked:bg-indigo-600
            peer-focus:ring-2 peer-focus:ring-indigo-500/50
            after:content-[''] after:absolute after:top-0.5 after:left-0.5
            after:bg-white after:rounded-full after:h-5 after:w-5
            after:transition-all peer-checked:after:translate-x-5
            peer-disabled:opacity-50 peer-disabled:cursor-not-allowed
          "
        />
      </label>
    </div>
  );
}

// ============================================================================
// Add Trusted Folder Dialog
// ============================================================================

interface AddFolderDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (path: string, options: { trustParent: boolean; description: string }) => void;
}

function AddFolderDialog(props: AddFolderDialogProps) {
  const [path, setPath] = createSignal("");
  const [trustParent, setTrustParent] = createSignal(false);
  const [description, setDescription] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);

  const handleBrowse = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Folder to Trust",
      });

      if (selected && typeof selected === "string") {
        setPath(selected);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to open folder dialog:", err);
      setError("Failed to open folder picker");
    }
  };

  const handleAdd = () => {
    const folderPath = path().trim();

    if (!folderPath) {
      setError("Please enter a folder path");
      return;
    }

    props.onAdd(folderPath, {
      trustParent: trustParent(),
      description: description().trim(),
    });

    // Reset form
    batch(() => {
      setPath("");
      setTrustParent(false);
      setDescription("");
      setError(null);
    });

    props.onClose();
  };

  const handleClose = () => {
    batch(() => {
      setPath("");
      setTrustParent(false);
      setDescription("");
      setError(null);
    });
    props.onClose();
  };

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={handleClose}
      >
        <div
          class="
            bg-zinc-900 border border-zinc-700
            rounded-xl shadow-2xl
            max-w-lg w-full mx-4
            overflow-hidden
          "
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="flex items-center justify-between p-4 border-b border-zinc-700">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-green-900/30 rounded-lg">
                <Icon name="shield" class="w-5 h-5 text-green-400" />
              </div>
              <h2 class="text-lg font-semibold text-zinc-100">Add Trusted Folder</h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              class="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Icon name="xmark" class="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div class="p-4 space-y-4">
            {/* Path input */}
            <div>
              <label class="block text-sm font-medium text-zinc-300 mb-2">
                Folder Path
              </label>
              <div class="flex gap-2">
                <input
                  type="text"
                  value={path()}
                  onInput={(e) => {
                    setPath(e.currentTarget.value);
                    setError(null);
                  }}
                  placeholder="/path/to/folder"
                  class="
                    flex-1 px-3 py-2
                    bg-zinc-800 border border-zinc-700
                    rounded-lg text-zinc-200
                    placeholder:text-zinc-500
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                  "
                />
                <button
                  type="button"
                  onClick={handleBrowse}
                  class="
                    px-4 py-2
                    bg-zinc-700 hover:bg-zinc-600
                    text-zinc-200 text-sm font-medium
                    rounded-lg transition-colors
                  "
                >
                  Browse...
                </button>
              </div>
              <Show when={error()}>
                <p class="mt-1 text-sm text-red-400">{error()}</p>
              </Show>
            </div>

            {/* Trust parent option */}
            <div class="flex items-start gap-3 p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
              <input
                type="checkbox"
                id="trust-parent"
                checked={trustParent()}
                onChange={(e) => setTrustParent(e.currentTarget.checked)}
                class="mt-1 w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-indigo-600 focus:ring-indigo-500"
              />
              <label for="trust-parent" class="cursor-pointer">
                <span class="font-medium text-zinc-200">Trust parent folder</span>
                <p class="text-sm text-zinc-400 mt-0.5">
                  Also trust workspaces opened from parent directories
                </p>
              </label>
            </div>

            {/* Description */}
            <div>
              <label class="block text-sm font-medium text-zinc-300 mb-2">
                Description (optional)
              </label>
              <input
                type="text"
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                placeholder="e.g., My personal projects folder"
                class="
                  w-full px-3 py-2
                  bg-zinc-800 border border-zinc-700
                  rounded-lg text-zinc-200
                  placeholder:text-zinc-500
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                "
              />
            </div>
          </div>

          {/* Footer */}
          <div class="flex items-center justify-end gap-3 p-4 border-t border-zinc-700 bg-zinc-900/50">
            <button
              type="button"
              onClick={handleClose}
              class="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              class="
                flex items-center gap-2 px-4 py-2
                bg-indigo-600 hover:bg-indigo-500
                text-white text-sm font-medium
                rounded-lg transition-colors
              "
            >
              <Icon name="plus" class="w-4 h-4" />
              Add Folder
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Main Editor Component
// ============================================================================

export function WorkspaceTrustEditor(props: WorkspaceTrustEditorProps) {
  const {
    trustedFolders,
    settings,
    state,
    addTrustedFolder,
    removeTrustedFolder,
    updateSettings,
    clearAllTrustDecisions,
  } = useWorkspaceTrust();

  const [activeTab, setActiveTab] = createSignal<TabId>(props.initialTab || "folders");
  const [showAddDialog, setShowAddDialog] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [showConfirmClear, setShowConfirmClear] = createSignal(false);

  const filteredFolders = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return trustedFolders();

    return trustedFolders().filter(
      (f) =>
        f.path.toLowerCase().includes(query) ||
        (f.description && f.description.toLowerCase().includes(query))
    );
  });

  const handleAddFolder = (
    path: string,
    options: { trustParent: boolean; description: string }
  ) => {
    addTrustedFolder(path, {
      trustParent: options.trustParent,
      description: options.description || undefined,
    });
  };

  const handleRemoveFolder = (path: string) => {
    removeTrustedFolder(path);
  };

  const handleEditFolder = (path: string) => {
    // For now, we'll just open the add dialog with pre-filled values
    // In a full implementation, this would open an edit dialog
    if (import.meta.env.DEV) console.log("Edit folder:", path);
  };

  const handleClearAll = () => {
    clearAllTrustDecisions();
    setShowConfirmClear(false);
  };

  const currentSettings = settings();

  return (
    <div class={`flex flex-col h-full ${props.class || ""}`}>
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-indigo-900/30 rounded-lg">
            <Icon name="shield" class="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-zinc-100">Workspace Trust</h2>
            <p class="text-sm text-zinc-400">
              Manage trusted folders and security settings
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div class="flex border-b border-zinc-700 px-4">
        <TabButton
          active={activeTab() === "folders"}
          onClick={() => setActiveTab("folders")}
          icon="folder"
          label="Trusted Folders"
          count={trustedFolders().length}
        />
        <TabButton
          active={activeTab() === "settings"}
          onClick={() => setActiveTab("settings")}
          icon="gear"
          label="Settings"
        />
        <TabButton
          active={activeTab() === "history"}
          onClick={() => setActiveTab("history")}
          icon="clock-rotate-left"
          label="History"
          count={state.trustDecisions.length}
        />
      </div>

      {/* Content */}
      <div class="flex-1 overflow-auto">
        {/* Trusted Folders Tab */}
        <Show when={activeTab() === "folders"}>
          <div class="p-4 space-y-4">
            {/* Search and Add */}
            <div class="flex items-center gap-3">
              <div class="relative flex-1">
                <Icon name="magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  placeholder="Search trusted folders..."
                  class="
                    w-full pl-10 pr-4 py-2
                    bg-zinc-800 border border-zinc-700
                    rounded-lg text-zinc-200
                    placeholder:text-zinc-500
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                  "
                />
              </div>
              <button
                type="button"
                onClick={() => setShowAddDialog(true)}
                class="
                  flex items-center gap-2 px-4 py-2
                  bg-indigo-600 hover:bg-indigo-500
                  text-white text-sm font-medium
                  rounded-lg transition-colors
                "
              >
<Icon name="plus" class="w-4 h-4" />
                Add Folder
              </button>
            </div>

{/* Info box */}
            <div class="flex items-start gap-3 p-3 bg-zinc-800/30 border border-zinc-700/50 rounded-lg">
              <Icon name="circle-info" class="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
              <p class="text-sm text-zinc-400">
                Trusted folders enable all workspace features including task execution,
                debugging, and extension activation. Only trust folders containing code you trust.
              </p>
            </div>

            {/* Folder list */}
            <div class="space-y-2">
              <Show
                when={filteredFolders().length > 0}
                fallback={
                  <div class="flex flex-col items-center justify-center py-12 text-center">
                    <div class="p-4 bg-zinc-800/50 rounded-full mb-4">
                      <Icon name="folder" class="w-8 h-8 text-zinc-500" />
                    </div>
                    <p class="text-zinc-400">
                      {searchQuery()
                        ? "No folders match your search"
                        : "No trusted folders yet"}
                    </p>
                    <p class="text-sm text-zinc-500 mt-1">
                      {searchQuery()
                        ? "Try a different search term"
                        : "Add a folder to trust it and enable all features"}
                    </p>
                  </div>
                }
              >
                <For each={filteredFolders()}>
                  {(folder) => (
                    <TrustedFolderItem
                      folder={folder}
                      onRemove={handleRemoveFolder}
                      onEdit={handleEditFolder}
                    />
                  )}
                </For>
              </Show>
            </div>
          </div>
        </Show>

        {/* Settings Tab */}
        <Show when={activeTab() === "settings"}>
          <div class="p-4 space-y-4">
            <SettingsToggle
              label="Enable Workspace Trust"
              description="When enabled, workspaces must be explicitly trusted to access all features"
              checked={currentSettings.enabled}
              onChange={(checked) => updateSettings({ enabled: checked })}
            />

            <SettingsToggle
              label="Restricted Mode"
              description="Apply restrictions to untrusted workspaces (task execution, debugging, extensions)"
              checked={currentSettings.restrictedModeEnabled}
              onChange={(checked) => updateSettings({ restrictedModeEnabled: checked })}
              disabled={!currentSettings.enabled}
            />

            <SettingsToggle
              label="Show Trust Banner"
              description="Display a banner when opening an untrusted workspace"
              checked={currentSettings.showBanner}
              onChange={(checked) => updateSettings({ showBanner: checked })}
              disabled={!currentSettings.enabled}
            />

            <SettingsToggle
              label="Prompt for Parent Folder Trust"
              description="Ask before trusting all workspaces in a parent folder"
              checked={currentSettings.promptForParentFolderTrust}
              onChange={(checked) =>
                updateSettings({ promptForParentFolderTrust: checked })
              }
              disabled={!currentSettings.enabled}
            />

            <SettingsToggle
              label="Trust All Workspaces"
              description="Automatically trust all workspaces (not recommended for security)"
              checked={currentSettings.trustAllWorkspaces}
              onChange={(checked) => updateSettings({ trustAllWorkspaces: checked })}
              disabled={!currentSettings.enabled}
              warning="Not recommended"
            />

            {/* Danger zone */}
            <div class="pt-4 border-t border-zinc-700">
              <h3 class="text-sm font-medium text-red-400 mb-3">Danger Zone</h3>
              <div class="p-4 bg-red-900/10 border border-red-900/30 rounded-lg">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="font-medium text-zinc-200">Clear All Trust Data</p>
                    <p class="text-sm text-zinc-400 mt-1">
                      Remove all trusted folders and reset trust decisions. This action cannot
                      be undone.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowConfirmClear(true)}
                    class="
                      px-4 py-2
                      bg-red-600 hover:bg-red-500
                      text-white text-sm font-medium
                      rounded-lg transition-colors
                      flex-shrink-0
                    "
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Show>

        {/* History Tab */}
        <Show when={activeTab() === "history"}>
          <div class="p-4 space-y-4">
<div class="flex items-start gap-3 p-3 bg-zinc-800/30 border border-zinc-700/50 rounded-lg">
              <Icon name="circle-info" class="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
              <p class="text-sm text-zinc-400">
                History shows all trust decisions you've made for workspaces.
              </p>
            </div>

            <div class="space-y-2">
              <Show
                when={state.trustDecisions.length > 0}
                fallback={
                  <div class="flex flex-col items-center justify-center py-12 text-center">
                    <div class="p-4 bg-zinc-800/50 rounded-full mb-4">
                      <Icon name="clock-rotate-left" class="w-8 h-8 text-zinc-500" />
                    </div>
                    <p class="text-zinc-400">No trust decisions yet</p>
                    <p class="text-sm text-zinc-500 mt-1">
                      Trust decisions will appear here as you make them
                    </p>
                  </div>
                }
              >
                <For each={[...state.trustDecisions].reverse()}>
                  {(decision) => <TrustDecisionItem decision={decision} />}
                </For>
              </Show>
            </div>
          </div>
        </Show>
      </div>

      {/* Add Folder Dialog */}
      <AddFolderDialog
        open={showAddDialog()}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddFolder}
      />

      {/* Confirm Clear Dialog */}
      <Show when={showConfirmClear()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowConfirmClear(false)}
        >
          <div
            class="
              bg-zinc-900 border border-zinc-700
              rounded-xl shadow-2xl
              max-w-md w-full mx-4
              overflow-hidden
            "
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-center gap-3 p-4 border-b border-zinc-700 bg-red-950/30">
              <div class="p-2 bg-red-800/50 rounded-lg">
                <Icon name="triangle-exclamation" class="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-zinc-100">Clear All Trust Data?</h2>
                <p class="text-sm text-zinc-400">This action cannot be undone</p>
              </div>
            </div>

            <div class="p-4">
              <p class="text-zinc-300">
                This will remove all trusted folders and reset all trust decisions. You will
                need to re-trust workspaces to enable full features.
              </p>
            </div>

            <div class="flex items-center justify-end gap-3 p-4 border-t border-zinc-700 bg-zinc-900/50">
              <button
                type="button"
                onClick={() => setShowConfirmClear(false)}
                class="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                class="
                  px-4 py-2
                  bg-red-600 hover:bg-red-500
                  text-white text-sm font-medium
                  rounded-lg transition-colors
                "
              >
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Exports for settings integration
// ============================================================================

export { WorkspaceTrustEditor as default };
