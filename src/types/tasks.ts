/**
 * Task System Types
 * 
 * Complete type definitions for the task system, including:
 * - Input variables for interactive task prompts
 * - Task configuration and execution
 * - Shell configuration
 * - OS-specific settings
 * - Presentation options
 * - Task events and execution tracking
 * 
 * These types are compatible with VSCode's tasks.json format
 * and extend the TasksContext functionality.
 */

// ============================================================================
// Input Variables - Interactive Task Prompts
// ============================================================================

/**
 * Pick option for pickString input type
 */
export interface TaskInputPickOption {
  /** Display label for the option */
  label: string;
  /** Actual value used when selected */
  value: string;
  /** Optional description shown alongside the label */
  description?: string;
}

/**
 * Input variable definition for task variable substitution.
 * Supports interactive prompts for user input during task execution.
 * 
 * @example
 * // promptString - simple text input
 * { id: "userName", type: "promptString", description: "Enter your name", default: "user" }
 * 
 * @example
 * // pickString - selection from list
 * { id: "env", type: "pickString", options: ["dev", "prod"], default: "dev" }
 * 
 * @example
 * // command - value from command execution
 * { id: "branch", type: "command", command: "git.currentBranch" }
 */
export interface TaskInputVariable {
  /** Unique identifier for referencing this input (${input:id}) */
  id: string;
  /** Type of input prompt */
  type: 'promptString' | 'pickString' | 'command';
  /** Description shown to user when prompting */
  description?: string;
  /** Default value if user provides none */
  default?: string;
  /** Options for pickString type - can be strings or labeled options */
  options?: string[] | TaskInputPickOption[];
  /** Whether to mask the input (for passwords/secrets) */
  password?: boolean;
  /** Command ID to execute for command type */
  command?: string;
  /** Arguments to pass to the command */
  args?: Record<string, unknown>;
}

// ============================================================================
// Depends Order - Task Dependency Execution
// ============================================================================

/**
 * Specifies how dependent tasks should be executed.
 * - 'parallel': Run all dependencies concurrently
 * - 'sequence': Run dependencies one after another in order
 */
export type DependsOrder = 'parallel' | 'sequence';

// ============================================================================
// Instance Policy - Multiple Task Instance Handling
// ============================================================================

/**
 * Policy for handling multiple running instances of the same task.
 * - 'terminateNewest': Kill the newly started instance
 * - 'terminateOldest': Kill the oldest running instance
 * - 'prompt': Ask the user what to do
 * - 'warn': Show a warning but allow multiple instances
 * - 'silent': Allow multiple instances without warning
 */
export type InstancePolicy = 'terminateNewest' | 'terminateOldest' | 'prompt' | 'warn' | 'silent';

// ============================================================================
// Shell Configuration - Custom Shell Settings
// ============================================================================

/**
 * Options for shell quoting behavior
 */
export interface ShellQuotingOptions {
  /** 
   * Escape character or configuration for escaping special characters.
   * Can be a single character or an object specifying the escape char and which chars to escape.
   */
  escape?: string | { escapeChar: string; charsToEscape: string };
  /** Strong quoting character (e.g., single quote in bash) */
  strong?: string;
  /** Weak quoting character (e.g., double quote in bash) */
  weak?: string;
}

/**
 * Shell configuration for task execution.
 * Allows customizing which shell is used and how arguments are passed.
 * 
 * @example
 * // Use PowerShell on Windows
 * { executable: "powershell.exe", args: ["-NoProfile", "-Command"] }
 * 
 * @example
 * // Use bash with custom quoting
 * { executable: "/bin/bash", args: ["-c"], quoting: { escape: "\\", strong: "'", weak: "\"" } }
 */
export interface ShellConfiguration {
  /** Path to the shell executable */
  executable?: string;
  /** Arguments to pass to the shell before the command */
  args?: string[];
  /** Quoting options for the shell */
  quoting?: ShellQuotingOptions;
}

// ============================================================================
// OS-Specific Configuration
// ============================================================================

/**
 * Base task configuration properties that can be overridden per OS.
 * This interface represents the common properties that can differ between platforms.
 */
