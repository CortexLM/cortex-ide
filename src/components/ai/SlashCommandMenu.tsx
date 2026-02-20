import {
  createSignal,
  createEffect,
  createMemo,
  For,
  Show,
  onCleanup,
  JSX,
} from "solid-js";
import { Icon } from "../ui/Icon";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { batchReadFile } from "@/utils/tauriBatch";
import { getProjectPath } from "@/utils/workspace";
import { aiLogger } from "../../utils/logger";

/**
 * Argument definition for slash commands
 */
export interface SlashCommandArgument {
  name: string;
  required: boolean;
  placeholder: string;
}

/**
 * Slash command definition with execute handler
 */
export interface SlashCommand {
  name: string;
  description: string;
  icon: string;
  arguments?: SlashCommandArgument[];
  execute: (args: string[]) => void | Promise<void>;
}

/**
 * Fuzzy match result with score and matched indices
 */
interface FuzzyMatchResult {
  score: number;
  matches: number[];
}

/**
 * Performs fuzzy matching on text against a query
 * Returns score and matched character indices for highlighting
 */
function fuzzyMatch(query: string, text: string): FuzzyMatchResult {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  let queryIndex = 0;
  let score = 0;
  const matches: number[] = [];
  let lastMatchIndex = -1;

  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      matches.push(i);
      // Consecutive character bonus
      if (lastMatchIndex === i - 1) {
        score += 10;
      }
      // Word boundary bonus (start of word)
      if (i === 0 || /[\s_\-/]/.test(text[i - 1])) {
        score += 5;
      }
      score += 1;
      lastMatchIndex = i;
      queryIndex++;
    }
  }

  // Full match achieved
  if (queryIndex === query.length) {
    // Shorter text bonus (prefer exact matches)
    score += Math.max(0, 50 - text.length);
    return { score, matches };
  }

  return { score: 0, matches: [] };
}

/**
 * Renders text with matched characters highlighted
 */
function highlightMatches(text: string, matches: number[]): JSX.Element {
  if (!matches || matches.length === 0) {
    return <span>{text}</span>;
  }

  const result: JSX.Element[] = [];
  let lastIndex = 0;

  for (const matchIndex of matches) {
    if (matchIndex > lastIndex) {
      result.push(<span>{text.slice(lastIndex, matchIndex)}</span>);
    }
    result.push(
      <span
        class="font-semibold"
        style={{ color: "var(--accent-primary)" }}
      >
        {text[matchIndex]}
      </span>
    );
    lastIndex = matchIndex + 1;
  }

  if (lastIndex < text.length) {
    result.push(<span>{text.slice(lastIndex)}</span>);
  }

  return <>{result}</>;
}

/**
 * Helper to dispatch slash command result events
 */
function dispatchSlashCommandResult(command: string, data: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent("ai:slash-command-result", {
    detail: { command, ...data }
  }));
}

