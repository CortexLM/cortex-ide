/**
 * @fileoverview Cortex SDK Client
 * 
 * Main client for interacting with the Cortex CLI. Provides high-level
 * methods for all CLI commands with proper TypeScript typing.
 * 
 * @module @cortex/sdk/client
 * @author Cortex Team
 * @license Apache-2.0
 * 
 * @example
 * ```typescript
 * import { CortexClient } from '@cortex/sdk';
 * 
 * const client = new CortexClient();
 * 
 * // Execute a prompt
 * const result = await client.exec('Write a hello world function in TypeScript');
 * 
 * // Stream execution with events
 * const stream = client.execStream('Fix the bug in main.ts', {
 *   onEvent: (event) => console.log(event),
 * });
 * await stream.wait();
 * ```
 */

import {
  CliExecutor,
  type CliExecutorOptions,
  type ExecutionOptions,
  type JsonStreamHandle,
} from "./executor";

import type {
  CliResult,
  ExecOptions,
  RunOptions,
  SessionListOptions,
  SessionMetadata,
  SessionListResponse,
  ModelInfo,
  AgentDefinition,
  AgentOptions,
  CliConfig,
  EventMsg,
  AutonomyLevel,
  ExecOutputFormat,
  RunOutputFormat,
} from "./types";

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * Configuration options for the Cortex client.
 */
export interface CortexClientConfig extends CliExecutorOptions {
  /** Default model to use. */
  defaultModel?: string;
  /** Default autonomy level for exec commands. */
  defaultAutonomy?: AutonomyLevel;
  /** Enable verbose logging. */
  verbose?: boolean;
}

// ============================================================================
// Main Client Class
// ============================================================================

/**
 * Main client for interacting with the Cortex CLI.
 * 
 * This class provides a type-safe interface to all Cortex CLI commands,
 * handling argument construction, output parsing, and error handling.
 */
export class CortexClient {
  private executor: CliExecutor;
  private config: CortexClientConfig;

  /**
   * Create a new Cortex client.
   * @param config - Client configuration options.
   */
  constructor(config: CortexClientConfig = {}) {
    this.config = config;
    this.executor = new CliExecutor(config);
  }

  // ==========================================================================
  // Version & Health
  // ==========================================================================

  /**
   * Get the CLI version.
   * @returns The version string.
   */
  async getVersion(): Promise<string> {
    return this.executor.getVersion();
  }

  /**
   * Check if the CLI is available and working.
   * @returns True if the CLI is available.
   */
  async isAvailable(): Promise<boolean> {
    return this.executor.isAvailable();
  }

  /**
   * Get detailed version information.
   * @returns Version info including git hash and build date.
   */
  async getVersionInfo(): Promise<CliResult<VersionInfo>> {
    const result = await this.executor.exec(["--version"]);
    if (!result.success || !result.data) {
      return { ...result, data: undefined };
    }

    // Parse version string: "cortex 0.1.0 (abc1234 2024-01-01)"
    const match = result.data.match(
      /(\S+)\s+(\d+\.\d+\.\d+(?:-\S+)?)\s*(?:\((\S+)\s+(\S+)\))?/
    );

    if (match) {
      return {
        ...result,
        data: {
          name: match[1],
          version: match[2],
          gitHash: match[3],
          buildDate: match[4],
        },
      };
    }

    return {
      ...result,
      data: { name: "cortex", version: result.data.trim() },
    };
  }

  // ==========================================================================
  // Exec Command (Headless Execution)
  // ==========================================================================

