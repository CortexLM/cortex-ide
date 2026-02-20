/**
 * =============================================================================
 * TERMINAL SPLIT VIEW - Resizable terminal split panes
 * =============================================================================
 *
 * Provides split terminal functionality with:
 * - Horizontal split (side-by-side terminals)
 * - Vertical split (top-bottom terminals)
 * - Resizable split panes with drag handles
 * - Double-click to reset ratio
 * - Focus management between splits
 * - Min/max size constraints
 *
 * Usage:
 *   <TerminalSplitView
 *     group={splitGroup}
 *     terminals={terminals}
 *     activeTerminalId={activeId}
 *     onSelectTerminal={handleSelect}
 *     onSplitRatioChange={handleRatioChange}
 *   />
 * =============================================================================
 */

import {
  createSignal,
  createEffect,
  createMemo,
  For,
  Show,
  onMount,
  onCleanup,
  JSX,
} from "solid-js";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";
import { useResize } from "@/layout/hooks/useResize";
import type { TerminalInfo } from "@/types/terminal";

// =============================================================================
// TYPES
// =============================================================================

export type SplitDirection = "horizontal" | "vertical";

export interface TerminalSplitGroup {
  /** Unique group identifier */
  id: string;
  /** Terminal IDs in this split group (ordered) */
  terminalIds: string[];
  /** Split direction: horizontal (side-by-side) or vertical (top-bottom) */
  direction: SplitDirection;
  /** Split ratios for each pane (sum should be 1.0) */
  ratios: number[];
  /** Parent group ID for nested splits */
  parentId?: string;
}

export interface TerminalSplitState {
  /** All split groups */
  groups: TerminalSplitGroup[];
  /** Active group ID */
  activeGroupId: string | null;
  /** Focused terminal ID within active group */
  focusedTerminalId: string | null;
}

