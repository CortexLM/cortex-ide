import {
  Component,
  For,
  Show,
  createSignal,
  createMemo,
  JSX,
} from "solid-js";
import { useWorkspace, WorkspaceFolder, FOLDER_COLORS } from "@/context/WorkspaceContext";
import {
  CortexButton,
  CortexModal,
  CortexIcon,
  CortexTooltip,
} from "@/components/cortex/primitives";

export interface WorkspacePanelProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export const WorkspacePanel: Component<WorkspacePanelProps> = (props) => {
  const workspace = useWorkspace();

  const [showRenameModal, setShowRenameModal] = createSignal(false);
  const [showColorPicker, setShowColorPicker] = createSignal(false);
  const [selectedFolder, setSelectedFolder] = createSignal<WorkspaceFolder | null>(null);
  const [newFolderName, setNewFolderName] = createSignal("");
  const [contextMenuFolder, setContextMenuFolder] = createSignal<WorkspaceFolder | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = createSignal({ x: 0, y: 0 });
  const [collapsedRoots, setCollapsedRoots] = createSignal<Set<string>>(new Set());
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);

  const folders = createMemo(() => workspace.folders());
  const isMultiRoot = createMemo(() => workspace.isMultiRoot());

  const handleAddFolder = async () => {
    await workspace.addFolderWithPicker();
  };

  const handleRemoveFolder = (folder: WorkspaceFolder) => {
    workspace.removeFolder(folder.path);
    setContextMenuFolder(null);
  };

  const handleRenameFolder = () => {
    const folder = selectedFolder();
    if (folder && newFolderName().trim()) {
      workspace.setFolderName(folder.path, newFolderName().trim());
      setShowRenameModal(false);
      setSelectedFolder(null);
      setNewFolderName("");
    }
  };

  const handleSetColor = (folder: WorkspaceFolder, color: string | undefined) => {
    workspace.setFolderColor(folder.path, color);
    setShowColorPicker(false);
    setSelectedFolder(null);
  };

  const handleFolderClick = (folder: WorkspaceFolder) => {
    workspace.setActiveFolder(folder.path);
  };

  const handleContextMenu = (folder: WorkspaceFolder, e: MouseEvent) => {
    e.preventDefault();
    setContextMenuFolder(folder);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenuFolder(null);
  };

  const openRenameModal = (folder: WorkspaceFolder) => {
    setSelectedFolder(folder);
    setNewFolderName(folder.name);
    setShowRenameModal(true);
    closeContextMenu();
  };

  const openColorPicker = (folder: WorkspaceFolder) => {
    setSelectedFolder(folder);
    setShowColorPicker(true);
    closeContextMenu();
  };

  const toggleRootCollapsed = (path: string) => {
    setCollapsedRoots(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const isRootCollapsed = (path: string): boolean => {
    return collapsedRoots().has(path);
  };

  const handleDragStart = (e: DragEvent, index: number) => {
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    }
    workspace.startDrag(index);
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    setDragOverIndex(index);
    workspace.updateDropTarget(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: DragEvent, _targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    workspace.endDrag();
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    workspace.endDrag();
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    background: "var(--cortex-bg-primary)",
    ...props.style,
  });

  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "8px 12px",
    "border-bottom": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
  });

  const titleStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "11px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: "var(--cortex-text-muted)",
  });

  const listStyle = (): JSX.CSSProperties => ({
    flex: "1",
    "overflow-y": "auto",
    padding: "4px 0",
  });

  const emptyStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    padding: "24px",
    gap: "12px",
    color: "var(--cortex-text-muted)",
  });

  return (
    <div class={props.class} style={containerStyle()}>
      <div style={headerStyle()}>
        <span style={titleStyle()}>Workspace</span>
        <CortexTooltip content="Add Folder to Workspace" position="bottom">
          <CortexButton
            variant="ghost"
            size="sm"
            onClick={handleAddFolder}
            aria-label="Add folder"
          >
            <CortexIcon name="plus" size={14} />
          </CortexButton>
        </CortexTooltip>
      </div>

      <div style={listStyle()}>
        <Show
          when={folders().length > 0}
          fallback={
            <div style={emptyStyle()}>
              <CortexIcon name="folder" size={32} />
              <span style={{ "font-size": "13px" }}>No folders in workspace</span>
              <CortexButton variant="secondary" size="sm" onClick={handleAddFolder}>
                Add Folder
              </CortexButton>
            </div>
          }
        >
          <For each={folders()}>
            {(folder, index) => (
              <div
                draggable={isMultiRoot()}
                onDragStart={(e) => handleDragStart(e, index())}
                onDragOver={(e) => handleDragOver(e, index())}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index())}
                onDragEnd={handleDragEnd}
                style={{
                  "border-top": dragOverIndex() === index() ? "2px solid var(--cortex-accent-primary)" : "2px solid transparent",
                  transition: "border-color 100ms ease",
                }}
              >
                <WorkspaceFolderItem
                  folder={folder}
                  isActive={workspace.activeFolder() === folder.path}
                  isCollapsed={isMultiRoot() && isRootCollapsed(folder.path)}
                  showCollapseToggle={isMultiRoot()}
                  onClick={() => handleFolderClick(folder)}
                  onContextMenu={(e) => handleContextMenu(folder, e)}
                  onToggleCollapse={() => toggleRootCollapsed(folder.path)}
                />
              </div>
            )}
          </For>
        </Show>
      </div>

      <Show when={isMultiRoot()}>
        <div
          style={{
            padding: "8px 12px",
            "border-top": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
            display: "flex",
            gap: "8px",
          }}
        >
          <CortexButton
            variant="secondary"
            size="sm"
            onClick={() => workspace.saveWorkspaceAs()}
            style={{ flex: "1" }}
          >
            Save Workspace
          </CortexButton>
        </div>
      </Show>

      <Show when={contextMenuFolder()}>
        <WorkspaceFolderContextMenu
          folder={contextMenuFolder()!}
          position={contextMenuPosition()}
          onClose={closeContextMenu}
          onRename={() => openRenameModal(contextMenuFolder()!)}
          onSetColor={() => openColorPicker(contextMenuFolder()!)}
          onRemove={() => handleRemoveFolder(contextMenuFolder()!)}
        />
      </Show>

      <CortexModal
        open={showRenameModal()}
        onClose={() => setShowRenameModal(false)}
        title="Rename Folder"
        size="sm"
        confirmText="Rename"
        cancelText="Cancel"
        onConfirm={handleRenameFolder}
        onCancel={() => setShowRenameModal(false)}
      >
        <input
          type="text"
          value={newFolderName()}
          onInput={(e: InputEvent) => setNewFolderName((e.currentTarget as HTMLInputElement).value)}
          placeholder="Folder name"
          autofocus
          style={{
            width: "100%",
            padding: "8px 12px",
            "font-size": "14px",
            background: "var(--cortex-bg-secondary)",
            border: "1px solid var(--cortex-border-default)",
            "border-radius": "6px",
            color: "var(--cortex-text-primary)",
            outline: "none",
          }}
        />
      </CortexModal>

      <CortexModal
        open={showColorPicker()}
        onClose={() => setShowColorPicker(false)}
        title="Set Folder Color"
        size="sm"
      >
        <div style={{ display: "flex", "flex-wrap": "wrap", gap: "8px" }}>
          <For each={FOLDER_COLORS}>
            {(colorOption) => (
              <button
                onClick={() => handleSetColor(selectedFolder()!, colorOption.value)}
                style={{
                  width: "32px",
                  height: "32px",
                  "border-radius": "6px",
                  border: selectedFolder()?.color === colorOption.value
                    ? "2px solid var(--cortex-accent-primary)"
                    : "1px solid var(--cortex-border-default)",
                  background: colorOption.value || "var(--cortex-bg-secondary)",
                  cursor: "pointer",
                }}
                title={colorOption.name}
              />
            )}
          </For>
        </div>
      </CortexModal>
    </div>
  );
};

