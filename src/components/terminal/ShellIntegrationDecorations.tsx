/**
 * Shell Integration Decorations for Cortex IDE Terminal
 * 
 * Provides visual decorations for command execution status:
 * - Gutter icons (checkmark/X) indicating success/failure
 * - Hover tooltips with exit code and duration
 * - Click actions for re-run and copy command
 * - Visual markers for command boundaries
 */

import { Component, For, Show, createSignal, createEffect, onCleanup } from "solid-js";
import type { ITerminalAddon, IDisposable, Terminal as XTermTerminal, IDecoration } from "@xterm/xterm";
import type { IMarker } from "@xterm/xterm";
import {
  ParsedCommand,
  CommandDecoration,
  getCommandDecoration,
  ShellIntegrationState,
} from "../../utils/shellIntegration";
import { terminalLogger } from "../../utils/logger";

// ============================================================================
// Types
// ============================================================================

export interface DecorationOptions {
  /** Show gutter icons for command status */
  showGutterIcons: boolean;
  /** Show command duration in tooltip */
  showDuration: boolean;
  /** Show exit code in tooltip */
  showExitCode: boolean;
  /** Enable click actions on decorations */
  enableActions: boolean;
  /** Custom icon size in pixels */
  iconSize: number;
  /** Enable command output folding */
  enableFolding: boolean;
}

export interface DecorationAction {
  type: "rerun" | "copy" | "copy-output" | "goto-output";
  command: ParsedCommand;
}

export interface ShellIntegrationDecorationsProps {
  /** Reference to xterm.js terminal instance */
  terminal: XTermTerminal | null;
  /** Shell integration state with parsed commands */
  shellState: ShellIntegrationState;
  /** Decoration options */
  options?: Partial<DecorationOptions>;
  /** Callback when user triggers an action */
  onAction?: (action: DecorationAction) => void;
  /** Terminal ID for context */
  terminalId: string;
}

