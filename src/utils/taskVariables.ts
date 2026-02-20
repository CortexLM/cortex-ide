/**
 * Task Variable Substitution Utilities
 * 
 * VS Code-compatible variable substitution for task commands.
 * Supports all standard VS Code predefined variables.
 * 
 * @see https://code.visualstudio.com/docs/editor/variables-reference
 */

import { MonacoManager } from "./monacoManager";

// ============================================================================
// Types
// ============================================================================

/**
 * Context for variable substitution in task commands.
 * All properties are optional - missing values will be substituted with empty strings.
 */
export interface VariableSubstitutionContext {
  /** Full path of the workspace folder */
  workspaceFolder?: string;
  /** Name of the workspace folder (last segment of path) */
  workspaceFolderBasename?: string;
  /** Full path of the currently opened file */
  file?: string;
  /** Workspace folder of the current file */
  fileWorkspaceFolder?: string;
  /** Path of the current file relative to workspaceFolder */
  relativeFile?: string;
  /** Directory path of the current file relative to workspaceFolder */
  relativeFileDirname?: string;
  /** Filename of the current file with extension */
  fileBasename?: string;
  /** Filename of the current file without extension */
  fileBasenameNoExtension?: string;
  /** Directory path of the current file */
  fileDirname?: string;
  /** File extension of the current file (including dot) */
  fileExtname?: string;
  /** Current line number in the active editor */
  lineNumber?: string;
  /** Currently selected text in the active editor */
  selectedText?: string;
  /** Current working directory */
  cwd?: string;
  /** Environment variables - accessed via ${env:VAR_NAME} */
  env?: Record<string, string>;
  /** Configuration values - accessed via ${config:setting.path} */
  config?: Record<string, unknown>;
}

/**
 * Extended context for async variable substitution with additional features.
 */
export interface TaskVariableContext extends VariableSubstitutionContext {
  /** Name of the workspace folder's directory */
  fileDirnameBasename?: string;
  /** Path to the application executable */
  execPath?: string;
  /** Platform-specific path separator */
  pathSeparator?: string;
}

/**
 * Definition for an input variable in tasks.json.
 * Supports VS Code-compatible input types.
 */
export interface InputVariableDefinition {
  /** Unique identifier for the input */
  id: string;
  /** Type of input prompt */
  type: 'promptString' | 'pickString' | 'command';
  /** Description shown to the user */
  description?: string;
  /** Default value if user cancels or provides no input */
  default?: string;
  /** Options for pickString type */
  options?: Array<string | { label: string; value: string }>;
  /** Whether to mask input (for passwords) */
  password?: boolean;
  /** Command to execute for command type */
  command?: string;
  /** Arguments to pass to the command */
  args?: Record<string, unknown>;
}

/**
 * Item for quick pick selection.
 */
export interface QuickPickItem {
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Optional detail text */
  detail?: string;
  /** The actual value (may differ from label) */
  value?: string;
  /** Whether this item is selected by default */
  picked?: boolean;
}

/**
 * Options for quick pick dialog.
 */
export interface QuickPickOptions {
  /** Title of the quick pick */
  title?: string;
  /** Placeholder text */
  placeHolder?: string;
  /** Whether multiple items can be selected */
  canPickMany?: boolean;
  /** Match on description in addition to label */
  matchOnDescription?: boolean;
  /** Match on detail in addition to label */
  matchOnDetail?: boolean;
  /** Ignore focus out (don't dismiss when focus lost) */
  ignoreFocusOut?: boolean;
}

/**
 * Options for input box dialog.
 */
export interface InputBoxOptions {
  /** Title of the input box */
  title?: string;
  /** Prompt text shown above the input */
  prompt?: string;
  /** Placeholder text in the input */
  placeHolder?: string;
  /** Default value pre-filled in the input */
  value?: string;
  /** Selection range in the default value [start, end] */
  valueSelection?: [number, number];
  /** Whether to mask the input (password mode) */
  password?: boolean;
  /** Ignore focus out (don't dismiss when focus lost) */
  ignoreFocusOut?: boolean;
  /** Validation function that returns error message or null */
  validateInput?: (value: string) => string | null | Promise<string | null>;
}

