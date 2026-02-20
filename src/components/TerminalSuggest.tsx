import { Show, For, createSignal, createEffect, onCleanup, createMemo, JSX } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Icon } from "./ui/Icon";
import { loadStylesheet } from "@/utils/lazyStyles";
loadStylesheet("terminal");

// Suggestion types for categorization
export type SuggestionType = "history" | "command" | "file" | "directory" | "git" | "npm" | "arg";

// Single suggestion entry
export interface Suggestion {
  id: string;
  text: string;
  type: SuggestionType;
  description?: string;
  icon?: JSX.Element;
  insertText?: string;
  matchScore: number;
  matchIndices?: number[];
}

// Suggestion source interface
export interface SuggestionSource {
  type: SuggestionType;
  getSuggestions: (input: string, context: SuggestionContext) => Suggestion[];
  priority: number;
}

// Context passed to suggestion sources
export interface SuggestionContext {
  currentDir: string;
  recentCommands: string[];
  gitBranches: string[];
  npmScripts: string[];
  fileEntries: FileEntry[];
  previousArgs: string[];
}

// File entry for path completion
export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

// Props for TerminalSuggest component
export interface TerminalSuggestProps {
  visible: boolean;
  input: string;
  cursorPosition: { x: number; y: number };
  onSelect: (suggestion: Suggestion) => void;
  onClose: () => void;
  context: SuggestionContext;
  maxSuggestions?: number;
}

