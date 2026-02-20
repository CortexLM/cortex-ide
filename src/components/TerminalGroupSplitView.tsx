import {
  Show,
  For,
  createSignal,
  createMemo,
  type JSX,
} from "solid-js";
import { Icon } from "./ui/Icon";
import {
  useTerminals,
  TerminalInfo,
  TerminalGroup,
} from "@/context/TerminalsContext";
import { tokens } from "@/design-system/tokens";

/**
 * TerminalGroupSplitView - Renders terminals in a group side-by-side
 *
 * Features:
 * - Horizontal or vertical split layout
 * - Resizable split panes via drag handle
 * - Visual indicator for active terminal within group
 * - Close button for individual terminals in split
 * - Supports dynamic ratios
 */

interface TerminalGroupSplitViewProps {
  /** The group to render */
  group: TerminalGroup;
  /** Active terminal ID */
  activeTerminalId: string | null;
  /** Callback when a terminal is selected */
  onSelectTerminal?: (terminalId: string) => void;
  /** Callback when a terminal should be closed */
  onCloseTerminal?: (terminalId: string) => void;
  /** Custom class name */
  class?: string;
  /** Custom style */
  style?: JSX.CSSProperties;
}

const MIN_PANE_SIZE = 80; // Minimum pane size in pixels