export interface TaskConfigurationBase {
  /** Command to execute */
  command?: string;
  /** Arguments for the command */
  args?: string[];
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Shell configuration */
  shell?: ShellConfiguration;
  /** Presentation options */
  presentation?: TaskPresentationOptions;
}

/**
 * Alias for base configuration (used in OS-specific contexts)
 */
export type TaskConfiguration = TaskConfigurationBase;

/**
 * OS-specific task configuration overrides.
 * Properties defined here override the base task configuration for the specific OS.
 * 
 * @example
 * {
 *   command: "build.sh",
 *   windows: { command: "build.cmd" },
 *   osx: { command: "./build.sh", shell: { executable: "/bin/zsh" } }
 * }
 */
export interface TaskOSConfiguration {
  /** Windows-specific configuration */
  windows?: TaskConfiguration;
  /** Linux-specific configuration */
  linux?: TaskConfiguration;
  /** macOS-specific configuration */
  osx?: TaskConfiguration;
}

// ============================================================================
// Presentation Options - Terminal Display Settings
// ============================================================================

/**
 * Complete presentation options for controlling how task output is displayed.
 * These options control the terminal panel behavior during task execution.
 */
export interface TaskPresentationOptions {
  /** 
   * When to reveal the terminal panel.
   * - 'always': Show terminal when task starts
   * - 'silent': Only show if there's an error or problem output
   * - 'never': Never automatically show the terminal
   */
  reveal?: 'always' | 'silent' | 'never';
  
  /**
   * When to reveal the problems panel based on task output.
   * - 'never': Never auto-reveal problems panel
   * - 'onProblem': Reveal only when problems are detected
   * - 'always': Always reveal problems panel
   */
  revealProblems?: 'never' | 'onProblem' | 'always';
  
  /** Whether to echo the command being executed in the terminal */
  echo?: boolean;
  
  /** Whether to focus the terminal panel when the task runs */
  focus?: boolean;
  
  /**
   * Terminal panel sharing behavior.
   * - 'shared': Share terminal with other tasks in the same group
   * - 'dedicated': Use a dedicated terminal for this task
   * - 'new': Always create a new terminal instance
   */
  panel?: 'shared' | 'dedicated' | 'new';
  
  /** Whether to show the "Terminal will be reused by tasks" message */
  showReuseMessage?: boolean;
  
  /** Whether to clear the terminal before running the task */
  clear?: boolean;
  
  /** Whether to close the terminal when the task completes successfully */
  close?: boolean;
  
  /** 
   * Group name for panel sharing.
   * Tasks with the same group share a terminal when panel is 'shared'.
   */
  group?: string;
}

// ============================================================================
// Run Options - Task Execution Behavior
// ============================================================================

/**
 * Options controlling task execution behavior.
 */
export interface TaskRunOptions {
  /** 
   * Whether to re-evaluate variables when rerunning the task.
   * If true, input prompts will be shown again on rerun.
   */
  reevaluateOnRerun?: boolean;
  
  /**
   * When to automatically run this task.
   * - 'default': Only run when explicitly triggered
   * - 'folderOpen': Automatically run when the folder is opened
   */
  runOn?: 'default' | 'folderOpen';
  
  /** Maximum number of concurrent instances allowed */
  instanceLimit?: number;
  
  /** Policy for handling multiple running instances */
  instancePolicy?: InstancePolicy;
}

// ============================================================================
// Task Execution - Runtime State and Events
// ============================================================================

/**
 * Represents a running task execution instance.
 * Contains metadata about the task being executed.
 */
export interface TaskExecution {
  /** Unique identifier for this execution */
  id: string;
  /** The task being executed */
  task: {
    /** Task label/name */
    label: string;
    /** Task type (shell, process, etc.) */
    type: string;
    /** Task source (user, workspace, auto-detected) */
    source?: string;
    /** Task group (build, test, etc.) */
    group?: string;
  };
  /** Terminal ID if running in a terminal */
  terminalId?: string;
}

/**
 * Event fired when a task starts executing.
 */
export interface TaskStartEvent {
  /** The execution that started */
  execution: TaskExecution;
}

/**
 * Event fired when a task finishes executing.
 */