// Common shell commands with descriptions
const COMMON_COMMANDS: Array<{ command: string; description: string; args?: string[] }> = [
  { command: "ls", description: "List directory contents", args: ["-la", "-lh", "-R", "-a", "-l"] },
  { command: "cd", description: "Change directory", args: ["..", "~", "-"] },
  { command: "pwd", description: "Print working directory" },
  { command: "mkdir", description: "Create directories", args: ["-p", "-v"] },
  { command: "rm", description: "Remove files or directories", args: ["-r", "-f", "-rf", "-i"] },
  { command: "cp", description: "Copy files and directories", args: ["-r", "-v", "-i"] },
  { command: "mv", description: "Move or rename files", args: ["-v", "-i", "-n"] },
  { command: "cat", description: "Concatenate and display files" },
  { command: "echo", description: "Display text or variables" },
  { command: "grep", description: "Search text patterns", args: ["-r", "-i", "-n", "-v", "-E"] },
  { command: "find", description: "Search for files", args: ["-name", "-type", "-exec"] },
  { command: "touch", description: "Create empty files or update timestamps" },
  { command: "chmod", description: "Change file permissions", args: ["+x", "-R", "755", "644"] },
  { command: "chown", description: "Change file ownership", args: ["-R"] },
  { command: "head", description: "Output first part of files", args: ["-n", "-c"] },
  { command: "tail", description: "Output last part of files", args: ["-n", "-f", "-F"] },
  { command: "less", description: "View file contents with pagination" },
  { command: "more", description: "View file contents page by page" },
  { command: "nano", description: "Text editor" },
  { command: "vim", description: "Vi IMproved text editor" },
  { command: "code", description: "Open in Visual Studio Code", args: [".", "-r", "-n"] },
  { command: "clear", description: "Clear terminal screen" },
  { command: "history", description: "Show command history" },
  { command: "man", description: "Display manual pages" },
  { command: "which", description: "Locate a command" },
  { command: "whereis", description: "Locate binary, source, and manual" },
  { command: "whoami", description: "Print current user name" },
  { command: "ps", description: "Report process status", args: ["aux", "-ef", "-a"] },
  { command: "top", description: "Display system processes" },
  { command: "htop", description: "Interactive process viewer" },
  { command: "kill", description: "Terminate processes", args: ["-9", "-15"] },
  { command: "killall", description: "Kill processes by name" },
  { command: "curl", description: "Transfer data from URLs", args: ["-X", "-H", "-d", "-o", "-L", "-s"] },
  { command: "wget", description: "Download files from web", args: ["-O", "-c", "-q"] },
  { command: "ssh", description: "Secure shell client", args: ["-i", "-p", "-L"] },
  { command: "scp", description: "Secure copy", args: ["-r", "-P", "-i"] },
  { command: "tar", description: "Archive files", args: ["-xvf", "-cvf", "-tvf", "-xzf", "-czf"] },
  { command: "zip", description: "Compress files", args: ["-r"] },
  { command: "unzip", description: "Extract zip files", args: ["-d", "-l"] },
  { command: "df", description: "Report disk space usage", args: ["-h", "-T"] },
  { command: "du", description: "Estimate file space usage", args: ["-sh", "-h", "-a"] },
  { command: "free", description: "Display memory usage", args: ["-h", "-m"] },
  { command: "uname", description: "Print system information", args: ["-a", "-r"] },
  { command: "date", description: "Display or set date/time" },
  { command: "cal", description: "Display calendar" },
  { command: "uptime", description: "Show system uptime" },
  { command: "env", description: "Display environment variables" },
  { command: "export", description: "Set environment variables" },
  { command: "alias", description: "Create command aliases" },
  { command: "source", description: "Execute commands from file" },
  { command: "exit", description: "Exit the shell" },
  { command: "sudo", description: "Execute as superuser" },
  { command: "su", description: "Switch user" },
  { command: "apt", description: "Package manager (Debian/Ubuntu)", args: ["install", "update", "upgrade", "remove", "search"] },
  { command: "apt-get", description: "APT package handling utility", args: ["install", "update", "upgrade", "remove"] },
  { command: "yum", description: "Package manager (RHEL/CentOS)", args: ["install", "update", "remove", "search"] },
  { command: "dnf", description: "Package manager (Fedora)", args: ["install", "update", "remove", "search"] },
  { command: "brew", description: "Homebrew package manager", args: ["install", "uninstall", "update", "upgrade", "search", "info", "list"] },
  { command: "pacman", description: "Package manager (Arch)", args: ["-S", "-R", "-Syu", "-Ss", "-Q"] },
  { command: "systemctl", description: "Control systemd services", args: ["start", "stop", "restart", "status", "enable", "disable"] },
  { command: "service", description: "Run init scripts", args: ["start", "stop", "restart", "status"] },
  { command: "docker", description: "Container management", args: ["run", "ps", "images", "build", "pull", "push", "exec", "stop", "rm", "rmi", "logs", "compose"] },
  { command: "docker-compose", description: "Multi-container Docker", args: ["up", "down", "build", "logs", "ps", "-d"] },
  { command: "kubectl", description: "Kubernetes CLI", args: ["get", "describe", "apply", "delete", "logs", "exec", "port-forward"] },
  { command: "python", description: "Python interpreter", args: ["-m", "-c", "--version"] },
  { command: "python3", description: "Python 3 interpreter", args: ["-m", "-c", "--version"] },
  { command: "pip", description: "Python package installer", args: ["install", "uninstall", "list", "freeze", "show", "-r"] },
  { command: "pip3", description: "Python 3 package installer", args: ["install", "uninstall", "list", "freeze"] },
  { command: "node", description: "Node.js runtime", args: ["--version", "-e"] },
  { command: "npm", description: "Node package manager", args: ["install", "run", "start", "test", "build", "init", "publish", "ci", "audit", "outdated"] },
  { command: "npx", description: "Execute npm packages", args: ["--yes"] },
  { command: "yarn", description: "Yarn package manager", args: ["install", "add", "remove", "run", "build", "test", "start"] },
  { command: "pnpm", description: "Fast package manager", args: ["install", "add", "remove", "run", "build", "test"] },
  { command: "bun", description: "Fast JS runtime", args: ["run", "install", "add", "remove", "build", "test"] },
  { command: "cargo", description: "Rust package manager", args: ["build", "run", "test", "check", "clippy", "fmt", "new", "init", "add", "update"] },
  { command: "rustup", description: "Rust toolchain manager", args: ["update", "default", "show", "target"] },
  { command: "go", description: "Go language tool", args: ["build", "run", "test", "mod", "get", "install", "fmt", "vet"] },
  { command: "make", description: "Build automation tool", args: ["clean", "install", "all", "test"] },
  { command: "cmake", description: "Cross-platform build", args: ["-B", "-S", "--build"] },
  { command: "mvn", description: "Maven build tool", args: ["clean", "install", "package", "test", "compile"] },
  { command: "gradle", description: "Gradle build tool", args: ["build", "test", "clean", "run"] },
];

