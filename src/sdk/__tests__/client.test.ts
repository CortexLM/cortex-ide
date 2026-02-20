import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CortexClient, createClient } from "../client";
import { AutonomyLevel } from "../types";
import type {
  ProcessRunner,
  ProcessResult,
  ProcessHandle,
  ProcessOptions,
} from "../executor";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

interface MockExecCall {
  command: string;
  args: string[];
  options: ProcessOptions;
}

class MockProcessRunner implements ProcessRunner {
  public execResults: Map<string, ProcessResult> = new Map();
  public spawnHandles: Map<string, MockProcessHandle> = new Map();
  public execCalls: MockExecCall[] = [];
  public spawnCalls: MockExecCall[] = [];

  setExecResult(argsPattern: string, result: ProcessResult): void {
    this.execResults.set(argsPattern, result);
  }

  setSpawnHandle(argsPattern: string, handle: MockProcessHandle): void {
    this.spawnHandles.set(argsPattern, handle);
  }

  async exec(
    command: string,
    args: string[],
    options: ProcessOptions,
  ): Promise<ProcessResult> {
    this.execCalls.push({ command, args, options });

    const argsStr = args.join(" ");
    for (const [pattern, result] of this.execResults) {
      if (argsStr.includes(pattern)) {
        return result;
      }
    }

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
    options: ProcessOptions,
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

class MockProcessHandle implements ProcessHandle {
  pid = 12345;
  private stdoutCallbacks: ((data: string) => void)[] = [];
  private stderrCallbacks: ((data: string) => void)[] = [];
  private exitCallbacks: ((code: number) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];
  private exitCode = 0;
  private resolved = false;
  private stdout = "";
  private stderr = "";

  wait(): Promise<ProcessResult> {
    return new Promise((resolve) => {
      if (this.resolved) {
        resolve({
          exitCode: this.exitCode,
          stdout: this.stdout,
          stderr: this.stderr,
          durationMs: 100,
        });
      } else {
        this.exitCallbacks.push((code) => {
          resolve({
            exitCode: code,
            stdout: this.stdout,
            stderr: this.stderr,
            durationMs: 100,
          });
        });
      }
    });
  }

  write(_data: string): void {}

  closeStdin(): void {}

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

  emitStdout(data: string): void {
    this.stdout += data;
    this.stdoutCallbacks.forEach((cb) => cb(data));
  }

  emitStderr(data: string): void {
    this.stderr += data;
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

describe("CortexClient", () => {
  let mockRunner: MockProcessRunner;
  let client: CortexClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRunner = new MockProcessRunner();
    client = new CortexClient({
      runner: mockRunner,
      defaultModel: "test-model",
    });
  });

  afterEach(() => {
    mockRunner.reset();
  });

  describe("Client Instantiation", () => {
    it("should create client with default configuration", () => {
      const defaultClient = new CortexClient({ runner: mockRunner });
      expect(defaultClient).toBeInstanceOf(CortexClient);
    });

    it("should create client with custom configuration", () => {
      const customClient = new CortexClient({
        runner: mockRunner,
        defaultModel: "claude-sonnet-4-20250514",
        defaultAutonomy: AutonomyLevel.Medium,
        cwd: "/custom/path",
        verbose: true,
      });
      expect(customClient).toBeInstanceOf(CortexClient);
    });

    it("should create client using factory function", () => {
      const factoryClient = createClient({ runner: mockRunner });
      expect(factoryClient).toBeInstanceOf(CortexClient);
    });
  });

  describe("Version & Health", () => {
    it("should get CLI version", async () => {
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

    it("should check CLI availability", async () => {
      mockRunner.setExecResult("--version", {
        exitCode: 0,
        stdout: "cortex 1.0.0",
        stderr: "",
        durationMs: 50,
      });

      const available = await client.isAvailable();
      expect(available).toBe(true);
    });

    it("should return false when CLI unavailable", async () => {
      mockRunner.setExecResult("--version", {
        exitCode: 127,
        stdout: "",
        stderr: "command not found",
        durationMs: 50,
      });

      const available = await client.isAvailable();
      expect(available).toBe(false);
    });

    it("should get detailed version info", async () => {
      mockRunner.setExecResult("--version", {
        exitCode: 0,
        stdout: "cortex 0.2.0 (def5678 2024-06-15)",
        stderr: "",
        durationMs: 50,
      });

      const result = await client.getVersionInfo();
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe("cortex");
      expect(result.data?.version).toBe("0.2.0");
      expect(result.data?.gitHash).toBe("def5678");
      expect(result.data?.buildDate).toBe("2024-06-15");
    });

    it("should handle version info without git hash", async () => {
      mockRunner.setExecResult("--version", {
        exitCode: 0,
        stdout: "cortex 1.0.0",
        stderr: "",
        durationMs: 50,
      });

      const result = await client.getVersionInfo();
      expect(result.success).toBe(true);
      expect(result.data?.version).toBe("1.0.0");
    });
  });

  describe("Exec Command", () => {
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
        skipPermissions: true,
        images: ["/path/to/image.png"],
        maxTokens: 4096,
        specModel: "spec-model",
        cwd: "/custom/cwd",
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
      expect(args).toContain("--skip-permissions-unsafe");
      expect(args).toContain("--image");
      expect(args).toContain("--max-tokens");
      expect(args).toContain("--spec-model");
      expect(args).toContain("--cwd");
    });
  });

  describe("Exec JSON", () => {
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

  describe("Exec Stream", () => {
    it("should create stream handle", () => {
      const handle = client.execStream("Test prompt");
      expect(handle).toBeDefined();
      expect(typeof handle.wait).toBe("function");
      expect(typeof handle.abort).toBe("function");
    });

    it("should call onEvent callback", async () => {
      const mockHandle = new MockProcessHandle();
      mockRunner.setSpawnHandle("exec", mockHandle);

      const events: unknown[] = [];
      const handle = client.execStream("Test", {
        onEvent: (event) => events.push(event),
      });

      mockHandle.emitStdout('{"type":"task_started","data":{}}\n');
      mockHandle.emitExit(0);

      await handle.wait();

      expect(events).toHaveLength(1);
    });

    it("should handle stderr callback", async () => {
      const mockHandle = new MockProcessHandle();
      mockRunner.setSpawnHandle("exec", mockHandle);

      const stderrData: string[] = [];
      const handle = client.execStream("Test", {
        onStderr: (data) => stderrData.push(data),
      });

      mockHandle.emitStderr("Warning message");
      mockHandle.emitExit(0);

      await handle.wait();

      expect(stderrData).toContain("Warning message");
    });

    it("should support abort signal", async () => {
      const mockHandle = new MockProcessHandle();
      mockRunner.setSpawnHandle("exec", mockHandle);

      const controller = new AbortController();
      const handle = client.execStream("Test", {
        signal: controller.signal,
      });

      controller.abort();

      const result = await handle.wait();
      expect(result.exitCode).toBe(130);
    });
  });

  describe("Run Command", () => {
    it("should run prompt with options", async () => {
      mockRunner.setExecResult("run", {
        exitCode: 0,
        stdout: "Response from model",
        stderr: "",
        durationMs: 500,
      });

      const result = await client.run("Test prompt", {
        model: "custom-model",
        agent: "my-agent",
        files: ["/path/to/file.ts"],
        continue: true,
        noStreaming: true,
        webSearch: true,
        verbose: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe("Response from model");

      const args = mockRunner.execCalls[0].args;
      expect(args).toContain("run");
      expect(args).toContain("--model");
      expect(args).toContain("--agent");
      expect(args).toContain("--file");
      expect(args).toContain("--continue");
      expect(args).toContain("--no-streaming");
      expect(args).toContain("--search");
      expect(args).toContain("--verbose");
    });

    it("should run with JSON output", async () => {
      mockRunner.setExecResult("run", {
        exitCode: 0,
        stdout: JSON.stringify({
          type: "result",
          session_id: "sess-456",
          response: "JSON response",
        }),
        stderr: "",
        durationMs: 200,
      });

      const result = await client.runJson("Test");

      expect(result.success).toBe(true);
      expect(result.data?.response).toBe("JSON response");
    });
  });

  describe("Session Management", () => {
    it("should list sessions with options", async () => {
      mockRunner.setExecResult("sessions", {
        exitCode: 0,
        stdout: JSON.stringify({
          sessions: [{ id: "sess-1", title: "Test session" }],
          total: 1,
        }),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.listSessions({
        all: true,
        days: 7,
        limit: 10,
        search: "test",
        favorites: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.sessions).toHaveLength(1);
      expect(mockRunner.execCalls[0].args).toContain("--all");
      expect(mockRunner.execCalls[0].args).toContain("--days");
      expect(mockRunner.execCalls[0].args).toContain("--limit");
      expect(mockRunner.execCalls[0].args).toContain("--search");
      expect(mockRunner.execCalls[0].args).toContain("--favorites");
    });

    it("should resume session by ID", async () => {
      mockRunner.setExecResult("resume", {
        exitCode: 0,
        stdout: "Session resumed",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.resumeSession("sess-123");

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("resume");
      expect(mockRunner.execCalls[0].args).toContain("sess-123");
    });

    it("should resume last session", async () => {
      mockRunner.setExecResult("resume", {
        exitCode: 0,
        stdout: "Last session resumed",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.resumeLastSession();

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("--last");
    });

    it("should export session", async () => {
      mockRunner.setExecResult("export", {
        exitCode: 0,
        stdout: JSON.stringify({ id: "sess-123", messages: [] }),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.exportSession(
        "sess-123",
        "/output/path.json",
      );

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("export");
      expect(mockRunner.execCalls[0].args).toContain("--output");
    });

    it("should import session", async () => {
      mockRunner.setExecResult("import", {
        exitCode: 0,
        stdout: JSON.stringify({ id: "new-sess", title: "Imported" }),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.importSession("/path/to/session.json");

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("import");
    });

    it("should delete session", async () => {
      mockRunner.setExecResult("delete", {
        exitCode: 0,
        stdout: "Session deleted",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.deleteSession("sess-123", true);

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("delete");
      expect(mockRunner.execCalls[0].args).toContain("--yes");
      expect(mockRunner.execCalls[0].args).toContain("--force");
    });
  });

  describe("Models", () => {
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

    it("should get model info", async () => {
      mockRunner.setExecResult("models", {
        exitCode: 0,
        stdout: JSON.stringify({
          models: [{ id: "model-1", name: "Model One", provider: "anthropic" }],
        }),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.getModelInfo("model-1");

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe("model-1");
    });

    it("should return error for unknown model", async () => {
      mockRunner.setExecResult("models", {
        exitCode: 0,
        stdout: JSON.stringify({ models: [] }),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.getModelInfo("unknown-model");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Model not found");
    });
  });

  describe("Agents", () => {
    it("should list agents", async () => {
      mockRunner.setExecResult("agent", {
        exitCode: 0,
        stdout: JSON.stringify([
          { name: "agent-1", description: "Test agent" },
        ]),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.listAgents({ global: true });

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("agent");
      expect(mockRunner.execCalls[0].args).toContain("list");
      expect(mockRunner.execCalls[0].args).toContain("--global");
    });

    it("should get agent by name", async () => {
      mockRunner.setExecResult("agent", {
        exitCode: 0,
        stdout: JSON.stringify({
          name: "my-agent",
          description: "Description",
        }),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.getAgent("my-agent");

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("show");
      expect(mockRunner.execCalls[0].args).toContain("my-agent");
    });

    it("should create agent", async () => {
      mockRunner.setExecResult("agent", {
        exitCode: 0,
        stdout: "Agent created",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.createAgent("new-agent", {
        description: "New agent description",
        systemPrompt: "You are a helpful assistant",
        model: "claude-sonnet-4-20250514",
        global: true,
      });

      expect(result.success).toBe(true);
      const args = mockRunner.execCalls[0].args;
      expect(args).toContain("create");
      expect(args).toContain("new-agent");
      expect(args).toContain("--description");
      expect(args).toContain("--system");
      expect(args).toContain("--model");
      expect(args).toContain("--global");
    });
  });

  describe("MCP Servers", () => {
    it("should list MCP servers", async () => {
      mockRunner.setExecResult("mcp", {
        exitCode: 0,
        stdout: JSON.stringify([
          { name: "server-1", command: "node", args: ["server.js"] },
        ]),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.listMcpServers();

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("mcp");
      expect(mockRunner.execCalls[0].args).toContain("list");
    });

    it("should add MCP server", async () => {
      mockRunner.setExecResult("mcp", {
        exitCode: 0,
        stdout: "Server added",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.addMcpServer("my-server", "node", [
        "server.js",
        "--port",
        "3000",
      ]);

      expect(result.success).toBe(true);
      const args = mockRunner.execCalls[0].args;
      expect(args).toContain("mcp");
      expect(args).toContain("add");
      expect(args).toContain("my-server");
      expect(args).toContain("node");
    });

    it("should remove MCP server", async () => {
      mockRunner.setExecResult("mcp", {
        exitCode: 0,
        stdout: "Server removed",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.removeMcpServer("my-server");

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("remove");
      expect(mockRunner.execCalls[0].args).toContain("my-server");
    });
  });

  describe("Configuration", () => {
    it("should get config", async () => {
      mockRunner.setExecResult("config", {
        exitCode: 0,
        stdout: JSON.stringify({
          model: "default-model",
          provider: "anthropic",
        }),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.getConfig();

      expect(result.success).toBe(true);
      expect(result.data?.model).toBe("default-model");
    });

    it("should get config value", async () => {
      mockRunner.setExecResult("config", {
        exitCode: 0,
        stdout: "claude-sonnet-4-20250514",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.getConfigValue("model");

      expect(result.success).toBe(true);
      expect(result.data).toBe("claude-sonnet-4-20250514");
      expect(mockRunner.execCalls[0].args).toContain("get");
      expect(mockRunner.execCalls[0].args).toContain("model");
    });

    it("should set config value", async () => {
      mockRunner.setExecResult("config", {
        exitCode: 0,
        stdout: "Config updated",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.setConfigValue("model", "new-model");

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("set");
      expect(mockRunner.execCalls[0].args).toContain("model");
      expect(mockRunner.execCalls[0].args).toContain("new-model");
    });

    it("should unset config value", async () => {
      mockRunner.setExecResult("config", {
        exitCode: 0,
        stdout: "Config unset",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.unsetConfigValue("model");

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("unset");
      expect(mockRunner.execCalls[0].args).toContain("model");
    });
  });

  describe("Authentication", () => {
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

    it("should login with API key", async () => {
      mockRunner.setExecResult("login", {
        exitCode: 0,
        stdout: "Logged in successfully",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.loginWithApiKey("sk-test-key");

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("--with-api-key");
      expect(mockRunner.execCalls[0].options.stdin).toBe("sk-test-key");
    });

    it("should login with token", async () => {
      mockRunner.setExecResult("login", {
        exitCode: 0,
        stdout: "Logged in successfully",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.loginWithToken("test-token");

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("--token");
      expect(mockRunner.execCalls[0].args).toContain("test-token");
    });

    it("should logout", async () => {
      mockRunner.setExecResult("logout", {
        exitCode: 0,
        stdout: "Logged out",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.logout();

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("logout");
      expect(mockRunner.execCalls[0].args).toContain("--yes");
    });
  });

  describe("Utilities", () => {
    it("should scrape URL", async () => {
      mockRunner.setExecResult("scrape", {
        exitCode: 0,
        stdout: "# Page Title\n\nPage content",
        stderr: "",
        durationMs: 500,
      });

      const result = await client.scrape("https://example.com", "markdown");

      expect(result.success).toBe(true);
      expect(result.data).toContain("Page Title");
      expect(mockRunner.execCalls[0].args).toContain("scrape");
      expect(mockRunner.execCalls[0].args).toContain("--format");
      expect(mockRunner.execCalls[0].args).toContain("markdown");
    });

    it("should get stats", async () => {
      mockRunner.setExecResult("stats", {
        exitCode: 0,
        stdout: JSON.stringify({
          total_sessions: 100,
          total_tokens_used: 50000,
          total_cost: 5.5,
        }),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.getStats();

      expect(result.success).toBe(true);
      expect(result.data?.total_sessions).toBe(100);
      expect(result.data?.total_tokens_used).toBe(50000);
    });

    it("should initialize AGENTS.md", async () => {
      mockRunner.setExecResult("init", {
        exitCode: 0,
        stdout: "AGENTS.md created",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.init(true);

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("init");
      expect(mockRunner.execCalls[0].args).toContain("--yes");
      expect(mockRunner.execCalls[0].args).toContain("--force");
    });
  });

  describe("GitHub Integration", () => {
    it("should list GitHub workflows", async () => {
      mockRunner.setExecResult("github", {
        exitCode: 0,
        stdout: JSON.stringify([
          {
            id: 1,
            name: "CI",
            path: ".github/workflows/ci.yml",
            state: "active",
          },
        ]),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.listGitHubWorkflows();

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("github");
      expect(mockRunner.execCalls[0].args).toContain("workflows");
    });

    it("should get GitHub action logs", async () => {
      mockRunner.setExecResult("github", {
        exitCode: 0,
        stdout: "Build logs...",
        stderr: "",
        durationMs: 200,
      });

      const result = await client.getGitHubActionLogs("12345");

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("logs");
      expect(mockRunner.execCalls[0].args).toContain("12345");
    });

    it("should checkout pull request", async () => {
      mockRunner.setExecResult("pr", {
        exitCode: 0,
        stdout: "Checked out PR #42",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.checkoutPullRequest(42);

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("pr");
      expect(mockRunner.execCalls[0].args).toContain("checkout");
      expect(mockRunner.execCalls[0].args).toContain("42");
    });
  });

  describe("Debug & Diagnostics", () => {
    it("should run diagnostics", async () => {
      mockRunner.setExecResult("debug", {
        exitCode: 0,
        stdout: JSON.stringify({
          version: "1.0.0",
          platform: "linux",
          config_path: "/home/user/.config/cortex",
          data_path: "/home/user/.local/share/cortex",
          cache_path: "/home/user/.cache/cortex",
          issues: [],
        }),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.runDiagnostics();

      expect(result.success).toBe(true);
      expect(result.data?.version).toBe("1.0.0");
      expect(mockRunner.execCalls[0].args).toContain("diagnostics");
    });

    it("should get logs", async () => {
      mockRunner.setExecResult("logs", {
        exitCode: 0,
        stdout:
          "2024-01-01 12:00:00 INFO Starting...\n2024-01-01 12:00:01 INFO Ready",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.getLogs(50);

      expect(result.success).toBe(true);
      expect(mockRunner.execCalls[0].args).toContain("logs");
      expect(mockRunner.execCalls[0].args).toContain("--lines");
      expect(mockRunner.execCalls[0].args).toContain("50");
    });

    it("should clear cache", async () => {
      mockRunner.setExecResult("cache", {
        exitCode: 0,
        stdout: JSON.stringify({ cleared_bytes: 1024000, cleared_files: 50 }),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.clearCache();

      expect(result.success).toBe(true);
      expect(result.data?.cleared_bytes).toBe(1024000);
      expect(mockRunner.execCalls[0].args).toContain("cache");
      expect(mockRunner.execCalls[0].args).toContain("clear");
    });

    it("should get cache stats", async () => {
      mockRunner.setExecResult("cache", {
        exitCode: 0,
        stdout: JSON.stringify({
          total_bytes: 5000000,
          total_files: 100,
          breakdown: { sessions: 3000000, models: 2000000 },
        }),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.getCacheStats();

      expect(result.success).toBe(true);
      expect(result.data?.total_bytes).toBe(5000000);
      expect(mockRunner.execCalls[0].args).toContain("stats");
    });
  });

  describe("Raw Command Execution", () => {
    it("should execute raw command", async () => {
      mockRunner.setExecResult("custom", {
        exitCode: 0,
        stdout: "Custom output",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.rawExec(["custom", "arg1", "arg2"]);

      expect(result.success).toBe(true);
      expect(result.data).toBe("Custom output");
    });

    it("should execute raw command with JSON output", async () => {
      mockRunner.setExecResult("custom", {
        exitCode: 0,
        stdout: JSON.stringify({ custom: "data" }),
        stderr: "",
        durationMs: 100,
      });

      const result = await client.rawExecJson<{ custom: string }>(["custom"]);

      expect(result.success).toBe(true);
      expect(result.data?.custom).toBe("data");
    });

    it("should pass execution options", async () => {
      mockRunner.setExecResult("custom", {
        exitCode: 0,
        stdout: "",
        stderr: "",
        durationMs: 100,
      });

      await client.rawExec(["custom"], {
        cwd: "/custom/path",
        env: { CUSTOM_VAR: "value" },
        timeout: 5000,
      });

      expect(mockRunner.execCalls[0].options.cwd).toBe("/custom/path");
      expect(mockRunner.execCalls[0].options.env?.CUSTOM_VAR).toBe("value");
      expect(mockRunner.execCalls[0].options.timeout).toBe(5000);
    });
  });

  describe("Error Handling", () => {
    it("should handle CLI execution error", async () => {
      mockRunner.setExecResult("exec", {
        exitCode: 1,
        stdout: "",
        stderr: "Command failed: permission denied",
        durationMs: 100,
      });

      const result = await client.exec("Test");

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toContain("permission denied");
    });

    it("should handle timeout", async () => {
      mockRunner.setExecResult("exec", {
        exitCode: 124,
        stdout: "",
        stderr: "Operation timed out",
        timedOut: true,
        durationMs: 60000,
      });

      const result = await client.exec("Long running task", { timeout: 60 });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(124);
    });

    it("should handle JSON parse error gracefully", async () => {
      mockRunner.setExecResult("sessions", {
        exitCode: 0,
        stdout: "Invalid JSON {{{",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.listSessions();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to parse JSON");
    });

    it("should handle command not found", async () => {
      mockRunner.setExecResult("unknown", {
        exitCode: 127,
        stdout: "",
        stderr: "cortex: command not found",
        durationMs: 50,
      });

      const result = await client.rawExec(["unknown"]);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(127);
    });
  });

  describe("Response Parsing", () => {
    it("should parse version string with full info", async () => {
      mockRunner.setExecResult("--version", {
        exitCode: 0,
        stdout: "cortex 1.2.3-beta (abcdef12 2024-12-25)",
        stderr: "",
        durationMs: 50,
      });

      const result = await client.getVersionInfo();

      expect(result.data?.name).toBe("cortex");
      expect(result.data?.version).toBe("1.2.3-beta");
      expect(result.data?.gitHash).toBe("abcdef12");
      expect(result.data?.buildDate).toBe("2024-12-25");
    });

    it("should parse whoami response correctly", async () => {
      mockRunner.setExecResult("whoami", {
        exitCode: 0,
        stdout: "  john.doe@company.com  ",
        stderr: "",
        durationMs: 50,
      });

      const result = await client.whoami();

      expect(result.data?.loggedIn).toBe(true);
      expect(result.data?.username).toBe("john.doe@company.com");
    });

    it("should handle empty response", async () => {
      mockRunner.setExecResult("exec", {
        exitCode: 0,
        stdout: "",
        stderr: "",
        durationMs: 100,
      });

      const result = await client.exec("Test");

      expect(result.success).toBe(true);
      expect(result.data).toBe("");
    });
  });

  describe("IPC Calls", () => {
    it("should pass correct arguments for exec command", async () => {
      mockRunner.setExecResult("exec", {
        exitCode: 0,
        stdout: "Done",
        stderr: "",
        durationMs: 100,
      });

      await client.exec("Write hello world", {
        model: "gpt-4",
        autonomy: AutonomyLevel.Low,
      });

      const call = mockRunner.execCalls[0];
      expect(call.command).toBe("cortex");
      expect(call.args[0]).toBe("exec");
      expect(call.args).toContain("--model");
      expect(call.args).toContain("gpt-4");
      expect(call.args).toContain("--auto");
      expect(call.args).toContain("low");
      expect(call.args).toContain("--");
      expect(call.args).toContain("Write hello world");
    });

    it("should use default model from config", async () => {
      mockRunner.setExecResult("exec", {
        exitCode: 0,
        stdout: "Done",
        stderr: "",
        durationMs: 100,
      });

      await client.exec("Test");

      const call = mockRunner.execCalls[0];
      expect(call.args).toContain("test-model");
    });

    it("should override default model with option", async () => {
      mockRunner.setExecResult("exec", {
        exitCode: 0,
        stdout: "Done",
        stderr: "",
        durationMs: 100,
      });

      await client.exec("Test", { model: "override-model" });

      const call = mockRunner.execCalls[0];
      expect(call.args).toContain("override-model");
      expect(call.args).not.toContain("test-model");
    });
  });

  describe("Event Listeners", () => {
    it("should handle multiple event types", async () => {
      const mockHandle = new MockProcessHandle();
      mockRunner.setSpawnHandle("exec", mockHandle);

      const events: unknown[] = [];
      const handle = client.execStream("Test", {
        onEvent: (event) => events.push(event),
      });

      mockHandle.emitStdout(
        '{"type":"session_configured","data":{"session_id":"sess-1"}}\n',
      );
      mockHandle.emitStdout('{"type":"task_started","data":{}}\n');
      mockHandle.emitStdout(
        '{"type":"agent_message_delta","data":{"delta":"Hello"}}\n',
      );
      mockHandle.emitStdout('{"type":"task_complete","data":{}}\n');
      mockHandle.emitExit(0);

      await handle.wait();

      expect(events).toHaveLength(4);
    });

    it("should handle exit callback", async () => {
      const mockHandle = new MockProcessHandle();
      mockRunner.setSpawnHandle("exec", mockHandle);

      let exitCode = -1;
      const handle = client.execStream("Test", {
        onExit: (code) => {
          exitCode = code;
        },
      });

      mockHandle.emitExit(0);

      await handle.wait();

      expect(exitCode).toBe(0);
    });

    it("should handle error callback", async () => {
      const mockHandle = new MockProcessHandle();
      mockRunner.setSpawnHandle("exec", mockHandle);

      let errorMessage = "";
      const handle = client.execStream("Test", {
        onError: (error) => {
          errorMessage = error.message;
        },
      });

      mockHandle.emitError(new Error("Stream error"));
      mockHandle.emitExit(1);

      await handle.wait();

      expect(errorMessage).toBe("Stream error");
    });
  });
});
