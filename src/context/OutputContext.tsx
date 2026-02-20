import { createContext, useContext, ParentProps, batch, onMount } from "solid-js";
import { createStore, produce } from "solid-js/store";

/**
 * Log levels in order of verbosity (most verbose to least)
 * - trace: Most detailed debugging information
 * - debug: Debugging information useful for developers
 * - info: General informational messages
 * - warning: Warning messages about potential issues
 * - error: Error messages indicating failures
 * - off: Disable all logging output
 */
export type LogLevel = "trace" | "debug" | "info" | "warning" | "error" | "off";

/**
 * Numeric priority for log levels (lower = more verbose)
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warning: 3,
  error: 4,
  off: 5,
};

/**
 * Display labels for log levels
 */
export const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  trace: "Trace",
  debug: "Debug",
  info: "Info",
  warning: "Warning",
  error: "Error",
  off: "Off",
};

/**
 * All available log levels for iteration
 */
export const LOG_LEVELS: LogLevel[] = ["trace", "debug", "info", "warning", "error", "off"];

/**
 * Storage key for persisting log level settings
 */
const LOG_LEVEL_STORAGE_KEY = "cortex-output-log-level";
const CHANNEL_LOG_LEVELS_STORAGE_KEY = "cortex-output-channel-log-levels";

/**
 * Represents a single line of output with optional styling
 */
export interface OutputLine {
  /** Unique identifier for the line */
  id: string;
  /** Text content of the line */
  text: string;
  /** Timestamp when the line was added */
  timestamp: number;
  /** Optional source identifier (e.g., process, command) */
  source?: string;
  /** Optional severity level for styling */
  severity?: "info" | "warning" | "error" | "success";
  /** Log level of this line */
  logLevel?: LogLevel;
}

/**
 * Represents an output channel
 */
export interface OutputChannel {
  /** Unique name/identifier of the channel */
  name: string;
  /** Display label for the channel */
  label: string;
  /** Output lines in this channel */
  lines: OutputLine[];
  /** Whether this channel is currently visible/revealed */
  visible: boolean;
  /** Maximum number of lines to retain (0 = unlimited) */
  maxLines: number;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Built-in output channel names
 */
export const BUILTIN_CHANNELS = {
  GIT: "Git",
  TASKS: "Tasks",
  LANGUAGE_SERVER: "Language Server",
  EXTENSIONS: "Extensions",
} as const;

export type BuiltinChannelName = (typeof BUILTIN_CHANNELS)[keyof typeof BUILTIN_CHANNELS];

/**
 * Output context state
 */
interface OutputState {
  /** Map of channel name to channel data */
  channels: Record<string, OutputChannel>;
  /** Currently active/selected channel name */
  activeChannel: string | null;
  /** Order of channels for display */
  channelOrder: string[];
  /** Global minimum log level for filtering output */
  logLevel: LogLevel;
  /** Per-channel log level overrides */
  channelLogLevels: Record<string, LogLevel>;
}

/**
 * Options for creating a new channel
 */
export interface CreateChannelOptions {
  /** Display label (defaults to name) */
  label?: string;
  /** Maximum lines to retain (default: 10000) */
  maxLines?: number;
  /** Whether to reveal the channel immediately */
  reveal?: boolean;
}

/**
 * Options for appending a line
 */
export interface AppendLineOptions {
  /** Source identifier */
  source?: string;
  /** Severity level */
  severity?: "info" | "warning" | "error" | "success";
  /** Whether to preserve ANSI codes (default: true) */
  preserveAnsi?: boolean;
  /** Log level of this line (default: info) */
  logLevel?: LogLevel;
}

/**
 * Output context value exposed to consumers
 */
export interface OutputContextValue {
  /** Current state (reactive) */
  state: OutputState;
  
  /** Create a new output channel */
  createChannel: (name: string, options?: CreateChannelOptions) => void;
  
  /** Remove an output channel */
  removeChannel: (name: string) => void;
  
  /** Append a line to a channel */
  appendLine: (channel: string, text: string, options?: AppendLineOptions) => void;
  
  /** Append multiple lines at once */
  appendLines: (channel: string, lines: string[], options?: AppendLineOptions) => void;
  
  /** Clear all lines in a channel */
  clear: (channel: string) => void;
  
  /** Reveal/show a channel (sets it as active) */
  reveal: (channel: string) => void;
  
  /** Hide the output panel */
  hide: () => void;
  
  /** Set the active channel */
  setActiveChannel: (channel: string | null) => void;
  