  /**
   * Execute a prompt in headless mode.
   * 
   * This is the primary method for non-interactive AI execution.
   * It supports various autonomy levels and output formats.
   * 
   * @param prompt - The prompt to execute.
   * @param options - Execution options.
   * @returns The execution result.
   * 
   * @example
   * ```typescript
   * const result = await client.exec('Write unit tests for src/utils.ts', {
   *   autonomy: AutonomyLevel.Medium,
   *   maxTurns: 50,
   * });
   * ```
   */
  async exec(
    prompt: string,
    options: ExecOptions = {}
  ): Promise<CliResult<string>> {
    const args = this.buildExecArgs(prompt, options);
    return this.executor.exec(args, {
      cwd: options.cwd ?? this.config.cwd,
      timeout: options.timeout ? options.timeout * 1000 : undefined,
    });
  }

  /**
   * Execute a prompt with JSON output.
   * 
   * @param prompt - The prompt to execute.
   * @param options - Execution options.
   * @returns The parsed JSON result.
   */
  async execJson<T = ExecJsonResult>(
    prompt: string,
    options: ExecOptions = {}
  ): Promise<CliResult<T>> {
    const args = this.buildExecArgs(prompt, {
      ...options,
      outputFormat: "json" as ExecOutputFormat,
    });
    return this.executor.execJson<T>(args.filter((a) => a !== "--json"), {
      cwd: options.cwd ?? this.config.cwd,
      timeout: options.timeout ? options.timeout * 1000 : undefined,
    });
  }

  /**
   * Execute a prompt with streaming output.
   * 
   * @param prompt - The prompt to execute.
   * @param options - Streaming options.
   * @returns A stream handle for controlling the execution.
   * 
   * @example
   * ```typescript
   * const stream = client.execStream('Refactor the codebase', {
   *   onEvent: (event) => {
   *     if (event.type === 'agent_message_delta') {
   *       process.stdout.write(event.data.delta);
   *     }
   *   },
   * });
   * 
   * const result = await stream.wait();
   * ```
   */
  execStream(
    prompt: string,
    options: ExecStreamOptions = {}
  ): JsonStreamHandle {
    const args = this.buildExecArgs(prompt, {
      ...options,
      outputFormat: "stream-json" as ExecOutputFormat,
    });

    const handle = this.executor.streamJson(
      args.filter((a) => a !== "--output-format" && a !== "stream-json"),
      {
        cwd: options.cwd ?? this.config.cwd,
        timeout: options.timeout ? options.timeout * 1000 : undefined,
        onStderr: options.onStderr,
        onExit: options.onExit,
        onError: options.onError,
        signal: options.signal,
      }
    );

    if (options.onEvent) {
      handle.onEvent(options.onEvent);
    }

    return handle;
  }

  /**
   * Build arguments for the exec command.
   */
  private buildExecArgs(prompt: string, options: ExecOptions): string[] {
    const args: string[] = ["exec"];

    // Model
    const model = options.model ?? this.config.defaultModel;
    if (model) {
      args.push("--model", model);
    }

    // Autonomy
    const autonomy = options.autonomy ?? this.config.defaultAutonomy;
    if (autonomy) {
      args.push("--auto", autonomy);
    }

    // Skip permissions (dangerous)
    if (options.skipPermissions) {
      args.push("--skip-permissions-unsafe");
    }

    // Output format
    if (options.outputFormat) {
      args.push("--output-format", options.outputFormat);
    }

    // Input format
    if (options.inputFormat) {
      args.push("--input-format", options.inputFormat);
    }

    // Session continuation
    if (options.sessionId) {
      args.push("--session-id", options.sessionId);
    }

    // Limits
    if (options.maxTurns !== undefined) {
      args.push("--max-turns", String(options.maxTurns));
    }
    if (options.timeout !== undefined) {
      args.push("--timeout", String(options.timeout));
    }
    if (options.maxTokens !== undefined) {
      args.push("--max-tokens", String(options.maxTokens));
    }

    // Tools
    if (options.enabledTools?.length) {
      args.push("--enabled-tools", options.enabledTools.join(","));
    }
    if (options.disabledTools?.length) {
      args.push("--disabled-tools", options.disabledTools.join(","));
    }

    // Images
    if (options.images?.length) {
      for (const image of options.images) {
        args.push("--image", image);
      }
    }

    // System prompt
    if (options.systemPrompt) {
      args.push("--system", options.systemPrompt);
    }

    // Spec mode
    if (options.useSpec) {
      args.push("--use-spec");
    }
    if (options.specModel) {
      args.push("--spec-model", options.specModel);
    }

    // Verbose
    if (options.verbose ?? this.config.verbose) {
      args.push("--verbose");
    }

    // Working directory
    if (options.cwd) {
      args.push("--cwd", options.cwd);
    }

    // Prompt (must be last for trailing_var_arg)
    args.push("--", prompt);

    return args;
  }

