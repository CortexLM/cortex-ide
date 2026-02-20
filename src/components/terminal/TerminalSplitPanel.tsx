/**
 * =============================================================================
 * TERMINAL SPLIT PANEL - Integrated terminal split container
 * =============================================================================
 *
 * A complete terminal split panel that integrates with TerminalsContext.
 * Provides:
 * - Split terminal functionality with resizable panes
 * - Tab bar for switching between terminals/groups
 * - Toolbar with split and close actions
 * - Keyboard shortcuts for split navigation
 * - Focus management between splits
 *
 * Usage:
 *   <TerminalSplitPanel
 *     terminalInstances={instances}
 *     onInitializeTerminal={initFn}
 *     onDisposeTerminal={disposeFn}
 *   />
 * =============================================================================
 */

import {
  createSignal,
  createMemo,
  For,
  Show,
  onMount,
  onCleanup,
  JSX,
  Accessor,
} from "solid-js";
import { Icon } from "../ui/Icon";
import { useTerminals } from "@/context/TerminalsContext";
import { tokens } from "@/design-system/tokens";
import type { TerminalInfo, TerminalGroup, TerminalSplitDirection } from "@/types/terminal";
import { TerminalSplitView, SplitButton } from "./TerminalSplitView";

// =============================================================================
// TYPES
// =============================================================================

