/**
 * CommandSystem - CLI-style commands for the chat input
 * Commands are prefixed with /
 */

import { createSignal, For, Show } from "solid-js";

// ============================================================================
// Types
// ============================================================================

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  args?: CommandArg[];
  execute: (args: string[], context: CommandContext) => Promise<CommandResult> | CommandResult;
}

export interface CommandArg {
  name: string;
  required?: boolean;
  description?: string;
}

export interface CommandContext {
  cwd: string;
  sendMessage: (content: string) => Promise<void>;
  openFile: (path: string) => void;
  runInTerminal: (cmd: string) => void;
  showToast: (msg: string, type?: "info" | "error" | "success") => void;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  silent?: boolean; // Don't show any output
}

// ============================================================================
// Built-in Commands
// ============================================================================

export const COMMANDS: Command[] = [
  {
    name: "help",
    aliases: ["?", "h"],
    description: "Show available commands",
    execute: () => {
      const help = COMMANDS.map(c => `/${c.name} - ${c.description}`).join("\n");
      return { success: true, message: help };
    }
  },
  {
    name: "clear",
    aliases: ["cls"],
    description: "Clear the conversation",
    execute: () => {
      window.dispatchEvent(new CustomEvent("chat:clear"));
      return { success: true, message: "Conversation cleared", silent: true };
    }
  },
  {
    name: "model",
    aliases: ["m"],
    description: "Change or show current model",
    usage: "/model [model-name]",
    args: [{ name: "model", required: false }],
    execute: (args) => {
      if (args.length === 0) {
        return { success: true, message: "Use /model <name> to change model" };
      }
      window.dispatchEvent(new CustomEvent("config:set-model", { detail: args[0] }));
      return { success: true, message: `Model changed to ${args[0]}` };
    }
  },
  {
    name: "open",
    aliases: ["o", "edit"],
    description: "Open a file in the editor",
    usage: "/open <file-path>",
    args: [{ name: "path", required: true }],
    execute: (args, ctx) => {
      if (args.length === 0) return { success: false, message: "Usage: /open <file-path>" };
      ctx.openFile(args.join(" "));
      return { success: true, silent: true };
    }
  },
  {
    name: "run",
    aliases: ["exec", "!"],
    description: "Run a command in the terminal",
    usage: "/run <command>",
    args: [{ name: "command", required: true }],
    execute: (args, ctx) => {
      if (args.length === 0) return { success: false, message: "Usage: /run <command>" };
      ctx.runInTerminal(args.join(" "));
      return { success: true, silent: true };
    }
  },
  {
    name: "cd",
    description: "Change working directory",
    usage: "/cd <directory>",
    args: [{ name: "directory", required: true }],
    execute: (args) => {
      if (args.length === 0) return { success: false, message: "Usage: /cd <directory>" };
      window.dispatchEvent(new CustomEvent("workspace:cd", { detail: args[0] }));
      return { success: true, message: `Changed to ${args[0]}` };
    }
  },
  {
    name: "git",
    aliases: ["g"],
    description: "Run git commands",
    usage: "/git <command>",
    args: [{ name: "command", required: true }],
    execute: (args, ctx) => {
      if (args.length === 0) return { success: false, message: "Usage: /git <command>" };
      ctx.runInTerminal(`git ${args.join(" ")}`);
      return { success: true, silent: true };
    }
  },
  {
    name: "search",
    aliases: ["find", "grep"],
    description: "Search in files",
    usage: "/search <pattern>",
    args: [{ name: "pattern", required: true }],
    execute: (args) => {
      if (args.length === 0) return { success: false, message: "Usage: /search <pattern>" };
      window.dispatchEvent(new CustomEvent("search:open", { detail: args.join(" ") }));
      return { success: true, silent: true };
    }
  },
  {
    name: "agent",
    aliases: ["a"],
    description: "Select a sub-agent",
    usage: "/agent <type>",
    args: [{ name: "type", required: false, description: "code, research, or refactor" }],
    execute: (args) => {
      if (args.length === 0) {
        window.dispatchEvent(new CustomEvent("subagent:open-manager"));
        return { success: true, silent: true };
      }
      window.dispatchEvent(new CustomEvent("subagent:select", { detail: { type: args[0] } }));
      return { success: true, message: `Selected ${args[0]} agent` };
    }
  },
  {
    name: "new",
    description: "Create a new file",
    usage: "/new <file-path>",
    args: [{ name: "path", required: true }],
    execute: (args) => {
      if (args.length === 0) return { success: false, message: "Usage: /new <file-path>" };
      window.dispatchEvent(new CustomEvent("file:create", { detail: args.join(" ") }));
      return { success: true, message: `Creating ${args.join(" ")}` };
    }
  },
  {
    name: "settings",
    aliases: ["config", "prefs"],
    description: "Open settings",
    execute: () => {
      window.dispatchEvent(new CustomEvent("settings:open-tab"));
      return { success: true, silent: true };
    }
  },
  {
    name: "theme",
    description: "Change theme",
    usage: "/theme <dark|light>",
    args: [{ name: "theme", required: false }],
    execute: (args) => {
      if (args.length === 0) {
        window.dispatchEvent(new CustomEvent("theme:toggle"));
        return { success: true, message: "Theme toggled" };
      }
      window.dispatchEvent(new CustomEvent("theme:set", { detail: args[0] }));
      return { success: true, message: `Theme set to ${args[0]}` };
    }
  },
  {
    name: "reload",
    aliases: ["refresh"],
    description: "Reload the application",
    execute: () => {
      window.location.reload();
      return { success: true, silent: true };
    }
  },
];