interface CommandDecorationEntry {
  command: ParsedCommand;
  decoration: CommandDecoration;
  marker: IMarker | null;
  xtermDecoration: IDecoration | null;
  line: number;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: DecorationOptions = {
  showGutterIcons: true,
  showDuration: true,
  showExitCode: true,
  enableActions: true,
  iconSize: 14,
  enableFolding: false,
};

// ============================================================================
// Decoration Icons (SVG paths)
// ============================================================================

const ICONS = {
  success: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <path d="M4 7L6 9L10 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  error: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <path d="M5 5L9 9M9 5L5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  running: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="4 2">
      <animateTransform attributeName="transform" type="rotate" from="0 7 7" to="360 7 7" dur="1s" repeatCount="indefinite"/>
    </circle>
  </svg>`,
  unknown: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <circle cx="7" cy="7" r="2" fill="currentColor"/>
  </svg>`,
};

// ============================================================================
// Tooltip Component
// ============================================================================

interface TooltipProps {
  command: ParsedCommand;
  decoration: CommandDecoration;
  position: { x: number; y: number };
  options: DecorationOptions;
  onAction: (action: DecorationAction) => void;
  onClose: () => void;
}

const DecorationTooltip: Component<TooltipProps> = (props) => {
  let tooltipRef: HTMLDivElement | undefined;

  // Close tooltip when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    if (tooltipRef && !tooltipRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  createEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
  });

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  };

  const handleRerun = () => {
    props.onAction({ type: "rerun", command: props.command });
    props.onClose();
  };

  const handleCopy = () => {
    props.onAction({ type: "copy", command: props.command });
    props.onClose();
  };

  const handleCopyOutput = () => {
    props.onAction({ type: "copy-output", command: props.command });
    props.onClose();
  };

  return (
    <div
      ref={tooltipRef}
      class="shell-decoration-tooltip"
      style={{
        position: "fixed",
        left: `${props.position.x}px`,
        top: `${props.position.y}px`,
        "z-index": "10000",
        "background-color": "var(--bg-secondary, var(--cortex-bg-primary))",
        border: "1px solid var(--border-color, var(--cortex-bg-hover))",
        "border-radius": "var(--cortex-radius-md)",
        padding: "8px 12px",
        "box-shadow": "0 4px 12px rgba(0, 0, 0, 0.3)",
        "min-width": "200px",
        "max-width": "400px",
        "font-size": "12px",
        "font-family": "var(--font-mono, monospace)",
      }}
    >
      {/* Command */}
      <div
        style={{
          "font-weight": "600",
          "margin-bottom": "6px",
          color: "var(--text-primary, var(--cortex-text-primary))",
          "word-break": "break-all",
        }}
      >
        {props.command.command}
      </div>

      {/* Status line */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "8px",
          "margin-bottom": "8px",
          color: props.decoration.color,
        }}
      >
        <span innerHTML={ICONS[props.decoration.type]} />
        <span>{props.decoration.tooltip}</span>
      </div>

      {/* Details */}
      <div
        style={{
          display: "flex",
          "flex-direction": "column",
          gap: "4px",
          "font-size": "11px",
          color: "var(--text-secondary, #888)",
          "margin-bottom": "8px",
        }}
      >
        <Show when={props.options.showExitCode && props.command.exitCode !== undefined}>
          <div>
            Exit code: <span style={{ color: props.command.exitCode === 0 ? "var(--cortex-syntax-function)" : "var(--cortex-error)" }}>
              {props.command.exitCode}
            </span>
          </div>
        </Show>
        <Show when={props.options.showDuration && props.command.duration}>
          <div>Duration: {formatDuration(props.command.duration!)}</div>
        </Show>
        <Show when={props.command.cwd}>
          <div style={{ "word-break": "break-all" }}>CWD: {props.command.cwd}</div>
        </Show>
        <div>
          Time: {new Date(props.command.timestamp).toLocaleTimeString()}
        </div>
      </div>

      {/* Actions */}
      <Show when={props.options.enableActions}>
        <div
          style={{
            display: "flex",
            gap: "6px",
            "border-top": "1px solid var(--border-color, var(--cortex-bg-hover))",
            "padding-top": "8px",
          }}
        >
          <button
            onClick={handleRerun}
            style={{
              flex: "1",
              padding: "4px 8px",
              "background-color": "var(--bg-tertiary, var(--cortex-bg-hover))",
              border: "1px solid var(--border-color, var(--cortex-bg-hover))",
              "border-radius": "var(--cortex-radius-sm)",
              color: "var(--text-primary, var(--cortex-text-primary))",
              cursor: "pointer",
              "font-size": "11px",
            }}
            title="Re-run this command"
          >
            ↻ Re-run
          </button>
          <button
            onClick={handleCopy}
            style={{
              flex: "1",
              padding: "4px 8px",
              "background-color": "var(--bg-tertiary, var(--cortex-bg-hover))",
              border: "1px solid var(--border-color, var(--cortex-bg-hover))",
              "border-radius": "var(--cortex-radius-sm)",
              color: "var(--text-primary, var(--cortex-text-primary))",
              cursor: "pointer",
              "font-size": "11px",
            }}
            title="Copy command to clipboard"
          >
            ⎘ Copy
          </button>
          <Show when={props.command.outputStartOffset !== undefined}>
            <button
              onClick={handleCopyOutput}
              style={{
                flex: "1",
                padding: "4px 8px",
                "background-color": "var(--bg-tertiary, var(--cortex-bg-hover))",
                border: "1px solid var(--border-color, var(--cortex-bg-hover))",
                "border-radius": "var(--cortex-radius-sm)",
                color: "var(--text-primary, var(--cortex-text-primary))",
                cursor: "pointer",
                "font-size": "11px",
              }}
              title="Copy command output"
            >
              ⎘ Output
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
};

// ============================================================================
// Gutter Icon Component (for overlay rendering)
// ============================================================================

interface GutterIconProps {
  entry: CommandDecorationEntry;
  options: DecorationOptions;
  onClick: (entry: CommandDecorationEntry, event: MouseEvent) => void;
}

