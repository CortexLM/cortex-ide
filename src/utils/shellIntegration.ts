/**
 * Shell Integration for Cortex IDE
 * Detects commands, prompts, and output in terminal
 */

// OSC (Operating System Command) sequences for shell integration
export const OSC = {
  PROMPT_START: '\x1b]633;A\x07',      // Mark prompt start
  PROMPT_END: '\x1b]633;B\x07',        // Mark prompt end
  COMMAND_START: '\x1b]633;C\x07',     // Mark command start
  COMMAND_EXECUTED: '\x1b]633;D\x07',  // Command executed (before output)
  COMMAND_FINISHED: '\x1b]633;D;',     // + exitCode + '\x07' Command finished
  COMMAND_LINE: '\x1b]633;E;',         // + commandLine + '\x07'
  CWD: '\x1b]633;P;Cwd=',              // + path + '\x07'
  ISWINDOWS: '\x1b]633;P;IsWindows=',  // + 1|0 + '\x07'
};

// Parsed command from terminal
export interface ParsedCommand {
  command: string;
  startOffset: number;
  endOffset: number;
  outputStartOffset?: number;
  outputEndOffset?: number;
  exitCode?: number;
  cwd?: string;
  timestamp: number;
  duration?: number;
}

// Shell integration state
export interface ShellIntegrationState {
  enabled: boolean;
  currentPromptStart?: number;
  currentCommandStart?: number;
  currentCwd?: string;
  commands: ParsedCommand[];
  isWindows: boolean;
}

/**
 * Detect if running on Windows platform
 */
function detectIsWindows(): boolean {
  // Check navigator.platform (deprecated but widely supported)
  if (typeof navigator !== 'undefined' && navigator.platform) {
    return navigator.platform.toLowerCase().includes('win');
  }
  // Check navigator.userAgent as fallback
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    return navigator.userAgent.toLowerCase().includes('windows');
  }
  // Default to false if we can't detect
  return false;
}

/**
 * Create initial shell integration state
 */
export function createShellIntegrationState(): ShellIntegrationState {
  return {
    enabled: false,
    currentPromptStart: undefined,
    currentCommandStart: undefined,
    currentCwd: undefined,
    commands: [],
    isWindows: detectIsWindows(),
  };
}

/**
 * Parse OSC sequences from terminal output
 */
export function parseOSCSequence(
  data: string,
  offset: number
): { sequence: string; type: keyof typeof OSC | 'unknown'; value?: string; length: number } | null {
  // Check if we're at the start of an OSC sequence
  if (data[offset] !== '\x1b' || data[offset + 1] !== ']') {
    return null;
  }

  // Find the end of the OSC sequence (BEL \x07 or ST \x1b\\)
  let endIndex = -1;
  let terminatorLength = 1;
  
  for (let i = offset + 2; i < data.length; i++) {
    if (data[i] === '\x07') {
      endIndex = i;
      break;
    }
    if (data[i] === '\x1b' && data[i + 1] === '\\') {
      endIndex = i;
      terminatorLength = 2;
      break;
    }
  }

  if (endIndex === -1) {
    return null; // Incomplete sequence
  }

  const sequence = data.substring(offset, endIndex + terminatorLength);
  const content = data.substring(offset + 2, endIndex); // Content between \x1b] and terminator

  // Check if it's a 633 sequence (shell integration)
  if (!content.startsWith('633;')) {
    return { sequence, type: 'unknown', length: sequence.length };
  }

  const payload = content.substring(4); // After "633;"

  // Determine the type based on the payload
  if (payload === 'A') {
    return { sequence, type: 'PROMPT_START', length: sequence.length };
  }
  if (payload === 'B') {
    return { sequence, type: 'PROMPT_END', length: sequence.length };
  }
  if (payload === 'C') {
    return { sequence, type: 'COMMAND_START', length: sequence.length };
  }
  if (payload === 'D') {
    return { sequence, type: 'COMMAND_EXECUTED', length: sequence.length };
  }
  if (payload.startsWith('D;')) {
    const exitCode = payload.substring(2);
    return { sequence, type: 'COMMAND_FINISHED', value: exitCode, length: sequence.length };
  }
  if (payload.startsWith('E;')) {
    const commandLine = payload.substring(2);
    return { sequence, type: 'COMMAND_LINE', value: decodeOSCValue(commandLine), length: sequence.length };
  }
  if (payload.startsWith('P;Cwd=')) {
    const cwd = payload.substring(6);
    return { sequence, type: 'CWD', value: decodeOSCValue(cwd), length: sequence.length };
  }
  if (payload.startsWith('P;IsWindows=')) {
    const isWindows = payload.substring(12);
    return { sequence, type: 'ISWINDOWS', value: isWindows, length: sequence.length };
  }

  return { sequence, type: 'unknown', length: sequence.length };
}