/**
 * Default slash commands available in the system
 */
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "file",
    description: "Include a file in the context",
    icon: "file",
    arguments: [{ name: "path", required: false, placeholder: "path/to/file (optional)" }],
    execute: async (args) => {
      try {
        let filePath = args[0];
        
        // If no path provided, open file picker dialog
        if (!filePath) {
          const selected = await openDialog({
            directory: false,
            multiple: false,
            title: "Select File to Include",
            filters: [
              { name: "All Files", extensions: ["*"] },
              { name: "Source Code", extensions: ["ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "c", "cpp", "h", "hpp"] },
              { name: "Config Files", extensions: ["json", "yaml", "yml", "toml", "xml"] },
              { name: "Documentation", extensions: ["md", "txt", "rst"] },
            ],
          });
          
          if (!selected || typeof selected !== "string") {
            aiLogger.debug("File selection cancelled");
            return;
          }
          filePath = selected;
        }
        
        // Read file content using batch API for better performance
        const content = await batchReadFile(filePath);
        
        // Dispatch event with file path and content
        dispatchSlashCommandResult("file", {
          path: filePath,
          content,
          success: true,
        });
        
        aiLogger.debug(`Including file: ${filePath}`);
      } catch (error) {
        console.error("/file command error:", error);
        dispatchSlashCommandResult("file", {
          error: error instanceof Error ? error.message : String(error),
          success: false,
        });
      }
    },
  },
  {
    name: "folder",
    description: "Include a folder in the context",
    icon: "folder",
    arguments: [{ name: "path", required: false, placeholder: "path/to/folder (optional)" }],
    execute: async (args) => {
      try {
        let folderPath = args[0];
        
        // If no path provided, open folder picker dialog
        if (!folderPath) {
          const selected = await openDialog({
            directory: true,
            multiple: false,
            title: "Select Folder to Include",
          });
          
          if (!selected || typeof selected !== "string") {
            aiLogger.debug("Folder selection cancelled");
            return;
          }
          folderPath = selected;
        }
        
        // Get folder tree structure using Tauri invoke
        let folderInfo: { path: string; files?: string[] } = { path: folderPath };
        try {
          const tree = await invoke<{ name: string; is_dir: boolean; children?: unknown[] }>(
            "fs_get_file_tree",
            { path: folderPath, depth: 2, showHidden: false, includeIgnored: false }
          );
          // Extract file names for context
          const extractFiles = (node: { name: string; is_dir: boolean; children?: unknown[] }, prefix = ""): string[] => {
            const files: string[] = [];
            const fullPath = prefix ? `${prefix}/${node.name}` : node.name;
            if (!node.is_dir) {
              files.push(fullPath);
            }
            if (node.children) {
              for (const child of node.children as { name: string; is_dir: boolean; children?: unknown[] }[]) {
                files.push(...extractFiles(child, fullPath));
              }
            }
            return files;
          };
          folderInfo.files = extractFiles(tree);
        } catch {
          // If tree fetch fails, just use the path
          aiLogger.warn("Could not fetch folder tree, using path only");
        }
        
        // Dispatch event with folder path and structure
        dispatchSlashCommandResult("folder", {
          path: folderPath,
          files: folderInfo.files,
          success: true,
        });
        
        aiLogger.debug(`Including folder: ${folderPath}`);
      } catch (error) {
        console.error("/folder command error:", error);
        dispatchSlashCommandResult("folder", {
          error: error instanceof Error ? error.message : String(error),
          success: false,
        });
      }
    },
  },
  {
    name: "selection",
    description: "Include current selection",
    icon: "code",
    execute: async () => {
      try {
        // Dispatch event to request editor selection from EditorCursorContext
        // The parent component should listen for this and provide the selection
        const selectionPromise = new Promise<{ text: string; filePath?: string; range?: unknown } | null>((resolve) => {
          const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            window.removeEventListener("ai:selection-response", handler);
            resolve(detail);
          };
          window.addEventListener("ai:selection-response", handler);
          
          // Request selection from editor context
          window.dispatchEvent(new CustomEvent("ai:request-selection"));
          
          // Timeout after 500ms if no response
          setTimeout(() => {
            window.removeEventListener("ai:selection-response", handler);
            resolve(null);
          }, 500);
        });
        
        const selection = await selectionPromise;
        
        if (selection && selection.text) {
          dispatchSlashCommandResult("selection", {
            text: selection.text,
            filePath: selection.filePath,
            range: selection.range,
            success: true,
          });
          aiLogger.debug("Including current selection");
        } else {
          aiLogger.debug("No text selected");
          dispatchSlashCommandResult("selection", {
            error: "No text selected in editor",
            success: false,
          });
        }
      } catch (error) {
        console.error("/selection command error:", error);
        dispatchSlashCommandResult("selection", {
          error: error instanceof Error ? error.message : String(error),
          success: false,
        });
      }
    },
  },
  {
    name: "workspace",
    description: "Include workspace context",
    icon: "layer-group",
    execute: async () => {
      try {
        // Request workspace info via event
        const workspacePromise = new Promise<{ folders: Array<{ path: string; name: string }>; activeFolder?: string } | null>((resolve) => {
          const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            window.removeEventListener("ai:workspace-response", handler);
            resolve(detail);
          };
          window.addEventListener("ai:workspace-response", handler);
          
          // Request workspace info
          window.dispatchEvent(new CustomEvent("ai:request-workspace"));
          
          // Timeout after 500ms if no response
          setTimeout(() => {
            window.removeEventListener("ai:workspace-response", handler);
            resolve(null);
          }, 500);
        });
        
        const workspace = await workspacePromise;
        
        if (workspace && workspace.folders && workspace.folders.length > 0) {
          // Use the active folder or first folder as workspace root
          const rootPath = workspace.activeFolder || workspace.folders[0].path;
          
          dispatchSlashCommandResult("workspace", {
            rootPath,
            folders: workspace.folders,
            success: true,
          });
          aiLogger.debug(`Including workspace context: ${rootPath}`);
        } else {
          // Fallback: try to get from localStorage
          const storedProject = getProjectPath();
          if (storedProject) {
            dispatchSlashCommandResult("workspace", {
              rootPath: storedProject,
              folders: [{ path: storedProject, name: storedProject.split(/[/\\]/).pop() || "workspace" }],
              success: true,
            });
            aiLogger.debug(`Including workspace context from storage: ${storedProject}`);
          } else {
            dispatchSlashCommandResult("workspace", {
              error: "No workspace open",
              success: false,
            });
            aiLogger.debug("No workspace open");
          }
        }
      } catch (error) {
        console.error("/workspace command error:", error);
        dispatchSlashCommandResult("workspace", {
          error: error instanceof Error ? error.message : String(error),
          success: false,
        });
      }
    },
  },
  {
    name: "clear",
    description: "Clear the conversation",
    icon: "trash",
    execute: () => {
      aiLogger.debug("Clearing conversation");
    },
  },
  {
    name: "new",
    description: "Start a new thread",
    icon: "plus",
    execute: () => {
      aiLogger.debug("Starting new thread");
    },
  },
  {
    name: "model",
    description: "Change the model",
    icon: "microchip",
    arguments: [{ name: "model", required: false, placeholder: "model name" }],
    execute: (args) => {
      const model = args[0];
      if (model) {
        aiLogger.debug(`Switching to model: ${model}`);
      } else {
        aiLogger.debug("Opening model selector");
      }
    },
  },
  {
    name: "system",
    description: "Set system prompt",
    icon: "message",
    arguments: [{ name: "prompt", required: true, placeholder: "system prompt" }],
    execute: (args) => {
      const prompt = args[0];
      if (!prompt) {
        console.error("/system requires a prompt argument");
        return;
      }
      aiLogger.debug(`Setting system prompt: ${prompt}`);
    },
  },
  {
    name: "web",
    description: "Search the web",
    icon: "globe",
    arguments: [{ name: "query", required: true, placeholder: "search query" }],
    execute: async (args) => {
      const query = args[0];
      if (!query) {
        console.error("/web requires a search query");
        return;
      }
      aiLogger.debug(`Searching web for: ${query}`);
    },
  },
  {
    name: "terminal",
    description: "Get recent terminal output",
    icon: "terminal",
    arguments: [{ name: "lines", required: false, placeholder: "number of lines (default: 50)" }],
    execute: async (args) => {
      try {
        const lineCount = args[0] ? parseInt(args[0], 10) : 50;
        
        // Request terminal output via event
        const terminalPromise = new Promise<{ output: string; terminalId?: string } | null>((resolve) => {
          const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            window.removeEventListener("ai:terminal-response", handler);
            resolve(detail);
          };
          window.addEventListener("ai:terminal-response", handler);
          
          // Request terminal output
          window.dispatchEvent(new CustomEvent("ai:request-terminal", {
            detail: { lineCount }
          }));
          
          // Timeout after 500ms if no response
          setTimeout(() => {
            window.removeEventListener("ai:terminal-response", handler);
            resolve(null);
          }, 500);
        });
        
        const terminal = await terminalPromise;
        
        if (terminal && terminal.output) {
          dispatchSlashCommandResult("terminal", {
            output: terminal.output,
            terminalId: terminal.terminalId,
            lineCount,
            success: true,
          });
          aiLogger.debug(`Including terminal output (${lineCount} lines)`);
        } else {
          dispatchSlashCommandResult("terminal", {
            error: "No terminal output available",
            success: false,
          });
          aiLogger.debug("No terminal output available");
        }
      } catch (error) {
        console.error("/terminal command error:", error);
        dispatchSlashCommandResult("terminal", {
          error: error instanceof Error ? error.message : String(error),
          success: false,
        });
      }
    },
  },
  {
    name: "subagents",
    description: "Manage and spawn sub-agents for specialized tasks",
    icon: "users",
    arguments: [{ name: "action", required: false, placeholder: "spawn|list|status" }],
    execute: async (args) => {
      const action = args[0] || "list";
      aiLogger.debug(`Subagents action: ${action}`);
      // Dispatch event to open subagents dialog
      window.dispatchEvent(new CustomEvent("ai:subagents", { detail: { action } }));
    },
  },
  {
    name: "fork",
    description: "Fork the conversation from this point",
    icon: "code-branch",
    execute: async () => {
      aiLogger.debug("Forking conversation");
      window.dispatchEvent(new CustomEvent("ai:fork"));
    },
  },
  {
    name: "skill",
    description: "Load a skill for specialized guidance",
    icon: "book-open",
    arguments: [{ name: "name", required: true, placeholder: "skill name" }],
    execute: async (args) => {
      const skillName = args[0];
      if (!skillName) {
        console.error("/skill requires a skill name");
        return;
      }
      aiLogger.debug(`Loading skill: ${skillName}`);
      window.dispatchEvent(new CustomEvent("ai:skill", { detail: { name: skillName } }));
    },
  },
  {
    name: "search",
    description: "Search code in the workspace",
    icon: "magnifying-glass",
    arguments: [{ name: "query", required: true, placeholder: "search pattern" }],
    execute: async (args) => {
      try {
        const query = args[0];
        if (!query) {
          dispatchSlashCommandResult("search", {
            error: "/search requires a query",
            success: false,
          });
          console.error("/search requires a query");
          return;
        }
        
        aiLogger.debug(`Searching code: ${query}`);
        
        // Dispatch search action - this opens the search panel with the query
        window.dispatchEvent(new CustomEvent("ai:search", { detail: { query } }));
        
        // Also dispatch result for AI context
        dispatchSlashCommandResult("search", {
          query,
          action: "search-initiated",
          success: true,
        });
      } catch (error) {
        console.error("/search command error:", error);
        dispatchSlashCommandResult("search", {
          error: error instanceof Error ? error.message : String(error),
          success: false,
        });
      }
    },
  },
];