  /** Get a channel by name */
  getChannel: (name: string) => OutputChannel | undefined;
  
  /** Get all channel names in order */
  getChannelNames: () => string[];
  
  /** Check if a channel exists */
  hasChannel: (name: string) => boolean;
  
  /** Replace all content in a channel */
  replace: (channel: string, lines: string[], options?: AppendLineOptions) => void;
  
  /** Get the line count for a channel */
  getLineCount: (channel: string) => number;
  
  /** Get the current global log level */
  getLogLevel: () => LogLevel;
  
  /** Set the global minimum log level */
  setLogLevel: (level: LogLevel) => void;
  
  /** Get the log level for a specific channel (falls back to global) */
  getChannelLogLevel: (channel: string) => LogLevel;
  
  /** Set a per-channel log level override */
  setChannelLogLevel: (channel: string, level: LogLevel) => void;
  
  /** Clear the per-channel log level override (revert to global) */
  clearChannelLogLevel: (channel: string) => void;
  
  /** Check if a channel has a custom log level override */
  hasChannelLogLevelOverride: (channel: string) => boolean;
  
  /** Log a message with a specific log level */
  log: (level: LogLevel, channel: string, message: string, options?: Omit<AppendLineOptions, "logLevel">) => void;
  
  /** Get filtered lines for a channel based on log level */
  getFilteredLines: (channel: string) => OutputLine[];
  
  /** Check if a line should be visible based on current log level settings */
  isLineVisible: (line: OutputLine, channel: string) => boolean;
}

const OutputContext = createContext<OutputContextValue>();

const DEFAULT_MAX_LINES = 10000;
const DEFAULT_LOG_LEVEL: LogLevel = "info";

/**
 * Generate a unique line ID
 */
function generateLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Load persisted log level from localStorage
 */
function loadPersistedLogLevel(): LogLevel {
  try {
    const stored = localStorage.getItem(LOG_LEVEL_STORAGE_KEY);
    if (stored && LOG_LEVELS.includes(stored as LogLevel)) {
      return stored as LogLevel;
    }
  } catch (err) {
    console.debug("[Output] Load log level failed:", err);
  }
  return DEFAULT_LOG_LEVEL;
}

/**
 * Load persisted channel log levels from localStorage
 */
function loadPersistedChannelLogLevels(): Record<string, LogLevel> {
  try {
    const stored = localStorage.getItem(CHANNEL_LOG_LEVELS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      const result: Record<string, LogLevel> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string" && LOG_LEVELS.includes(value as LogLevel)) {
          result[key] = value as LogLevel;
        }
      }
      return result;
    }
  } catch (err) {
    console.debug("[Output] Load channel levels failed:", err);
  }
  return {};
}

/**
 * Persist log level to localStorage
 */
function persistLogLevel(level: LogLevel): void {
  try {
    localStorage.setItem(LOG_LEVEL_STORAGE_KEY, level);
  } catch (err) {
    console.debug("[Output] Save log level failed:", err);
  }
}

/**
 * Persist channel log levels to localStorage
 */
function persistChannelLogLevels(levels: Record<string, LogLevel>): void {
  try {
    localStorage.setItem(CHANNEL_LOG_LEVELS_STORAGE_KEY, JSON.stringify(levels));
  } catch (err) {
    console.debug("[Output] Save channel levels failed:", err);
  }
}

/**
 * Check if a log level should pass through the filter
 */
function shouldPassLogLevel(lineLevel: LogLevel, filterLevel: LogLevel): boolean {
  if (filterLevel === "off") {
    return false;
  }
  return LOG_LEVEL_PRIORITY[lineLevel] >= LOG_LEVEL_PRIORITY[filterLevel];
}

/**
 * Map severity to log level for backward compatibility
 */
function severityToLogLevel(severity?: OutputLine["severity"]): LogLevel {
  switch (severity) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "success":
    case "info":
    default:
      return "info";
  }
}

/**
 * Create the initial builtin channels
 */
function createBuiltinChannels(): Record<string, OutputChannel> {
  const channels: Record<string, OutputChannel> = {};
  const now = Date.now();
  
  Object.values(BUILTIN_CHANNELS).forEach((name, index) => {
    channels[name] = {
      name,
      label: name,
      lines: [],
      visible: false,
      maxLines: DEFAULT_MAX_LINES,
      createdAt: now + index,
    };
  });
  
  return channels;
}

/**
 * Output Provider component that manages output channels
 */
