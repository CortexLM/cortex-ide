import { Show, For, createSignal, createEffect, createMemo, onCleanup, JSX } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Icon } from "./ui/Icon";

// ============================================================================
// Types
// ============================================================================

/** Represents a detected command in the terminal */
export interface TrackedCommand {
  id: string;
  command: string;
  timestamp: number;
  lineStart: number;
  lineEnd: number | null; // null if command is still running
  isRunning: boolean;
  prompt: string;
  exitIndicator?: string; // Store exit status if detected
}

/** Settings for sticky scroll behavior */
export interface StickyScrollSettings {
  enabled: boolean;
  maxCommands: number;
}

/** Props for the TerminalStickyScroll component */
export interface TerminalStickyScrollProps {
  terminalId: string;
  scrollToLine: (line: number) => void;
  currentScrollLine: number;
  totalLines: number;
  visible?: boolean;
  settings?: StickyScrollSettings;
  /** Optional external tracker - if not provided, component creates its own */
  tracker?: CommandTrackerResult;
}

/** Internal store state */
interface StickyScrollState {
  commands: TrackedCommand[];
  currentRunningId: string | null;
}

// ============================================================================
// Prompt Detection Patterns
// ============================================================================

/**
 * Comprehensive prompt detection patterns for various shells.
 * These patterns detect the start of a new command input line.
 */
