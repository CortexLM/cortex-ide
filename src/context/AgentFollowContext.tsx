import {
  createContext,
  useContext,
  ParentComponent,
  onMount,
  onCleanup,
  batch,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useEditor } from "./EditorContext";
import { useTerminals } from "./TerminalsContext";
// Define the payload type locally since it's not exported from events
interface AgentFollowCortexPayload {
  type?: string;
  msg?: {
    type?: string;
    TaskComplete?: unknown;
  };
  TaskComplete?: unknown;
}
import { createLogger } from "../utils/logger";

const agentFollowLogger = createLogger("AgentFollow");

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a location where the agent is currently working
 */
export interface AgentLocation {
  /** Type of location the agent is focused on */
  type: "file" | "terminal" | "search" | "directory";
  /** File or directory path (for file/directory types) */
  path?: string;
  /** Line number in file (1-indexed) */
  line?: number;
  /** Column number in file (1-indexed) */
  column?: number;
  /** Terminal ID (for terminal type) */
  terminalId?: string;
  /** Search query (for search type) */
  searchQuery?: string;
  /** Range to highlight in the file */
  highlight?: {
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
  };
  /** Timestamp when this location was recorded */
  timestamp: number;
  /** Optional description of what the agent is doing */
  action?: "read" | "edit" | "create" | "delete" | "run" | "search";
}

/**
 * Configuration for follow behavior
 */
export interface FollowConfig {
  /** Auto-disable follow if user makes manual navigation */
  autoDisableOnUserNav: boolean;
  /** Scroll behavior when navigating to lines */
  scrollBehavior: "smooth" | "instant";
  /** Duration in ms for highlight effect */
  highlightDuration: number;
  /** Whether to focus terminal panel on terminal actions */
  focusTerminalPanel: boolean;
  /** Delay before navigating (allows agent to batch actions) */
  navigationDelay: number;
}

interface AgentFollowState {
  /** Whether follow mode is currently active */
  isFollowing: boolean;
  /** The current location the agent is working on */
  currentLocation: AgentLocation | null;
  /** History of recent locations (breadcrumb trail) */
  followHistory: AgentLocation[];
  /** Whether the user has recently navigated manually */
  userNavigatedRecently: boolean;
  /** Configuration for follow behavior */
  config: FollowConfig;
  /** Pending navigation (used for debouncing) */
  pendingNavigation: AgentLocation | null;
  /** Whether agent-created splits are currently active */
  agentSplitActive: boolean;
  /** Paths of files opened in agent splits */
  agentSplitPaths: string[];
  /** Whether user has interacted with split (prevents auto-close) */
  userInteractedWithSplit: boolean;
}

