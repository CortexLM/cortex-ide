import { createSignal, Show, type JSX } from "solid-js";
import { useEditorUI, type EditorGroup } from "@/context/editor/EditorUIContext";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

interface EditorGroupHeaderProps {
  group: EditorGroup;
  color?: string;
  onRename?: (groupId: string, name: string) => void;
  onLockToggle?: (groupId: string, locked: boolean) => void;
  onClose?: (groupId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const GROUP_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#06b6d4", "#ef4444", "#6366f1",
];

const MAX_GROUP_NAME_LENGTH = 32;

// ============================================================================
// Styles
// ============================================================================

const containerStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "8px",
  padding: "4px 12px",
  height: "32px",
  background: "var(--vscode-editorGroupHeader-tabsBackground, var(--surface-panel))",
  "border-bottom": `1px solid var(--vscode-editorGroupHeader-tabsBorder, ${tokens.colors.border.default})`,
  "user-select": "none",
  "font-size": "12px",
};

const dragHandleStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  cursor: "grab",
  color: tokens.colors.text.muted,
  padding: "2px",
  "border-radius": tokens.radius.sm,
  opacity: "0.5",
};

const nameDisplayStyle: JSX.CSSProperties = {
  flex: "1",
  "min-width": "0",
  overflow: "hidden",
  "text-overflow": "ellipsis",
  "white-space": "nowrap",
  color: tokens.colors.text.primary,
  "font-weight": "500",
  cursor: "default",
  padding: "2px 4px",
  "border-radius": tokens.radius.sm,
};

const nameInputStyle: JSX.CSSProperties = {
  flex: "1",
  "min-width": "0",
  background: tokens.colors.surface.input,
  border: `1px solid ${tokens.colors.border.focus}`,
  "border-radius": tokens.radius.sm,
  color: tokens.colors.text.primary,
  "font-size": "12px",
  padding: "2px 4px",
  outline: "none",
};

const actionButtonStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  width: "22px",
  height: "22px",
  border: "none",
  background: "transparent",
  "border-radius": tokens.radius.sm,
  cursor: "pointer",
  color: tokens.colors.text.muted,
  padding: "0",
};

const badgeStyle: JSX.CSSProperties = {
  display: "inline-flex",
  "align-items": "center",
  "justify-content": "center",
  "min-width": "18px",
  height: "18px",
  padding: "0 5px",
  "border-radius": tokens.radius.full,
  background: tokens.colors.accent.muted,
  color: tokens.colors.accent.primary,
  "font-size": "10px",
  "font-weight": "600",
  "line-height": "1",
};

// ============================================================================
// Component
// ============================================================================

export function EditorGroupHeader(props: EditorGroupHeaderProps) {
  const editorUI = useEditorUI();
  const [isEditing, setIsEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");
  const [isLocked, setIsLocked] = createSignal(false);
  const [isDragHovered, setIsDragHovered] = createSignal(false);

  const groupColor = () => props.color ?? GROUP_COLORS[props.group.fileIds.length % GROUP_COLORS.length];
  const groupName = () => `Group ${props.group.id.replace(/^group-/, "")}`;
  const fileCount = () => props.group.fileIds.length;
  const isActive = () => editorUI.activeGroupId() === props.group.id;

  const handleDoubleClick = () => {
    setEditValue(groupName());
    setIsEditing(true);
  };

  const commitRename = () => {
    const trimmed = editValue().trim().slice(0, MAX_GROUP_NAME_LENGTH);
    if (trimmed && props.onRename) {
      props.onRename(props.group.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      commitRename();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  const handleLockToggle = () => {
    const next = !isLocked();
    setIsLocked(next);
    props.onLockToggle?.(props.group.id, next);
  };

  const handleClose = () => {
    if (isLocked()) return;
    props.onClose?.(props.group.id);
  };

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer?.setData("text/plain", props.group.id);
    e.dataTransfer!.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragHovered(true);
  };

  const handleDragLeave = () => {
    setIsDragHovered(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragHovered(false);
  };

  const handleGroupClick = () => {
    editorUI.setActiveGroup(props.group.id);
  };

  return (
    <div
      style={{
        ...containerStyle,
        "border-left": isActive() ? `2px solid ${groupColor()}` : "2px solid transparent",
        background: isDragHovered()
          ? tokens.colors.surface.hover
          : containerStyle.background,
      } as JSX.CSSProperties}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleGroupClick}
    >
      {/* Drag handle */}
      <div
        style={dragHandleStyle}
        draggable={true}
        onDragStart={handleDragStart}
        title="Drag to reorder group"
      >
        <Icon name="grip-vertical" style={{ width: "12px", height: "12px" }} />
      </div>

      {/* Color indicator dot */}
      <div
        style={{
          width: "8px",
          height: "8px",
          "border-radius": tokens.radius.full,
          background: groupColor(),
          "flex-shrink": "0",
        } as JSX.CSSProperties}
      />

      {/* Group name (editable) */}
      <Show
        when={isEditing()}
        fallback={
          <div style={nameDisplayStyle} onDblClick={handleDoubleClick} title="Double-click to rename">
            {groupName()}
          </div>
        }
      >
        <input
          style={nameInputStyle}
          value={editValue()}
          onInput={(e) => setEditValue(e.currentTarget.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          maxLength={MAX_GROUP_NAME_LENGTH}
          autofocus
        />
      </Show>

      {/* File count badge */}
      <Show when={fileCount() > 0}>
        <span style={badgeStyle} title={`${fileCount()} file(s) open`}>
          {fileCount()}
        </span>
      </Show>

      {/* Lock toggle */}
      <button
        style={{
          ...actionButtonStyle,
          color: isLocked() ? tokens.colors.state.warning : tokens.colors.text.muted,
        } as JSX.CSSProperties}
        onClick={handleLockToggle}
        title={isLocked() ? "Unlock group (allow closing tabs)" : "Lock group (prevent closing tabs)"}
      >
        <Icon name={isLocked() ? "lock" : "lock-open"} style={{ width: "14px", height: "14px" }} />
      </button>

      {/* Close group button */}
      <button
        style={{
          ...actionButtonStyle,
          opacity: isLocked() ? "0.3" : "1",
          cursor: isLocked() ? "not-allowed" : "pointer",
        } as JSX.CSSProperties}
        onClick={handleClose}
        disabled={isLocked()}
        title={isLocked() ? "Group is locked" : "Close group"}
      >
        <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
      </button>
    </div>
  );
}