/**
 * Filtered command with match information for highlighting
 */
interface FilteredCommand {
  command: SlashCommand;
  nameMatches: number[];
  descriptionMatches: number[];
  score: number;
}

/**
 * Props for SlashCommandMenu component
 */
export interface SlashCommandMenuProps {
  /** Current query text (including the leading /) */
  query: string;
  /** Position to render the menu */
  position?: { top: number; left: number };
  /** Called when a command is selected */
  onSelect: (command: SlashCommand, args?: string[]) => void;
  /** Called when the menu should close */
  onClose: () => void;
  /** Optional custom commands to use instead of defaults */
  commands?: SlashCommand[];
  /** Whether file picker should be shown for file/folder commands */
  showFilePicker?: boolean;
  /** Callback when file picker is requested */
  onRequestFilePicker?: (type: "file" | "folder", callback: (path: string) => void) => void;
}

/**
 * Slash command menu component with fuzzy search and keyboard navigation
 * Inspired by Zed's slash command picker design
 */
export function SlashCommandMenu(props: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  let containerRef: HTMLDivElement | undefined;

  const availableCommands = () => props.commands ?? SLASH_COMMANDS;

  /**
   * Parse the query to extract command name and any partial arguments
   */
  const parsedQuery = createMemo(() => {
    const query = props.query.trim();
    // Remove leading slash
    const withoutSlash = query.startsWith("/") ? query.slice(1) : query;

    // Check if there's a space (indicating command + argument)
    const spaceIndex = withoutSlash.indexOf(" ");
    if (spaceIndex === -1) {
      return { commandQuery: withoutSlash, argumentQuery: null };
    }

    const commandQuery = withoutSlash.slice(0, spaceIndex);
    const argumentQuery = withoutSlash.slice(spaceIndex + 1);
    return { commandQuery, argumentQuery };
  });

  /**
   * Filter and score commands based on query
   */
  const filteredCommands = createMemo<FilteredCommand[]>(() => {
    const { commandQuery, argumentQuery } = parsedQuery();

    // If we have an argument query, check if we have an exact command match
    if (argumentQuery !== null) {
      const exactCommand = availableCommands().find(
        (c) => c.name.toLowerCase() === commandQuery.toLowerCase()
      );
      if (exactCommand) {
        // Return just the matched command for argument completion
        return [
          {
            command: exactCommand,
            nameMatches: [],
            descriptionMatches: [],
            score: 100,
          },
        ];
      }
    }

    const q = commandQuery.toLowerCase();
    if (!q) {
      // No query - return all commands sorted alphabetically
      return availableCommands()
        .map((command) => ({
          command,
          nameMatches: [] as number[],
          descriptionMatches: [] as number[],
          score: 0,
        }))
        .sort((a, b) => a.command.name.localeCompare(b.command.name));
    }

    // Score and filter commands
    const scored = availableCommands()
      .map((command) => {
        const nameMatch = fuzzyMatch(q, command.name);
        const descMatch = fuzzyMatch(q, command.description);

        // Use the better score, prioritize name matches
        const score = Math.max(nameMatch.score * 2, descMatch.score);

        return {
          command,
          nameMatches: nameMatch.matches,
          descriptionMatches: descMatch.matches,
          score,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored;
  });

  /**
   * Check if we're in argument completion mode
   */
  const isInArgumentMode = createMemo(() => {
    const { argumentQuery } = parsedQuery();
    if (argumentQuery === null) return false;

    const filtered = filteredCommands();
    return filtered.length === 1 && filtered[0].command.arguments?.length;
  });

  /**
   * Get the current command being completed (for argument mode)
   */
  const currentCommand = createMemo(() => {
    if (!isInArgumentMode()) return null;
    const filtered = filteredCommands();
    return filtered.length === 1 ? filtered[0].command : null;
  });

  // Reset selection when filtered commands change
  createEffect(() => {
    filteredCommands();
    setSelectedIndex(0);
  });

  // Scroll selected item into view
  createEffect(() => {
    const index = selectedIndex();
    if (containerRef) {
      const items = containerRef.querySelectorAll("[data-command-item]");
      const selectedItem = items[index] as HTMLElement | undefined;
      selectedItem?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  /**
   * Execute command with arguments and notify parent
   */
  const executeCommand = async (command: SlashCommand, args: string[]) => {
    try {
      await command.execute(args);
      props.onSelect(command, args);
    } catch (error) {
      console.error(`Error executing command /${command.name}:`, error);
    }
  };

  /**
   * Handle command selection
   */
  const handleSelect = (command: SlashCommand, index?: number) => {
    if (index !== undefined) {
      setSelectedIndex(index);
    }

    // Check if command requires arguments
    if (command.arguments?.some((arg) => arg.required)) {
      // Check if we already have arguments in the query
      const { argumentQuery } = parsedQuery();
      if (argumentQuery !== null && argumentQuery.trim()) {
        // Parse arguments and execute
        const args = parseArguments(argumentQuery);
        executeCommand(command, args);
      } else {
        // For file/folder commands, optionally trigger file picker
        if (
          (command.name === "file" || command.name === "folder") &&
          props.showFilePicker &&
          props.onRequestFilePicker
        ) {
          props.onRequestFilePicker(
            command.name as "file" | "folder",
            (path) => {
              executeCommand(command, [path]);
            }
          );
        } else {
          // Signal to parent that we need arguments - they should update the input
          // to show "/<command> " so user can type arguments
          props.onSelect(command, undefined);
        }
      }
    } else if (command.arguments?.length) {
      // Command accepts optional arguments
      const { argumentQuery } = parsedQuery();
      if (argumentQuery !== null && argumentQuery.trim()) {
        const args = parseArguments(argumentQuery);
        executeCommand(command, args);
      } else {
        // Execute without arguments
        executeCommand(command, []);
      }
    } else {
      // No arguments needed
      executeCommand(command, []);
    }
  };

  /**
   * Parse argument string into array of arguments
   * Supports quoted strings for arguments with spaces
   */
  const parseArguments = (argString: string): string[] => {
    const args: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (const char of argString) {
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = "";
      } else if (char === " " && !inQuotes) {
        if (current.trim()) {
          args.push(current.trim());
        }
        current = "";
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      args.push(current.trim());
    }

    return args;
  };

  /**
   * Keyboard navigation handler
   */
  const handleKeyDown = (e: KeyboardEvent) => {
    const filtered = filteredCommands();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;

      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;

      case "Enter":
        e.preventDefault();
        e.stopPropagation();
        const cmd = filtered[selectedIndex()];
        if (cmd) {
          handleSelect(cmd.command);
        }
        break;

      case "Tab":
        e.preventDefault();
        e.stopPropagation();
        // Tab to autocomplete command name - select the command
        const selectedCmd = filtered[selectedIndex()];
        if (selectedCmd && !isInArgumentMode()) {
          handleSelect(selectedCmd.command);
        }
        break;

      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        props.onClose();
        break;
    }
  };

  // Set up keyboard event listener
  createEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  /**
   * Get argument placeholder text for display
   */
  const getArgumentHint = (command: SlashCommand): string => {
    if (!command.arguments?.length) return "";
    return command.arguments
      .map((arg) => (arg.required ? `<${arg.placeholder}>` : `[${arg.placeholder}]`))
      .join(" ");
  };

  return (
    <div
      ref={containerRef}
      class="slash-command-menu fixed z-[200] w-[280px] max-h-[320px] rounded-md shadow-xl overflow-hidden"
      style={{
        top: props.position ? `${props.position.top}px` : "auto",
        left: props.position ? `${props.position.left}px` : "auto",
        background: "var(--surface-raised)",
        border: "1px solid var(--border-weak)",
      }}
    >
      {/* Header showing current mode */}
      <Show when={isInArgumentMode() && currentCommand()}>
        <div
          class="px-2 h-[28px] border-b flex items-center gap-2"
          style={{ "border-color": "var(--border-weak)" }}
        >
          {(() => {
            const cmd = currentCommand()!;
            return (
              <>
                <span style={{ color: "var(--accent-primary)" }}>
                  <Icon name={cmd.icon} class="w-4 h-4" />
                </span>
                <span
                  class="font-medium"
                  style={{ color: "var(--text-base)", "font-size": "13px" }}
                >
                  /{cmd.name}
                </span>
                <span
                  style={{ color: "var(--text-weak)", "font-size": "12px" }}
                >
                  {getArgumentHint(cmd)}
                </span>
              </>
            );
          })()}
        </div>
      </Show>

      {/* Command list */}
      <div class="overflow-y-auto max-h-[280px] overscroll-contain">
        <Show when={filteredCommands().length === 0}>
          <div class="px-3 py-6 text-center">
            <span class="text-sm" style={{ color: "var(--text-weak)" }}>
              No matching commands
            </span>
          </div>
        </Show>

        <Show when={!isInArgumentMode()}>
          <div class="py-1">
            <For each={filteredCommands()}>
              {(item, index) => {
                const isSelected = () => index() === selectedIndex();

                return (
                  <button
                    data-command-item
                    class="slash-command-item w-full flex items-center gap-2 px-2 h-[28px] text-left transition-colors duration-75"
                    style={{
                      background: isSelected()
                        ? "var(--surface-active)"
                        : "transparent",
                    }}
                    onClick={() => handleSelect(item.command, index())}
                    onMouseEnter={() => setSelectedIndex(index())}
                  >
                    <span
                      class="shrink-0"
                      style={{
                        color: isSelected()
                          ? "var(--accent-primary)"
                          : "var(--text-weak)",
                      }}
                    >
                      <Icon name={item.command.icon} class="command-icon w-4 h-4" />
                    </span>
                    <div class="command-info flex-1 min-w-0 flex items-center gap-2">
                      <span
                        class="command-name font-medium shrink-0"
                        style={{ 
                          color: "var(--text-base)",
                          "font-size": "13px",
                        }}
                      >
                        /{highlightMatches(item.command.name, item.nameMatches)}
                      </span>
                      <span
                        class="command-description truncate"
                        style={{ 
                          color: "var(--text-weak)",
                          "font-size": "12px",
                        }}
                      >
                        {highlightMatches(
                          item.command.description,
                          item.descriptionMatches
                        )}
                      </span>
                    </div>

                    {/* Keyboard hint - right-aligned */}
                    <Show when={isSelected()}>
                      <kbd
                        class="px-1.5 py-0.5 rounded shrink-0 ml-auto"
                        style={{
                          background: "var(--background-base)",
                          color: "var(--text-weaker)",
                          "font-size": "10px",
                        }}
                      >
                        ↵
                      </kbd>
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>
        </Show>

        {/* Argument mode - show argument input hint */}
        <Show when={isInArgumentMode() && currentCommand()}>
          <div class="px-2 py-3">
            <p class="mb-2" style={{ color: "var(--text-weak)", "font-size": "12px" }}>
              {currentCommand()!.description}
            </p>
            <Show when={currentCommand()!.arguments?.length}>
              <div class="space-y-1">
                <For each={currentCommand()!.arguments}>
                  {(arg) => (
                    <div
                      class="flex items-center gap-2"
                      style={{ color: "var(--text-weak)", "font-size": "12px" }}
                    >
                      <span
                        class="font-mono px-1 rounded"
                        style={{ background: "var(--background-base)" }}
                      >
                        {arg.name}
                      </span>
                      <span>{arg.required ? "(required)" : "(optional)"}</span>
                      <span style={{ color: "var(--text-weaker)", "font-size": "10px" }}>
                        - {arg.placeholder}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      {/* Footer with keyboard shortcuts */}
      <div
        class="px-2 h-[24px] border-t flex items-center justify-between"
        style={{
          "border-color": "var(--border-weak)",
          background: "var(--surface-base)",
        }}
      >
        <div class="flex items-center gap-1">
          <kbd
            class="px-1 py-0.5 rounded"
            style={{
              background: "var(--background-base)",
              color: "var(--text-weaker)",
              "font-size": "10px",
            }}
          >
            ↑↓
          </kbd>
          <span style={{ color: "var(--text-weaker)", "font-size": "10px" }}>
            navigate
          </span>
        </div>
        <div class="flex items-center gap-1">
          <kbd
            class="px-1 py-0.5 rounded"
            style={{
              background: "var(--background-base)",
              color: "var(--text-weaker)",
              "font-size": "10px",
            }}
          >
            Tab
          </kbd>
          <span style={{ color: "var(--text-weaker)", "font-size": "10px" }}>
            complete
          </span>
        </div>
        <div class="flex items-center gap-1">
          <kbd
            class="px-1 py-0.5 rounded"
            style={{
              background: "var(--background-base)",
              color: "var(--text-weaker)",
              "font-size": "10px",
            }}
          >
            Esc
          </kbd>
          <span style={{ color: "var(--text-weaker)", "font-size": "10px" }}>
            close
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage slash command menu state
 * Provides show/hide, positioning, and command execution
 */
export function useSlashCommandMenu() {
  const [visible, setVisible] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [position, setPosition] = createSignal({ top: 0, left: 0 });

  /**
   * Show the slash command menu at the specified position
   */
  const show = (pos: { top: number; left: number }, initialQuery = "/") => {
    setPosition(pos);
    setQuery(initialQuery);
    setVisible(true);
  };

  /**
   * Hide the slash command menu
   */
  const hide = () => {
    setVisible(false);
    setQuery("");
  };

  /**
   * Update the query (for filtering)
   */
  const updateQuery = (newQuery: string) => {
    setQuery(newQuery);
  };

  /**
   * Check if text starts with a slash command
   */
  const isSlashCommand = (text: string): boolean => {
    return text.startsWith("/") && text.length > 1;
  };

  /**
   * Detect slash command trigger in input
   */
  const detectSlashCommand = (
    text: string,
    cursorPosition: number
  ): { triggered: boolean; query: string; startIndex: number } => {
    // Find the last occurrence of / before cursor
    let slashIndex = -1;
    for (let i = cursorPosition - 1; i >= 0; i--) {
      if (text[i] === "/") {
        // Check if it's at the start of a line or after a space
        if (i === 0 || text[i - 1] === " " || text[i - 1] === "\n") {
          slashIndex = i;
          break;
        }
      }
      // Stop if we hit a space or newline
      if (text[i] === " " || text[i] === "\n") {
        break;
      }
    }

    if (slashIndex === -1) {
      return { triggered: false, query: "", startIndex: -1 };
    }

    const query = text.slice(slashIndex, cursorPosition);
    return { triggered: true, query, startIndex: slashIndex };
  };

  return {
    visible,
    query,
    position,
    show,
    hide,
    updateQuery,
    isSlashCommand,
    detectSlashCommand,
  };
}

export default SlashCommandMenu;