// Git commands with descriptions
const GIT_COMMANDS: Array<{ command: string; description: string; args?: string[] }> = [
  { command: "git status", description: "Show working tree status", args: ["-s", "-b"] },
  { command: "git add", description: "Add files to staging", args: [".", "-A", "-p", "-u"] },
  { command: "git commit", description: "Record changes", args: ["-m", "-a", "--amend", "-n"] },
  { command: "git push", description: "Push to remote", args: ["-u", "origin", "--force", "--force-with-lease"] },
  { command: "git pull", description: "Fetch and merge", args: ["--rebase", "origin"] },
  { command: "git fetch", description: "Download objects and refs", args: ["--all", "--prune", "origin"] },
  { command: "git clone", description: "Clone a repository", args: ["--depth", "--branch", "--recursive"] },
  { command: "git checkout", description: "Switch branches/restore files", args: ["-b", "--", "-f"] },
  { command: "git switch", description: "Switch branches", args: ["-c", "-d"] },
  { command: "git branch", description: "List/create/delete branches", args: ["-a", "-d", "-D", "-m", "-r", "-v"] },
  { command: "git merge", description: "Join development histories", args: ["--no-ff", "--squash", "--abort"] },
  { command: "git rebase", description: "Reapply commits", args: ["-i", "--continue", "--abort", "--onto"] },
  { command: "git log", description: "Show commit logs", args: ["--oneline", "--graph", "-p", "--stat", "-n"] },
  { command: "git diff", description: "Show changes", args: ["--staged", "--cached", "--stat", "HEAD"] },
  { command: "git show", description: "Show objects" },
  { command: "git stash", description: "Stash changes", args: ["pop", "list", "apply", "drop", "show", "push"] },
  { command: "git reset", description: "Reset HEAD", args: ["--soft", "--hard", "--mixed", "HEAD~1"] },
  { command: "git revert", description: "Revert commits", args: ["--no-commit"] },
  { command: "git cherry-pick", description: "Apply commits", args: ["-n", "--continue", "--abort"] },
  { command: "git tag", description: "Create/list/delete tags", args: ["-a", "-d", "-l", "-m"] },
  { command: "git remote", description: "Manage remotes", args: ["add", "remove", "-v", "set-url"] },
  { command: "git config", description: "Get/set config", args: ["--global", "--local", "--list"] },
  { command: "git init", description: "Initialize repository" },
  { command: "git clean", description: "Remove untracked files", args: ["-fd", "-n", "-x"] },
  { command: "git restore", description: "Restore working tree", args: ["--staged", "--source"] },
  { command: "git blame", description: "Show line-by-line authorship" },
  { command: "git bisect", description: "Binary search for bugs", args: ["start", "good", "bad", "reset"] },
  { command: "git reflog", description: "Reference log" },
  { command: "git worktree", description: "Manage worktrees", args: ["add", "list", "remove"] },
  { command: "git submodule", description: "Manage submodules", args: ["init", "update", "add", "status"] },
];

// Fuzzy matching algorithm that returns score and matching indices
function fuzzyMatch(pattern: string, text: string): { score: number; indices: number[] } | null {
  const patternLower = pattern.toLowerCase();
  const textLower = text.toLowerCase();
  
  if (patternLower.length === 0) {
    return { score: 1, indices: [] };
  }
  
  if (patternLower.length > textLower.length) {
    return null;
  }
  
  // Exact prefix match gets highest score
  if (textLower.startsWith(patternLower)) {
    const indices = Array.from({ length: patternLower.length }, (_, i) => i);
    return { score: 100 + (patternLower.length / textLower.length) * 50, indices };
  }
  
  // Contains match
  const containsIndex = textLower.indexOf(patternLower);
  if (containsIndex !== -1) {
    const indices = Array.from({ length: patternLower.length }, (_, i) => containsIndex + i);
    const positionPenalty = containsIndex * 0.5;
    return { score: 80 - positionPenalty + (patternLower.length / textLower.length) * 20, indices };
  }
  
  // Fuzzy character-by-character matching
  let patternIdx = 0;
  let score = 0;
  const indices: number[] = [];
  let lastMatchIdx = -1;
  let consecutiveMatches = 0;
  
  for (let textIdx = 0; textIdx < textLower.length && patternIdx < patternLower.length; textIdx++) {
    if (textLower[textIdx] === patternLower[patternIdx]) {
      indices.push(textIdx);
      
      // Bonus for consecutive matches
      if (lastMatchIdx === textIdx - 1) {
        consecutiveMatches++;
        score += 5 + consecutiveMatches * 2;
      } else {
        consecutiveMatches = 0;
        score += 1;
      }
      
      // Bonus for matching at word boundaries
      if (textIdx === 0 || text[textIdx - 1] === " " || text[textIdx - 1] === "-" || text[textIdx - 1] === "/" || text[textIdx - 1] === "_") {
        score += 10;
      }
      
      // Bonus for matching uppercase in camelCase
      if (text[textIdx] === text[textIdx].toUpperCase() && text[textIdx] !== text[textIdx].toLowerCase()) {
        score += 5;
      }
      
      lastMatchIdx = textIdx;
      patternIdx++;
    }
  }
  
  // All pattern characters must match
  if (patternIdx !== patternLower.length) {
    return null;
  }
  
  // Normalize score by text length
  score = score * (patternLower.length / textLower.length);
  
  return { score, indices };
}

