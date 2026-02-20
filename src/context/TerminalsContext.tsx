import { createContext, useContext, ParentComponent, onMount, onCleanup, createSignal, type Accessor } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { terminalLogger } from "../utils/logger";
import { useTauriListen } from "../hooks";

// Shell integration utilities
import {
  ShellIntegrationState as ShellIntegrationStateType,
  createShellIntegrationState,
  processTerminalData,
  ParsedCommand,
  CommandHistory,
} from "../utils/shellIntegration";

// Terminal links utilities
import type { TerminalLink, LinkDetectionOptions } from "../utils/terminalLinks";
import { detectLinks } from "../utils/terminalLinks";

/**
 * Terminal Context - Optimized for performance
 * 
 * Performance optimizations:
 * - Output buffer limited to 10000 lines
 * - requestAnimationFrame batching for UI updates
 * - Debounced resize events (100ms)
 * - Chunked output processing (4KB)
 */

// ============================================================================
// Types - Re-exported from centralized types for backward compatibility
// ============================================================================

import type {
  TerminalInfo,
  UpdateTerminalOptions,
  CreateTerminalOptions,
  TerminalProfileIcon,
  TerminalProfile,
  TerminalProfileConfig,
  TerminalOutput,
  TerminalStatus,
  TerminalsState,
  TerminalGroup,
  TerminalSplitDirection,
  CreateGroupOptions,
  MoveToGroupOptions,
  PersistedTerminalGroupState,
  SSHConfig,
  SSHTerminalInfo,
  SSHTerminalOutput,
  SSHTerminalStatus,
  TerminalEnvironment,
  TerminalQuickFix,
  TerminalQuickFixAction,
  TerminalPersistence,
  ShellIntegrationState,
} from "../types";

import type { AutoReplyRule } from "@/components/terminal/TerminalAutoReplies";
import { loadAutoReplyRules, saveAutoReplyRules, updateRuleTriggerCount } from "@/hooks/useTerminalAutoReply";

// Re-export types for backward compatibility with existing imports
export type {
  TerminalInfo,
  UpdateTerminalOptions,
  CreateTerminalOptions,
  TerminalProfileIcon,
  TerminalProfile,
  TerminalProfileConfig,
  TerminalGroup,
  TerminalSplitDirection,
  CreateGroupOptions,
  MoveToGroupOptions,
  SSHConfig,
  SSHTerminalInfo,
  SSHTerminalOutput,
  SSHTerminalStatus,
  TerminalEnvironment,
  TerminalQuickFix,
  TerminalQuickFixAction,
  TerminalPersistence,
  ShellIntegrationState,
};

// Re-export from terminal links
export type { TerminalLink, LinkDetectionOptions };

// ============================================================================
// Extended Terminal State Types
// ============================================================================

/**
 * Shell integration state per terminal
 */
export interface TerminalShellIntegrationState {
  /** Whether shell integration is enabled/detected */
  enabled: boolean;
  /** Whether command detection is active */
  commandDetection: boolean;
  /** Whether CWD detection is active */
  cwdDetection: boolean;
  /** Current detected CWD from shell integration */
  detectedCwd?: string;
  /** Internal shell integration state */
  internalState: ShellIntegrationStateType;
}

/**
 * Command history entry for a terminal
 */
export interface CommandHistoryEntry {
  /** The command that was executed */
  command: string;
  /** Exit code (undefined if still running or unknown) */
  exitCode?: number;
  /** Timestamp when command was executed */
  timestamp: number;
  /** Duration in milliseconds (if completed) */
  duration?: number;
  /** Working directory when command was executed */
  cwd?: string;
}

/**
 * Terminal links detection state
 */
export interface TerminalLinksState {
  /** Whether link detection is enabled */
  enabled: boolean;
  /** Detected links in the current viewport */
  detectedLinks: TerminalLink[];
  /** Last detection timestamp */
  lastDetection: number;
}

/**
 * Terminal quick fix state
 */
export interface TerminalQuickFixState {
  /** Whether quick fixes are enabled */
  enabled: boolean;
  /** Available quick fixes for current context */
  availableFixes: TerminalQuickFix[];
  /** Last command that triggered quick fixes */
  lastTriggerCommand?: string;
}

/**
 * Recent command entry (for runRecentCommand)
 */
export interface RecentCommandEntry {
  /** The command string */
  command: string;
  /** Terminal ID where it was last run */
  terminalId: string;
  /** Last execution timestamp */
  lastRun: number;
  /** Number of times this command was run */
  runCount: number;
}

/**
 * Persisted terminal state for reconnection
 */
export interface PersistedTerminalState {
  /** Terminal ID */
  id: string;
  /** Terminal name */
  name: string;
  /** Shell path */
  shell: string;
  /** Working directory */
  cwd: string;
  /** Custom color */
  color?: string;
  /** Environment variables */
  env?: TerminalEnvironment;
  /** Profile ID if created from profile */
  profileId?: string;
  /** Group ID if in a group */
  groupId?: string;
  /** Creation timestamp */
  createdAt: number;
  /** Whether reconnection is enabled */
  reconnectOnReload: boolean;
}

interface TerminalsContextValue {
  initialized: Accessor<boolean>;
  state: TerminalsState;
  createTerminal: (options?: CreateTerminalOptions) => Promise<TerminalInfo>;
  closeTerminal: (id: string) => Promise<void>;
  writeToTerminal: (id: string, data: string) => Promise<void>;
  updateTerminalInfo: (id: string, options: UpdateTerminalOptions) => Promise<void>;
  resizeTerminal: (id: string, cols: number, rows: number) => Promise<void>;
  sendInterrupt: (id: string) => Promise<void>;
  sendEof: (id: string) => Promise<void>;
  acknowledgeOutput: (id: string, bytes: number) => Promise<void>;
  setActiveTerminal: (id: string | null) => void;
  togglePanel: () => void;
  openTerminal: (id: string) => void;
  closePanel: () => void;
  refreshTerminals: () => Promise<void>;
  getDefaultShell: () => Promise<string>;
  subscribeToOutput: (callback: (output: TerminalOutput) => void) => () => void;
  // Profile functions
  detectProfiles: () => Promise<void>;
  createProfile: (config: TerminalProfileConfig) => Promise<TerminalProfile>;
  updateProfile: (id: string, config: Partial<TerminalProfileConfig>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  setDefaultProfile: (id: string) => void;
  getDefaultProfile: () => TerminalProfile | null;
  createTerminalWithProfile: (profileId: string) => Promise<TerminalInfo>;
  getProfiles: () => TerminalProfile[];
  getProfile: (id: string) => TerminalProfile | undefined;
  // Group management functions
  createGroup: (options?: CreateGroupOptions) => TerminalGroup;
  deleteGroup: (groupId: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  setActiveGroup: (groupId: string | null) => void;
  getGroup: (groupId: string) => TerminalGroup | undefined;
  getGroupForTerminal: (terminalId: string) => TerminalGroup | undefined;
  addToGroup: (terminalId: string, groupId: string, position?: number) => void;
  removeFromGroup: (terminalId: string) => void;
  moveToGroup: (options: MoveToGroupOptions) => void;
  splitTerminalInGroup: (terminalId: string, direction?: TerminalSplitDirection) => Promise<TerminalInfo>;
  setGroupSplitDirection: (groupId: string, direction: TerminalSplitDirection) => void;
  setGroupSplitRatios: (groupId: string, ratios: number[]) => void;
  reorderTerminalsInGroup: (groupId: string, terminalIds: string[]) => void;
  createTerminalInGroup: (groupId: string, options?: CreateTerminalOptions) => Promise<TerminalInfo>;
  // SSH Terminal functions
  createSSHTerminal: (config: SSHConfig, name?: string) => Promise<TerminalInfo>;
  listSSHSessions: () => Promise<SSHTerminalInfo[]>;
  getSSHSession: (sessionId: string) => Promise<SSHTerminalInfo | null>;
  disconnectSSH: (sessionId: string) => Promise<void>;
  execSSHCommand: (sessionId: string, command: string) => Promise<string>;
  subscribeToSSHOutput: (callback: (output: SSHTerminalOutput) => void) => () => void;
  // Auto-reply functions
  autoReplyRules: () => AutoReplyRule[];
  setAutoReplyRules: (rules: AutoReplyRule[]) => void;
  addAutoReplyRule: (rule: AutoReplyRule) => void;
  updateAutoReplyRule: (id: string, updates: Partial<AutoReplyRule>) => void;
  deleteAutoReplyRule: (id: string) => void;
  toggleAutoReplyRule: (id: string) => void;
  autoReplyEnabled: () => boolean;
  setAutoReplyEnabled: (enabled: boolean) => void;
  // Terminal customization functions
  renameTerminal: (id: string, name: string) => void;
  setTerminalColor: (id: string, color: string | null) => void;
  getTerminalName: (id: string) => string;
  getTerminalColor: (id: string) => string | null;
  // Run commands
  runSelection: (selection: string) => Promise<void>;
  runActiveFile: (filePath: string) => Promise<void>;
  getRunCommand: (filePath: string) => string | null;
  // ============================================================================
  // NEW: Shell Integration State per terminal
  // ============================================================================
  getShellIntegrationState: (terminalId: string) => TerminalShellIntegrationState | undefined;
  setShellIntegrationEnabled: (terminalId: string, enabled: boolean) => void;
  // ============================================================================
  // NEW: Command History per terminal
  // ============================================================================
  getCommandHistory: (terminalId: string) => CommandHistoryEntry[];
  clearCommandHistory: (terminalId: string) => void;
  searchCommandHistory: (terminalId: string, query: string) => CommandHistoryEntry[];
  // ============================================================================
  // NEW: Terminal Persistence (reconnection after reload)
  // ============================================================================
  getPersistedTerminals: () => PersistedTerminalState[];
  persistTerminal: (terminalId: string) => void;
  unpersistTerminal: (terminalId: string) => void;
  reconnectPersistedTerminals: () => Promise<void>;
  setTerminalPersistence: (terminalId: string, persistence: Partial<TerminalPersistence>) => void;
  getTerminalPersistence: (terminalId: string) => TerminalPersistence;
  // ============================================================================
  // NEW: Terminal Links Detection State
  // ============================================================================
  getTerminalLinksState: (terminalId: string) => TerminalLinksState | undefined;
  setLinksDetectionEnabled: (terminalId: string, enabled: boolean) => void;
  detectLinksInLine: (terminalId: string, line: string) => TerminalLink[];
  // ============================================================================
  // NEW: Terminal Quick Fix State
  // ============================================================================
  getQuickFixState: (terminalId: string) => TerminalQuickFixState | undefined;
  setQuickFixEnabled: (terminalId: string, enabled: boolean) => void;
  applyQuickFix: (terminalId: string, action: TerminalQuickFixAction) => Promise<void>;
  // ============================================================================
  // NEW: Recent Commands (global)
  // ============================================================================
  recentCommands: () => RecentCommandEntry[];
  runRecentCommand: (command: string, terminalId?: string) => Promise<void>;
  clearRecentCommands: () => void;
  // ============================================================================
  // NEW: Environment Variables Management
  // ============================================================================
  getTerminalEnvironment: (terminalId: string) => TerminalEnvironment | undefined;
  setTerminalEnvironment: (terminalId: string, env: Partial<TerminalEnvironment>) => void;
  addEnvironmentVariable: (terminalId: string, key: string, value: string) => void;
  removeEnvironmentVariable: (terminalId: string, key: string) => void;
  getInheritedEnvironment: () => Promise<Record<string, string>>;
}

const TerminalsContext = createContext<TerminalsContextValue>();

// Storage key for persisting profiles
const PROFILES_STORAGE_KEY = "cortex_terminal_profiles";
const DEFAULT_PROFILE_STORAGE_KEY = "cortex_terminal_default_profile";
const GROUPS_STORAGE_KEY = "cortex_terminal_groups";
const AUTO_REPLY_ENABLED_KEY = "cortex_terminal_auto_reply_enabled";
const TERMINAL_NAMES_KEY = "cortex_terminal_custom_names";
const TERMINAL_COLORS_KEY = "cortex_terminal_custom_colors";
const PERSISTED_TERMINALS_KEY = "cortex_terminal_persisted";
const RECENT_COMMANDS_KEY = "cortex_terminal_recent_commands";
const COMMAND_HISTORY_KEY = "cortex_terminal_command_history";
const TERMINAL_ENV_KEY = "cortex_terminal_environments";

// ============================================================================
// Run Command Configuration
// ============================================================================

/**
 * Map file extensions to their run commands.
 * The {file} placeholder will be replaced with the file path.
 */
const FILE_RUN_COMMANDS: Record<string, string> = {
  // JavaScript/TypeScript
  ".js": "node {file}",
  ".mjs": "node {file}",
  ".cjs": "node {file}",
  ".ts": "npx ts-node {file}",
  ".tsx": "npx ts-node {file}",
  ".mts": "npx ts-node {file}",
  
  // Python
  ".py": "python {file}",
  ".pyw": "python {file}",
  
  // Shell
  ".sh": "bash {file}",
  ".bash": "bash {file}",
  ".zsh": "zsh {file}",
  ".fish": "fish {file}",
  ".ps1": "powershell -ExecutionPolicy Bypass -File {file}",
  ".bat": "{file}",
  ".cmd": "{file}",
  
  // Rust
  ".rs": "cargo run",
  
  // Go
  ".go": "go run {file}",
  
  // Ruby
  ".rb": "ruby {file}",
  
  // PHP
  ".php": "php {file}",
  
  // Java
  ".java": "java {file}",
  
  // C/C++
  ".c": "gcc {file} -o /tmp/a.out && /tmp/a.out",
  ".cpp": "g++ {file} -o /tmp/a.out && /tmp/a.out",
  ".cc": "g++ {file} -o /tmp/a.out && /tmp/a.out",
  
  // Lua
  ".lua": "lua {file}",
  
  // Perl
  ".pl": "perl {file}",
  
  // R
  ".r": "Rscript {file}",
  ".R": "Rscript {file}",
  
  // Julia
  ".jl": "julia {file}",
  
  // Swift
  ".swift": "swift {file}",
  
  // Kotlin
  ".kt": "kotlinc {file} -include-runtime -d /tmp/app.jar && java -jar /tmp/app.jar",
  ".kts": "kotlinc -script {file}",
  
  // Dart
  ".dart": "dart run {file}",
  
  // Elixir
  ".ex": "elixir {file}",
  ".exs": "elixir {file}",
  
  // Haskell
  ".hs": "runhaskell {file}",
};

// Performance constants
const MAX_OUTPUT_BUFFER_LINES = 10000;
const RESIZE_DEBOUNCE_MS = 100;
const MAX_COMMAND_HISTORY_SIZE = 500;
const MAX_RECENT_COMMANDS = 50;

// Default profile colors
const PROFILE_COLORS = [
  "#6366f1", // Indigo
  "#22c55e", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#84cc16", // Lime
  "#f97316", // Orange
  "#14b8a6", // Teal
];

// Generate unique ID
const generateId = (prefix: string = "id"): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// Generate unique group ID
const generateGroupId = (): string => {
  return generateId("group");
};

// Default group colors for visual distinction
const GROUP_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#84cc16", // Lime
];

// Detect icon based on shell path
const detectProfileIcon = (path: string): TerminalProfileIcon => {
  const lowerPath = path.toLowerCase();
  // WSL distributions - detect distro-specific icons
  if (lowerPath.includes("wsl.exe") || lowerPath.includes("wsl -d")) {
    if (lowerPath.includes("ubuntu")) return "ubuntu";
    if (lowerPath.includes("debian")) return "debian";
    if (lowerPath.includes("fedora")) return "fedora";
    if (lowerPath.includes("arch")) return "arch";
    // Default to bash icon for WSL (most use bash by default)
    return "bash";
  }
  if (lowerPath.includes("powershell") || lowerPath.includes("pwsh")) return "powershell";
  if (lowerPath.includes("bash")) return "bash";
  if (lowerPath.includes("zsh")) return "zsh";
  if (lowerPath.includes("fish")) return "fish";
  if (lowerPath.includes("cmd")) return "cmd";
  if (lowerPath.includes("git")) return "git";
  if (lowerPath.includes("node")) return "node";
  if (lowerPath.includes("python")) return "python";
  if (lowerPath.includes("ruby")) return "ruby";
  if (lowerPath.includes("nu") || lowerPath.includes("nushell")) return "nushell";
  return "terminal";
};

// Get display name from shell path
const getProfileNameFromPath = (path: string): string => {
  const lowerPath = path.toLowerCase();
  // Handle WSL distributions - extract distro name from "wsl.exe -d <distro>" format
  if (lowerPath.includes("wsl.exe") || lowerPath.includes("wsl -d")) {
    const distroMatch = path.match(/wsl(?:\.exe)?\s+-d\s+(\S+)/i);
    if (distroMatch) {
      return `${distroMatch[1]} (WSL)`;
    }
    return "WSL";
  }
  if (lowerPath.includes("powershell") || lowerPath.includes("pwsh")) {
    if (lowerPath.includes("pwsh")) return "PowerShell Core";
    return "Windows PowerShell";
  }
  if (lowerPath.includes("bash")) return "Bash";
  if (lowerPath.includes("zsh")) return "Zsh";
  if (lowerPath.includes("fish")) return "Fish";
  if (lowerPath.includes("cmd")) return "Command Prompt";
  if (lowerPath.includes("git")) return "Git Bash";
  if (lowerPath.includes("nu") || lowerPath.includes("nushell")) return "Nushell";
  // Extract filename without extension
  const filename = path.split(/[/\\]/).pop() || path;
  return filename.replace(/\.[^/.]+$/, "");
};

/**
 * Output buffer manager for limiting line count
 */
class OutputBufferManager {
  private buffers: Map<string, string[]> = new Map();
  private maxLines: number;

