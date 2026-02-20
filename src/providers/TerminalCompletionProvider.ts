/**
 * Terminal Completion Provider
 *
 * Provides intelligent autocomplete suggestions for terminal input including:
 * - Command completions based on PATH executables
 * - File and directory completions
 * - Argument completions (--help, -v, etc.)
 * - Environment variable completions
 * - Shell history integration
 *
 * Inspired by VSCode's terminal suggest feature with adaptations for Orion.
 */

import type {
  TerminalCompletionItem,
  TerminalCompletionItemKind,
} from "@/types/terminal";

// ============================================================================
// Types
// ============================================================================

/**
 * Shell type for context-aware completions.
 */
export type ShellType =
  | "bash"
  | "zsh"
  | "fish"
  | "powershell"
  | "cmd"
  | "nushell"
  | "unknown";

/**
 * Context provided to completion providers.
 */
export interface TerminalCompletionContext {
  /** The complete command line text */
  commandLine: string;
  /** Cursor position (0-based index) */
  cursorIndex: number;
  /** Current working directory */
  cwd: string;
  /** Shell type */
  shellType: ShellType;
  /** Environment variables */
  env: Record<string, string>;
  /** Platform (win32, darwin, linux) */
  platform: NodeJS.Platform;
}

/**
 * Result from a completion provider.
 */
export interface TerminalCompletionResult {
  /** Completion items */
  items: TerminalCompletionItem[];
  /** Whether to also show file/folder completions */
  includeFiles?: boolean;
  /** Whether to also show directory completions */
  includeDirectories?: boolean;
  /** Glob pattern for file filtering */
  fileGlobPattern?: string;
}

/**
 * Interface for individual completion providers.
 */
export interface ITerminalCompletionProvider {
  /** Unique provider ID */
  id: string;
  /** Provider priority (higher = checked first) */
  priority: number;
  /** Shells this provider supports (undefined = all) */
  supportedShells?: ShellType[];
  /** Characters that trigger this provider */
  triggerCharacters?: string[];
  /** Provide completions */
  provideCompletions(
    context: TerminalCompletionContext
  ): Promise<TerminalCompletionResult | null>;
}

/**
 * Configuration for the terminal completion provider.
 */
export interface TerminalCompletionProviderConfig {
  /** Enable completions */
  enabled: boolean;
  /** Maximum number of completions to show */
  maxCompletions: number;
  /** Enable command completions from PATH */
  enableCommands: boolean;
  /** Enable file/folder completions */
  enableFiles: boolean;
  /** Enable argument completions */
  enableArguments: boolean;
  /** Enable environment variable completions */
  enableEnvVars: boolean;
  /** Enable history completions */
  enableHistory: boolean;
  /** Show file icons */
  showFileIcons: boolean;
  /** Sort completions by frequency */
  sortByFrequency: boolean;
  /** Case-sensitive matching */
  caseSensitive: boolean;
  /** Debounce delay in ms */
  debounceMs: number;
}

/**
 * Shell history entry.
 */
export interface HistoryEntry {
  /** Command text */
  command: string;
  /** Execution timestamp */
  timestamp: number;
  /** Exit code (if known) */
  exitCode?: number;
  /** Working directory */
  cwd?: string;
}

/**
 * Command frequency data for sorting.
 */