const PROMPT_PATTERNS: RegExp[] = [
  // PowerShell patterns
  /^PS [A-Za-z]:\\[^>]*>\s*/,                    // PS C:\Users\name>
  /^PS>\s*/,                                      // PS>
  /^PS [^>]+>\s*/,                                // PS path>
  /^\[.*\]\s*PS>\s*/,                             // [env] PS>
  
  // Windows Command Prompt
  /^[A-Za-z]:\\[^>]*>\s*/,                        // C:\Users\name>
  /^[A-Za-z]:>\s*/,                               // C:>
  
  // Bash/Zsh/Fish common patterns
  /^\$\s+/,                                       // $ command
  /^%\s+/,                                        // % command (zsh default)
  /^>\s+/,                                        // > command
  /^#\s+/,                                        // # root prompt
  /^➜\s+/,                                        // ➜ (oh-my-zsh theme)
  /^❯\s+/,                                        // ❯ (pure prompt)
  /^λ\s+/,                                        // λ (lambda prompt)
  /^⟫\s+/,                                        // ⟫ (custom)
  /^»\s+/,                                        // » (custom)
  
  // User@host patterns
  /^[a-zA-Z0-9_-]+@[a-zA-Z0-9_.-]+[:\s][^$#%>]*[$#%>]\s*/,  // user@host:path$
  /^\[[a-zA-Z0-9_-]+@[a-zA-Z0-9_.-]+[^\]]*\]\s*[$#%>]\s*/, // [user@host path]$
  
  // Git-aware prompts (common in oh-my-zsh, starship, etc.)
  /^.*\(.*\)\s*[$#%>➜❯]\s*/,                      // path (branch)$
  /^.*\[.*\]\s*[$#%>➜❯]\s*/,                      // path [branch]$
  
  // Conda/virtualenv prefixes
  /^\([^)]+\)\s*[$#%>➜❯]\s*/,                     // (env) $
  /^\([^)]+\)\s*[A-Za-z]:\\[^>]*>\s*/,            // (env) C:\>
  
  // Nushell
  /^~?\/[^>]*>\s*/,                               // ~/path>
  /^[A-Za-z0-9_-]+>\s*/,                          // name>
  
  // Fish shell
  /^[^@]+@[^:]+:[^>$#%]*[>$#%]\s*/,               // user@host:path>
  
  // Starship and modern prompts (simplified fallback)
  /^[^\n]{0,50}[❯➜λ→»⟫▶]\s+/,                     // Various arrow/symbol prompts
  
  // Generic fallback: line ending with common prompt characters
  /^[^\n]{0,100}[>$#%]\s+(?=[a-zA-Z0-9])/,        // something> command
];

/**
 * Patterns that indicate the end of a command (output finished)
 */
const COMMAND_END_PATTERNS: RegExp[] = [
  // Exit status patterns
  /^\[Process exited with code \d+\]/,
  /^Exit code: \d+/i,
  /^Process finished with exit code \d+/,
  
  // Error patterns that mark command end
  /^Command not found/i,
  /^'[^']+' is not recognized/,
  /^bash: [^:]+: command not found/,
  /^zsh: command not found/,
  /^fish: Unknown command/,
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique ID for commands
 */
function generateCommandId(): string {
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format relative time (e.g., "2m ago", "just now")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 5000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return formatTimestamp(timestamp);
}

/**
 * Truncate command text for display
 */
function truncateCommand(command: string, maxLength: number = 60): string {
  const trimmed = command.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength - 3) + "...";
}

/**
 * Extract the actual command from a line (removing the prompt)
 */
function extractCommand(line: string): { prompt: string; command: string } | null {
  for (const pattern of PROMPT_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const prompt = match[0];
      const command = line.slice(prompt.length).trim();
      if (command.length > 0) {
        return { prompt, command };
      }
    }
  }
  return null;
}

/**
 * Check if a line indicates command completion
 */
function isCommandEndLine(line: string): boolean {
  return COMMAND_END_PATTERNS.some(pattern => pattern.test(line));
}

// ============================================================================
// Custom Hook: useTerminalCommandTracker
// ============================================================================

export interface CommandTrackerOptions {
  maxCommands?: number;
  enabled?: boolean;
}

export interface CommandTrackerResult {
  commands: () => TrackedCommand[];
  currentRunning: () => TrackedCommand | null;
  visibleCommands: (scrollLine: number, maxVisible: number) => TrackedCommand[];
  processLine: (lineNumber: number, lineContent: string) => void;
  processOutput: (startLine: number, lines: string[]) => void;
  markCommandComplete: (commandId: string, lineEnd: number) => void;
  clear: () => void;
}

/**
 * Hook to track commands in terminal output
 */
export function useTerminalCommandTracker(
  options: CommandTrackerOptions = {}
): CommandTrackerResult {
  const maxCommands = options.maxCommands ?? 50;
  const enabled = options.enabled ?? true;

  const [state, setState] = createStore<StickyScrollState>({
    commands: [],
    currentRunningId: null,
  });

  const commands = () => state.commands;

  const currentRunning = (): TrackedCommand | null => {
    if (!state.currentRunningId) return null;
    return state.commands.find(c => c.id === state.currentRunningId) ?? null;
  };

  /**
   * Get commands visible at a given scroll position
   * Returns commands whose output spans the current view
   */
  const visibleCommands = (scrollLine: number, maxVisible: number): TrackedCommand[] => {
    if (!enabled) return [];
    
    const visible: TrackedCommand[] = [];
    const sorted = [...state.commands].sort((a, b) => b.lineStart - a.lineStart);
    
    for (const cmd of sorted) {
      // Command started before current scroll position
      if (cmd.lineStart <= scrollLine) {
        // And either still running or ends after scroll position
        if (cmd.isRunning || (cmd.lineEnd !== null && cmd.lineEnd > scrollLine)) {
          visible.push(cmd);
          if (visible.length >= maxVisible) break;
        }
      }
    }
    
    // Return in chronological order (oldest first for stacking)
    return visible.reverse();
  };

  /**
   * Process a single line from terminal output
   */
  const processLine = (lineNumber: number, lineContent: string): void => {
    if (!enabled) return;

    // Check if this line starts a new command
    const extracted = extractCommand(lineContent);
    if (extracted) {
      setState(produce(s => {
        // Mark previous running command as complete
        if (s.currentRunningId) {
          const prevIdx = s.commands.findIndex(c => c.id === s.currentRunningId);
          if (prevIdx !== -1) {
            s.commands[prevIdx].isRunning = false;
            s.commands[prevIdx].lineEnd = lineNumber - 1;
          }
        }

        // Add new command
        const newCommand: TrackedCommand = {
          id: generateCommandId(),
          command: extracted.command,
          timestamp: Date.now(),
          lineStart: lineNumber,
          lineEnd: null,
          isRunning: true,
          prompt: extracted.prompt,
        };

        s.commands.push(newCommand);
        s.currentRunningId = newCommand.id;

        // Trim old commands if exceeding max
        if (s.commands.length > maxCommands) {
          s.commands = s.commands.slice(-maxCommands);
        }
      }));
      return;
    }

    // Check if this line indicates command completion
    if (isCommandEndLine(lineContent) && state.currentRunningId) {
      setState(produce(s => {
        const idx = s.commands.findIndex(c => c.id === s.currentRunningId);
        if (idx !== -1) {
          s.commands[idx].isRunning = false;
          s.commands[idx].lineEnd = lineNumber;
          s.commands[idx].exitIndicator = lineContent.trim();
        }
        s.currentRunningId = null;
      }));
    }
  };

  /**
   * Process multiple lines of output at once
   */
  const processOutput = (startLine: number, lines: string[]): void => {
    if (!enabled) return;
    lines.forEach((line, index) => {
      processLine(startLine + index, line);
    });
  };

  /**
   * Manually mark a command as complete
   */
  const markCommandComplete = (commandId: string, lineEnd: number): void => {
    setState(produce(s => {
      const idx = s.commands.findIndex(c => c.id === commandId);
      if (idx !== -1) {
        s.commands[idx].isRunning = false;
        s.commands[idx].lineEnd = lineEnd;
      }
      if (s.currentRunningId === commandId) {
        s.currentRunningId = null;
      }
    }));
  };

  /**
   * Clear all tracked commands
   */
  const clear = (): void => {
    setState({ commands: [], currentRunningId: null });
  };

  return {
    commands,
    currentRunning,
    visibleCommands,
    processLine,
    processOutput,
    markCommandComplete,
    clear,
  };
}

// ============================================================================
// Sticky Scroll Header Item Component
// ============================================================================

interface StickyHeaderItemProps {
  command: TrackedCommand;
  onClick: () => void;
  isFirst: boolean;
  isRunning: boolean;
}

function StickyHeaderItem(props: StickyHeaderItemProps): JSX.Element {
  const [showFullTime, setShowFullTime] = createSignal(false);
  const [relativeTime, setRelativeTime] = createSignal(formatRelativeTime(props.command.timestamp));

  // Update relative time periodically
  createEffect(() => {
    const interval = setInterval(() => {
      setRelativeTime(formatRelativeTime(props.command.timestamp));
    }, 10000);
    onCleanup(() => clearInterval(interval));
  });

  return (
    <div
      class="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors hover:bg-[var(--surface-raised)] group"
      style={{
        background: props.isFirst ? "var(--surface-overlay)" : "var(--surface-raised)",
        "border-bottom": "1px solid var(--border-weak)",
        "backdrop-filter": "blur(8px)",
      }}
      onClick={props.onClick}
      onMouseEnter={() => setShowFullTime(true)}
      onMouseLeave={() => setShowFullTime(false)}
    >
      {/* Running indicator or chevron */}
      <div class="shrink-0 w-4 h-4 flex items-center justify-center">
        <Show
          when={props.isRunning}
          fallback={
            <Icon
              name="chevron-right"
              class="w-3 h-3 text-[var(--text-weaker)] group-hover:text-[var(--text-weak)] transition-colors"
            />
          }
        >
          <div
            class="w-2 h-2 rounded-full animate-pulse"
            style={{ background: "var(--cortex-success)" }}
          />
        </Show>
      </div>

      {/* Command text */}
      <div class="flex-1 min-w-0 flex items-center gap-2">
        <span
          class="text-xs font-mono truncate"
          style={{ color: props.isRunning ? "var(--cortex-success)" : "var(--text-base)" }}
          title={props.command.command}
        >
          {truncateCommand(props.command.command, 80)}
        </span>
        
        <Show when={props.isRunning}>
          <span
            class="shrink-0 text-[10px] px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(34, 197, 94, 0.2)",
              color: "var(--cortex-success)",
            }}
          >
            running
          </span>
        </Show>
      </div>

      {/* Timestamp */}
      <div
        class="shrink-0 flex items-center gap-1 text-[10px]"
        style={{ color: "var(--text-weaker)" }}
        title={new Date(props.command.timestamp).toLocaleString()}
      >
        <Icon name="clock" class="w-3 h-3" />
        <span>
          {showFullTime() ? formatTimestamp(props.command.timestamp) : relativeTime()}
        </span>
      </div>

      {/* Line number indicator */}
      <div
        class="shrink-0 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "var(--text-weaker)" }}
      >
        L{props.command.lineStart}
      </div>
    </div>
  );
}

