/**
 * =============================================================================
 * TERMINAL DECORATIONS - Command status indicators in gutter
 * =============================================================================
 *
 * Shows success/failure marks next to commands like VS Code's shell
 * integration decorations.
 *
 * Visual indicators:
 * - Green checkmark for exit code 0
 * - Red X for non-zero exit code
 * - Yellow spinner for running command
 * - Gray dot for unknown status
 *
 * Gutter features:
 * 1. Icon in left gutter at command line
 * 2. Hover tooltip with:
 *    - Full command
 *    - Exit code
 *    - Duration
 *    - First lines of output
 * 3. Click to:
 *    - Re-run command
 *    - Copy command
 *    - Copy output
 *    - Show full output
 *
 * Usage:
 *   <TerminalDecorations
 *     terminalId={terminalId}
 *     decorations={decorations}
 *     onDecorationClick={handleClick}
 *   />
 * =============================================================================
 */

import {
  createSignal,
  createMemo,
  For,
  Show,
  JSX,
  Accessor,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Represents a command decoration in the terminal gutter
 */
export interface CommandDecoration {
  /** Unique identifier for this decoration */
  id: string;
  /** Line number where command started (0-based) */
  line: number;
  /** The command text */
  command: string;
  /** Exit code (null if still running) */
  exitCode: number | null;
  /** When the command started */
  startTime: Date;
  /** When the command ended (null if still running) */
  endTime: Date | null;
  /** Duration in milliseconds (null if still running) */
  duration: number | null;
  /** Command output (truncated for display) */
  output: string;
  /** Current working directory when command was run */
  cwd?: string;
}

/**
 * Props for the TerminalDecorations component
 */
export interface TerminalDecorationsProps {
  /** Terminal instance ID */
  terminalId: string;
  /** Array of command decorations to display */
  decorations: CommandDecoration[];
  /** Callback when a decoration is clicked */
  onDecorationClick: (decoration: CommandDecoration, action: DecorationAction) => void;
  /** Whether decorations are enabled */
  enabled?: boolean;
  /** Whether to show duration in tooltip */
  showDuration?: boolean;
  /** Whether to show exit code in tooltip */
  showExitCode?: boolean;
  /** Line height in pixels (for positioning) */
  lineHeight?: number;
  /** Scroll offset in lines */
  scrollOffset?: number;
  /** Visible height in lines */
  visibleLines?: number;
}

/**
 * Actions available from decoration context menu
 */
export type DecorationAction = 
  | "rerun"
  | "copy-command"
  | "copy-output"
  | "show-output";

/**
 * Status of a command decoration
 */
export type DecorationStatus = "running" | "success" | "error" | "unknown";

// =============================================================================
// CONSTANTS
// =============================================================================

const GUTTER_WIDTH = 20;
const ICON_SIZE = 14;
const TOOLTIP_MAX_WIDTH = 400;
const OUTPUT_PREVIEW_LINES = 5;
const OUTPUT_PREVIEW_MAX_CHARS = 500;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get the status of a decoration based on exit code
 */
export function getDecorationStatus(decoration: CommandDecoration): DecorationStatus {
  if (decoration.exitCode === null) {
    return "running";
  }
  if (decoration.exitCode === 0) {
    return "success";
  }
  return "error";
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "Running...";
  
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Truncate output for preview
 */
export function truncateOutput(output: string): string {
  const lines = output.split("\n").slice(0, OUTPUT_PREVIEW_LINES);
  const truncated = lines.join("\n");
  
  if (truncated.length > OUTPUT_PREVIEW_MAX_CHARS) {
    return truncated.slice(0, OUTPUT_PREVIEW_MAX_CHARS) + "...";
  }
  if (output.split("\n").length > OUTPUT_PREVIEW_LINES) {
    return truncated + "\n...";
  }
  return truncated;
}

// =============================================================================
// DECORATION ICON COMPONENT
// =============================================================================

interface DecorationIconProps {
  status: DecorationStatus;
  size?: number;
}

function DecorationIcon(props: DecorationIconProps) {
  const size = () => props.size ?? ICON_SIZE;
  
  const iconStyle = (): JSX.CSSProperties => ({
    width: `${size()}px`,
    height: `${size()}px`,
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
  });
  
  return (
    <div style={iconStyle()}>
      <Show when={props.status === "success"}>
        <Icon 
          name="check"
          size={size() - 2} 
          color={tokens.colors.semantic.success}
          style={{ "stroke-width": "3" }}
        />
      </Show>
      <Show when={props.status === "error"}>
        <Icon 
          name="xmark"
          size={size() - 2} 
          color={tokens.colors.semantic.error}
          style={{ "stroke-width": "3" }}
        />
      </Show>
      <Show when={props.status === "running"}>
        <Icon 
          name="spinner"
          size={size() - 2} 
          color={tokens.colors.semantic.warning}
          class="animate-spin"
        />
      </Show>
      <Show when={props.status === "unknown"}>
        <Icon 
          name="circle"
          size={size() - 4} 
          color={tokens.colors.text.muted}
        />
      </Show>
    </div>
  );
}

// =============================================================================
// DECORATION TOOLTIP COMPONENT
// =============================================================================

interface DecorationTooltipProps {
  decoration: CommandDecoration;
  showDuration?: boolean;
  showExitCode?: boolean;
  position: { x: number; y: number };
  onAction: (action: DecorationAction) => void;
}

function DecorationTooltip(props: DecorationTooltipProps) {
  const status = () => getDecorationStatus(props.decoration);
  
  const tooltipStyle = (): JSX.CSSProperties => ({
    position: "fixed",
    left: `${props.position.x + 10}px`,
    top: `${props.position.y}px`,
    "max-width": `${TOOLTIP_MAX_WIDTH}px`,
    background: tokens.colors.surface.popup,
    border: `1px solid ${tokens.colors.border.default}`,
    "border-radius": tokens.radius.md,
    "box-shadow": tokens.shadows.popup,
    "z-index": "10000",
    overflow: "hidden",
    "font-size": "12px",
  });
  
  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    background: tokens.colors.surface.panel,
    "border-bottom": `1px solid ${tokens.colors.border.default}`,
  });
  
  const commandStyle: JSX.CSSProperties = {
    flex: "1",
    "font-family": "var(--font-mono)",
    "font-size": "11px",
    color: tokens.colors.text.primary,
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  };
  
  const bodyStyle: JSX.CSSProperties = {
    padding: tokens.spacing.md,
  };
  
  const infoRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    "margin-bottom": tokens.spacing.xs,
    color: tokens.colors.text.muted,
    "font-size": "11px",
  };
  
  const labelStyle: JSX.CSSProperties = {
    color: tokens.colors.text.muted,
    "min-width": "60px",
  };
  
  const valueStyle: JSX.CSSProperties = {
    color: tokens.colors.text.primary,
  };
  
  const outputPreviewStyle: JSX.CSSProperties = {
    "margin-top": tokens.spacing.sm,
    padding: tokens.spacing.sm,
    background: tokens.colors.surface.canvas,
    "border-radius": tokens.radius.sm,
    "font-family": "var(--font-mono)",
    "font-size": "10px",
    color: tokens.colors.text.muted,
    "white-space": "pre-wrap",
    "word-break": "break-all",
    "max-height": "100px",
    overflow: "auto",
  };
  
  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    gap: tokens.spacing.xs,
    "margin-top": tokens.spacing.sm,
    "padding-top": tokens.spacing.sm,
    "border-top": `1px solid ${tokens.colors.border.default}`,
  };
  
  const actionButtonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.xs,
    padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
    background: tokens.colors.surface.panel,
    border: `1px solid ${tokens.colors.border.default}`,
    "border-radius": tokens.radius.sm,
    color: tokens.colors.text.primary,
    "font-size": "11px",
    cursor: "pointer",
    transition: "background 150ms ease",
  };
  
  return (
    <div style={tooltipStyle()}>
      {/* Header with command */}
      <div style={headerStyle()}>
        <DecorationIcon status={status()} size={14} />
        <span style={commandStyle} title={props.decoration.command}>
          {props.decoration.command}
        </span>
      </div>
      
      {/* Body with details */}
      <div style={bodyStyle}>
        {/* Exit code */}
        <Show when={props.showExitCode !== false && props.decoration.exitCode !== null}>
          <div style={infoRowStyle}>
            <span style={labelStyle}>Exit code:</span>
            <span 
              style={{
                ...valueStyle,
                color: props.decoration.exitCode === 0 
                  ? tokens.colors.semantic.success 
                  : tokens.colors.semantic.error,
              }}
            >
              {props.decoration.exitCode}
            </span>
          </div>
        </Show>
        
        {/* Duration */}
        <Show when={props.showDuration !== false}>
          <div style={infoRowStyle}>
            <span style={labelStyle}>Duration:</span>
            <span style={valueStyle}>
              {formatDuration(props.decoration.duration)}
            </span>
          </div>
        </Show>
        
        {/* CWD */}
        <Show when={props.decoration.cwd}>
          <div style={infoRowStyle}>
            <span style={labelStyle}>Directory:</span>
            <span style={valueStyle}>{props.decoration.cwd}</span>
          </div>
        </Show>
        
        {/* Output preview */}
        <Show when={props.decoration.output && props.decoration.output.trim()}>
          <div style={outputPreviewStyle}>
            {truncateOutput(props.decoration.output)}
          </div>
        </Show>
        
        {/* Actions */}
        <div style={actionsStyle}>
          <button
            style={actionButtonStyle}
            onClick={() => props.onAction("rerun")}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.colors.interactive.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = tokens.colors.surface.panel;
            }}
            title="Re-run command"
          >
            <Icon name="play" size={12} />
            <span>Re-run</span>
          </button>
          
          <button
            style={actionButtonStyle}
            onClick={() => props.onAction("copy-command")}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.colors.interactive.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = tokens.colors.surface.panel;
            }}
            title="Copy command"
          >
            <Icon name="copy" size={12} />
            <span>Copy</span>
          </button>
          
          <Show when={props.decoration.output}>
            <button
              style={actionButtonStyle}
              onClick={() => props.onAction("copy-output")}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tokens.colors.interactive.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = tokens.colors.surface.panel;
              }}
              title="Copy output"
            >
              <Icon name="terminal" size={12} />
              <span>Output</span>
            </button>
          </Show>
          
          <Show when={props.decoration.output && props.decoration.output.length > OUTPUT_PREVIEW_MAX_CHARS}>
            <button
              style={actionButtonStyle}
              onClick={() => props.onAction("show-output")}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tokens.colors.interactive.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = tokens.colors.surface.panel;
              }}
              title="Show full output"
            >
              <Icon name="file-lines" size={12} />
              <span>Full</span>
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SINGLE DECORATION ITEM COMPONENT
// =============================================================================