  constructor(maxLines: number = MAX_OUTPUT_BUFFER_LINES) {
    this.maxLines = maxLines;
  }

  /**
   * Add output to buffer and trim if over limit
   */
  addOutput(terminalId: string, data: string): string {
    let buffer = this.buffers.get(terminalId) || [];
    
    // Split by newlines and add to buffer
    const newLines = data.split('\n');
    buffer.push(...newLines);
    
    // Trim old lines if over limit
    if (buffer.length > this.maxLines) {
      const trimCount = buffer.length - this.maxLines;
      buffer = buffer.slice(trimCount);
    }
    
    this.buffers.set(terminalId, buffer);
    return data;
  }

  /**
   * Get current line count for a terminal
   */
  getLineCount(terminalId: string): number {
    return this.buffers.get(terminalId)?.length || 0;
  }

  /**
   * Clear buffer for a terminal
   */
  clearBuffer(terminalId: string): void {
    this.buffers.delete(terminalId);
  }

  /**
   * Clear all buffers
   */
  clearAll(): void {
    this.buffers.clear();
  }
}

/**
 * Debounce utility for resize events
 */
function createResizeDebounce(
  fn: (termId: string, cols: number, rows: number) => Promise<void>,
  delay: number
): { call: (termId: string, cols: number, rows: number) => void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: [string, number, number] | null = null;
  
  return {
    call: (termId: string, cols: number, rows: number) => {
      pendingArgs = [termId, cols, rows];
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        if (pendingArgs) {
          fn(pendingArgs[0], pendingArgs[1], pendingArgs[2]);
        }
        timeoutId = null;
        pendingArgs = null;
      }, delay);
    },
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      pendingArgs = null;
    }
  };
}

/**
 * RAF-batched output processor
 */
class OutputProcessor {
  private pendingOutputs: Map<string, TerminalOutput[]> = new Map();
  private rafId: number | null = null;
  private subscribers: Set<(output: TerminalOutput) => void>;
  private terminalSubscribers: Map<string, Set<(output: TerminalOutput) => void>>;

  constructor(
    subscribers: Set<(output: TerminalOutput) => void>,
    terminalSubscribers: Map<string, Set<(output: TerminalOutput) => void>>
  ) {
    this.subscribers = subscribers;
    this.terminalSubscribers = terminalSubscribers;
  }

  /**
   * Queue output for RAF-batched processing
   */
  queueOutput(output: TerminalOutput): void {
    const existing = this.pendingOutputs.get(output.terminal_id) || [];
    existing.push(output);
    this.pendingOutputs.set(output.terminal_id, existing);

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.flush());
    }
  }

  /**
   * Flush pending outputs to subscribers
   */
  private flush(): void {
    this.rafId = null;

    // Process all pending outputs
    this.pendingOutputs.forEach((outputs, terminalId) => {
      // Combine outputs for same terminal
      const combinedData = outputs.map(o => o.data).join('');
      const combinedOutput: TerminalOutput = {
        terminal_id: terminalId,
        data: combinedData
      };

      // Notify global subscribers
      this.subscribers.forEach(callback => {
        try {
          callback(combinedOutput);
        } catch (e) {
          console.error("[Terminals] Error in output subscriber:", e);
        }
      });

      // Notify terminal-specific subscribers
      const terminalSubs = this.terminalSubscribers.get(terminalId);
      if (terminalSubs) {
        terminalSubs.forEach(callback => {
          try {
            callback(combinedOutput);
          } catch (e) {
            console.error("[Terminals] Error in terminal output subscriber:", e);
          }
        });
      }
    });

    this.pendingOutputs.clear();
  }

  /**
   * Force immediate flush
   */
  forceFlush(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.flush();
    }
  }
}

