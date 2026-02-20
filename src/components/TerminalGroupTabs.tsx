import {
  Show,
  For,
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
  type JSX,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Icon } from "./ui/Icon";
import {
  useTerminals,
  TerminalInfo,
  TerminalSplitDirection,
} from "@/context/TerminalsContext";
import { tokens } from "@/design-system/tokens";

/**
 * TerminalGroupTabs - VS Code-style terminal group tabs
 *
 * Features:
 * - Group tabs showing terminals side-by-side within groups
 * - Drag and drop for reordering terminals within/between groups
 * - Visual group indicator with color coding
 * - Split button to create side-by-side terminal in same group
 * - Context menu for group operations
 */

interface TerminalGroupTabsProps {
  /** Callback when a terminal is selected */
  onSelectTerminal?: (terminalId: string) => void;
  /** Callback when a terminal should be closed */
  onCloseTerminal?: (terminalId: string) => void;
  /** Callback when a new terminal is requested */
  onNewTerminal?: () => void;
  /** Callback when split is requested */
  onSplitTerminal?: (terminalId: string, direction: TerminalSplitDirection) => void;
  /** Custom class name */
  class?: string;
  /** Custom style */
  style?: JSX.CSSProperties;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: "group" | "terminal" | null;
  targetId: string | null;
}

interface DragState {
  isDragging: boolean;
  dragType: "terminal" | "group" | null;
  dragId: string | null;
  sourceGroupId: string | null;
  dragOverId: string | null;
  dragOverType: "terminal" | "group" | "new-group" | null;
}

