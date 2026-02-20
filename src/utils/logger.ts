/**
 * Conditional logger that only logs in development mode.
 * Use this instead of console.log for debug output.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  prefix?: string;
  enabled?: boolean;
}

const isDev = (import.meta as unknown as { env: { DEV: boolean } }).env.DEV;

class Logger {
  private prefix: string;
  private enabled: boolean;

  constructor(options: LoggerOptions = {}) {
    this.prefix = options.prefix || '';
    this.enabled = options.enabled ?? isDev;
  }

  private formatMessage(_level: LogLevel, ...args: unknown[]): unknown[] {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    const prefix = this.prefix ? `[${this.prefix}]` : '';
    return [`${timestamp} ${prefix}`, ...args];
  }

  debug(...args: unknown[]): void {
    if (this.enabled && isDev) {
      console.log(...this.formatMessage('debug', ...args));
    }
  }

  info(...args: unknown[]): void {
    if (this.enabled) {
      console.info(...this.formatMessage('info', ...args));
    }
  }

  warn(...args: unknown[]): void {
    if (this.enabled) {
      console.warn(...this.formatMessage('warn', ...args));
    }
  }

  error(...args: unknown[]): void {
    // Errors always log
    console.error(...this.formatMessage('error', ...args));
  }

  /**
   * Create a child logger with a specific prefix
   */
  child(prefix: string): Logger {
    const childPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new Logger({ prefix: childPrefix, enabled: this.enabled });
  }

  /**
   * Temporarily enable/disable logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

// Default logger instance
export const logger = new Logger();

// Pre-configured loggers for different modules
export const cortexLogger = new Logger({ prefix: 'Cortex' });
export const editorLogger = new Logger({ prefix: 'Editor' });
export const terminalLogger = new Logger({ prefix: 'Terminal' });
export const gitLogger = new Logger({ prefix: 'Git' });
export const lspLogger = new Logger({ prefix: 'LSP' });
export const aiLogger = new Logger({ prefix: 'AI' });
export const extensionLogger = new Logger({ prefix: 'Extension' });

// Factory function for custom loggers
export function createLogger(prefix: string, enabled = isDev): Logger {
  return new Logger({ prefix, enabled });
}

export default logger;