interface CommandFrequency {
  command: string;
  count: number;
  lastUsed: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: TerminalCompletionProviderConfig = {
  enabled: true,
  maxCompletions: 50,
  enableCommands: true,
  enableFiles: true,
  enableArguments: true,
  enableEnvVars: true,
  enableHistory: true,
  showFileIcons: true,
  sortByFrequency: true,
  caseSensitive: false,
  debounceMs: 100,
};

/** Common command arguments by command */
const COMMON_ARGUMENTS: Record<string, string[]> = {
  // Universal flags
  "*": ["--help", "-h", "--version", "-v", "--verbose", "--quiet", "-q"],

  // Git commands
  git: [
    "add",
    "branch",
    "checkout",
    "clone",
    "commit",
    "diff",
    "fetch",
    "init",
    "log",
    "merge",
    "pull",
    "push",
    "rebase",
    "remote",
    "reset",
    "restore",
    "stash",
    "status",
    "switch",
    "tag",
  ],
  "git add": ["--all", "-A", "--patch", "-p", "--update", "-u", "."],
  "git branch": [
    "--all",
    "-a",
    "--delete",
    "-d",
    "--force",
    "-D",
    "--list",
    "--move",
    "-m",
    "--remote",
    "-r",
  ],
  "git checkout": ["-b", "--branch", "--force", "-f", "--track", "-t"],
  "git commit": [
    "--all",
    "-a",
    "--amend",
    "--message",
    "-m",
    "--no-edit",
    "--signoff",
    "-s",
  ],
  "git diff": ["--cached", "--staged", "--stat", "--name-only", "--color"],
  "git log": [
    "--oneline",
    "--graph",
    "--all",
    "--stat",
    "-n",
    "--author",
    "--since",
    "--until",
  ],
  "git push": [
    "--force",
    "-f",
    "--force-with-lease",
    "--set-upstream",
    "-u",
    "--tags",
    "--delete",
  ],
  "git pull": ["--rebase", "--no-rebase", "--autostash", "--ff-only"],
  "git reset": ["--hard", "--soft", "--mixed", "HEAD~1", "HEAD"],
  "git stash": [
    "push",
    "pop",
    "apply",
    "drop",
    "list",
    "show",
    "--include-untracked",
    "-u",
  ],

  // npm commands
  npm: [
    "install",
    "uninstall",
    "update",
    "run",
    "start",
    "test",
    "build",
    "init",
    "publish",
    "version",
    "audit",
    "outdated",
    "ls",
    "ci",
    "cache",
    "config",
  ],
  "npm install": [
    "--save",
    "-S",
    "--save-dev",
    "-D",
    "--global",
    "-g",
    "--production",
    "--legacy-peer-deps",
  ],
  "npm run": ["build", "dev", "start", "test", "lint", "format"],

  // yarn commands
  yarn: [
    "add",
    "remove",
    "install",
    "upgrade",
    "run",
    "start",
    "test",
    "build",
    "init",
    "publish",
  ],
  "yarn add": ["--dev", "-D", "--peer", "-P", "--optional", "-O", "--exact", "-E"],

  // pnpm commands
  pnpm: [
    "add",
    "remove",
    "install",
    "update",
    "run",
    "start",
    "test",
    "build",
    "init",
  ],

  // Docker commands
  docker: [
    "build",
    "compose",
    "container",
    "exec",
    "image",
    "images",
    "logs",
    "network",
    "ps",
    "pull",
    "push",
    "rm",
    "rmi",
    "run",
    "start",
    "stop",
    "volume",
  ],
  "docker run": [
    "--detach",
    "-d",
    "--interactive",
    "-i",
    "--tty",
    "-t",
    "--rm",
    "--name",
    "--port",
    "-p",
    "--volume",
    "-v",
    "--env",
    "-e",
    "--network",
  ],
  "docker build": ["--tag", "-t", "--file", "-f", "--no-cache", "--build-arg"],
  "docker compose": ["up", "down", "build", "logs", "ps", "restart", "exec"],

  // Kubernetes commands
  kubectl: [
    "apply",
    "get",
    "describe",
    "delete",
    "logs",
    "exec",
    "port-forward",
    "config",
    "create",
    "edit",
    "scale",
    "rollout",
  ],
  "kubectl get": [
    "pods",
    "services",
    "deployments",
    "nodes",
    "namespaces",
    "configmaps",
    "secrets",
    "-o",
    "--output",
    "-n",
    "--namespace",
    "-A",
    "--all-namespaces",
  ],

  // Cargo commands
  cargo: [
    "build",
    "run",
    "test",
    "check",
    "clean",
    "doc",
    "new",
    "init",
    "add",
    "remove",
    "update",
    "publish",
    "install",
    "fmt",
    "clippy",
  ],
  "cargo build": ["--release", "--all-features", "--no-default-features", "--target"],
  "cargo run": ["--release", "--example", "--bin"],
  "cargo test": ["--release", "--all", "--doc", "--lib"],

  // Python commands
  python: ["-m", "-c", "-i", "-u", "-v", "--version"],
  pip: ["install", "uninstall", "freeze", "list", "show", "search", "download"],
  "pip install": ["-r", "--requirements", "-e", "--editable", "-U", "--upgrade"],

  // File system commands
  ls: ["-l", "-a", "-la", "-lh", "-R", "--all", "--long", "--human-readable"],
  cd: ["..", "~", "-", "/"],
  mkdir: ["-p", "--parents", "-v", "--verbose"],
  rm: ["-r", "-f", "-rf", "-i", "--recursive", "--force", "--interactive"],
  cp: ["-r", "-v", "-i", "--recursive", "--verbose", "--interactive"],
  mv: ["-v", "-i", "--verbose", "--interactive"],
  chmod: ["+x", "-x", "755", "644", "-R", "--recursive"],
  chown: ["-R", "--recursive"],

  // Search commands
  grep: [
    "-r",
    "-i",
    "-n",
    "-l",
    "-v",
    "-E",
    "-P",
    "--recursive",
    "--ignore-case",
    "--line-number",
    "--color",
  ],
  find: [
    "-name",
    "-type",
    "-exec",
    "-delete",
    "-print",
    "-size",
    "-mtime",
    "-maxdepth",
  ],
  rg: [
    "-i",
    "--ignore-case",
    "-n",
    "--line-number",
    "-l",
    "--files-with-matches",
    "-t",
    "--type",
    "-g",
    "--glob",
    "-F",
    "--fixed-strings",
  ],

  // Text processing
  cat: ["-n", "--number", "-A", "--show-all"],
  head: ["-n", "--lines"],
  tail: ["-n", "--lines", "-f", "--follow"],
  sed: ["-i", "-e", "-n"],
  awk: ["-F", "-f", "-v"],

  // Network commands
  curl: [
    "-X",
    "-H",
    "-d",
    "-o",
    "-O",
    "-s",
    "-v",
    "-L",
    "--request",
    "--header",
    "--data",
    "--output",
    "--silent",
    "--verbose",
    "--location",
  ],
  wget: ["-O", "-q", "-c", "--output-document", "--quiet", "--continue"],
  ssh: ["-i", "-p", "-L", "-R", "-N", "-f", "-v"],
  scp: ["-r", "-P", "-i", "--recursive"],

  // Process commands
  ps: ["aux", "-ef", "-A", "--all"],
  kill: ["-9", "-15", "-SIGTERM", "-SIGKILL"],
  top: ["-c", "-n", "-b"],
  htop: [],

  // System commands
  systemctl: ["start", "stop", "restart", "status", "enable", "disable", "daemon-reload"],
  journalctl: ["-u", "-f", "-n", "--unit", "--follow", "--lines"],

  // Package managers
  apt: ["install", "remove", "update", "upgrade", "search", "show", "autoremove"],
  "apt-get": ["install", "remove", "update", "upgrade", "autoremove"],
  brew: ["install", "uninstall", "update", "upgrade", "search", "info", "list", "services"],
  pacman: ["-S", "-R", "-Syu", "-Ss", "-Q", "-Qi"],

  // Make
  make: ["all", "clean", "install", "test", "build", "-j", "-f"],

  // Code editors/IDEs
  code: [".", "--new-window", "--reuse-window", "--diff", "--goto", "--install-extension"],
  vim: ["-O", "-o", "-p", "+", "-R", "-c"],
  nano: ["-l", "-m", "-i", "-c"],
};

/** Common environment variable prefixes */
const ENV_VAR_PREFIXES = [
  "HOME",
  "USER",
  "PATH",
  "PWD",
  "SHELL",
  "TERM",
  "EDITOR",
  "VISUAL",
  "LANG",
  "LC_",
  "XDG_",
  "NODE_",
  "NPM_",
  "CARGO_",
  "RUST",
  "PYTHON",
  "JAVA_",
  "GO",
  "AWS_",
  "AZURE_",
  "GOOGLE_",
  "DOCKER_",
  "KUBERNETES_",
  "K8S_",
  "CI",
  "DEBUG",
  "VERBOSE",
  "LOG_",
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse the command line into tokens.
 */
function parseCommandLine(commandLine: string): {
  tokens: string[];
  currentToken: string;
  currentTokenStart: number;
  isInQuote: boolean;
  quoteChar: string | null;
} {
  const tokens: string[] = [];
  let currentToken = "";
  let currentTokenStart = 0;
  let isInQuote = false;
  let quoteChar: string | null = null;
  let isEscaped = false;

  for (let i = 0; i < commandLine.length; i++) {
    const char = commandLine[i];

    if (isEscaped) {
      currentToken += char;
      isEscaped = false;
      continue;
    }

    if (char === "\\") {
      isEscaped = true;
      currentToken += char;
      continue;
    }

    if ((char === '"' || char === "'") && !isInQuote) {
      isInQuote = true;
      quoteChar = char;
      currentToken += char;
      continue;
    }

    if (char === quoteChar && isInQuote) {
      isInQuote = false;
      quoteChar = null;
      currentToken += char;
      continue;
    }

    if (char === " " && !isInQuote) {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = "";
      }
      currentTokenStart = i + 1;
      continue;
    }

    currentToken += char;
  }

  return {
    tokens,
    currentToken,
    currentTokenStart,
    isInQuote,
    quoteChar,
  };
}

/**
 * Get the command being completed (first token).
 */
function getCommand(tokens: string[]): string {
  return tokens[0] || "";
}

/**
 * Get the subcommand context (e.g., "git commit" from "git commit -m").
 */
function getCommandContext(tokens: string[]): string {
  if (tokens.length === 0) return "";
  if (tokens.length === 1) return tokens[0];

  // Check for two-word command contexts
  const twoWord = `${tokens[0]} ${tokens[1]}`;
  if (COMMON_ARGUMENTS[twoWord]) {
    return twoWord;
  }

  return tokens[0];
}

/**
 * Check if the current token looks like an option/flag.
 */
function isOptionToken(token: string): boolean {
  return token.startsWith("-");
}

/**
 * Check if the current token looks like an environment variable reference.
 */
function isEnvVarToken(token: string): boolean {
  return token.startsWith("$") || token.includes("${");
}

/**
 * Check if the current token looks like a path.
 */
function isPathToken(token: string): boolean {
  return (
    token.startsWith("/") ||
    token.startsWith("./") ||
    token.startsWith("../") ||
    token.startsWith("~") ||
    token.includes("/") ||
    token.includes("\\") ||
    /^[a-zA-Z]:/.test(token) // Windows drive letter
  );
}

/**
 * Create a completion item.
 */
function createCompletionItem(
  label: string,
  kind: TerminalCompletionItemKind,
  insertText?: string,
  detail?: string,
  documentation?: string
): TerminalCompletionItem {
  return {
    label,
    kind,
    insertText: insertText ?? label,
    detail,
    documentation,
  };
}

/**
 * Calculate match score for sorting.
 */
function calculateMatchScore(
  label: string,
  query: string,
  caseSensitive: boolean
): number {
  const normalizedLabel = caseSensitive ? label : label.toLowerCase();
  const normalizedQuery = caseSensitive ? query : query.toLowerCase();

  if (!normalizedQuery) return 1;
  if (normalizedLabel === normalizedQuery) return 100;
  if (normalizedLabel.startsWith(normalizedQuery)) return 80;
  if (normalizedLabel.includes(normalizedQuery)) return 60;

  // Fuzzy match score
  let score = 0;
  let queryIndex = 0;
  for (let i = 0; i < normalizedLabel.length && queryIndex < normalizedQuery.length; i++) {
    if (normalizedLabel[i] === normalizedQuery[queryIndex]) {
      score += 1;
      queryIndex++;
    }
  }

  return queryIndex === normalizedQuery.length ? score * 10 : 0;
}

/**
 * Escape a path for shell insertion.
 */
function escapeForShell(
  text: string,
  shellType: ShellType,
  isPath: boolean = false
): string {
  if (shellType === "cmd") {
    // Windows CMD uses ^ for escaping
    return text.replace(/([&|<>^])/g, "^$1");
  }

  if (shellType === "powershell") {
    // PowerShell uses backtick for escaping
    if (text.includes(" ") && isPath) {
      return `"${text}"`;
    }
    return text.replace(/([`$"'])/g, "`$1");
  }

  // Unix shells (bash, zsh, fish)
  if (text.includes(" ") || text.includes("(") || text.includes(")")) {
    // Quote paths with spaces
    if (isPath) {
      return `"${text.replace(/"/g, '\\"')}"`;
    }
    // Escape special characters
    return text.replace(/([ ()'"&|;<>\\])/g, "\\$1");
  }

  return text;
}

// ============================================================================
// Built-in Completion Providers
// ============================================================================

/**
 * Command completion provider - suggests commands from PATH.
 */
class CommandCompletionProvider implements ITerminalCompletionProvider {
  id = "commands";
  priority = 100;

  private commandCache: Map<string, string[]> = new Map();
  private commonCommands = [
    "cd",
    "ls",
    "pwd",
    "echo",
    "cat",
    "grep",
    "find",
    "mkdir",
    "rm",
    "cp",
    "mv",
    "chmod",
    "chown",
    "less",
    "more",
    "head",
    "tail",
    "wc",
    "sort",
    "uniq",
    "cut",
    "awk",
    "sed",
    "tr",
    "xargs",
    "tee",
    "which",
    "whereis",
    "man",
    "history",
    "clear",
    "exit",
    "git",
    "npm",
    "yarn",
    "pnpm",
    "node",
    "python",
    "python3",
    "pip",
    "pip3",
    "cargo",
    "rustc",
    "go",
    "docker",
    "kubectl",
    "curl",
    "wget",
    "ssh",
    "scp",
    "rsync",
    "tar",
    "zip",
    "unzip",
    "gzip",
    "gunzip",
    "ps",
    "top",
    "htop",
    "kill",
    "pkill",
    "df",
    "du",
    "free",
    "uname",
    "whoami",
    "date",
    "cal",
    "touch",
    "ln",
    "file",
    "stat",
    "diff",
    "patch",
    "make",
    "cmake",
    "gcc",
    "g++",
    "clang",
    "vim",
    "nvim",
    "nano",
    "code",
    "subl",
    "emacs",
    "tmux",
    "screen",
    "env",
    "export",
    "source",
    "alias",
    "unalias",
    "sudo",
    "su",
    "apt",
    "apt-get",
    "brew",
    "pacman",
    "yum",
    "dnf",
    "systemctl",
    "service",
    "journalctl",
  ];

  async provideCompletions(
    context: TerminalCompletionContext
  ): Promise<TerminalCompletionResult | null> {
    const { commandLine, cursorIndex } = context;
    const parsed = parseCommandLine(commandLine.substring(0, cursorIndex));

    // Only provide completions for the first token (command position)
    if (parsed.tokens.length > 0 || parsed.currentToken.includes("/")) {
      return null;
    }

    const query = parsed.currentToken;
    const commands = await this.getAvailableCommands(context);

    const items: TerminalCompletionItem[] = commands
      .filter(
        (cmd) =>
          !query ||
          cmd.toLowerCase().startsWith(query.toLowerCase()) ||
          cmd.includes(query.toLowerCase())
      )
      .slice(0, 50)
      .map((cmd) =>
        createCompletionItem(cmd, "Command", cmd, "Command", `Execute ${cmd}`)
      );

    return { items };
  }

  private async getAvailableCommands(
    context: TerminalCompletionContext
  ): Promise<string[]> {
    const cacheKey = `${context.platform}-${context.shellType}`;

    if (this.commandCache.has(cacheKey)) {
      return this.commandCache.get(cacheKey)!;
    }

    // Start with common commands
    const commands = new Set<string>(this.commonCommands);

    // Add platform-specific commands
    if (context.platform === "win32") {
      [
        "dir",
        "cls",
        "type",
        "copy",
        "del",
        "ren",
        "move",
        "attrib",
        "xcopy",
        "robocopy",
        "tasklist",
        "taskkill",
        "ipconfig",
        "netstat",
        "ping",
        "tracert",
        "nslookup",
        "systeminfo",
        "chkdsk",
        "sfc",
        "dism",
        "wmic",
        "powershell",
        "cmd",
        "wsl",
      ].forEach((cmd) => commands.add(cmd));
    } else {
      [
        "ifconfig",
        "ip",
        "netstat",
        "ss",
        "ping",
        "traceroute",
        "dig",
        "nslookup",
        "host",
        "nc",
        "nmap",
        "iptables",
        "cron",
        "crontab",
        "at",
        "nohup",
        "disown",
        "bg",
        "fg",
        "jobs",
        "lsof",
        "strace",
        "ltrace",
        "time",
        "watch",
        "xdg-open",
        "open",
        "pbcopy",
        "pbpaste",
      ].forEach((cmd) => commands.add(cmd));
    }

    // Add shell-specific builtins
    if (context.shellType === "bash" || context.shellType === "zsh") {
      [
        "source",
        "export",
        "alias",
        "unalias",
        "set",
        "unset",
        "shopt",
        "bind",
        "builtin",
        "command",
        "declare",
        "typeset",
        "local",
        "readonly",
        "getopts",
        "shift",
        "eval",
        "exec",
        "trap",
        "wait",
        "pushd",
        "popd",
        "dirs",
      ].forEach((cmd) => commands.add(cmd));
    }

    if (context.shellType === "fish") {
      [
        "set",
        "function",
        "funced",
        "funcsave",
        "functions",
        "abbr",
        "bind",
        "complete",
        "contains",
        "emit",
        "fish_config",
        "fish_update_completions",
        "prevd",
        "nextd",
        "dirh",
      ].forEach((cmd) => commands.add(cmd));
    }

    if (context.shellType === "powershell") {
      [
        "Get-Command",
        "Get-Help",
        "Get-Process",
        "Get-Service",
        "Get-Content",
        "Set-Content",
        "Get-ChildItem",
        "Set-Location",
        "New-Item",
        "Remove-Item",
        "Copy-Item",
        "Move-Item",
        "Invoke-WebRequest",
        "Invoke-RestMethod",
        "Select-String",
        "Where-Object",
        "ForEach-Object",
        "Sort-Object",
        "Select-Object",
        "Group-Object",
        "Measure-Object",
        "Format-Table",
        "Format-List",
        "Out-File",
        "Out-String",
        "ConvertTo-Json",
        "ConvertFrom-Json",
        "Import-Module",
        "Get-Module",
        "Write-Host",
        "Write-Output",
        "Write-Error",
        "Read-Host",
        "Test-Path",
        "Split-Path",
        "Join-Path",
        "Resolve-Path",
      ].forEach((cmd) => commands.add(cmd));
    }

    const result = Array.from(commands).sort();
    this.commandCache.set(cacheKey, result);
    return result;
  }
}

/**
 * Argument completion provider - suggests command arguments/flags.
 */
class ArgumentCompletionProvider implements ITerminalCompletionProvider {
  id = "arguments";
  priority = 90;
  triggerCharacters = ["-", " "];

  async provideCompletions(
    context: TerminalCompletionContext
  ): Promise<TerminalCompletionResult | null> {
    const { commandLine, cursorIndex } = context;
    const parsed = parseCommandLine(commandLine.substring(0, cursorIndex));

    // Need at least one token (the command)
    if (parsed.tokens.length === 0) {
      return null;
    }

    const commandContext = getCommandContext(parsed.tokens);
    const currentToken = parsed.currentToken;

    // Check if we're completing an option
    const isCompletingOption = isOptionToken(currentToken) || currentToken === "";

    if (!isCompletingOption && currentToken.length > 0) {
      return null;
    }

    const items: TerminalCompletionItem[] = [];
    const addedLabels = new Set<string>();

    // Add command-specific arguments
    const commandArgs = COMMON_ARGUMENTS[commandContext] || [];
    for (const arg of commandArgs) {
      if (
        !addedLabels.has(arg) &&
        (!currentToken || arg.toLowerCase().startsWith(currentToken.toLowerCase()))
      ) {
        addedLabels.add(arg);
        const kind: TerminalCompletionItemKind = arg.startsWith("-") ? "Flag" : "Argument";
        items.push(
          createCompletionItem(
            arg,
            kind,
            arg,
            kind,
            `${kind} for ${commandContext}`
          )
        );
      }
    }

    // Add universal flags if completing an option
    if (isCompletingOption || currentToken.startsWith("-")) {
      const universalFlags = COMMON_ARGUMENTS["*"] || [];
      for (const flag of universalFlags) {
        if (
          !addedLabels.has(flag) &&
          (!currentToken || flag.toLowerCase().startsWith(currentToken.toLowerCase()))
        ) {
          addedLabels.add(flag);
          items.push(
            createCompletionItem(flag, "Flag", flag, "Flag", "Common flag")
          );
        }
      }
    }

    // Sort by relevance
    items.sort((a, b) => {
      const scoreA = calculateMatchScore(a.label, currentToken, false);
      const scoreB = calculateMatchScore(b.label, currentToken, false);
      return scoreB - scoreA;
    });

    return {
      items: items.slice(0, 30),
      // Include files for commands that typically take file arguments
      includeFiles:
        !isOptionToken(currentToken) &&
        ["cat", "less", "more", "head", "tail", "vim", "nano", "code"].includes(
          getCommand(parsed.tokens)
        ),
      includeDirectories:
        !isOptionToken(currentToken) &&
        ["cd", "ls", "mkdir", "rmdir"].includes(getCommand(parsed.tokens)),
    };
  }
}

/**
 * Environment variable completion provider.
 */
class EnvVarCompletionProvider implements ITerminalCompletionProvider {
  id = "env-vars";
  priority = 85;
  triggerCharacters = ["$"];

  async provideCompletions(
    context: TerminalCompletionContext
  ): Promise<TerminalCompletionResult | null> {
    const { commandLine, cursorIndex, env, shellType } = context;
    const parsed = parseCommandLine(commandLine.substring(0, cursorIndex));
    const currentToken = parsed.currentToken;

    // Check if we're completing an environment variable
    if (!isEnvVarToken(currentToken)) {
      return null;
    }

    // Extract the variable name being typed
    let varPrefix = "";
    let insertPrefix = "$";

    if (currentToken.startsWith("${")) {
      varPrefix = currentToken.substring(2);
      insertPrefix = "${";
    } else if (currentToken.startsWith("$")) {
      varPrefix = currentToken.substring(1);
      insertPrefix = "$";
    }

    const items: TerminalCompletionItem[] = [];

    // Add environment variables from context
    for (const [name, value] of Object.entries(env)) {
      if (!varPrefix || name.toLowerCase().startsWith(varPrefix.toLowerCase())) {
        const displayValue =
          value.length > 50 ? value.substring(0, 47) + "..." : value;
        const insertText =
          insertPrefix === "${"
            ? `\${${name}}`
            : shellType === "powershell"
              ? `$env:${name}`
              : `$${name}`;

        items.push(
          createCompletionItem(
            name,
            "Variable",
            insertText,
            displayValue,
            `Environment variable: ${value}`
          )
        );
      }
    }

    // Add common environment variable suggestions if they're not set
    for (const prefix of ENV_VAR_PREFIXES) {
      if (
        !varPrefix ||
        prefix.toLowerCase().startsWith(varPrefix.toLowerCase())
      ) {
        if (!env[prefix] && !items.some((i) => i.label === prefix)) {
          const insertText =
            insertPrefix === "${"
              ? `\${${prefix}}`
              : shellType === "powershell"
                ? `$env:${prefix}`
                : `$${prefix}`;

          items.push(
            createCompletionItem(
              prefix,
              "Variable",
              insertText,
              "Common env var prefix",
              `Suggested environment variable`
            )
          );
        }
      }
    }

    // Sort by relevance
    items.sort((a, b) => {
      const scoreA = calculateMatchScore(a.label, varPrefix, false);
      const scoreB = calculateMatchScore(b.label, varPrefix, false);
      return scoreB - scoreA;
    });

    return { items: items.slice(0, 30) };
  }
}

/**
 * File and directory completion provider.
 */
class FileCompletionProvider implements ITerminalCompletionProvider {
  id = "files";
  priority = 80;
  triggerCharacters = ["/", "\\", ".", "~"];

  async provideCompletions(
    context: TerminalCompletionContext
  ): Promise<TerminalCompletionResult | null> {
    const { commandLine, cursorIndex, cwd, platform } = context;
    const parsed = parseCommandLine(commandLine.substring(0, cursorIndex));
    const currentToken = parsed.currentToken;

    // Skip if in quote or looks like an option
    if (parsed.isInQuote || isOptionToken(currentToken)) {
      return null;
    }

    // Determine path to complete
    let pathToComplete = currentToken;

    // Handle home directory
    if (pathToComplete.startsWith("~")) {
      const home = context.env.HOME || context.env.USERPROFILE || "";
      void cwd; // Using cwd as basePath when not handling ~
      void home; // Using home for ~ expansion
      pathToComplete = pathToComplete.substring(1);
      if (pathToComplete.startsWith("/") || pathToComplete.startsWith("\\")) {
        pathToComplete = pathToComplete.substring(1);
      }
    }

    // Split into directory and file prefix
    const pathSep = platform === "win32" ? "\\" : "/";
    const lastSepIndex = Math.max(
      pathToComplete.lastIndexOf("/"),
      pathToComplete.lastIndexOf("\\")
    );

    let filePrefix = pathToComplete;

    if (lastSepIndex >= 0) {
      filePrefix = pathToComplete.substring(lastSepIndex + 1);
    }

    // This is a placeholder - actual file listing would need backend support
    // In a real implementation, this would call the Tauri backend
    const items: TerminalCompletionItem[] = [];

    // Add navigation shortcuts
    if (!filePrefix || ".".startsWith(filePrefix)) {
      items.push(
        createCompletionItem(
          ".",
          "Folder",
          "." + pathSep,
          "Current directory",
          "Current working directory"
        )
      );
    }

    if (!filePrefix || "..".startsWith(filePrefix)) {
      items.push(
        createCompletionItem(
          "..",
          "Folder",
          ".." + pathSep,
          "Parent directory",
          "Go up one directory"
        )
      );
    }

    // Return result indicating files should be fetched
    return {
      items,
      includeFiles: true,
      includeDirectories: true,
      fileGlobPattern: filePrefix ? `${filePrefix}*` : "*",
    };
  }
}

/**
 * History completion provider - suggests from shell history.
 */
class HistoryCompletionProvider implements ITerminalCompletionProvider {
  id = "history";
  priority = 70;

  private history: HistoryEntry[] = [];
  private maxHistorySize = 1000;
  private frequencyData: Map<string, CommandFrequency> = new Map();

  /**
   * Add a command to history.
   */
  addToHistory(entry: HistoryEntry): void {
    // Add to history
    this.history.unshift(entry);

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.pop();
    }

    // Update frequency data
    const command = entry.command.trim().split(" ")[0];
    const freq = this.frequencyData.get(command) || {
      command,
      count: 0,
      lastUsed: 0,
    };
    freq.count++;
    freq.lastUsed = entry.timestamp;
    this.frequencyData.set(command, freq);
  }

  /**
   * Load history from storage.
   */
  loadHistory(entries: HistoryEntry[]): void {
    this.history = entries.slice(0, this.maxHistorySize);

    // Rebuild frequency data
    this.frequencyData.clear();
    for (const entry of this.history) {
      const command = entry.command.trim().split(" ")[0];
      const freq = this.frequencyData.get(command) || {
        command,
        count: 0,
        lastUsed: 0,
      };
      freq.count++;
      if (entry.timestamp > freq.lastUsed) {
        freq.lastUsed = entry.timestamp;
      }
      this.frequencyData.set(command, freq);
    }
  }

  /**
   * Get command frequency for sorting.
   */
  getCommandFrequency(command: string): CommandFrequency | undefined {
    return this.frequencyData.get(command);
  }

  async provideCompletions(
    context: TerminalCompletionContext
  ): Promise<TerminalCompletionResult | null> {
    const { commandLine, cursorIndex } = context;
    const prefix = commandLine.substring(0, cursorIndex).trim();

    if (!prefix) {
      // Show recent unique commands when empty
      const recentCommands = new Set<string>();
      const items: TerminalCompletionItem[] = [];

      for (const entry of this.history) {
        if (recentCommands.size >= 20) break;
        if (!recentCommands.has(entry.command)) {
          recentCommands.add(entry.command);
          items.push(
            createCompletionItem(
              entry.command,
              "Command",
              entry.command,
              "From history",
              `Last used: ${new Date(entry.timestamp).toLocaleString()}`
            )
          );
        }
      }

      return { items };
    }

    // Find matching history entries
    const matchingEntries = new Set<string>();
    const items: TerminalCompletionItem[] = [];

    for (const entry of this.history) {
      if (matchingEntries.size >= 30) break;

      const command = entry.command;
      if (
        !matchingEntries.has(command) &&
        command.toLowerCase().startsWith(prefix.toLowerCase())
      ) {
        matchingEntries.add(command);
        items.push(
          createCompletionItem(
            command,
            "Command",
            command,
            "From history",
            `Last used: ${new Date(entry.timestamp).toLocaleString()}`
          )
        );
      }
    }

    // Also include fuzzy matches
    for (const entry of this.history) {
      if (matchingEntries.size >= 50) break;

      const command = entry.command;
      if (
        !matchingEntries.has(command) &&
        command.toLowerCase().includes(prefix.toLowerCase())
      ) {
        matchingEntries.add(command);
        items.push(
          createCompletionItem(
            command,
            "Command",
            command,
            "From history (fuzzy)",
            `Last used: ${new Date(entry.timestamp).toLocaleString()}`
          )
        );
      }
    }

    return { items };
  }
}

// ============================================================================
// Main Terminal Completion Provider
// ============================================================================

/**
 * Main terminal completion provider that orchestrates multiple sub-providers.
 */
export class TerminalCompletionProvider {
  private config: TerminalCompletionProviderConfig;
  private providers: ITerminalCompletionProvider[] = [];
  private historyProvider: HistoryCompletionProvider;

  // Debouncing
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRequest: {
    resolve: (value: TerminalCompletionItem[]) => void;
    reject: (error: Error) => void;
  } | null = null;

  constructor(config?: Partial<TerminalCompletionProviderConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize built-in providers
    const commandProvider = new CommandCompletionProvider();
    const argumentProvider = new ArgumentCompletionProvider();
    const envVarProvider = new EnvVarCompletionProvider();
    const fileProvider = new FileCompletionProvider();
    this.historyProvider = new HistoryCompletionProvider();

    // Register providers based on config
    if (this.config.enableCommands) {
      this.registerProvider(commandProvider);
    }
    if (this.config.enableArguments) {
      this.registerProvider(argumentProvider);
    }
    if (this.config.enableEnvVars) {
      this.registerProvider(envVarProvider);
    }
    if (this.config.enableFiles) {
      this.registerProvider(fileProvider);
    }
    if (this.config.enableHistory) {
      this.registerProvider(this.historyProvider);
    }
  }

  /**
   * Update configuration.
   */
  configure(config: Partial<TerminalCompletionProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration.
   */
  getConfig(): TerminalCompletionProviderConfig {
    return { ...this.config };
  }

  /**
   * Register a custom completion provider.
   */
  registerProvider(provider: ITerminalCompletionProvider): void {
    this.providers.push(provider);
    // Sort by priority (higher first)
    this.providers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Unregister a completion provider.
   */
  unregisterProvider(providerId: string): boolean {
    const index = this.providers.findIndex((p) => p.id === providerId);
    if (index >= 0) {
      this.providers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Add command to history.
   */
  addToHistory(entry: HistoryEntry): void {
    this.historyProvider.addToHistory(entry);
  }

  /**
   * Load history from storage.
   */
  loadHistory(entries: HistoryEntry[]): void {
    this.historyProvider.loadHistory(entries);
  }

  /**
   * Provide completions for the given context.
   */
  async provideCompletions(
    context: TerminalCompletionContext
  ): Promise<TerminalCompletionItem[]> {
    if (!this.config.enabled) {
      return [];
    }

    // Debounce requests
    return new Promise((resolve, reject) => {
      // Cancel pending request
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        if (this.pendingRequest) {
          this.pendingRequest.resolve([]);
        }
      }

      this.pendingRequest = { resolve, reject };

      this.debounceTimer = setTimeout(async () => {
        try {
          const completions = await this.collectCompletions(context);
          resolve(completions);
        } catch (error) {
          reject(error);
        } finally {
          this.pendingRequest = null;
          this.debounceTimer = null;
        }
      }, this.config.debounceMs);
    });
  }

  /**
   * Collect completions from all providers.
   */
  private async collectCompletions(
    context: TerminalCompletionContext
  ): Promise<TerminalCompletionItem[]> {
    const allItems: TerminalCompletionItem[] = [];
    const seenLabels = new Set<string>();

    // Query each provider
    for (const provider of this.providers) {
      // Skip if provider doesn't support this shell
      if (
        provider.supportedShells &&
        !provider.supportedShells.includes(context.shellType)
      ) {
        continue;
      }

      try {
        const result = await provider.provideCompletions(context);
        if (result) {
          // Add unique items
          for (const item of result.items) {
            if (!seenLabels.has(item.label)) {
              seenLabels.add(item.label);
              allItems.push(item);
            }
          }
        }
      } catch (error) {
        console.error(`[TerminalCompletion] Provider ${provider.id} error:`, error);
      }
    }

    // Sort completions
    const { commandLine, cursorIndex } = context;
    const parsed = parseCommandLine(commandLine.substring(0, cursorIndex));
    const query = parsed.currentToken;

    allItems.sort((a, b) => {
      // First, sort by match score
      const scoreA = calculateMatchScore(a.label, query, this.config.caseSensitive);
      const scoreB = calculateMatchScore(b.label, query, this.config.caseSensitive);

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      // Then by frequency if enabled
      if (this.config.sortByFrequency) {
        const freqA = this.historyProvider.getCommandFrequency(a.label);
        const freqB = this.historyProvider.getCommandFrequency(b.label);

        if (freqA && freqB) {
          return freqB.count - freqA.count;
        }
        if (freqA) return -1;
        if (freqB) return 1;
      }

      // Finally alphabetically
      return a.label.localeCompare(b.label);
    });

    // Limit results
    return allItems.slice(0, this.config.maxCompletions);
  }

  /**
   * Get trigger characters from all providers.
   */
  getTriggerCharacters(): string[] {
    const chars = new Set<string>();
    for (const provider of this.providers) {
      if (provider.triggerCharacters) {
        for (const char of provider.triggerCharacters) {
          chars.add(char);
        }
      }
    }
    return Array.from(chars);
  }

  /**
   * Dispose resources.
   */
  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.pendingRequest) {
      this.pendingRequest.resolve([]);
    }
    this.providers = [];
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let providerInstance: TerminalCompletionProvider | null = null;

/**
 * Get the singleton terminal completion provider.
 */
export function getTerminalCompletionProvider(): TerminalCompletionProvider {
  if (!providerInstance) {
    providerInstance = new TerminalCompletionProvider();
  }
  return providerInstance;
}

/**
 * Reset the singleton instance.
 */
export function resetTerminalCompletionProvider(): void {
  if (providerInstance) {
    providerInstance.dispose();
    providerInstance = null;
  }
}

/**
 * Create a new terminal completion provider with custom config.
 */
export function createTerminalCompletionProvider(
  config?: Partial<TerminalCompletionProviderConfig>
): TerminalCompletionProvider {
  return new TerminalCompletionProvider(config);
}

// ============================================================================
// Helper Exports
// ============================================================================

export {
  parseCommandLine,
  getCommand,
  getCommandContext,
  isOptionToken,
  isEnvVarToken,
  isPathToken,
  createCompletionItem,
  calculateMatchScore,
  escapeForShell,
};

export type { CommandFrequency };