/**
 * Callbacks required for async variable resolution.
 */
export interface TaskVariableCallbacks {
  /** Show a quick pick selection dialog */
  showQuickPick: (
    items: QuickPickItem[],
    options?: QuickPickOptions
  ) => Promise<QuickPickItem | undefined>;
  /** Show an input box dialog */
  showInputBox: (options?: InputBoxOptions) => Promise<string | undefined>;
  /** Execute a command and return the result */
  executeCommand: (command: string, ...args: unknown[]) => Promise<unknown>;
  /** Get the label of the default build task */
  getDefaultBuildTaskLabel: () => string | undefined;
}

/**
 * Error thrown when input validation fails.
 */
export class InputValidationError extends Error {
  constructor(
    message: string,
    public readonly inputId: string,
    public readonly validationMessage: string
  ) {
    super(message);
    this.name = 'InputValidationError';
  }
}

/**
 * Error thrown when a required input is cancelled.
 */
export class InputCancelledError extends Error {
  constructor(public readonly inputId: string) {
    super(`Input '${inputId}' was cancelled by user`);
    this.name = 'InputCancelledError';
  }
}

/**
 * Result of parsing a variable reference like ${variableName} or ${env:VAR}
 */
interface ParsedVariable {
  /** The full matched string including ${} */
  match: string;
  /** The variable type: 'simple', 'env', 'config', 'input', 'command', 'defaultBuildTask' */
  type: 'simple' | 'env' | 'config' | 'input' | 'command' | 'defaultBuildTask';
  /** The variable name or key */
  name: string;
  /** Default value if provided (e.g., ${VAR:default}) */
  defaultValue?: string;
  /** Additional arguments for command variables */
  args?: Record<string, unknown>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the current active file path from localStorage or editor state.
 */
function getCurrentFilePath(): string {
  // Try to get from localStorage where file state is often stored
  const stored = localStorage.getItem("cortex_active_file");
  if (stored) return stored;
  
  // Try to get from recent files
  const recentFiles = localStorage.getItem("cortex_recent_files");
  if (recentFiles) {
    try {
      const files = JSON.parse(recentFiles);
      if (Array.isArray(files) && files.length > 0) {
        return files[0];
      }
    } catch {
      // Invalid JSON - ignore
    }
  }
  
  return "";
}

/**
 * Get the active Monaco editor instance if available.
 */
function getActiveEditorState(): { lineNumber: number; selectedText: string } | null {
  try {
    const manager = MonacoManager.getInstance();
    const monaco = manager.getMonacoOrNull();
    
    if (monaco) {
      const editors = monaco.editor.getEditors();
      for (const editor of editors) {
        if (editor.hasTextFocus()) {
          const position = editor.getPosition();
          const selection = editor.getSelection();
          const model = editor.getModel();
          
          let selectedText = "";
          if (selection && model && !selection.isEmpty()) {
            selectedText = model.getValueInRange(selection);
          }
          
          return {
            lineNumber: position?.lineNumber || 1,
            selectedText,
          };
        }
      }
      
      // If no focused editor, try to get the first one
      if (editors.length > 0) {
        const editor = editors[0];
        const position = editor.getPosition();
        return {
          lineNumber: position?.lineNumber || 1,
          selectedText: "",
        };
      }
    }
  } catch {
    // MonacoManager might not be initialized yet
  }
  
  return null;
}

/**
 * Normalize a file path to use forward slashes
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

/**
 * Extract path components from a file path
 */
function extractPathComponents(filePath: string): {
  dirname: string;
  basename: string;
  basenameNoExtension: string;
  extname: string;
} {
  const normalized = normalizePath(filePath);
  const lastSlash = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  
  const dirname = lastSlash >= 0 ? normalized.substring(0, lastSlash) : "";
  const basename = lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
  
  const lastDot = basename.lastIndexOf(".");
  const extname = lastDot >= 0 ? basename.substring(lastDot) : "";
  const basenameNoExtension = lastDot >= 0 ? basename.substring(0, lastDot) : basename;
  
  return { dirname, basename, basenameNoExtension, extname };
}

/**
 * Make a path relative to a base path
 */
function makeRelative(basePath: string, targetPath: string): string {
  const normalizedBase = normalizePath(basePath);
  const normalizedTarget = normalizePath(targetPath);
  
  if (normalizedTarget.startsWith(normalizedBase)) {
    return normalizedTarget.substring(normalizedBase.length).replace(/^\//, "");
  }
  
  return targetPath;
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let value: unknown = obj;
  
  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Build a complete variable substitution context from the current project state.
 * 
 * @param projectPath - The current project/workspace path
 * @returns A context object with all available variables
 */
export function buildVariableContext(projectPath: string): VariableSubstitutionContext {
  const currentFile = getCurrentFilePath();
  const editorState = getActiveEditorState();
  
  const normalizedProjectPath = normalizePath(projectPath);
  const normalizedFilePath = normalizePath(currentFile);
  
  const fileComponents = extractPathComponents(normalizedFilePath);
  
  // Calculate relative paths
  const relativeFile = makeRelative(normalizedProjectPath, normalizedFilePath);
  const relativeFileDirname = makeRelative(normalizedProjectPath, fileComponents.dirname);
  
  return {
    workspaceFolder: projectPath,
    workspaceFolderBasename: normalizedProjectPath.split("/").pop() || "",
    file: currentFile,
    fileWorkspaceFolder: projectPath,
    relativeFile,
    relativeFileDirname,
    fileBasename: fileComponents.basename,
    fileBasenameNoExtension: fileComponents.basenameNoExtension,
    fileDirname: fileComponents.dirname,
    fileExtname: fileComponents.extname,
    lineNumber: String(editorState?.lineNumber || 1),
    selectedText: editorState?.selectedText || "",
    cwd: projectPath,
  };
}

/**
 * Parse a variable reference string like ${variableName}, ${env:VAR}, or ${config:key}
 */
function parseVariableReference(match: string, content: string): ParsedVariable {
  // Check for env: prefix
  if (content.startsWith("env:")) {
    const envName = content.slice(4);
    const colonIdx = envName.indexOf(":");
    if (colonIdx >= 0) {
      return {
        match,
        type: "env",
        name: envName.slice(0, colonIdx),
        defaultValue: envName.slice(colonIdx + 1),
      };
    }
    return { match, type: "env", name: envName };
  }
  
  // Check for config: prefix
  if (content.startsWith("config:")) {
    const configPath = content.slice(7);
    return { match, type: "config", name: configPath };
  }
  
  // Check for input: prefix (VS Code input variables)
  if (content.startsWith("input:")) {
    const rest = content.slice(6);
    // Support ${input:inputId:defaultValue} syntax
    const colonIdx = rest.indexOf(":");
    if (colonIdx >= 0) {
      return {
        match,
        type: "input",
        name: rest.slice(0, colonIdx),
        defaultValue: rest.slice(colonIdx + 1),
      };
    }
    return { match, type: "input", name: rest };
  }
  
  // Check for command: prefix (VS Code command variables)
  if (content.startsWith("command:")) {
    const commandId = content.slice(8);
    return { match, type: "command", name: commandId };
  }
  
  // Check for defaultBuildTask
  if (content === "defaultBuildTask") {
    return { match, type: "defaultBuildTask", name: content };
  }
  
  // Simple variable with optional default value
  const colonIdx = content.indexOf(":");
  if (colonIdx >= 0) {
    return {
      match,
      type: "simple",
      name: content.slice(0, colonIdx),
      defaultValue: content.slice(colonIdx + 1),
    };
  }
  
  return { match, type: "simple", name: content };
}

/**
 * Substitute VS Code-style variables in a string.
 * 
 * Supports:
 * - ${variableName} - standard task variables (workspaceFolder, file, etc.)
 * - ${env:VARIABLE_NAME} - environment variables
 * - ${config:setting.name} - configuration values
 * 
 * @param value - The string containing variables to substitute
 * @param context - The variable substitution context
 * @returns The string with variables replaced
 */
export function substituteVariables(
  value: string,
  context: VariableSubstitutionContext
): string {
  // Match ${...} patterns
  return value.replace(/\$\{([^}]+)\}/g, (match, content: string) => {
    const parsed = parseVariableReference(match, content);
    
    switch (parsed.type) {
      case "env": {
        // Environment variables
        // In browser context, try process.env if available
        if (context.env && parsed.name in context.env) {
          return context.env[parsed.name];
        }
        if (typeof process !== "undefined" && process.env && process.env[parsed.name]) {
          return process.env[parsed.name] || parsed.defaultValue || match;
        }
        return parsed.defaultValue || match;
      }
      
      case "config": {
        // Configuration values
        if (context.config) {
          const configValue = getNestedValue(context.config, parsed.name);
          if (configValue !== undefined) {
            if (typeof configValue === "string" || typeof configValue === "number" || typeof configValue === "boolean") {
              return String(configValue);
            }
          }
        }
        // Try localStorage settings
        try {
          const settings = localStorage.getItem("cortex_settings");
          if (settings) {
            const parsed2 = JSON.parse(settings);
            const value2 = getNestedValue(parsed2, parsed.name);
            if (value2 !== undefined && (typeof value2 === "string" || typeof value2 === "number" || typeof value2 === "boolean")) {
              return String(value2);
            }
          }
        } catch {
          // Invalid JSON or other error
        }
        return parsed.defaultValue || match;
      }
      
      case "input":
      case "command": {
        // Input and command variables require user interaction or command execution
        // Return as-is since we can't resolve them synchronously
        return parsed.defaultValue || match;
      }
      
      case "simple": {
        // Standard task variables
        const varName = parsed.name as keyof VariableSubstitutionContext;
        const contextValue = context[varName];
        
        if (contextValue !== undefined && typeof contextValue === "string") {
          return contextValue;
        }
        
        return parsed.defaultValue || match;
      }
      
      default:
        return match;
    }
  });
}

/**
 * Substitute variables in a task command and its arguments.
 * Convenience function that substitutes in both command and args.
 * 
 * @param command - The command string
 * @param args - Optional array of arguments
 * @param context - The variable substitution context
 * @returns Object with substituted command and args
 */
export function substituteTaskCommand(
  command: string,
  args: string[] | undefined,
  context: VariableSubstitutionContext
): { command: string; args: string[] } {
  return {
    command: substituteVariables(command, context),
    args: args?.map(arg => substituteVariables(arg, context)) || [],
  };
}

/**
 * Get all available variable names for documentation/autocomplete.
 */
export function getAvailableVariables(): Array<{ name: string; description: string }> {
  return [
    { name: "workspaceFolder", description: "Full path of the workspace folder" },
    { name: "workspaceFolderBasename", description: "Name of the workspace folder" },
    { name: "file", description: "Full path of the currently opened file" },
    { name: "fileWorkspaceFolder", description: "Workspace folder of the current file" },
    { name: "relativeFile", description: "Current file relative to workspaceFolder" },
    { name: "relativeFileDirname", description: "Current file's directory relative to workspaceFolder" },
    { name: "fileBasename", description: "Filename with extension" },
    { name: "fileBasenameNoExtension", description: "Filename without extension" },
    { name: "fileDirname", description: "Directory path of the current file" },
    { name: "fileDirnameBasename", description: "Name of the current file's directory" },
    { name: "fileExtname", description: "File extension (including dot)" },
    { name: "lineNumber", description: "Current line number in the active editor" },
    { name: "selectedText", description: "Currently selected text in the editor" },
    { name: "cwd", description: "Current working directory" },
    { name: "execPath", description: "Path to the application executable" },
    { name: "pathSeparator", description: "Platform-specific path separator (/ or \\)" },
    { name: "env:VAR_NAME", description: "Environment variable value" },
    { name: "config:setting.path", description: "Configuration value" },
    { name: "input:inputId", description: "Value from user input prompt" },
    { name: "command:commandId", description: "Result of command execution" },
    { name: "defaultBuildTask", description: "Label of the default build task" },
  ];
}

/**
 * Validate a string for unresolved variables.
 * Returns array of unresolved variable references.
 * 
 * @param value - The string to check
 * @returns Array of unresolved variable matches
 */
export function findUnresolvedVariables(value: string): string[] {
  const matches: string[] = [];
  const regex = /\$\{([^}]+)\}/g;
  let match;
  
  while ((match = regex.exec(value)) !== null) {
    matches.push(match[0]);
  }
  
  return matches;
}

// ============================================================================
// Input Variable Resolution
// ============================================================================

/**
 * Resolve an input variable by prompting the user or executing a command.
 * 
 * @param input - The input variable definition
 * @param showQuickPick - Function to show quick pick dialog
 * @param showInputBox - Function to show input box dialog
 * @param executeCommand - Function to execute commands
 * @returns The resolved value or undefined if cancelled
 */
export async function resolveInputVariable(
  input: InputVariableDefinition,
  showQuickPick: (items: QuickPickItem[], options?: QuickPickOptions) => Promise<QuickPickItem | undefined>,
  showInputBox: (options?: InputBoxOptions) => Promise<string | undefined>,
  executeCommand: (command: string, args?: unknown[]) => Promise<unknown>
): Promise<string | undefined> {
  switch (input.type) {
    case 'promptString': {
      const result = await showInputBox({
        prompt: input.description,
        placeHolder: input.description,
        value: input.default,
        password: input.password,
        ignoreFocusOut: true,
      });
      return result;
    }
    
    case 'pickString': {
      if (!input.options || input.options.length === 0) {
        // No options available, return default
        return input.default;
      }
      
      // Convert options to QuickPickItem format
      const items: QuickPickItem[] = input.options.map(opt => {
        if (typeof opt === 'string') {
          return { label: opt, value: opt };
        }
        return { label: opt.label, value: opt.value };
      });
      
      // Mark default as picked if specified
      if (input.default) {
        const defaultItem = items.find(item => item.value === input.default || item.label === input.default);
        if (defaultItem) {
          defaultItem.picked = true;
        }
      }
      
      const result = await showQuickPick(items, {
        placeHolder: input.description,
        ignoreFocusOut: true,
      });
      
      return result?.value ?? result?.label;
    }
    
    case 'command': {
      if (!input.command) {
        console.warn(`Input '${input.id}' is of type 'command' but has no command specified`);
        return input.default;
      }
      
      try {
        const args = input.args ? Object.values(input.args) : [];
        const result = await executeCommand(input.command, args);
        
        if (result === undefined || result === null) {
          return input.default;
        }
        
        if (typeof result === 'string') {
          return result;
        }
        
        // Try to convert to string
        return String(result);
      } catch (error) {
        console.error(`Failed to execute command '${input.command}' for input '${input.id}':`, error);
        return input.default;
      }
    }
    
    default: {
      console.warn(`Unknown input type: ${(input as InputVariableDefinition).type}`);
      return input.default;
    }
  }
}

// ============================================================================
// Command Variable Resolution
// ============================================================================

/**
 * Resolve a command variable by executing the specified command.
 * 
 * @param commandId - The command identifier to execute
 * @param args - Optional arguments to pass to the command
 * @param executeCommand - Function to execute the command
 * @returns The resolved string value or undefined
 */
export async function resolveCommandVariable(
  commandId: string,
  args: Record<string, unknown> | undefined,
  executeCommand: (command: string, ...args: unknown[]) => Promise<unknown>
): Promise<string | undefined> {
  try {
    const commandArgs = args ? Object.values(args) : [];
    const result = await executeCommand(commandId, ...commandArgs);
    
    if (result === undefined || result === null) {
      return undefined;
    }
    
    if (typeof result === 'string') {
      return result;
    }
    
    // Try to convert to string if possible
    if (typeof result === 'number' || typeof result === 'boolean') {
      return String(result);
    }
    
    // For objects/arrays, try JSON serialization
    if (typeof result === 'object') {
      return JSON.stringify(result);
    }
    
    return String(result);
  } catch (error) {
    console.error(`Failed to execute command '${commandId}':`, error);
    return undefined;
  }
}

// ============================================================================
// Nested Variable Resolution
// ============================================================================

/**
 * Check if a string contains nested variable references.
 * Nested variables look like: ${env:${input:envName}}
 */
function hasNestedVariables(value: string): boolean {
  // Look for patterns like ${...${...}...}
  const nestedPattern = /\$\{[^}]*\$\{/;
  return nestedPattern.test(value);
}

/**
 * Extract the innermost variable references that need to be resolved first.
 * Returns variables that don't contain other variables inside them.
 */
function extractInnermostVariables(value: string): Array<{ match: string; start: number; end: number }> {
  const results: Array<{ match: string; start: number; end: number }> = [];
  const regex = /\$\{([^{}]+)\}/g;
  let match;
  
  while ((match = regex.exec(value)) !== null) {
    results.push({
      match: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  
  return results;
}

/**
 * Resolve a single variable reference synchronously (for simple variables).
 * Returns the original match if it cannot be resolved synchronously.
 */
function resolveSimpleVariable(
  parsed: ParsedVariable,
  context: TaskVariableContext,
  getDefaultBuildTaskLabel?: () => string | undefined
): string {
  switch (parsed.type) {
    case "env": {
      if (context.env && parsed.name in context.env) {
        return context.env[parsed.name];
      }
      if (typeof process !== "undefined" && process.env && process.env[parsed.name]) {
        return process.env[parsed.name] || parsed.defaultValue || parsed.match;
      }
      return parsed.defaultValue || parsed.match;
    }
    
    case "config": {
      if (context.config) {
        const configValue = getNestedValue(context.config, parsed.name);
        if (configValue !== undefined) {
          if (typeof configValue === "string" || typeof configValue === "number" || typeof configValue === "boolean") {
            return String(configValue);
          }
        }
      }
      try {
        const settings = localStorage.getItem("cortex_settings");
        if (settings) {
          const parsed2 = JSON.parse(settings);
          const value2 = getNestedValue(parsed2, parsed.name);
          if (value2 !== undefined && (typeof value2 === "string" || typeof value2 === "number" || typeof value2 === "boolean")) {
            return String(value2);
          }
        }
      } catch {
        // Invalid JSON or other error
      }
      return parsed.defaultValue || parsed.match;
    }
    
    case "defaultBuildTask": {
      if (getDefaultBuildTaskLabel) {
        const label = getDefaultBuildTaskLabel();
        if (label) return label;
      }
      return parsed.defaultValue || parsed.match;
    }
    
    case "simple": {
      const varName = parsed.name as keyof TaskVariableContext;
      const contextValue = context[varName];
      
      if (contextValue !== undefined && typeof contextValue === "string") {
        return contextValue;
      }
      
      return parsed.defaultValue || parsed.match;
    }
    
    default:
      return parsed.match;
  }
}

// ============================================================================
// Async Variable Substitution
// ============================================================================

/**
 * Asynchronously substitute task variables in a string.
 * Supports input prompts, command execution, and nested variables.
 * 
 * @param value - The string containing variables to substitute
 * @param context - The variable substitution context
 * @param inputs - Map of input variable definitions by ID
 * @param callbacks - Functions for user interaction and command execution
 * @returns The string with all variables resolved
 */
export async function substituteTaskVariablesAsync(
  value: string,
  context: TaskVariableContext,
  inputs: Record<string, InputVariableDefinition>,
  callbacks: TaskVariableCallbacks
): Promise<string> {
  // Cache for resolved input values (avoid prompting multiple times for same input)
  const resolvedInputs: Record<string, string> = {};
  // Cache for resolved command values
  const resolvedCommands: Record<string, string> = {};
  
  /**
   * Resolve a single variable, handling all types including async ones.
   */
  async function resolveVariable(parsed: ParsedVariable): Promise<string> {
    switch (parsed.type) {
      case "input": {
        // Check cache first
        if (parsed.name in resolvedInputs) {
          return resolvedInputs[parsed.name];
        }
        
        // Get input definition
        const inputDef = inputs[parsed.name];
        if (!inputDef) {
          console.warn(`No input definition found for '${parsed.name}'`);
          return parsed.defaultValue || parsed.match;
        }
        
        // Resolve the input
        const result = await resolveInputVariable(
          inputDef,
          callbacks.showQuickPick,
          callbacks.showInputBox,
          async (cmd, args) => callbacks.executeCommand(cmd, ...(args ?? []))
        );
        
        if (result === undefined) {
          // User cancelled - use default or throw
          if (parsed.defaultValue !== undefined) {
            resolvedInputs[parsed.name] = parsed.defaultValue;
            return parsed.defaultValue;
          }
          if (inputDef.default !== undefined) {
            resolvedInputs[parsed.name] = inputDef.default;
            return inputDef.default;
          }
          throw new InputCancelledError(parsed.name);
        }
        
        resolvedInputs[parsed.name] = result;
        return result;
      }
      
      case "command": {
        // Check cache first
        if (parsed.name in resolvedCommands) {
          return resolvedCommands[parsed.name];
        }
        
        const result = await resolveCommandVariable(
          parsed.name,
          parsed.args,
          callbacks.executeCommand
        );
        
        if (result === undefined) {
          return parsed.defaultValue || parsed.match;
        }
        
        resolvedCommands[parsed.name] = result;
        return result;
      }
      
      case "defaultBuildTask": {
        const label = callbacks.getDefaultBuildTaskLabel();
        return label || parsed.defaultValue || parsed.match;
      }
      
      default: {
        // Use synchronous resolution for simple variables
        return resolveSimpleVariable(parsed, context, callbacks.getDefaultBuildTaskLabel);
      }
    }
  }
  
  // Handle nested variables by resolving from inside out
  let result = value;
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops
  
  while (iterations < maxIterations) {
    // Check if there are any variables left
    const variables = extractInnermostVariables(result);
    if (variables.length === 0) {
      break;
    }
    
    // Check if any variables changed in this iteration
    let hasChanges = false;
    
    // Process variables from right to left to maintain correct indices
    for (let i = variables.length - 1; i >= 0; i--) {
      const { match, start, end } = variables[i];
      const content = match.slice(2, -1); // Remove ${ and }
      const parsed = parseVariableReference(match, content);
      
      const resolved = await resolveVariable(parsed);
      
      if (resolved !== match) {
        result = result.slice(0, start) + resolved + result.slice(end);
        hasChanges = true;
      }
    }
    
    // If nothing changed, we're done (remaining variables are unresolvable)
    if (!hasChanges) {
      break;
    }
    
    iterations++;
  }
  
  if (iterations >= maxIterations) {
    console.warn('Maximum iterations reached during variable substitution. Possible circular reference.');
  }
  
  return result;
}

/**
 * Substitute variables in a task command and arguments asynchronously.
 * 
 * @param command - The command string
 * @param args - Optional array of arguments
 * @param context - The variable substitution context
 * @param inputs - Map of input variable definitions
 * @param callbacks - Functions for user interaction and command execution
 * @returns Object with substituted command and args
 */
export async function substituteTaskCommandAsync(
  command: string,
  args: string[] | undefined,
  context: TaskVariableContext,
  inputs: Record<string, InputVariableDefinition>,
  callbacks: TaskVariableCallbacks
): Promise<{ command: string; args: string[] }> {
  const substitutedCommand = await substituteTaskVariablesAsync(command, context, inputs, callbacks);
  
  const substitutedArgs: string[] = [];
  if (args) {
    for (const arg of args) {
      substitutedArgs.push(await substituteTaskVariablesAsync(arg, context, inputs, callbacks));
    }
  }
  
  return {
    command: substitutedCommand,
    args: substitutedArgs,
  };
}

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validate an input value against the input definition.
 * 
 * @param value - The value to validate
 * @param input - The input definition
 * @returns Error message if invalid, null if valid
 */
export function validateInputValue(
  value: string,
  input: InputVariableDefinition
): string | null {
  // For pickString, validate that value is one of the options
  if (input.type === 'pickString' && input.options) {
    const validValues = input.options.map(opt => 
      typeof opt === 'string' ? opt : opt.value
    );
    
    if (!validValues.includes(value)) {
      return `Value '${value}' is not a valid option. Valid options: ${validValues.join(', ')}`;
    }
  }
  
  // For promptString with password, check minimum length
  if (input.type === 'promptString' && input.password && value.length < 1) {
    return 'Password cannot be empty';
  }
  
  return null;
}

/**
 * Parse and validate input definitions from tasks.json format.
 * 
 * @param rawInputs - Array of raw input definitions
 * @returns Map of validated input definitions by ID
 */
export function parseInputDefinitions(
  rawInputs: Array<Record<string, unknown>>
): Record<string, InputVariableDefinition> {
  const result: Record<string, InputVariableDefinition> = {};
  
  for (const raw of rawInputs) {
    const id = raw.id;
    const type = raw.type;
    
    if (typeof id !== 'string' || !id) {
      console.warn('Input definition missing required "id" field:', raw);
      continue;
    }
    
    if (type !== 'promptString' && type !== 'pickString' && type !== 'command') {
      console.warn(`Invalid input type '${type}' for input '${id}'`);
      continue;
    }
    
    const input: InputVariableDefinition = {
      id,
      type,
    };
    
    if (typeof raw.description === 'string') {
      input.description = raw.description;
    }
    
    if (typeof raw.default === 'string') {
      input.default = raw.default;
    }
    
    if (typeof raw.password === 'boolean') {
      input.password = raw.password;
    }
    
    if (typeof raw.command === 'string') {
      input.command = raw.command;
    }
    
    if (raw.args && typeof raw.args === 'object') {
      input.args = raw.args as Record<string, unknown>;
    }
    
    if (Array.isArray(raw.options)) {
      input.options = raw.options.filter((opt): opt is string | { label: string; value: string } => {
        if (typeof opt === 'string') return true;
        if (opt && typeof opt === 'object' && typeof (opt as { label: unknown }).label === 'string') {
          return true;
        }
        return false;
      });
    }
    
    result[id] = input;
  }
  
  return result;
}

/**
 * Build an extended TaskVariableContext from the basic context.
 */
export function buildTaskVariableContext(
  context: VariableSubstitutionContext
): TaskVariableContext {
  const extendedContext: TaskVariableContext = { ...context };
  
  // Add fileDirnameBasename
  if (context.fileDirname) {
    const parts = normalizePath(context.fileDirname).split('/');
    extendedContext.fileDirnameBasename = parts[parts.length - 1] || '';
  }
  
  // Add execPath (application path - use a sensible default)
  extendedContext.execPath = typeof process !== 'undefined' ? process.execPath || '' : '';
  
  // Add pathSeparator (platform-specific)
  extendedContext.pathSeparator = typeof process !== 'undefined' && process.platform === 'win32' ? '\\' : '/';
  
  return extendedContext;
}

// ============================================================================
// Exports
// ============================================================================

export {
  getCurrentFilePath,
  getActiveEditorState,
  normalizePath,
  extractPathComponents,
  makeRelative,
  getNestedValue,
  // Async resolution helpers
  hasNestedVariables,
  extractInnermostVariables,
  resolveSimpleVariable,
};