interface AgentFollowContextValue {
  state: AgentFollowState;
  /** Enable or disable follow mode */
  setFollowing: (enabled: boolean) => void;
  /** Toggle follow mode */
  toggleFollowing: () => void;
  /** Record a new agent location (triggers navigation if following) */
  recordLocation: (location: Omit<AgentLocation, "timestamp">) => void;
  /** Mark that the user has navigated manually */
  markUserNavigation: () => void;
  /** Clear the follow history */
  clearHistory: () => void;
  /** Update follow configuration */
  updateConfig: (config: Partial<FollowConfig>) => void;
  /** Navigate to a specific location in history */
  navigateToHistoryItem: (index: number) => void;
  /** Check if a location matches current agent focus */
  isCurrentLocation: (path: string) => boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: FollowConfig = {
  autoDisableOnUserNav: true,
  scrollBehavior: "smooth",
  highlightDuration: 2000,
  focusTerminalPanel: true,
  navigationDelay: 150,
};

const MAX_HISTORY_LENGTH = 50;
const USER_NAV_COOLDOWN = 2000; // ms before re-enabling auto-follow after user nav

// ============================================================================
// Context
// ============================================================================

const AgentFollowContext = createContext<AgentFollowContextValue>();

// ============================================================================
// Provider
// ============================================================================

export const AgentFollowProvider: ParentComponent = (props) => {
  const editor = useEditor();
  const terminals = useTerminals();

  const [state, setState] = createStore<AgentFollowState>({
    isFollowing: true, // Follow agent by default
    currentLocation: null,
    followHistory: [],
    userNavigatedRecently: false,
    config: { ...DEFAULT_CONFIG },
    pendingNavigation: null,
    agentSplitActive: false,
    agentSplitPaths: [],
    userInteractedWithSplit: false,
  });

  // Timer refs
  let userNavTimer: ReturnType<typeof setTimeout> | null = null;
  let navigationTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Batch file opens for split view
  let fileBatch: AgentLocation[] = [];
  let fileBatchTimer: ReturnType<typeof setTimeout> | null = null;
  const FILE_BATCH_DELAY = 400; // ms to wait for batch
  const MAX_SPLIT_FILES = 2; // Max 2 files in agent split view

  // ============================================================================
  // Navigation Logic
  // ============================================================================

  /**
   * Open multiple files in split view (supports up to MAX_SPLIT_FILES)
   */
  const openFilesInSplit = async (files: AgentLocation[]) => {
    if (files.length === 0) return;
    
    // Limit to MAX_SPLIT_FILES
    const filesToOpen = files.slice(0, MAX_SPLIT_FILES);
    agentFollowLogger.debug(`Opening ${filesToOpen.length} files in split view`);
    
    // Track that we created agent splits (for auto-cleanup)
    setState("agentSplitActive", true);
    setState("agentSplitPaths", filesToOpen.map(f => f.path).filter(Boolean) as string[]);
    
    // Open files one by one, creating splits as needed
    for (let i = 0; i < filesToOpen.length; i++) {
      const file = filesToOpen[i];
      if (!file?.path) continue;
      
      if (i === 0) {
        // First file - open normally
        await editor.openFile(file.path);
      } else {
        // Additional files - create split and open
        editor.splitEditor("vertical");
        await editor.openFile(file.path);
      }
    }
    
    // Emit event to show agent is controlling ALL editors (orange border on all splits)
    window.dispatchEvent(
      new CustomEvent("editor:agent-active", {
        detail: {
          paths: filesToOpen.map(f => f.path).filter(Boolean),
          action: "read",
          duration: -1, // Keep until agent response ends
          allSplits: true, // Flag to apply to all splits
        },
      })
    );
  };

  /**
   * Close agent-created splits (called when agent response ends)
   */
  const _closeAgentSplits = () => {
    if (!state.agentSplitActive || state.userInteractedWithSplit) {
      agentFollowLogger.debug("Skipping split close - user interacted or no splits active");
      return;
    }
    
    agentFollowLogger.debug("Closing agent splits");
    
    // Close all splits except the first group
    const groups = editor.state.groups;
    if (groups.length > 1) {
      // Close from last to first (except the main one)
      for (let i = groups.length - 1; i > 0; i--) {
        editor.closeGroup?.(groups[i].id);
      }
    }
    
    // Clear orange border
    window.dispatchEvent(new CustomEvent("editor:agent-inactive"));
    
    // Reset state
    batch(() => {
      setState("agentSplitActive", false);
      setState("agentSplitPaths", []);
      setState("userInteractedWithSplit", false);
    });
  };

  /**
   * Close agent-created splits AND close the files (called on task_complete)
   */
  const closeAgentSplitsAndFiles = () => {
    if (!state.agentSplitActive || state.userInteractedWithSplit) {
      agentFollowLogger.debug("Skipping close - user interacted or no splits active");
      // Still clear orange border even if user interacted
      window.dispatchEvent(new CustomEvent("editor:agent-inactive"));
      return;
    }
    
    agentFollowLogger.debug("Closing agent splits and files:", state.agentSplitPaths);
    
    // Get the paths before we clear state
    const pathsToClose = [...state.agentSplitPaths];
    
    // Close all splits except the first group
    const groups = editor.state.groups;
    if (groups.length > 1) {
      for (let i = groups.length - 1; i > 0; i--) {
        editor.closeGroup?.(groups[i].id);
      }
    }
    
    // Close the files that were opened by agent
    for (const path of pathsToClose) {
      const file = editor.state.openFiles.find(f => f.path === path);
      if (file) {
        editor.closeFile(file.id);
      }
    }
    
    // Clear orange border
    window.dispatchEvent(new CustomEvent("editor:agent-inactive"));
    
    // Reset state
    batch(() => {
      setState("agentSplitActive", false);
      setState("agentSplitPaths", []);
      setState("userInteractedWithSplit", false);
    });
  };

  /**
   * Mark that user interacted with split (click or selection)
   */
  const markUserSplitInteraction = () => {
    if (state.agentSplitActive) {
      agentFollowLogger.debug("User interacted with split - preventing auto-close");
      setState("userInteractedWithSplit", true);
    }
  };

  /**
   * Queue a file for batch opening (enables split view for multiple files)
   */
  const queueFileForBatch = (location: AgentLocation) => {
    // Add to batch
    fileBatch.push(location);
    
    // Clear existing timer
    if (fileBatchTimer) {
      clearTimeout(fileBatchTimer);
    }
    
    // Set timer to process batch
    fileBatchTimer = setTimeout(() => {
      const batch = [...fileBatch];
      fileBatch = [];
      
      if (batch.length === 1) {
        // Single file - open normally
        performSingleFileNavigation(batch[0]);
      } else {
        // Multiple files - open in split view
        openFilesInSplit(batch);
      }
    }, FILE_BATCH_DELAY);
  };

  /**
   * Open a single file (no split)
   */
  const performSingleFileNavigation = async (location: AgentLocation) => {
    if (!location.path) return;
    
    // Track this file for cleanup on task_complete
    setState("agentSplitActive", true);
    setState("agentSplitPaths", (prev) => [...prev, location.path!]);
    
    await editor.openFile(location.path);
    
    // Emit event to show agent is controlling the editor (orange border)
    // Keep until task_complete (duration = -1)
    window.dispatchEvent(
      new CustomEvent("editor:agent-active", {
        detail: {
          path: location.path,
          action: location.action,
          duration: -1, // Keep until task_complete
        },
      })
    );
    
    // Dispatch event for editor to scroll to line
    if (location.line) {
      window.dispatchEvent(
        new CustomEvent("editor:scroll-to-line", {
          detail: {
            line: location.line,
            column: location.column || 1,
            behavior: state.config.scrollBehavior,
          },
        })
      );
    }

    // Dispatch highlight event if there's a range to highlight
    if (location.highlight) {
      window.dispatchEvent(
        new CustomEvent("editor:highlight", {
          detail: {
            startLine: location.highlight.startLine,
            endLine: location.highlight.endLine,
            startColumn: location.highlight.startColumn,
            endColumn: location.highlight.endColumn,
            duration: state.config.highlightDuration,
          },
        })
      );
    }
  };

  /**
   * Actually perform navigation to a location
   */
  const performNavigation = async (location: AgentLocation) => {
    try {
      switch (location.type) {
        case "file":
          // Queue for batch processing (enables split view)
          queueFileForBatch(location);
          break;

        case "terminal":
          if (location.terminalId && state.config.focusTerminalPanel) {
            terminals.openTerminal(location.terminalId);
          } else if (state.config.focusTerminalPanel) {
            // Just show the terminal panel
            if (!terminals.state.showPanel) {
              terminals.togglePanel();
            }
          }
          break;

        case "search":
          if (location.searchQuery) {
            window.dispatchEvent(
              new CustomEvent("search:open", {
                detail: { query: location.searchQuery },
              })
            );
          }
          break;

        case "directory":
          if (location.path) {
            window.dispatchEvent(
              new CustomEvent("explorer:reveal", {
                detail: { path: location.path },
              })
            );
          }
          break;
      }
    } catch (error) {
      console.error("[AgentFollow] Navigation error:", error);
    }
  };

  /**
   * Schedule navigation with debouncing
   */
  const scheduleNavigation = (location: AgentLocation) => {
    // Clear any pending navigation
    if (navigationTimer) {
      clearTimeout(navigationTimer);
    }

    setState("pendingNavigation", location);

    navigationTimer = setTimeout(() => {
      const pending = state.pendingNavigation;
      if (pending) {
        performNavigation(pending);
        setState("pendingNavigation", null);
      }
    }, state.config.navigationDelay);
  };

  // ============================================================================
  // Actions
  // ============================================================================

  const setFollowing = (enabled: boolean) => {
    setState("isFollowing", enabled);
    
    // Emit event for UI feedback
    window.dispatchEvent(
      new CustomEvent("agent-follow:status-changed", {
        detail: { isFollowing: enabled },
      })
    );

    // If turning off, clear pending navigation
    if (!enabled && navigationTimer) {
      clearTimeout(navigationTimer);
      setState("pendingNavigation", null);
    }
  };

  const toggleFollowing = () => {
    setFollowing(!state.isFollowing);
  };

  const recordLocation = (locationData: Omit<AgentLocation, "timestamp">) => {
    const location: AgentLocation = {
      ...locationData,
      timestamp: Date.now(),
    };

    batch(() => {
      // Update current location
      setState("currentLocation", location);

      // Add to history (avoid duplicates for same path within short time)
      setState(
        produce((s) => {
          const lastLocation = s.followHistory[s.followHistory.length - 1];
          const isDuplicate =
            lastLocation &&
            lastLocation.path === location.path &&
            lastLocation.type === location.type &&
            Date.now() - lastLocation.timestamp < 1000;

          if (!isDuplicate) {
            s.followHistory.push(location);
            // Trim history if too long
            if (s.followHistory.length > MAX_HISTORY_LENGTH) {
              s.followHistory = s.followHistory.slice(-MAX_HISTORY_LENGTH);
            }
          }
        })
      );
    });

    // Navigate if following and user hasn't recently navigated
    if (state.isFollowing && !state.userNavigatedRecently) {
      // For file operations, navigate immediately (no debounce)
      // This ensures all files the agent reads are opened
      if (location.type === "file") {
        performNavigation(location);
      } else {
        // For other types, use debouncing to avoid UI thrashing
        scheduleNavigation(location);
      }
    }

    // Emit event for other components
    window.dispatchEvent(
      new CustomEvent("agent-follow:location-recorded", {
        detail: location,
      })
    );
  };

  const markUserNavigation = () => {
    // Clear existing timer
    if (userNavTimer) {
      clearTimeout(userNavTimer);
    }

    setState("userNavigatedRecently", true);

    // Auto-disable follow if configured
    if (state.config.autoDisableOnUserNav && state.isFollowing) {
      setFollowing(false);
    }

    // Reset flag after cooldown
    userNavTimer = setTimeout(() => {
      setState("userNavigatedRecently", false);
    }, USER_NAV_COOLDOWN);
  };

  const clearHistory = () => {
    setState("followHistory", []);
  };

  const updateConfig = (config: Partial<FollowConfig>) => {
    setState("config", (prev) => ({ ...prev, ...config }));
  };

  const navigateToHistoryItem = (index: number) => {
    const location = state.followHistory[index];
    if (location) {
      performNavigation(location);
    }
  };

  const isCurrentLocation = (path: string): boolean => {
    return state.currentLocation?.path === path;
  };

  // ============================================================================
  // Keyboard Shortcuts & Event Listeners
  // ============================================================================

  onMount(() => {
    let unlistenAgentAction: UnlistenFn | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Shift+F to toggle follow mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        // Only if not in an input
        const active = document.activeElement;
        const isInput =
          active?.tagName === "INPUT" ||
          active?.tagName === "TEXTAREA" ||
          (active as HTMLElement)?.isContentEditable;

        if (!isInput) {
          e.preventDefault();
          toggleFollowing();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Listen for external commands to record locations
    const handleRecordLocation = (e: CustomEvent<Omit<AgentLocation, "timestamp">>) => {
      recordLocation(e.detail);
    };

    window.addEventListener("agent-follow:record", handleRecordLocation as EventListener);

    // Listen for user navigation events from editor
    const handleUserNav = () => {
      markUserNavigation();
    };
    window.addEventListener("editor:user-navigation", handleUserNav);

    // Listen for agent-action events from Tauri backend
    // This is the main connection that auto-opens files when agent reads them
    // The payload structure comes from ActionLogEntry (camelCase) which wraps AgentAction (snake_case tag)
    listen<{
      action: {
        type: string;
        path?: string;
        query?: string;
        command?: string;
        tool_name?: string;
        tool_id?: string;
        lines_read?: number;
        lines_changed?: number;
        linesRead?: number;
        linesChanged?: number;
        toolName?: string;
        toolId?: string;
      };
      sessionId: string;  // camelCase from ActionLogEntry
      description: string;
      category: string;
    }>("agent:action", (event) => {
      const { action } = event.payload;
      agentFollowLogger.debug("Received agent:action:", event.payload);
      
      // Map agent action types to locations
      if (action.type === "file_read") {
        if (action.path) {
          recordLocation({
            type: "file",
            path: action.path,
            action: "read",
          });
        }
      } else if (action.type === "file_edit") {
        if (action.path) {
          recordLocation({
            type: "file",
            path: action.path,
            action: "edit",
          });
        }
      } else if (action.type === "file_create") {
        if (action.path) {
          recordLocation({
            type: "file",
            path: action.path,
            action: "create",
          });
        }
      } else if (action.type === "terminal_command") {
        recordLocation({
          type: "terminal",
          action: "run",
        });
      } else if (action.type === "search") {
        recordLocation({
          type: "search",
          searchQuery: action.query,
          action: "search",
        });
      } else if (action.type === "directory_list") {
        if (action.path) {
          recordLocation({
            type: "directory",
            path: action.path,
          });
        }
      }
    }).then((unlisten) => {
      unlistenAgentAction = unlisten;
    }).catch((e) => {
      console.error("[AgentFollow] Failed to listen to agent:action:", e);
    });

    // Listen for agent response end (task_complete) to close splits and files
    let unlistenAgentEnd: UnlistenFn | null = null;
    listen<AgentFollowCortexPayload>("cortex:event", (event) => {
      const payload = event.payload;
      
      // Check for task_complete event - this signals agent finished
      if (payload?.type === "task_complete" || 
          payload?.msg?.type === "task_complete" ||
          payload?.TaskComplete ||
          payload?.msg?.TaskComplete) {
        agentFollowLogger.debug("Agent task complete, closing splits and files");
        closeAgentSplitsAndFiles();
      }
    }).then((unlisten) => {
      unlistenAgentEnd = unlisten;
    }).catch((e) => {
      console.error("[AgentFollow] Failed to listen to cortex:event:", e);
    });

    // Listen for user interaction with editor (click, selection)
    const handleEditorClick = () => {
      markUserSplitInteraction();
    };
    const handleEditorSelection = () => {
      markUserSplitInteraction();
    };
    
    window.addEventListener("editor:user-click", handleEditorClick);
    window.addEventListener("editor:user-selection", handleEditorSelection);
    // Also listen for mousedown on editor containers as fallback
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-editor-group]') || target.closest('.monaco-editor')) {
        markUserSplitInteraction();
      }
    };
    window.addEventListener("mousedown", handleMouseDown);

    // Suppress unused warning - _closeAgentSplits is kept for potential future use
    void _closeAgentSplits;

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("agent-follow:record", handleRecordLocation as EventListener);
      window.removeEventListener("editor:user-navigation", handleUserNav);
      window.removeEventListener("editor:user-click", handleEditorClick);
      window.removeEventListener("editor:user-selection", handleEditorSelection);
      window.removeEventListener("mousedown", handleMouseDown);

      if (userNavTimer) clearTimeout(userNavTimer);
      if (navigationTimer) clearTimeout(navigationTimer);
      if (fileBatchTimer) clearTimeout(fileBatchTimer);
      if (unlistenAgentAction) unlistenAgentAction();
      if (unlistenAgentEnd) unlistenAgentEnd();
    });
  });

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: AgentFollowContextValue = {
    state,
    setFollowing,
    toggleFollowing,
    recordLocation,
    markUserNavigation,
    clearHistory,
    updateConfig,
    navigateToHistoryItem,
    isCurrentLocation,
  };

  return (
    <AgentFollowContext.Provider value={value}>
      {props.children}
    </AgentFollowContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

export function useAgentFollow() {
  const context = useContext(AgentFollowContext);
  if (!context) {
    throw new Error("useAgentFollow must be used within AgentFollowProvider");
  }
  return context;
}

// ============================================================================
// Utility: Create location helpers
// ============================================================================

export function createFileLocation(
  path: string,
  options?: {
    line?: number;
    column?: number;
    highlight?: AgentLocation["highlight"];
    action?: AgentLocation["action"];
  }
): Omit<AgentLocation, "timestamp"> {
  return {
    type: "file",
    path,
    line: options?.line,
    column: options?.column,
    highlight: options?.highlight,
    action: options?.action,
  };
}

export function createTerminalLocation(
  terminalId?: string,
  action?: AgentLocation["action"]
): Omit<AgentLocation, "timestamp"> {
  return {
    type: "terminal",
    terminalId,
    action: action || "run",
  };
}

export function createSearchLocation(
  searchQuery: string
): Omit<AgentLocation, "timestamp"> {
  return {
    type: "search",
    searchQuery,
    action: "search",
  };
}

export function createDirectoryLocation(
  path: string
): Omit<AgentLocation, "timestamp"> {
  return {
    type: "directory",
    path,
  };
}
