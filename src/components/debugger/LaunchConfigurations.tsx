import { createSignal, For, Show } from "solid-js";
import {
  useDebug,
  DebugSessionConfig,
  CompoundConfig,
  SavedLaunchConfig,
} from "@/context/DebugContext";
import { Icon } from "../ui/Icon";

interface LaunchConfigurationsProps {
  onNewConfig?: () => void;
}

type SelectionType = "config" | "compound";

interface SelectionItem {
  type: SelectionType;
  name: string;
  config?: SavedLaunchConfig;
  compound?: CompoundConfig;
}

export function LaunchConfigurations(props: LaunchConfigurationsProps) {
  const debug = useDebug();
  const [isDropdownOpen, setIsDropdownOpen] = createSignal(false);
  const [selectedItem, setSelectedItem] = createSignal<SelectionItem | null>(null);
  const [isEditingCompound, setIsEditingCompound] = createSignal(false);
  const [editingCompound, setEditingCompound] = createSignal<CompoundConfig | null>(null);

  const handleSelect = (item: SelectionItem) => {
    setSelectedItem(item);
    setIsDropdownOpen(false);
  };

  const handleLaunch = async () => {
    const item = selectedItem();
    if (!item) return;

    try {
      if (item.type === "compound" && item.compound) {
        await debug.launchCompound(item.compound.name);
      } else if (item.type === "config" && item.config) {
        const config: DebugSessionConfig = {
          ...item.config,
          id: `debug-${Date.now()}`,
        };
        await debug.startSession(config);
      }
    } catch (e) {
      console.error("Launch failed:", e);
    }
  };

  const handleEditCompound = (compound: CompoundConfig) => {
    setEditingCompound({ ...compound });
    setIsEditingCompound(true);
    setIsDropdownOpen(false);
  };

  const handleDeleteCompound = (name: string) => {
    debug.removeCompound(name);
    if (selectedItem()?.name === name) {
      setSelectedItem(null);
    }
  };

  const handleCreateNewCompound = () => {
    const newCompound: CompoundConfig = {
      name: `Compound ${debug.getCompounds().length + 1}`,
      configurations: [],
      stopAll: true,
    };
    debug.addCompound(newCompound);
    setEditingCompound(newCompound);
    setIsEditingCompound(true);
    setIsDropdownOpen(false);
  };

  const currentLabel = () => {
    const item = selectedItem();
    if (!item) return "Select Configuration";
    return item.name;
  };

  const isCompoundSelected = () => {
    return selectedItem()?.type === "compound";
  };

  const isRunning = () => debug.state.isDebugging;

  return (
    <div class="flex items-center gap-1">
      {/* Configuration Dropdown */}
      <div class="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen())}
          disabled={isRunning()}
          class="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors min-w-[140px] max-w-[200px] disabled:opacity-50"
          style={{
            background: "var(--surface-sunken)",
            color: "var(--text-base)",
            border: "1px solid var(--border-weak)",
          }}
        >
          <Show when={isCompoundSelected()}>
            <span title="Compound Configuration">
              <Icon
                name="layer-group"
                size="xs"
                style={{ color: "var(--accent)", "flex-shrink": "0" }}
              />
            </span>
          </Show>
          <span class="truncate flex-1 text-left">{currentLabel()}</span>
          <Icon name="chevron-down" size="xs" style={{ color: "var(--text-weak)", "flex-shrink": "0" }} />
        </button>

        {/* Dropdown Menu */}
        <Show when={isDropdownOpen()}>
          <div
            class="absolute top-full left-0 mt-1 w-64 rounded-md shadow-lg z-50 max-h-64 overflow-auto"
            style={{
              background: "var(--background-base)",
              border: "1px solid var(--border-weak)",
            }}
          >
            {/* Configurations Section */}
            <Show when={debug.getSavedConfigurations().length > 0}>
              <div
                class="px-2 py-1 text-[10px] uppercase tracking-wider"
                style={{ color: "var(--text-weak)" }}
              >
                Configurations
              </div>
              <For each={debug.getSavedConfigurations()}>
                {(config) => (
                  <button
                    onClick={() =>
                      handleSelect({ type: "config", name: config.name, config })
                    }
                    class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-[var(--surface-raised)]"
                    style={{ color: "var(--text-base)" }}
                  >
                    <Icon name="play" size="xs" style={{ color: "var(--text-weak)", "flex-shrink": "0" }} />
                    <span class="truncate flex-1">{config.name}</span>
                    <span class="text-[10px]" style={{ color: "var(--text-weak)" }}>
                      {config.type}
                    </span>
                  </button>
                )}
              </For>
            </Show>

            {/* Compounds Section */}
            <Show when={debug.getCompounds().length > 0}>
              <div
                class="px-2 py-1 text-[10px] uppercase tracking-wider mt-1 border-t"
                style={{
                  color: "var(--text-weak)",
                  "border-color": "var(--border-weak)",
                }}
              >
                Compounds
              </div>
              <For each={debug.getCompounds()}>
                {(compound) => (
                  <div
                    class="flex items-center gap-1 px-2 py-1 transition-colors hover:bg-[var(--surface-raised)] group"
                  >
                    <button
                      onClick={() =>
                        handleSelect({ type: "compound", name: compound.name, compound })
                      }
                      class="flex-1 flex items-center gap-2 text-xs text-left"
                      style={{ color: "var(--text-base)" }}
                    >
                      <Icon
                        name="layer-group"
                        size="xs"
                        style={{ color: "var(--accent)", "flex-shrink": "0" }}
                      />
                      <span class="truncate">{compound.name}</span>
                      <span class="text-[10px]" style={{ color: "var(--text-weak)" }}>
                        ({compound.configurations.length})
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditCompound(compound);
                      }}
                      class="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--surface-sunken)]"
                      style={{ color: "var(--text-weak)" }}
                      title="Edit Compound"
                    >
                      <Icon name="pen" size="xs" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCompound(compound.name);
                      }}
                      class="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--surface-sunken)]"
                      style={{ color: "var(--cortex-error)" }}
                      title="Delete Compound"
                    >
                      <Icon name="trash" size="xs" />
                    </button>
                  </div>
                )}
              </For>
            </Show>

            {/* Actions */}
            <div
              class="border-t mt-1 pt-1"
              style={{ "border-color": "var(--border-weak)" }}
            >
              <button
                onClick={handleCreateNewCompound}
                class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-[var(--surface-raised)]"
                style={{ color: "var(--text-weak)" }}
              >
                <Icon name="layer-group" size="xs" />
                <span>New Compound...</span>
              </button>
              <Show when={props.onNewConfig}>
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    props.onNewConfig?.();
                  }}
                  class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-[var(--surface-raised)]"
                  style={{ color: "var(--text-weak)" }}
                >
                  <Icon name="plus" size="xs" />
                  <span>New Configuration...</span>
                </button>
              </Show>
            </div>
          </div>
        </Show>
      </div>

      {/* Launch Button */}
      <button
        onClick={handleLaunch}
        disabled={!selectedItem() || isRunning()}
        class="p-1.5 rounded transition-colors disabled:opacity-30"
        style={{ color: "var(--cortex-success)" }}
        title="Start Debugging (F5)"
      >
        <Icon name="play" size="md" />
      </button>

      {/* Edit Compound Button (when compound is selected) */}
      <Show when={isCompoundSelected() && selectedItem()?.compound}>
        <button
          onClick={() => handleEditCompound(selectedItem()!.compound!)}
          disabled={isRunning()}
          class="p-1.5 rounded transition-colors disabled:opacity-30 hover:bg-[var(--surface-raised)]"
          style={{ color: "var(--text-weak)" }}
          title="Edit Compound"
        >
          <Icon name="gear" size="md" />
        </button>
      </Show>

      {/* Compound Editor Modal */}
      <Show when={isEditingCompound() && editingCompound()}>
        <CompoundEditor
          compound={editingCompound()!}
          configurations={debug.getSavedConfigurations()}
          onSave={(compound) => {
            debug.updateCompound(editingCompound()!.name, compound);
            setIsEditingCompound(false);
            setEditingCompound(null);
          }}
          onClose={() => {
            setIsEditingCompound(false);
            setEditingCompound(null);
          }}
        />
      </Show>

      {/* Click outside to close dropdown */}
      <Show when={isDropdownOpen()}>
        <div
          class="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
        />
      </Show>
    </div>
  );
}