export interface TerminalSplitPanelProps {
  /** Map of terminal IDs to xterm instances for rendering */
  getTerminalContainer: (terminalId: string) => HTMLElement | null;
  /** Initialize a terminal in a container */
  onInitializeTerminal: (terminal: TerminalInfo, container: HTMLElement) => void;
  /** Dispose a terminal instance */
  onDisposeTerminal: (terminalId: string) => void;
  /** Callback when panel should be closed */
  onClosePanel?: () => void;
  /** Whether the panel is focused */
  isFocused?: Accessor<boolean>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TAB_HEIGHT = 35;
const TOOLBAR_HEIGHT = 28;

// =============================================================================
// TAB COMPONENT
// =============================================================================

interface TabProps {
  terminal: TerminalInfo;
  group?: TerminalGroup;
  isActive: boolean;
  isInSplit: boolean;
  onSelect: () => void;
  onClose: (e: MouseEvent) => void;
  onSplit: (direction: TerminalSplitDirection) => void;
  onContextMenu?: (e: MouseEvent) => void;
}

function Tab(props: TabProps) {
  const [isHovered, setIsHovered] = createSignal(false);

  const displayName = () => {
    if (props.isInSplit && props.group) {
      return props.group.name;
    }
    return props.terminal.name;
  };

  const tabStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    height: `${TAB_HEIGHT - 1}px`,
    padding: `0 ${tokens.spacing.md}`,
    background: props.isActive
      ? tokens.colors.surface.panel
      : isHovered()
      ? tokens.colors.interactive.hover
      : "transparent",
    "border-right": `1px solid ${tokens.colors.border.default}`,
    "border-bottom": props.isActive ? "none" : `1px solid ${tokens.colors.border.default}`,
    color: props.isActive ? tokens.colors.text.primary : tokens.colors.text.muted,
    cursor: "pointer",
    "user-select": "none",
    "white-space": "nowrap",
    "font-size": "12px",
    position: "relative",
    transition: "background 150ms ease, color 150ms ease",
  });

  const iconStyle = (): JSX.CSSProperties => ({
    width: "14px",
    height: "14px",
    color: props.terminal.status === "running"
      ? tokens.colors.semantic.success
      : tokens.colors.text.muted,
  });

  const closeButtonStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "16px",
    height: "16px",
    "border-radius": tokens.radius.sm,
    background: "transparent",
    border: "none",
    color: tokens.colors.icon.default,
    cursor: "pointer",
    opacity: isHovered() || props.isActive ? "1" : "0",
    transition: "opacity 150ms ease, background 150ms ease",
  });

  const activeIndicatorStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    bottom: "0",
    left: "0",
    right: "0",
    height: "2px",
    background: props.isActive ? tokens.colors.accent.primary : "transparent",
  });

  return (
    <div
      style={tabStyle()}
      onClick={props.onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={props.onContextMenu}
      role="tab"
      aria-selected={props.isActive}
      tabIndex={props.isActive ? 0 : -1}
    >
      <Icon name="terminal" style={iconStyle()} />
      <span style={{ flex: "1", overflow: "hidden", "text-overflow": "ellipsis" }}>
        {displayName()}
      </span>
      <Show when={props.isInSplit && props.group}>
        <span style={{ color: tokens.colors.text.muted, "font-size": "10px" }}>
          ({props.group!.terminalIds.length})
        </span>
      </Show>
      <button
        style={closeButtonStyle()}
        onClick={(e) => {
          e.stopPropagation();
          props.onClose(e);
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `color-mix(in srgb, ${tokens.colors.semantic.error} 20%, transparent)`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
        title="Close terminal"
      >
        <Icon name="xmark" size={12} />
      </button>
      <div style={activeIndicatorStyle()} />
    </div>
  );
}

// =============================================================================
// TOOLBAR COMPONENT
// =============================================================================

interface ToolbarProps {
  activeTerminal: TerminalInfo | undefined;
  activeGroup: TerminalGroup | undefined;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onKillProcess: () => void;
  onNewTerminal: () => void;
}

function Toolbar(props: ToolbarProps) {
  const toolbarStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    height: `${TOOLBAR_HEIGHT}px`,
    padding: `0 ${tokens.spacing.sm}`,
    background: tokens.colors.surface.panel,
    "border-bottom": `1px solid ${tokens.colors.border.default}`,
  };

  const leftStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.xs,
  };

  const rightStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.xs,
  };

  const buttonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "24px",
    height: "24px",
    "border-radius": tokens.radius.sm,
    background: "transparent",
    border: "none",
    color: tokens.colors.icon.default,
    cursor: "pointer",
    transition: "background 150ms ease",
  };

  return (
    <div style={toolbarStyle}>
      <div style={leftStyle}>
        <Show when={props.activeTerminal}>
          <span style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
            {props.activeTerminal!.cwd}
          </span>
        </Show>
      </div>
      <div style={rightStyle}>
        <SplitButton
          onSplitHorizontal={props.onSplitHorizontal}
          onSplitVertical={props.onSplitVertical}
          disabled={!props.activeTerminal}
        />
        <button
          style={buttonStyle}
          onClick={props.onKillProcess}
          disabled={!props.activeTerminal}
          title="Kill process (Ctrl+C)"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = tokens.colors.interactive.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Icon name="stop" size={12} />
        </button>
        <button
          style={buttonStyle}
          onClick={props.onNewTerminal}
          title="New terminal (Ctrl+Shift+`)"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = tokens.colors.interactive.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// TERMINAL SPLIT PANEL COMPONENT
// =============================================================================

export function TerminalSplitPanel(props: TerminalSplitPanelProps) {
  const {
    state,
    createTerminal,
    closeTerminal,
    setActiveTerminal,
    sendInterrupt,
    getGroupForTerminal,
    splitTerminalInGroup,
    setGroupSplitRatios,
    removeFromGroup,
    setActiveGroup,
  } = useTerminals();

  const [containerRef, setContainerRef] = createSignal<HTMLDivElement>();
  void containerRef; // Used in ref={setContainerRef}

  // Get active terminal and group
  const activeTerminal = createMemo(() =>
    state.terminals.find((t) => t.id === state.activeTerminalId)
  );

  const activeGroup = createMemo(() => {
    const terminalId = state.activeTerminalId;
    if (!terminalId) return undefined;
    return getGroupForTerminal(terminalId);
  });

  // Get terminals not in any group (for tab display)
  const ungroupedTerminals = createMemo(() => {
    const groupedIds = new Set(
      state.groups.flatMap((g) => g.terminalIds)
    );
    return state.terminals.filter((t) => !groupedIds.has(t.id));
  });

  // Get first terminal from each group (for tab display)
  const groupFirstTerminals = createMemo(() => {
    return state.groups
      .map((g) => ({
        group: g,
        terminal: state.terminals.find((t) => t.id === g.terminalIds[0]),
      }))
      .filter((item): item is { group: TerminalGroup; terminal: TerminalInfo } =>
        item.terminal !== undefined
      );
  });

  // Handle split operations
  const handleSplitHorizontal = async () => {
    const activeId = state.activeTerminalId;
    if (!activeId) return;
    await splitTerminalInGroup(activeId, "horizontal");
  };

  const handleSplitVertical = async () => {
    const activeId = state.activeTerminalId;
    if (!activeId) return;
    await splitTerminalInGroup(activeId, "vertical");
  };

  // Handle terminal close
  const handleCloseTerminal = async (terminalId: string) => {
    // Remove from group first
    removeFromGroup(terminalId);
    
    // Then close the terminal
    props.onDisposeTerminal(terminalId);
    await closeTerminal(terminalId);
  };

  // Handle group ratio change
  const handleSplitRatioChange = (groupId: string, index: number, ratio: number) => {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return;

    const newRatios = [...group.splitRatios];
    newRatios[index] = ratio;
    setGroupSplitRatios(groupId, newRatios);
  };

  // Create new terminal
  const handleNewTerminal = async () => {
    const terminal = await createTerminal();
    setActiveTerminal(terminal.id);
  };

  // Kill process in active terminal
  const handleKillProcess = () => {
    const activeId = state.activeTerminalId;
    if (activeId) {
      sendInterrupt(activeId);
    }
  };

  // Render terminal content
  const renderTerminal = (terminal: TerminalInfo, _isActive: boolean): JSX.Element => {
    return (
      <div
        data-terminal-pane-content={terminal.id}
        style={{
          width: "100%",
          height: "100%",
          background: tokens.colors.surface.canvas,
        }}
        ref={(el) => {
          // Initialize terminal when container is available
          if (el) {
            requestAnimationFrame(() => {
              props.onInitializeTerminal(terminal, el);
            });
          }
        }}
      />
    );
  };

  // Keyboard shortcuts
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { key, ctrlKey, shiftKey, altKey } = e;

      // Ctrl+Shift+5: Split terminal horizontally
      if (ctrlKey && shiftKey && key === "5") {
        e.preventDefault();
        handleSplitHorizontal();
        return;
      }

      // Alt+Arrow: Navigate between splits
      if (altKey && !ctrlKey && !shiftKey) {
        const group = activeGroup();
        if (!group || group.terminalIds.length <= 1) return;

        const currentIndex = group.terminalIds.indexOf(state.activeTerminalId || "");
        let newIndex = currentIndex;

        if (group.splitDirection === "horizontal") {
          if (key === "ArrowLeft" && currentIndex > 0) {
            newIndex = currentIndex - 1;
          } else if (key === "ArrowRight" && currentIndex < group.terminalIds.length - 1) {
            newIndex = currentIndex + 1;
          }
        } else {
          if (key === "ArrowUp" && currentIndex > 0) {
            newIndex = currentIndex - 1;
          } else if (key === "ArrowDown" && currentIndex < group.terminalIds.length - 1) {
            newIndex = currentIndex + 1;
          }
        }

        if (newIndex !== currentIndex) {
          e.preventDefault();
          setActiveTerminal(group.terminalIds[newIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  // Styles
  const panelStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    width: "100%",
    height: "100%",
    background: tokens.colors.surface.canvas,
    overflow: "hidden",
  };

  const tabBarStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "flex-end",
    height: `${TAB_HEIGHT}px`,
    background: tokens.colors.surface.panel,
    "border-bottom": `1px solid ${tokens.colors.border.default}`,
    overflow: "hidden",
  };

  const tabsContainerStyle: JSX.CSSProperties = {
    display: "flex",
    flex: "1",
    overflow: "auto hidden",
    "scrollbar-width": "none",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "hidden",
    position: "relative",
  };

  return (
    <div ref={setContainerRef} style={panelStyle}>
      {/* Tab bar */}
      <div style={tabBarStyle}>
        <div style={tabsContainerStyle} class="no-scrollbar">
          {/* Grouped terminals (show group tab) */}
          <For each={groupFirstTerminals()}>
            {({ group, terminal }) => (
              <Tab
                terminal={terminal}
                group={group}
                isActive={state.activeGroupId === group.id}
                isInSplit={group.terminalIds.length > 1}
                onSelect={() => {
                  setActiveGroup(group.id);
                  setActiveTerminal(terminal.id);
                }}
                onClose={(e) => {
                  e.stopPropagation();
                  // Close all terminals in group
                  group.terminalIds.forEach((id) => handleCloseTerminal(id));
                }}
                onSplit={(direction) => {
                  setActiveTerminal(terminal.id);
                  if (direction === "horizontal") {
                    handleSplitHorizontal();
                  } else {
                    handleSplitVertical();
                  }
                }}
              />
            )}
          </For>

          {/* Ungrouped terminals */}
          <For each={ungroupedTerminals()}>
            {(terminal) => (
              <Tab
                terminal={terminal}
                isActive={state.activeTerminalId === terminal.id && !activeGroup()}
                isInSplit={false}
                onSelect={() => {
                  setActiveGroup(null);
                  setActiveTerminal(terminal.id);
                }}
                onClose={(e) => {
                  e.stopPropagation();
                  handleCloseTerminal(terminal.id);
                }}
                onSplit={(direction) => {
                  setActiveTerminal(terminal.id);
                  if (direction === "horizontal") {
                    handleSplitHorizontal();
                  } else {
                    handleSplitVertical();
                  }
                }}
              />
            )}
          </For>
        </div>

        {/* New terminal button */}
        <button
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            width: `${TAB_HEIGHT - 1}px`,
            height: `${TAB_HEIGHT - 1}px`,
            background: "transparent",
            border: "none",
            color: tokens.colors.icon.default,
            cursor: "pointer",
          }}
          onClick={handleNewTerminal}
          title="New Terminal"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = tokens.colors.interactive.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>

      {/* Toolbar */}
      <Toolbar
        activeTerminal={activeTerminal()}
        activeGroup={activeGroup()}
        onSplitHorizontal={handleSplitHorizontal}
        onSplitVertical={handleSplitVertical}
        onKillProcess={handleKillProcess}
        onNewTerminal={handleNewTerminal}
      />

      {/* Content area */}
      <div style={contentStyle}>
        <Show
          when={activeGroup() && activeGroup()!.terminalIds.length > 1}
          fallback={
            /* Single terminal view */
            <Show when={activeTerminal()}>
              {(terminal) => renderTerminal(terminal(), true)}
            </Show>
          }
        >
          {/* Split view */}
          <TerminalSplitView
            group={{
              id: activeGroup()!.id,
              terminalIds: activeGroup()!.terminalIds,
              direction: activeGroup()!.splitDirection,
              ratios: activeGroup()!.splitRatios,
            }}
            terminals={state.terminals}
            activeTerminalId={state.activeTerminalId}
            onSelectTerminal={setActiveTerminal}
            onCloseTerminal={handleCloseTerminal}
            onSplitRatioChange={handleSplitRatioChange}
            minPaneSize={100}
            showHeaders={true}
            renderTerminal={renderTerminal}
          />
        </Show>

        {/* Empty state */}
        <Show when={state.terminals.length === 0}>
          <div
            style={{
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              "justify-content": "center",
              height: "100%",
              gap: tokens.spacing.md,
              color: tokens.colors.text.muted,
            }}
          >
            <Icon name="terminal" size={48} style={{ opacity: "0.3" }} />
            <span style={{ "font-size": "14px" }}>No terminals open</span>
            <button
              style={{
                padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
                background: tokens.colors.accent.primary,
                border: "none",
                "border-radius": tokens.radius.md,
                color: "var(--cortex-text-primary)",
                cursor: "pointer",
                "font-size": "13px",
              }}
              onClick={handleNewTerminal}
            >
              Create Terminal
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default TerminalSplitPanel;

