/**
 * Shell Quoting Utilities for Cortex IDE
 * Handles proper escaping of shell arguments across different shells
 */

// Shell quoting options
export interface ShellQuotingOptions {
  escape?: string | { escapeChar: string; charsToEscape: string };
  strong?: string; // e.g., "'" for bash
  weak?: string;   // e.g., '"' for bash
}

// Shell type detection
export type ShellType = 'bash' | 'zsh' | 'fish' | 'powershell' | 'pwsh' | 'cmd' | 'sh' | 'unknown';

// Quoting type
export type QuoteType = 'escape' | 'strong' | 'weak';

// Shell argument
export interface ShellQuotedString {
  value: string;
  quoting: QuoteType;
}

// Default quoting options per shell
export const DEFAULT_SHELL_QUOTING: Record<ShellType, ShellQuotingOptions> = {
  bash: { escape: '\\', strong: "'", weak: '"' },
  zsh: { escape: '\\', strong: "'", weak: '"' },
  fish: { escape: '\\', strong: "'", weak: '"' },
  sh: { escape: '\\', strong: "'", weak: '"' },
  powershell: { escape: '`', strong: "'", weak: '"' },
  pwsh: { escape: '`', strong: "'", weak: '"' },
  cmd: { escape: '^', strong: '"', weak: '"' },
  unknown: { escape: '\\', strong: "'", weak: '"' }
};

// Characters that need escaping per shell
export const CHARS_NEED_ESCAPING: Record<ShellType, string> = {
  bash: ' "\'\\$`!{}[]()&|;<>*?~#',
  zsh: ' "\'\\$`!{}[]()&|;<>*?~#^',
  fish: ' "\'\\${}()&|;<>*?~#',
  sh: ' "\'\\$`!{}[]()&|;<>*?~',
  powershell: ' "\'$`{}()&|;<>@#',
  pwsh: ' "\'$`{}()&|;<>@#',
  cmd: ' &|<>^%',
  unknown: ' "\'\\$`!{}[]()&|;<>*?~#'
};

// Characters that need escaping inside double quotes per shell
const CHARS_ESCAPE_IN_WEAK_QUOTES: Record<ShellType, string> = {
  bash: '$`"\\!',
  zsh: '$`"\\!',
  fish: '$"\\',
  sh: '$`"\\',
  powershell: '$`"',
  pwsh: '$`"',
  cmd: '%',
  unknown: '$`"\\'
};

/**
 * Detect shell type from executable path
 */
export function detectShellType(shellPath: string): ShellType {
  const normalized = shellPath.toLowerCase();
  const name = normalized.split(/[/\\]/).pop() || '';
  
  // Remove extension for Windows
  const baseName = name.replace(/\.(exe|cmd|bat)$/i, '');
  
  if (baseName === 'bash' || baseName.includes('bash')) return 'bash';
  if (baseName === 'zsh' || baseName.includes('zsh')) return 'zsh';
  if (baseName === 'fish' || baseName.includes('fish')) return 'fish';
  if (baseName === 'pwsh' || baseName === 'powershell' || baseName.includes('pwsh')) return 'pwsh';
  if (baseName === 'powershell') return 'powershell';
  if (baseName === 'cmd' || baseName === 'cmd.exe') return 'cmd';
  if (baseName === 'sh') return 'sh';
  
  // Check full path for common patterns
  if (normalized.includes('git\\bin\\bash') || normalized.includes('git/bin/bash')) return 'bash';
  if (normalized.includes('cygwin') && normalized.includes('bash')) return 'bash';
  if (normalized.includes('msys') && normalized.includes('bash')) return 'bash';
  if (normalized.includes('wsl')) return 'bash';
  
  return 'unknown';
}

/**
 * Check if a string needs quoting
 */