// ============================================================================
// Main TerminalStickyScroll Component
// ============================================================================

export function TerminalStickyScroll(props: TerminalStickyScrollProps): JSX.Element {
  const settings = createMemo(() => props.settings ?? { enabled: true, maxCommands: 5 });
  const isVisible = createMemo(() => props.visible !== false && settings().enabled);

  // Use external tracker if provided, otherwise create internal one
  const internalTracker = props.tracker ? null : useTerminalCommandTracker({
    maxCommands: 50,
    enabled: settings().enabled,
  });
  
  // Get the active tracker (external or internal)
  const tracker = createMemo(() => props.tracker ?? internalTracker!);

  // Get commands to display in sticky header
  const stickyCommands = createMemo(() => {
    if (!isVisible()) return [];
    const t = tracker();
    return t.visibleCommands(props.currentScrollLine, settings().maxCommands);
  });

  // Currently running command
  const runningCommand = createMemo(() => tracker().currentRunning());

  // Handle click on sticky header item
  const handleScrollToCommand = (command: TrackedCommand) => {
    props.scrollToLine(command.lineStart);
  };

  return (
    <Show when={isVisible() && (stickyCommands().length > 0 || runningCommand())}>
      <div
        class="absolute top-0 left-0 right-0 z-30 overflow-hidden"
        style={{
          "max-height": `${(settings().maxCommands + 1) * 32}px`,
          "pointer-events": "auto",
        }}
      >
        {/* Running command header (always on top if present) */}
        <Show when={runningCommand()}>
          {(cmd) => (
            <StickyHeaderItem
              command={cmd()}
              onClick={() => handleScrollToCommand(cmd())}
              isFirst={true}
              isRunning={true}
            />
          )}
        </Show>

        {/* Previous commands sticky headers */}
        <For each={stickyCommands().filter(c => !c.isRunning)}>
          {(command, index) => (
            <StickyHeaderItem
              command={command}
              onClick={() => handleScrollToCommand(command)}
              isFirst={index() === 0 && !runningCommand()}
              isRunning={false}
            />
          )}
        </For>
      </div>
    </Show>
  );
}