interface CompoundEditorProps {
  compound: CompoundConfig;
  configurations: SavedLaunchConfig[];
  onSave: (compound: CompoundConfig) => void;
  onClose: () => void;
}

function CompoundEditor(props: CompoundEditorProps) {
  const [name, setName] = createSignal(props.compound.name);
  const [selectedConfigs, setSelectedConfigs] = createSignal<string[]>(
    [...props.compound.configurations]
  );
  const [preLaunchTask, setPreLaunchTask] = createSignal(
    props.compound.preLaunchTask || ""
  );
  const [postDebugTask, setPostDebugTask] = createSignal(
    props.compound.postDebugTask || ""
  );
  const [stopAll, setStopAll] = createSignal(props.compound.stopAll);

  const toggleConfig = (configName: string) => {
    const current = selectedConfigs();
    if (current.includes(configName)) {
      setSelectedConfigs(current.filter((c) => c !== configName));
    } else {
      setSelectedConfigs([...current, configName]);
    }
  };

  const handleSave = () => {
    if (!name().trim()) return;

    props.onSave({
      name: name(),
      configurations: selectedConfigs(),
      preLaunchTask: preLaunchTask() || undefined,
      postDebugTask: postDebugTask() || undefined,
      stopAll: stopAll(),
    });
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "var(--ui-panel-bg)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        class="w-[400px] max-h-[80vh] overflow-hidden rounded-lg shadow-2xl flex flex-col"
        style={{ background: "var(--background-base)" }}
      >
        {/* Header */}
        <div
          class="shrink-0 flex items-center justify-between px-4 py-3 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <div class="flex items-center gap-2">
            <Icon name="layer-group" size="md" style={{ color: "var(--accent)" }} />
            <h2 class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
              Edit Compound
            </h2>
          </div>
          <button
            onClick={props.onClose}
            class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
          >
            <Icon name="xmark" size="md" />
          </button>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-auto p-4 space-y-4">
          {/* Name */}
          <div>
            <label
              class="block text-xs mb-1"
              style={{ color: "var(--text-weak)" }}
            >
              Compound Name
            </label>
            <input
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              class="w-full px-3 py-2 text-sm rounded outline-none"
              style={{
                background: "var(--surface-sunken)",
                color: "var(--text-base)",
                border: "1px solid var(--border-weak)",
              }}
            />
          </div>

          {/* Configurations */}
          <div>
            <label
              class="block text-xs mb-2"
              style={{ color: "var(--text-weak)" }}
            >
              Configurations to Launch
            </label>
            <div
              class="rounded border max-h-40 overflow-auto"
              style={{
                background: "var(--surface-sunken)",
                "border-color": "var(--border-weak)",
              }}
            >
              <Show
                when={props.configurations.length > 0}
                fallback={
                  <div
                    class="px-3 py-2 text-xs italic"
                    style={{ color: "var(--text-weak)" }}
                  >
                    No saved configurations available
                  </div>
                }
              >
                <For each={props.configurations}>
                  {(config) => (
                    <label
                      class="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-[var(--surface-raised)]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedConfigs().includes(config.name)}
                        onChange={() => toggleConfig(config.name)}
                        class="rounded"
                      />
                      <span
                        class="text-sm flex-1"
                        style={{ color: "var(--text-base)" }}
                      >
                        {config.name}
                      </span>
                      <span
                        class="text-[10px]"
                        style={{ color: "var(--text-weak)" }}
                      >
                        {config.type}
                      </span>
                    </label>
                  )}
                </For>
              </Show>
            </div>
          </div>

          {/* Pre-launch Task */}
          <div>
            <label
              class="block text-xs mb-1"
              style={{ color: "var(--text-weak)" }}
            >
              Pre-launch Task (optional)
            </label>
            <input
              type="text"
              value={preLaunchTask()}
              onInput={(e) => setPreLaunchTask(e.currentTarget.value)}
              placeholder="Task name to run before launching"
              class="w-full px-3 py-2 text-sm rounded outline-none"
              style={{
                background: "var(--surface-sunken)",
                color: "var(--text-base)",
                border: "1px solid var(--border-weak)",
              }}
            />
          </div>

          {/* Post-debug Task */}
          <div>
            <label
              class="block text-xs mb-1"
              style={{ color: "var(--text-weak)" }}
            >
              Post Debug Task (optional)
            </label>
            <input
              type="text"
              value={postDebugTask()}
              onInput={(e) => setPostDebugTask(e.currentTarget.value)}
              placeholder="Task name to run after debugging ends"
              class="w-full px-3 py-2 text-sm rounded outline-none"
              style={{
                background: "var(--surface-sunken)",
                color: "var(--text-base)",
                border: "1px solid var(--border-weak)",
              }}
            />
          </div>

          {/* Stop All Option */}
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              id="stopAll"
              checked={stopAll()}
              onChange={(e) => setStopAll(e.currentTarget.checked)}
              class="rounded"
            />
            <label
              for="stopAll"
              class="text-sm"
              style={{ color: "var(--text-base)" }}
            >
              Stop all when one stops
            </label>
          </div>
        </div>

        {/* Footer */}
        <div
          class="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-t"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <button
            onClick={props.onClose}
            class="px-3 py-1.5 text-sm rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name().trim()}
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "white",
            }}
          >
            <Icon name="check" size="sm" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