export interface TerminalSplitViewProps {
  /** Split group configuration */
  group: TerminalSplitGroup;
  /** All terminal instances */
  terminals: TerminalInfo[];
  /** Currently active/focused terminal ID */
  activeTerminalId: string | null;
  /** Callback when terminal is selected/focused */
  onSelectTerminal: (id: string) => void;
  /** Callback when terminal is closed */
  onCloseTerminal: (id: string) => void;
  /** Callback when split ratio changes */
  onSplitRatioChange: (groupId: string, index: number, ratio: number) => void;
  /** Callback when split direction changes */
  onDirectionChange?: (groupId: string, direction: SplitDirection) => void;
  /** Minimum pane size in pixels */
  minPaneSize?: number;
  /** Whether to show pane headers */
  showHeaders?: boolean;
  /** Render function for terminal content */
  renderTerminal: (terminal: TerminalInfo, isActive: boolean) => JSX.Element;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MIN_PANE_SIZE = 100;
const SASH_SIZE = 4;
const SASH_HOVER_SIZE = 8;

// =============================================================================
// SASH (DIVIDER) COMPONENT
// =============================================================================

interface SashProps {
  direction: SplitDirection;
  position: number; // Position in pixels from start
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  onDoubleClick?: () => void;
}

function Sash(props: SashProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const [isDragging, setIsDragging] = createSignal(false);

  const { startResize, isResizing: _isResizing, handleKeyDown } = useResize({
    direction: props.direction,
    onResize: props.onResize,
    onResizeStart: () => {
      setIsDragging(true);
      props.onResizeStart?.();
    },
    onResizeEnd: () => {
      setIsDragging(false);
      props.onResizeEnd?.();
    },
  });

  const isHorizontal = () => props.direction === "horizontal";

  const sashStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    [isHorizontal() ? "left" : "top"]: `${props.position}px`,
    [isHorizontal() ? "top" : "left"]: "0",
    [isHorizontal() ? "width" : "height"]: `${SASH_SIZE}px`,
    [isHorizontal() ? "height" : "width"]: "100%",
    transform: isHorizontal() ? "translateX(-50%)" : "translateY(-50%)",
    cursor: isHorizontal() ? "col-resize" : "row-resize",
    "z-index": "100",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
  });

  const hitAreaStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    [isHorizontal() ? "width" : "height"]: `${SASH_HOVER_SIZE}px`,
    [isHorizontal() ? "height" : "width"]: "100%",
    background: "transparent",
  });

  const lineStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    [isHorizontal() ? "width" : "height"]: "2px",
    [isHorizontal() ? "height" : "width"]: "100%",
    background: isDragging() || isHovered()
      ? tokens.colors.accent.primary
      : tokens.colors.border.default,
    transition: "background 150ms ease",
    "border-radius": "var(--cortex-radius-sm)",
  });

  return (
    <div
      style={sashStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={startResize}
      onTouchStart={startResize}
      onDblClick={props.onDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="separator"
      aria-orientation={props.direction}
      aria-label="Resize split panes"
    >
      <div style={hitAreaStyle()} />
      <div style={lineStyle()} />
    </div>
  );
}

// =============================================================================
// PANE HEADER COMPONENT
// =============================================================================

interface PaneHeaderProps {
  terminal: TerminalInfo;
  isActive: boolean;
  isOnly: boolean;
  onClose: () => void;
  onMaximize?: () => void;
}

function PaneHeader(props: PaneHeaderProps) {
  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    height: "24px",
    padding: `0 ${tokens.spacing.sm}`,
    background: props.isActive
      ? tokens.colors.surface.popup
      : tokens.colors.surface.panel,
    "border-bottom": `1px solid ${tokens.colors.border.default}`,
    "font-size": "11px",
    color: props.isActive ? tokens.colors.text.primary : tokens.colors.text.muted,
    "user-select": "none",
    transition: "background 150ms ease, color 150ms ease",
  });

  const titleStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
    "font-weight": props.isActive ? "500" : "400",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.xs,
  };

  const buttonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "18px",
    height: "18px",
    "border-radius": tokens.radius.sm,
    background: "transparent",
    border: "none",
    color: tokens.colors.icon.default,
    cursor: "pointer",
    opacity: "0.7",
    transition: "opacity 150ms ease, background 150ms ease",
  };

  return (
    <div style={headerStyle()}>
      <span style={titleStyle}>{props.terminal.name}</span>
      <div style={actionsStyle}>
        <Show when={props.onMaximize && !props.isOnly}>
          <button
            style={buttonStyle}
            onClick={props.onMaximize}
            title="Maximize pane"
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.background = tokens.colors.interactive.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.7";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Icon name="maximize" size={12} />
          </button>
        </Show>
        <Show when={!props.isOnly}>
          <button
            style={buttonStyle}
            onClick={props.onClose}
            title="Close pane"
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.background = `color-mix(in srgb, ${tokens.colors.semantic.error} 20%, transparent)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.7";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Icon name="xmark" size={12} />
          </button>
        </Show>
      </div>
    </div>
  );
}

// =============================================================================
// TERMINAL SPLIT VIEW COMPONENT
// =============================================================================

export function TerminalSplitView(props: TerminalSplitViewProps) {
  const [containerSize, setContainerSize] = createSignal({ width: 0, height: 0 });
  const [isResizing, setIsResizing] = createSignal(false);

  let containerRef: HTMLDivElement | undefined;
  let resizeObserver: ResizeObserver | undefined;

  const minPaneSize = () => props.minPaneSize ?? DEFAULT_MIN_PANE_SIZE;
  const isHorizontal = () => props.group.direction === "horizontal";

  // Get terminals in group order
  const terminalsInGroup = createMemo(() =>
    props.group.terminalIds
      .map((id) => props.terminals.find((t) => t.id === id))
      .filter((t): t is TerminalInfo => t !== undefined)
  );

  // Normalize ratios to sum to 1
  const normalizedRatios = createMemo(() => {
    const ratios = props.group.ratios;
    const terminalCount = terminalsInGroup().length;

    if (ratios.length !== terminalCount) {
      // Generate equal ratios if mismatch
      return Array(terminalCount).fill(1 / terminalCount);
    }

    const sum = ratios.reduce((a, b) => a + b, 0);
    return sum === 0 ? ratios.map(() => 1 / terminalCount) : ratios.map((r) => r / sum);
  });

  // Calculate pane sizes in pixels
  const paneSizes = createMemo(() => {
    const size = isHorizontal() ? containerSize().width : containerSize().height;
    const numSashes = terminalsInGroup().length - 1;
    const availableSize = size - numSashes * SASH_SIZE;
    const ratios = normalizedRatios();

    return ratios.map((ratio) => Math.max(minPaneSize(), availableSize * ratio));
  });

  // Calculate sash positions
  const sashPositions = createMemo(() => {
    const sizes = paneSizes();
    const positions: number[] = [];
    let cumulative = 0;

    for (let i = 0; i < sizes.length - 1; i++) {
      cumulative += sizes[i] + SASH_SIZE / 2;
      positions.push(cumulative);
      cumulative += SASH_SIZE / 2;
    }

    return positions;
  });

  // Update container size
  onMount(() => {
    if (!containerRef) return;

    const updateSize = () => {
      const rect = containerRef!.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    updateSize();

    resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef);
  });

  onCleanup(() => {
    resizeObserver?.disconnect();
  });

  // Handle sash resize
  const handleSashResize = (index: number, delta: number) => {
    const size = isHorizontal() ? containerSize().width : containerSize().height;
    const numSashes = terminalsInGroup().length - 1;
    const availableSize = size - numSashes * SASH_SIZE;

    if (availableSize <= 0) return;

    const currentRatios = [...normalizedRatios()];
    const deltaRatio = delta / availableSize;

    // Adjust ratios for the two affected panes
    let newRatio1 = currentRatios[index] + deltaRatio;
    let newRatio2 = currentRatios[index + 1] - deltaRatio;

    // Apply minimum size constraints
    const minRatio = minPaneSize() / availableSize;
    if (newRatio1 < minRatio) {
      const diff = minRatio - newRatio1;
      newRatio1 = minRatio;
      newRatio2 -= diff;
    }
    if (newRatio2 < minRatio) {
      const diff = minRatio - newRatio2;
      newRatio2 = minRatio;
      newRatio1 -= diff;
    }

    // Notify parent of ratio change
    props.onSplitRatioChange(props.group.id, index, newRatio1);
    props.onSplitRatioChange(props.group.id, index + 1, newRatio2);
  };

  // Reset ratio to equal distribution on double-click
  const handleSashDoubleClick = (_index: number) => {
    const terminalCount = terminalsInGroup().length;
    const equalRatio = 1 / terminalCount;

    for (let i = 0; i < terminalCount; i++) {
      props.onSplitRatioChange(props.group.id, i, equalRatio);
    }
  };

  const containerStyle = (): JSX.CSSProperties => ({
    position: "relative",
    display: "flex",
    "flex-direction": isHorizontal() ? "row" : "column",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    "user-select": isResizing() ? "none" : "auto",
  });

  const paneStyle = (index: number): JSX.CSSProperties => {
    const size = paneSizes()[index];
    return {
      position: "relative",
      display: "flex",
      "flex-direction": "column",
      [isHorizontal() ? "width" : "height"]: `${size}px`,
      [isHorizontal() ? "height" : "width"]: "100%",
      "flex-shrink": "0",
      overflow: "hidden",
    };
  };

  const terminalContentStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "hidden",
    position: "relative",
  };

  const focusIndicatorStyle = (isActive: boolean): JSX.CSSProperties => ({
    position: "absolute",
    top: "0",
    left: "0",
    right: "0",
    height: "2px",
    background: isActive ? tokens.colors.accent.primary : "transparent",
    transition: "background 150ms ease",
    "z-index": "10",
  });

  return (
    <div ref={containerRef} style={containerStyle()}>
      <For each={terminalsInGroup()}>
        {(terminal, index) => (
          <div
            style={paneStyle(index())}
            onClick={() => props.onSelectTerminal(terminal.id)}
            data-terminal-pane={terminal.id}
          >
            {/* Focus indicator */}
            <div style={focusIndicatorStyle(props.activeTerminalId === terminal.id)} />

            {/* Pane header (optional) */}
            <Show when={props.showHeaders}>
              <PaneHeader
                terminal={terminal}
                isActive={props.activeTerminalId === terminal.id}
                isOnly={terminalsInGroup().length === 1}
                onClose={() => props.onCloseTerminal(terminal.id)}
              />
            </Show>

            {/* Terminal content */}
            <div style={terminalContentStyle}>
              {props.renderTerminal(terminal, props.activeTerminalId === terminal.id)}
            </div>
          </div>
        )}
      </For>

      {/* Sashes between panes */}
      <For each={sashPositions()}>
        {(position, index) => (
          <Sash
            direction={props.group.direction}
            position={position}
            onResize={(delta) => handleSashResize(index(), delta)}
            onResizeStart={() => setIsResizing(true)}
            onResizeEnd={() => setIsResizing(false)}
            onDoubleClick={() => handleSashDoubleClick(index())}
          />
        )}
      </For>
    </div>
  );
}

// =============================================================================
// SPLIT TOOLBAR BUTTON
// =============================================================================

interface SplitButtonProps {
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  disabled?: boolean;
}

export function SplitButton(props: SplitButtonProps) {
  const [showMenu, setShowMenu] = createSignal(false);
  let menuRef: HTMLDivElement | undefined;
  let buttonRef: HTMLButtonElement | undefined;

  // Close menu on click outside
  createEffect(() => {
    if (!showMenu()) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef &&
        !menuRef.contains(e.target as Node) &&
        buttonRef &&
        !buttonRef.contains(e.target as Node)
      ) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
  });

  const buttonStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "24px",
    height: "24px",
    "border-radius": tokens.radius.sm,
    background: showMenu() ? tokens.colors.interactive.hover : "transparent",
    border: "none",
    color: tokens.colors.icon.default,
    cursor: props.disabled ? "not-allowed" : "pointer",
    opacity: props.disabled ? "0.5" : "1",
    transition: "background 150ms ease",
  });

  const menuStyle: JSX.CSSProperties = {
    position: "absolute",
    top: "100%",
    right: "0",
    "margin-top": tokens.spacing.xs,
    background: tokens.colors.surface.popup,
    border: `1px solid ${tokens.colors.border.default}`,
    "border-radius": tokens.radius.md,
    "box-shadow": tokens.shadows.popup,
    "z-index": "1000",
    "min-width": "160px",
    overflow: "hidden",
  };

  const menuItemStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    background: "transparent",
    border: "none",
    width: "100%",
    "text-align": "left",
    color: tokens.colors.text.primary,
    "font-size": "13px",
    cursor: "pointer",
    transition: "background 150ms ease",
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        style={buttonStyle()}
        onClick={() => !props.disabled && setShowMenu(!showMenu())}
        disabled={props.disabled}
        title="Split Terminal"
        onMouseEnter={(e) => {
          if (!props.disabled) {
            e.currentTarget.style.background = tokens.colors.interactive.hover;
          }
        }}
        onMouseLeave={(e) => {
          if (!showMenu()) {
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        <Icon name="columns" size={14} />
      </button>

      <Show when={showMenu()}>
        <div ref={menuRef} style={menuStyle}>
          <button
            style={menuItemStyle}
            onClick={() => {
              props.onSplitHorizontal();
              setShowMenu(false);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.colors.interactive.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
<Icon name="columns" size={14} />
            <span>Split Right</span>
            <span style={{ "margin-left": "auto", color: tokens.colors.text.muted, "font-size": "11px" }}>
              Ctrl+Shift+5
            </span>
          </button>
          <button
            style={menuItemStyle}
            onClick={() => {
              props.onSplitVertical();
              setShowMenu(false);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.colors.interactive.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Icon name="ellipsis-vertical" size={14} style={{ transform: "rotate(90deg)" }} />
            <span>Split Down</span>
          </button>
        </div>
      </Show>
    </div>
  );
}

export default TerminalSplitView;