/**
 * Decode OSC-encoded value (handles URL encoding)
 */
function decodeOSCValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Process terminal data and update state
 */
export function processTerminalData(
  data: string,
  state: ShellIntegrationState,
  currentOffset: number
): ShellIntegrationState {
  const newState: ShellIntegrationState = {
    ...state,
    commands: [...state.commands],
  };

  let i = 0;
  let pendingCommand: Partial<ParsedCommand> | null = null;

  // Find any in-progress command
  const lastCommand = newState.commands[newState.commands.length - 1];
  if (lastCommand && lastCommand.exitCode === undefined) {
    pendingCommand = lastCommand;
  }

  while (i < data.length) {
    const parsed = parseOSCSequence(data, i);

    if (parsed) {
      // Enable shell integration when we see any valid sequence
      if (parsed.type !== 'unknown') {
        newState.enabled = true;
      }

      switch (parsed.type) {
        case 'PROMPT_START':
          newState.currentPromptStart = currentOffset + i;
          // If there's a pending command, mark its output end
          if (pendingCommand && pendingCommand.outputStartOffset !== undefined) {
            pendingCommand.outputEndOffset = currentOffset + i;
          }
          break;

        case 'PROMPT_END':
          // Prompt ended, command input starts here
          break;

        case 'COMMAND_START':
          newState.currentCommandStart = currentOffset + i;
          break;

        case 'COMMAND_LINE':
          if (parsed.value) {
            // Create new command entry
            const newCommand: ParsedCommand = {
              command: parsed.value,
              startOffset: newState.currentCommandStart ?? currentOffset + i,
              endOffset: currentOffset + i + parsed.length,
              cwd: newState.currentCwd,
              timestamp: Date.now(),
            };
            newState.commands.push(newCommand);
            pendingCommand = newCommand;
          }
          break;

        case 'COMMAND_EXECUTED':
          // Command has been executed, output follows
          if (pendingCommand) {
            pendingCommand.outputStartOffset = currentOffset + i + parsed.length;
          }
          break;

        case 'COMMAND_FINISHED':
          if (pendingCommand) {
            const exitCode = parsed.value ? parseInt(parsed.value, 10) : 0;
            pendingCommand.exitCode = isNaN(exitCode) ? 0 : exitCode;
            pendingCommand.outputEndOffset = currentOffset + i;
            pendingCommand.duration = Date.now() - (pendingCommand.timestamp ?? 0);
            pendingCommand = null;
          }
          break;

        case 'CWD':
          if (parsed.value) {
            newState.currentCwd = parsed.value;
            // Update pending command's cwd if it doesn't have one
            if (pendingCommand && !pendingCommand.cwd) {
              pendingCommand.cwd = parsed.value;
            }
          }
          break;

        case 'ISWINDOWS':
          newState.isWindows = parsed.value === '1';
          break;
      }

      i += parsed.length;
    } else {
      i++;
    }
  }

  return newState;
}

// Bash integration script
const BASH_INTEGRATION = `
# Cortex IDE Shell Integration for Bash
__cortex_prompt_start() { printf '\\e]633;A\\a'; }
__cortex_prompt_end() { printf '\\e]633;B\\a'; }
__cortex_command_start() { printf '\\e]633;C\\a'; }
__cortex_command_executed() { printf '\\e]633;D\\a'; }
__cortex_command_finished() { printf '\\e]633;D;%s\\a' "$?"; }
__cortex_cwd() { printf '\\e]633;P;Cwd=%s\\a' "$PWD"; }
__cortex_commandline() { printf '\\e]633;E;%s\\a' "$1"; }

__cortex_preexec() {
  __cortex_command_start
  __cortex_commandline "$1"
}

__cortex_precmd() {
  local exit_code=$?
  __cortex_command_finished
  __cortex_prompt_start
  __cortex_cwd
}

if [[ -z "$__cortex_initialized" ]]; then
  __cortex_initialized=1
  PROMPT_COMMAND='__cortex_precmd'
  PS1='\\[\\e]633;B\\a\\]\\u@\\h:\\w\\$ '
  
  # Use DEBUG trap for preexec
  trap '__cortex_preexec "$BASH_COMMAND"' DEBUG
fi
`;

