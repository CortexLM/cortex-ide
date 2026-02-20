/**
 * =============================================================================
 * USE COMMAND DETECTION - Detects commands from terminal output
 * =============================================================================
 *
 * Detects commands and their results from terminal output using shell
 * integration sequences (OSC 633) with fallback heuristics.
 *
 * OSC 633 Sequences:
 * - OSC 633 ; A ST - Prompt start
 * - OSC 633 ; B ST - Prompt end (command start)
 * - OSC 633 ; C ST - Command executed
 * - OSC 633 ; D ; <exit-code> ST - Command finished
 * - OSC 633 ; E ; <command> ST - Command line
 * - OSC 633 ; P ; <property>=<value> ST - Property (e.g., Cwd)
 *
 * Fallback heuristics when OSC 633 not available:
 * - Detect common prompts ($ , > , # , etc.)
 * - Match command patterns
 * - Detect exit code from $? echo
 *
 * Usage:
 *   const detection = useCommandDetection({
 *     terminalId: "term-1",
 *     onCommandStart: (command, line) => {...},
 *     onCommandEnd: (exitCode, line) => {...},
 *   });
 *
 *   // Feed terminal data
 *   detection.processData(data);
 *
 * =============================================================================
 */

import {
  createSignal,
  Accessor,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { CommandDecoration } from "@/components/terminal/TerminalDecorations";

// =============================================================================
// TYPES
// =============================================================================

/**
 * OSC 633 sequence types
 */
export type OSC633SequenceType =
  | "prompt-start"      // A
  | "prompt-end"        // B
  | "command-executed"  // C
  | "command-finished"  // D
  | "command-line"      // E
  | "property"          // P
  | "continuation-start"
  | "continuation-end";

/**
 * Parsed OSC 633 event
 */
export interface OSC633Event {
  type: OSC633SequenceType;
  /** Command line text (for command-line type) */
  commandLine?: string;
  /** Exit code (for command-finished type) */
  exitCode?: number;
  /** Property name and value (for property type) */
  property?: { name: string; value: string };
}

/**
 * Command state during detection
 */
export interface DetectedCommand {
  /** Unique ID for this command */
  id: string;
  /** Line number where command started */
  line: number;
  /** The command text */
  command: string;
  /** Whether the command is currently running */
  isRunning: boolean;
  /** Exit code when completed */
  exitCode?: number;
  /** Timestamp when command started */
  startTime: number;
  /** Timestamp when command ended */
  endTime?: number;
  /** Current working directory */
  cwd?: string;
  /** Accumulated output */
  output: string;
}

/**
 * Options for command detection hook
 */
export interface UseCommandDetectionOptions {
  /** Terminal ID for this detector */
  terminalId: string;
  /** Callback when a command starts */
  onCommandStart?: (command: string, line: number, cwd?: string) => void;
  /** Callback when a command ends */
  onCommandEnd?: (exitCode: number, line: number, command?: string) => void;
  /** Callback when command line is detected */
  onCommandLine?: (command: string, line: number) => void;
  /** Callback when CWD changes */
  onCwdChange?: (cwd: string) => void;
  /** Enable fallback heuristics when OSC 633 not available */
  enableFallback?: boolean;
  /** Custom prompt patterns for fallback detection */
  promptPatterns?: RegExp[];
}

/**
 * Return type for command detection hook
 */
export interface UseCommandDetectionReturn {
  /** Process incoming terminal data */
  processData: (data: string, currentLine: number) => void;
  /** Register OSC 633 parser with xterm */
  registerOscHandler: (parser: OSC633ParserLike) => () => void;
  /** Current running command (if any) */
  currentCommand: Accessor<DetectedCommand | null>;
  /** All detected commands */
  commands: Accessor<DetectedCommand[]>;
  /** Whether shell integration is detected */
  hasShellIntegration: Accessor<boolean>;
  /** Current working directory */
  cwd: Accessor<string | undefined>;
  /** Clear command history */
  clear: () => void;
  /** Reset shell integration detection */
  reset: () => void;
}

/**
 * Interface for OSC parser registration (compatible with xterm)
 */
export interface OSC633ParserLike {
  registerOscHandler: (
    identifier: number,
    callback: (data: string) => boolean | Promise<boolean>
  ) => { dispose: () => void };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const OSC_633_ID = 633;

// Common shell prompt patterns for fallback detection
const DEFAULT_PROMPT_PATTERNS: RegExp[] = [
  // Bash/Zsh style: user@host:path$
  /^[\w\-\.]+@[\w\-\.]+:.*[$#>]\s*$/,
  // Simple prompts: $ , > , #
  /^[$#>]\s*$/,
  // Windows CMD: C:\path>
  /^[A-Za-z]:\\.*>\s*$/,
  // PowerShell: PS C:\path>
  /^PS\s+[A-Za-z]:\\.*>\s*$/,
  // Fish style: user@host path>
  /^[\w\-\.]+@[\w\-\.]+\s+.*>\s*$/,
  // Numbered prompts: [1] $
  /^\[\d+\]\s*[$#>]\s*$/,
  // Virtual env: (venv) $
  /^\([\w\-\.]+\)\s*[$#>]\s*$/,
];

// Exit code patterns for fallback detection
const EXIT_CODE_PATTERNS: RegExp[] = [
  // echo $?
  /^(\d+)$/,
  // PowerShell $LASTEXITCODE
  /^(\d+)$/,
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Parse an OSC 633 sequence
 */
function parseOSC633(data: string): OSC633Event | null {
  if (!data || data.length === 0) {
    return null;
  }

  const parts = data.split(";");
  const type = parts[0];

  switch (type) {
    case "A":
      return { type: "prompt-start" };
    
    case "B":
      return { type: "prompt-end" };
    
    case "C":
      return { type: "command-executed" };
    
    case "D": {
      const exitCode = parts.length > 1 ? parseInt(parts[1], 10) : undefined;
      return {
        type: "command-finished",
        exitCode: isNaN(exitCode as number) ? undefined : exitCode,
      };
    }
    
    case "E": {
      const commandLine = parts.slice(1).join(";");
      return {
        type: "command-line",
        commandLine: commandLine || undefined,
      };
    }
    
    case "P": {
      if (parts.length > 1) {
        const propParts = parts[1].split("=");
        if (propParts.length >= 2) {
          return {
            type: "property",
            property: {
              name: propParts[0],
              value: propParts.slice(1).join("="),
            },
          };
        }
      }
      return { type: "property" };
    }
    
    default:
      return null;
  }
}

/**
 * Generate unique ID for commands
 */
let commandIdCounter = 0;
function generateCommandId(): string {
  return `cmd-${Date.now()}-${commandIdCounter++}`;
}

/**
 * Check if line matches a prompt pattern
 */
function matchesPrompt(line: string, patterns: RegExp[]): boolean {
  const trimmed = line.trim();
  return patterns.some(pattern => pattern.test(trimmed));
}

/**
 * Extract command from line after prompt
 */
function extractCommandFromLine(line: string): string | null {
  // Try to extract command after common prompt endings
  const promptEndings = ["$ ", "> ", "# ", "% "];
  
  for (const ending of promptEndings) {
    const index = line.lastIndexOf(ending);
    if (index !== -1) {
      const command = line.slice(index + ending.length).trim();
      if (command.length > 0) {
        return command;
      }
    }
  }
  
  return null;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Hook for detecting commands in terminal output
 */
export function useCommandDetection(
  options: UseCommandDetectionOptions
): UseCommandDetectionReturn {
  const {
    // terminalId is available for future use (e.g., logging)
    onCommandStart,
    onCommandEnd,
    onCommandLine,
    onCwdChange,
    enableFallback = true,
    promptPatterns = DEFAULT_PROMPT_PATTERNS,
  } = options;

  // State
  const [commands, setCommands] = createStore<DetectedCommand[]>([]);
  const [currentCommand, setCurrentCommand] = createSignal<DetectedCommand | null>(null);
  const [hasShellIntegration, setHasShellIntegration] = createSignal(false);
  const [cwd, setCwd] = createSignal<string | undefined>(undefined);
  
  // Internal state for fallback detection
  const [lastPromptLine, setLastPromptLine] = createSignal<number | null>(null);
  const [pendingCommand, setPendingCommand] = createSignal<string | null>(null);
  
  // Buffer for accumulating output
  let outputBuffer = "";
  
  /**
   * Handle OSC 633 events
   */
  const handleOSC633Event = (event: OSC633Event, currentLine: number) => {
    // Mark that we have shell integration
    if (!hasShellIntegration()) {
      setHasShellIntegration(true);
    }

    switch (event.type) {
      case "prompt-start":
        // New prompt starting - if we have a running command, it ended
        const running = currentCommand();
        if (running && running.isRunning) {
          // Command ended without explicit D sequence
          // Use exit code 0 as default
          endCurrentCommand(0, currentLine);
        }
        break;

      case "prompt-end":
        // Prompt ended, command input starting
        // Reset pending command
        setPendingCommand(null);
        break;

      case "command-executed": {
        // Command is being executed
        const pending = pendingCommand();
        if (pending) {
          startNewCommand(pending, currentLine);
        }
        break;
      }

      case "command-finished": {
        // Command finished with exit code
        const exitCode = event.exitCode ?? 0;
        endCurrentCommand(exitCode, currentLine);
        break;
      }

      case "command-line": {
        // Command line text received
        const commandLine = event.commandLine;
        if (commandLine) {
          setPendingCommand(commandLine);
          onCommandLine?.(commandLine, currentLine);
        }
        break;
      }

      case "property": {
        // Property update (e.g., CWD)
        if (event.property) {
          if (event.property.name === "Cwd") {
            setCwd(event.property.value);
            onCwdChange?.(event.property.value);
          }
        }
        break;
      }
    }
  };

  /**
   * Start tracking a new command
   */
  const startNewCommand = (command: string, line: number) => {
    const id = generateCommandId();
    const newCommand: DetectedCommand = {
      id,
      line,
      command,
      isRunning: true,
      startTime: Date.now(),
      cwd: cwd(),
      output: "",
    };

    setCurrentCommand(newCommand);
    setCommands(produce((cmds) => {
      cmds.push(newCommand);
      // Keep last 100 commands
      while (cmds.length > 100) {
        cmds.shift();
      }
    }));

    onCommandStart?.(command, line, cwd());
  };

  /**
   * End the current running command
   */
  const endCurrentCommand = (exitCode: number, line: number) => {
    const running = currentCommand();
    if (!running) return;

    const endTime = Date.now();

    setCommands(produce((cmds) => {
      const index = cmds.findIndex((c) => c.id === running.id);
      if (index !== -1) {
        cmds[index].isRunning = false;
        cmds[index].exitCode = exitCode;
        cmds[index].endTime = endTime;
        cmds[index].output = outputBuffer;
      }
    }));

    onCommandEnd?.(exitCode, line, running.command);
    setCurrentCommand(null);
    outputBuffer = "";
  };

  /**
   * Process terminal data for fallback detection
   */
  const processFallbackData = (data: string, currentLine: number) => {
    if (!enableFallback || hasShellIntegration()) {
      return;
    }

    const lines = data.split(/\r?\n/);
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check for prompt patterns
      if (matchesPrompt(trimmed, promptPatterns)) {
        // Found a prompt - if we have a running command, it might have ended
        const running = currentCommand();
        if (running && running.isRunning) {
          // Try to detect exit code from output
          // For now, assume success if prompt appears
          endCurrentCommand(0, currentLine);
        }
        
        setLastPromptLine(currentLine);
        continue;
      }

      // Check if this looks like a command after a prompt
      const promptLine = lastPromptLine();
      if (promptLine !== null && currentLine === promptLine) {
        const command = extractCommandFromLine(line);
        if (command) {
          startNewCommand(command, currentLine);
          setLastPromptLine(null);
          continue;
        }
      }

      // Check for exit code patterns
      const running = currentCommand();
      if (running && running.isRunning) {
        for (const pattern of EXIT_CODE_PATTERNS) {
          const match = trimmed.match(pattern);
          if (match && match[1]) {
            const exitCode = parseInt(match[1], 10);
            if (!isNaN(exitCode) && exitCode >= 0 && exitCode <= 255) {
              // Don't immediately end - wait for next prompt
              // This helps avoid false positives
            }
          }
        }
      }
    }
  };

  /**
   * Process incoming terminal data
   */
  const processData = (data: string, currentLine: number) => {
    // Accumulate output for current command
    const running = currentCommand();
    if (running && running.isRunning) {
      outputBuffer += data;
      
      // Limit output buffer size
      if (outputBuffer.length > 50000) {
        outputBuffer = outputBuffer.slice(-50000);
      }
    }

    // Try fallback detection if enabled
    processFallbackData(data, currentLine);
  };

  /**
   * Register OSC 633 handler with xterm parser
   */
  const registerOscHandler = (parser: OSC633ParserLike): (() => void) => {
    let currentLine = 0;

    const disposable = parser.registerOscHandler(OSC_633_ID, (data: string) => {
      const event = parseOSC633(data);
      if (event) {
        handleOSC633Event(event, currentLine);
      }
      return true;
    });

    return () => {
      disposable.dispose();
    };
  };

  /**
   * Clear command history
   */
  const clear = () => {
    setCommands([]);
    setCurrentCommand(null);
    outputBuffer = "";
    setLastPromptLine(null);
    setPendingCommand(null);
  };

  /**
   * Reset shell integration detection
   */
  const reset = () => {
    setHasShellIntegration(false);
    clear();
  };

  return {
    processData,
    registerOscHandler,
    currentCommand,
    commands: () => commands,
    hasShellIntegration,
    cwd,
    clear,
    reset,
  };
}

// =============================================================================
// HELPER HOOK FOR INTEGRATING WITH TERMINAL DECORATIONS
// =============================================================================

/**
 * Options for command decoration integration
 */
export interface UseCommandDecorationIntegrationOptions {
  /** Terminal ID */
  terminalId: string;
  /** Whether decorations are enabled */
  enabled?: boolean;
  /** Maximum number of decorations */
  maxDecorations?: number;
}

/**
 * Return type for decoration integration
 */
export interface UseCommandDecorationIntegrationReturn {
  /** Command detection instance */
  detection: UseCommandDetectionReturn;
  /** Current decorations for TerminalDecorations component */
  decorations: Accessor<CommandDecoration[]>;
  /** Handle decoration action */
  handleDecorationAction: (
    decoration: CommandDecoration,
    action: "rerun" | "copy-command" | "copy-output" | "show-output"
  ) => Promise<void>;
}

/**
 * Hook that integrates command detection with terminal decorations
 */
export function useCommandDecorationIntegration(
  options: UseCommandDecorationIntegrationOptions
): UseCommandDecorationIntegrationReturn {
  const detection = useCommandDetection({
    terminalId: options.terminalId,
  });

  // Convert detected commands to decoration format
  const decorations = (): CommandDecoration[] => {
    if (!options.enabled) return [];
    
    return detection.commands().map((cmd): CommandDecoration => ({
      id: cmd.id,
      line: cmd.line,
      command: cmd.command,
      exitCode: cmd.exitCode ?? null,
      startTime: new Date(cmd.startTime),
      endTime: cmd.endTime ? new Date(cmd.endTime) : null,
      duration: cmd.endTime ? cmd.endTime - cmd.startTime : null,
      output: cmd.output,
      cwd: cmd.cwd,
    }));
  };

  // Handle decoration actions
  const handleDecorationAction = async (
    decoration: CommandDecoration,
    action: "rerun" | "copy-command" | "copy-output" | "show-output"
  ) => {
    switch (action) {
      case "copy-command":
        await navigator.clipboard.writeText(decoration.command);
        break;
      
      case "copy-output":
        if (decoration.output) {
          await navigator.clipboard.writeText(decoration.output);
        }
        break;
      
      case "rerun":
        // Dispatch event for terminal to handle
        window.dispatchEvent(
          new CustomEvent("terminal:rerun-command", {
            detail: {
              terminalId: options.terminalId,
              command: decoration.command,
            },
          })
        );
        break;
      
      case "show-output":
        // Dispatch event to show output in panel/modal
        window.dispatchEvent(
          new CustomEvent("terminal:show-output", {
            detail: {
              terminalId: options.terminalId,
              command: decoration.command,
              output: decoration.output,
            },
          })
        );
        break;
    }
  };

  return {
    detection,
    decorations,
    handleDecorationAction,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default useCommandDetection;