// ============================================================================
// Command Parser
// ============================================================================

export function parseCommand(input: string): { command: string; args: string[] } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;
  
  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0]?.toLowerCase() || "";
  const args = parts.slice(1);
  
  return { command, args };
}

export function findCommand(name: string): Command | undefined {
  return COMMANDS.find(c => 
    c.name === name || c.aliases?.includes(name)
  );
}

export function getCommandSuggestions(partial: string): Command[] {
  const lower = partial.toLowerCase();
  return COMMANDS.filter(c => 
    c.name.startsWith(lower) || 
    c.aliases?.some(a => a.startsWith(lower))
  ).slice(0, 8);
}

// ============================================================================
// CommandPalette Component (inline suggestions)
// ============================================================================

interface CommandPaletteProps {
  input: string;
  onSelect: (command: Command) => void;
  onClose: () => void;
  visible: boolean;
}

export function CommandPalette(props: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  
  const suggestions = () => {
    if (!props.input.startsWith("/")) return [];
    const partial = props.input.slice(1).split(/\s/)[0] || "";
    return getCommandSuggestions(partial);
  };
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.visible) return;
    
    const items = suggestions();
    if (items.length === 0) return;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Tab" || e.key === "Enter") {
      if (items[selectedIndex()]) {
        e.preventDefault();
        props.onSelect(items[selectedIndex()]);
      }
    } else if (e.key === "Escape") {
      props.onClose();
    }
  };
  
  return (
    <Show when={props.visible && suggestions().length > 0}>
      <div 
        class="absolute bottom-full left-0 right-0 mb-1 rounded overflow-hidden"
        style={{ 
          background: "var(--ui-panel-bg)", 
          border: "1px solid #333",
          "max-height": "200px",
          "overflow-y": "auto",
        }}
        onKeyDown={handleKeyDown}
      >
        <For each={suggestions()}>
          {(cmd, index) => (
            <div
              class="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm"
              style={{
                background: index() === selectedIndex() ? "var(--cortex-bg-hover)" : "transparent",
              }}
              onClick={() => props.onSelect(cmd)}
              onMouseEnter={() => setSelectedIndex(index())}
            >
              <span class="text-blue-400 font-mono">/{cmd.name}</span>
              <span class="text-[#666] text-xs flex-1 truncate">{cmd.description}</span>
              <Show when={cmd.aliases?.length}>
                <span class="text-[#444] text-[10px]">
                  {cmd.aliases?.map(a => `/${a}`).join(" ")}
                </span>
              </Show>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

export default { COMMANDS, parseCommand, findCommand, getCommandSuggestions, CommandPalette };