// Zsh integration script
const ZSH_INTEGRATION = `
# Cortex IDE Shell Integration for Zsh
__cortex_prompt_start() { printf '\\e]633;A\\a'; }
__cortex_prompt_end() { printf '\\e]633;B\\a'; }
__cortex_command_start() { printf '\\e]633;C\\a'; }
__cortex_command_executed() { printf '\\e]633;D\\a'; }
__cortex_command_finished() { printf '\\e]633;D;%s\\a' "$?"; }
__cortex_cwd() { printf '\\e]633;P;Cwd=%s\\a' "$PWD"; }
__cortex_commandline() { printf '\\e]633;E;%s\\a' "$1"; }

__cortex_preexec() {
  __cortex_command_start
  __cortex_commandline "$1"
  __cortex_command_executed
}

__cortex_precmd() {
  local exit_code=$?
  __cortex_command_finished
  __cortex_prompt_start
  __cortex_cwd
}

if [[ -z "$__cortex_initialized" ]]; then
  __cortex_initialized=1
  autoload -Uz add-zsh-hook
  add-zsh-hook precmd __cortex_precmd
  add-zsh-hook preexec __cortex_preexec
  PROMPT='%{\\e]633;B\\a%}%n@%m:%~%# '
fi
`;

// Fish integration script
const FISH_INTEGRATION = `
# Cortex IDE Shell Integration for Fish
function __cortex_prompt_start
    printf '\\e]633;A\\a'
end

function __cortex_prompt_end
    printf '\\e]633;B\\a'
end

function __cortex_command_start
    printf '\\e]633;C\\a'
end

function __cortex_command_executed
    printf '\\e]633;D\\a'
end

function __cortex_command_finished
    printf '\\e]633;D;%s\\a' $argv[1]
end

function __cortex_cwd
    printf '\\e]633;P;Cwd=%s\\a' $PWD
end

function __cortex_commandline
    printf '\\e]633;E;%s\\a' (string escape -- $argv[1])
end

function __cortex_fish_prompt --on-event fish_prompt
    set -l exit_code $status
    __cortex_command_finished $exit_code
    __cortex_prompt_start
    __cortex_cwd
end

function __cortex_fish_preexec --on-event fish_preexec
    __cortex_command_start
    __cortex_commandline $argv[1]
    __cortex_command_executed
end

# Initialize
__cortex_prompt_end
`;

// PowerShell integration script
const PWSH_INTEGRATION = `
# Cortex IDE Shell Integration for PowerShell
$Global:__CortexLastExitCode = 0

function __cortex_prompt_start { Write-Host -NoNewline "\`e]633;A\`a" }
function __cortex_prompt_end { Write-Host -NoNewline "\`e]633;B\`a" }
function __cortex_command_start { Write-Host -NoNewline "\`e]633;C\`a" }
function __cortex_command_executed { Write-Host -NoNewline "\`e]633;D\`a" }
function __cortex_command_finished { param($code) Write-Host -NoNewline "\`e]633;D;$code\`a" }
function __cortex_cwd { Write-Host -NoNewline "\`e]633;P;Cwd=$PWD\`a" }
function __cortex_commandline { param($cmd) Write-Host -NoNewline "\`e]633;E;$cmd\`a" }
function __cortex_iswindows { Write-Host -NoNewline "\`e]633;P;IsWindows=1\`a" }

if (-not $Global:__CortexInitialized) {
    $Global:__CortexInitialized = $true
    __cortex_iswindows
    
    # Store original prompt
    $Global:__CortexOriginalPrompt = $function:prompt
    
    function global:prompt {
        $exitCode = if ($?) { 0 } else { if ($LASTEXITCODE) { $LASTEXITCODE } else { 1 } }
        __cortex_command_finished $exitCode
        __cortex_prompt_start
        __cortex_cwd
        __cortex_prompt_end
        
        # Call original prompt or default
        if ($Global:__CortexOriginalPrompt) {
            & $Global:__CortexOriginalPrompt
        } else {
            "PS $PWD> "
        }
    }
    
    # Hook into command execution
    Set-PSReadLineKeyHandler -Key Enter -ScriptBlock {
        $line = $null
        $cursor = $null
        [Microsoft.PowerShell.PSConsoleReadLine]::GetBufferState([ref]$line, [ref]$cursor)
        __cortex_command_start
        __cortex_commandline $line
        __cortex_command_executed
        [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine()
    }
}
`;

/**
 * Generate shell integration scripts for different shells
 */