export function TerminalGroupSplitView(props: TerminalGroupSplitViewProps) {
  const { state, setGroupSplitRatios } = useTerminals();

  // Local state
  const [isResizing, setIsResizing] = createSignal(false);
  const [resizingIndex, setResizingIndex] = createSignal<number | null>(null);

  let containerRef: HTMLDivElement | undefined;

  // Get terminals in this group
  const terminalsInGroup = createMemo(() =>
    props.group.terminalIds
      .map((id) => state.terminals.find((t) => t.id === id))
      .filter((t): t is TerminalInfo => t !== undefined)
  );

  // Check if we're in horizontal or vertical split
  const isHorizontal = () => props.group.splitDirection === "horizontal";

  // Calculate sizes based on ratios
  const getSizeStyle = (index: number): string => {
    const ratios = props.group.splitRatios;
    if (ratios.length === 0 || index >= ratios.length) {
      // Equal distribution if no ratios set
      return `${100 / terminalsInGroup().length}%`;
    }
    return `${ratios[index] * 100}%`;
  };

  // ============================================================================
  // Resize Handlers
  // ============================================================================

  const handleResizeStart = (e: MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!containerRef) return;

    setIsResizing(true);
    setResizingIndex(index);

    const rect = containerRef.getBoundingClientRect();
    const totalSize = isHorizontal() ? rect.width : rect.height;
    const startPos = isHorizontal() ? e.clientX : e.clientY;
    const startRatios = [...props.group.splitRatios];

    // Ensure we have valid ratios
    if (startRatios.length !== terminalsInGroup().length) {
      const count = terminalsInGroup().length;
      startRatios.length = 0;
      for (let i = 0; i < count; i++) {
        startRatios.push(1 / count);
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = isHorizontal() ? e.clientX : e.clientY;
      const delta = currentPos - startPos;
      const deltaRatio = delta / totalSize;

      // Calculate new ratios
      const newRatios = [...startRatios];
      const minRatio = MIN_PANE_SIZE / totalSize;

      // Adjust the pane at index and the one after it
      let newLeftRatio = startRatios[index] + deltaRatio;
      let newRightRatio = startRatios[index + 1] - deltaRatio;

      // Clamp to minimum sizes
      if (newLeftRatio < minRatio) {
        const diff = minRatio - newLeftRatio;
        newLeftRatio = minRatio;
        newRightRatio -= diff;
      }
      if (newRightRatio < minRatio) {
        const diff = minRatio - newRightRatio;
        newRightRatio = minRatio;
        newLeftRatio -= diff;
      }

      // Ensure we don't go below minimum
      newLeftRatio = Math.max(minRatio, newLeftRatio);
      newRightRatio = Math.max(minRatio, newRightRatio);

      newRatios[index] = newLeftRatio;
      newRatios[index + 1] = newRightRatio;

      setGroupSplitRatios(props.group.id, newRatios);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizingIndex(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = isHorizontal() ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };

  // ============================================================================
  // Styles
  // ============================================================================

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": isHorizontal() ? "row" : "column",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    ...props.style,
  });

  const getPaneStyle = (index: number, isActive: boolean): JSX.CSSProperties => ({
    position: "relative",
    overflow: "hidden",
    flex: `0 0 ${getSizeStyle(index)}`,
    "min-width": isHorizontal() ? `${MIN_PANE_SIZE}px` : undefined,
    "min-height": !isHorizontal() ? `${MIN_PANE_SIZE}px` : undefined,
    background: "var(--jb-surface-base)",
    "border-top": isActive ? `2px solid ${tokens.colors.semantic.primary}` : "2px solid transparent",
    transition: isResizing() ? "none" : "border-color var(--cortex-transition-fast)",
  });

  const terminalContainerStyle: JSX.CSSProperties = {
    width: "100%",
    height: "100%",
    position: "relative",
  };

  const resizeHandleStyle = (isDragging: boolean): JSX.CSSProperties => ({
    position: "relative",
    "flex-shrink": "0",
    width: isHorizontal() ? "4px" : "100%",
    height: isHorizontal() ? "100%" : "4px",
    background: isDragging ? tokens.colors.border.focus : "transparent",
    cursor: isHorizontal() ? "col-resize" : "row-resize",
    "z-index": "10",
    transition: "background var(--cortex-transition-fast)",
  });

  const resizeHandleLineStyle: JSX.CSSProperties = {
    position: "absolute",
    background: tokens.colors.border.divider,
    transition: "background var(--cortex-transition-fast)",
    ...(isHorizontal()
      ? {
          width: "1px",
          height: "100%",
          left: "50%",
          transform: "translateX(-50%)",
        }
      : {
          width: "100%",
          height: "1px",
          top: "50%",
          transform: "translateY(-50%)",
        }),
  };

  const closeButtonStyle: JSX.CSSProperties = {
    position: "absolute",
    top: tokens.spacing.sm,
    right: tokens.spacing.sm,
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "20px",
    height: "20px",
    padding: "0",
    border: "none",
    background: "var(--jb-surface-panel)",
    color: tokens.colors.icon.inactive,
    cursor: "pointer",
    "border-radius": tokens.radius.sm,
    opacity: "0",
    transition: "opacity var(--cortex-transition-fast)",
    "z-index": "20",
  };

  const paneOverlayStyle = (isActive: boolean): JSX.CSSProperties => ({
    position: "absolute",
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
    background: "transparent",
    "pointer-events": isActive ? "none" : "auto",
    "z-index": isActive ? "-1" : "5",
  });

  // ============================================================================
  // Render
  // ============================================================================

  // Single terminal - no split view needed
  if (terminalsInGroup().length === 1) {
    const terminal = terminalsInGroup()[0];
    return (
      <div class={props.class} style={containerStyle()}>
        <div
          style={{
            ...terminalContainerStyle,
            "border-top": `2px solid ${tokens.colors.semantic.primary}`,
          }}
          data-terminal-id={terminal.id}
          data-terminal-group-pane="true"
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} class={props.class} style={containerStyle()}>
      <For each={terminalsInGroup()}>
        {(terminal, index) => {
          const isActive = () => props.activeTerminalId === terminal.id;
          const isLast = () => index() === terminalsInGroup().length - 1;
          const isDragging = () => resizingIndex() === index();

          return (
            <>
              <div
                style={getPaneStyle(index(), isActive())}
                onClick={() => props.onSelectTerminal?.(terminal.id)}
                onMouseEnter={(e) => {
                  const closeBtn = e.currentTarget.querySelector(
                    "[data-close-btn]"
                  ) as HTMLElement;
                  if (closeBtn) closeBtn.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  const closeBtn = e.currentTarget.querySelector(
                    "[data-close-btn]"
                  ) as HTMLElement;
                  if (closeBtn) closeBtn.style.opacity = "0";
                }}
              >
                {/* Terminal container - xterm will be mounted here */}
                <div
                  style={terminalContainerStyle}
                  data-terminal-id={terminal.id}
                  data-terminal-group-pane="true"
                />

                {/* Click overlay for non-active panes */}
                <div
                  style={paneOverlayStyle(isActive())}
                  onClick={() => props.onSelectTerminal?.(terminal.id)}
                />

                {/* Close button - only show if more than one terminal */}
                <Show when={terminalsInGroup().length > 1}>
                  <button
                    data-close-btn
                    style={closeButtonStyle}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onCloseTerminal?.(terminal.id);
                    }}
                    title="Close this pane"
                  >
                    <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
                  </button>
                </Show>
              </div>

              {/* Resize handle between panes */}
              <Show when={!isLast()}>
                <div
                  style={resizeHandleStyle(isDragging())}
                  onMouseDown={(e) => handleResizeStart(e, index())}
                  onMouseEnter={(e) => {
                    if (!isResizing()) {
                      (e.currentTarget.firstChild as HTMLElement).style.background =
                        tokens.colors.border.focus;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isResizing()) {
                      (e.currentTarget.firstChild as HTMLElement).style.background =
                        tokens.colors.border.divider;
                    }
                  }}
                >
                  <div style={resizeHandleLineStyle} />
                </div>
              </Show>
            </>
          );
        }}
      </For>
    </div>
  );
}

export default TerminalGroupSplitView;
