/**
 * Terminal Types
 *
 * Centralized type definitions for terminal-related functionality including
 * terminal instances, profiles, output handling, and SSH terminal support.
 */

// ============================================================================
// Terminal Info Types
// ============================================================================

/**
 * Terminal type indicator for distinguishing local vs remote terminals.
 */
export type TerminalType = "local" | "ssh";

/**
 * SSH authentication method types.
 */
export type SSHAuthType = "password" | "key" | "agent";

/**
 * SSH authentication configuration.
 */
export interface SSHAuthMethod {
  type: SSHAuthType;
  /** Whether password is stored in keyring (for password auth) */
  has_password?: boolean;
  /** Private key file path (for key auth) */
  private_key_path?: string;
  /** Whether passphrase is stored in keyring (for key auth) */
  has_passphrase?: boolean;
}

/**
 * SSH connection configuration for remote terminals.
 */
export interface SSHConfig {
  /** Remote host address */
  host: string;
  /** SSH port (default: 22) */
  port: number;
  /** Username for SSH connection */
  username: string;
  /** Authentication method configuration */
  auth_method: SSHAuthMethod;
  /** Profile ID for credential lookup */
  profile_id?: string;
  /** Initial working directory on remote */
  initial_cwd?: string;
  /** Environment variables to set on remote */
  env?: Record<string, string>;
}

/**
 * SSH connection status.
 */
export type SSHConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | { error: { message: string } };

/**
 * Information about a terminal instance.
 */
export interface TerminalInfo {
  /** Unique terminal identifier */
  id: string;
  /** Terminal display name */
  name: string;
  /** Current working directory */
  cwd: string;
  /** Shell path or identifier */
  shell: string;
  /** Terminal width in columns */
  cols: number;
  /** Terminal height in rows */
  rows: number;
  /** Current terminal status */
  status: string;
  /** Creation timestamp */
  created_at: number;
  /** Exit code if terminal has exited */
  exitCode?: number;
  /** Last executed command */
  last_command?: string;
  /** Exit code of last command */
  last_exit_code?: number;
  /** Whether a command is currently running */
  command_running: boolean;
  /** Terminal type - local or SSH */
  type?: TerminalType;
  /** SSH configuration (only for SSH terminals) */
  sshConfig?: SSHConfig;
  /** SSH session ID (only for SSH terminals) */
  sshSessionId?: string;
}

/**
 * SSH terminal session info returned from backend.
 */
export interface SSHTerminalInfo {
  /** Session ID */
  id: string;
  /** Display name */
  name: string;
  /** Remote host */
  host: string;
  /** SSH port */
  port: number;
  /** Username */
  username: string;
  /** Terminal columns */
  cols: number;
  /** Terminal rows */
  rows: number;
  /** Connection status */
  status: SSHConnectionStatus;
  /** Creation timestamp */
  created_at: number;
  /** Connected timestamp */
  connected_at?: number;
  /** Remote platform (Linux, Darwin, Windows) */
  remote_platform?: string;
  /** Remote home directory */
  remote_home?: string;
  /** Current working directory */
  cwd?: string;
}

/**
 * SSH terminal output event.
 */
export interface SSHTerminalOutput {
  /** SSH session ID */
  session_id: string;
  /** Output data */
  data: string;
}

/**
 * SSH terminal status event.
 */
export interface SSHTerminalStatus {
  /** SSH session ID */
  session_id: string;
  /** Connection status */
  status: SSHConnectionStatus;
}

/**
 * Options for updating terminal information.
 */
export interface UpdateTerminalOptions {
  /** New current working directory */
  cwd?: string;
  /** Last command executed */
  last_command?: string;
  /** Exit code of last command */
  last_exit_code?: number;
  /** Whether a command is running */
  command_running?: boolean;
}

/**
 * Options for creating a new terminal.
 */
export interface CreateTerminalOptions {
  /** Terminal name */
  name?: string;
  /** Initial working directory */
  cwd?: string;
  /** Shell to use */
  shell?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Initial terminal width */
  cols?: number;
  /** Initial terminal height */
  rows?: number;
  /** Whether to inject shell integration scripts for OSC 633 sequences */
  shell_integration?: boolean;
}

// ============================================================================
// Terminal Profile Types
// ============================================================================

/**
 * Available terminal profile icons.
 */
export type TerminalProfileIcon =
  | "terminal"
  | "powershell"
  | "bash"
  | "zsh"
  | "fish"
  | "cmd"
  | "git"
  | "node"
  | "python"
  | "ruby"
  | "rust"
  | "docker"
  | "ubuntu"
  | "debian"
  | "arch"
  | "fedora"
  | "nushell"
  | "custom";

/**
 * A terminal profile configuration.
 */