  // ==========================================================================
  // Run Command (Interactive Execution)
  // ==========================================================================

  /**
   * Run a prompt non-interactively with advanced options.
   * 
   * @param prompt - The prompt to run.
   * @param options - Run options.
   * @returns The run result.
   */
  async run(prompt: string, options: RunOptions = {}): Promise<CliResult<string>> {
    const args = this.buildRunArgs(prompt, options);
    return this.executor.exec(args, {
      cwd: options.cwd ?? this.config.cwd,
      timeout: options.timeout ? options.timeout * 1000 : undefined,
    });
  }

  /**
   * Run a prompt with JSON output.
   * 
   * @param prompt - The prompt to run.
   * @param options - Run options.
   * @returns The parsed JSON result.
   */
  async runJson<T = RunJsonResult>(
    prompt: string,
    options: RunOptions = {}
  ): Promise<CliResult<T>> {
    const args = this.buildRunArgs(prompt, { ...options, format: "json" as RunOutputFormat });
    return this.executor.execJson<T>(args.filter((a) => a !== "--format" && a !== "json"), {
      cwd: options.cwd ?? this.config.cwd,
      timeout: options.timeout ? options.timeout * 1000 : undefined,
    });
  }

  /**
   * Build arguments for the run command.
   */
  private buildRunArgs(prompt: string, options: RunOptions): string[] {
    const args: string[] = ["run"];

    // Model
    const model = options.model ?? this.config.defaultModel;
    if (model) {
      args.push("--model", model);
    }

    // Format
    if (options.format) {
      args.push("--format", options.format);
    }

    // Agent
    if (options.agent) {
      args.push("--agent", options.agent);
    }

    // Files
    if (options.files?.length) {
      for (const file of options.files) {
        args.push("--file", file);
      }
    }

    // Continue session
    if (options.continue) {
      args.push("--continue");
    }

    // Streaming
    if (options.noStreaming) {
      args.push("--no-streaming");
    }

    // Web search
    if (options.webSearch) {
      args.push("--search");
    }

    // Verbose
    if (options.verbose ?? this.config.verbose) {
      args.push("--verbose");
    }

    // Prompt
    args.push("--", prompt);

    return args;
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * List previous sessions.
   * 
   * @param options - List options.
   * @returns The list of sessions.
   */
  async listSessions(
    options: SessionListOptions = {}
  ): Promise<CliResult<SessionListResponse>> {
    const args: string[] = ["sessions"];

    if (options.all) args.push("--all");
    if (options.days !== undefined) args.push("--days", String(options.days));
    if (options.search) args.push("--search", options.search);
    if (options.limit !== undefined) args.push("--limit", String(options.limit));
    if (options.favorites) args.push("--favorites");
    args.push("--json");

    return this.executor.execJson<SessionListResponse>(args, {
      cwd: this.config.cwd,
    });
  }

  /**
   * Resume a previous session.
   * 
   * @param sessionId - Session ID to resume, or "last" for the most recent.
   * @returns The resumed session result.
   */
  async resumeSession(sessionId: string): Promise<CliResult<string>> {
    const args = ["resume", sessionId];
    return this.executor.exec(args, { cwd: this.config.cwd });
  }

  /**
   * Resume the last session.
   * 
   * @returns The resumed session result.
   */
  async resumeLastSession(): Promise<CliResult<string>> {
    const args = ["resume", "--last"];
    return this.executor.exec(args, { cwd: this.config.cwd });
  }

  /**
   * Export a session to JSON.
   * 
   * @param sessionId - Session ID to export.
   * @param outputPath - Optional output file path.
   * @returns The exported session data.
   */
  async exportSession<T = unknown>(
    sessionId: string,
    outputPath?: string
  ): Promise<CliResult<T>> {
    const args: string[] = ["export", sessionId];
    if (outputPath) {
      args.push("--output", outputPath);
    }
    args.push("--format", "json");

    return this.executor.execJson<T>(args.filter((a) => a !== "--json"), {
      cwd: this.config.cwd,
    });
  }

  /**
   * Import a session from JSON file or URL.
   * 
   * @param source - File path or URL to import from.
   * @returns The import result.
   */
  async importSession(source: string): Promise<CliResult<SessionMetadata>> {
    const args = ["import", source, "--json"];
    return this.executor.execJson<SessionMetadata>(args.filter((a) => a !== "--json"), {
      cwd: this.config.cwd,
    });
  }

  /**
   * Delete a session.
   * 
   * @param sessionId - Session ID to delete.
   * @param force - Force deletion even if locked.
   * @returns The deletion result.
   */
  async deleteSession(
    sessionId: string,
    force = false
  ): Promise<CliResult<void>> {
    const args = ["delete", sessionId, "--yes"];
    if (force) args.push("--force");

    const result = await this.executor.exec(args, { cwd: this.config.cwd });
    return { ...result, data: undefined };
  }

  // ==========================================================================
  // Models
  // ==========================================================================

  /**
   * List available models.
   * 
   * @returns The list of available models.
   */
  async listModels(): Promise<CliResult<ModelListResponse>> {
    const args = ["models", "--json"];
    return this.executor.execJson<ModelListResponse>(args.filter((a) => a !== "--json"), {
      cwd: this.config.cwd,
    });
  }

  /**
   * Get information about a specific model.
   * 
   * @param modelId - Model ID to get info for.
   * @returns The model information.
   */
  async getModelInfo(modelId: string): Promise<CliResult<ModelInfo>> {
    const result = await this.listModels();
    if (!result.success || !result.data) {
      return { ...result, data: undefined };
    }

    const model = result.data.models.find((m) => m.id === modelId);
    if (!model) {
      return {
        success: false,
        error: `Model not found: ${modelId}`,
        exitCode: 1,
      };
    }

    return { ...result, data: model };
  }

  // ==========================================================================
  // Agents
  // ==========================================================================

  /**
   * List available agents.
   * 
   * @param options - Agent list options.
   * @returns The list of agents.
   */
  async listAgents(
    options: AgentOptions = {}
  ): Promise<CliResult<AgentDefinition[]>> {
    const args: string[] = ["agent", "list"];
    if (options.global) args.push("--global");
    args.push("--json");

    return this.executor.execJson<AgentDefinition[]>(args.filter((a) => a !== "--json"), {
      cwd: this.config.cwd,
    });
  }

  /**
   * Get information about a specific agent.
   * 
   * @param name - Agent name.
   * @returns The agent definition.
   */
  async getAgent(name: string): Promise<CliResult<AgentDefinition>> {
    const args = ["agent", "show", name, "--json"];
    return this.executor.execJson<AgentDefinition>(args.filter((a) => a !== "--json"), {
      cwd: this.config.cwd,
    });
  }

  /**
   * Create a new agent.
   * 
   * @param name - Agent name.
   * @param options - Agent configuration.
   * @returns The creation result.
   */
  async createAgent(
    name: string,
    options: CreateAgentOptions = {}
  ): Promise<CliResult<string>> {
    const args: string[] = ["agent", "create", name];
    if (options.description) args.push("--description", options.description);
    if (options.systemPrompt) args.push("--system", options.systemPrompt);
    if (options.model) args.push("--model", options.model);
    if (options.global) args.push("--global");

    return this.executor.exec(args, { cwd: this.config.cwd });
  }

  // ==========================================================================
  // MCP (Model Context Protocol)
  // ==========================================================================

  /**
   * List MCP servers.
   * 
   * @returns The list of MCP servers.
   */
  async listMcpServers(): Promise<CliResult<McpServerInfo[]>> {
    const args = ["mcp", "list", "--json"];
    return this.executor.execJson<McpServerInfo[]>(args.filter((a) => a !== "--json"), {
      cwd: this.config.cwd,
    });
  }

  /**
   * Add an MCP server.
   * 
   * @param name - Server name.
   * @param command - Command to start the server.
   * @param args - Additional arguments.
   * @returns The addition result.
   */
  async addMcpServer(
    name: string,
    command: string,
    serverArgs: string[] = []
  ): Promise<CliResult<string>> {
    const args = ["mcp", "add", name, command, ...serverArgs];
    return this.executor.exec(args, { cwd: this.config.cwd });
  }

  /**
   * Remove an MCP server.
   * 
   * @param name - Server name to remove.
   * @returns The removal result.
   */
  async removeMcpServer(name: string): Promise<CliResult<void>> {
    const args = ["mcp", "remove", name];
    const result = await this.executor.exec(args, { cwd: this.config.cwd });
    return { ...result, data: undefined };
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Get the current configuration.
   * 
   * @returns The current configuration.
   */
  async getConfig(): Promise<CliResult<CliConfig>> {
    const args = ["config", "--json"];
    return this.executor.execJson<CliConfig>(args.filter((a) => a !== "--json"), {
      cwd: this.config.cwd,
    });
  }

  /**
   * Get a specific configuration value.
   * 
   * @param key - Configuration key.
   * @returns The configuration value.
   */
  async getConfigValue(key: string): Promise<CliResult<string>> {
    const args = ["config", "get", key];
    return this.executor.exec(args, { cwd: this.config.cwd });
  }

  /**
   * Set a configuration value.
   * 
   * @param key - Configuration key.
   * @param value - Configuration value.
   * @returns The set result.
   */
  async setConfigValue(key: string, value: string): Promise<CliResult<void>> {
    const args = ["config", "set", key, value];
    const result = await this.executor.exec(args, { cwd: this.config.cwd });
    return { ...result, data: undefined };
  }

  /**
   * Unset a configuration value.
   * 
   * @param key - Configuration key to unset.
   * @returns The unset result.
   */
  async unsetConfigValue(key: string): Promise<CliResult<void>> {
    const args = ["config", "unset", key];
    const result = await this.executor.exec(args, { cwd: this.config.cwd });
    return { ...result, data: undefined };
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  /**
   * Check login status.
   * 
   * @returns The current user info if logged in.
   */
  async whoami(): Promise<CliResult<WhoamiResponse>> {
    const args = ["whoami"];
    const result = await this.executor.exec(args, { cwd: this.config.cwd });

    if (!result.success) {
      return { ...result, data: undefined };
    }

    // Parse the whoami output
    return {
      ...result,
      data: {
        loggedIn: !result.data?.includes("not logged in"),
        username: result.data?.trim(),
      },
    };
  }

  /**
   * Login with an API key.
   * 
   * @param apiKey - The API key to use.
   * @returns The login result.
   */
  async loginWithApiKey(apiKey: string): Promise<CliResult<void>> {
    const args = ["login", "--with-api-key"];
    const result = await this.executor.exec(args, {
      cwd: this.config.cwd,
      stdin: apiKey,
    });
    return { ...result, data: undefined };
  }

  /**
   * Login with a token.
   * 
   * @param token - The token to use.
   * @returns The login result.
   */
  async loginWithToken(token: string): Promise<CliResult<void>> {
    const args = ["login", "--token", token];
    const result = await this.executor.exec(args, { cwd: this.config.cwd });
    return { ...result, data: undefined };
  }

  /**
   * Logout from the current session.
   * 
   * @returns The logout result.
   */
  async logout(): Promise<CliResult<void>> {
    const args = ["logout", "--yes"];
    const result = await this.executor.exec(args, { cwd: this.config.cwd });
    return { ...result, data: undefined };
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Scrape a URL to markdown.
   * 
   * @param url - URL to scrape.
   * @param format - Output format (markdown, text, html).
   * @returns The scraped content.
   */
  async scrape(
    url: string,
    format: "markdown" | "text" | "html" = "markdown"
  ): Promise<CliResult<string>> {
    const args = ["scrape", url, "--format", format];
    return this.executor.exec(args, { cwd: this.config.cwd });
  }

  /**
   * Get usage statistics.
   * 
   * @returns The usage statistics.
   */
  async getStats(): Promise<CliResult<StatsResponse>> {
    const args = ["stats", "--json"];
    return this.executor.execJson<StatsResponse>(args.filter((a) => a !== "--json"), {
      cwd: this.config.cwd,
    });
  }

  /**
   * Initialize AGENTS.md in the current directory.
   * 
   * @param force - Force overwrite if exists.
   * @returns The init result.
   */
  async init(force = false): Promise<CliResult<string>> {
    const args = ["init", "--yes"];
    if (force) args.push("--force");
    return this.executor.exec(args, { cwd: this.config.cwd });
  }

  // ==========================================================================
  // GitHub Integration
  // ==========================================================================

  /**
   * List GitHub workflows for the current repository.
   * 
   * @returns The list of workflows.
   */
  async listGitHubWorkflows(): Promise<CliResult<GitHubWorkflow[]>> {
    const args = ["github", "workflows", "--json"];
    return this.executor.execJson<GitHubWorkflow[]>(args.filter((a) => a !== "--json"), {
      cwd: this.config.cwd,
    });
  }

  /**
   * Get GitHub action logs.
   * 
   * @param runId - Workflow run ID.
   * @returns The action logs.
   */
  async getGitHubActionLogs(runId: string): Promise<CliResult<string>> {
    const args = ["github", "logs", runId];
    return this.executor.exec(args, { cwd: this.config.cwd });
  }

  /**
   * Checkout a pull request.
   * 
   * @param prNumber - PR number or URL.
   * @returns The checkout result.
   */
  async checkoutPullRequest(prNumber: string | number): Promise<CliResult<string>> {
    const args = ["pr", "checkout", String(prNumber)];
    return this.executor.exec(args, { cwd: this.config.cwd });
  }

  // ==========================================================================
  // Debug & Diagnostics
  // ==========================================================================

  /**
   * Run debug diagnostics.
   * 
   * @returns The diagnostic results.
   */
  async runDiagnostics(): Promise<CliResult<DiagnosticsResult>> {
    const args = ["debug", "diagnostics", "--json"];
    return this.executor.execJson<DiagnosticsResult>(args.filter((a) => a !== "--json"), {
      cwd: this.config.cwd,
    });
  }

  /**
   * Get application logs.
   * 
   * @param lines - Number of lines to retrieve.
   * @returns The log content.
   */
  async getLogs(lines = 100): Promise<CliResult<string>> {
    const args = ["logs", "--lines", String(lines)];
    return this.executor.exec(args, { cwd: this.config.cwd });
  }

  /**
   * Clear the cache.
   * 
   * @returns The clear result.
   */
  async clearCache(): Promise<CliResult<ClearCacheResult>> {
    const args = ["cache", "clear", "--json"];
    return this.executor.execJson<ClearCacheResult>(args.filter((a) => a !== "--json"), {
      cwd: this.config.cwd,
    });
  }

  /**
   * Get cache statistics.
   * 
   * @returns The cache statistics.
   */
  async getCacheStats(): Promise<CliResult<CacheStatsResult>> {
    const args = ["cache", "stats", "--json"];
    return this.executor.execJson<CacheStatsResult>(args.filter((a) => a !== "--json"), {
      cwd: this.config.cwd,
    });
  }

  // ==========================================================================
  // Raw Command Execution
  // ==========================================================================

  /**
   * Execute a raw CLI command.
   * 
   * Use this for commands not covered by the typed methods.
   * 
   * @param args - Command arguments.
   * @param options - Execution options.
   * @returns The command result.
   */
  async rawExec(
    args: string[],
    options: ExecutionOptions = {}
  ): Promise<CliResult<string>> {
    return this.executor.exec(args, {
      cwd: options.cwd ?? this.config.cwd,
      ...options,
    });
  }

  /**
   * Execute a raw CLI command with JSON output.
   * 
   * @param args - Command arguments.
   * @param options - Execution options.
   * @returns The parsed JSON result.
   */
  async rawExecJson<T>(
    args: string[],
    options: ExecutionOptions = {}
  ): Promise<CliResult<T>> {
    return this.executor.execJson<T>(args, {
      cwd: options.cwd ?? this.config.cwd,
      ...options,
    });
  }
}

// ============================================================================
// Additional Types
// ============================================================================

/**
 * Version information.
 */
export interface VersionInfo {
  name: string;
  version: string;
  gitHash?: string;
  buildDate?: string;
}

/**
 * Exec JSON result.
 */
export interface ExecJsonResult {
  type: "result";
  session_id: string;
  success: boolean;
  message?: string;
  total_tokens?: number;
  execution_time_ms?: number;
}

/**
 * Run JSON result.
 */
export interface RunJsonResult {
  type: "result";
  session_id: string;
  response: string;
  model?: string;
}

/**
 * Model list response.
 */
export interface ModelListResponse {
  models: ModelInfo[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
  };
}

/**
 * Options for streaming exec.
 */
export interface ExecStreamOptions extends ExecOptions {
  /** Callback for events. */
  onEvent?: (event: EventMsg) => void;
  /** Callback for stderr. */
  onStderr?: (data: string) => void;
  /** Callback for exit. */
  onExit?: (code: number) => void;
  /** Callback for errors. */
  onError?: (error: Error) => void;
  /** Abort signal. */
  signal?: AbortSignal;
}

/**
 * Options for creating an agent.
 */
export interface CreateAgentOptions {
  description?: string;
  systemPrompt?: string;
  model?: string;
  global?: boolean;
}

/**
 * MCP server information.
 */
export interface McpServerInfo {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  status?: "running" | "stopped" | "error";
}

/**
 * Whoami response.
 */
export interface WhoamiResponse {
  loggedIn: boolean;
  username?: string;
}

/**
 * Usage statistics response.
 */
export interface StatsResponse {
  total_sessions: number;
  total_tokens_used: number;
  total_cost?: number;
  sessions_today?: number;
  tokens_today?: number;
}

/**
 * GitHub workflow.
 */
export interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: "active" | "disabled";
}

/**
 * Diagnostics result.
 */
export interface DiagnosticsResult {
  version: string;
  platform: string;
  config_path: string;
  data_path: string;
  cache_path: string;
  issues: DiagnosticIssue[];
}

/**
 * Diagnostic issue.
 */
export interface DiagnosticIssue {
  severity: "warning" | "error";
  message: string;
  suggestion?: string;
}

/**
 * Clear cache result.
 */
export interface ClearCacheResult {
  cleared_bytes: number;
  cleared_files: number;
}

/**
 * Cache statistics result.
 */
export interface CacheStatsResult {
  total_bytes: number;
  total_files: number;
  breakdown: Record<string, number>;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new Cortex client with default configuration.
 * @param config - Optional configuration overrides.
 * @returns A new CortexClient instance.
 */
export function createClient(config?: CortexClientConfig): CortexClient {
  return new CortexClient(config);
}

// Default export
export default CortexClient;