// Generate unique ID for suggestions
function generateSuggestionId(): string {
  return `sug-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Parse input to extract command and arguments
function parseInput(input: string): { command: string; args: string[]; currentArg: string; isTypingArg: boolean } {
  const trimmed = input.trim();
  const parts = trimmed.split(/\s+/);
  const command = parts[0] || "";
  const args = parts.slice(1);
  const currentArg = args[args.length - 1] || "";
  const isTypingArg = trimmed.includes(" ");
  
  return { command, args, currentArg, isTypingArg };
}

// Create command suggestion sources
function createCommandSource(): SuggestionSource {
  return {
    type: "command",
    priority: 70,
    getSuggestions: (input: string, _context: SuggestionContext): Suggestion[] => {
      const { command, isTypingArg, currentArg } = parseInput(input);
      
      if (isTypingArg) {
        // Suggest arguments for known commands
        const baseCommand = command.toLowerCase();
        const allCommands = [...COMMON_COMMANDS, ...GIT_COMMANDS.map(g => ({ 
          command: g.command.split(" ").slice(-1)[0], 
          description: g.description, 
          args: g.args 
        }))];
        
        const cmdDef = allCommands.find(c => c.command.toLowerCase() === baseCommand);
        if (cmdDef?.args) {
          const suggestions: Suggestion[] = [];
          for (const arg of cmdDef.args) {
            const match = fuzzyMatch(currentArg, arg);
            if (match && match.score > 0) {
              suggestions.push({
                id: generateSuggestionId(),
                text: arg,
                type: "arg",
                description: `Argument for ${cmdDef.command}`,
                matchScore: match.score,
                matchIndices: match.indices,
                insertText: arg,
              });
            }
          }
          return suggestions;
        }
        return [];
      }
      
      // Suggest commands
      const suggestions: Suggestion[] = [];
      
      for (const cmd of COMMON_COMMANDS) {
        const match = fuzzyMatch(command, cmd.command);
        if (match) {
          suggestions.push({
            id: generateSuggestionId(),
            text: cmd.command,
            type: "command",
            description: cmd.description,
            matchScore: match.score,
            matchIndices: match.indices,
            insertText: cmd.command,
          });
        }
      }
      
      return suggestions;
    },
  };
}

// Create git suggestion source
function createGitSource(): SuggestionSource {
  return {
    type: "git",
    priority: 80,
    getSuggestions: (input: string, context: SuggestionContext): Suggestion[] => {
      const trimmed = input.trim();
      const suggestions: Suggestion[] = [];
      
      // Check if we're in a git command context
      const isGitContext = trimmed.startsWith("git ") || trimmed === "git" || trimmed === "g";
      
      if (isGitContext || trimmed.length === 0) {
        // Suggest git commands
        for (const gitCmd of GIT_COMMANDS) {
          const match = fuzzyMatch(trimmed, gitCmd.command);
          if (match) {
            suggestions.push({
              id: generateSuggestionId(),
              text: gitCmd.command,
              type: "git",
              description: gitCmd.description,
              matchScore: match.score + 10, // Boost git commands when in git context
              matchIndices: match.indices,
              insertText: gitCmd.command,
            });
          }
        }
        
        // Suggest branch names after git checkout, git switch, git merge, etc.
        const branchCommands = ["checkout", "switch", "merge", "rebase", "branch -d", "branch -D", "push origin", "pull origin"];
        for (const branchCmd of branchCommands) {
          if (trimmed.toLowerCase().includes(`git ${branchCmd.split(" ")[0]}`) && context.gitBranches.length > 0) {
            const afterCmd = trimmed.split(" ").slice(-1)[0];
            for (const branch of context.gitBranches) {
              const match = fuzzyMatch(afterCmd, branch);
              if (match) {
                suggestions.push({
                  id: generateSuggestionId(),
                  text: branch,
                  type: "git",
                  description: "Git branch",
                  matchScore: match.score,
                  matchIndices: match.indices,
                  insertText: branch,
                });
              }
            }
          }
        }
      }
      
      return suggestions;
    },
  };
}

// Create npm suggestion source
function createNpmSource(): SuggestionSource {
  return {
    type: "npm",
    priority: 75,
    getSuggestions: (input: string, context: SuggestionContext): Suggestion[] => {
      const trimmed = input.trim();
      const suggestions: Suggestion[] = [];
      
      // Check if we're in npm/yarn/pnpm context
      const isNpmRun = /^(npm\s+run|yarn|pnpm)\s*/.test(trimmed);
      const isNpmContext = trimmed.startsWith("npm") || trimmed.startsWith("yarn") || trimmed.startsWith("pnpm");
      
      if (isNpmRun && context.npmScripts.length > 0) {
        const scriptPart = trimmed.split(/\s+/).slice(-1)[0];
        for (const script of context.npmScripts) {
          const match = fuzzyMatch(scriptPart, script);
          if (match) {
            suggestions.push({
              id: generateSuggestionId(),
              text: script,
              type: "npm",
              description: "npm script",
              matchScore: match.score + 5,
              matchIndices: match.indices,
              insertText: script,
            });
          }
        }
      } else if (isNpmContext) {
        // Suggest npm subcommands
        const npmCommands = ["install", "run", "start", "test", "build", "ci", "audit", "outdated", "update", "uninstall", "init", "publish"];
        const currentPart = trimmed.split(/\s+/).slice(-1)[0];
        for (const cmd of npmCommands) {
          const match = fuzzyMatch(currentPart, cmd);
          if (match) {
            suggestions.push({
              id: generateSuggestionId(),
              text: cmd,
              type: "npm",
              description: `npm ${cmd}`,
              matchScore: match.score,
              matchIndices: match.indices,
              insertText: cmd,
            });
          }
        }
      }
      
      return suggestions;
    },
  };
}

// Create history suggestion source
function createHistorySource(): SuggestionSource {
  return {
    type: "history",
    priority: 90,
    getSuggestions: (input: string, context: SuggestionContext): Suggestion[] => {
      if (input.length === 0 || context.recentCommands.length === 0) {
        return [];
      }
      
      const suggestions: Suggestion[] = [];
      const seen = new Set<string>();
      
      for (const cmd of context.recentCommands) {
        if (seen.has(cmd)) continue;
        seen.add(cmd);
        
        const match = fuzzyMatch(input, cmd);
        if (match && match.score > 20) {
          suggestions.push({
            id: generateSuggestionId(),
            text: cmd,
            type: "history",
            description: "From history",
            matchScore: match.score + 20, // Boost history items
            matchIndices: match.indices,
            insertText: cmd,
          });
        }
      }
      
      return suggestions;
    },
  };
}

// Create file path suggestion source
function createFileSource(): SuggestionSource {
  return {
    type: "file",
    priority: 60,
    getSuggestions: (input: string, context: SuggestionContext): Suggestion[] => {
      const suggestions: Suggestion[] = [];
      const { currentArg, isTypingArg } = parseInput(input);
      
      // Only suggest files when typing an argument or path-like input
      const pathLike = isTypingArg || input.includes("/") || input.includes("\\") || input.startsWith(".");
      if (!pathLike || context.fileEntries.length === 0) {
        return [];
      }
      
      const searchTerm = currentArg || input;
      
      for (const entry of context.fileEntries) {
        const match = fuzzyMatch(searchTerm, entry.name);
        if (match) {
          suggestions.push({
            id: generateSuggestionId(),
            text: entry.name,
            type: entry.isDirectory ? "directory" : "file",
            description: entry.isDirectory ? "Directory" : "File",
            matchScore: match.score + (entry.isDirectory ? 5 : 0), // Slight boost for directories
            matchIndices: match.indices,
            insertText: entry.isDirectory ? entry.name + "/" : entry.name,
          });
        }
      }
      
      return suggestions;
    },
  };
}

// Get icon for suggestion type
function getSuggestionIcon(type: SuggestionType): JSX.Element {
  switch (type) {
    case "history":
      return <Icon name="clock" class="w-3.5 h-3.5" />;
    case "command":
      return <Icon name="terminal" class="w-3.5 h-3.5" />;
    case "file":
      return <Icon name="file" class="w-3.5 h-3.5" />;
    case "directory":
      return <Icon name="folder" class="w-3.5 h-3.5" />;
    case "git":
      return <Icon name="code-branch" class="w-3.5 h-3.5" />;
    case "npm":
      return <Icon name="box" class="w-3.5 h-3.5" />;
    case "arg":
      return <Icon name="chevron-right" class="w-3.5 h-3.5" />;
    default:
      return <Icon name="terminal" class="w-3.5 h-3.5" />;
  }
}

// Get type label for display
function getTypeLabel(type: SuggestionType): string {
  switch (type) {
    case "history": return "History";
    case "command": return "Command";
    case "file": return "File";
    case "directory": return "Directory";
    case "git": return "Git";
    case "npm": return "NPM";
    case "arg": return "Argument";
    default: return "Suggestion";
  }
}

// Highlight matched characters in text
function HighlightedText(props: { text: string; indices: number[] }) {
  const segments = createMemo(() => {
    const result: Array<{ text: string; highlighted: boolean }> = [];
    const indicesSet = new Set(props.indices);
    let currentSegment = "";
    let currentHighlighted = false;
    
    for (let i = 0; i < props.text.length; i++) {
      const isHighlighted = indicesSet.has(i);
      if (i === 0) {
        currentHighlighted = isHighlighted;
        currentSegment = props.text[i];
      } else if (isHighlighted === currentHighlighted) {
        currentSegment += props.text[i];
      } else {
        result.push({ text: currentSegment, highlighted: currentHighlighted });
        currentSegment = props.text[i];
        currentHighlighted = isHighlighted;
      }
    }
    
    if (currentSegment) {
      result.push({ text: currentSegment, highlighted: currentHighlighted });
    }
    
    return result;
  });
  
  return (
    <span>
      <For each={segments()}>
        {(segment) => (
          <span
            style={{
              color: segment.highlighted ? "var(--text-accent)" : "inherit",
              "font-weight": segment.highlighted ? 600 : "inherit",
            }}
          >
            {segment.text}
          </span>
        )}
      </For>
    </span>
  );
}

// Main TerminalSuggest component
export function TerminalSuggest(props: TerminalSuggestProps) {
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [hoveredIndex, setHoveredIndex] = createSignal<number | null>(null);
  let containerRef: HTMLDivElement | undefined;
  let listRef: HTMLDivElement | undefined;
  
  const maxSuggestions = () => props.maxSuggestions ?? 10;
  
  // Create all suggestion sources
  const sources: SuggestionSource[] = [
    createHistorySource(),
    createGitSource(),
    createNpmSource(),
    createCommandSource(),
    createFileSource(),
  ];
  
  // Compute filtered and sorted suggestions
  const suggestions = createMemo((): Suggestion[] => {
    if (!props.visible || props.input.length === 0) {
      return [];
    }
    
    const allSuggestions: Suggestion[] = [];
    
    // Gather suggestions from all sources
    for (const source of sources) {
      const sourceSuggestions = source.getSuggestions(props.input, props.context);
      for (const sug of sourceSuggestions) {
        // Apply source priority to score
        sug.matchScore = sug.matchScore + source.priority;
        sug.icon = getSuggestionIcon(sug.type);
        allSuggestions.push(sug);
      }
    }
    
    // Remove duplicates by text
    const seen = new Set<string>();
    const unique = allSuggestions.filter((sug) => {
      if (seen.has(sug.text.toLowerCase())) {
        return false;
      }
      seen.add(sug.text.toLowerCase());
      return true;
    });
    
    // Sort by score descending
    unique.sort((a, b) => b.matchScore - a.matchScore);
    
    // Limit results
    return unique.slice(0, maxSuggestions());
  });
  
  // Reset selection when suggestions change
  createEffect(() => {
    const sugs = suggestions();
    if (sugs.length === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex() >= sugs.length) {
      setSelectedIndex(Math.max(0, sugs.length - 1));
    }
  });
  
  // Keyboard navigation handler
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.visible || suggestions().length === 0) return;
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions().length - 1));
        scrollToSelected();
        break;
        
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        scrollToSelected();
        break;
        
      case "Tab":
        e.preventDefault();
        e.stopPropagation();
        acceptSuggestion(selectedIndex());
        break;
        
      case "Enter":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          acceptSuggestion(selectedIndex());
        }
        break;
        
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        props.onClose();
        break;
        
      case "PageDown":
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => Math.min(prev + 5, suggestions().length - 1));
        scrollToSelected();
        break;
        
      case "PageUp":
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => Math.max(prev - 5, 0));
        scrollToSelected();
        break;
    }
  };
  
  // Scroll selected item into view
  const scrollToSelected = () => {
    if (!listRef) return;
    const selectedElement = listRef.querySelector(`[data-index="${selectedIndex()}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };
  
  // Accept a suggestion
  const acceptSuggestion = (index: number) => {
    const sug = suggestions()[index];
    if (sug) {
      props.onSelect(sug);
    }
  };
  
  // Register global keyboard handler when visible
  createEffect(() => {
    if (props.visible) {
      window.addEventListener("keydown", handleKeyDown, true);
      onCleanup(() => window.removeEventListener("keydown", handleKeyDown, true));
    }
  });
  
  // Compute dropdown position with VS Code z-index (33 for hover target/suggestions)
  const dropdownStyle = createMemo(() => {
    const pos = props.cursorPosition;
    const dropdownHeight = Math.min(suggestions().length * 32 + 8, maxSuggestions() * 32 + 8);
    
    // Position above cursor if near bottom of screen
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - pos.y;
    const showAbove = spaceBelow < dropdownHeight + 50;
    
    return {
      position: "fixed" as const,
      left: `${Math.max(8, pos.x)}px`,
      top: showAbove ? undefined : `${pos.y + 20}px`,
      bottom: showAbove ? `${viewportHeight - pos.y + 4}px` : undefined,
      "min-width": "280px",
      "max-width": "450px",
      "max-height": `${maxSuggestions() * 32 + 8}px`,
      "z-index": 33, /* VS Code terminal-hover-target z-index */
    };
  });
  
  return (
    <Show when={props.visible && suggestions().length > 0}>
      <div
        ref={containerRef}
        class="rounded-lg border shadow-xl overflow-hidden terminal-hover-target cortex-terminal-suggest"
        style={{
          ...dropdownStyle(),
          background: "var(--vscode-inlineChat-background, var(--surface-raised))",
          "border-color": "var(--vscode-terminal-border, var(--border-base))",
        }}
      >
        {/* Header */}
        <div 
          class="flex items-center justify-between px-2 py-1 border-b text-xs"
          style={{ 
            background: "var(--surface-base)",
            "border-color": "var(--border-weak)",
            color: "var(--text-weaker)",
          }}
        >
          <span>{suggestions().length} suggestion{suggestions().length !== 1 ? "s" : ""}</span>
          <span class="flex items-center gap-1.5">
            <kbd class="px-1 rounded text-[10px]" style={{ background: "var(--surface-raised)" }}>Tab</kbd>
            <span>to accept</span>
          </span>
        </div>
        
        {/* Suggestions list */}
        <div 
          ref={listRef}
          class="overflow-y-auto"
          style={{ "max-height": `${maxSuggestions() * 32}px` }}
        >
          <For each={suggestions()}>
            {(suggestion, index) => (
              <div
                data-index={index()}
                class="flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors"
                style={{
                  background: selectedIndex() === index() 
                    ? "var(--surface-active)" 
                    : hoveredIndex() === index()
                      ? "var(--surface-hover)"
                      : "transparent",
                }}
                onClick={() => acceptSuggestion(index())}
                onMouseEnter={() => {
                  setHoveredIndex(index());
                  setSelectedIndex(index());
                }}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Icon */}
                <div
                  class="shrink-0 w-5 h-5 flex items-center justify-center rounded"
                  style={{ 
                    color: selectedIndex() === index() ? "var(--text-accent)" : "var(--text-weak)",
                    background: selectedIndex() === index() ? "var(--surface-raised)" : "transparent",
                  }}
                >
                  {suggestion.icon}
                </div>
                
                {/* Text content */}
                <div class="flex-1 min-w-0">
                  <div 
                    class="text-sm truncate"
                    style={{ color: "var(--text-base)" }}
                  >
                    <HighlightedText 
                      text={suggestion.text} 
                      indices={suggestion.matchIndices || []} 
                    />
                  </div>
                  <Show when={suggestion.description && (selectedIndex() === index() || hoveredIndex() === index())}>
                    <div 
                      class="text-xs truncate"
                      style={{ color: "var(--text-weaker)" }}
                    >
                      {suggestion.description}
                    </div>
                  </Show>
                </div>
                
                {/* Type badge */}
                <div
                  class="shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide"
                  style={{
                    background: "var(--surface-base)",
                    color: "var(--text-weaker)",
                  }}
                >
                  {getTypeLabel(suggestion.type)}
                </div>
              </div>
            )}
          </For>
        </div>
        
        {/* Footer with keyboard hints */}
        <div 
          class="flex items-center gap-3 px-2 py-1 border-t text-[10px]"
          style={{ 
            background: "var(--surface-base)",
            "border-color": "var(--border-weak)",
            color: "var(--text-weaker)",
          }}
        >
          <span class="flex items-center gap-1">
            <kbd class="px-1 rounded" style={{ background: "var(--surface-raised)" }}>↑</kbd>
            <kbd class="px-1 rounded" style={{ background: "var(--surface-raised)" }}>↓</kbd>
            navigate
          </span>
          <span class="flex items-center gap-1">
            <kbd class="px-1 rounded" style={{ background: "var(--surface-raised)" }}>Tab</kbd>
            accept
          </span>
          <span class="flex items-center gap-1">
            <kbd class="px-1 rounded" style={{ background: "var(--surface-raised)" }}>Esc</kbd>
            dismiss
          </span>
        </div>
      </div>
    </Show>
  );
}

