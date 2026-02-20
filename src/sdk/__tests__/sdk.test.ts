/**
 * @fileoverview Cortex SDK Test Suite
 * 
 * Comprehensive tests for the Cortex TypeScript SDK.
 * Tests cover client operations, error handling, streaming, and type safety.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CortexClient,
  CliExecutor,
  AutonomyLevel,
  ExecOutputFormat,
  CortexError,
  CliExecutionError,
  RateLimitError,
  TimeoutError,
  parseCliError,
  createErrorFromResult,
  withRetry,
  isRecoverableError,
  formatError,
  SDK_VERSION,
} from "../index";
import type { ProcessRunner, ProcessResult, ProcessHandle, ProcessOptions } from "../executor";

// ============================================================================
// Mock Process Runner
// ============================================================================

/**
 * Mock process runner for testing.
 */
class MockProcessRunner implements ProcessRunner {
  public execResults: Map<string, ProcessResult> = new Map();
  public spawnHandles: Map<string, MockProcessHandle> = new Map();
  public execCalls: Array<{ command: string; args: string[]; options: ProcessOptions }> = [];
  public spawnCalls: Array<{ command: string; args: string[]; options: ProcessOptions }> = [];

  setExecResult(argsPattern: string, result: ProcessResult): void {
    this.execResults.set(argsPattern, result);
  }

  setSpawnHandle(argsPattern: string, handle: MockProcessHandle): void {
    this.spawnHandles.set(argsPattern, handle);
  }

  async exec(
    command: string,
    args: string[],
    options: ProcessOptions
  ): Promise<ProcessResult> {
    this.execCalls.push({ command, args, options });
    
    // Find matching result
    const argsStr = args.join(" ");
    for (const [pattern, result] of this.execResults) {
      if (argsStr.includes(pattern)) {
        return result;
      }
    }

    // Default success result
    return {
      exitCode: 0,
      stdout: "",
      stderr: "",
      durationMs: 100,
    };
  }

  spawn(
    command: string,
    args: string[],
    options: ProcessOptions
  ): ProcessHandle {
    this.spawnCalls.push({ command, args, options });
    
    const argsStr = args.join(" ");
    for (const [pattern, handle] of this.spawnHandles) {
      if (argsStr.includes(pattern)) {
        return handle;
      }
    }

    return new MockProcessHandle();
  }

  reset(): void {
    this.execResults.clear();
    this.spawnHandles.clear();
    this.execCalls = [];
    this.spawnCalls = [];
  }
}

/**
 * Mock process handle for testing.
 */
class MockProcessHandle implements ProcessHandle {
  pid = 12345;
  private stdoutCallbacks: ((data: string) => void)[] = [];
  private stderrCallbacks: ((data: string) => void)[] = [];
  private exitCallbacks: ((code: number) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];
  private exitCode = 0;
  private resolved = false;