export function getShellIntegrationScript(shell: 'bash' | 'zsh' | 'fish' | 'pwsh'): string {
  switch (shell) {
    case 'bash':
      return BASH_INTEGRATION;
    case 'zsh':
      return ZSH_INTEGRATION;
    case 'fish':
      return FISH_INTEGRATION;
    case 'pwsh':
      return PWSH_INTEGRATION;
    default:
      return '';
  }
}

/**
 * Default prompt patterns for detection
 */
export const DEFAULT_PROMPT_PATTERNS: RegExp[] = [
  /^[\w-]+@[\w-]+[:\s].*[$#]\s*$/,   // user@host:path$
  /^[$#>]\s*$/,                        // Simple $ or #
  /^PS[^>]*>\s*/,                      // PowerShell PS>
  /^>>>\s*$/,                          // Python REPL
  /^>\s*$/,                            // Generic >
  /^\([^)]+\)\s*[$#>]\s*$/,           // (venv) $
  /^[\w-]+\s*[$#>]\s*$/,              // simple-prompt$
  /^.*\$\s*$/,                         // Anything ending with $
  /^.*#\s*$/,                          // Anything ending with # (root)
  /^C:\\[^>]*>/,                       // Windows cmd.exe
];

/**
 * Detect command boundaries without shell integration (fallback)
 */
export function detectCommandBoundaries(
  lines: string[],
  promptPatterns: RegExp[] = DEFAULT_PROMPT_PATTERNS
): ParsedCommand[] {
  const commands: ParsedCommand[] = [];
  let currentCommand: Partial<ParsedCommand> | null = null;
  let currentOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length + 1; // +1 for newline
    const isPrompt = promptPatterns.some(pattern => pattern.test(line));

    if (isPrompt) {
      // If we have a pending command, finalize it
      if (currentCommand && currentCommand.command) {
        currentCommand.outputEndOffset = currentOffset;
        commands.push(currentCommand as ParsedCommand);
      }

      // Extract command from prompt line (everything after the prompt)
      const commandMatch = line.match(/[$#>]\s*(.+)$/);
      if (commandMatch && commandMatch[1]) {
        currentCommand = {
          command: commandMatch[1].trim(),
          startOffset: currentOffset,
          endOffset: currentOffset + lineLength,
          outputStartOffset: currentOffset + lineLength,
          timestamp: Date.now(),
        };
      } else {
        currentCommand = null;
      }
    }

    currentOffset += lineLength;
  }

  // Finalize last command
  if (currentCommand && currentCommand.command) {
    currentCommand.outputEndOffset = currentOffset;
    commands.push(currentCommand as ParsedCommand);
  }

  return commands;
}

/**
 * Command decoration interface
 */
export interface CommandDecoration {
  type: 'success' | 'error' | 'running' | 'unknown';
  icon: string;
  color: string;
  tooltip: string;
}

/**
 * Get command decoration (success/failure indicator)
 */
export function getCommandDecoration(command: ParsedCommand): CommandDecoration {
  if (command.exitCode === undefined) {
    return {
      type: 'running',
      icon: '\u25CF', // Filled circle (bullet)
      color: '#569cd6', // Blue
      tooltip: 'Command is running...',
    };
  }

  if (command.exitCode === 0) {
    return {
      type: 'success',
      icon: '\u2713', // Check mark
      color: '#4ec9b0', // Green
      tooltip: `Command succeeded (exit code: ${command.exitCode})${command.duration ? ` in ${formatDuration(command.duration)}` : ''}`,
    };
  }

  return {
    type: 'error',
    icon: '\u2717', // X mark
    color: '#f14c4c', // Red
    tooltip: `Command failed (exit code: ${command.exitCode})${command.duration ? ` in ${formatDuration(command.duration)}` : ''}`,
  };
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Get recent commands for "run recent command" feature
 */
export function getRecentCommands(
  state: ShellIntegrationState,
  limit: number = 10
): ParsedCommand[] {
  // Return most recent commands first
  return state.commands
    .slice()
    .reverse()
    .slice(0, limit);
}

/**
 * Clean ANSI and OSC sequences from output
 */
export function cleanTerminalOutput(output: string): string {
  // Remove ANSI escape sequences (colors, cursor movements, etc.)
  // eslint-disable-next-line no-control-regex
  const ansiPattern = /\x1b\[[0-9;]*[a-zA-Z]/g;
  
  // Remove OSC sequences
  const oscPattern = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
  
  // Remove other control sequences
  // eslint-disable-next-line no-control-regex
  const controlPattern = /\x1b[PX^_][^\x1b]*\x1b\\/g;
  
  return output
    .replace(oscPattern, '')
    .replace(ansiPattern, '')
    .replace(controlPattern, '')
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .replace(/\r/g, '');      // Remove carriage returns
}

/**
 * Strip OSC sequences only (keep ANSI colors)
 */
export function stripOSCSequences(output: string): string {
  // Remove only OSC sequences, keep ANSI colors intact
  const oscPattern = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
  
  return output.replace(oscPattern, '');
}

/**
 * Extract command output from terminal buffer
 */
export function extractCommandOutput(
  buffer: string,
  command: ParsedCommand
): string | null {
  if (command.outputStartOffset === undefined || command.outputEndOffset === undefined) {
    return null;
  }

  const output = buffer.substring(command.outputStartOffset, command.outputEndOffset);
  return cleanTerminalOutput(output);
}

/**
 * Check if shell integration is supported for a given shell
 */
export function isShellIntegrationSupported(shell: string): boolean {
  const supportedShells = ['bash', 'zsh', 'fish', 'pwsh', 'powershell'];
  const shellName = shell.toLowerCase().split('/').pop()?.replace('.exe', '') ?? '';
  return supportedShells.includes(shellName);
}

/**
 * Detect shell type from shell path for shell integration
 */
export function detectShellTypeForIntegration(shellPath: string): 'bash' | 'zsh' | 'fish' | 'pwsh' | null {
  const shellName = shellPath.toLowerCase().split(/[/\\]/).pop()?.replace('.exe', '') ?? '';
  
  if (shellName === 'bash' || shellName === 'sh') {
    return 'bash';
  }
  if (shellName === 'zsh') {
    return 'zsh';
  }
  if (shellName === 'fish') {
    return 'fish';
  }
  if (shellName === 'pwsh' || shellName === 'powershell') {
    return 'pwsh';
  }
  
  return null;
}

/**
 * Create shell integration environment variables
 */
export function getShellIntegrationEnv(): Record<string, string> {
  return {
    cortex_SHELL_INTEGRATION: '1',
    TERM_PROGRAM: 'cortex-ide',
    TERM_PROGRAM_VERSION: '1.0.0',
  };
}

/**
 * Parse command line into command and arguments
 */
export function parseCommandLine(commandLine: string): { command: string; args: string[] } {
  const parts: string[] = [];
  let current = '';
  let inQuote: string | null = null;
  let escaped = false;

  for (const char of commandLine) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"' || char === "'") {
      if (inQuote === char) {
        inQuote = null;
      } else if (!inQuote) {
        inQuote = char;
      } else {
        current += char;
      }
      continue;
    }

    if (char === ' ' && !inQuote) {
      if (current) {
        parts.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    parts.push(current);
  }

  return {
    command: parts[0] ?? '',
    args: parts.slice(1),
  };
}

/**
 * Check if a command is potentially dangerous
 */
export function isDangerousCommand(commandLine: string): boolean {
  const dangerous = [
    /\brm\s+-rf?\s+[/~]/i,           // rm -rf /
    /\bdd\s+.*of=\/dev\//i,          // dd to device
    /\bmkfs\b/i,                      // Format filesystem
    /\b:[(]{2}\s*[)]{2}/,            // Fork bomb
    />\s*\/dev\/sd[a-z]/i,           // Write to disk device
    /\bchmod\s+-R\s+777\s+\//i,      // chmod 777 /
    /\bchown\s+-R\s+.*\s+\//i,       // chown -R /
  ];

  return dangerous.some(pattern => pattern.test(commandLine));
}

/**
 * Command history manager
 */
export class CommandHistory {
  private commands: ParsedCommand[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  add(command: ParsedCommand): void {
    this.commands.push(command);
    
    // Trim history if needed
    if (this.commands.length > this.maxSize) {
      this.commands = this.commands.slice(-this.maxSize);
    }
  }

  getAll(): ParsedCommand[] {
    return [...this.commands];
  }

  getRecent(limit: number = 10): ParsedCommand[] {
    return this.commands.slice(-limit).reverse();
  }

  search(query: string): ParsedCommand[] {
    const lowerQuery = query.toLowerCase();
    return this.commands.filter(cmd => 
      cmd.command.toLowerCase().includes(lowerQuery)
    ).reverse();
  }

  clear(): void {
    this.commands = [];
  }

  get length(): number {
    return this.commands.length;
  }
}