export interface TerminalProfile {
  /** Unique profile identifier */
  id: string;
  /** Profile display name */
  name: string;
  /** Path to the shell executable */
  path: string;
  /** Arguments to pass to the shell */
  args: string[];
  /** Icon to display for this profile */
  icon: TerminalProfileIcon;
  /** Profile accent color */
  color: string;
  /** Environment variables for this profile */
  env: Record<string, string>;
  /** Whether this is a built-in profile */
  isBuiltin: boolean;
  /** Whether this is the default profile */
  isDefault: boolean;
}

/**
 * Configuration for creating a new terminal profile.
 */
export interface TerminalProfileConfig {
  /** Profile name */
  name: string;
  /** Shell executable path */
  path: string;
  /** Shell arguments */
  args?: string[];
  /** Profile icon */
  icon?: TerminalProfileIcon;
  /** Profile color */
  color?: string;
  /** Environment variables */
  env?: Record<string, string>;
}

// ============================================================================
// Terminal Output Types
// ============================================================================

/**
 * Terminal output data.
 */
export interface TerminalOutput {
  /** Terminal ID that produced the output */
  terminal_id: string;
  /** Output data */
  data: string;
}

/**
 * Terminal status change event.
 */
export interface TerminalStatus {
  /** Terminal ID */
  terminal_id: string;
  /** New status */
  status: string;
  /** Exit code if applicable */
  exit_code?: number;
}

// ============================================================================
// Terminal Group Types
// ============================================================================

/**
 * Split direction for terminal groups.
 */
export type TerminalSplitDirection = "horizontal" | "vertical";

/**
 * A terminal group containing one or more terminals displayed side-by-side.
 * Like VS Code, terminals in the same group show as split panes,
 * while different groups show as tabs.
 */