// Hook for managing terminal suggestions state
export interface UseTerminalSuggestionsOptions {
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseTerminalSuggestionsReturn {
  showSuggestions: () => boolean;
  setShowSuggestions: (show: boolean) => void;
  currentInput: () => string;
  setCurrentInput: (input: string) => void;
  cursorPosition: () => { x: number; y: number };
  setCursorPosition: (pos: { x: number; y: number }) => void;
  context: () => SuggestionContext;
  updateContext: (partial: Partial<SuggestionContext>) => void;
  addToHistory: (command: string) => void;
  handleSuggestionSelect: (suggestion: Suggestion, inputCallback: (text: string) => void) => void;
  closeSuggestions: () => void;
}

export function useTerminalSuggestions(options: UseTerminalSuggestionsOptions = {}): UseTerminalSuggestionsReturn {
  const { enabled = true, debounceMs = 100 } = options;
  
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  const [currentInput, setCurrentInput] = createSignal("");
  const [cursorPosition, setCursorPosition] = createSignal({ x: 0, y: 0 });
  
  const [context, setContext] = createStore<SuggestionContext>({
    currentDir: "",
    recentCommands: [],
    gitBranches: [],
    npmScripts: [],
    fileEntries: [],
    previousArgs: [],
  });
  
  // Debounced input handler
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  const debouncedSetInput = (input: string) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      setCurrentInput(input);
      if (enabled && input.length > 0) {
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    }, debounceMs);
  };
  
  const updateContext = (partial: Partial<SuggestionContext>) => {
    setContext(produce((ctx) => {
      Object.assign(ctx, partial);
    }));
  };
  
  const addToHistory = (command: string) => {
    if (!command.trim()) return;
    
    setContext(produce((ctx) => {
      // Remove duplicate if exists
      const idx = ctx.recentCommands.indexOf(command);
      if (idx !== -1) {
        ctx.recentCommands.splice(idx, 1);
      }
      // Add to front
      ctx.recentCommands.unshift(command);
      // Limit to 100 entries
      if (ctx.recentCommands.length > 100) {
        ctx.recentCommands = ctx.recentCommands.slice(0, 100);
      }
    }));
  };
  
  const handleSuggestionSelect = (suggestion: Suggestion, inputCallback: (text: string) => void) => {
    const insertText = suggestion.insertText || suggestion.text;
    const current = currentInput();
    
    // Determine what to insert based on suggestion type
    let newText: string;
    
    if (suggestion.type === "history") {
      // Replace entire input with history command
      newText = insertText;
    } else if (suggestion.type === "arg" || suggestion.type === "file" || suggestion.type === "directory") {
      // Replace current argument
      const parts = current.split(/\s+/);
      parts[parts.length - 1] = insertText;
      newText = parts.join(" ");
    } else if (suggestion.type === "git" && insertText.startsWith("git ")) {
      // Replace entire input with git command
      newText = insertText;
    } else if (suggestion.type === "npm" && !current.includes(" ")) {
      // Replace command
      newText = insertText;
    } else if (current.includes(" ")) {
      // Replace last argument
      const lastSpaceIdx = current.lastIndexOf(" ");
      newText = current.slice(0, lastSpaceIdx + 1) + insertText;
    } else {
      // Replace entire input
      newText = insertText;
    }
    
    inputCallback(newText);
    setCurrentInput(newText);
    setShowSuggestions(false);
  };
  
  const closeSuggestions = () => {
    setShowSuggestions(false);
  };
  
  // Clean up debounce timer
  onCleanup(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });
  
  return {
    showSuggestions,
    setShowSuggestions,
    currentInput: () => currentInput(),
    setCurrentInput: debouncedSetInput,
    cursorPosition,
    setCursorPosition,
    context: () => context,
    updateContext,
    addToHistory,
    handleSuggestionSelect,
    closeSuggestions,
  };
}