// ============================================================================
// Context for Sharing Tracker Between Components
// ============================================================================

import { createContext, useContext, ParentComponent } from "solid-js";

interface TerminalStickyScrollContextValue {
  processLine: (terminalId: string, lineNumber: number, lineContent: string) => void;
  processOutput: (terminalId: string, startLine: number, lines: string[]) => void;
  getTracker: (terminalId: string) => CommandTrackerResult | undefined;
  registerTracker: (terminalId: string, tracker: CommandTrackerResult) => void;
  unregisterTracker: (terminalId: string) => void;
  settings: StickyScrollSettings;
  updateSettings: (settings: Partial<StickyScrollSettings>) => void;
}

const TerminalStickyScrollContext = createContext<TerminalStickyScrollContextValue>();

export const TerminalStickyScrollProvider: ParentComponent<{
  initialSettings?: Partial<StickyScrollSettings>;
}> = (props) => {
  const [settings, setSettings] = createStore<StickyScrollSettings>({
    enabled: props.initialSettings?.enabled ?? true,
    maxCommands: props.initialSettings?.maxCommands ?? 5,
  });

  const trackers = new Map<string, CommandTrackerResult>();

  const processLine = (terminalId: string, lineNumber: number, lineContent: string) => {
    const tracker = trackers.get(terminalId);
    tracker?.processLine(lineNumber, lineContent);
  };

  const processOutput = (terminalId: string, startLine: number, lines: string[]) => {
    const tracker = trackers.get(terminalId);
    tracker?.processOutput(startLine, lines);
  };

  const getTracker = (terminalId: string) => trackers.get(terminalId);

  const registerTracker = (terminalId: string, tracker: CommandTrackerResult) => {
    trackers.set(terminalId, tracker);
  };

  const unregisterTracker = (terminalId: string) => {
    trackers.delete(terminalId);
  };

  const updateSettings = (newSettings: Partial<StickyScrollSettings>) => {
    setSettings(produce(s => {
      if (newSettings.enabled !== undefined) s.enabled = newSettings.enabled;
      if (newSettings.maxCommands !== undefined) s.maxCommands = newSettings.maxCommands;
    }));
  };

  return (
    <TerminalStickyScrollContext.Provider
      value={{
        processLine,
        processOutput,
        getTracker,
        registerTracker,
        unregisterTracker,
        settings,
        updateSettings,
      }}
    >
      {props.children}
    </TerminalStickyScrollContext.Provider>
  );
};