interface WorkspaceFolderItemProps {
  folder: WorkspaceFolder;
  isActive: boolean;
  isCollapsed?: boolean;
  showCollapseToggle?: boolean;
  onClick: () => void;
  onContextMenu: (e: MouseEvent) => void;
  onToggleCollapse?: () => void;
}

const WorkspaceFolderItem: Component<WorkspaceFolderItemProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);

  const itemStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "6px 12px",
    cursor: "pointer",
    background: props.isActive
      ? "var(--cortex-accent-muted, rgba(191,255,0,0.1))"
      : isHovered()
      ? "var(--cortex-bg-hover, rgba(255,255,255,0.05))"
      : "transparent",
    transition: "background 100ms ease",
  });

  const iconStyle = (): JSX.CSSProperties => ({
    width: "16px",
    height: "16px",
    color: props.folder.color || "var(--cortex-accent-primary)",
    "flex-shrink": "0",
  });

  const nameStyle = (): JSX.CSSProperties => ({
    flex: "1",
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "13px",
    color: props.isActive
      ? "var(--cortex-text-primary)"
      : "var(--cortex-text-secondary)",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
  });

  const pathStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-mono, monospace)",
    "font-size": "10px",
    color: "var(--cortex-text-muted)",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
  });

  return (
    <div
      style={itemStyle()}
      onClick={props.onClick}
      onContextMenu={props.onContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Show when={props.showCollapseToggle}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onToggleCollapse?.();
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0",
            color: "var(--cortex-text-muted)",
            display: "flex",
            "align-items": "center",
            "flex-shrink": "0",
          }}
        >
          <CortexIcon
            name={props.isCollapsed ? "chevron-right" : "chevron-down"}
            size={12}
          />
        </button>
      </Show>
      <div style={iconStyle()}>
        <CortexIcon name="folder" size={16} />
      </div>
      <div style={{ flex: "1", "min-width": "0" }}>
        <div style={nameStyle()}>{props.folder.name}</div>
        <div style={pathStyle()}>{props.folder.path}</div>
      </div>
    </div>
  );
};