interface DecorationItemProps {
  decoration: CommandDecoration;
  lineHeight: number;
  scrollOffset: number;
  onClick: (action: DecorationAction) => void;
  showDuration?: boolean;
  showExitCode?: boolean;
}

function DecorationItem(props: DecorationItemProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const [tooltipPosition, setTooltipPosition] = createSignal({ x: 0, y: 0 });
  
  const status = () => getDecorationStatus(props.decoration);
  
  // Calculate vertical position based on line number and scroll offset
  const topPosition = () => {
    const relativeLine = props.decoration.line - props.scrollOffset;
    return relativeLine * props.lineHeight;
  };
  
  // Check if decoration is visible in viewport
  const isVisible = () => {
    const top = topPosition();
    return top >= -props.lineHeight && top < 1000; // Reasonable viewport check
  };
  
  const itemStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: "0",
    top: `${topPosition()}px`,
    width: `${GUTTER_WIDTH}px`,
    height: `${props.lineHeight}px`,
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    cursor: "pointer",
    opacity: isHovered() ? "1" : "0.8",
    transition: "opacity 150ms ease",
  });
  
  const handleMouseEnter = (e: MouseEvent) => {
    setIsHovered(true);
    setTooltipPosition({
      x: e.clientX,
      y: e.clientY,
    });
  };
  
  const handleMouseLeave = () => {
    setIsHovered(false);
  };
  
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    // Default action is copy-command
    props.onClick("copy-command");
  };
  
  return (
    <Show when={isVisible()}>
      <div
        style={itemStyle()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        data-decoration-id={props.decoration.id}
        data-decoration-line={props.decoration.line}
        title={`${props.decoration.command} (${status()})`}
      >
        <DecorationIcon status={status()} />
      </div>
      
      {/* Tooltip on hover */}
      <Show when={isHovered()}>
        <DecorationTooltip
          decoration={props.decoration}
          position={tooltipPosition()}
          showDuration={props.showDuration}
          showExitCode={props.showExitCode}
          onAction={(action) => {
            props.onClick(action);
            setIsHovered(false);
          }}
        />
      </Show>
    </Show>
  );
}