export function needsQuoting(value: string, shellType: ShellType): boolean {
  if (value.length === 0) return true;
  
  const charsToEscape = CHARS_NEED_ESCAPING[shellType];
  
  for (const char of value) {
    if (charsToEscape.includes(char)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Quote using escape characters
 */
export function escapeString(
  value: string,
  escapeChar: string,
  charsToEscape: string
): string {
  let result = '';
  
  for (const char of value) {
    if (charsToEscape.includes(char) || char === escapeChar) {
      result += escapeChar + char;
    } else {
      result += char;
    }
  }
  
  return result;
}

/**
 * Quote using strong quotes (no variable expansion)
 */
export function strongQuote(value: string, quoteChar: string): string {
  // For single quotes in bash/zsh/sh, we need special handling
  // because you can't escape a single quote inside single quotes
  if (quoteChar === "'") {
    // Replace ' with '\'' (end quote, escaped quote, start quote)
    const escaped = value.replace(/'/g, "'\\''");
    return `'${escaped}'`;
  }
  
  // For double quotes, escape the quote character
  const escaped = value.replace(new RegExp(quoteChar, 'g'), '\\' + quoteChar);
  return `${quoteChar}${escaped}${quoteChar}`;
}

/**
 * Quote using weak quotes (allows variable expansion)
 */
export function weakQuote(value: string, quoteChar: string, shellType: ShellType): string {
  const charsToEscape = CHARS_ESCAPE_IN_WEAK_QUOTES[shellType];
  const escapeChar = typeof DEFAULT_SHELL_QUOTING[shellType].escape === 'string'
    ? DEFAULT_SHELL_QUOTING[shellType].escape as string
    : '\\';
  
  let result = '';
  
  for (const char of value) {
    if (char === quoteChar || charsToEscape.includes(char)) {
      // Special handling for cmd
      if (shellType === 'cmd') {
        if (char === '%') {
          result += '%%';
        } else if (char === '"') {
          result += '""';
        } else {
          result += char;
        }
      } else {
        result += escapeChar + char;
      }
    } else {
      result += char;
    }
  }
  
  return `${quoteChar}${result}${quoteChar}`;
}

/**
 * Quote a string for use in a shell command
 */
export function quoteString(
  value: string,
  shellType: ShellType,
  quoteType?: QuoteType
): string {
  // Empty string always needs quoting
  if (value.length === 0) {
    const options = DEFAULT_SHELL_QUOTING[shellType];
    return `${options.strong}${options.strong}`;
  }
  
  // If no quoting needed and no specific type requested, return as-is
  if (!quoteType && !needsQuoting(value, shellType)) {
    return value;
  }
  
  const options = DEFAULT_SHELL_QUOTING[shellType];
  const effectiveQuoteType = quoteType || determineOptimalQuoteType(value, shellType);
  
  switch (effectiveQuoteType) {
    case 'escape': {
      const escapeChar = typeof options.escape === 'string'
        ? options.escape
        : options.escape?.escapeChar || '\\';
      const charsToEscape = typeof options.escape === 'object'
        ? options.escape.charsToEscape
        : CHARS_NEED_ESCAPING[shellType];
      return escapeString(value, escapeChar, charsToEscape);
    }
    
    case 'strong':
      return strongQuote(value, options.strong || "'");
    
    case 'weak':
      return weakQuote(value, options.weak || '"', shellType);
    
    default:
      return strongQuote(value, options.strong || "'");
  }
}

/**
 * Determine the optimal quote type for a value
 */
function determineOptimalQuoteType(value: string, shellType: ShellType): QuoteType {
  // For cmd, always use weak quotes (double quotes)
  if (shellType === 'cmd') {
    return 'weak';
  }
  
  // If the value contains single quotes but no special chars needing expansion,
  // use weak quotes
  const hasSingleQuote = value.includes("'");
  const hasDoubleQuote = value.includes('"');
  const hasExpansionChars = /[$`\\]/.test(value);
  
  if (hasSingleQuote && !hasDoubleQuote && !hasExpansionChars) {
    return 'weak';
  }
  
  // Default to strong quotes for safety
  return 'strong';
}

/**
 * Build a shell command from command and arguments
 */
export function buildShellCommand(
  command: string,
  args: (string | ShellQuotedString)[],
  shellType: ShellType,
  _options?: ShellQuotingOptions
): string {
  // Quote the command if needed
  const quotedCommand = needsQuoting(command, shellType)
    ? quoteString(command, shellType)
    : command;
  
  // Quote each argument
  const quotedArgs = args.map(arg => {
    if (typeof arg === 'string') {
      return quoteString(arg, shellType);
    }
    
    // ShellQuotedString with explicit quoting type
    return quoteString(arg.value, shellType, arg.quoting);
  });
  
  // Join command and arguments
  return [quotedCommand, ...quotedArgs].join(' ');
}

/**
 * Parse a shell command into parts (inverse of buildShellCommand)
 */
export function parseShellCommand(command: string, shellType: ShellType): string[] {
  const parts: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escapeNext = false;
  
  const escapeChar = typeof DEFAULT_SHELL_QUOTING[shellType].escape === 'string'
    ? DEFAULT_SHELL_QUOTING[shellType].escape as string
    : '\\';
  
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    
    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }
    
    if (char === escapeChar && !inSingleQuote) {
      if (shellType === 'cmd') {
        // In cmd, ^ only escapes certain characters
        const nextChar = command[i + 1];
        if (nextChar && '&|<>^%'.includes(nextChar)) {
          escapeNext = true;
          continue;
        }
      } else {
        escapeNext = true;
        continue;
      }
    }
    
    if (char === "'" && !inDoubleQuote && shellType !== 'cmd') {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    
    if (char === '"' && !inSingleQuote) {
      if (shellType === 'cmd') {
        // In cmd, "" inside quotes is an escaped quote
        if (inDoubleQuote && command[i + 1] === '"') {
          current += '"';
          i++;
          continue;
        }
      }
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    
    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        parts.push(current);
        current = '';
      }
      continue;
    }
    
    current += char;
  }
  
  if (current.length > 0) {
    parts.push(current);
  }
  
  return parts;
}

/**
 * Get platform-specific default shell
 */
export function getDefaultShell(): { path: string; type: ShellType } {
  // Check if we're in a Node.js environment
  const isWindows = typeof process !== 'undefined' && process.platform === 'win32';
  
  if (isWindows) {
    // Default to PowerShell on Windows
    // In a real implementation, we'd check if these exist
    return {
      path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      type: 'powershell'
    };
  }
  
  // Unix-like systems
  // Check SHELL environment variable
  if (typeof process !== 'undefined' && process.env.SHELL) {
    const shellPath = process.env.SHELL;
    return {
      path: shellPath,
      type: detectShellType(shellPath)
    };
  }
  
  // Default to bash
  return {
    path: '/bin/bash',
    type: 'bash'
  };
}

/**
 * Quote arguments for PowerShell specifically
 * PowerShell has complex quoting rules
 */
export function quotePowerShell(value: string, useStrongQuotes: boolean = true): string {
  if (value.length === 0) {
    return useStrongQuotes ? "''" : '""';
  }
  
  // Check if quoting is needed
  if (!/[ "'$`{}()&|;<>@#]/.test(value)) {
    return value;
  }
  
  if (useStrongQuotes) {
    // Single quotes in PowerShell: double the single quotes to escape
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  } else {
    // Double quotes: escape with backtick
    const escaped = value.replace(/[`"$]/g, '`$&');
    return `"${escaped}"`;
  }
}

/**
 * Quote arguments for CMD specifically
 * CMD has unique quoting requirements
 */
export function quoteCmd(value: string): string {
  if (value.length === 0) {
    return '""';
  }
  
  // Check if quoting is needed
  if (!/[ &|<>^%"]/.test(value)) {
    return value;
  }
  
  // Escape special characters
  let result = value;
  
  // Double up percent signs for environment variables
  result = result.replace(/%/g, '%%');
  
  // Escape carets
  result = result.replace(/\^/g, '^^');
  
  // Handle quotes - double them inside quoted strings
  result = result.replace(/"/g, '""');
  
  return `"${result}"`;
}

/**
 * Escape a string for use in a regular expression
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Join multiple commands with the appropriate separator
 */
export function joinCommands(
  commands: string[],
  shellType: ShellType,
  operator: 'and' | 'or' | 'sequence' = 'and'
): string {
  if (commands.length === 0) return '';
  if (commands.length === 1) return commands[0];
  
  let separator: string;
  
  switch (operator) {
    case 'and':
      separator = shellType === 'cmd' ? ' && ' : ' && ';
      break;
    case 'or':
      separator = shellType === 'cmd' ? ' || ' : ' || ';
      break;
    case 'sequence':
      separator = shellType === 'cmd' ? ' & ' : ' ; ';
      break;
  }
  
  return commands.join(separator);
}

/**
 * Create a command that changes directory and runs a command
 */
export function createCdCommand(
  directory: string,
  command: string,
  shellType: ShellType
): string {
  const quotedDir = quoteString(directory, shellType);
  
  if (shellType === 'cmd') {
    return `cd /d ${quotedDir} && ${command}`;
  }
  
  return `cd ${quotedDir} && ${command}`;
}

/**
 * Quote an environment variable reference
 */
export function quoteEnvVar(varName: string, shellType: ShellType): string {
  switch (shellType) {
    case 'cmd':
      return `%${varName}%`;
    case 'powershell':
    case 'pwsh':
      return `$env:${varName}`;
    case 'fish':
      return `$${varName}`;
    default:
      return `$${varName}`;
  }
}

/**
 * Create an environment variable assignment
 */
export function createEnvAssignment(
  varName: string,
  value: string,
  shellType: ShellType,
  exportVar: boolean = false
): string {
  const quotedValue = quoteString(value, shellType, 'weak');
  
  switch (shellType) {
    case 'cmd':
      return `set ${varName}=${value}`;
    case 'powershell':
    case 'pwsh':
      return `$env:${varName} = ${quotedValue}`;
    case 'fish':
      return exportVar
        ? `set -x ${varName} ${quotedValue}`
        : `set ${varName} ${quotedValue}`;
    default:
      return exportVar
        ? `export ${varName}=${quotedValue}`
        : `${varName}=${quotedValue}`;
  }
}
