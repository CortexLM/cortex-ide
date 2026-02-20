/**
 * =============================================================================
 * TERMINAL QUICK FIX - Inline suggestions for terminal errors
 * =============================================================================
 *
 * Detects common terminal errors and provides quick fix suggestions like
 * VS Code's terminal quick fix feature.
 *
 * Detected error patterns:
 * - Command not found (npm, node, python, etc.)
 * - Permission denied
 * - EACCES errors
 * - Port already in use
 * - Package not installed
 * - Git authentication errors
 * - File/directory not found
 *
 * Features:
 * 1. Lightbulb indicator appears next to error output
 * 2. Click lightbulb to see suggested fixes
 * 3. Actions include:
 *    - Install package (npm install, pip install, etc.)
 *    - Run with sudo/admin privileges
 *    - Kill process on port
 *    - Create missing directory
 *    - Git credential suggestions
 *
 * Usage:
 *   <TerminalQuickFix
 *     terminalId={terminalId}
 *     outputLine={line}
 *     lineNumber={lineNum}
 *     onApplyFix={handleApplyFix}
 *   />
 * =============================================================================
 */

import {
  createSignal,
  createMemo,
  For,
  Show,
  JSX,
  onMount,
  onCleanup,
  Accessor,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Type of quick fix detected
 */
export type QuickFixType =
  | "command-not-found"
  | "permission-denied"
  | "port-in-use"
  | "package-not-found"
  | "directory-not-found"
  | "file-not-found"
  | "git-auth-error"
  | "npm-error"
  | "python-error"
  | "general-error";

/**
 * A quick fix action that can be applied
 */
export interface QuickFixAction {
  /** Unique identifier */
  id: string;
  /** Display title */
  title: string;
  /** Description of what this action does */
  description?: string;
  /** Command to execute (if applicable) */
  command?: string;
  /** Arguments for the command */
  args?: string[];
  /** Icon component to display */
  icon?: JSX.Element;
  /** Whether this action is potentially dangerous */
  isDangerous?: boolean;
  /** Whether this action requires confirmation */
  requiresConfirmation?: boolean;
}

/**
 * Detected quick fix opportunity
 */
export interface QuickFix {
  /** Unique identifier */
  id: string;
  /** Type of fix */
  type: QuickFixType;
  /** The error message that triggered this fix */
  errorMessage: string;
  /** Line number where error occurred */
  lineNumber: number;
  /** Available fix actions */
  actions: QuickFixAction[];
  /** Timestamp when detected */
  timestamp: number;
  /** Additional context extracted from error */
  context?: {
    /** Command that was attempted */
    command?: string;
    /** Package name */
    packageName?: string;
    /** Port number */
    port?: number;
    /** File/directory path */
    path?: string;
  };
}

/**
 * Props for TerminalQuickFix component
 */
export interface TerminalQuickFixProps {
  /** Terminal ID */
  terminalId: string;
  /** Current output line being analyzed */
  outputLine: string;
  /** Line number */
  lineNumber: number;
  /** Callback when a fix is applied */
  onApplyFix: (terminalId: string, action: QuickFixAction) => void;
  /** Whether quick fixes are enabled */
  enabled?: boolean;
  /** Line height for positioning */
  lineHeight?: number;
  /** Scroll offset */
  scrollOffset?: number;
}

/**
 * Props for the QuickFixIndicator component
 */
export interface QuickFixIndicatorProps {
  /** The quick fix to display */
  quickFix: QuickFix;
  /** Line height for positioning */
  lineHeight: number;
  /** Scroll offset */
  scrollOffset: number;
  /** Callback when an action is selected */
  onSelectAction: (action: QuickFixAction) => void;
}

/**
 * Props for the QuickFixMenu component
 */
export interface QuickFixMenuProps {
  /** The quick fix with actions */
  quickFix: QuickFix;
  /** Position for the menu */
  position: { x: number; y: number };
  /** Callback when an action is selected */
  onSelectAction: (action: QuickFixAction) => void;
  /** Callback to close the menu */
  onClose: () => void;
}

// =============================================================================
// ERROR PATTERNS
// =============================================================================

interface ErrorPattern {
  /** Regex pattern to match */
  pattern: RegExp;
  /** Type of quick fix */
  type: QuickFixType;
  /** Function to extract context from match */
  extractContext?: (match: RegExpMatchArray) => QuickFix["context"];
  /** Function to generate actions */
  generateActions: (match: RegExpMatchArray, context?: QuickFix["context"]) => QuickFixAction[];
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // Command not found patterns
  {
    pattern: /(?:command not found|'([^']+)' is not recognized|not recognized as an internal or external command|The term '([^']+)' is not recognized|bash: ([^:]+): command not found|zsh: command not found: ([^\s]+)|([^\s]+): not found)/i,
    type: "command-not-found",
    extractContext: (match) => ({
      command: match[1] || match[2] || match[3] || match[4] || match[5],
    }),
    generateActions: (_match, context) => {
      const cmd = context?.command || "";
      const actions: QuickFixAction[] = [];

      // npm/node related
      if (cmd === "npm" || cmd === "npx" || cmd === "node") {
        actions.push({
          id: "install-nodejs",
          title: "Install Node.js",
          description: "Download and install Node.js from nodejs.org",
          icon: <Icon name="download" size={14} />,
          command: "echo",
          args: ["Please install Node.js from https://nodejs.org"],
        });
      }
      // Python related
      else if (cmd === "python" || cmd === "python3" || cmd === "pip" || cmd === "pip3") {
        actions.push({
          id: "install-python",
          title: "Install Python",
          description: "Download and install Python from python.org",
          icon: <Icon name="download" size={14} />,
          command: "echo",
          args: ["Please install Python from https://python.org"],
        });
      }
      // Git
      else if (cmd === "git") {
        actions.push({
          id: "install-git",
          title: "Install Git",
          description: "Download and install Git",
          icon: <Icon name="download" size={14} />,
          command: "echo",
          args: ["Please install Git from https://git-scm.com"],
        });
      }
      // Rust/Cargo
      else if (cmd === "cargo" || cmd === "rustc") {
        actions.push({
          id: "install-rust",
          title: "Install Rust",
          description: "Install Rust via rustup",
          icon: <Icon name="download" size={14} />,
          command: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
        });
      }
      // Generic - try to install via package manager
      else {
        // Windows
        actions.push({
          id: "install-winget",
          title: `Try: winget install ${cmd}`,
          description: "Install using Windows Package Manager",
          icon: <Icon name="box" size={14} />,
          command: "winget",
          args: ["install", cmd],
        });
        // Also suggest scoop
        actions.push({
          id: "install-scoop",
          title: `Try: scoop install ${cmd}`,
          description: "Install using Scoop package manager",
          icon: <Icon name="box" size={14} />,
          command: "scoop",
          args: ["install", cmd],
        });
      }

      return actions;
    },
  },

  // Permission denied patterns
  {
    pattern: /(?:permission denied|EACCES|access denied|Operation not permitted|requires administrator privileges|elevation required)/i,
    type: "permission-denied",
    extractContext: (match) => ({
      path: match.input?.match(/['"]([^'"]+)['"]/)?.[1],
    }),
    generateActions: (_match, context) => {
      const actions: QuickFixAction[] = [
        {
          id: "run-as-admin",
          title: "Run as Administrator",
          description: "Run the terminal with elevated privileges",
          icon: <Icon name="shield" size={14} />,
          isDangerous: true,
          requiresConfirmation: true,
        },
      ];

      if (context?.path) {
        actions.push({
          id: "fix-permissions",
          title: `Fix permissions for ${context.path}`,
          description: "Take ownership and set permissions",
          icon: <Icon name="key" size={14} />,
          command: "icacls",
          args: [context.path, "/grant", "%USERNAME%:F"],
          isDangerous: true,
          requiresConfirmation: true,
        });
      }

      return actions;
    },
  },

  // Port in use patterns
  {
    pattern: /(?:EADDRINUSE|address already in use|port (\d+) is already in use|listen EADDRINUSE.*:(\d+)|bind\(\): Address already in use)/i,
    type: "port-in-use",
    extractContext: (match) => ({
      port: parseInt(match[1] || match[2] || "0", 10) || undefined,
    }),
    generateActions: (_match, context) => {
      const port = context?.port;
      const actions: QuickFixAction[] = [];

      if (port) {
        // Windows
        actions.push({
          id: "find-process-windows",
          title: `Find process using port ${port}`,
          description: "Show which process is using the port",
          icon: <Icon name="terminal" size={14} />,
          command: "netstat",
          args: ["-ano", "|", "findstr", `:${port}`],
        });
        actions.push({
          id: "kill-port-windows",
          title: `Kill process on port ${port}`,
          description: "Terminate the process using this port",
          icon: <Icon name="circle-xmark" size={14} />,
          // This is a placeholder - actual implementation would need to find PID first
          command: "npx",
          args: ["kill-port", String(port)],
          isDangerous: true,
          requiresConfirmation: true,
        });
      }

      actions.push({
        id: "use-different-port",
        title: "Use a different port",
        description: "Suggests using environment variable to change port",
        icon: <Icon name="rotate" size={14} />,
        command: "echo",
        args: ["Set PORT environment variable to use a different port"],
      });

      return actions;
    },
  },

  // NPM package not found
  {
    pattern: /(?:Cannot find module ['"]([^'"]+)['"]|Module not found: Can't resolve ['"]([^'"]+)['"]|ERR! 404 Not Found.*: ([^\s@]+))/i,
    type: "package-not-found",
    extractContext: (match) => ({
      packageName: match[1] || match[2] || match[3],
    }),
    generateActions: (_match, context) => {
      const pkg = context?.packageName || "";
      // Clean package name (remove path portions for local imports)
      const cleanPkg = pkg.startsWith(".") ? pkg : pkg.split("/")[0].replace(/^@/, "@");
      
      return [
        {
          id: "npm-install",
          title: `npm install ${cleanPkg}`,
          description: "Install the missing package with npm",
          icon: <Icon name="download" size={14} />,
          command: "npm",
          args: ["install", cleanPkg],
        },
        {
          id: "npm-install-dev",
          title: `npm install -D ${cleanPkg}`,
          description: "Install as dev dependency",
          icon: <Icon name="download" size={14} />,
          command: "npm",
          args: ["install", "-D", cleanPkg],
        },
        {
          id: "yarn-add",
          title: `yarn add ${cleanPkg}`,
          description: "Install the missing package with yarn",
          icon: <Icon name="download" size={14} />,
          command: "yarn",
          args: ["add", cleanPkg],
        },
        {
          id: "pnpm-add",
          title: `pnpm add ${cleanPkg}`,
          description: "Install the missing package with pnpm",
          icon: <Icon name="download" size={14} />,
          command: "pnpm",
          args: ["add", cleanPkg],
        },
      ];
    },
  },

  // Directory not found
  {
    pattern: /(?:ENOENT.*no such file or directory.*['"]([^'"]+)['"]|The system cannot find the path specified.*['"]?([^\s'"]+)['"]?|directory ['"]([^'"]+)['"] does not exist)/i,
    type: "directory-not-found",
    extractContext: (match) => ({
      path: match[1] || match[2] || match[3],
    }),
    generateActions: (_match, context) => {
      const dirPath = context?.path || "";
      
      return [
        {
          id: "create-directory",
          title: `Create directory: ${dirPath}`,
          description: "Create the missing directory",
          icon: <Icon name="folder" size={14} />,
          command: "mkdir",
          args: ["-p", dirPath],
        },
      ];
    },
  },

  // Git authentication errors
  {
    pattern: /(?:fatal: Authentication failed|Permission denied \(publickey\)|Host key verification failed|git@.*: Permission denied)/i,
    type: "git-auth-error",
    generateActions: () => [
      {
        id: "check-ssh-keys",
        title: "Check SSH keys",
        description: "List available SSH keys",
        icon: <Icon name="key" size={14} />,
        command: "ssh-add",
        args: ["-l"],
      },
      {
        id: "generate-ssh-key",
        title: "Generate new SSH key",
        description: "Create a new SSH key pair",
        icon: <Icon name="key" size={14} />,
        command: "ssh-keygen",
        args: ["-t", "ed25519", "-C", "your_email@example.com"],
        requiresConfirmation: true,
      },
      {
        id: "use-https",
        title: "Switch to HTTPS",
        description: "Use HTTPS instead of SSH for Git",
        icon: <Icon name="rotate" size={14} />,
        command: "echo",
        args: ["Use: git remote set-url origin https://github.com/USER/REPO.git"],
      },
    ],
  },

  // NPM errors
  {
    pattern: /(?:npm ERR!|ERESOLVE|peer dep missing|Could not resolve dependency)/i,
    type: "npm-error",
    generateActions: () => [
      {
        id: "npm-clean-install",
        title: "Clean install",
        description: "Remove node_modules and reinstall",
        icon: <Icon name="rotate" size={14} />,
        command: "rm",
        args: ["-rf", "node_modules", "&&", "npm", "install"],
      },
      {
        id: "npm-legacy-peer-deps",
        title: "Install with --legacy-peer-deps",
        description: "Bypass peer dependency conflicts",
        icon: <Icon name="download" size={14} />,
        command: "npm",
        args: ["install", "--legacy-peer-deps"],
      },
      {
        id: "npm-force",
        title: "Force install",
        description: "Force installation (use with caution)",
        icon: <Icon name="triangle-exclamation" size={14} />,
        command: "npm",
        args: ["install", "--force"],
        isDangerous: true,
        requiresConfirmation: true,
      },
    ],
  },

  // Python/pip errors
  {
    pattern: /(?:ModuleNotFoundError: No module named ['"]([^'"]+)['"]|ImportError: No module named ['"]([^'"]+)['"])/i,
    type: "python-error",
    extractContext: (match) => ({
      packageName: match[1] || match[2],
    }),
    generateActions: (_match, context) => {
      const pkg = context?.packageName || "";
      
      return [
        {
          id: "pip-install",
          title: `pip install ${pkg}`,
          description: "Install the missing Python package",
          icon: <Icon name="download" size={14} />,
          command: "pip",
          args: ["install", pkg],
        },
        {
          id: "pip3-install",
          title: `pip3 install ${pkg}`,
          description: "Install with pip3",
          icon: <Icon name="download" size={14} />,
          command: "pip3",
          args: ["install", pkg],
        },
        {
          id: "pip-install-user",
          title: `pip install --user ${pkg}`,
          description: "Install for current user only",
          icon: <Icon name="download" size={14} />,
          command: "pip",
          args: ["install", "--user", pkg],
        },
      ];
    },
  },
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `qf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Detect quick fixes for a given output line
 */
export function detectQuickFixes(
  line: string,
  lineNumber: number
): QuickFix | null {
  for (const pattern of ERROR_PATTERNS) {
    const match = line.match(pattern.pattern);
    if (match) {
      const context = pattern.extractContext?.(match);
      const actions = pattern.generateActions(match, context);

      if (actions.length > 0) {
        return {
          id: generateId(),
          type: pattern.type,
          errorMessage: line.trim(),
          lineNumber,
          actions,
          timestamp: Date.now(),
          context,
        };
      }
    }
  }
  return null;
}

/**
 * Get icon for quick fix type
 */
function getQuickFixIcon(type: QuickFixType): JSX.Element {
  switch (type) {
    case "command-not-found":
      return <Icon name="box" size={14} />;
    case "permission-denied":
      return <Icon name="shield" size={14} />;
    case "port-in-use":
      return <Icon name="circle-xmark" size={14} />;
    case "package-not-found":
      return <Icon name="download" size={14} />;
    case "directory-not-found":
    case "file-not-found":
      return <Icon name="folder" size={14} />;
    case "git-auth-error":
      return <Icon name="key" size={14} />;
    case "npm-error":
    case "python-error":
      return <Icon name="triangle-exclamation" size={14} />;
    default:
      return <Icon name="bolt" size={14} />;
  }
}

/**
 * Get human-readable title for quick fix type
 */
function getQuickFixTitle(type: QuickFixType): string {
  switch (type) {
    case "command-not-found":
      return "Command Not Found";
    case "permission-denied":
      return "Permission Denied";
    case "port-in-use":
      return "Port In Use";
    case "package-not-found":
      return "Package Not Found";
    case "directory-not-found":
      return "Directory Not Found";
    case "file-not-found":
      return "File Not Found";
    case "git-auth-error":
      return "Git Authentication Error";
    case "npm-error":
      return "NPM Error";
    case "python-error":
      return "Python Error";
    default:
      return "Error Detected";
  }
}

// =============================================================================
// QUICK FIX MENU COMPONENT
// =============================================================================

function QuickFixMenu(props: QuickFixMenuProps) {
  let menuRef: HTMLDivElement | undefined;

  // Close menu when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    if (menuRef && !menuRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  // Close menu on escape
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
  });

  const menuStyle = (): JSX.CSSProperties => ({
    position: "fixed",
    left: `${props.position.x}px`,
    top: `${props.position.y}px`,
    "min-width": "280px",
    "max-width": "400px",
    background: tokens.colors.surface.popup,
    border: `1px solid ${tokens.colors.border.default}`,
    "border-radius": tokens.radius.md,
    "box-shadow": tokens.shadows.popup,
    "z-index": "10001",
    overflow: "hidden",
  });

  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    background: tokens.colors.surface.panel,
    "border-bottom": `1px solid ${tokens.colors.border.default}`,
    color: tokens.colors.text.primary,
    "font-size": "12px",
    "font-weight": "500",
  });

  const errorTextStyle: JSX.CSSProperties = {
    padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
    "font-family": "var(--font-mono)",
    "font-size": "11px",
    color: tokens.colors.text.muted,
    background: tokens.colors.surface.canvas,
    "border-bottom": `1px solid ${tokens.colors.border.default}`,
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  };

  const actionsContainerStyle: JSX.CSSProperties = {
    padding: tokens.spacing.xs,
  };

  const actionItemStyle = (isDangerous?: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    "border-radius": tokens.radius.sm,
    cursor: "pointer",
    transition: "background 150ms ease",
    color: isDangerous ? tokens.colors.semantic.error : tokens.colors.text.primary,
  });

  const actionTitleStyle: JSX.CSSProperties = {
    flex: "1",
    "font-size": "12px",
  };

  const actionDescStyle: JSX.CSSProperties = {
    "font-size": "10px",
    color: tokens.colors.text.muted,
    "margin-top": "2px",
  };

  return (
    <div ref={menuRef} style={menuStyle()}>
      {/* Header */}
      <div style={headerStyle()}>
        {getQuickFixIcon(props.quickFix.type)}
        <span>{getQuickFixTitle(props.quickFix.type)}</span>
      </div>

      {/* Error message */}
      <div style={errorTextStyle} title={props.quickFix.errorMessage}>
        {props.quickFix.errorMessage.length > 60
          ? props.quickFix.errorMessage.substring(0, 60) + "..."
          : props.quickFix.errorMessage}
      </div>

      {/* Actions */}
      <div style={actionsContainerStyle}>
        <For each={props.quickFix.actions}>
          {(action) => (
            <div
              style={actionItemStyle(action.isDangerous)}
              onClick={() => props.onSelectAction(action)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tokens.colors.interactive.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  props.onSelectAction(action);
                }
              }}
            >
              <span style={{ color: action.isDangerous ? tokens.colors.semantic.error : tokens.colors.text.muted }}>
                {action.icon || <Icon name="bolt" size={14} />}
              </span>
              <div style={{ flex: "1" }}>
                <div style={actionTitleStyle}>{action.title}</div>
                <Show when={action.description}>
                  <div style={actionDescStyle}>{action.description}</div>
                </Show>
              </div>
              <Show when={action.isDangerous}>
                <Icon name="triangle-exclamation" size={12} color={tokens.colors.semantic.warning} />
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

// =============================================================================
// QUICK FIX INDICATOR COMPONENT
// =============================================================================

function QuickFixIndicator(props: QuickFixIndicatorProps) {
  const [showMenu, setShowMenu] = createSignal(false);
  const [menuPosition, setMenuPosition] = createSignal({ x: 0, y: 0 });

  // Calculate vertical position
  const topPosition = () => {
    const relativeLine = props.quickFix.lineNumber - props.scrollOffset;
    return relativeLine * props.lineHeight;
  };

  // Check if visible
  const isVisible = () => {
    const top = topPosition();
    return top >= -props.lineHeight && top < 1000;
  };

  const indicatorStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: "2px",
    top: `${topPosition()}px`,
    width: "16px",
    height: `${props.lineHeight}px`,
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    cursor: "pointer",
    color: tokens.colors.semantic.warning,
    opacity: showMenu() ? "1" : "0.8",
    transition: "opacity 150ms ease, transform 150ms ease",
    transform: showMenu() ? "scale(1.1)" : "scale(1)",
  });

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const handleSelectAction = (action: QuickFixAction) => {
    setShowMenu(false);
    props.onSelectAction(action);
  };

  return (
    <Show when={isVisible()}>
      <div
        style={indicatorStyle()}
        onClick={handleClick}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          if (!showMenu()) {
            e.currentTarget.style.opacity = "0.8";
          }
        }}
        title="Quick Fix Available - Click for suggestions"
        data-quickfix-id={props.quickFix.id}
        data-quickfix-line={props.quickFix.lineNumber}
      >
        <Icon name="bolt" size={14} />
      </div>

      {/* Menu popup */}
      <Show when={showMenu()}>
        <QuickFixMenu
          quickFix={props.quickFix}
          position={menuPosition()}
          onSelectAction={handleSelectAction}
          onClose={() => setShowMenu(false)}
        />
      </Show>
    </Show>
  );
}

// =============================================================================
// MAIN TERMINAL QUICK FIX COMPONENT
// =============================================================================

/**
 * Container component that manages multiple quick fixes
 */
export interface TerminalQuickFixContainerProps {
  /** Terminal ID */
  terminalId: string;
  /** Array of detected quick fixes */
  quickFixes: QuickFix[];
  /** Callback when a fix is applied */
  onApplyFix: (action: QuickFixAction) => void;
  /** Whether quick fixes are enabled */
  enabled?: boolean;
  /** Line height for positioning */
  lineHeight?: number;
  /** Scroll offset in lines */
  scrollOffset?: number;
  /** Visible lines count */
  visibleLines?: number;
}

export function TerminalQuickFixContainer(props: TerminalQuickFixContainerProps) {
  const lineHeight = () => props.lineHeight ?? 18;
  const scrollOffset = () => props.scrollOffset ?? 0;

  // Filter visible quick fixes
  const visibleQuickFixes = createMemo(() => {
    if (!props.enabled) return [];

    const visibleLinesCount = props.visibleLines ?? 50;
    const minLine = scrollOffset();
    const maxLine = scrollOffset() + visibleLinesCount + 5;

    return props.quickFixes.filter(
      (qf) => qf.lineNumber >= minLine - 5 && qf.lineNumber <= maxLine
    );
  });

  const containerStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: "0",
    top: "0",
    width: "20px",
    height: "100%",
    overflow: "hidden",
    "pointer-events": "auto",
    "z-index": "6",
  });

  return (
    <Show when={props.enabled !== false && props.quickFixes.length > 0}>
      <div
        class="terminal-quickfix-container"
        style={containerStyle()}
        data-terminal-id={props.terminalId}
      >
        <For each={visibleQuickFixes()}>
          {(quickFix) => (
            <QuickFixIndicator
              quickFix={quickFix}
              lineHeight={lineHeight()}
              scrollOffset={scrollOffset()}
              onSelectAction={props.onApplyFix}
            />
          )}
        </For>
      </div>
    </Show>
  );
}

// =============================================================================
// HOOK FOR MANAGING QUICK FIXES
// =============================================================================

export interface UseTerminalQuickFixesOptions {
  /** Maximum number of quick fixes to keep */
  maxQuickFixes?: number;
  /** Whether quick fixes are enabled */
  enabled?: boolean;
  /** Callback when a quick fix is detected */
  onQuickFixDetected?: (quickFix: QuickFix) => void;
}

export interface UseTerminalQuickFixesReturn {
  /** Current quick fixes */
  quickFixes: Accessor<QuickFix[]>;
  /** Process a line of output for quick fixes */
  processLine: (line: string, lineNumber: number) => QuickFix | null;
  /** Clear all quick fixes */
  clear: () => void;
  /** Remove a specific quick fix */
  remove: (id: string) => void;
  /** Get quick fix by ID */
  getById: (id: string) => QuickFix | undefined;
  /** Get quick fix by line number */
  getByLine: (lineNumber: number) => QuickFix | undefined;
  /** Whether quick fixes are enabled */
  enabled: Accessor<boolean>;
  /** Set enabled state */
  setEnabled: (enabled: boolean) => void;
}

/**
 * Hook for managing terminal quick fixes
 */
export function useTerminalQuickFixes(
  options: UseTerminalQuickFixesOptions = {}
): UseTerminalQuickFixesReturn {
  const maxQuickFixes = options.maxQuickFixes ?? 50;

  const [quickFixes, setQuickFixes] = createStore<QuickFix[]>([]);
  const [enabled, setEnabled] = createSignal(options.enabled ?? true);

  const processLine = (line: string, lineNumber: number): QuickFix | null => {
    if (!enabled()) return null;

    const quickFix = detectQuickFixes(line, lineNumber);

    if (quickFix) {
      setQuickFixes(
        produce((qfs) => {
          // Check if we already have a quick fix for this line
          const existingIndex = qfs.findIndex((qf) => qf.lineNumber === lineNumber);
          if (existingIndex !== -1) {
            qfs[existingIndex] = quickFix;
          } else {
            qfs.push(quickFix);
            // Trim to max
            while (qfs.length > maxQuickFixes) {
              qfs.shift();
            }
          }
        })
      );

      options.onQuickFixDetected?.(quickFix);
    }

    return quickFix;
  };

  const clear = () => {
    setQuickFixes([]);
  };

  const remove = (id: string) => {
    setQuickFixes(
      produce((qfs) => {
        const index = qfs.findIndex((qf) => qf.id === id);
        if (index !== -1) {
          qfs.splice(index, 1);
        }
      })
    );
  };

  const getById = (id: string): QuickFix | undefined => {
    return quickFixes.find((qf) => qf.id === id);
  };

  const getByLine = (lineNumber: number): QuickFix | undefined => {
    return quickFixes.find((qf) => qf.lineNumber === lineNumber);
  };

  return {
    quickFixes: () => quickFixes,
    processLine,
    clear,
    remove,
    getById,
    getByLine,
    enabled,
    setEnabled,
  };
}

// =============================================================================
// SINGLE LINE QUICK FIX COMPONENT (SIMPLE USE)
// =============================================================================

/**
 * Simple component to detect and display quick fix for a single line
 */
export function TerminalQuickFix(props: TerminalQuickFixProps) {
  const quickFix = createMemo(() => {
    if (!props.enabled) return null;
    return detectQuickFixes(props.outputLine, props.lineNumber);
  });

  const lineHeight = () => props.lineHeight ?? 18;
  const scrollOffset = () => props.scrollOffset ?? 0;

  return (
    <Show when={quickFix()}>
      {(qf) => (
        <QuickFixIndicator
          quickFix={qf()}
          lineHeight={lineHeight()}
          scrollOffset={scrollOffset()}
          onSelectAction={(action) => props.onApplyFix(props.terminalId, action)}
        />
      )}
    </Show>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default TerminalQuickFixContainer;