interface WorkspaceFolderContextMenuProps {
  folder: WorkspaceFolder;
  position: { x: number; y: number };
  onClose: () => void;
  onRename: () => void;
  onSetColor: () => void;
  onRemove: () => void;
}

const WorkspaceFolderContextMenu: Component<WorkspaceFolderContextMenuProps> = (props) => {
  const menuStyle = (): JSX.CSSProperties => ({
    position: "fixed",
    top: `${props.position.y}px`,
    left: `${props.position.x}px`,
    background: "var(--cortex-bg-elevated)",
    border: "1px solid var(--cortex-border-default)",
    "border-radius": "6px",
    "box-shadow": "0 4px 12px rgba(0,0,0,0.3)",
    "z-index": "1000",
    "min-width": "160px",
    padding: "4px 0",
  });

  const itemStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "6px 12px",
    cursor: "pointer",
    "font-size": "13px",
    color: "var(--cortex-text-secondary)",
    background: "transparent",
    border: "none",
    width: "100%",
    "text-align": "left",
  });

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: "0",
        "z-index": "999",
      }}
      onClick={handleBackdropClick}
    >
      <div style={menuStyle()}>
        <button
          style={itemStyle()}
          onClick={props.onRename}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--cortex-bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <CortexIcon name="edit" size={14} />
          Rename
        </button>
        <button
          style={itemStyle()}
          onClick={props.onSetColor}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--cortex-bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <CortexIcon name="palette" size={14} />
          Set Color
        </button>
        <div
          style={{
            height: "1px",
            background: "var(--cortex-border-default)",
            margin: "4px 0",
          }}
        />
        <button
          style={{
            ...itemStyle(),
            color: "var(--cortex-error, #ef4444)",
          }}
          onClick={props.onRemove}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--cortex-bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <CortexIcon name="trash" size={14} />
          Remove from Workspace
        </button>
      </div>
    </div>
  );
};

export default WorkspacePanel;
