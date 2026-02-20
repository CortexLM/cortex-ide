import { createSignal, createEffect, For, Show } from "solid-js";
import { 
  fsReadFile, 
  fsGetFileTree, 
  fsSearchContent, 
  gitStatus, 
  gitDiff, 
  gitLog, 
  terminalRun,
  type FileTreeNode,
} from "../../utils/tauri-api";
import { invoke } from "@tauri-apps/api/core";
import { getProjectPath } from "../../utils/workspace";

export interface SlashCommand {
  name: string;
  description: string;
  icon: string;
  category: "code" | "context" | "tools" | "custom";
  action: (args?: string) => Promise<string>;
  args?: {
    name: string;
    description: string;
    required?: boolean;
  }[];
}

const defaultCommands: SlashCommand[] = [
  {
    name: "file",
    description: "Include file contents in context",
    icon: "file",
    category: "context",
    args: [{ name: "path", description: "File path", required: true }],
    action: async (path) => {
      if (!path) return "Error: File path required";
      try {
        const projectPath = getProjectPath();
        const fullPath = projectPath ? `${projectPath}/${path}` : path;
        const content = await fsReadFile(fullPath);
        return `\`\`\`${path}\n${content}\n\`\`\``;
      } catch {
        return `Error: Could not read file ${path}`;
      }
    },
  },
  {
    name: "folder",
    description: "Include folder structure",
    icon: "folder",
    category: "context",
    args: [{ name: "path", description: "Folder path" }],
    action: async (path) => {
      try {
        const projectPath = getProjectPath();
        const targetPath = path ? `${projectPath}/${path}` : projectPath;
        const data = await fsGetFileTree(targetPath, 3);
        return formatTree(data, 0);
      } catch {
        return "Error: Could not read folder";
      }
    },
  },
  {
    name: "search",
    description: "Search codebase and include results",
    icon: "magnifying-glass",
    category: "context",
    args: [{ name: "query", description: "Search query", required: true }],
    action: async (query) => {
      if (!query) return "Error: Search query required";
      try {
        const projectPath = getProjectPath();
        const response = await fsSearchContent({
          path: projectPath,
          pattern: query,
          maxResults: 30,
        });

        if (response.results.length === 0) return "No results found";

        let output = `Search results for "${query}":\n\n`;
        let count = 0;
        for (const result of response.results) {
          if (count >= 10) break;
          output += `**${result.file}**\n`;
          for (const match of result.matches.slice(0, 3)) {
            output += `  Line ${match.line}: ${match.text.trim()}\n`;
          }
          output += "\n";
          count++;
        }
        return output;
      } catch {
        return "Error: Search failed";
      }
    },
  },
  {
    name: "git",
    description: "Include git information",
    icon: "code-branch",
    category: "context",
    args: [{ name: "info", description: "status, diff, log" }],
    action: async (info = "status") => {
      try {
        const projectPath = getProjectPath();
        let data: unknown;
        
        switch (info) {
          case "status":
            data = await gitStatus(projectPath);
            break;
          case "diff":
            data = await gitDiff(projectPath);
            break;
          case "log":
            data = await gitLog(projectPath, 10);
            break;
          default:
            return `Error: Unknown git command "${info}". Use status, diff, or log.`;
        }
        
        return JSON.stringify(data, null, 2);
      } catch {
        return `Error: Could not get git ${info}`;
      }
    },
  },
  {
    name: "terminal",
    description: "Run command and include output",
    icon: "terminal",
    category: "tools",
    args: [{ name: "command", description: "Command to run", required: true }],
    action: async (command) => {
      if (!command) return "Error: Command required";
      try {
        const projectPath = getProjectPath();
        const result = await terminalRun(command, projectPath);
        const output = result.stdout || result.stderr || "";
        return `\`\`\`\n$ ${command}\n${output}\n\`\`\``;
      } catch {
        return "Error: Command failed";
      }
    },
  },
  {
    name: "web",
    description: "Fetch and include web content",
    icon: "globe",
    category: "context",
    args: [{ name: "url", description: "URL to fetch", required: true }],
    action: async (url) => {
      if (!url) return "Error: URL required";
      try {
        // Use Tauri command to fetch URL content
        const data = await invoke<{ content?: string; text?: string }>("fetch_url", { url });
        return data?.content || data?.text || "No content";
      } catch {
        return "Error: Could not fetch URL";
      }
    },
  },
  {
    name: "code",
    description: "Generate code snippet",
    icon: "code",
    category: "code",
    args: [{ name: "description", description: "What to generate", required: true }],
    action: async (description) => {
      if (!description) return "Error: Description required";
      return `[AI will generate code based on: ${description}]`;
    },
  },
  {
    name: "explain",
    description: "Explain selected code",
    icon: "file-lines",
    category: "code",
    action: async () => {
      return "[AI will explain the selected code]";
    },
  },
  {
    name: "fix",
    description: "Fix bugs in code",
    icon: "wrench",
    category: "code",
    action: async () => {
      return "[AI will analyze and fix bugs]";
    },
  },
];

