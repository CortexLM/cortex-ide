import { createSignal, For, Show, createMemo, onMount, onCleanup } from "solid-js";
import { Icon } from "./ui/Icon";
import { 
  useOutput, 
  LogLevel, 
  LOG_LEVELS, 
  LOG_LEVEL_LABELS
} from "@/context/OutputContext";
import { useCommands } from "@/context/CommandContext";

/**
 * Colors associated with each log level for visual indication
 */
const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  trace: "var(--text-muted, #888)",
  debug: "var(--text, #ccc)",
  info: "var(--info, var(--cortex-syntax-keyword))",
  warning: "var(--warning, var(--cortex-syntax-function))",
  error: "var(--error, var(--cortex-error))",
  off: "var(--text-muted, #666)",
};

/**
 * Icons/indicators for each log level
 */
const LOG_LEVEL_INDICATORS: Record<LogLevel, string> = {
  trace: "◦",
  debug: "○",
  info: "●",
  warning: "▲",
  error: "✕",
  off: "⊘",
};

export interface LogLevelSelectorProps {
  /** Optional: Specific channel to configure (if null, configures global level) */
  channel?: string | null;
  /** Whether to show the channel-specific controls */
  showChannelControls?: boolean;
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Optional class name for styling */
  class?: string;
}

/**
 * Dropdown selector for configuring output log levels.
 * Supports both global log level and per-channel overrides.
 */