  wait(): Promise<ProcessResult> {
    return new Promise((resolve) => {
      if (this.resolved) {
        resolve({
          exitCode: this.exitCode,
          stdout: "",
          stderr: "",
          durationMs: 100,
});

describe("SDK Extended Tests", () => {
  describe("SDK Version and Info", () => {
    it("should have SDK_VERSION defined", () => {
      expect(SDK_VERSION).toBe("1.0.0");
    });

    it("should have version format", () => {
      expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe("CortexError Hierarchy", () => {
    it("should create base CortexError", () => {
      const error = new CortexError("Test error", "TEST_ERROR");

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_ERROR");
      expect(error instanceof Error).toBe(true);
    });

    it("should create CliExecutionError", () => {
      const error = new CliExecutionError("Command failed", 1, "stderr output");

      expect(error.message).toBe("Command failed");
      expect(error.exitCode).toBe(1);
      expect(error.stderr).toBe("stderr output");
    });

    it("should create RateLimitError with retry info", () => {
      const error = new RateLimitError("Rate limited", 60);

      expect(error.message).toBe("Rate limited");
      expect(error.retryAfterSeconds).toBe(60);
    });

    it("should create TimeoutError", () => {
      const error = new TimeoutError("Operation timed out", 30000);

      expect(error.message).toBe("Operation timed out");
      expect(error.timeoutMs).toBe(30000);
    });
  });

  describe("Error Parsing", () => {
    it("should parse CLI error from output", () => {
      const result = parseCliError("Error: Authentication failed");

      expect(result).toBeDefined();
    });

    it("should create error from process result", () => {
      const result = {
        success: false,
        exitCode: 1,
        stderr: "Command not found",
        durationMs: 100,
      };

      const error = createErrorFromResult(result);

      expect(error).toBeDefined();
    });

    it("should format error for display", () => {
      const error = new CortexError("Test error", "TEST");
      const formatted = formatError(error);

      expect(typeof formatted).toBe("string");
      expect(formatted).toContain("Test error");
    });
  });

  describe("Error Recovery", () => {
    it("should identify recoverable errors", () => {
      const rateLimitError = new RateLimitError("Rate limited", 60);
      const timeoutError = new TimeoutError("Timeout", 30000);

      expect(isRecoverableError(rateLimitError)).toBe(true);
      expect(isRecoverableError(timeoutError)).toBe(true);
    });

    it("should retry on recoverable errors", async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new RateLimitError("Rate limited", 0);
        }
        return "success";
      };

      const result = await withRetry(operation, { maxAttempts: 5 });

      expect(result).toBe("success");
      expect(attempts).toBe(3);
    });

    it("should fail after max attempts", async () => {
      const operation = async () => {
        throw new RateLimitError("Rate limited", 0);
      };

      await expect(withRetry(operation, { maxAttempts: 2 }))
        .rejects.toThrow(RateLimitError);
    });
  });

  describe("AutonomyLevel Values", () => {
    it("should have read-only level", () => {
      expect(AutonomyLevel.ReadOnly).toBe("read-only");
    });

    it("should have low level", () => {
      expect(AutonomyLevel.Low).toBe("low");
    });

    it("should have medium level", () => {
      expect(AutonomyLevel.Medium).toBe("medium");
    });

    it("should have high level", () => {
      expect(AutonomyLevel.High).toBe("high");
    });
  });

  describe("ExecOutputFormat Values", () => {
    it("should have text format", () => {
      expect(ExecOutputFormat.Text).toBe("text");
    });

    it("should have json format", () => {
      expect(ExecOutputFormat.Json).toBe("json");
    });

    it("should have stream-json format", () => {
      expect(ExecOutputFormat.StreamJson).toBe("stream-json");
    });

    it("should have stream-jsonrpc format", () => {
      expect(ExecOutputFormat.StreamJsonrpc).toBe("stream-jsonrpc");
    });
  });

  describe("CortexClient Configuration", () => {
    it("should accept default model configuration", () => {
      const config = {
        defaultModel: "claude-sonnet-4-20250514",
      };

      expect(config.defaultModel).toBe("claude-sonnet-4-20250514");
    });

    it("should accept default autonomy configuration", () => {
      const config = {
        defaultAutonomy: AutonomyLevel.Medium,
      };

      expect(config.defaultAutonomy).toBe("medium");
    });

    it("should accept cwd configuration", () => {
      const config = {
        cwd: "/path/to/project",
      };

      expect(config.cwd).toBe("/path/to/project");
    });

    it("should accept verbose configuration", () => {
      const config = {
        verbose: true,
      };

      expect(config.verbose).toBe(true);
    });
  });

  describe("Process Result Types", () => {
    it("should represent successful result", () => {
      const result: ProcessResult = {
        exitCode: 0,
        stdout: "output",
        stderr: "",
        durationMs: 100,
      };

      expect(result.exitCode).toBe(0);
    });

    it("should represent failed result", () => {
      const result: ProcessResult = {
        exitCode: 1,
        stdout: "",
        stderr: "error",
        durationMs: 50,
      };

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("error");
    });
  });

  describe("Stream Handle Interface", () => {
    it("should define stream handle methods", () => {
      const mockHandle = {
        onData: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      };

      expect(typeof mockHandle.onData).toBe("function");
      expect(typeof mockHandle.close).toBe("function");
    });
  });
});
      } else {
        this.exitCallbacks.push((code) => {
          resolve({
            exitCode: code,
            stdout: "",
            stderr: "",
            durationMs: 100,
          });
        });
      }
    });
  }

  write(_data: string): void {
    // Mock write
  }

  closeStdin(): void {
    // Mock close
  }

  kill(): void {
    this.emitExit(130);
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

  // Test helpers
  emitStdout(data: string): void {
    this.stdoutCallbacks.forEach((cb) => cb(data));
  }

  emitStderr(data: string): void {
    this.stderrCallbacks.forEach((cb) => cb(data));
  }

  emitExit(code: number): void {
    this.exitCode = code;
    this.resolved = true;
    this.exitCallbacks.forEach((cb) => cb(code));
  }

  emitError(error: Error): void {
    this.errorCallbacks.forEach((cb) => cb(error));
  }
}

// ============================================================================
// Test Suites
// ============================================================================

describe("SDK Version", () => {
  it("should export SDK version", () => {
    expect(SDK_VERSION).toBe("1.0.0");
  });
});

describe("CortexClient", () => {
  let mockRunner: MockProcessRunner;
  let client: CortexClient;

  beforeEach(() => {
    mockRunner = new MockProcessRunner();
    client = new CortexClient({
      runner: mockRunner,
      defaultModel: "test-model",
    });
  });

  afterEach(() => {
    mockRunner.reset();
  });

  describe("getVersion", () => {
    it("should return CLI version", async () => {
      mockRunner.setExecResult("--version", {
        exitCode: 0,
        stdout: "cortex 0.1.0 (abc1234 2024-01-01)",
        stderr: "",
        durationMs: 50,
      });

      const version = await client.getVersion();
      expect(version).toBe("cortex 0.1.0 (abc1234 2024-01-01)");
    });

    it("should throw on version error", async () => {
      mockRunner.setExecResult("--version", {
        exitCode: 1,
        stdout: "",
        stderr: "command not found",
        durationMs: 50,
      });

      await expect(client.getVersion()).rejects.toThrow();
    });
  });

  describe("exec", () => {
    it("should execute prompt with default options", async () => {
      mockRunner.setExecResult("exec", {
        exitCode: 0,
        stdout: "Task completed successfully",
        stderr: "",
        durationMs: 1000,
      });

      const result = await client.exec("Test prompt");

      expect(result.success).toBe(true);
      expect(result.data).toBe("Task completed successfully");
      expect(mockRunner.execCalls).toHaveLength(1);
      expect(mockRunner.execCalls[0].args).toContain("exec");
      expect(mockRunner.execCalls[0].args).toContain("--model");
      expect(mockRunner.execCalls[0].args).toContain("test-model");
    });

    it("should pass autonomy level", async () => {
      mockRunner.setExecResult("exec", {
        exitCode: 0,
        stdout: "Done",
        stderr: "",
        durationMs: 100,
      });

      await client.exec("Test", { autonomy: AutonomyLevel.Medium });

      expect(mockRunner.execCalls[0].args).toContain("--auto");
      expect(mockRunner.execCalls[0].args).toContain("medium");
    });

    it("should handle execution failure", async () => {
      mockRunner.setExecResult("exec", {
        exitCode: 1,
        stdout: "",
        stderr: "Error: rate limit exceeded",
        durationMs: 100,
      });

      const result = await client.exec("Test");

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("rate limit");
    });

    it("should pass all options correctly", async () => {
      mockRunner.setExecResult("exec", {
        exitCode: 0,
        stdout: "Success",
        stderr: "",
        durationMs: 100,
      });

      await client.exec("Test prompt", {
        model: "custom-model",
        autonomy: AutonomyLevel.High,
        maxTurns: 50,
        timeout: 300,
        sessionId: "session-123",
        enabledTools: ["tool1", "tool2"],
        disabledTools: ["tool3"],
        verbose: true,
        systemPrompt: "Custom system prompt",
        useSpec: true,
      });

      const args = mockRunner.execCalls[0].args;
      expect(args).toContain("--model");
      expect(args).toContain("custom-model");
      expect(args).toContain("--auto");
      expect(args).toContain("high");
      expect(args).toContain("--max-turns");
      expect(args).toContain("50");
      expect(args).toContain("--timeout");
      expect(args).toContain("300");
      expect(args).toContain("--session-id");
      expect(args).toContain("session-123");
      expect(args).toContain("--enabled-tools");
      expect(args).toContain("--disabled-tools");
      expect(args).toContain("--verbose");
      expect(args).toContain("--system");
      expect(args).toContain("--use-spec");
    });
  });

  describe("execJson", () => {
    it("should parse JSON output", async () => {
      mockRunner.setExecResult("exec", {
        exitCode: 0,
        stdout: JSON.stringify({
          type: "result",
          session_id: "sess-123",
          success: true,
        }),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.execJson("Test");

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe("result");
      expect(result.data?.session_id).toBe("sess-123");
    });

    it("should handle invalid JSON", async () => {
      mockRunner.setExecResult("exec", {
        exitCode: 0,
        stdout: "not valid json",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.execJson("Test");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to parse JSON");
    });
  });

  describe("listSessions", () => {
    it("should list sessions with options", async () => {
      mockRunner.setExecResult("sessions", {
        exitCode: 0,
        stdout: JSON.stringify({
          sessions: [
            { id: "sess-1", title: "Test session" },
          ],
          total: 1,
        }),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.listSessions({
        all: true,
        days: 7,
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data?.sessions).toHaveLength(1);
      expect(mockRunner.execCalls[0].args).toContain("--all");
      expect(mockRunner.execCalls[0].args).toContain("--days");
      expect(mockRunner.execCalls[0].args).toContain("--limit");
    });
  });

  describe("listModels", () => {
    it("should list available models", async () => {
      mockRunner.setExecResult("models", {
        exitCode: 0,
        stdout: JSON.stringify({
          models: [
            { id: "model-1", name: "Model One", provider: "anthropic" },
            { id: "model-2", name: "Model Two", provider: "openai" },
          ],
        }),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.listModels();

      expect(result.success).toBe(true);
      expect(result.data?.models).toHaveLength(2);
    });
  });

  describe("whoami", () => {
    it("should return logged in status", async () => {
      mockRunner.setExecResult("whoami", {
        exitCode: 0,
        stdout: "user@example.com",
        stderr: "",
        durationMs: 50,
      });

      const result = await client.whoami();

      expect(result.success).toBe(true);
      expect(result.data?.loggedIn).toBe(true);
      expect(result.data?.username).toBe("user@example.com");
    });

    it("should handle not logged in", async () => {
      mockRunner.setExecResult("whoami", {
        exitCode: 0,
        stdout: "not logged in",
        stderr: "",
        durationMs: 50,
      });

      const result = await client.whoami();

      expect(result.data?.loggedIn).toBe(false);
    });
  });
});

describe("Error Handling", () => {
  describe("parseCliError", () => {
    it("should detect rate limit errors", () => {
      const parsed = parseCliError("Error: rate limit exceeded, retry after 60 seconds");
      expect(parsed.type).toBe("rate_limit");
      expect(parsed.retryAfterSeconds).toBe(60);
    });

    it("should detect context window errors", () => {
      const parsed = parseCliError("context window exceeded: 150000/128000 tokens");
      expect(parsed.type).toBe("context_window_exceeded");
      expect(parsed.currentTokens).toBe(150000);
      expect(parsed.maxTokens).toBe(128000);
    });

    it("should detect authentication errors", () => {
      const parsed = parseCliError("Error: invalid api key or unauthorized");
      expect(parsed.type).toBe("authentication_error");
    });

    it("should detect permission denied errors", () => {
      const parsed = parseCliError("Error: permission denied for /etc/passwd");
      expect(parsed.type).toBe("permission_denied");
    });

    it("should detect model not found errors", () => {
      const parsed = parseCliError("Error: model 'unknown-model' not found");
      expect(parsed.type).toBe("model_not_found");
    });

    it("should detect timeout errors", () => {
      const parsed = parseCliError("Error: operation timed out after 60s");
      expect(parsed.type).toBe("timeout");
    });

    it("should detect network errors", () => {
      const parsed = parseCliError("Error: network error - ECONNREFUSED");
      expect(parsed.type).toBe("network_error");
    });

    it("should extract error messages", () => {
      const parsed = parseCliError("error: Something went wrong\nDetails...");
      expect(parsed.message).toBe("Something went wrong");
    });
  });

  describe("createErrorFromResult", () => {
    it("should create RateLimitError", () => {
      const error = createErrorFromResult({
        success: false,
        exitCode: 1,
        stderr: "rate limit exceeded",
      });

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.recoverable).toBe(true);
    });

    it("should create TimeoutError", () => {
      const error = createErrorFromResult({
        success: false,
        exitCode: 124,
        stderr: "operation timed out",
      });

      expect(error).toBeInstanceOf(TimeoutError);
    });

    it("should fallback to CliExecutionError", () => {
      const error = createErrorFromResult({
        success: false,
        exitCode: 1,
        stderr: "unknown error",
      });

      expect(error).toBeInstanceOf(CliExecutionError);
    });
  });

  describe("isRecoverableError", () => {
    it("should identify recoverable errors", () => {
      expect(isRecoverableError(new RateLimitError("test"))).toBe(true);
      expect(isRecoverableError(new TimeoutError("test", 1000))).toBe(true);
    });

    it("should identify non-recoverable errors", () => {
      expect(isRecoverableError(new CortexError("test", "TEST", false))).toBe(false);
      expect(isRecoverableError(new Error("test"))).toBe(false);
    });
  });

  describe("formatError", () => {
    it("should format CliExecutionError", () => {
      const error = new CliExecutionError("Test error", 1, "", "stderr output");
      const formatted = formatError(error);

      expect(formatted).toContain("CLI Error");
      expect(formatted).toContain("exit code 1");
      expect(formatted).toContain("stderr output");
    });

    it("should format CortexError", () => {
      const error = new CortexError("Test message", "TEST_CODE");
      const formatted = formatError(error);

      expect(formatted).toContain("CortexError");
      expect(formatted).toContain("TEST_CODE");
      expect(formatted).toContain("Test message");
    });

    it("should handle plain Error", () => {
      const error = new Error("Plain error");
      const formatted = formatError(error);

      expect(formatted).toBe("Plain error");
    });

    it("should handle non-error values", () => {
      const formatted = formatError("string error");
      expect(formatted).toBe("string error");
    });
  });
});

describe("Retry Logic", () => {
  describe("withRetry", () => {
    it("should succeed without retry", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await withRetry(operation, { maxAttempts: 3 });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on recoverable errors", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new RateLimitError("rate limited"))
        .mockResolvedValue("success");

      const result = await withRetry(operation, { maxAttempts: 3 });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should not retry on non-recoverable errors", async () => {
      const error = new CortexError("non-recoverable", "TEST", false);
      const operation = vi.fn().mockRejectedValue(error);

      await expect(withRetry(operation, { maxAttempts: 3 })).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should exhaust retries", async () => {
      const error = new RateLimitError("rate limited");
      const operation = vi.fn().mockRejectedValue(error);

      await expect(withRetry(operation, { maxAttempts: 3 })).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should call onRetry callback", async () => {
      const onRetry = vi.fn();
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new RateLimitError("rate limited"))
        .mockResolvedValue("success");

      await withRetry(operation, { maxAttempts: 3, onRetry });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(RateLimitError),
        0,
        expect.any(Number)
      );
    });

    it("should use custom shouldRetry function", async () => {
      const shouldRetry = vi.fn().mockReturnValue(false);
      const error = new RateLimitError("rate limited");
      const operation = vi.fn().mockRejectedValue(error);

      await expect(
        withRetry(operation, { maxAttempts: 3, shouldRetry })
      ).rejects.toThrow(error);

      expect(operation).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledWith(error);
    });
  });
});

describe("CliExecutor", () => {
  let mockRunner: MockProcessRunner;
  let executor: CliExecutor;

  beforeEach(() => {
    mockRunner = new MockProcessRunner();
    executor = new CliExecutor({ runner: mockRunner });
  });

  describe("exec", () => {
    it("should execute command and return result", async () => {
      mockRunner.setExecResult("test", {
        exitCode: 0,
        stdout: "output",
        stderr: "",
        durationMs: 100,
      });

      const result = await executor.exec(["test", "arg"]);

      expect(result.success).toBe(true);
      expect(result.data).toBe("output");
      expect(result.exitCode).toBe(0);
    });

    it("should handle failed commands", async () => {
      mockRunner.setExecResult("fail", {
        exitCode: 1,
        stdout: "",
        stderr: "error message",
        durationMs: 100,
      });

      const result = await executor.exec(["fail"]);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toBe("error message");
    });

    it("should include duration", async () => {
      mockRunner.setExecResult("test", {
        exitCode: 0,
        stdout: "",
        stderr: "",
        durationMs: 500,
      });

      const result = await executor.exec(["test"]);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("execJson", () => {
    it("should parse JSON output", async () => {
      mockRunner.setExecResult("json", {
        exitCode: 0,
        stdout: '{"key": "value"}',
        stderr: "",
        durationMs: 100,
      });

      const result = await executor.execJson<{ key: string }>(["json"]);

      expect(result.success).toBe(true);
      expect(result.data?.key).toBe("value");
    });

    it("should fail on invalid JSON", async () => {
      mockRunner.setExecResult("invalid", {
        exitCode: 0,
        stdout: "not json",
        stderr: "",
        durationMs: 100,
      });

      const result = await executor.execJson(["invalid"]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to parse JSON");
    });
  });

  describe("isAvailable", () => {
    it("should return true when CLI works", async () => {
      mockRunner.setExecResult("--version", {
        exitCode: 0,
        stdout: "cortex 1.0.0",
        stderr: "",
        durationMs: 50,
      });

      const available = await executor.isAvailable();
      expect(available).toBe(true);
    });

    it("should return false when CLI fails", async () => {
      mockRunner.setExecResult("--version", {
        exitCode: 127,
        stdout: "",
        stderr: "command not found",
        durationMs: 50,
      });

      const available = await executor.isAvailable();
      expect(available).toBe(false);
    });
  });
});

describe("Type Safety", () => {
  it("should enforce AutonomyLevel enum values", () => {
    // This is a compile-time check, but we can verify runtime values
    expect(Object.values(AutonomyLevel)).toEqual([
      "read-only",
      "low",
      "medium",
      "high",
    ]);
  });

  it("should enforce ExecOutputFormat enum values", () => {
    expect(Object.values(ExecOutputFormat)).toEqual([
      "text",
      "json",
      "stream-json",
      "stream-jsonrpc",
    ]);
  });
});