export function TerminalGroupTabs(props: TerminalGroupTabsProps) {
  const {
    state,
    setActiveTerminal,
    setActiveGroup,
    closeTerminal,
    createTerminal,
    createGroup,
    deleteGroup,
    renameGroup,
    addToGroup,
    removeFromGroup,
    splitTerminalInGroup,
    getGroupForTerminal,
    reorderTerminalsInGroup,
    moveToGroup,
  } = useTerminals();

  // Local state
  const [contextMenu, setContextMenu] = createStore<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    type: null,
    targetId: null,
  });

  const [dragState, setDragState] = createStore<DragState>({
    isDragging: false,
    dragType: null,
    dragId: null,
    sourceGroupId: null,
    dragOverId: null,
    dragOverType: null,
  });

  const [editingGroupId, setEditingGroupId] = createSignal<string | null>(null);
  const [editingName, setEditingName] = createSignal("");
  const [hoveredTabId, setHoveredTabId] = createSignal<string | null>(null);
  const [showNewDropdown, setShowNewDropdown] = createSignal(false);

  let editInputRef: HTMLInputElement | undefined;
  let newDropdownRef: HTMLDivElement | undefined;

  // Get terminals not in any group (ungrouped)
  const ungroupedTerminals = createMemo(() => {
    const groupedIds = new Set<string>();
    state.groups.forEach((g) => g.terminalIds.forEach((id) => groupedIds.add(id)));
    return state.terminals.filter((t) => !groupedIds.has(t.id));
  });

  // Get terminals in active group
  const activeGroupTerminals = createMemo(() => {
    if (!state.activeGroupId) return [];
    const group = state.groups.find((g) => g.id === state.activeGroupId);
    if (!group) return [];
    return group.terminalIds
      .map((id) => state.terminals.find((t) => t.id === id))
      .filter((t): t is TerminalInfo => t !== undefined);
  });

  // Close context menu on click outside
  createEffect(() => {
    if (contextMenu.visible) {
      const handleClick = () => {
        setContextMenu({ visible: false, x: 0, y: 0, type: null, targetId: null });
      };
      document.addEventListener("mousedown", handleClick);
      onCleanup(() => document.removeEventListener("mousedown", handleClick));
    }
  });

  // Close new dropdown on click outside
  createEffect(() => {
    if (showNewDropdown()) {
      const handleClick = (e: MouseEvent) => {
        if (newDropdownRef && !newDropdownRef.contains(e.target as Node)) {
          setShowNewDropdown(false);
        }
      };
      document.addEventListener("mousedown", handleClick);
      onCleanup(() => document.removeEventListener("mousedown", handleClick));
    }
  });

  // Focus edit input when editing starts
  createEffect(() => {
    if (editingGroupId() && editInputRef) {
      editInputRef.focus();
      editInputRef.select();
    }
  });

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleSelectTerminal = (terminalId: string) => {
    setActiveTerminal(terminalId);
    const group = getGroupForTerminal(terminalId);
    if (group) {
      setActiveGroup(group.id);
    }
    props.onSelectTerminal?.(terminalId);
  };

  const handleSelectGroup = (groupId: string) => {
    setActiveGroup(groupId);
    const group = state.groups.find((g) => g.id === groupId);
    if (group && group.terminalIds.length > 0) {
      setActiveTerminal(group.terminalIds[0]);
    }
  };

  const handleCloseTerminal = async (e: MouseEvent, terminalId: string) => {
    e.stopPropagation();
    props.onCloseTerminal?.(terminalId);
    await closeTerminal(terminalId);
  };

  const handleNewTerminal = async () => {
    const terminal = await createTerminal();
    setActiveTerminal(terminal.id);
    setShowNewDropdown(false);
    props.onNewTerminal?.();
  };

  const handleNewTerminalInGroup = async (groupId: string) => {
    const terminal = await createTerminal();
    addToGroup(terminal.id, groupId);
    setActiveTerminal(terminal.id);
    setActiveGroup(groupId);
    setShowNewDropdown(false);
  };

  const handleSplitTerminal = async (
    terminalId: string,
    direction: TerminalSplitDirection = "horizontal"
  ) => {
    await splitTerminalInGroup(terminalId, direction);
    props.onSplitTerminal?.(terminalId, direction);
  };

  const handleNewGroup = async () => {
    const group = createGroup();
    const terminal = await createTerminal();
    addToGroup(terminal.id, group.id);
    setActiveGroup(group.id);
    setActiveTerminal(terminal.id);
    setShowNewDropdown(false);
  };

  // ============================================================================
  // Context Menu Handlers
  // ============================================================================

  const handleContextMenu = (
    e: MouseEvent,
    type: "group" | "terminal",
    targetId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      targetId,
    });
  };

  const handleContextMenuAction = async (action: string) => {
    const { type, targetId } = contextMenu;
    setContextMenu({ visible: false, x: 0, y: 0, type: null, targetId: null });

    if (!targetId) return;

    switch (action) {
      case "close":
        if (type === "terminal") {
          await closeTerminal(targetId);
        }
        break;
      case "split-horizontal":
        if (type === "terminal") {
          await handleSplitTerminal(targetId, "horizontal");
        }
        break;
      case "split-vertical":
        if (type === "terminal") {
          await handleSplitTerminal(targetId, "vertical");
        }
        break;
      case "rename-group":
        if (type === "group") {
          const group = state.groups.find((g) => g.id === targetId);
          if (group) {
            setEditingName(group.name);
            setEditingGroupId(targetId);
          }
        }
        break;
      case "delete-group":
        if (type === "group") {
          deleteGroup(targetId);
        }
        break;
      case "move-to-new-group":
        if (type === "terminal") {
          moveToGroup({ terminalId: targetId, targetGroupId: null });
        }
        break;
      case "ungroup":
        if (type === "terminal") {
          removeFromGroup(targetId);
        }
        break;
    }
  };

  // ============================================================================
  // Rename Handlers
  // ============================================================================

  const finishRenaming = () => {
    const groupId = editingGroupId();
    const name = editingName().trim();
    if (groupId && name) {
      renameGroup(groupId, name);
    }
    setEditingGroupId(null);
    setEditingName("");
  };

  const cancelRenaming = () => {
    setEditingGroupId(null);
    setEditingName("");
  };

  const handleRenameKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finishRenaming();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRenaming();
    }
  };

  // ============================================================================
  // Drag and Drop Handlers
  // ============================================================================

  const handleDragStart = (
    e: DragEvent,
    type: "terminal" | "group",
    id: string,
    sourceGroupId?: string
  ) => {
    e.dataTransfer?.setData("text/plain", id);
    e.dataTransfer!.effectAllowed = "move";
    setDragState({
      isDragging: true,
      dragType: type,
      dragId: id,
      sourceGroupId: sourceGroupId || null,
      dragOverId: null,
      dragOverType: null,
    });

    // Add dragging style
    requestAnimationFrame(() => {
      const target = e.target as HTMLElement;
      target.style.opacity = "0.5";
    });
  };

  const handleDragEnd = (e: DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = "1";
    setDragState({
      isDragging: false,
      dragType: null,
      dragId: null,
      sourceGroupId: null,
      dragOverId: null,
      dragOverType: null,
    });
  };

  const handleDragOver = (
    e: DragEvent,
    type: "terminal" | "group" | "new-group",
    id?: string
  ) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    setDragState(
      produce((s) => {
        s.dragOverId = id || null;
        s.dragOverType = type;
      })
    );
  };

  const handleDragLeave = () => {
    setDragState(
      produce((s) => {
        s.dragOverId = null;
        s.dragOverType = null;
      })
    );
  };

  const handleDrop = (
    e: DragEvent,
    targetType: "terminal" | "group" | "new-group",
    targetId?: string
  ) => {
    e.preventDefault();
    const { dragType, dragId, sourceGroupId } = dragState;

    if (!dragId) return;

    if (dragType === "terminal") {
      if (targetType === "new-group") {
        // Create new group with dragged terminal
        moveToGroup({ terminalId: dragId, targetGroupId: null });
      } else if (targetType === "group" && targetId) {
        // Move terminal to target group
        if (sourceGroupId !== targetId) {
          addToGroup(dragId, targetId);
        }
      } else if (targetType === "terminal" && targetId) {
        // Reorder within group or move to another terminal's group
        const targetGroup = getGroupForTerminal(targetId);
        if (targetGroup) {
          if (sourceGroupId === targetGroup.id) {
            // Reorder within same group
            const newOrder = [...targetGroup.terminalIds];
            const dragIdx = newOrder.indexOf(dragId);
            const targetIdx = newOrder.indexOf(targetId);
            if (dragIdx !== -1 && targetIdx !== -1) {
              newOrder.splice(dragIdx, 1);
              newOrder.splice(targetIdx, 0, dragId);
              reorderTerminalsInGroup(targetGroup.id, newOrder);
            }
          } else {
            // Move to different group at target position
            const targetIdx = targetGroup.terminalIds.indexOf(targetId);
            addToGroup(dragId, targetGroup.id, targetIdx);
          }
        }
      }
    }

    setDragState({
      isDragging: false,
      dragType: null,
      dragId: null,
      sourceGroupId: null,
      dragOverId: null,
      dragOverType: null,
    });
  };

  // ============================================================================
  // Styles
  // ============================================================================

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    background: "var(--jb-tab-container-bg)",
    ...props.style,
  };

  const tabBarStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "0",
    background: "var(--jb-tab-container-bg)",
    "border-bottom": `1px solid ${tokens.colors.border.divider}`,
    padding: `0 ${tokens.spacing.sm}`,
    height: "36px",
    "flex-shrink": "0",
    overflow: "hidden",
  };

  const tabsContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    flex: "1",
    overflow: "hidden",
    gap: "2px",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.xs,
    "margin-left": "auto",
    "flex-shrink": "0",
  };

  const getTabStyle = (isActive: boolean, isHovered: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
    "font-size": "var(--jb-text-body-size)",
    "font-family": "var(--jb-font-ui)",
    color: isActive ? tokens.colors.text.primary : tokens.colors.text.muted,
    background: isActive
      ? "var(--jb-tab-active-bg)"
      : isHovered
      ? "var(--jb-surface-hover)"
      : "transparent",
    border: "none",
    "border-radius": `${tokens.radius.sm} ${tokens.radius.sm} 0 0`,
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast)",
    position: "relative",
    "max-width": "180px",
    "white-space": "nowrap",
    overflow: "hidden",
  });

  const groupTabStyle = (
    isActive: boolean,
    isHovered: boolean,
    color?: string
  ): JSX.CSSProperties => ({
    ...getTabStyle(isActive, isHovered),
    "border-left": color ? `3px solid ${color}` : undefined,
    "padding-left": color ? tokens.spacing.sm : tokens.spacing.md,
  });

  const closeButtonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "16px",
    height: "16px",
    padding: "0",
    border: "none",
    background: "transparent",
    color: tokens.colors.icon.inactive,
    cursor: "pointer",
    "border-radius": tokens.radius.sm,
    "flex-shrink": "0",
  };

  const actionButtonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "28px",
    height: "28px",
    padding: "0",
    border: "none",
    background: "transparent",
    color: tokens.colors.icon.default,
    cursor: "pointer",
    "border-radius": tokens.radius.sm,
  };

  const dropdownStyle: JSX.CSSProperties = {
    position: "absolute",
    top: "100%",
    right: "0",
    "margin-top": tokens.spacing.xs,
    background: "var(--jb-popup)",
    border: `1px solid ${tokens.colors.border.default}`,
    "border-radius": tokens.radius.md,
    "box-shadow": "var(--jb-shadow-popup)",
    "min-width": "180px",
    "z-index": "1000",
    padding: tokens.spacing.xs,
  };

  const menuItemStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    width: "100%",
    border: "none",
    background: "transparent",
    color: tokens.colors.text.primary,
    "font-size": "var(--jb-text-body-size)",
    "font-family": "var(--jb-font-ui)",
    cursor: "pointer",
    "border-radius": tokens.radius.sm,
    "text-align": "left",
  };

  const contextMenuStyle: JSX.CSSProperties = {
    position: "fixed",
    left: `${contextMenu.x}px`,
    top: `${contextMenu.y}px`,
    background: "var(--jb-popup)",
    border: `1px solid ${tokens.colors.border.default}`,
    "border-radius": tokens.radius.md,
    "box-shadow": "var(--jb-shadow-popup)",
    "min-width": "160px",
    "z-index": "10000",
    padding: tokens.spacing.xs,
  };

  const activeIndicatorStyle: JSX.CSSProperties = {
    position: "absolute",
    bottom: "-1px",
    left: "0",
    right: "0",
    height: "2px",
    background: tokens.colors.semantic.primary,
    "border-radius": "1px 1px 0 0",
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div class={props.class} style={containerStyle}>
      {/* Tab Bar */}
      <div style={tabBarStyle}>
        <div style={tabsContainerStyle}>
          {/* Group Tabs */}
          <For each={state.groups}>
            {(group) => {
              const isActive = () => state.activeGroupId === group.id;
              const isHovered = () => hoveredTabId() === `group-${group.id}`;
              const isEditing = () => editingGroupId() === group.id;
              const isDragOver = () =>
                dragState.dragOverId === group.id && dragState.dragOverType === "group";

              return (
                <div
                  style={{
                    ...groupTabStyle(isActive(), isHovered() || isDragOver(), group.color),
                    outline: isDragOver() ? `2px dashed ${tokens.colors.semantic.primary}` : undefined,
                  }}
                  draggable={!isEditing()}
                  onClick={() => handleSelectGroup(group.id)}
                  onContextMenu={(e) => handleContextMenu(e, "group", group.id)}
                  onMouseEnter={() => setHoveredTabId(`group-${group.id}`)}
                  onMouseLeave={() => setHoveredTabId(null)}
                  onDragStart={(e) => handleDragStart(e, "group", group.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, "group", group.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, "group", group.id)}
                >
                  <Icon
                    name="columns"
                    style={{
                      width: "14px",
                      height: "14px",
                      color: group.color || tokens.colors.icon.default,
                      "flex-shrink": "0",
                    }}
                  />
                  <Show
                    when={!isEditing()}
                    fallback={
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingName()}
                        onInput={(e) => setEditingName(e.currentTarget.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={finishRenaming}
                        style={{
                          width: "80px",
                          padding: "2px 4px",
                          border: `1px solid ${tokens.colors.border.focus}`,
                          "border-radius": tokens.radius.sm,
                          background: "var(--jb-input-bg)",
                          color: tokens.colors.text.primary,
                          "font-size": "inherit",
                          "font-family": "inherit",
                          outline: "none",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    }
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                      }}
                    >
                      {group.name}
                    </span>
                    <span
                      style={{
                        color: tokens.colors.text.muted,
                        "font-size": "11px",
                        "margin-left": tokens.spacing.xs,
                      }}
                    >
                      ({group.terminalIds.length})
                    </span>
                  </Show>
                  <Show when={isActive()}>
                    <div style={activeIndicatorStyle} />
                  </Show>
                </div>
              );
            }}
          </For>

          {/* Ungrouped Terminal Tabs */}
          <For each={ungroupedTerminals()}>
            {(terminal) => {
              const isActive = () => state.activeTerminalId === terminal.id && !state.activeGroupId;
              const isHovered = () => hoveredTabId() === terminal.id;
              const isDragOver = () =>
                dragState.dragOverId === terminal.id && dragState.dragOverType === "terminal";

              return (
                <div
                  style={{
                    ...getTabStyle(isActive(), isHovered() || isDragOver()),
                    outline: isDragOver() ? `2px dashed ${tokens.colors.semantic.primary}` : undefined,
                  }}
                  draggable
                  onClick={() => handleSelectTerminal(terminal.id)}
                  onContextMenu={(e) => handleContextMenu(e, "terminal", terminal.id)}
                  onMouseEnter={() => setHoveredTabId(terminal.id)}
                  onMouseLeave={() => setHoveredTabId(null)}
                  onDragStart={(e) => handleDragStart(e, "terminal", terminal.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, "terminal", terminal.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, "terminal", terminal.id)}
                >
                  <Icon
                    name="terminal"
                    style={{
                      width: "14px",
                      height: "14px",
                      color: terminal.status === "running"
                        ? tokens.colors.semantic.success
                        : tokens.colors.icon.inactive,
                      "flex-shrink": "0",
                    }}
                  />
                  <span
                    style={{
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                    }}
                  >
                    {terminal.name}
                  </span>
                  <button
                    style={closeButtonStyle}
                    onClick={(e) => handleCloseTerminal(e, terminal.id)}
                    title="Close terminal"
                  >
                    <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
                  </button>
                  <Show when={isActive()}>
                    <div style={activeIndicatorStyle} />
                  </Show>
                </div>
              );
            }}
          </For>

          {/* Drop Zone for New Group */}
          <Show when={dragState.isDragging && dragState.dragType === "terminal"}>
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
                "border-radius": tokens.radius.sm,
                border: `2px dashed ${
                  dragState.dragOverType === "new-group"
                    ? tokens.colors.semantic.primary
                    : tokens.colors.border.divider
                }`,
                background:
                  dragState.dragOverType === "new-group"
                    ? `color-mix(in srgb, ${tokens.colors.semantic.primary} 10%, transparent)`
                    : "transparent",
                color: tokens.colors.text.muted,
                "font-size": "12px",
                "margin-left": tokens.spacing.sm,
              }}
              onDragOver={(e) => handleDragOver(e, "new-group")}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, "new-group")}
              >
                <Icon name="plus" style={{ width: "14px", height: "14px", "margin-right": "4px" }} />
                New Group
              </div>
          </Show>
        </div>

        {/* Actions */}
        <div style={actionsStyle}>
          {/* Split Terminal Button */}
          <Show when={state.activeTerminalId}>
            <button
              style={actionButtonStyle}
              onClick={() => handleSplitTerminal(state.activeTerminalId!)}
              title="Split Terminal (Ctrl+Shift+5)"
            >
              <Icon name="columns" style={{ width: "16px", height: "16px" }} />
            </button>
          </Show>

          {/* New Terminal Dropdown */}
          <div style={{ position: "relative" }}>
            <button
              style={actionButtonStyle}
              onClick={() => setShowNewDropdown(!showNewDropdown())}
              title="New Terminal"
            >
              <Icon name="plus" style={{ width: "16px", height: "16px" }} />
              <Icon name="chevron-down" style={{ width: "12px", height: "12px", "margin-left": "-4px" }} />
            </button>
            <Show when={showNewDropdown()}>
              <div ref={newDropdownRef} style={dropdownStyle}>
                <button
                  style={menuItemStyle}
                  onClick={handleNewTerminal}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jb-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Icon name="terminal" style={{ width: "14px", height: "14px" }} />
                  New Terminal
                </button>
                <button
                  style={menuItemStyle}
                  onClick={handleNewGroup}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jb-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Icon name="columns" style={{ width: "14px", height: "14px" }} />
                  New Terminal Group
                </button>
                <Show when={state.groups.length > 0}>
                  <div
                    style={{
                      height: "1px",
                      background: tokens.colors.border.divider,
                      margin: `${tokens.spacing.xs} 0`,
                    }}
                  />
                  <For each={state.groups}>
                    {(group) => (
                      <button
                        style={menuItemStyle}
                        onClick={() => handleNewTerminalInGroup(group.id)}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jb-surface-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Icon name="plus" style={{ width: "14px", height: "14px", color: group.color }} />
                        Add to {group.name}
                      </button>
                    )}
                  </For>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Group Terminal Indicators (for active group) */}
      <Show when={state.activeGroupId && activeGroupTerminals().length > 1}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.xs,
            padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
            background: "var(--jb-surface-panel)",
            "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          }}
        >
          <For each={activeGroupTerminals()}>
            {(terminal) => {
              const isActive = () => state.activeTerminalId === terminal.id;
              return (
                <button
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: tokens.spacing.xs,
                    padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
                    background: isActive() ? "var(--jb-surface-hover)" : "transparent",
                    border: isActive() ? `1px solid ${tokens.colors.border.focus}` : "1px solid transparent",
                    "border-radius": tokens.radius.sm,
                    color: isActive() ? tokens.colors.text.primary : tokens.colors.text.muted,
                    "font-size": "12px",
                    cursor: "pointer",
                  }}
                  onClick={() => handleSelectTerminal(terminal.id)}
                  onContextMenu={(e) => handleContextMenu(e, "terminal", terminal.id)}
                >
                  <Icon
                    name="terminal"
                    style={{
                      width: "12px",
                      height: "12px",
                      color: terminal.status === "running"
                        ? tokens.colors.semantic.success
                        : tokens.colors.icon.inactive,
                    }}
                  />
                  <span>{terminal.name}</span>
                  <button
                    style={{
                      ...closeButtonStyle,
                      width: "14px",
                      height: "14px",
                    }}
                    onClick={(e) => handleCloseTerminal(e, terminal.id)}
                  >
                    <Icon name="xmark" style={{ width: "10px", height: "10px" }} />
                  </button>
                </button>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Context Menu */}
      <Show when={contextMenu.visible}>
        <div style={contextMenuStyle} onMouseDown={(e) => e.stopPropagation()}>
          <Show when={contextMenu.type === "terminal"}>
            <button
              style={menuItemStyle}
              onClick={() => handleContextMenuAction("split-horizontal")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jb-surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="columns" style={{ width: "14px", height: "14px" }} />
              Split Right
            </button>
            <button
              style={menuItemStyle}
              onClick={() => handleContextMenuAction("split-vertical")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jb-surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="columns" style={{ width: "14px", height: "14px", transform: "rotate(90deg)" }} />
              Split Down
            </button>
            <div
              style={{
                height: "1px",
                background: tokens.colors.border.divider,
                margin: `${tokens.spacing.xs} 0`,
              }}
            />
            <button
              style={menuItemStyle}
              onClick={() => handleContextMenuAction("move-to-new-group")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jb-surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="maximize" style={{ width: "14px", height: "14px" }} />
              Move to New Group
            </button>
            <Show when={getGroupForTerminal(contextMenu.targetId!)}>
              <button
                style={menuItemStyle}
                onClick={() => handleContextMenuAction("ungroup")}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jb-surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Icon name="minimize" style={{ width: "14px", height: "14px" }} />
                Ungroup
              </button>
            </Show>
            <div
              style={{
                height: "1px",
                background: tokens.colors.border.divider,
                margin: `${tokens.spacing.xs} 0`,
              }}
            />
            <button
              style={menuItemStyle}
              onClick={() => handleContextMenuAction("close")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jb-surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
              Close Terminal
            </button>
          </Show>
          <Show when={contextMenu.type === "group"}>
            <button
              style={menuItemStyle}
              onClick={() => handleContextMenuAction("rename-group")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jb-surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="pen" style={{ width: "14px", height: "14px" }} />
              Rename Group
            </button>
            <button
              style={menuItemStyle}
              onClick={() => handleContextMenuAction("delete-group")}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jb-surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="trash" style={{ width: "14px", height: "14px" }} />
              Delete Group
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export default TerminalGroupTabs;