export interface TaskEndEvent {
  /** The execution that ended */
  execution: TaskExecution;
  /** Exit code of the task (undefined if task was cancelled or errored) */
  exitCode?: number;
}

/**
 * Event fired when the underlying process of a task starts.
 * This is separate from TaskStartEvent as there may be a delay
 * between task start and process creation.
 */
export interface TaskProcessStartEvent {
  /** The execution that started the process */
  execution: TaskExecution;
  /** Operating system process ID */
  processId: number;
}

/**
 * Event fired when the underlying process of a task ends.
 */
export interface TaskProcessEndEvent {
  /** The execution whose process ended */
  execution: TaskExecution;
  /** Exit code of the process */
  exitCode: number;
}

// ============================================================================
// Extended Task Configuration
// ============================================================================

/**
 * Complete task definition with all possible options.
 * Extends the basic TaskConfig with advanced features.
 */
export interface TaskDefinition extends TaskConfigurationBase, TaskOSConfiguration {
  /** Unique label for the task */
  label: string;
  
  /** Task type identifier */
  type: string;
  
  /** 
   * Task group assignment.
   * Can be a simple string or an object specifying default status.
   */
  group?: string | {
    kind: string;
    isDefault?: boolean;
  };
  
  /** Problem matchers for parsing output into diagnostics */
  problemMatcher?: string | object | (string | object)[];
  
  /** Labels of tasks that must run before this task */
  dependsOn?: string | string[];
  
  /** Order in which dependent tasks should run */
  dependsOrder?: DependsOrder;
  
  /** Run options controlling execution behavior */
  runOptions?: TaskRunOptions;
  
  /** Whether this is a background/watching task */
  isBackground?: boolean;
  
  /** Input variables for this task */
  inputs?: TaskInputVariable[];
  
  /** Detail text shown in quick pick (below the label) */
  detail?: string;
  
  /** Icon for the task in UI */
  icon?: {
    id: string;
    color?: string;
  };
  
  /** Hide this task from the UI (but still runnable via dependsOn) */
  hide?: boolean;
}

// ============================================================================
// Tasks File Structure
// ============================================================================

/**
 * Structure of a tasks.json file.
 */
export interface TasksFile {
  /** Schema version (e.g., "2.0.0") */
  version?: string;
  
  /** Array of task definitions */
  tasks?: TaskDefinition[];
  
  /** Global input variables available to all tasks */
  inputs?: TaskInputVariable[];
  
  /** OS-specific defaults */
  windows?: TaskConfigurationBase;
  linux?: TaskConfigurationBase;
  osx?: TaskConfigurationBase;
}

// ============================================================================
// Task Provider Types
// ============================================================================

/**
 * Callback type for task provider registration
 */
export type TaskProviderCallback = (
  cwd: string,
  readFile: (path: string) => Promise<string | null>
) => Promise<TaskDefinition[]>;

/**
 * Task provider definition for auto-detection
 */
export interface TaskProviderDefinition {
  /** Unique provider identifier */
  id: string;
  /** Human-readable provider name */
  name: string;
  /** Config files that trigger this provider */
  configFiles: string[];
  /** Whether the provider is enabled */
  enabled: boolean;
  /** Detection function */
  detect: TaskProviderCallback;
}

// ============================================================================
// Task Filter
// ============================================================================

/**
 * Filter for querying tasks
 */
export interface TaskFilter {
  /** Filter by task type */
  type?: string;
  /** Filter by task group */
  group?: string;
  /** Filter by source */
  source?: 'user' | 'workspace' | 'auto-detected';
  /** Filter by provider ID */
  providerId?: string;
  /** Include background tasks */
  includeBackground?: boolean;
}

// ============================================================================
// Task Quick Pick Item
// ============================================================================

/**
 * Task item for display in quick pick menus
 */
export interface TaskQuickPickItem {
  /** Task label */
  label: string;
  /** Task detail/description */
  detail?: string;
  /** Task description (shown on right side) */
  description?: string;
  /** The task definition */
  task: TaskDefinition;
  /** Whether this is a recently used task */
  isRecent?: boolean;
  /** Icon ID for the task */
  iconId?: string;
}