// =============================================================================
// MAIN TERMINAL DECORATIONS COMPONENT
// =============================================================================

export function TerminalDecorations(props: TerminalDecorationsProps) {
  const lineHeight = () => props.lineHeight ?? 18;
  const scrollOffset = () => props.scrollOffset ?? 0;
  
  // Filter to only visible decorations for performance
  const visibleDecorations = createMemo(() => {
    if (!props.enabled) return [];
    
    const visibleLines = props.visibleLines ?? 50;
    const minLine = scrollOffset();
    const maxLine = scrollOffset() + visibleLines + 5; // Buffer
    
    return props.decorations.filter(
      d => d.line >= minLine - 5 && d.line <= maxLine
    );
  });
  
  const gutterStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: "0",
    top: "0",
    width: `${GUTTER_WIDTH}px`,
    height: "100%",
    overflow: "hidden",
    "pointer-events": "auto",
    "z-index": "5",
  });
  
  return (
    <Show when={props.enabled !== false && props.decorations.length > 0}>
      <div 
        class="terminal-decorations-gutter"
        style={gutterStyle()}
        data-terminal-id={props.terminalId}
      >
        <For each={visibleDecorations()}>
          {(decoration) => (
            <DecorationItem
              decoration={decoration}
              lineHeight={lineHeight()}
              scrollOffset={scrollOffset()}
              showDuration={props.showDuration}
              showExitCode={props.showExitCode}
              onClick={(action) => props.onDecorationClick(decoration, action)}
            />
          )}
        </For>
      </div>
      
      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        
        .terminal-decorations-gutter {
          background: transparent;
        }
      `}</style>
    </Show>
  );
}

// =============================================================================
// HOOK FOR MANAGING DECORATIONS STATE
// =============================================================================

export interface UseTerminalDecorationsOptions {
  /** Maximum number of decorations to keep */
  maxDecorations?: number;
  /** Whether decorations are enabled */
  enabled?: boolean;
}

export interface UseTerminalDecorationsReturn {
  /** Current decorations */
  decorations: Accessor<CommandDecoration[]>;
  /** Add a new decoration for a starting command */
  startCommand: (line: number, command: string, cwd?: string) => string;
  /** Complete a command with exit code and output */
  endCommand: (id: string, exitCode: number, output?: string) => void;
  /** Update command output while running */
  updateOutput: (id: string, output: string) => void;
  /** Clear all decorations */
  clear: () => void;
  /** Remove a specific decoration */
  remove: (id: string) => void;
  /** Get decoration by ID */
  getById: (id: string) => CommandDecoration | undefined;
  /** Get decoration by line number */
  getByLine: (line: number) => CommandDecoration | undefined;
}

/**
 * Hook for managing terminal command decorations
 */
export function useTerminalDecorations(
  options: UseTerminalDecorationsOptions = {}
): UseTerminalDecorationsReturn {
  const maxDecorations = options.maxDecorations ?? 100;
  
  const [decorations, setDecorations] = createStore<CommandDecoration[]>([]);
  
  let nextId = 0;
  
  const generateId = () => {
    return `decoration-${Date.now()}-${nextId++}`;
  };
  
  const startCommand = (line: number, command: string, cwd?: string): string => {
    const id = generateId();
    const decoration: CommandDecoration = {
      id,
      line,
      command,
      exitCode: null,
      startTime: new Date(),
      endTime: null,
      duration: null,
      output: "",
      cwd,
    };
    
    setDecorations(produce((d) => {
      d.push(decoration);
      // Trim to max decorations
      while (d.length > maxDecorations) {
        d.shift();
      }
    }));
    
    return id;
  };
  
  const endCommand = (id: string, exitCode: number, output?: string) => {
    setDecorations(produce((d) => {
      const index = d.findIndex((dec) => dec.id === id);
      if (index !== -1) {
        const endTime = new Date();
        d[index].exitCode = exitCode;
        d[index].endTime = endTime;
        d[index].duration = endTime.getTime() - d[index].startTime.getTime();
        if (output !== undefined) {
          d[index].output = output;
        }
      }
    }));
  };
  
  const updateOutput = (id: string, output: string) => {
    setDecorations(produce((d) => {
      const index = d.findIndex((dec) => dec.id === id);
      if (index !== -1) {
        d[index].output = output;
      }
    }));
  };
  
  const clear = () => {
    setDecorations([]);
  };
  
  const remove = (id: string) => {
    setDecorations(produce((d) => {
      const index = d.findIndex((dec) => dec.id === id);
      if (index !== -1) {
        d.splice(index, 1);
      }
    }));
  };
  
  const getById = (id: string): CommandDecoration | undefined => {
    return decorations.find((d) => d.id === id);
  };
  
  const getByLine = (line: number): CommandDecoration | undefined => {
    return decorations.find((d) => d.line === line);
  };
  
  return {
    decorations: () => decorations,
    startCommand,
    endCommand,
    updateOutput,
    clear,
    remove,
    getById,
    getByLine,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default TerminalDecorations;