// GutterIcon component - reserved for future overlay rendering implementation
void function _GutterIcon(props: GutterIconProps) {
  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    props.onClick(props.entry, e);
  };

  return (
    <div
      class="shell-decoration-gutter-icon"
      onClick={handleClick}
      style={{
        display: "inline-flex",
        "align-items": "center",
        "justify-content": "center",
        width: `${props.options.iconSize}px`,
        height: `${props.options.iconSize}px`,
        color: props.entry.decoration.color,
        cursor: "pointer",
        "border-radius": "var(--cortex-radius-sm)",
        transition: "background-color 0.15s",
      }}
      title={props.entry.decoration.tooltip}
      innerHTML={ICONS[props.entry.decoration.type]}
    />
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ShellIntegrationDecorations: Component<ShellIntegrationDecorationsProps> = (props) => {
  const [decorationEntries, setDecorationEntries] = createSignal<CommandDecorationEntry[]>([]);
  const [activeTooltip, setActiveTooltip] = createSignal<{
    entry: CommandDecorationEntry;
    position: { x: number; y: number };
  } | null>(null);
  const [, setOverlayContainer] = createSignal<HTMLDivElement | null>(null);

  const options = (): DecorationOptions => ({
    ...DEFAULT_OPTIONS,
    ...props.options,
  });

  // Track xterm decorations for cleanup
  let xtermDecorations: IDisposable[] = [];
  let resizeObserver: ResizeObserver | null = null;

  /**
   * Calculate line number from buffer offset
   */
  const offsetToLine = (terminal: XTermTerminal, offset: number): number => {
    // This is an approximation - in a real implementation,
    // we'd need to track actual line positions from the shell integration data
    const cols = terminal.cols;
    return Math.floor(offset / (cols + 1)); // +1 for newline
  };

  /**
   * Create xterm.js decoration for a command
   */
  const createXtermDecoration = (
    terminal: XTermTerminal,
    entry: CommandDecorationEntry
  ): { marker: IMarker | null; decoration: IDecoration | null } => {
    try {
      const buffer = terminal.buffer.active;
      const line = entry.line;

      // Ensure line is within buffer bounds
      if (line < 0 || line >= buffer.length) {
        return { marker: null, decoration: null };
      }

      // Register a marker at the command line
      const marker = terminal.registerMarker(line - buffer.baseY);
      if (!marker) {
        return { marker: null, decoration: null };
      }

      // Create decoration
      const decoration = terminal.registerDecoration({
        marker,
        anchor: "left",
        x: 0,
        width: 1,
        overviewRulerOptions: {
          color: entry.decoration.color,
          position: entry.decoration.type === "error" ? "right" : "left",
        },
      });

      if (decoration) {
        decoration.onRender((element) => {
          // Style the decoration element
          element.style.width = `${options().iconSize}px`;
          element.style.height = `${options().iconSize}px`;
          element.style.display = "flex";
          element.style.alignItems = "center";
          element.style.justifyContent = "center";
          element.style.color = entry.decoration.color;
          element.style.cursor = "pointer";
          element.style.marginLeft = "-20px";
          element.innerHTML = ICONS[entry.decoration.type];

          // Add click handler
          element.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleIconClick(entry, e);
          };
        });
      }

      return { marker, decoration: decoration ?? null };
    } catch (e) {
      terminalLogger.error("[ShellDecorations] Failed to create xterm decoration:", e);
      return { marker: null, decoration: null };
    }
  };

  /**
   * Update decorations when commands change
   */
  const updateDecorations = () => {
    const terminal = props.terminal;
    if (!terminal || !props.shellState.enabled) {
      setDecorationEntries([]);
      return;
    }

    // Clean up old decorations
    xtermDecorations.forEach((d) => d.dispose());
    xtermDecorations = [];

    // Create new decoration entries
    const entries: CommandDecorationEntry[] = props.shellState.commands.map((cmd) => {
      const decoration = getCommandDecoration(cmd);
      const line = offsetToLine(terminal, cmd.startOffset);

      return {
        command: cmd,
        decoration,
        marker: null,
        xtermDecoration: null,
        line,
      };
    });

    // Create xterm decorations if gutter icons are enabled
    if (options().showGutterIcons) {
      entries.forEach((entry) => {
        const { marker, decoration } = createXtermDecoration(terminal, entry);
        entry.marker = marker;
        entry.xtermDecoration = decoration;

        if (decoration) {
          xtermDecorations.push(decoration);
        }
        if (marker) {
          xtermDecorations.push(marker);
        }
      });
    }

    setDecorationEntries(entries);
  };

  /**
   * Handle icon click - show tooltip
   */
  const handleIconClick = (entry: CommandDecorationEntry, event: MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setActiveTooltip({
      entry,
      position: {
        x: rect.right + 8,
        y: rect.top,
      },
    });
  };

  /**
   * Handle tooltip action
   */
  const handleAction = (action: DecorationAction) => {
    props.onAction?.(action);

    // Default implementations for copy actions
    if (action.type === "copy") {
      navigator.clipboard.writeText(action.command.command).catch((e) => terminalLogger.error("Failed to copy to clipboard:", e));
    }
  };

  /**
   * Close tooltip
   */
  const closeTooltip = () => {
    setActiveTooltip(null);
  };

  // Update decorations when shell state changes
  createEffect(() => {
    const commands = props.shellState.commands;
    const terminal = props.terminal;
    
    // Trigger update when commands array changes
    if (commands && terminal) {
      updateDecorations();
    }
  });

  // Setup resize observer to reposition decorations
  createEffect(() => {
    const terminal = props.terminal;
    if (!terminal) return;

    // Get terminal element
    const terminalElement = (terminal as unknown as { element?: HTMLElement }).element;
    if (!terminalElement) return;

    resizeObserver = new ResizeObserver(() => {
      // Reposition decorations on resize
      updateDecorations();
    });

    resizeObserver.observe(terminalElement);

    onCleanup(() => {
      resizeObserver?.disconnect();
      resizeObserver = null;
    });
  });

  // Cleanup on unmount
  onCleanup(() => {
    xtermDecorations.forEach((d) => d.dispose());
    xtermDecorations = [];
    resizeObserver?.disconnect();
  });

  return (
    <>
      {/* Overlay container for custom decorations */}
      <div
        ref={setOverlayContainer}
        class="shell-decorations-overlay"
        style={{
          position: "absolute",
          top: "0",
          left: "0",
          right: "0",
          bottom: "0",
          "pointer-events": "none",
          overflow: "hidden",
        }}
      >
        {/* Command markers in overview ruler style */}
        <Show when={options().showGutterIcons}>
          <div
            class="shell-decorations-ruler"
            style={{
              position: "absolute",
              top: "0",
              right: "0",
              width: "12px",
              height: "100%",
              "background-color": "rgba(0, 0, 0, 0.2)",
              "pointer-events": "auto",
            }}
          >
            <For each={decorationEntries()}>
              {(entry) => {
                const terminal = props.terminal;
                if (!terminal) return null;

                const buffer = terminal.buffer.active;
                const totalLines = buffer.length || 1;
                const linePercent = (entry.line / totalLines) * 100;

                return (
                  <div
                    style={{
                      position: "absolute",
                      top: `${linePercent}%`,
                      left: "2px",
                      width: "8px",
                      height: "4px",
                      "background-color": entry.decoration.color,
                      "border-radius": "var(--cortex-radius-sm)",
                      cursor: "pointer",
                      "pointer-events": "auto",
                    }}
                    title={`${entry.command.command} - ${entry.decoration.tooltip}`}
                    onClick={(e) => handleIconClick(entry, e)}
                  />
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* Tooltip portal */}
      <Show when={activeTooltip()}>
        {(tooltip) => (
          <DecorationTooltip
            command={tooltip().entry.command}
            decoration={tooltip().entry.decoration}
            position={tooltip().position}
            options={options()}
            onAction={handleAction}
            onClose={closeTooltip}
          />
        )}
      </Show>

      {/* Styles */}
      <style>{`
        .shell-decoration-gutter-icon:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }

        .shell-decoration-tooltip button:hover {
          background-color: var(--bg-hover, var(--cortex-bg-hover)) !important;
        }

        .shell-decorations-ruler > div:hover {
          transform: scaleX(1.5);
          transition: transform 0.15s;
        }

        /* Animation for running indicator */
        @keyframes shell-decoration-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .shell-decoration-running svg {
          animation: shell-decoration-spin 1s linear infinite;
        }
      `}</style>
    </>
  );
};

// ============================================================================
// xterm.js Addon for Shell Integration Decorations
// ============================================================================

/**
 * xterm.js addon that provides shell integration decorations
 */
export class ShellIntegrationDecorationsAddon implements ITerminalAddon {
  private terminal: XTermTerminal | null = null;
  private decorations: IDisposable[] = [];
  private shellState: ShellIntegrationState | null = null;
  private options: DecorationOptions;
  private onActionCallback: ((action: DecorationAction) => void) | null = null;

  constructor(options?: Partial<DecorationOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  activate(terminal: XTermTerminal): void {
    this.terminal = terminal;
  }

  dispose(): void {
    this.clearDecorations();
    this.terminal = null;
  }

  /**
   * Update shell integration state
   */
  updateState(state: ShellIntegrationState): void {
    this.shellState = state;
    this.refresh();
  }

  /**
   * Set action callback
   */
  setOnAction(callback: (action: DecorationAction) => void): void {
    this.onActionCallback = callback;
  }

  /**
   * Clear all decorations
   */
  clearDecorations(): void {
    this.decorations.forEach((d) => d.dispose());
    this.decorations = [];
  }

  /**
   * Refresh decorations based on current state
   */
  refresh(): void {
    if (!this.terminal || !this.shellState?.enabled) {
      this.clearDecorations();
      return;
    }

    this.clearDecorations();

    const terminal = this.terminal;
    const buffer = terminal.buffer.active;

    for (const cmd of this.shellState.commands) {
      const decoration = getCommandDecoration(cmd);
      const line = Math.floor(cmd.startOffset / (terminal.cols + 1));

      if (line < 0 || line >= buffer.length) continue;

      const marker = terminal.registerMarker(line - buffer.baseY);
      if (!marker) continue;

      const xtermDecoration = terminal.registerDecoration({
        marker,
        anchor: "left",
        x: 0,
        width: 1,
        overviewRulerOptions: {
          color: decoration.color,
          position: decoration.type === "error" ? "right" : "left",
        },
      });

      if (xtermDecoration) {
        xtermDecoration.onRender((element) => {
          element.style.width = `${this.options.iconSize}px`;
          element.style.height = `${this.options.iconSize}px`;
          element.style.display = "flex";
          element.style.alignItems = "center";
          element.style.justifyContent = "center";
          element.style.color = decoration.color;
          element.style.cursor = "pointer";
          element.style.marginLeft = "-20px";
          element.innerHTML = ICONS[decoration.type];

          element.onclick = () => {
            this.onActionCallback?.({
              type: "rerun",
              command: cmd,
            });
          };
        });

        this.decorations.push(xtermDecoration);
      }

      this.decorations.push(marker);
    }
  }

  /**
   * Get all command decorations
   */
  getDecorations(): Array<{ command: ParsedCommand; decoration: CommandDecoration }> {
    if (!this.shellState) return [];

    return this.shellState.commands.map((cmd) => ({
      command: cmd,
      decoration: getCommandDecoration(cmd),
    }));
  }
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Create a shell integration decorations manager
 */
export function createShellDecorations(
  terminal: () => XTermTerminal | null,
  shellState: () => ShellIntegrationState,
  options?: Partial<DecorationOptions>
): {
  addon: ShellIntegrationDecorationsAddon;
  refresh: () => void;
  setOnAction: (callback: (action: DecorationAction) => void) => void;
} {
  const addon = new ShellIntegrationDecorationsAddon(options);

  // Update addon when state changes
  createEffect(() => {
    const term = terminal();
    const state = shellState();

    if (term && !addon["terminal"]) {
      addon.activate(term);
    }

    if (state) {
      addon.updateState(state);
    }
  });

  return {
    addon,
    refresh: () => addon.refresh(),
    setOnAction: (callback) => addon.setOnAction(callback),
  };
}

// ============================================================================
// Command History Panel Component
// ============================================================================

interface CommandHistoryPanelProps {
  commands: ParsedCommand[];
  onRerun: (command: ParsedCommand) => void;
  onCopy: (command: ParsedCommand) => void;
  maxItems?: number;
}

export const CommandHistoryPanel: Component<CommandHistoryPanelProps> = (props) => {
  const maxItems = () => props.maxItems ?? 50;

  const recentCommands = () =>
    props.commands.slice(-maxItems()).reverse();

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (ms?: number): string => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div
      class="command-history-panel"
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        "background-color": "var(--bg-primary, var(--cortex-bg-primary))",
        "font-size": "12px",
        "font-family": "var(--font-mono, monospace)",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          "border-bottom": "1px solid var(--border-color, var(--cortex-bg-hover))",
          "font-weight": "600",
          color: "var(--text-primary, var(--cortex-text-primary))",
        }}
      >
        Command History ({props.commands.length})
      </div>

      <div
        style={{
          flex: "1",
          overflow: "auto",
        }}
      >
        <For each={recentCommands()}>
          {(cmd) => {
            const decoration = getCommandDecoration(cmd);
            return (
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  padding: "6px 12px",
                  "border-bottom": "1px solid var(--border-color, var(--cortex-bg-hover))",
                  gap: "8px",
                }}
              >
                <span
                  style={{ color: decoration.color }}
                  innerHTML={ICONS[decoration.type]}
                />
                <div style={{ flex: "1", "min-width": "0" }}>
                  <div
                    style={{
                      color: "var(--text-primary, var(--cortex-text-primary))",
                      "white-space": "nowrap",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                    }}
                    title={cmd.command}
                  >
                    {cmd.command}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      "font-size": "10px",
                      color: "var(--text-secondary, #888)",
                    }}
                  >
                    <span>{formatTime(cmd.timestamp)}</span>
                    <span>{formatDuration(cmd.duration)}</span>
                    <Show when={cmd.exitCode !== undefined}>
                      <span style={{ color: cmd.exitCode === 0 ? "var(--cortex-syntax-function)" : "var(--cortex-error)" }}>
                        exit: {cmd.exitCode}
                      </span>
                    </Show>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    onClick={() => props.onRerun(cmd)}
                    style={{
                      padding: "2px 6px",
                      "background-color": "transparent",
                      border: "1px solid var(--border-color, var(--cortex-bg-hover))",
                      "border-radius": "var(--cortex-radius-sm)",
                      color: "var(--text-secondary, #888)",
                      cursor: "pointer",
                      "font-size": "10px",
                    }}
                    title="Re-run command"
                  >
                    ↻
                  </button>
                  <button
                    onClick={() => props.onCopy(cmd)}
                    style={{
                      padding: "2px 6px",
                      "background-color": "transparent",
                      border: "1px solid var(--border-color, var(--cortex-bg-hover))",
                      "border-radius": "var(--cortex-radius-sm)",
                      color: "var(--text-secondary, #888)",
                      cursor: "pointer",
                      "font-size": "10px",
                    }}
                    title="Copy command"
                  >
                    ⎘
                  </button>
                </div>
              </div>
            );
          }}
        </For>

        <Show when={props.commands.length === 0}>
          <div
            style={{
              padding: "24px",
              "text-align": "center",
              color: "var(--text-secondary, #888)",
            }}
          >
            No commands recorded yet.
            <br />
            <span style={{ "font-size": "11px" }}>
              Shell integration captures command history automatically.
            </span>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default ShellIntegrationDecorations;