export function LogLevelSelector(props: LogLevelSelectorProps) {
  const output = useOutput();
  const commands = useCommands();
  const [isOpen, setIsOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;

  const channel = () => props.channel ?? output.state.activeChannel;
  const showChannelControls = () => props.showChannelControls !== false && channel() !== null;

  const globalLevel = createMemo(() => output.getLogLevel());
  
  const channelLevel = createMemo(() => {
    const ch = channel();
    if (!ch) return null;
    return output.getChannelLogLevel(ch);
  });

  const hasChannelOverride = createMemo(() => {
    const ch = channel();
    if (!ch) return false;
    return output.hasChannelLogLevelOverride(ch);
  });

  const effectiveLevel = createMemo(() => {
    const ch = channel();
    if (ch) {
      return output.getChannelLogLevel(ch);
    }
    return output.getLogLevel();
  });

  const handleSetGlobalLevel = (level: LogLevel) => {
    output.setLogLevel(level);
    setIsOpen(false);
  };

  const handleSetChannelLevel = (level: LogLevel) => {
    const ch = channel();
    if (ch) {
      output.setChannelLogLevel(ch, level);
    }
    setIsOpen(false);
  };

  const handleClearChannelOverride = () => {
    const ch = channel();
    if (ch) {
      output.clearChannelLogLevel(ch);
    }
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
  });

  // Register the developer command for setting log level
  onMount(() => {
    const command = {
      id: "developer.setLogLevel",
      label: "Developer: Set Log Level",
      category: "Developer",
      action: () => {
        // Open the log level selector via command palette
        // Dispatch event to show the log level picker dialog
        window.dispatchEvent(new CustomEvent("output:show-log-level-picker"));
        // Also toggle this dropdown if visible
        setIsOpen(true);
      },
    };
    
    commands.registerCommand(command);
    onCleanup(() => commands.unregisterCommand(command.id));
  });

  // Listen for show-log-level-picker event
  onMount(() => {
    const handleShowPicker = () => {
      setIsOpen(true);
    };
    window.addEventListener("output:show-log-level-picker", handleShowPicker);
    onCleanup(() => window.removeEventListener("output:show-log-level-picker", handleShowPicker));
  });

  return (
    <div
      ref={dropdownRef}
      style={{
        position: "relative",
        display: "inline-block",
      }}
      class={props.class}
    >
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen())}
        title={`Log Level: ${LOG_LEVEL_LABELS[effectiveLevel()]}${hasChannelOverride() ? " (channel override)" : ""}`}
        style={{
          display: "flex",
          "align-items": "center",
          gap: props.compact ? "2px" : "4px",
          padding: props.compact ? "4px 6px" : "4px 8px",
          background: "transparent",
          border: "1px solid var(--border, #333)",
          "border-radius": "var(--cortex-radius-sm)",
          color: LOG_LEVEL_COLORS[effectiveLevel()],
          cursor: "pointer",
          "font-size": "12px",
          "min-width": props.compact ? "auto" : "90px",
          "justify-content": "space-between",
          transition: "border-color 0.15s ease, background-color 0.15s ease",
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.borderColor = "var(--border-active, #444)";
          (e.target as HTMLElement).style.backgroundColor = "var(--bg-hover, var(--cortex-bg-hover))";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.borderColor = "var(--border, #333)";
          (e.target as HTMLElement).style.backgroundColor = "transparent";
        }}
      >
        <span
          style={{
            display: "flex",
            "align-items": "center",
            gap: "4px",
          }}
        >
          <span style={{ "font-weight": "bold", "font-size": "10px" }}>
            {LOG_LEVEL_INDICATORS[effectiveLevel()]}
          </span>
          <Show when={!props.compact}>
            <span>{LOG_LEVEL_LABELS[effectiveLevel()]}</span>
          </Show>
        </span>
        <Show when={hasChannelOverride()}>
          <span
            style={{
              width: "6px",
              height: "6px",
              "border-radius": "var(--cortex-radius-full)",
              "background-color": "var(--accent, var(--cortex-info))",
              "flex-shrink": "0",
            }}
            title="Channel has custom log level"
          />
        </Show>
        <Icon
          name="chevron-down"
          style={{
            width: "12px",
            height: "12px",
            transform: isOpen() ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            "flex-shrink": "0",
          }}
        />
      </button>

      {/* Dropdown Menu */}
      <Show when={isOpen()}>
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: "0",
            "margin-top": "4px",
            "min-width": "200px",
            "max-height": "400px",
            overflow: "auto",
            "background-color": "var(--bg-secondary, var(--cortex-bg-primary))",
            border: "1px solid var(--border, #333)",
            "border-radius": "var(--cortex-radius-sm)",
            "box-shadow": "0 4px 12px rgba(0, 0, 0, 0.3)",
            "z-index": "1000",
          }}
        >
          {/* Global Log Level Section */}
          <div style={{ padding: "4px 0" }}>
            <div
              style={{
                padding: "4px 12px",
                "font-size": "10px",
                "font-weight": "600",
                color: "var(--text-muted, #888)",
                "text-transform": "uppercase",
                "letter-spacing": "0.5px",
              }}
            >
              Global Log Level
            </div>
            <For each={LOG_LEVELS}>
              {(level) => {
                const isSelected = () => globalLevel() === level;
                return (
                  <button
                    onClick={() => handleSetGlobalLevel(level)}
                    style={{
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "space-between",
                      width: "100%",
                      padding: "8px 12px",
                      background: isSelected() ? "var(--bg-active, var(--cortex-bg-hover))" : "transparent",
                      border: "none",
                      color: LOG_LEVEL_COLORS[level],
                      cursor: "pointer",
                      "font-size": "12px",
                      "text-align": "left",
                      transition: "background-color 0.1s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected()) {
                        (e.target as HTMLElement).style.backgroundColor = "var(--bg-hover, var(--cortex-bg-hover))";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected()) {
                        (e.target as HTMLElement).style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        "align-items": "center",
                        gap: "8px",
                      }}
                    >
                      <span style={{ width: "14px", "text-align": "center", "font-weight": "bold" }}>
                        {LOG_LEVEL_INDICATORS[level]}
                      </span>
                      <span>{LOG_LEVEL_LABELS[level]}</span>
                      <span
                        style={{
                          "font-size": "10px",
                          color: "var(--text-muted, #666)",
                        }}
                      >
                        {level === "off" ? "(hide all)" : `(≥ ${level})`}
                      </span>
                    </span>
                    <Show when={isSelected()}>
                      <Icon name="check" style={{ width: "14px", height: "14px", "flex-shrink": "0" }} />
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>

          {/* Channel-specific Section */}
          <Show when={showChannelControls() && channel()}>
            <div
              style={{
                "border-top": "1px solid var(--border, #333)",
                padding: "4px 0",
              }}
            >
              <div
                style={{
                  padding: "4px 12px",
                  "font-size": "10px",
                  "font-weight": "600",
                  color: "var(--text-muted, #888)",
                  "text-transform": "uppercase",
                  "letter-spacing": "0.5px",
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "space-between",
                }}
              >
                <span>Channel: {channel()}</span>
                <Show when={hasChannelOverride()}>
                  <button
                    onClick={handleClearChannelOverride}
                    title="Clear channel override (use global level)"
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "4px",
                      padding: "2px 6px",
                      background: "transparent",
                      border: "1px solid var(--border, #333)",
                      "border-radius": "var(--cortex-radius-sm)",
                      color: "var(--text-muted, #888)",
                      cursor: "pointer",
                      "font-size": "9px",
                      "text-transform": "none",
                      transition: "all 0.1s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.borderColor = "var(--error, var(--cortex-error))";
                      (e.target as HTMLElement).style.color = "var(--error, var(--cortex-error))";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.borderColor = "var(--border, #333)";
                      (e.target as HTMLElement).style.color = "var(--text-muted, #888)";
                    }}
                  >
                    <Icon name="xmark" style={{ width: "10px", height: "10px" }} />
                    <span>Reset</span>
                  </button>
                </Show>
              </div>
              <For each={LOG_LEVELS}>
                {(level) => {
                  const isSelected = () => channelLevel() === level && hasChannelOverride();
                  const isEffective = () => channelLevel() === level;
                  return (
                    <button
                      onClick={() => handleSetChannelLevel(level)}
                      style={{
                        display: "flex",
                        "align-items": "center",
                        "justify-content": "space-between",
                        width: "100%",
                        padding: "8px 12px",
                        background: isSelected() ? "var(--bg-active, var(--cortex-bg-hover))" : "transparent",
                        border: "none",
                        color: LOG_LEVEL_COLORS[level],
                        cursor: "pointer",
                        "font-size": "12px",
                        "text-align": "left",
                        transition: "background-color 0.1s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected()) {
                          (e.target as HTMLElement).style.backgroundColor = "var(--bg-hover, var(--cortex-bg-hover))";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected()) {
                          (e.target as HTMLElement).style.backgroundColor = "transparent";
                        }
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          "align-items": "center",
                          gap: "8px",
                        }}
                      >
                        <span style={{ width: "14px", "text-align": "center", "font-weight": "bold" }}>
                          {LOG_LEVEL_INDICATORS[level]}
                        </span>
                        <span>{LOG_LEVEL_LABELS[level]}</span>
                        <Show when={isEffective() && !hasChannelOverride()}>
                          <span
                            style={{
                              "font-size": "10px",
                              color: "var(--text-muted, #666)",
                              "font-style": "italic",
                            }}
                          >
                            (from global)
                          </span>
                        </Show>
                      </span>
                      <Show when={isSelected()}>
                        <Icon name="check" style={{ width: "14px", height: "14px", "flex-shrink": "0" }} />
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>
          </Show>

          {/* Info Footer */}
          <div
            style={{
              "border-top": "1px solid var(--border, #333)",
              padding: "8px 12px",
              "background-color": "var(--bg-tertiary, var(--cortex-bg-primary))",
            }}
          >
            <div
              style={{
                "font-size": "10px",
                color: "var(--text-muted, #888)",
                "line-height": "1.4",
              }}
            >
              <div style={{ "margin-bottom": "4px" }}>
                <strong>Filters output by severity level:</strong>
              </div>
              <div style={{ display: "flex", "flex-wrap": "wrap", gap: "8px" }}>
                <span>
                  <span style={{ color: LOG_LEVEL_COLORS.trace }}>◦</span> Trace
                </span>
                <span>
                  <span style={{ color: LOG_LEVEL_COLORS.debug }}>○</span> Debug
                </span>
                <span>
                  <span style={{ color: LOG_LEVEL_COLORS.info }}>●</span> Info
                </span>
                <span>
                  <span style={{ color: LOG_LEVEL_COLORS.warning }}>▲</span> Warning
                </span>
                <span>
                  <span style={{ color: LOG_LEVEL_COLORS.error }}>✕</span> Error
                </span>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Click outside overlay */}
      <Show when={isOpen()}>
        <div
          style={{
            position: "fixed",
            inset: "0",
            "z-index": "999",
            cursor: "default",
          }}
          onClick={() => setIsOpen(false)}
        />
      </Show>
    </div>
  );
}

export default LogLevelSelector;