export function useTerminalStickyScroll() {
  const ctx = useContext(TerminalStickyScrollContext);
  if (!ctx) {
    throw new Error("useTerminalStickyScroll must be used within TerminalStickyScrollProvider");
  }
  return ctx;
}

// ============================================================================
// Standalone Hook for Individual Terminal Integration
// ============================================================================

export interface UseTerminalStickyScrollOptions {
  terminalId: string;
  enabled?: boolean;
  maxCommands?: number;
  onScrollToLine?: (line: number) => void;
}

export interface UseTerminalStickyScrollResult {
  tracker: CommandTrackerResult;
  stickyCommands: () => TrackedCommand[];
  runningCommand: () => TrackedCommand | null;
  processLine: (lineNumber: number, content: string) => void;
  processOutput: (startLine: number, lines: string[]) => void;
  scrollToCommand: (command: TrackedCommand) => void;
  currentScrollLine: () => number;
  setCurrentScrollLine: (line: number) => void;
  settings: StickyScrollSettings;
  setEnabled: (enabled: boolean) => void;
  setMaxCommands: (max: number) => void;
}

/**
 * Standalone hook for integrating sticky scroll into a terminal component
 */
export function useTerminalStickyScrollStandalone(
  options: UseTerminalStickyScrollOptions
): UseTerminalStickyScrollResult {
  const [currentScrollLine, setCurrentScrollLine] = createSignal(0);
  const [settings, setSettings] = createStore<StickyScrollSettings>({
    enabled: options.enabled ?? true,
    maxCommands: options.maxCommands ?? 5,
  });

  const tracker = useTerminalCommandTracker({
    maxCommands: 50,
    enabled: settings.enabled,
  });

  const stickyCommands = createMemo(() => {
    if (!settings.enabled) return [];
    return tracker.visibleCommands(currentScrollLine(), settings.maxCommands);
  });

  const runningCommand = createMemo(() => tracker.currentRunning());

  const processLine = (lineNumber: number, content: string) => {
    tracker.processLine(lineNumber, content);
  };

  const processOutput = (startLine: number, lines: string[]) => {
    tracker.processOutput(startLine, lines);
  };

  const scrollToCommand = (command: TrackedCommand) => {
    options.onScrollToLine?.(command.lineStart);
  };

  const setEnabled = (enabled: boolean) => {
    setSettings("enabled", enabled);
  };

  const setMaxCommands = (max: number) => {
    setSettings("maxCommands", Math.max(1, Math.min(20, max)));
  };

  return {
    tracker,
    stickyCommands,
    runningCommand,
    processLine,
    processOutput,
    scrollToCommand,
    currentScrollLine,
    setCurrentScrollLine,
    settings,
    setEnabled,
    setMaxCommands,
  };
}

// Types are already exported above via export interface declarations

