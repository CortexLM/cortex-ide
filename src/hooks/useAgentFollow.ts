import { createEffect, createMemo, onCleanup } from "solid-js";
import {
  useAgentFollow,
  createFileLocation,
  createTerminalLocation,
  createSearchLocation,
  createDirectoryLocation,
  type AgentLocation,
} from "../context/AgentFollowContext";

/**
 * Hook for components that want to integrate with the agent follow system.
 * 
 * This hook provides utilities for:
 * - Recording agent locations from tool calls
 * - Creating location objects for different action types
 * - Subscribing to follow state changes
 * 
 * @example
 * ```tsx
 * function MyAgentComponent() {
 *   const { recordFileRead, recordTerminalCommand, isFollowing } = useAgentFollowActions();
 *   
 *   const handleToolCall = (tool: ToolCall) => {
 *     if (tool.name === 'read_file') {
 *       recordFileRead(tool.arguments.path, tool.arguments.line);
 *     }
 *   };
 * }
 * ```
 */
export function useAgentFollowActions() {
  const follow = useAgentFollow();

  // ============================================================================
  // Convenient action recording methods
  // ============================================================================

  /**
   * Record when the agent reads a file
   */
  const recordFileRead = (
    path: string,
    line?: number,
    column?: number
  ) => {
    follow.recordLocation(
      createFileLocation(path, { line, column, action: "read" })
    );
  };

  /**
   * Record when the agent edits a file
   */
  const recordFileEdit = (
    path: string,
    options?: {
      line?: number;
      column?: number;
      startLine?: number;
      endLine?: number;
    }
  ) => {
    follow.recordLocation(
      createFileLocation(path, {
        line: options?.line,
        column: options?.column,
        highlight: options?.startLine
          ? {
              startLine: options.startLine,
              endLine: options.endLine || options.startLine,
            }
          : undefined,
        action: "edit",
      })
    );
  };

  /**
   * Record when the agent creates a file
   */
  const recordFileCreate = (path: string) => {
    follow.recordLocation(createFileLocation(path, { action: "create" }));
  };

  /**
   * Record when the agent deletes a file
   */
  const recordFileDelete = (path: string) => {
    follow.recordLocation(createFileLocation(path, { action: "delete" }));
  };

  /**
   * Record when the agent runs a terminal command
   */
  const recordTerminalCommand = (terminalId?: string) => {
    follow.recordLocation(createTerminalLocation(terminalId, "run"));
  };

  /**
   * Record when the agent performs a search
   */
  const recordSearch = (query: string) => {
    follow.recordLocation(createSearchLocation(query));
  };

  /**
   * Record when the agent navigates to a directory
   */
  const recordDirectoryAccess = (path: string) => {
    follow.recordLocation(createDirectoryLocation(path));
  };

  // ============================================================================
  // State accessors
  // ============================================================================

  const isFollowing = createMemo(() => follow.state.isFollowing);
  const currentLocation = createMemo(() => follow.state.currentLocation);
  const followHistory = createMemo(() => follow.state.followHistory);

  return {
    // Action recording methods
    recordFileRead,
    recordFileEdit,
    recordFileCreate,
    recordFileDelete,
    recordTerminalCommand,
    recordSearch,
    recordDirectoryAccess,
    
    // Raw location recording
    recordLocation: follow.recordLocation,
    
    // State
    isFollowing,
    currentLocation,
    followHistory,
    
    // Controls
    setFollowing: follow.setFollowing,
    toggleFollowing: follow.toggleFollowing,
    markUserNavigation: follow.markUserNavigation,
    clearHistory: follow.clearHistory,
    updateConfig: follow.updateConfig,
    navigateToHistoryItem: follow.navigateToHistoryItem,
  };
}

/**
 * Hook to automatically track agent tool calls and record locations
 * 
 * @param getToolCalls - Accessor function that returns the current tool calls
 * 
 * @example
 * ```tsx
 * function AgentPanel() {
 *   const [toolCalls, setToolCalls] = createSignal<ToolCall[]>([]);
 *   
 *   // Automatically track tool calls
 *   useAgentToolTracking(() => toolCalls());
 * }
 * ```
 */
export function useAgentToolTracking(
  getToolCalls: () => Array<{
    name: string;
    arguments?: Record<string, unknown>;
    status?: string;
  }>
) {
  const follow = useAgentFollow();
  
  // Track processed tool call IDs to avoid duplicates
  // Using a ref-like pattern to persist across effect re-runs while allowing cleanup
  let processedTools = new Set<string>();
  
  // Cleanup: Reset the set when the component unmounts
  onCleanup(() => {
    processedTools.clear();
  });

  createEffect(() => {
    const toolCalls = getToolCalls();
    
    for (const tool of toolCalls) {
      // Create a unique key for this tool call
      const toolKey = `${tool.name}-${JSON.stringify(tool.arguments)}`;
      
      if (processedTools.has(toolKey)) continue;
      processedTools.add(toolKey);

      // Only process running or completed tools
      if (tool.status === "pending") continue;

      const args = tool.arguments || {};

      // Map tool names to location types
      switch (tool.name) {
        case "read":
        case "Read":
        case "read_file":
        case "view_file":
          if (typeof args.path === "string" || typeof args.file_path === "string") {
            follow.recordLocation(
              createFileLocation(
                (args.path as string) || (args.file_path as string),
                {
                  line: typeof args.line === "number" ? args.line : undefined,
                  action: "read",
                }
              )
            );
          }
          break;

        case "edit":
        case "Edit":
        case "edit_file":
        case "write_file":
        case "Create":
        case "create_file":
          if (typeof args.path === "string" || typeof args.file_path === "string") {
            const path = (args.path as string) || (args.file_path as string);
            const isCreate = tool.name.toLowerCase().includes("create");
            follow.recordLocation(
              createFileLocation(path, {
                action: isCreate ? "create" : "edit",
              })
            );
          }
          break;

        case "execute":
        case "Execute":
        case "run_command":
        case "terminal":
          follow.recordLocation(
            createTerminalLocation(
              typeof args.terminal_id === "string" ? args.terminal_id : undefined,
              "run"
            )
          );
          break;

        case "search":
        case "Grep":
        case "grep":
        case "find":
        case "Glob":
        case "glob":
          if (typeof args.query === "string" || typeof args.pattern === "string") {
            follow.recordLocation(
              createSearchLocation(
                (args.query as string) || (args.pattern as string)
              )
            );
          }
          break;

        case "ls":
        case "LS":
        case "list_directory":
          if (typeof args.path === "string" || typeof args.directory_path === "string") {
            follow.recordLocation(
              createDirectoryLocation(
                (args.path as string) || (args.directory_path as string)
              )
            );
          }
          break;
      }
    }
  });

  onCleanup(() => {
    processedTools.clear();
  });
}

/**
 * Hook to subscribe to follow mode changes
 * 
 * @param onFollowChange - Callback when follow mode changes
 */
export function useFollowModeSubscription(
  onFollowChange: (isFollowing: boolean) => void
) {
  const follow = useAgentFollow();

  createEffect(() => {
    onFollowChange(follow.state.isFollowing);
  });
}

/**
 * Hook to subscribe to location changes
 * 
 * @param onLocationChange - Callback when agent location changes
 */
export function useLocationSubscription(
  onLocationChange: (location: AgentLocation | null) => void
) {
  const follow = useAgentFollow();

  createEffect(() => {
    onLocationChange(follow.state.currentLocation);
  });
}