export const TerminalsProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<TerminalsState>({
    terminals: [],
    activeTerminalId: null,
    activeGroupId: null,
    groups: [],
    showPanel: false,
    profiles: [],
    defaultProfileId: null,
    profilesLoaded: false,
  });

  const [initialized, setInitialized] = createSignal(false);
  let backendInitStarted = false;

  const ensureBackendInitialized = async () => {
    if (backendInitStarted) return;
    backendInitStarted = true;

    await refreshTerminals();
    loadGroupState();
    loadAutoReplySettings();

    setTimeout(async () => {
      await detectProfiles();
      loadCommandHistory();
      loadPersistedTerminals();
      loadRecentCommands();
      loadTerminalEnvironments();
      await reconnectPersistedTerminals();
    }, 100);

    setInitialized(true);
  };

  // Auto-reply state
  const [autoReplyRulesState, setAutoReplyRulesState] = createSignal<AutoReplyRule[]>([]);
  const [autoReplyEnabledState, setAutoReplyEnabledState] = createSignal<boolean>(false);
  
  // Auto-reply output buffers per terminal (for pattern matching across chunks)
  const autoReplyBuffers = new Map<string, string>();
  const autoReplyPendingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  const AUTO_REPLY_BUFFER_SIZE = 1000;

  // ============================================================================
  // NEW: Shell Integration State per terminal
  // ============================================================================
  const [shellIntegrationStates, setShellIntegrationStates] = createSignal<
    Map<string, TerminalShellIntegrationState>
  >(new Map());

  // ============================================================================
  // NEW: Command History per terminal
  // ============================================================================
  const [commandHistories, setCommandHistories] = createSignal<
    Map<string, CommandHistoryEntry[]>
  >(new Map());
  const commandHistoryManagers = new Map<string, CommandHistory>();

  // ============================================================================
  // NEW: Terminal Persistence State
  // ============================================================================
  const [persistedTerminals, setPersistedTerminals] = createSignal<PersistedTerminalState[]>([]);
  const [terminalPersistenceSettings, setTerminalPersistenceSettings] = createSignal<
    Map<string, TerminalPersistence>
  >(new Map());

  // ============================================================================
  // NEW: Terminal Links State per terminal
  // ============================================================================
  const [terminalLinksStates, setTerminalLinksStates] = createSignal<
    Map<string, TerminalLinksState>
  >(new Map());

  // ============================================================================
  // NEW: Terminal Quick Fix State per terminal
  // ============================================================================
  const [quickFixStates, setQuickFixStates] = createSignal<
    Map<string, TerminalQuickFixState>
  >(new Map());

  // ============================================================================
  // NEW: Recent Commands (global)
  // ============================================================================
  const [recentCommandsState, setRecentCommandsState] = createSignal<RecentCommandEntry[]>([]);

  // ============================================================================
  // NEW: Terminal Environment Variables
  // ============================================================================
  const [terminalEnvironments, setTerminalEnvironments] = createSignal<
    Map<string, TerminalEnvironment>
  >(new Map());

  // Output subscribers - indexed by terminal ID
  const outputSubscribers = new Map<string, Set<(output: TerminalOutput) => void>>();
  const globalOutputSubscribers = new Set<(output: TerminalOutput) => void>();
  
  // Performance: Output buffer manager
  const outputBufferManager = new OutputBufferManager(MAX_OUTPUT_BUFFER_LINES);
  
  // Performance: RAF-batched output processor
  const outputProcessor = new OutputProcessor(globalOutputSubscribers, outputSubscribers);
  
  // Performance: Resize debouncer per terminal
  const resizeDebouncers = new Map<string, ReturnType<typeof createResizeDebounce>>();
  
  // Track terminals that are closing or have closed to prevent writes
  const closingTerminals = new Set<string>();

  /**
   * Check if a terminal is available for operations (exists and not closing)
   */
  const isTerminalAvailable = (id: string): boolean => {
    if (closingTerminals.has(id)) {
      return false;
    }
    const terminal = state.terminals.find(t => t.id === id);
    if (!terminal) {
      return false;
    }
    // Check for terminal statuses that indicate it's no longer usable
    const unavailableStatuses = ["closed", "exited", "closing", "terminated"];
    return !unavailableStatuses.includes(terminal.status.toLowerCase());
  };

  /**
   * Check if an error indicates the terminal pipe is closed (Windows error 232)
   */
  const isPipeClosedError = (error: unknown): boolean => {
    if (!error) return false;
    const errorStr = String(error).toLowerCase();
    return (
      errorStr.includes("os error 232") ||
      errorStr.includes("pipe") ||
      errorStr.includes("broken pipe") ||
      errorStr.includes("channel") ||
      errorStr.includes("fermé") || // French: "closed"
      errorStr.includes("communication") ||
      errorStr.includes("closed") ||
      errorStr.includes("not found") ||
      errorStr.includes("does not exist")
    );
  };

  /**
   * Mark a terminal as closing and remove it from state
   */
  const markTerminalClosed = (id: string): void => {
    closingTerminals.add(id);
    
    // Clean up auto-reply state for this terminal
    if (autoReplyBuffers) {
      autoReplyBuffers.delete(id);
    }

    // Clean up pending timeouts for this terminal
    if (autoReplyPendingTimeouts) {
      autoReplyPendingTimeouts.forEach((timeout, key) => {
        if (key.startsWith(`${id}:`)) {
          clearTimeout(timeout);
          autoReplyPendingTimeouts.delete(key);
        }
      });
    }
    
    // Clean up output buffer
    outputBufferManager.clearBuffer(id);
    
    // Clean up resize debouncer
    const debouncer = resizeDebouncers.get(id);
    if (debouncer) {
      debouncer.cancel();
      resizeDebouncers.delete(id);
    }

    // Clean up new states
    setShellIntegrationStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
    commandHistoryManagers.delete(id);
    setTerminalLinksStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
    setQuickFixStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
    setTerminalEnvironments(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
    
    setState(produce((s) => {
      // Remove terminal from any group it belongs to
      for (const group of s.groups) {
        const idx = group.terminalIds.indexOf(id);
        if (idx !== -1) {
          group.terminalIds.splice(idx, 1);
          // Update split ratios
          const count = group.terminalIds.length;
          if (count > 0) {
            group.splitRatios = Array(count).fill(1 / count);
          } else {
            group.splitRatios = [];
          }
          break;
        }
      }
      
      // Clean up empty groups
      s.groups = s.groups.filter(g => g.terminalIds.length > 0);
      
      // Update active group if needed
      if (s.activeGroupId && !s.groups.find(g => g.id === s.activeGroupId)) {
        s.activeGroupId = s.groups.length > 0 ? s.groups[0].id : null;
      }
      
      s.terminals = s.terminals.filter(t => t.id !== id);
      if (s.activeTerminalId === id) {
        s.activeTerminalId = s.terminals.length > 0 ? s.terminals[s.terminals.length - 1].id : null;
      }
    }));
    // Clean up subscribers for this terminal
    outputSubscribers.delete(id);
  };

  const createTerminal = async (options?: CreateTerminalOptions): Promise<TerminalInfo> => {
    await ensureBackendInitialized();
    try {
      const terminal = await invoke<TerminalInfo>("terminal_create", { options });
      
      // Ensure new terminal is not marked as closing (defensive - IDs should be unique)
      closingTerminals.delete(terminal.id);
      
      setState(produce((s) => {
        if (!s.terminals.find(t => t.id === terminal.id)) {
          s.terminals.push(terminal);
        }
      }));

      // Initialize new terminal states
      initShellIntegrationState(terminal.id);
      initTerminalLinksState(terminal.id);
      initQuickFixState(terminal.id);
      initTerminalEnvironment(terminal.id);

      return terminal;
    } catch (e) {
      console.error("[Terminals] Failed to create terminal:", e);
      throw e;
    }
  };

  const closeTerminal = async (id: string): Promise<void> => {
    // Mark as closing immediately to prevent further writes
    closingTerminals.add(id);
    
    try {
      await invoke("terminal_close", { terminalId: id });
    } catch (e) {
      // If it's a pipe closed error, the terminal is already gone - that's fine
      if (!isPipeClosedError(e)) {
        console.error("[Terminals] Failed to close terminal:", e);
      }
    } finally {
      // Always clean up the terminal from state
      markTerminalClosed(id);
    }
  };

  const writeToTerminal = async (id: string, data: string): Promise<void> => {
    // Check if terminal is available before attempting write
    if (!isTerminalAvailable(id)) {
      console.debug(`[Terminals] Skipping write to unavailable terminal ${id}`);
      return;
    }
    
    const terminal = state.terminals.find(t => t.id === id);
    
    try {
      if (terminal?.type === "ssh" && terminal.sshSessionId) {
        await invoke("ssh_pty_write", { sessionId: terminal.sshSessionId, data });
      } else {
        await invoke("terminal_write", { terminalId: id, data });
      }
    } catch (e) {
      // Handle pipe closed errors gracefully - terminal has closed
      if (isPipeClosedError(e)) {
        console.debug(`[Terminals] Terminal ${id} pipe closed, marking as closed`);
        markTerminalClosed(id);
        // Don't throw - this is expected behavior when terminal closes
        return;
      }
      console.error("[Terminals] Failed to write to terminal:", e);
      throw e;
    }
  };

  const updateTerminalInfo = async (id: string, options: UpdateTerminalOptions): Promise<void> => {
    if (!isTerminalAvailable(id)) return;
    
    try {
      await invoke<TerminalInfo>("terminal_update", { terminalId: id, options });
      
      setState(produce((s) => {
        const terminal = s.terminals.find(t => t.id === id);
        if (terminal) {
          if (options.cwd) terminal.cwd = options.cwd;
          if (options.last_command) terminal.last_command = options.last_command;
          if (options.last_exit_code !== undefined) terminal.last_exit_code = options.last_exit_code;
          if (options.command_running !== undefined) terminal.command_running = options.command_running;
        }
      }));
    } catch (e) {
      if (!isPipeClosedError(e)) {
        console.error("[Terminals] Failed to update terminal info:", e);
      }
    }
  };

  /**
   * Resize terminal with debouncing for performance
   */
  const resizeTerminal = async (id: string, cols: number, rows: number): Promise<void> => {
    // Check if terminal is available before attempting resize
    if (!isTerminalAvailable(id)) {
      console.debug(`[Terminals] Skipping resize for unavailable terminal ${id}`);
      return;
    }
    
    // Get or create debouncer for this terminal
    let debouncer = resizeDebouncers.get(id);
    if (!debouncer) {
      debouncer = createResizeDebounce(async (termId: string, c: number, r: number) => {
        try {
          // Re-fetch terminal in case state changed
          const term = state.terminals.find(t => t.id === termId);
          if (term?.type === "ssh" && term.sshSessionId) {
            await invoke("ssh_pty_resize", { sessionId: term.sshSessionId, cols: c, rows: r });
          } else {
            await invoke("terminal_resize", { terminalId: termId, cols: c, rows: r });
          }
        } catch (e) {
          if (isPipeClosedError(e)) {
            console.debug(`[Terminals] Terminal ${termId} pipe closed during resize, marking as closed`);
            markTerminalClosed(termId);
            return;
          }
          console.error("[Terminals] Failed to resize terminal:", e);
        }
      }, RESIZE_DEBOUNCE_MS);
      resizeDebouncers.set(id, debouncer);
    }
    
    // Call debounced resize
    debouncer.call(id, cols, rows);
  };

  const sendInterrupt = async (id: string): Promise<void> => {
    // Check if terminal is available before attempting interrupt
    if (!isTerminalAvailable(id)) {
      console.debug(`[Terminals] Skipping interrupt for unavailable terminal ${id}`);
      return;
    }
    
    try {
      await invoke("terminal_send_interrupt", { terminalId: id });
    } catch (e) {
      // Handle pipe closed errors gracefully
      if (isPipeClosedError(e)) {
        console.debug(`[Terminals] Terminal ${id} pipe closed during interrupt, marking as closed`);
        markTerminalClosed(id);
        return;
      }
      console.error("[Terminals] Failed to send interrupt:", e);
      throw e;
    }
  };

  const sendEof = async (id: string): Promise<void> => {
    // Check if terminal is available before attempting EOF
    if (!isTerminalAvailable(id)) {
      console.debug(`[Terminals] Skipping EOF for unavailable terminal ${id}`);
      return;
    }
    
    try {
      await invoke("terminal_send_eof", { terminalId: id });
    } catch (e) {
      // Handle pipe closed errors gracefully
      if (isPipeClosedError(e)) {
        console.debug(`[Terminals] Terminal ${id} pipe closed during EOF, marking as closed`);
        markTerminalClosed(id);
        return;
      }
      console.error("[Terminals] Failed to send EOF:", e);
      throw e;
    }
  };

  /**
   * Acknowledge processed output bytes for flow control
   * This releases backpressure to allow more output to flow from the backend
   */
  const acknowledgeOutput = async (id: string, bytes: number): Promise<void> => {
    // Skip if terminal is unavailable - no point acknowledging
    if (!isTerminalAvailable(id)) {
      return;
    }
    
    const terminal = state.terminals.find(t => t.id === id);
    
    try {
      if (terminal?.type === "ssh" && terminal.sshSessionId) {
        await invoke("ssh_pty_ack", { sessionId: terminal.sshSessionId, bytes });
      } else {
        await invoke("terminal_ack", { terminalId: id, bytes });
      }
    } catch (e) {
      // Silently ignore errors - ack is best-effort
      // Terminal may have closed between output and ack
      if (!isPipeClosedError(e)) {
        console.debug("[Terminals] Failed to acknowledge output:", e);
      }
    }
  };

  const setActiveTerminal = (id: string | null) => {
    setState("activeTerminalId", id);
  };

  const togglePanel = () => {
    if (!state.showPanel) {
      ensureBackendInitialized();
    }
    setState("showPanel", !state.showPanel);
  };

  const openTerminal = (id: string) => {
    ensureBackendInitialized();
    setState("activeTerminalId", id);
    setState("showPanel", true);
  };

  const closePanel = () => {
    setState("showPanel", false);
  };

  const refreshTerminals = async (): Promise<void> => {
    try {
      const terminals = await invoke<TerminalInfo[]>("terminal_list");
      setState("terminals", terminals);
    } catch (e) {
      console.error("[Terminals] Failed to refresh terminals:", e);
    }
  };

  const getDefaultShell = async (): Promise<string> => {
    try {
      return await invoke<string>("terminal_get_default_shell");
    } catch (e) {
      console.error("[Terminals] Failed to get default shell:", e);
      return "";
    }
  };

  // ============================================================================
  // Profile Management Functions
  // ============================================================================

  /**
   * Load profiles from persistent storage
   */
  const loadProfiles = (): void => {
    try {
      const storedProfiles = localStorage.getItem(PROFILES_STORAGE_KEY);
      const storedDefault = localStorage.getItem(DEFAULT_PROFILE_STORAGE_KEY);
      
      if (storedProfiles) {
        const profiles = JSON.parse(storedProfiles) as TerminalProfile[];
        setState("profiles", profiles);
      }
      
      if (storedDefault) {
        setState("defaultProfileId", storedDefault);
      }
    } catch (e) {
      console.error("[Terminals] Failed to load profiles from storage:", e);
    }
  };

  /**
   * Save profiles to persistent storage
   */
  const saveProfiles = (): void => {
    try {
      // Only save custom profiles (not builtin)
      const customProfiles = state.profiles.filter(p => !p.isBuiltin);
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(customProfiles));
      
      if (state.defaultProfileId) {
        localStorage.setItem(DEFAULT_PROFILE_STORAGE_KEY, state.defaultProfileId);
      }
    } catch (e) {
      console.error("[Terminals] Failed to save profiles to storage:", e);
    }
  };

  /**
   * Detect available shell profiles on the system
   */
  const detectProfiles = async (): Promise<void> => {
    try {
      // Get available shells from the backend
      const availableShells = await invoke<string[]>("terminal_detect_shells").catch(() => []);
      
      // Get default shell
      const defaultShell = await getDefaultShell();
      
      // Common shell paths to check (will be filtered by what exists)
      const potentialShells: string[] = [
        // Windows
        "C:\\Windows\\System32\\cmd.exe",
        "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
        "C:\\Program Files\\Git\\bin\\bash.exe",
        "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
        // Unix-like
        "/bin/bash",
        "/bin/zsh",
        "/bin/fish",
        "/usr/bin/bash",
        "/usr/bin/zsh",
        "/usr/bin/fish",
        "/usr/local/bin/bash",
        "/usr/local/bin/zsh",
        "/usr/local/bin/fish",
        "/opt/homebrew/bin/bash",
        "/opt/homebrew/bin/zsh",
        "/opt/homebrew/bin/fish",
        "/usr/bin/nu",
        "/usr/local/bin/nu",
      ];

      // Combine backend-detected shells with potential shells
      const shellsToCheck = new Set([...availableShells, ...potentialShells]);
      
      // Check which shells exist
      const existingShells: string[] = [];
      for (const shell of shellsToCheck) {
        try {
          const exists = await invoke<boolean>("path_exists", { path: shell }).catch(() => false);
          if (exists) {
            existingShells.push(shell);
          }
        } catch (err) {
          console.debug("[Terminals] Shell check failed:", err);
        }
      }

      // Add default shell if not already in the list
      if (defaultShell && !existingShells.includes(defaultShell)) {
        existingShells.unshift(defaultShell);
      }

      // Build profile list from existing shells
      const builtinProfiles: TerminalProfile[] = existingShells.map((shellPath, index) => {
        const isDefault = shellPath === defaultShell;
        return {
          id: `builtin_${shellPath.replace(/[^a-zA-Z0-9]/g, "_")}`,
          name: getProfileNameFromPath(shellPath),
          path: shellPath,
          args: [],
          icon: detectProfileIcon(shellPath),
          color: PROFILE_COLORS[index % PROFILE_COLORS.length],
          env: {},
          isBuiltin: true,
          isDefault: isDefault && !state.defaultProfileId,
        };
      });

      // Load custom profiles
      loadProfiles();

      // Merge builtin with custom profiles
      setState(produce((s) => {
        // Keep existing custom profiles
        const customProfiles = s.profiles.filter(p => !p.isBuiltin);
        
        // Apply default status
        const allProfiles = [...builtinProfiles, ...customProfiles].map(p => ({
          ...p,
          isDefault: p.id === s.defaultProfileId || (p.isDefault && !s.defaultProfileId),
        }));

        s.profiles = allProfiles;
        s.profilesLoaded = true;

        // Set default if not set
        if (!s.defaultProfileId && allProfiles.length > 0) {
          const defaultProfile = allProfiles.find(p => p.isDefault) || allProfiles[0];
          s.defaultProfileId = defaultProfile.id;
        }
      }));

      terminalLogger.debug("Detected profiles:", state.profiles.length);
    } catch (e) {
      terminalLogger.error("Failed to detect profiles:", e);
      setState("profilesLoaded", true);
    }
  };

  /**
   * Create a new custom terminal profile
   */
  const createProfile = async (config: TerminalProfileConfig): Promise<TerminalProfile> => {
    const profile: TerminalProfile = {
      id: generateId(),
      name: config.name,
      path: config.path,
      args: config.args || [],
      icon: config.icon || detectProfileIcon(config.path),
      color: config.color || PROFILE_COLORS[state.profiles.length % PROFILE_COLORS.length],
      env: config.env || {},
      isBuiltin: false,
      isDefault: false,
    };

    setState(produce((s) => {
      s.profiles.push(profile);
    }));

    saveProfiles();
    terminalLogger.debug("Created profile:", profile.name);
    return profile;
  };

  /**
   * Update an existing profile
   */
  const updateProfile = async (id: string, config: Partial<TerminalProfileConfig>): Promise<void> => {
    setState(produce((s) => {
      const index = s.profiles.findIndex(p => p.id === id);
      if (index !== -1) {
        const profile = s.profiles[index];
        if (config.name !== undefined) profile.name = config.name;
        if (config.path !== undefined) profile.path = config.path;
        if (config.args !== undefined) profile.args = config.args;
        if (config.icon !== undefined) profile.icon = config.icon;
        if (config.color !== undefined) profile.color = config.color;
        if (config.env !== undefined) profile.env = config.env;
      }
    }));

    saveProfiles();
    terminalLogger.debug("Updated profile:", id);
  };

  /**
   * Delete a custom profile
   */
  const deleteProfile = async (id: string): Promise<void> => {
    const profile = state.profiles.find(p => p.id === id);
    if (!profile) return;
    
    if (profile.isBuiltin) {
      terminalLogger.warn("Cannot delete builtin profile:", id);
      return;
    }

    setState(produce((s) => {
      s.profiles = s.profiles.filter(p => p.id !== id);
      
      // If deleted profile was default, set first available as default
      if (s.defaultProfileId === id) {
        s.defaultProfileId = s.profiles[0]?.id || null;
      }
    }));

    saveProfiles();
    terminalLogger.debug("Deleted profile:", id);
  };

  /**
   * Set a profile as the default
   */
  const setDefaultProfile = (id: string): void => {
    setState(produce((s) => {
      // Update isDefault flag on all profiles
      s.profiles = s.profiles.map(p => ({
        ...p,
        isDefault: p.id === id,
      }));
      s.defaultProfileId = id;
    }));

    saveProfiles();
    terminalLogger.debug("Set default profile:", id);
  };

  /**
   * Get the current default profile
   */
  const getDefaultProfile = (): TerminalProfile | null => {
    if (state.defaultProfileId) {
      return state.profiles.find(p => p.id === state.defaultProfileId) || null;
    }
    return state.profiles.find(p => p.isDefault) || state.profiles[0] || null;
  };

  /**
   * Create a terminal using a specific profile
   */
  const createTerminalWithProfile = async (profileId: string): Promise<TerminalInfo> => {
    const profile = state.profiles.find(p => p.id === profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const options: CreateTerminalOptions = {
      name: profile.name,
      shell: profile.path,
      env: profile.env,
    };

    // Add args if present - the shell path already includes the program,
    // but args should be passed separately
    if (profile.args.length > 0) {
      // Shell path with args joined
      options.shell = `${profile.path} ${profile.args.join(" ")}`;
    }

    const terminal = await createTerminal(options);
    terminalLogger.debug("Created terminal with profile:", profile.name);
    return terminal;
  };

  /**
   * Get all profiles
   */
  const getProfiles = (): TerminalProfile[] => {
    return state.profiles;
  };

  /**
   * Get a specific profile by ID
   */
  const getProfile = (id: string): TerminalProfile | undefined => {
    return state.profiles.find(p => p.id === id);
  };

  // ============================================================================
  // Group Management Functions
  // ============================================================================

  /**
   * Load persisted group state from storage
   */
  const loadGroupState = (): void => {
    try {
      const stored = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (stored) {
        const groupState = JSON.parse(stored) as PersistedTerminalGroupState;
        setState("activeGroupId", groupState.activeGroupId);
        // Note: Groups will be recreated when terminals are created
        terminalLogger.debug("Loaded group state:", groupState.groups.length, "groups");
      }
    } catch (e) {
      terminalLogger.error("Failed to load group state:", e);
    }
  };

  /**
   * Save group state to storage
   */
  const saveGroupState = (): void => {
    try {
      const groupState: PersistedTerminalGroupState = {
        activeGroupId: state.activeGroupId,
        groups: state.groups.map(g => ({
          id: g.id,
          name: g.name,
          splitDirection: g.splitDirection,
          color: g.color,
          icon: g.icon,
        })),
      };
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groupState));
    } catch (e) {
      terminalLogger.error("Failed to save group state:", e);
    }
  };

  /**
   * Create a new terminal group
   */
  const createGroup = (options?: CreateGroupOptions): TerminalGroup => {
    const groupCount = state.groups.length;
    const group: TerminalGroup = {
      id: generateGroupId(),
      name: options?.name || `Group ${groupCount + 1}`,
      terminalIds: [],
      splitDirection: options?.splitDirection || "horizontal",
      splitRatios: [],
      isCollapsed: false,
      color: options?.color || GROUP_COLORS[groupCount % GROUP_COLORS.length],
      icon: options?.icon,
      createdAt: Date.now(),
    };

    setState(produce((s) => {
      s.groups.push(group);
    }));

    saveGroupState();
    terminalLogger.debug("Created group:", group.name);
    return group;
  };

  /**
   * Delete a terminal group (terminals are moved to ungrouped or closed)
   */
  const deleteGroup = (groupId: string): void => {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;

    setState(produce((s) => {
      // Remove group
      s.groups = s.groups.filter(g => g.id !== groupId);
      
      // Update active group if needed
      if (s.activeGroupId === groupId) {
        s.activeGroupId = s.groups.length > 0 ? s.groups[0].id : null;
      }
    }));

    saveGroupState();
    terminalLogger.debug("Deleted group:", groupId);
  };

  /**
   * Rename a terminal group
   */
  const renameGroup = (groupId: string, name: string): void => {
    setState(produce((s) => {
      const group = s.groups.find(g => g.id === groupId);
      if (group) {
        group.name = name;
      }
    }));
    saveGroupState();
  };

  /**
   * Set the active terminal group
   */
  const setActiveGroup = (groupId: string | null): void => {
    setState("activeGroupId", groupId);
    
    // Also set the first terminal in the group as active
    if (groupId) {
      const group = state.groups.find(g => g.id === groupId);
      if (group && group.terminalIds.length > 0) {
        setState("activeTerminalId", group.terminalIds[0]);
      }
    }
    
    saveGroupState();
  };

  /**
   * Get a group by ID
   */
  const getGroup = (groupId: string): TerminalGroup | undefined => {
    return state.groups.find(g => g.id === groupId);
  };

  /**
   * Get the group containing a terminal
   */
  const getGroupForTerminal = (terminalId: string): TerminalGroup | undefined => {
    return state.groups.find(g => g.terminalIds.includes(terminalId));
  };

  /**
   * Add a terminal to a group
   */
  const addToGroup = (terminalId: string, groupId: string, position?: number): void => {
    // First remove from any existing group
    removeFromGroup(terminalId);

    setState(produce((s) => {
      const group = s.groups.find(g => g.id === groupId);
      if (group) {
        // Add terminal at specified position or end
        if (position !== undefined && position >= 0 && position <= group.terminalIds.length) {
          group.terminalIds.splice(position, 0, terminalId);
        } else {
          group.terminalIds.push(terminalId);
        }
        
        // Update split ratios to be equal
        const count = group.terminalIds.length;
        group.splitRatios = Array(count).fill(1 / count);
      }
    }));

    saveGroupState();
    terminalLogger.debug("Added terminal to group:", terminalId, "->", groupId);
  };

  /**
   * Remove a terminal from its group
   */
  const removeFromGroup = (terminalId: string): void => {
    setState(produce((s) => {
      for (const group of s.groups) {
        const idx = group.terminalIds.indexOf(terminalId);
        if (idx !== -1) {
          group.terminalIds.splice(idx, 1);
          
          // Update split ratios
          const count = group.terminalIds.length;
          if (count > 0) {
            group.splitRatios = Array(count).fill(1 / count);
          } else {
            group.splitRatios = [];
          }
          
          // Clean up empty groups
          if (count === 0) {
            const groupIdx = s.groups.indexOf(group);
            if (groupIdx !== -1) {
              s.groups.splice(groupIdx, 1);
              if (s.activeGroupId === group.id) {
                s.activeGroupId = s.groups.length > 0 ? s.groups[0].id : null;
              }
            }
          }
          break;
        }
      }
    }));

    saveGroupState();
  };

  /**
   * Move a terminal to a specific group (or create new group)
   */
  const moveToGroup = (options: MoveToGroupOptions): void => {
    const { terminalId, targetGroupId, position } = options;

    if (targetGroupId === null) {
      // Create new group with this terminal
      const group = createGroup();
      addToGroup(terminalId, group.id, position);
    } else {
      addToGroup(terminalId, targetGroupId, position);
    }
  };

  /**
   * Split a terminal within its group (create new terminal side-by-side)
   */
  const splitTerminalInGroup = async (
    terminalId: string, 
    direction?: TerminalSplitDirection
  ): Promise<TerminalInfo> => {
    const existingGroup = getGroupForTerminal(terminalId);
    const terminal = state.terminals.find(t => t.id === terminalId);
    
    // Create new terminal with same working directory
    const newTerminal = await createTerminal({
      cwd: terminal?.cwd,
    });

    if (existingGroup) {
      // Add to existing group after the source terminal
      const position = existingGroup.terminalIds.indexOf(terminalId) + 1;
      addToGroup(newTerminal.id, existingGroup.id, position);
      
      // Update split direction if specified
      if (direction) {
        setGroupSplitDirection(existingGroup.id, direction);
      }
    } else {
      // Create new group with both terminals
      const group = createGroup({
        splitDirection: direction || "horizontal",
      });
      addToGroup(terminalId, group.id);
      addToGroup(newTerminal.id, group.id);
      setActiveGroup(group.id);
    }

    // Make new terminal active
    setState("activeTerminalId", newTerminal.id);
    
    terminalLogger.debug("Split terminal:", terminalId, "->", newTerminal.id);
    return newTerminal;
  };

  /**
   * Set the split direction for a group
   */
  const setGroupSplitDirection = (groupId: string, direction: TerminalSplitDirection): void => {
    setState(produce((s) => {
      const group = s.groups.find(g => g.id === groupId);
      if (group) {
        group.splitDirection = direction;
      }
    }));
    saveGroupState();
  };

  /**
   * Set custom split ratios for a group
   */
  const setGroupSplitRatios = (groupId: string, ratios: number[]): void => {
    setState(produce((s) => {
      const group = s.groups.find(g => g.id === groupId);
      if (group && ratios.length === group.terminalIds.length) {
        // Normalize ratios to sum to 1
        const sum = ratios.reduce((a, b) => a + b, 0);
        group.splitRatios = ratios.map(r => r / sum);
      }
    }));
    saveGroupState();
  };

  /**
   * Reorder terminals within a group
   */
  const reorderTerminalsInGroup = (groupId: string, terminalIds: string[]): void => {
    setState(produce((s) => {
      const group = s.groups.find(g => g.id === groupId);
      if (group) {
        // Validate that all terminals exist in the group
        const validIds = terminalIds.filter(id => group.terminalIds.includes(id));
        if (validIds.length === group.terminalIds.length) {
          group.terminalIds = validIds;
        }
      }
    }));
    saveGroupState();
  };

  /**
   * Create a new terminal directly in a group
   */
  const createTerminalInGroup = async (
    groupId: string, 
    options?: CreateTerminalOptions
  ): Promise<TerminalInfo> => {
    const terminal = await createTerminal(options);
    addToGroup(terminal.id, groupId);
    setState("activeTerminalId", terminal.id);
    return terminal;
  };

  // ============================================================================
  // SSH Terminal Functions
  // ============================================================================

  // SSH output subscribers
  const sshOutputSubscribers = new Set<(output: SSHTerminalOutput) => void>();
  
  // Map SSH session ID to terminal ID
  const sshSessionToTerminal = new Map<string, string>();

  // ============================================================================
  // Auto-Reply Functions
  // ============================================================================

  /**
   * Load auto-reply settings from storage
   */
  const loadAutoReplySettings = (): void => {
    try {
      const rules = loadAutoReplyRules();
      setAutoReplyRulesState(rules);
      
      const enabledStr = localStorage.getItem(AUTO_REPLY_ENABLED_KEY);
      setAutoReplyEnabledState(enabledStr === "true");
    } catch (e) {
      terminalLogger.error("Failed to load auto-reply settings:", e);
    }
  };

  /**
   * Process terminal output for auto-reply matches
   */
  const processAutoReply = async (terminalId: string, data: string): Promise<void> => {
    if (!autoReplyEnabledState()) return;
    
    const rules = autoReplyRulesState();
    if (rules.length === 0) return;
    
    const terminal = state.terminals.find(t => t.id === terminalId);
    const terminalName = terminal?.name || "";

    // Update buffer with new data
    let buffer = autoReplyBuffers.get(terminalId) || "";
    buffer += data;
    
    // Trim buffer if too large
    if (buffer.length > AUTO_REPLY_BUFFER_SIZE) {
      buffer = buffer.slice(-AUTO_REPLY_BUFFER_SIZE);
    }
    autoReplyBuffers.set(terminalId, buffer);

    // Check each enabled rule
    for (const rule of rules) {
      if (!rule.enabled) continue;

      // Check terminal filter
      if (rule.terminalFilter) {
        const filterLower = rule.terminalFilter.toLowerCase();
        const nameLower = terminalName.toLowerCase();
        const idLower = terminalId.toLowerCase();
        
        if (!nameLower.includes(filterLower) && !idLower.includes(filterLower)) {
          continue;
        }
      }

      // Skip if already has pending timeout for this rule
      const pendingKey = `${terminalId}:${rule.id}`;
      if (autoReplyPendingTimeouts.has(pendingKey)) continue;

      // Check for pattern match
      try {
        const flags = rule.caseSensitive ? "g" : "gi";
        const regex = new RegExp(rule.pattern, flags);
        const match = buffer.match(regex);
        
        if (match) {
          const matchedText = match[0];
          
          // Clear matched portion from buffer
          const matchIndex = buffer.lastIndexOf(matchedText);
          if (matchIndex >= 0) {
            const newBuffer = buffer.slice(matchIndex + matchedText.length);
            autoReplyBuffers.set(terminalId, newBuffer);
          }

          // Execute reply (with optional delay)
          const executeReply = async () => {
            try {
              await writeToTerminal(terminalId, rule.reply);
              updateRuleTriggerCount(rule.id);
              terminalLogger.debug(`AutoReply rule "${rule.name}" triggered in terminal ${terminalId}`);
            } catch (e) {
              terminalLogger.error(`AutoReply failed to send reply for rule ${rule.id}:`, e);
            }
            autoReplyPendingTimeouts.delete(pendingKey);
          };

          if (rule.delay && rule.delay > 0) {
            const timeout = setTimeout(executeReply, rule.delay);
            autoReplyPendingTimeouts.set(pendingKey, timeout);
          } else {
            executeReply();
          }

          // Only match one rule per chunk to avoid conflicts
          break;
        }
      } catch (e) {
        terminalLogger.error(`AutoReply invalid pattern in rule ${rule.id}:`, e);
      }
    }
  };

  /**
   * Get auto-reply rules
   */
  const autoReplyRules = () => autoReplyRulesState();

  /**
   * Set auto-reply rules
   */
  const setAutoReplyRules = (rules: AutoReplyRule[]): void => {
    setAutoReplyRulesState(rules);
    saveAutoReplyRules(rules);
  };

  /**
   * Add a new auto-reply rule
   */
  const addAutoReplyRule = (rule: AutoReplyRule): void => {
    const rules = [...autoReplyRulesState(), rule];
    setAutoReplyRules(rules);
  };

  /**
   * Update an existing auto-reply rule
   */
  const updateAutoReplyRule = (id: string, updates: Partial<AutoReplyRule>): void => {
    const rules = autoReplyRulesState().map(r => 
      r.id === id ? { ...r, ...updates } : r
    );
    setAutoReplyRules(rules);
  };

  /**
   * Delete an auto-reply rule
   */
  const deleteAutoReplyRule = (id: string): void => {
    const rules = autoReplyRulesState().filter(r => r.id !== id);
    setAutoReplyRules(rules);
  };

  /**
   * Toggle an auto-reply rule enabled/disabled
   */
  const toggleAutoReplyRule = (id: string): void => {
    const rules = autoReplyRulesState().map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    setAutoReplyRules(rules);
  };

  /**
   * Get auto-reply enabled state
   */
  const autoReplyEnabled = () => autoReplyEnabledState();

  /**
   * Set auto-reply enabled state
   */
  const setAutoReplyEnabled = (enabled: boolean): void => {
    setAutoReplyEnabledState(enabled);
    localStorage.setItem(AUTO_REPLY_ENABLED_KEY, String(enabled));
    
    // Clear buffers and pending timeouts when disabled
    if (!enabled) {
      autoReplyBuffers.clear();
      autoReplyPendingTimeouts.forEach(timeout => clearTimeout(timeout));
      autoReplyPendingTimeouts.clear();
    }
  };

  // ============================================================================
  // NEW: Shell Integration State Functions
  // ============================================================================

  /**
   * Initialize shell integration state for a terminal
   */
  const initShellIntegrationState = (terminalId: string): void => {
    const newState: TerminalShellIntegrationState = {
      enabled: false,
      commandDetection: false,
      cwdDetection: false,
      internalState: createShellIntegrationState(),
    };
    setShellIntegrationStates(prev => {
      const newMap = new Map(prev);
      newMap.set(terminalId, newState);
      return newMap;
    });
    
    // Also initialize command history manager
    commandHistoryManagers.set(terminalId, new CommandHistory(MAX_COMMAND_HISTORY_SIZE));
  };

  /**
   * Get shell integration state for a terminal
   */
  const getShellIntegrationState = (terminalId: string): TerminalShellIntegrationState | undefined => {
    return shellIntegrationStates().get(terminalId);
  };

  /**
   * Set shell integration enabled for a terminal
   */
  const setShellIntegrationEnabled = (terminalId: string, enabled: boolean): void => {
    setShellIntegrationStates(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(terminalId);
      if (existing) {
        newMap.set(terminalId, { ...existing, enabled });
      }
      return newMap;
    });
  };

  /**
   * Process shell integration data from terminal output
   */
  const processShellIntegration = (terminalId: string, data: string, offset: number): void => {
    const current = shellIntegrationStates().get(terminalId);
    if (!current) return;

    const newInternalState = processTerminalData(data, current.internalState, offset);
    
    // Check if shell integration was detected
    const integrationEnabled = newInternalState.enabled;
    
    // Update state
    setShellIntegrationStates(prev => {
      const newMap = new Map(prev);
      newMap.set(terminalId, {
        ...current,
        enabled: integrationEnabled,
        commandDetection: integrationEnabled,
        cwdDetection: integrationEnabled && !!newInternalState.currentCwd,
        detectedCwd: newInternalState.currentCwd,
        internalState: newInternalState,
      });
      return newMap;
    });

    // Process new commands for history
    const historyManager = commandHistoryManagers.get(terminalId);
    if (historyManager && newInternalState.commands.length > current.internalState.commands.length) {
      const newCommands = newInternalState.commands.slice(current.internalState.commands.length);
      for (const cmd of newCommands) {
        historyManager.add(cmd);
        addToCommandHistory(terminalId, cmd);
        addToRecentCommands(cmd.command, terminalId);
      }
    }
  };

  // ============================================================================
  // NEW: Command History Functions
  // ============================================================================

  /**
   * Load command history from storage
   */
  const loadCommandHistory = (): void => {
    try {
      const stored = localStorage.getItem(COMMAND_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, CommandHistoryEntry[]>;
        const newMap = new Map<string, CommandHistoryEntry[]>();
        for (const [termId, entries] of Object.entries(parsed)) {
          newMap.set(termId, entries);
        }
        setCommandHistories(newMap);
      }
    } catch (e) {
      console.error("[Terminals] Failed to load command history:", e);
    }
  };

  /**
   * Save command history to storage
   */
  const saveCommandHistory = (): void => {
    try {
      const histories = commandHistories();
      const obj: Record<string, CommandHistoryEntry[]> = {};
      histories.forEach((entries, termId) => {
        // Only save last 100 entries per terminal
        obj[termId] = entries.slice(-100);
      });
      localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(obj));
    } catch (e) {
      console.error("[Terminals] Failed to save command history:", e);
    }
  };

  /**
   * Add command to terminal history
   */
  const addToCommandHistory = (terminalId: string, cmd: ParsedCommand): void => {
    const entry: CommandHistoryEntry = {
      command: cmd.command,
      exitCode: cmd.exitCode,
      timestamp: cmd.timestamp,
      duration: cmd.duration,
      cwd: cmd.cwd,
    };

    setCommandHistories(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(terminalId) || [];
      const updated = [...existing, entry].slice(-MAX_COMMAND_HISTORY_SIZE);
      newMap.set(terminalId, updated);
      return newMap;
    });

    // Debounce save
    saveCommandHistory();
  };

  /**
   * Get command history for a terminal
   */
  const getCommandHistory = (terminalId: string): CommandHistoryEntry[] => {
    return commandHistories().get(terminalId) || [];
  };

  /**
   * Clear command history for a terminal
   */
  const clearCommandHistory = (terminalId: string): void => {
    setCommandHistories(prev => {
      const newMap = new Map(prev);
      newMap.delete(terminalId);
      return newMap;
    });
    commandHistoryManagers.get(terminalId)?.clear();
    saveCommandHistory();
  };

  /**
   * Search command history
   */
  const searchCommandHistory = (terminalId: string, query: string): CommandHistoryEntry[] => {
    const history = commandHistories().get(terminalId) || [];
    const lowerQuery = query.toLowerCase();
    return history.filter(entry => 
      entry.command.toLowerCase().includes(lowerQuery)
    ).reverse();
  };

  // ============================================================================
  // NEW: Terminal Persistence Functions
  // ============================================================================

  /**
   * Load persisted terminals from storage
   */
  const loadPersistedTerminals = (): void => {
    try {
      const stored = localStorage.getItem(PERSISTED_TERMINALS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PersistedTerminalState[];
        setPersistedTerminals(parsed);
      }
    } catch (e) {
      console.error("[Terminals] Failed to load persisted terminals:", e);
    }
  };

  /**
   * Save persisted terminals to storage
   */
  const savePersistedTerminals = (): void => {
    try {
      localStorage.setItem(PERSISTED_TERMINALS_KEY, JSON.stringify(persistedTerminals()));
    } catch (e) {
      console.error("[Terminals] Failed to save persisted terminals:", e);
    }
  };

  /**
   * Get all persisted terminal states
   */
  const getPersistedTerminals = (): PersistedTerminalState[] => {
    return persistedTerminals();
  };

  /**
   * Persist a terminal for reconnection
   */
  const persistTerminal = (terminalId: string): void => {
    const terminal = state.terminals.find(t => t.id === terminalId);
    if (!terminal) return;

    const group = getGroupForTerminal(terminalId);
    const env = terminalEnvironments().get(terminalId);

    const persistedState: PersistedTerminalState = {
      id: terminalId,
      name: getTerminalName(terminalId),
      shell: terminal.shell,
      cwd: terminal.cwd,
      color: getTerminalColor(terminalId) || undefined,
      env: env,
      groupId: group?.id,
      createdAt: terminal.created_at,
      reconnectOnReload: true,
    };

    setPersistedTerminals(prev => {
      const filtered = prev.filter(p => p.id !== terminalId);
      return [...filtered, persistedState];
    });
    savePersistedTerminals();
    terminalLogger.debug("Persisted terminal:", terminalId);
  };

  /**
   * Remove terminal from persistence
   */
  const unpersistTerminal = (terminalId: string): void => {
    setPersistedTerminals(prev => prev.filter(p => p.id !== terminalId));
    savePersistedTerminals();
    terminalLogger.debug("Unpersisted terminal:", terminalId);
  };

  /**
   * Reconnect all persisted terminals
   */
  const reconnectPersistedTerminals = async (): Promise<void> => {
    const terminals = persistedTerminals();
    if (terminals.length === 0) return;

    terminalLogger.debug("Reconnecting", terminals.length, "persisted terminals...");

    for (const persisted of terminals) {
      if (!persisted.reconnectOnReload) continue;

      try {
        const options: CreateTerminalOptions = {
          name: persisted.name,
          cwd: persisted.cwd,
          shell: persisted.shell,
          env: persisted.env?.added,
        };

        const newTerminal = await createTerminal(options);
        
        // Restore custom settings
        if (persisted.color) {
          setTerminalColor(newTerminal.id, persisted.color);
        }
        if (persisted.name) {
          renameTerminal(newTerminal.id, persisted.name);
        }
        
        // Add to group if it existed
        if (persisted.groupId) {
          const group = state.groups.find(g => g.id === persisted.groupId);
          if (group) {
            addToGroup(newTerminal.id, persisted.groupId);
          }
        }

        terminalLogger.debug("Reconnected terminal:", persisted.name);
      } catch (e) {
        terminalLogger.error("Failed to reconnect terminal:", persisted.name, e);
      }
    }

    // Clear persisted state after reconnection
    setPersistedTerminals([]);
    savePersistedTerminals();
  };

  /**
   * Set terminal persistence settings
   */
  const setTerminalPersistence = (terminalId: string, persistence: Partial<TerminalPersistence>): void => {
    setTerminalPersistenceSettings(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(terminalId) || {
        enabled: false,
        history: true,
        reconnectOnReload: false,
      };
      newMap.set(terminalId, { ...existing, ...persistence });
      return newMap;
    });
  };

  /**
   * Get terminal persistence settings
   */
  const getTerminalPersistence = (terminalId: string): TerminalPersistence => {
    return terminalPersistenceSettings().get(terminalId) || {
      enabled: false,
      history: true,
      reconnectOnReload: false,
    };
  };

  // ============================================================================
  // NEW: Terminal Links Functions
  // ============================================================================

  /**
   * Initialize links state for a terminal
   */
  const initTerminalLinksState = (terminalId: string): void => {
    const newState: TerminalLinksState = {
      enabled: true,
      detectedLinks: [],
      lastDetection: 0,
    };
    setTerminalLinksStates(prev => {
      const newMap = new Map(prev);
      newMap.set(terminalId, newState);
      return newMap;
    });
  };

  /**
   * Get terminal links state
   */
  const getTerminalLinksState = (terminalId: string): TerminalLinksState | undefined => {
    return terminalLinksStates().get(terminalId);
  };

  /**
   * Set links detection enabled
   */
  const setLinksDetectionEnabled = (terminalId: string, enabled: boolean): void => {
    setTerminalLinksStates(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(terminalId);
      if (existing) {
        newMap.set(terminalId, { ...existing, enabled });
      }
      return newMap;
    });
  };

  /**
   * Detect links in a line
   */
  const detectLinksInLine = (terminalId: string, line: string): TerminalLink[] => {
    const linksState = terminalLinksStates().get(terminalId);
    if (!linksState?.enabled) return [];

    const terminal = state.terminals.find(t => t.id === terminalId);
    const options: LinkDetectionOptions = {
      cwd: terminal?.cwd,
      detectUrls: true,
      detectFiles: true,
    };

    const links = detectLinks(line, options);

    // Update state with detected links
    setTerminalLinksStates(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(terminalId);
      if (existing) {
        newMap.set(terminalId, {
          ...existing,
          detectedLinks: links,
          lastDetection: Date.now(),
        });
      }
      return newMap;
    });

    return links;
  };

  // ============================================================================
  // NEW: Quick Fix Functions
  // ============================================================================

  /**
   * Initialize quick fix state for a terminal
   */
  const initQuickFixState = (terminalId: string): void => {
    const newState: TerminalQuickFixState = {
      enabled: true,
      availableFixes: [],
    };
    setQuickFixStates(prev => {
      const newMap = new Map(prev);
      newMap.set(terminalId, newState);
      return newMap;
    });
  };

  /**
   * Get quick fix state for a terminal
   */
  const getQuickFixState = (terminalId: string): TerminalQuickFixState | undefined => {
    return quickFixStates().get(terminalId);
  };

  /**
   * Set quick fix enabled
   */
  const setQuickFixEnabled = (terminalId: string, enabled: boolean): void => {
    setQuickFixStates(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(terminalId);
      if (existing) {
        newMap.set(terminalId, { ...existing, enabled });
      }
      return newMap;
    });
  };


  /**
   * Apply a quick fix action
   */
  const applyQuickFix = async (terminalId: string, action: TerminalQuickFixAction): Promise<void> => {
    if (!isTerminalAvailable(terminalId)) return;
    
    try {
      await writeToTerminal(terminalId, action.command + "\n");
      terminalLogger.debug("Applied quick fix:", action.title);
      
      // Clear quick fixes after applying
      setQuickFixStates(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(terminalId);
        if (existing) {
          newMap.set(terminalId, { ...existing, availableFixes: [] });
        }
        return newMap;
      });
    } catch (e) {
      terminalLogger.error("Failed to apply quick fix:", e);
    }
  };

  // ============================================================================
  // NEW: Recent Commands Functions
  // ============================================================================

  /**
   * Load recent commands from storage
   */
  const loadRecentCommands = (): void => {
    try {
      const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentCommandEntry[];
        setRecentCommandsState(parsed);
      }
    } catch (e) {
      terminalLogger.error("Failed to load recent commands:", e);
    }
  };

  /**
   * Save recent commands to storage
   */
  const saveRecentCommands = (): void => {
    try {
      localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(recentCommandsState()));
    } catch (e) {
      terminalLogger.error("Failed to save recent commands:", e);
    }
  };

  /**
   * Add command to recent commands
   */
  const addToRecentCommands = (command: string, terminalId: string): void => {
    if (!command.trim()) return;

    setRecentCommandsState(prev => {
      const existing = prev.find(e => e.command === command);
      if (existing) {
        // Update existing entry
        const updated = prev.map(e => 
          e.command === command 
            ? { ...e, terminalId, lastRun: Date.now(), runCount: e.runCount + 1 }
            : e
        );
        // Sort by lastRun descending
        updated.sort((a, b) => b.lastRun - a.lastRun);
        return updated.slice(0, MAX_RECENT_COMMANDS);
      } else {
        // Add new entry
        const newEntry: RecentCommandEntry = {
          command,
          terminalId,
          lastRun: Date.now(),
          runCount: 1,
        };
        return [newEntry, ...prev].slice(0, MAX_RECENT_COMMANDS);
      }
    });

    saveRecentCommands();
  };

  /**
   * Get recent commands
   */
  const recentCommands = (): RecentCommandEntry[] => {
    return recentCommandsState();
  };

  /**
   * Run a recent command
   */
  const runRecentCommand = async (command: string, terminalId?: string): Promise<void> => {
    const targetId = terminalId || state.activeTerminalId;
    if (!targetId) {
      // Create new terminal if none exists
      const newTerminal = await createTerminal();
      await new Promise(resolve => setTimeout(resolve, 200));
      await writeToTerminal(newTerminal.id, command + "\n");
      openTerminal(newTerminal.id);
      return;
    }

    if (!isTerminalAvailable(targetId)) {
      terminalLogger.warn("Target terminal not available:", targetId);
      return;
    }

    await writeToTerminal(targetId, command + "\n");
    addToRecentCommands(command, targetId);
    terminalLogger.debug("Ran recent command:", command);
  };

  /**
   * Clear recent commands
   */
  const clearRecentCommands = (): void => {
    setRecentCommandsState([]);
    saveRecentCommands();
  };

  // ============================================================================
  // NEW: Environment Variables Functions
  // ============================================================================

  /**
   * Load terminal environments from storage
   */
  const loadTerminalEnvironments = (): void => {
    try {
      const stored = localStorage.getItem(TERMINAL_ENV_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, TerminalEnvironment>;
        const newMap = new Map<string, TerminalEnvironment>();
        for (const [termId, env] of Object.entries(parsed)) {
          newMap.set(termId, env);
        }
        setTerminalEnvironments(newMap);
      }
    } catch (e) {
      terminalLogger.error("Failed to load terminal environments:", e);
    }
  };

  /**
   * Save terminal environments to storage
   */
  const saveTerminalEnvironments = (): void => {
    try {
      const envs = terminalEnvironments();
      const obj: Record<string, TerminalEnvironment> = {};
      envs.forEach((env, termId) => {
        obj[termId] = env;
      });
      localStorage.setItem(TERMINAL_ENV_KEY, JSON.stringify(obj));
    } catch (e) {
      terminalLogger.error("Failed to save terminal environments:", e);
    }
  };

  /**
   * Initialize environment for a terminal
   */
  const initTerminalEnvironment = async (terminalId: string): Promise<void> => {
    const inherited = await getInheritedEnvironment();
    const env: TerminalEnvironment = {
      inherited,
      added: {},
      removed: [],
    };
    setTerminalEnvironments(prev => {
      const newMap = new Map(prev);
      newMap.set(terminalId, env);
      return newMap;
    });
  };

  /**
   * Get environment for a terminal
   */
  const getTerminalEnvironment = (terminalId: string): TerminalEnvironment | undefined => {
    return terminalEnvironments().get(terminalId);
  };

  /**
   * Set terminal environment
   */
  const setTerminalEnvironment = (terminalId: string, env: Partial<TerminalEnvironment>): void => {
    setTerminalEnvironments(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(terminalId) || { inherited: {}, added: {}, removed: [] };
      newMap.set(terminalId, { ...existing, ...env });
      return newMap;
    });
    saveTerminalEnvironments();
  };

  /**
   * Add an environment variable
   */
  const addEnvironmentVariable = (terminalId: string, key: string, value: string): void => {
    setTerminalEnvironments(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(terminalId) || { inherited: {}, added: {}, removed: [] };
      const newAdded = { ...existing.added, [key]: value };
      // Remove from removed if it was there
      const newRemoved = existing.removed.filter(k => k !== key);
      newMap.set(terminalId, { ...existing, added: newAdded, removed: newRemoved });
      return newMap;
    });
    saveTerminalEnvironments();
  };

  /**
   * Remove an environment variable
   */
  const removeEnvironmentVariable = (terminalId: string, key: string): void => {
    setTerminalEnvironments(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(terminalId) || { inherited: {}, added: {}, removed: [] };
      const newAdded = { ...existing.added };
      delete newAdded[key];
      const newRemoved = existing.removed.includes(key) ? existing.removed : [...existing.removed, key];
      newMap.set(terminalId, { ...existing, added: newAdded, removed: newRemoved });
      return newMap;
    });
    saveTerminalEnvironments();
  };

  /**
   * Get inherited environment variables from system
   */
  const getInheritedEnvironment = async (): Promise<Record<string, string>> => {
    try {
      return await invoke<Record<string, string>>("get_environment_variables");
    } catch (e) {
      console.error("[Terminals] Failed to get inherited environment:", e);
      // Return empty object as fallback
      return {};
    }
  };

  /**
   * Create an SSH terminal connected to a remote host
   */
  const createSSHTerminal = async (config: SSHConfig, name?: string): Promise<TerminalInfo> => {
    try {
      // Connect to SSH and create PTY session
      const sshInfo = await invoke<SSHTerminalInfo>("ssh_connect", { 
        config,
        cols: 120,
        rows: 30,
      });

      // Create local terminal info to track in our state
      const terminalId = generateId("ssh_term");
      const terminalInfo: TerminalInfo = {
        id: terminalId,
        name: name || sshInfo.name,
        cwd: sshInfo.cwd || sshInfo.remote_home || "~",
        shell: `SSH: ${sshInfo.username}@${sshInfo.host}`,
        cols: sshInfo.cols,
        rows: sshInfo.rows,
        status: typeof sshInfo.status === "string" ? sshInfo.status : "error",
        created_at: sshInfo.created_at,
        command_running: false,
        type: "ssh",
        sshConfig: config,
        sshSessionId: sshInfo.id,
      };

      // Map SSH session to terminal
      sshSessionToTerminal.set(sshInfo.id, terminalId);

      // Add to terminals state
      setState(produce((s) => {
        if (!s.terminals.find(t => t.id === terminalId)) {
          s.terminals.push(terminalInfo);
        }
      }));

      terminalLogger.debug("SSH terminal created:", terminalId, "session:", sshInfo.id);
      return terminalInfo;
    } catch (e) {
      terminalLogger.error("Failed to create SSH terminal:", e);
      throw e;
    }
  };

  /**
   * List all SSH sessions
   */
  const listSSHSessions = async (): Promise<SSHTerminalInfo[]> => {
    try {
      return await invoke<SSHTerminalInfo[]>("ssh_list_sessions");
    } catch (e) {
      terminalLogger.error("Failed to list SSH sessions:", e);
      return [];
    }
  };

  /**
   * Get a specific SSH session
   */
  const getSSHSession = async (sessionId: string): Promise<SSHTerminalInfo | null> => {
    try {
      return await invoke<SSHTerminalInfo | null>("ssh_get_session", { sessionId });
    } catch (e) {
      terminalLogger.error("Failed to get SSH session:", e);
      return null;
    }
  };

  /**
   * Disconnect an SSH session
   */
  const disconnectSSH = async (sessionId: string): Promise<void> => {
    try {
      await invoke("ssh_disconnect", { sessionId });
      
      // Remove from terminal list
      const terminalId = sshSessionToTerminal.get(sessionId);
      if (terminalId) {
        sshSessionToTerminal.delete(sessionId);
        markTerminalClosed(terminalId);
      }
    } catch (e) {
      terminalLogger.error("Failed to disconnect SSH:", e);
      throw e;
    }
  };

  /**
   * Execute a command on SSH session (non-PTY)
   */
  const execSSHCommand = async (sessionId: string, command: string): Promise<string> => {
    try {
      return await invoke<string>("ssh_exec", { sessionId, command });
    } catch (e) {
      terminalLogger.error("Failed to exec SSH command:", e);
      throw e;
    }
  };

  /**
   * Subscribe to SSH terminal output
   */
  const subscribeToSSHOutput = (callback: (output: SSHTerminalOutput) => void): (() => void) => {
    sshOutputSubscribers.add(callback);
    return () => {
      sshOutputSubscribers.delete(callback);
    };
  };

  // ============================================================================

  const subscribeToOutput = (callback: (output: TerminalOutput) => void): (() => void) => {
    globalOutputSubscribers.add(callback);
    return () => {
      globalOutputSubscribers.delete(callback);
    };
  };

  // Listen for terminal events from Tauri using useTauriListen hook
  // terminal:created event
  useTauriListen<TerminalInfo>("terminal:created", (payload) => {
    setState(produce((s) => {
      if (!s.terminals.find(t => t.id === payload.id)) {
        s.terminals.push(payload);
      }
    }));
  });

  // terminal:output event - direct dispatch for real-time TUI responsiveness
  useTauriListen<TerminalOutput>("terminal:output", (output) => {
    // Immediately notify all subscribers for real-time display
    // This is critical for TUI apps like htop, vim, claude-tui
    globalOutputSubscribers.forEach(callback => {
      try {
        callback(output);
      } catch (e) {
        console.error("[Terminals] Error in output subscriber:", e);
      }
    });
    
    // Also notify terminal-specific subscribers
    const terminalSubs = outputSubscribers.get(output.terminal_id);
    if (terminalSubs) {
      terminalSubs.forEach(callback => {
        try {
          callback(output);
        } catch (e) {
          console.error("[Terminals] Error in terminal subscriber:", e);
        }
      });
    }
    
    // Track output in buffer manager (deferred - non-critical)
    const lineCount = outputBufferManager.getLineCount(output.terminal_id);
    outputBufferManager.addOutput(output.terminal_id, output.data);
    
    // Process shell integration sequences
    processShellIntegration(output.terminal_id, output.data, lineCount);
    
    // Process auto-reply rules
    processAutoReply(output.terminal_id, output.data).catch(() => {});
    
    // Acknowledge output for flow control (release backpressure)
    acknowledgeOutput(output.terminal_id, output.data.length).catch(() => {});
  });

  // terminal:status event
  useTauriListen<TerminalStatus>("terminal:status", (payload) => {
    const terminalId = payload.terminal_id;
    const status = payload.status.toLowerCase();
    
    // Mark terminal as closing for statuses that indicate it's no longer usable
    if (status === "closed" || status === "exited" || status === "closing" || status === "terminated") {
      closingTerminals.add(terminalId);
      // Clean up subscribers for this terminal
      outputSubscribers.delete(terminalId);
      // Clean up output buffer
      outputBufferManager.clearBuffer(terminalId);
    }
    
    setState(produce((s) => {
      const terminal = s.terminals.find(t => t.id === terminalId);
      if (terminal) {
        terminal.status = payload.status;
        if (payload.exit_code !== undefined) {
          terminal.exitCode = payload.exit_code;
        }
      }

      // If terminal exited/closed, remove it from list
      if (status === "closed") {
        s.terminals = s.terminals.filter(t => t.id !== terminalId);
        if (s.activeTerminalId === terminalId) {
          s.activeTerminalId = s.terminals.length > 0 ? s.terminals[s.terminals.length - 1].id : null;
        }
      }
    }));
  });

  // ssh_terminal:output event
  useTauriListen<SSHTerminalOutput>("ssh_terminal:output", (output) => {
    // Find the corresponding local terminal ID
    const terminalId = sshSessionToTerminal.get(output.session_id);
    
    // Notify SSH-specific subscribers
    sshOutputSubscribers.forEach(callback => {
      try {
        callback(output);
      } catch (e) {
        terminalLogger.error("Error in SSH output subscriber:", e);
      }
    });
    
    // Also emit as regular terminal output for the TerminalPanel
    if (terminalId) {
      const terminalOutput: TerminalOutput = {
        terminal_id: terminalId,
        data: output.data,
      };
      
      globalOutputSubscribers.forEach(callback => {
        try {
          callback(terminalOutput);
        } catch (e) {
          terminalLogger.error("Error in output subscriber:", e);
        }
      });
    }
  });

  // ssh_terminal:status event
  useTauriListen<SSHTerminalStatus>("ssh_terminal:status", (payload) => {
    const { session_id, status } = payload;
    const terminalId = sshSessionToTerminal.get(session_id);
    
    if (terminalId) {
      const statusStr = typeof status === "string" ? status : "error";
      
      if (statusStr === "disconnected") {
        sshSessionToTerminal.delete(session_id);
        markTerminalClosed(terminalId);
      } else {
        setState(produce((s) => {
          const terminal = s.terminals.find(t => t.id === terminalId);
          if (terminal) {
            terminal.status = statusStr;
          }
        }));
      }
    }
  });

  // ssh_terminal:connected event
  useTauriListen<SSHTerminalInfo>("ssh_terminal:connected", (payload) => {
    terminalLogger.debug("SSH terminal connected:", payload.id);
  });

  // Event handlers defined outside onMount for cleanup
  const handleToggle = () => togglePanel();
  const handleNew = async () => {
    try {
      const terminal = await createTerminal();
      openTerminal(terminal.id);
    } catch (e) {
      terminalLogger.error("Failed to create new terminal:", e);
    }
  };
  const handleSplit = async () => {
    const activeId = state.activeTerminalId;
    if (activeId) {
      try {
        const newTerminal = await splitTerminalInGroup(activeId);
        openTerminal(newTerminal.id);
      } catch (e) {
        terminalLogger.error("Failed to split terminal:", e);
      }
    }
  };
  const handleClear = () => {
    const activeId = state.activeTerminalId;
    if (activeId) {
      // Dispatch event to clear the terminal display (handled by TerminalPanel)
      window.dispatchEvent(new CustomEvent("terminal:do-clear", { detail: { terminalId: activeId } }));
    }
  };
  const handleKill = async () => {
    const activeId = state.activeTerminalId;
    if (activeId) {
      try {
        await sendInterrupt(activeId);
      } catch (e) {
        terminalLogger.error("Failed to kill terminal process:", e);
      }
    }
  };
  const handleWriteActive = async (e: CustomEvent<{ data: string }>) => {
    const activeId = state.activeTerminalId;
    if (activeId && e.detail?.data) {
      try {
        await writeToTerminal(activeId, e.detail.data);
      } catch (err) {
        terminalLogger.error("Failed to write to active terminal:", err);
      }
    }
  };
  const handleAutoReplyToggle = () => {
    const newState = !autoReplyEnabledState();
    setAutoReplyEnabledState(newState);
    // Persist the state
    try {
      localStorage.setItem("cortex_terminal_auto_reply_enabled", JSON.stringify(newState));
    } catch (e) {
      terminalLogger.error("Failed to persist auto-reply enabled state:", e);
    }
  };

  // ============================================================================
  // Terminal Customization (Names and Colors)
  // ============================================================================

  // Load initial values for terminal names and colors
  const loadTerminalNames = (): Record<string, string> => {
    try {
      const stored = localStorage.getItem(TERMINAL_NAMES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (err) {
      console.debug("[Terminals] Load names failed:", err);
      return {};
    }
  };

  const loadTerminalColors = (): Record<string, string | null> => {
    try {
      const stored = localStorage.getItem(TERMINAL_COLORS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (err) {
      console.debug("[Terminals] Load colors failed:", err);
      return {};
    }
  };

  // Store for custom terminal names and colors
  const [terminalNames, setTerminalNames] = createSignal<Record<string, string>>(loadTerminalNames());
  const [terminalColors, setTerminalColors] = createSignal<Record<string, string | null>>(loadTerminalColors());

  /**
   * Get the display name for a terminal (custom name or default)
   */
  const getTerminalName = (id: string): string => {
    const customName = terminalNames()[id];
    if (customName) return customName;
    
    const terminal = state.terminals.find(t => t.id === id);
    return terminal?.name || "Terminal";
  };

  /**
   * Get the custom color for a terminal tab (null for default)
   */
  const getTerminalColor = (id: string): string | null => {
    return terminalColors()[id] || null;
  };

  /**
   * Rename a terminal
   */
  const renameTerminal = (id: string, name: string): void => {
    setTerminalNames(prev => {
      const updated = { ...prev, [id]: name };
      try {
        localStorage.setItem(TERMINAL_NAMES_KEY, JSON.stringify(updated));
      } catch (e) {
        terminalLogger.error("Failed to save terminal names:", e);
      }
      return updated;
    });
    terminalLogger.debug(`Renamed terminal ${id} to "${name}"`);
  };

  /**
   * Set a terminal tab color
   */
  const setTerminalColor = (id: string, color: string | null): void => {
    setTerminalColors(prev => {
      const updated = { ...prev };
      if (color) {
        updated[id] = color;
      } else {
        delete updated[id];
      }
      try {
        localStorage.setItem(TERMINAL_COLORS_KEY, JSON.stringify(updated));
      } catch (e) {
        terminalLogger.error("Failed to save terminal colors:", e);
      }
      return updated;
    });
    terminalLogger.debug(`Set terminal ${id} color to ${color || "default"}`);
  };

  // ============================================================================
  // Run Selection and Run Active File
  // ============================================================================

  /**
   * Get the run command for a file based on its extension
   */
  const getRunCommand = (filePath: string): string | null => {
    const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
    return FILE_RUN_COMMANDS[ext] || null;
  };

  /**
   * Run selected text in the active terminal (or create new one)
   */
  const runSelection = async (selection: string): Promise<void> => {
    if (!selection.trim()) {
      terminalLogger.warn("runSelection called with empty selection");
      return;
    }

    let terminalId = state.activeTerminalId;
    
    // Create terminal if none exists
    if (!terminalId || !isTerminalAvailable(terminalId)) {
      try {
        const newTerminal = await createTerminal();
        terminalId = newTerminal.id;
        setState("activeTerminalId", terminalId);
        setState("showPanel", true);
        // Wait a bit for terminal to initialize
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (e) {
        terminalLogger.error("Failed to create terminal for runSelection:", e);
        return;
      }
    }

    // Execute the selection
    try {
      // Ensure terminal panel is visible
      setState("showPanel", true);
      
      // Write selection with newline to execute
      await writeToTerminal(terminalId, selection.trim() + "\n");
      terminalLogger.debug(`Ran selection in terminal ${terminalId}`);
    } catch (e) {
      terminalLogger.error("Failed to run selection:", e);
    }
  };

  /**
   * Run the active file in the terminal
   */
  const runActiveFile = async (filePath: string): Promise<void> => {
    if (!filePath) {
      terminalLogger.warn("runActiveFile called with empty path");
      return;
    }

    const runCommand = getRunCommand(filePath);
    if (!runCommand) {
      terminalLogger.warn(`No run command configured for file: ${filePath}`);
      // Dispatch notification
      window.dispatchEvent(new CustomEvent("notification", {
        detail: {
          type: "warning",
          title: "Cannot run file",
          message: `No run command configured for this file type: ${filePath.split(".").pop() || "unknown"}`,
        }
      }));
      return;
    }

    // Replace {file} placeholder with actual file path
    // Quote the path if it contains spaces
    const quotedPath = filePath.includes(" ") ? `"${filePath}"` : filePath;
    const command = runCommand.replace("{file}", quotedPath);

    let terminalId = state.activeTerminalId;

    // Create terminal if none exists
    if (!terminalId || !isTerminalAvailable(terminalId)) {
      try {
        // Get directory of the file
        const fileDir = filePath.replace(/[/\\][^/\\]+$/, "");
        const newTerminal = await createTerminal({ cwd: fileDir });
        terminalId = newTerminal.id;
        setState("activeTerminalId", terminalId);
        setState("showPanel", true);
        // Wait for terminal to initialize
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        terminalLogger.error("Failed to create terminal for runActiveFile:", e);
        return;
      }
    }

    // Execute the run command
    try {
      setState("showPanel", true);
      await writeToTerminal(terminalId, command + "\n");
      terminalLogger.debug(`Running file: ${command}`);
    } catch (e) {
      terminalLogger.error("Failed to run file:", e);
    }
  };

  // ============================================================================
  // Event Handlers for Run Selection, Run File, Rename, Set Color
  // ============================================================================

  const handleRunSelection = async () => {
    // Get selection from active editor
    const selection = window.getSelection()?.toString() || "";
    if (selection.trim()) {
      await runSelection(selection);
    } else {
      // Dispatch event to get selection from Monaco editor
      window.dispatchEvent(new CustomEvent("editor:get-selection-for-terminal"));
    }
  };

  const handleRunActiveFile = async (e: CustomEvent<{ filePath: string }>) => {
    const filePath = e.detail?.filePath;
    if (filePath) {
      await runActiveFile(filePath);
    } else {
      // Request active file path from editor
      window.dispatchEvent(new CustomEvent("editor:get-active-file-for-terminal"));
    }
  };

  const handleRename = (e: CustomEvent<{ terminalId?: string; name?: string }>) => {
    const id = e.detail?.terminalId || state.activeTerminalId;
    const name = e.detail?.name;
    if (id && name) {
      renameTerminal(id, name);
    }
  };

  const handleSetColor = (e: CustomEvent<{ terminalId?: string; color?: string | null }>) => {
    const id = e.detail?.terminalId || state.activeTerminalId;
    const color = e.detail?.color;
    if (id) {
      setTerminalColor(id, color ?? null);
    }
  };

  // Listen for selection from Monaco editor
  const handleEditorSelectionForTerminal = async (e: CustomEvent<{ selection: string }>) => {
    if (e.detail?.selection) {
      await runSelection(e.detail.selection);
    }
  };

  // Listen for active file path from editor
  const handleEditorActiveFileForTerminal = async (e: CustomEvent<{ filePath: string }>) => {
    if (e.detail?.filePath) {
      await runActiveFile(e.detail.filePath);
    }
  };

  let listenersRegistered = false;

  // Register cleanup synchronously — guard against deferred init not yet completed
  // Note: Tauri listeners are now cleaned up automatically by useTauriListen hooks
  onCleanup(() => {
    if (listenersRegistered) {
      window.removeEventListener("terminal:toggle", handleToggle);
      window.removeEventListener("terminal:new", handleNew);
      window.removeEventListener("terminal:split", handleSplit);
      window.removeEventListener("terminal:clear", handleClear);
      window.removeEventListener("terminal:kill", handleKill);
      window.removeEventListener("terminal:write-active", handleWriteActive as unknown as EventListener);
      window.removeEventListener("terminal:auto-reply-toggle", handleAutoReplyToggle);
      window.removeEventListener("terminal:run-selection", handleRunSelection);
      window.removeEventListener("terminal:run-active-file", handleRunActiveFile as unknown as EventListener);
      window.removeEventListener("terminal:rename", handleRename as unknown as EventListener);
      window.removeEventListener("terminal:set-color", handleSetColor as unknown as EventListener);
      window.removeEventListener("editor:selection-for-terminal", handleEditorSelectionForTerminal as unknown as EventListener);
      window.removeEventListener("editor:active-file-for-terminal", handleEditorActiveFileForTerminal as unknown as EventListener);
    }
    
    // Force flush any pending outputs
    outputProcessor.forceFlush();
    
    // Clean up all resize debouncers
    resizeDebouncers.forEach(d => d.cancel());
    resizeDebouncers.clear();
    
    // Clean up output buffers
    outputBufferManager.clearAll();
    
    // Clean up SSH session mappings
    sshSessionToTerminal.clear();
    
    // Clean up auto-reply state
    autoReplyBuffers.clear();
    autoReplyPendingTimeouts.forEach(timeout => clearTimeout(timeout));
    autoReplyPendingTimeouts.clear();
    
    // Clean up new states
    commandHistoryManagers.clear();
  });

  onMount(() => {
    // Note: Tauri event listeners are set up using useTauriListen hooks above.
    // Backend IPC (refreshTerminals, detectProfiles, etc.) is lazily initialized
    // via ensureBackendInitialized() when the user first interacts with terminals.

    // DEFERRED — yield to main thread before registering window event listeners
    queueMicrotask(() => {
      window.addEventListener("terminal:toggle", handleToggle);
      window.addEventListener("terminal:new", handleNew);
      window.addEventListener("terminal:split", handleSplit);
      window.addEventListener("terminal:clear", handleClear);
      window.addEventListener("terminal:kill", handleKill);
      window.addEventListener("terminal:write-active", handleWriteActive as unknown as EventListener);
      window.addEventListener("terminal:auto-reply-toggle", handleAutoReplyToggle);
      window.addEventListener("terminal:run-selection", handleRunSelection);
      window.addEventListener("terminal:run-active-file", handleRunActiveFile as unknown as EventListener);
      window.addEventListener("terminal:rename", handleRename as unknown as EventListener);
      window.addEventListener("terminal:set-color", handleSetColor as unknown as EventListener);
      window.addEventListener("editor:selection-for-terminal", handleEditorSelectionForTerminal as unknown as EventListener);
      window.addEventListener("editor:active-file-for-terminal", handleEditorActiveFileForTerminal as unknown as EventListener);
      listenersRegistered = true;
    });
  });

  return (
    <TerminalsContext.Provider
      value={{
        initialized,
        state,
        createTerminal,
        closeTerminal,
        writeToTerminal,
        updateTerminalInfo,
        resizeTerminal,
        sendInterrupt,
        sendEof,
        acknowledgeOutput,
        setActiveTerminal,
        togglePanel,
        openTerminal,
        closePanel,
        refreshTerminals,
        getDefaultShell,
        subscribeToOutput,
        // Profile functions
        detectProfiles,
        createProfile,
        updateProfile,
        deleteProfile,
        setDefaultProfile,
        getDefaultProfile,
        createTerminalWithProfile,
        getProfiles,
        getProfile,
        // Group management functions
        createGroup,
        deleteGroup,
        renameGroup,
        setActiveGroup,
        getGroup,
        getGroupForTerminal,
        addToGroup,
        removeFromGroup,
        moveToGroup,
        splitTerminalInGroup,
        setGroupSplitDirection,
        setGroupSplitRatios,
        reorderTerminalsInGroup,
        createTerminalInGroup,
        // SSH Terminal functions
        createSSHTerminal,
        listSSHSessions,
        getSSHSession,
        disconnectSSH,
        execSSHCommand,
        subscribeToSSHOutput,
        // Auto-reply functions
        autoReplyRules,
        setAutoReplyRules,
        addAutoReplyRule,
        updateAutoReplyRule,
        deleteAutoReplyRule,
        toggleAutoReplyRule,
        autoReplyEnabled,
        setAutoReplyEnabled,
        // Terminal customization functions
        renameTerminal,
        setTerminalColor,
        getTerminalName,
        getTerminalColor,
        // Run commands
        runSelection,
        runActiveFile,
        getRunCommand,
        // NEW: Shell Integration State
        getShellIntegrationState,
        setShellIntegrationEnabled,
        // NEW: Command History
        getCommandHistory,
        clearCommandHistory,
        searchCommandHistory,
        // NEW: Terminal Persistence
        getPersistedTerminals,
        persistTerminal,
        unpersistTerminal,
        reconnectPersistedTerminals,
        setTerminalPersistence,
        getTerminalPersistence,
        // NEW: Terminal Links
        getTerminalLinksState,
        setLinksDetectionEnabled,
        detectLinksInLine,
        // NEW: Quick Fix
        getQuickFixState,
        setQuickFixEnabled,
        applyQuickFix,
        // NEW: Recent Commands
        recentCommands,
        runRecentCommand,
        clearRecentCommands,
        // NEW: Environment Variables
        getTerminalEnvironment,
        setTerminalEnvironment,
        addEnvironmentVariable,
        removeEnvironmentVariable,
        getInheritedEnvironment,
      }}
    >
      {props.children}
    </TerminalsContext.Provider>
  );
};

export function useTerminals() {
  const ctx = useContext(TerminalsContext);
  if (!ctx) throw new Error("useTerminals must be used within TerminalsProvider");
  return ctx;
}
