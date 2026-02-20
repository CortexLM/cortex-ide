/**
 * @fileoverview CLI Executor Module
 * 
 * Provides the core functionality for executing Cortex CLI commands
 * from TypeScript/JavaScript environments. Handles process spawning,
 * output parsing, error handling, and streaming.
 * 
 * @module @cortex/sdk/executor
 * @author Cortex Team
 * @license Apache-2.0
 */

import type {
  CliResult,
  EventMsg,
} from "./types";
import { CliExitCode } from "./types";

// ============================================================================
// Constants
// ============================================================================

/** Default timeout for CLI commands in milliseconds. */
const DEFAULT_TIMEOUT_MS = 600_000; // 10 minutes

/** Default buffer size for stdout/stderr. */
const DEFAULT_BUFFER_SIZE = 1024 * 1024; // 1MB

/** CLI binary name. */
const CLI_BINARY = "cortex";

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Execution environment types.
 */
export type ExecutionEnvironment = "node" | "tauri" | "browser" | "unknown";

/**
 * Detect the current execution environment.
 * @returns The detected execution environment.
 */
export function detectEnvironment(): ExecutionEnvironment {
  // Check for Tauri
  if (
    typeof window !== "undefined" &&
    (window as unknown as { __TAURI__?: unknown }).__TAURI__
  ) {
    return "tauri";
  }

  // Check for Node.js
  if (
    typeof process !== "undefined" &&
    process.versions &&
    process.versions.node
  ) {
    return "node";
  }

  // Check for browser
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return "browser";
  }

  return "unknown";
}

// ============================================================================
// Process Interfaces
// ============================================================================

/**
 * Abstract interface for process execution.
 * Allows different implementations for Node.js, Tauri, etc.
 */
export interface ProcessRunner {
  /**
   * Execute a command and return the result.
   */
  exec(
    command: string,
    args: string[],
    options: ProcessOptions
  ): Promise<ProcessResult>;

  /**
   * Spawn a command with streaming output.
   */
  spawn(
    command: string,
    args: string[],
    options: ProcessOptions
  ): ProcessHandle;
}

/**
 * Options for process execution.
 */
export interface ProcessOptions {
  /** Working directory. */
  cwd?: string;
  /** Environment variables. */
  env?: Record<string, string>;
  /** Timeout in milliseconds. */
  timeout?: number;
  /** Input to write to stdin. */
  stdin?: string;
  /** Maximum buffer size for output. */
  maxBuffer?: number;
  /** Shell to use (if any). */
  shell?: boolean | string;
}

/**
 * Result of a process execution.
 */
export interface ProcessResult {
  /** Exit code. */
  exitCode: number;
  /** Standard output. */
  stdout: string;
  /** Standard error. */
  stderr: string;
  /** Whether the process was killed due to timeout. */
  timedOut?: boolean;
  /** Duration in milliseconds. */
  durationMs?: number;
}

/**
 * Handle to a spawned process.
 */
export interface ProcessHandle {
  /** Process ID (if available). */
  pid?: number;
  /** Promise that resolves when the process exits. */
  wait(): Promise<ProcessResult>;
  /** Write to stdin. */
  write(data: string): void;
  /** Close stdin. */
  closeStdin(): void;
  /** Kill the process. */
  kill(signal?: string): void;
  /** Event emitter for stdout data. */
  onStdout(callback: (data: string) => void): void;
  /** Event emitter for stderr data. */
  onStderr(callback: (data: string) => void): void;
  /** Event emitter for exit. */
  onExit(callback: (code: number) => void): void;
  /** Event emitter for errors. */
  onError(callback: (error: Error) => void): void;
}

// ============================================================================
// Node.js Process Runner Implementation
// ============================================================================

/**
 * Node.js implementation of ProcessRunner using child_process.
 */
export class NodeProcessRunner implements ProcessRunner {
  private childProcess: typeof import("child_process") | null = null;

  /**
   * Lazily load the child_process module.
   */
  private async getChildProcess(): Promise<typeof import("child_process")> {
    if (!this.childProcess) {
      this.childProcess = await import("child_process");
    }
    return this.childProcess;
  }