export interface TerminalGroup {
  /** Unique group identifier */
  id: string;
  /** Display name for the group (shown in tab) */
  name: string;
  /** Ordered list of terminal IDs in this group */
  terminalIds: string[];
  /** Split direction for multiple terminals */
  splitDirection: TerminalSplitDirection;
  /** Split ratios for each terminal (should sum to 1) */
  splitRatios: number[];
  /** Whether this group is collapsed in the UI */
  isCollapsed: boolean;
  /** Color indicator for the group (optional) */
  color?: string;
  /** Icon for the group tab */
  icon?: string;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Persisted group state for storage.
 */
export interface PersistedTerminalGroupState {
  /** Active group ID */
  activeGroupId: string | null;
  /** Group configurations (without terminal instances) */
  groups: Array<{
    id: string;
    name: string;
    splitDirection: TerminalSplitDirection;
    color?: string;
    icon?: string;
  }>;
}

// ============================================================================
// Terminal State Types
// ============================================================================

/**
 * Complete terminal provider state.
 */
export interface TerminalsState {
  /** All terminal instances */
  terminals: TerminalInfo[];
  /** Currently active terminal ID */
  activeTerminalId: string | null;
  /** Currently active group ID */
  activeGroupId: string | null;
  /** Terminal groups for split view organization */
  groups: TerminalGroup[];
  /** Whether the terminal panel is visible */
  showPanel: boolean;
  /** Available terminal profiles */
  profiles: TerminalProfile[];
  /** ID of the default profile */
  defaultProfileId: string | null;
  /** Whether profiles have been loaded */
  profilesLoaded: boolean;
}

// ============================================================================
// Shell Integration Types
// ============================================================================

/**
 * OSC 633 sequence types for shell integration.
 */
export type ShellIntegrationSequence =
  | "prompt-start"
  | "prompt-end"
  | "command-start"
  | "command-end"
  | "command-line"
  | "continuation-start"
  | "continuation-end";

/**
 * Parsed shell integration event.
 */
export interface ShellIntegrationEvent {
  /** Type of sequence */
  type: ShellIntegrationSequence;
  /** Command line (for command-line sequence) */
  commandLine?: string;
  /** Exit code (for command-end sequence) */
  exitCode?: number;
  /** Current working directory */
  cwd?: string;
}

// ============================================================================
// Terminal Group Action Types
// ============================================================================

/**
 * Options for creating a new terminal group.
 */
export interface CreateGroupOptions {
  /** Group name */
  name?: string;
  /** Initial split direction */
  splitDirection?: TerminalSplitDirection;
  /** Group color */
  color?: string;
  /** Group icon */
  icon?: string;
}

/**
 * Options for moving a terminal to a group.
 */
export interface MoveToGroupOptions {
  /** Terminal ID to move */
  terminalId: string;
  /** Target group ID (if null, creates new group) */
  targetGroupId: string | null;
  /** Position in the group (default: end) */
  position?: number;
}

/**
 * Drag and drop data for terminal group operations.
 */
export interface TerminalDragData {
  /** Type of drag operation */
  type: "terminal" | "group";
  /** Source terminal or group ID */
  sourceId: string;
  /** Source group ID (for terminal drags) */
  sourceGroupId?: string;
}

// ============================================================================
// Shell Integration Advanced Types
// ============================================================================

/**
 * Shell integration state configuration.
 * Tracks the current state of shell integration features.
 */
export interface ShellIntegrationState {
  /** Whether shell integration is enabled */
  enabled: boolean;
  /** Whether command detection (start/end markers) is active */
  commandDetection: boolean;
  /** Whether current working directory detection is active */
  cwdDetection: boolean;
}

/**
 * Represents a command executed in the terminal with full tracking.
 */
export interface TerminalCommand {
  /** The command line that was executed */
  command: string;
  /** Exit code of the command (undefined if still running) */
  exitCode?: number;
  /** Marker position for command start in the buffer */
  commandStartMarker: number;
  /** Marker position for command end in the buffer */
  commandEndMarker?: number;
  /** Marker position for output start in the buffer */
  outputStartMarker?: number;
  /** Current working directory when command was executed */
  cwd: string;
  /** Timestamp when the command was started */
  timestamp: number;
}

/**
 * Decoration information for a command in the terminal.
 * Used for visual indicators like exit code badges.
 */
export interface TerminalCommandDecoration {
  /** The command that was executed */
  command: string;
  /** Exit code of the command */
  exitCode: number;
  /** Line marker position in the terminal buffer */
  marker: number;
  /** Hover message to display */
  hoverMessage: string;
}

// ============================================================================
// Terminal Link Types
// ============================================================================

/**
 * Type of link detected in terminal output.
 */
export type TerminalLinkType = "file" | "url" | "word" | "custom";

/**
 * Represents a clickable link in terminal output.
 */
export interface TerminalLink {
  /** Start index of the link in the line */
  startIndex: number;
  /** Length of the link text */
  length: number;
  /** Tooltip to show on hover */
  tooltip?: string;
  /** Handler function to execute when link is clicked */
  handler: (link: string) => void;
}

// ============================================================================
// Terminal Profile Extended Types
// ============================================================================

/**
 * Source of a terminal profile.
 */
export type TerminalProfileSource = "user" | "extension" | "detected";

/**
 * Extended terminal profile with source tracking and additional options.
 * Extends the base TerminalProfile with more metadata.
 */
export interface TerminalProfileExtended {
  /** Profile display name */
  profileName: string;
  /** Path to the shell executable */
  path: string;
  /** Arguments to pass to the shell */
  args?: string[];
  /** Environment variables for this profile */
  env?: Record<string, string>;
  /** Icon identifier for the profile */
  icon?: string;
  /** Color for the profile tab/indicator */
  color?: string;
  /** Whether to override the terminal name with profile name */
  overrideName?: boolean;
  /** Source of this profile */
  source?: TerminalProfileSource;
}

// ============================================================================
// Terminal Persistence Types
// ============================================================================

/**
 * Terminal persistence configuration.
 * Controls how terminal sessions are preserved across reloads/restarts.
 */
export interface TerminalPersistence {
  /** Whether persistence is enabled for this terminal */
  enabled: boolean;
  /** Whether to save command history */
  history: boolean;
  /** Whether to reconnect terminal on page reload */
  reconnectOnReload: boolean;
}

// ============================================================================
// Terminal Quick Fix Types
// ============================================================================

/**
 * Action available in a quick fix.
 */
export interface TerminalQuickFixAction {
  /** Display title for the action */
  title: string;
  /** Command to execute */
  command: string;
  /** Arguments for the command */
  args?: string[];
}

/**
 * Quick fix suggestion for terminal errors or common patterns.
 */
export interface TerminalQuickFix {
  /** The terminal command that triggered this quick fix */
  terminalCommand: TerminalCommand;
  /** Available actions to resolve the issue */
  actions: TerminalQuickFixAction[];
}

// ============================================================================
// Terminal Completion Types
// ============================================================================

/**
 * Kind of completion item.
 */
export type TerminalCompletionItemKind =
  | "File"
  | "Folder"
  | "Command"
  | "Argument"
  | "Flag"
  | "Variable";

/**
 * A completion item for terminal autocomplete.
 */
export interface TerminalCompletionItem {
  /** Display label for the completion */
  label: string;
  /** Kind of completion (affects icon/styling) */
  kind: TerminalCompletionItemKind;
  /** Short detail text (shown inline) */
  detail?: string;
  /** Full documentation (shown in hover) */
  documentation?: string;
  /** Text to insert when completion is accepted */
  insertText: string;
}

// ============================================================================
// Terminal Environment Types
// ============================================================================

/**
 * Terminal environment configuration.
 * Tracks inherited, added, and removed environment variables.
 */
export interface TerminalEnvironment {
  /** Environment variables inherited from the parent process */
  inherited: Record<string, string>;
  /** Environment variables added specifically for this terminal */
  added: Record<string, string>;
  /** Environment variable names that were removed/unset */
  removed: string[];
}