function formatTree(node: FileTreeNode, depth: number): string {
  const indent = "  ".repeat(depth);
  let result = `${indent}${node.isDirectory ? "[dir]" : "[file]"} ${node.name}\n`;
  if (node.children) {
    for (const child of node.children) {
      result += formatTree(child, depth + 1);
    }
  }
  return result;
}

// Hook to manage slash commands
export function useSlashCommands() {
  const [commands, setCommands] = createSignal<SlashCommand[]>(defaultCommands);
  const [visible, setVisible] = createSignal(false);
  const [filter, setFilter] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [position, setPosition] = createSignal({ top: 0, left: 0 });

  const filteredCommands = () => {
    const f = filter().toLowerCase();
    if (!f) return commands();
    return commands().filter(
      (cmd) => 
        cmd.name.toLowerCase().includes(f) ||
        cmd.description.toLowerCase().includes(f)
    );
  };

  const show = (pos: { top: number; left: number }, initialFilter = "") => {
    setPosition(pos);
    setFilter(initialFilter);
    setSelectedIndex(0);
    setVisible(true);
  };

  const hide = () => {
    setVisible(false);
    setFilter("");
  };

  const selectNext = () => {
    setSelectedIndex((i) => Math.min(i + 1, filteredCommands().length - 1));
  };

  const selectPrev = () => {
    setSelectedIndex((i) => Math.max(i - 1, 0));
  };

  const getSelected = () => filteredCommands()[selectedIndex()];

  const registerCommand = (command: SlashCommand) => {
    setCommands((prev) => [...prev.filter((c) => c.name !== command.name), command]);
  };

  return {
    commands,
    filteredCommands,
    visible,
    filter,
    setFilter,
    selectedIndex,
    setSelectedIndex,
    position,
    show,
    hide,
    selectNext,
    selectPrev,
    getSelected,
    registerCommand,
  };
}

// Slash command picker UI
export function SlashCommandPicker(props: {
  visible: boolean;
  position: { top: number; left: number };
  filter: string;
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}) {
  let containerRef: HTMLDivElement | undefined;

  // Scroll selected item into view
  createEffect(() => {
    const index = props.selectedIndex;
    if (containerRef) {
      const items = containerRef.querySelectorAll("[data-command-item]");
      items[index]?.scrollIntoView({ block: "nearest" });
    }
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "code": return ">";
      case "context": return "@";
      case "tools": return "#";
      default: return "•";
    }
  };

  return (
    <Show when={props.visible}>
      <div
        ref={containerRef}
        class="fixed z-[200] w-[300px] max-h-[300px] rounded-lg shadow-2xl overflow-hidden"
        style={{
          top: `${props.position.top}px`,
          left: `${props.position.left}px`,
          background: "var(--surface-raised)",
          border: "1px solid var(--border-weak)",
        }}
      >
        <div class="overflow-y-auto max-h-[300px]">
          <Show when={props.commands.length === 0}>
            <div class="px-3 py-4 text-center">
              <span class="text-sm" style={{ color: "var(--text-weak)" }}>
                No commands found
              </span>
            </div>
          </Show>

          <For each={props.commands}>
            {(command, index) => (
              <button
                data-command-item
                class="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                style={{
                  background: index() === props.selectedIndex 
                    ? "var(--surface-active)" 
                    : "transparent",
                }}
                onClick={() => props.onSelect(command)}
                onMouseEnter={() => {}}
              >
                <span class="text-lg">{getCategoryIcon(command.category)}</span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span 
                      class="text-sm font-medium"
                      style={{ color: "var(--text-base)" }}
                    >
                      /{command.name}
                    </span>
                    <Show when={command.args?.some((a) => a.required)}>
                      <span 
                        class="text-xs"
                        style={{ color: "var(--text-weak)" }}
                      >
                        {command.args?.filter((a) => a.required).map((a) => `<${a.name}>`).join(" ")}
                      </span>
                    </Show>
                  </div>
                  <p 
                    class="text-xs truncate"
                    style={{ color: "var(--text-weak)" }}
                  >
                    {command.description}
                  </p>
                </div>
              </button>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}