  async exec(
    command: string,
    args: string[],
    options: ProcessOptions
  ): Promise<ProcessResult> {
    const cp = await this.getChildProcess();
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const process = cp.spawn(command, args, {
        cwd: options.cwd,
        env: { ...globalThis.process?.env, ...options.env },
        shell: options.shell,
        timeout: options.timeout,
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const maxBuffer = options.maxBuffer ?? DEFAULT_BUFFER_SIZE;

      // Handle timeout
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          timedOut = true;
          process.kill("SIGTERM");
        }, options.timeout);
      }

      // Write stdin if provided
      if (options.stdin) {
        process.stdin?.write(options.stdin);
        process.stdin?.end();
      }

      // Collect stdout
      process.stdout?.on("data", (data: Buffer) => {
        const chunk = data.toString();
        if (stdout.length + chunk.length <= maxBuffer) {
          stdout += chunk;
        }
      });

      // Collect stderr
      process.stderr?.on("data", (data: Buffer) => {
        const chunk = data.toString();
        if (stderr.length + chunk.length <= maxBuffer) {
          stderr += chunk;
        }
      });

      // Handle exit
      process.on("close", (code: number | null) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr,
          timedOut,
          durationMs: Date.now() - startTime,
        });
      });

      // Handle errors
      process.on("error", (error: Error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  spawn(
    command: string,
    args: string[],
    options: ProcessOptions
  ): ProcessHandle {
    // This will be implemented synchronously since spawn is non-blocking
    // We need to handle the async module loading differently
    const handle = new NodeProcessHandle(command, args, options);
    handle.start();
    return handle;
  }
}

/**
 * Node.js process handle implementation.
 */
class NodeProcessHandle implements ProcessHandle {
  pid?: number;
  private process: import("child_process").ChildProcess | null = null;
  private stdoutCallbacks: ((data: string) => void)[] = [];
  private stderrCallbacks: ((data: string) => void)[] = [];
  private exitCallbacks: ((code: number) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];
  private exitPromise: Promise<ProcessResult> | null = null;
  private stdout = "";
  private stderr = "";
  private exitCode = -1;
  private startTime = Date.now();

  constructor(
    private command: string,
    private args: string[],
    private options: ProcessOptions
  ) {}

  async start(): Promise<void> {
    try {
      const cp = await import("child_process");
      this.process = cp.spawn(this.command, this.args, {
        cwd: this.options.cwd,
        env: { ...globalThis.process?.env, ...this.options.env },
        shell: this.options.shell,
      });

      this.pid = this.process.pid;

      this.process.stdout?.on("data", (data: Buffer) => {
        const chunk = data.toString();
        this.stdout += chunk;
        this.stdoutCallbacks.forEach((cb) => cb(chunk));
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        const chunk = data.toString();
        this.stderr += chunk;
        this.stderrCallbacks.forEach((cb) => cb(chunk));
      });

      this.process.on("close", (code: number | null) => {
        this.exitCode = code ?? 1;
        this.exitCallbacks.forEach((cb) => cb(this.exitCode));
      });

      this.process.on("error", (error: Error) => {
        this.errorCallbacks.forEach((cb) => cb(error));
      });
    } catch (error) {
      this.errorCallbacks.forEach((cb) => cb(error as Error));
    }
  }

  wait(): Promise<ProcessResult> {
    if (!this.exitPromise) {
      this.exitPromise = new Promise((resolve) => {
        const checkExit = () => {
          if (this.exitCode >= 0) {
            resolve({
              exitCode: this.exitCode,
              stdout: this.stdout,
              stderr: this.stderr,
              durationMs: Date.now() - this.startTime,
            });
          } else {
            this.exitCallbacks.push(() => {
              resolve({
                exitCode: this.exitCode,
                stdout: this.stdout,
                stderr: this.stderr,
                durationMs: Date.now() - this.startTime,
              });
            });
          }
        };
        checkExit();
      });
    }
    return this.exitPromise;
  }

  write(data: string): void {
    this.process?.stdin?.write(data);
  }

  closeStdin(): void {
    this.process?.stdin?.end();
  }

  kill(signal = "SIGTERM"): void {
    this.process?.kill(signal as NodeJS.Signals);
  }

  onStdout(callback: (data: string) => void): void {
    this.stdoutCallbacks.push(callback);
  }

  onStderr(callback: (data: string) => void): void {
    this.stderrCallbacks.push(callback);
  }

  onExit(callback: (code: number) => void): void {
    this.exitCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }
}

// ============================================================================
// Tauri Process Runner Implementation
// ============================================================================

/**
 * Tauri implementation of ProcessRunner using @tauri-apps/plugin-shell.
 */
export class TauriProcessRunner implements ProcessRunner {
  async exec(
    command: string,
    args: string[],
    options: ProcessOptions
  ): Promise<ProcessResult> {
    const { Command } = await import("@tauri-apps/plugin-shell");
    const startTime = Date.now();

    try {
      const cmd = Command.create(command, args, {
        cwd: options.cwd,
        env: options.env,
      });

      const output = await cmd.execute();

      return {
        exitCode: output.code ?? 1,
        stdout: output.stdout,
        stderr: output.stderr,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  spawn(
    command: string,
    args: string[],
    options: ProcessOptions
  ): ProcessHandle {
    return new TauriProcessHandle(command, args, options);
  }
}

/**
 * Tauri process handle implementation.
 */
class TauriProcessHandle implements ProcessHandle {
  pid?: number;
  private child: Awaited<
    ReturnType<
      Awaited<typeof import("@tauri-apps/plugin-shell")>["Command"]["create"]
    >
  > | null = null;
  private childProcess: Awaited<
    ReturnType<
      Awaited<
        ReturnType<
          Awaited<typeof import("@tauri-apps/plugin-shell")>["Command"]["create"]
        >["spawn"]
      >
    >
  > | null = null;
  private stdoutCallbacks: ((data: string) => void)[] = [];
  private stderrCallbacks: ((data: string) => void)[] = [];
  private exitCallbacks: ((code: number) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];
  private stdout = "";
  private stderr = "";
  private exitCode = -1;
  private startTime = Date.now();

  constructor(
    private command: string,
    private args: string[],
    private options: ProcessOptions
  ) {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const { Command } = await import("@tauri-apps/plugin-shell");

      this.child = Command.create(this.command, this.args, {
        cwd: this.options.cwd,
        env: this.options.env,
      });

      this.child.on("close", (data) => {
        this.exitCode = data.code ?? 1;
        this.exitCallbacks.forEach((cb) => cb(this.exitCode));
      });

      this.child.on("error", (error) => {
        this.errorCallbacks.forEach((cb) => cb(new Error(error)));
      });

      this.child.stdout.on("data", (data) => {
        const chunk = typeof data === "string" ? data : new TextDecoder().decode(data);
        this.stdout += chunk;
        this.stdoutCallbacks.forEach((cb) => cb(chunk));
      });

      this.child.stderr.on("data", (data) => {
        const chunk = typeof data === "string" ? data : new TextDecoder().decode(data);
        this.stderr += chunk;
        this.stderrCallbacks.forEach((cb) => cb(chunk));
      });

      this.childProcess = await this.child.spawn();
      this.pid = this.childProcess.pid;
    } catch (error) {
      this.errorCallbacks.forEach((cb) => cb(error as Error));
    }
  }

  wait(): Promise<ProcessResult> {
    return new Promise((resolve) => {
      const checkExit = () => {
        if (this.exitCode >= 0) {
          resolve({
            exitCode: this.exitCode,
            stdout: this.stdout,
            stderr: this.stderr,
            durationMs: Date.now() - this.startTime,
          });
        } else {
          this.exitCallbacks.push(() => {
            resolve({
              exitCode: this.exitCode,
              stdout: this.stdout,
              stderr: this.stderr,
              durationMs: Date.now() - this.startTime,
            });
          });
        }
      };
      checkExit();
    });
  }

  write(data: string): void {
    this.childProcess?.write(data);
  }

  closeStdin(): void {
    // Tauri doesn't have a direct closeStdin method
    // The process will receive EOF when the handle is dropped
  }

  kill(): void {
    this.childProcess?.kill();
  }

  onStdout(callback: (data: string) => void): void {
    this.stdoutCallbacks.push(callback);
  }

  onStderr(callback: (data: string) => void): void {
    this.stderrCallbacks.push(callback);
  }

  onExit(callback: (code: number) => void): void {
    this.exitCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }
}

// ============================================================================
// CLI Executor
// ============================================================================

/**
 * Main CLI executor class.
 * Provides methods for executing Cortex CLI commands.
 */
export class CliExecutor {
  private runner: ProcessRunner;
  private cliBinary: string;
  private defaultCwd?: string;
  private defaultEnv: Record<string, string>;

  /**
   * Create a new CLI executor.
   * @param options - Executor options.
   */
  constructor(options: CliExecutorOptions = {}) {
    this.cliBinary = options.cliBinary ?? CLI_BINARY;
    this.defaultCwd = options.cwd;
    this.defaultEnv = options.env ?? {};

    // Auto-detect runner based on environment
    if (options.runner) {
      this.runner = options.runner;
    } else {
      const env = detectEnvironment();
      switch (env) {
        case "tauri":
          this.runner = new TauriProcessRunner();
          break;
        case "node":
          this.runner = new NodeProcessRunner();
          break;
        default:
          throw new Error(
            `Unsupported execution environment: ${env}. ` +
              "Please provide a custom ProcessRunner."
          );
      }
    }
  }

  /**
   * Execute a CLI command and return the result.
   * @param args - Command arguments.
   * @param options - Execution options.
   * @returns The command result.
   */
  async exec(
    args: string[],
    options: ExecutionOptions = {}
  ): Promise<CliResult<string>> {
    const startTime = Date.now();

    try {
      const result = await this.runner.exec(this.cliBinary, args, {
        cwd: options.cwd ?? this.defaultCwd,
        env: { ...this.defaultEnv, ...options.env },
        timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
        stdin: options.stdin,
        maxBuffer: options.maxBuffer,
      });

      return {
        success: result.exitCode === 0,
        data: result.stdout,
        error: result.exitCode !== 0 ? result.stderr || undefined : undefined,
        exitCode: result.exitCode,
        stderr: result.stderr || undefined,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        exitCode: CliExitCode.Error as number,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a CLI command with JSON output and parse the result.
   * @param args - Command arguments.
   * @param options - Execution options.
   * @returns The parsed JSON result.
   */
  async execJson<T>(
    args: string[],
    options: ExecutionOptions = {}
  ): Promise<CliResult<T>> {
    const result = await this.exec([...args, "--json"], options);

    if (!result.success || !result.data) {
      return {
        ...result,
        data: undefined,
      };
    }

    try {
      const parsed = JSON.parse(result.data) as T;
      return {
        ...result,
        data: parsed,
      };
    } catch (parseError) {
      return {
        success: false,
        error: `Failed to parse JSON output: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`,
        exitCode: result.exitCode,
        stderr: result.stderr,
        durationMs: result.durationMs,
      };
    }
  }

  /**
   * Execute a CLI command with streaming output.
   * @param args - Command arguments.
   * @param options - Streaming options.
   * @returns A handle to control the execution.
   */
  stream(
    args: string[],
    options: StreamExecutionOptions = {}
  ): StreamHandle {
    const handle = this.runner.spawn(this.cliBinary, args, {
      cwd: options.cwd ?? this.defaultCwd,
      env: { ...this.defaultEnv, ...options.env },
      timeout: options.timeout,
    });

    return new StreamHandle(handle, options);
  }

  /**
   * Execute with stream-json output format, parsing events as they arrive.
   * @param args - Base command arguments.
   * @param options - Streaming options.
   * @returns A stream handle with event parsing.
   */
  streamJson(
    args: string[],
    options: StreamExecutionOptions = {}
  ): JsonStreamHandle {
    const fullArgs = [...args, "--output-format", "stream-json"];
    const handle = this.runner.spawn(this.cliBinary, fullArgs, {
      cwd: options.cwd ?? this.defaultCwd,
      env: { ...this.defaultEnv, ...options.env },
      timeout: options.timeout,
    });

    return new JsonStreamHandle(handle, options);
  }

  /**
   * Get the CLI version.
   * @returns The CLI version string.
   */
  async getVersion(): Promise<string> {
    const result = await this.exec(["--version"]);
    if (result.success && result.data) {
      return result.data.trim();
    }
    throw new Error(result.error ?? "Failed to get CLI version");
  }

  /**
   * Check if the CLI is available.
   * @returns True if the CLI is available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.getVersion();
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Executor Options
// ============================================================================

/**
 * Options for creating a CLI executor.
 */
export interface CliExecutorOptions {
  /** Custom process runner. */
  runner?: ProcessRunner;
  /** CLI binary name/path. */
  cliBinary?: string;
  /** Default working directory. */
  cwd?: string;
  /** Default environment variables. */
  env?: Record<string, string>;
}

/**
 * Options for command execution.
 */
export interface ExecutionOptions {
  /** Working directory. */
  cwd?: string;
  /** Environment variables. */
  env?: Record<string, string>;
  /** Timeout in milliseconds. */
  timeout?: number;
  /** Input to write to stdin. */
  stdin?: string;
  /** Maximum buffer size. */
  maxBuffer?: number;
}

/**
 * Options for streaming execution.
 */
export interface StreamExecutionOptions extends ExecutionOptions {
  /** Callback for stdout data. */
  onStdout?: (data: string) => void;
  /** Callback for stderr data. */
  onStderr?: (data: string) => void;
  /** Callback for exit. */
  onExit?: (code: number) => void;
  /** Callback for errors. */
  onError?: (error: Error) => void;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

// ============================================================================
// Stream Handles
// ============================================================================

/**
 * Handle for controlling a streaming command execution.
 */
export class StreamHandle {
  private aborted = false;

  constructor(
    protected handle: ProcessHandle,
    protected options: StreamExecutionOptions
  ) {
    // Set up callbacks
    if (options.onStdout) {
      handle.onStdout(options.onStdout);
    }
    if (options.onStderr) {
      handle.onStderr(options.onStderr);
    }
    if (options.onExit) {
      handle.onExit(options.onExit);
    }
    if (options.onError) {
      handle.onError(options.onError);
    }

    // Handle abort signal
    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        this.abort();
      });
    }
  }

  /**
   * Get the process ID.
   */
  get pid(): number | undefined {
    return this.handle.pid;
  }

  /**
   * Wait for the process to complete.
   * @returns The process result.
   */
  wait(): Promise<ProcessResult> {
    return this.handle.wait();
  }

  /**
   * Write data to stdin.
   * @param data - Data to write.
   */
  write(data: string): void {
    if (!this.aborted) {
      this.handle.write(data);
    }
  }

  /**
   * Close stdin.
   */
  closeStdin(): void {
    this.handle.closeStdin();
  }

  /**
   * Abort the execution.
   */
  abort(): void {
    if (!this.aborted) {
      this.aborted = true;
      this.handle.kill();
    }
  }

  /**
   * Check if the execution was aborted.
   */
  isAborted(): boolean {
    return this.aborted;
  }
}

/**
 * Handle for streaming JSON output with event parsing.
 */
export class JsonStreamHandle extends StreamHandle {
  private buffer = "";
  private eventCallbacks: ((event: EventMsg) => void)[] = [];

  constructor(handle: ProcessHandle, options: StreamExecutionOptions) {
    super(handle, options);

    // Override stdout handler to parse JSON lines
    handle.onStdout((data) => {
      this.buffer += data;
      this.processBuffer();
    });
  }

  /**
   * Register a callback for parsed events.
   * @param callback - Event callback.
   */
  onEvent(callback: (event: EventMsg) => void): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Process the buffer and emit parsed events.
   */
  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const event = JSON.parse(line) as EventMsg;
        this.eventCallbacks.forEach((cb) => cb(event));
      } catch (error) {
        // Not valid JSON, might be a partial line or non-JSON output
        if (this.options.onStderr) {
          this.options.onStderr(
            `Warning: Failed to parse JSON line: ${line}\n`
          );
        }
      }
    }
  }

  /**
   * Flush any remaining buffer content.
   */
  flush(): void {
    if (this.buffer.trim()) {
      try {
        const event = JSON.parse(this.buffer) as EventMsg;
        this.eventCallbacks.forEach((cb) => cb(event));
      } catch {
        // Ignore incomplete JSON at end
      }
      this.buffer = "";
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultExecutor: CliExecutor | null = null;

/**
 * Get the default CLI executor instance.
 * @returns The default executor.
 */
export function getDefaultExecutor(): CliExecutor {
  if (!defaultExecutor) {
    defaultExecutor = new CliExecutor();
  }
  return defaultExecutor;
}

/**
 * Set the default CLI executor instance.
 * @param executor - The executor to use as default.
 */
export function setDefaultExecutor(executor: CliExecutor): void {
  defaultExecutor = executor;
}