export function OutputProvider(props: ParentProps) {
  const builtinChannels = createBuiltinChannels();
  
  const [state, setState] = createStore<OutputState>({
    channels: builtinChannels,
    activeChannel: null,
    channelOrder: Object.keys(builtinChannels),
    logLevel: loadPersistedLogLevel(),
    channelLogLevels: loadPersistedChannelLogLevels(),
  });

  // Register developer command for setting log level on mount
  onMount(() => {
    // Dispatch event to register the command
    window.dispatchEvent(new CustomEvent("output:register-log-level-command"));
  });

  const createChannel = (name: string, options: CreateChannelOptions = {}): void => {
    if (state.channels[name]) {
      if (options.reveal) {
        reveal(name);
      }
      return;
    }

    const channel: OutputChannel = {
      name,
      label: options.label ?? name,
      lines: [],
      visible: false,
      maxLines: options.maxLines ?? DEFAULT_MAX_LINES,
      createdAt: Date.now(),
    };

    batch(() => {
      setState(
        produce((s) => {
          s.channels[name] = channel;
          s.channelOrder.push(name);
        })
      );

      if (options.reveal) {
        reveal(name);
      }
    });
  };

  const removeChannel = (name: string): void => {
    if (!state.channels[name]) return;
    
    const isBuiltin = Object.values(BUILTIN_CHANNELS).includes(name as BuiltinChannelName);
    if (isBuiltin) return;

    setState(
      produce((s) => {
        delete s.channels[name];
        const idx = s.channelOrder.indexOf(name);
        if (idx !== -1) {
          s.channelOrder.splice(idx, 1);
        }
        if (s.activeChannel === name) {
          s.activeChannel = s.channelOrder[0] ?? null;
        }
      })
    );
  };

  const appendLine = (channel: string, text: string, options: AppendLineOptions = {}): void => {
    if (!state.channels[channel]) {
      createChannel(channel);
    }

    const line: OutputLine = {
      id: generateLineId(),
      text,
      timestamp: Date.now(),
      source: options.source,
      severity: options.severity,
      logLevel: options.logLevel ?? severityToLogLevel(options.severity),
    };

    setState(
      produce((s) => {
        const ch = s.channels[channel];
        if (!ch) return;
        
        ch.lines.push(line);
        
        if (ch.maxLines > 0 && ch.lines.length > ch.maxLines) {
          const excess = ch.lines.length - ch.maxLines;
          ch.lines.splice(0, excess);
        }
      })
    );
  };

  const appendLines = (channel: string, lines: string[], options: AppendLineOptions = {}): void => {
    if (!state.channels[channel]) {
      createChannel(channel);
    }

    const now = Date.now();
    const lineLogLevel = options.logLevel ?? severityToLogLevel(options.severity);
    const newLines: OutputLine[] = lines.map((text, idx) => ({
      id: generateLineId(),
      text,
      timestamp: now + idx,
      source: options.source,
      severity: options.severity,
      logLevel: lineLogLevel,
    }));

    setState(
      produce((s) => {
        const ch = s.channels[channel];
        if (!ch) return;
        
        ch.lines.push(...newLines);
        
        if (ch.maxLines > 0 && ch.lines.length > ch.maxLines) {
          const excess = ch.lines.length - ch.maxLines;
          ch.lines.splice(0, excess);
        }
      })
    );
  };

  const clear = (channel: string): void => {
    if (!state.channels[channel]) return;

    setState(
      produce((s) => {
        const ch = s.channels[channel];
        if (ch) {
          ch.lines = [];
        }
      })
    );
  };

  const reveal = (channel: string): void => {
    if (!state.channels[channel]) {
      createChannel(channel);
    }

    setState(
      produce((s) => {
        Object.values(s.channels).forEach((ch) => {
          ch.visible = ch.name === channel;
        });
        s.activeChannel = channel;
      })
    );
  };

  const hide = (): void => {
    setState(
      produce((s) => {
        Object.values(s.channels).forEach((ch) => {
          ch.visible = false;
        });
      })
    );
  };

  const setActiveChannel = (channel: string | null): void => {
    if (channel !== null && !state.channels[channel]) return;
    setState("activeChannel", channel);
  };

  const getChannel = (name: string): OutputChannel | undefined => {
    return state.channels[name];
  };

  const getChannelNames = (): string[] => {
    return [...state.channelOrder];
  };

  const hasChannel = (name: string): boolean => {
    return name in state.channels;
  };

  const replace = (channel: string, lines: string[], options: AppendLineOptions = {}): void => {
    if (!state.channels[channel]) {
      createChannel(channel);
    }

    const now = Date.now();
    const lineLogLevel = options.logLevel ?? severityToLogLevel(options.severity);
    const newLines: OutputLine[] = lines.map((text, idx) => ({
      id: generateLineId(),
      text,
      timestamp: now + idx,
      source: options.source,
      severity: options.severity,
      logLevel: lineLogLevel,
    }));

    setState(
      produce((s) => {
        const ch = s.channels[channel];
        if (!ch) return;
        
        ch.lines = newLines;
        
        if (ch.maxLines > 0 && ch.lines.length > ch.maxLines) {
          const excess = ch.lines.length - ch.maxLines;
          ch.lines.splice(0, excess);
        }
      })
    );
  };

  const getLineCount = (channel: string): number => {
    return state.channels[channel]?.lines.length ?? 0;
  };

  const getLogLevel = (): LogLevel => {
    return state.logLevel;
  };

  const setLogLevel = (level: LogLevel): void => {
    setState("logLevel", level);
    persistLogLevel(level);
    window.dispatchEvent(new CustomEvent("output:log-level-changed", { 
      detail: { level, scope: "global" } 
    }));
  };

  const getChannelLogLevel = (channel: string): LogLevel => {
    return state.channelLogLevels[channel] ?? state.logLevel;
  };

  const setChannelLogLevel = (channel: string, level: LogLevel): void => {
    setState(
      produce((s) => {
        s.channelLogLevels[channel] = level;
      })
    );
    persistChannelLogLevels({ ...state.channelLogLevels, [channel]: level });
    window.dispatchEvent(new CustomEvent("output:log-level-changed", { 
      detail: { level, scope: "channel", channel } 
    }));
  };

  const clearChannelLogLevel = (channel: string): void => {
    setState(
      produce((s) => {
        delete s.channelLogLevels[channel];
      })
    );
    const updatedLevels = { ...state.channelLogLevels };
    delete updatedLevels[channel];
    persistChannelLogLevels(updatedLevels);
    window.dispatchEvent(new CustomEvent("output:log-level-changed", { 
      detail: { level: state.logLevel, scope: "channel", channel, cleared: true } 
    }));
  };

  const hasChannelLogLevelOverride = (channel: string): boolean => {
    return channel in state.channelLogLevels;
  };

  const log = (
    level: LogLevel,
    channel: string,
    message: string,
    options?: Omit<AppendLineOptions, "logLevel">
  ): void => {
    appendLine(channel, message, {
      ...options,
      logLevel: level,
      severity: level === "error" 
        ? "error" 
        : level === "warning" 
          ? "warning" 
          : "info",
    });
  };

  const isLineVisible = (line: OutputLine, channel: string): boolean => {
    const effectiveLevel = getChannelLogLevel(channel);
    const lineLevel = line.logLevel ?? severityToLogLevel(line.severity);
    return shouldPassLogLevel(lineLevel, effectiveLevel);
  };

  const getFilteredLines = (channel: string): OutputLine[] => {
    const ch = state.channels[channel];
    if (!ch) return [];
    
    const effectiveLevel = getChannelLogLevel(channel);
    if (effectiveLevel === "trace") {
      // Trace shows everything - no need to filter
      return ch.lines;
    }
    
    return ch.lines.filter((line) => {
      const lineLevel = line.logLevel ?? severityToLogLevel(line.severity);
      return shouldPassLogLevel(lineLevel, effectiveLevel);
    });
  };

  const contextValue: OutputContextValue = {
    state,
    createChannel,
    removeChannel,
    appendLine,
    appendLines,
    clear,
    reveal,
    hide,
    setActiveChannel,
    getChannel,
    getChannelNames,
    hasChannel,
    replace,
    getLineCount,
    getLogLevel,
    setLogLevel,
    getChannelLogLevel,
    setChannelLogLevel,
    clearChannelLogLevel,
    hasChannelLogLevelOverride,
    log,
    getFilteredLines,
    isLineVisible,
  };

  return (
    <OutputContext.Provider value={contextValue}>
      {props.children}
    </OutputContext.Provider>
  );
}

/**
 * Hook to access the output context
 */
export function useOutput(): OutputContextValue {
  const ctx = useContext(OutputContext);
  if (!ctx) {
    throw new Error("useOutput must be used within OutputProvider");
  }
  return ctx;
}
