import {
  Component,
  For,
  Show,
  createSignal,
  createMemo,
} from "solid-js";
import { useMultiRoot } from "@/context/workspace/MultiRootProvider";
import type { MultiRootFolder } from "@/context/workspace/MultiRootProvider";
import {
  CortexButton,
  CortexIcon,
  CortexTooltip,
} from "@/components/cortex/primitives";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";

export interface WorkspaceManagerProps {
  class?: string;
}

function extractFolderName(folderPath: string): string {
  const normalized = folderPath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? folderPath;
}

function truncatePath(path: string, maxSegments = 3): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= maxSegments) return normalized;
  return "~/" + parts.slice(-maxSegments).join("/");
}

export const WorkspaceManager: Component<WorkspaceManagerProps> = (props) => {
  const multiRoot = useMultiRoot();
  const [saving, setSaving] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  const folderList = createMemo(() => multiRoot.folders());
  const hasFolders = createMemo(() => folderList().length > 0);

  const handleAddFolder = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Add Folder to Workspace",
    });
    if (typeof selected === "string") {
      await multiRoot.addFolder(selected);
    }
  };

  const handleRemoveFolder = async (folder: MultiRootFolder) => {
    await multiRoot.removeFolder(folder.path);
  };

  const handleSaveWorkspace = async () => {
    const filePath = await saveDialog({
      title: "Save Workspace",
      defaultPath: "workspace.cortex-workspace",
      filters: [
        { name: "Cortex Workspace", extensions: ["cortex-workspace"] },
      ],
    });
    if (filePath) {
      setSaving(true);
      try {
        await multiRoot.saveWorkspace(filePath);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleLoadWorkspace = async () => {
    const filePath = await openDialog({
      title: "Open Workspace",
      multiple: false,
      filters: [
        { name: "Cortex Workspace", extensions: ["cortex-workspace"] },
      ],
    });
    if (typeof filePath === "string") {
      setLoading(true);
      try {
        await multiRoot.loadWorkspace(filePath);
      } finally {
        setLoading(false);
      }
    }
  };

  const hasFolderSettings = (folderPath: string): boolean => {
    const settings = multiRoot.getFolderSettings(folderPath);
    return Object.keys(settings).length > 0;
  };

  return (
    <div class={`flex flex-col h-full ${props.class ?? ""}`}>
      <div class="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-primary,#313244)]">
        <CortexIcon
          name="layers"
          size={14}
          style={{ color: "var(--text-secondary, #a6adc8)" }}
        />
        <span class="flex-1 text-xs font-semibold text-[var(--text-primary,#cdd6f4)]">
          Workspace Folders
        </span>
        <Show when={multiRoot.isMultiRoot()}>
          <span class="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-[var(--bg-active,#313244)] text-[var(--text-secondary,#a6adc8)]">
            Multi-root
          </span>
        </Show>
      </div>

      <div class="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border-primary,#313244)]">
        <CortexButton
          variant="ghost"
          size="xs"
          onClick={handleSaveWorkspace}
          icon="save"
          title="Save Workspace"
          disabled={saving() || !hasFolders()}
        />
        <CortexButton
          variant="ghost"
          size="xs"
          onClick={handleLoadWorkspace}
          icon="folder-open"
          title="Load Workspace"
          disabled={loading()}
        />
        <Show when={multiRoot.workspaceFilePath()}>
          <CortexTooltip content={multiRoot.workspaceFilePath()!}>
            <span class="ml-1 text-[11px] text-[var(--text-tertiary,#6c7086)] truncate max-w-[140px]">
              {truncatePath(multiRoot.workspaceFilePath()!)}
            </span>
          </CortexTooltip>
        </Show>
      </div>

      <div class="flex-1 overflow-y-auto px-1 py-1">
        <For each={folderList()}>
          {(folder) => (
            <div class="group flex items-center gap-2 px-3 py-2 mx-1 mb-0.5 rounded-md transition-colors hover:bg-[var(--bg-hover,#262637)]">
              <Show
                when={folder.color}
                fallback={
                  <CortexIcon
                    name="folder"
                    size={16}
                    style={{ color: "var(--text-secondary, #a6adc8)" }}
                  />
                }
              >
                <div
                  class="w-4 h-4 rounded-sm shrink-0"
                  style={{ "background-color": folder.color }}
                />
              </Show>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-[13px] font-medium text-[var(--text-primary,#cdd6f4)] truncate">
                    {folder.name ?? extractFolderName(folder.path)}
                  </span>
                  <Show when={hasFolderSettings(folder.path)}>
                    <CortexTooltip content="Has per-folder settings">
                      <CortexIcon
                        name="settings"
                        size={12}
                        style={{ color: "var(--text-tertiary, #6c7086)" }}
                      />
                    </CortexTooltip>
                  </Show>
                </div>
                <span class="text-[11px] text-[var(--text-tertiary,#6c7086)] truncate block">
                  {truncatePath(folder.path)}
                </span>
              </div>

              <CortexButton
                variant="ghost"
                size="xs"
                onClick={() => handleRemoveFolder(folder)}
                icon="x"
                title="Remove folder from workspace"
              />
            </div>
          )}
        </For>

        <Show when={!hasFolders()}>
          <div class="flex flex-col items-center gap-2 py-8 px-4">
            <CortexIcon
              name="folder-plus"
              size={24}
              style={{ color: "var(--text-secondary, #a6adc8)", opacity: "0.4" }}
            />
            <span class="text-[13px] text-[var(--text-secondary,#a6adc8)] text-center">
              No folders in workspace
            </span>
            <span class="text-[11px] text-[var(--text-tertiary,#6c7086)] text-center">
              Add a folder or load an existing workspace
            </span>
          </div>
        </Show>
      </div>

      <div class="px-2 py-2 border-t border-[var(--border-primary,#313244)]">
        <CortexButton
          variant="ghost"
          size="sm"
          onClick={handleAddFolder}
          icon="plus"
          class="w-full justify-center"
        >
          Add Folder
        </CortexButton>
      </div>
    </div>
  );
};

export default WorkspaceManager;
