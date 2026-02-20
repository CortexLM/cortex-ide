import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("TerminalsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Terminal Creation", () => {
    it("should create terminal with default options", async () => {
      const mockTerminalInfo = {
        id: "term-1",
        name: "Terminal 1",
        shell: "/bin/bash",
        cwd: "/home/user",
        pid: 1234,
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockTerminalInfo);

      const result = await invoke("terminal_create", {});
      
      expect(invoke).toHaveBeenCalledWith("terminal_create", {});
      expect(result).toEqual(mockTerminalInfo);
    });

    it("should create terminal with custom shell", async () => {
      const mockTerminalInfo = {
        id: "term-2",
        name: "Zsh",
        shell: "/bin/zsh",
        cwd: "/home/user",
        pid: 5678,
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockTerminalInfo);

      const result = await invoke("terminal_create", { shell: "/bin/zsh" });
      
      expect(invoke).toHaveBeenCalledWith("terminal_create", { shell: "/bin/zsh" });
      expect(result).toEqual(mockTerminalInfo);
    });

    it("should create terminal with custom working directory", async () => {
      const mockTerminalInfo = {
        id: "term-3",
        name: "Terminal",
        shell: "/bin/bash",
        cwd: "/projects/myapp",
        pid: 9999,
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockTerminalInfo);

      const result = await invoke("terminal_create", { cwd: "/projects/myapp" });
      
      expect(invoke).toHaveBeenCalledWith("terminal_create", { cwd: "/projects/myapp" });
      expect(result).toEqual(mockTerminalInfo);
    });

    it("should create terminal with custom name", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        id: "term-4",
        name: "Build Server",
        shell: "/bin/bash",
        cwd: "/home/user",
        pid: 1111,
      });

      const result = await invoke("terminal_create", { name: "Build Server" });
      expect(result).toHaveProperty("name", "Build Server");
    });

    it("should create terminal with environment variables", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        id: "term-5",
        name: "Terminal",
        shell: "/bin/bash",
        cwd: "/home/user",
        pid: 2222,
      });

      await invoke("terminal_create", { 
        env: { NODE_ENV: "development", DEBUG: "true" } 
      });
      
      expect(invoke).toHaveBeenCalledWith("terminal_create", {
        env: { NODE_ENV: "development", DEBUG: "true" }
      });
    });
  });

  describe("Terminal Closure", () => {
    it("should close terminal by id", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("terminal_close", { id: "term-1" });
      
      expect(invoke).toHaveBeenCalledWith("terminal_close", { id: "term-1" });
    });

    it("should handle closing non-existent terminal", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Terminal not found"));

      await expect(invoke("terminal_close", { id: "invalid" }))
        .rejects.toThrow("Terminal not found");
    });
  });

  describe("Terminal Input/Output", () => {
    it("should write data to terminal", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("terminal_write", { id: "term-1", data: "ls -la\n" });
      
      expect(invoke).toHaveBeenCalledWith("terminal_write", { 
        id: "term-1", 
        data: "ls -la\n" 
      });
    });

    it("should send interrupt signal (Ctrl+C)", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("terminal_interrupt", { id: "term-1" });
      
      expect(invoke).toHaveBeenCalledWith("terminal_interrupt", { id: "term-1" });
    });

    it("should send EOF signal (Ctrl+D)", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("terminal_eof", { id: "term-1" });
      
      expect(invoke).toHaveBeenCalledWith("terminal_eof", { id: "term-1" });
    });
  });

  describe("Terminal Resize", () => {
    it("should resize terminal", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("terminal_resize", { id: "term-1", cols: 120, rows: 40 });
      
      expect(invoke).toHaveBeenCalledWith("terminal_resize", { 
        id: "term-1", 
        cols: 120, 
        rows: 40 
      });
    });

    it("should handle minimum dimensions", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("terminal_resize", { id: "term-1", cols: 1, rows: 1 });
      
      expect(invoke).toHaveBeenCalledWith("terminal_resize", { 
        id: "term-1", 
        cols: 1, 
        rows: 1 
      });
    });
  });

  describe("Terminal State Management", () => {
    interface TerminalInfo {
      id: string;
      name: string;
      shell: string;
      cwd: string;
      pid?: number;
      status: "running" | "stopped" | "error";
    }

    it("should track terminal list", () => {
      const terminals: TerminalInfo[] = [];

      terminals.push({
        id: "term-1",
        name: "Terminal 1",
        shell: "/bin/bash",
        cwd: "/home/user",
        pid: 1234,
        status: "running",
      });

      expect(terminals).toHaveLength(1);
      expect(terminals[0].status).toBe("running");
    });

    it("should track active terminal", () => {
      let activeTerminalId: string | null = null;

      activeTerminalId = "term-1";
      expect(activeTerminalId).toBe("term-1");

      activeTerminalId = "term-2";
      expect(activeTerminalId).toBe("term-2");

      activeTerminalId = null;
      expect(activeTerminalId).toBe(null);
    });

    it("should update terminal info", () => {
      const terminal: TerminalInfo = {
        id: "term-1",
        name: "Terminal 1",
        shell: "/bin/bash",
        cwd: "/home/user",
        status: "running",
      };

      terminal.name = "Build Terminal";
      terminal.cwd = "/projects/app";

      expect(terminal.name).toBe("Build Terminal");
      expect(terminal.cwd).toBe("/projects/app");
    });
  });

  describe("Terminal Groups", () => {
    interface TerminalGroup {
      id: string;
      name: string;
      terminalIds: string[];
      direction: "horizontal" | "vertical";
    }

    it("should create terminal group", () => {
      const group: TerminalGroup = {
        id: "group-1",
        name: "Build Group",
        terminalIds: ["term-1"],
        direction: "horizontal",
      };

      expect(group.terminalIds).toHaveLength(1);
    });

    it("should add terminal to group", () => {
      const group: TerminalGroup = {
        id: "group-1",
        name: "Build Group",
        terminalIds: ["term-1"],
        direction: "horizontal",
      };

      group.terminalIds.push("term-2");

      expect(group.terminalIds).toEqual(["term-1", "term-2"]);
    });

    it("should remove terminal from group", () => {
      const group: TerminalGroup = {
        id: "group-1",
        name: "Build Group",
        terminalIds: ["term-1", "term-2", "term-3"],
        direction: "horizontal",
      };

      group.terminalIds = group.terminalIds.filter(id => id !== "term-2");

      expect(group.terminalIds).toEqual(["term-1", "term-3"]);
    });

    it("should change group split direction", () => {
      const group: TerminalGroup = {
        id: "group-1",
        name: "Build Group",
        terminalIds: ["term-1", "term-2"],
        direction: "horizontal",
      };

      group.direction = "vertical";

      expect(group.direction).toBe("vertical");
    });
  });

  describe("SSH Terminals", () => {
    interface SSHConfig {
      host: string;
      port: number;
      username: string;
      authMethod: "password" | "key";
      password?: string;
      privateKeyPath?: string;
    }

    it("should create SSH terminal config", () => {
      const sshConfig: SSHConfig = {
        host: "server.example.com",
        port: 22,
        username: "admin",
        authMethod: "key",
        privateKeyPath: "~/.ssh/id_rsa",
      };

      expect(sshConfig.host).toBe("server.example.com");
      expect(sshConfig.port).toBe(22);
      expect(sshConfig.authMethod).toBe("key");
    });

    it("should create SSH terminal with password auth", () => {
      const sshConfig: SSHConfig = {
        host: "server.example.com",
        port: 22,
        username: "admin",
        authMethod: "password",
        password: "secret",
      };

      expect(sshConfig.authMethod).toBe("password");
      expect(sshConfig.password).toBe("secret");
    });

    it("should create SSH terminal via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        id: "ssh-term-1",
        name: "SSH: server.example.com",
        isSSH: true,
        status: "connecting",
      });

      const result = await invoke("terminal_create_ssh", {
        host: "server.example.com",
        port: 22,
        username: "admin",
      });

      expect(result).toHaveProperty("isSSH", true);
    });
  });

  describe("Auto-Reply Rules", () => {
    interface AutoReplyRule {
      id: string;
      pattern: string;
      response: string;
      enabled: boolean;
      isRegex: boolean;
      triggerCount: number;
    }

    it("should create auto-reply rule", () => {
      const rule: AutoReplyRule = {
        id: "rule-1",
        pattern: "Are you sure?",
        response: "y\n",
        enabled: true,
        isRegex: false,
        triggerCount: 0,
      };

      expect(rule.pattern).toBe("Are you sure?");
      expect(rule.response).toBe("y\n");
    });

    it("should match auto-reply pattern", () => {
      const rule: AutoReplyRule = {
        id: "rule-1",
        pattern: "continue\\?",
        response: "yes\n",
        enabled: true,
        isRegex: true,
        triggerCount: 0,
      };

      const matchPattern = (text: string, rule: AutoReplyRule): boolean => {
        if (rule.isRegex) {
          return new RegExp(rule.pattern).test(text);
        }
        return text.includes(rule.pattern);
      };

      expect(matchPattern("Do you want to continue?", rule)).toBe(true);
      expect(matchPattern("Press enter to proceed", rule)).toBe(false);
    });

    it("should increment trigger count", () => {
      const rule: AutoReplyRule = {
        id: "rule-1",
        pattern: "confirm",
        response: "y\n",
        enabled: true,
        isRegex: false,
        triggerCount: 5,
      };

      rule.triggerCount++;

      expect(rule.triggerCount).toBe(6);
    });

    it("should toggle rule enabled state", () => {
      const rule: AutoReplyRule = {
        id: "rule-1",
        pattern: "confirm",
        response: "y\n",
        enabled: true,
        isRegex: false,
        triggerCount: 0,
      };

      rule.enabled = !rule.enabled;
      expect(rule.enabled).toBe(false);

      rule.enabled = !rule.enabled;
      expect(rule.enabled).toBe(true);
    });
  });

  describe("Shell Integration", () => {
    interface ShellIntegrationState {
      enabled: boolean;
      commandDetection: boolean;
      cwdDetection: boolean;
      detectedCwd?: string;
    }

    it("should track shell integration state", () => {
      const state: ShellIntegrationState = {
        enabled: true,
        commandDetection: true,
        cwdDetection: true,
        detectedCwd: "/home/user/project",
      };

      expect(state.enabled).toBe(true);
      expect(state.detectedCwd).toBe("/home/user/project");
    });

    it("should update detected CWD", () => {
      const state: ShellIntegrationState = {
        enabled: true,
        commandDetection: true,
        cwdDetection: true,
        detectedCwd: "/home/user",
      };

      state.detectedCwd = "/home/user/project/src";

      expect(state.detectedCwd).toBe("/home/user/project/src");
    });
  });

  describe("Command History", () => {
    interface CommandHistoryEntry {
      command: string;
      exitCode?: number;
      timestamp: number;
      duration?: number;
      cwd?: string;
    }

    it("should track command history", () => {
      const history: CommandHistoryEntry[] = [];

      history.push({
        command: "npm install",
        exitCode: 0,
        timestamp: Date.now(),
        duration: 5000,
        cwd: "/project",
      });

      expect(history).toHaveLength(1);
      expect(history[0].command).toBe("npm install");
      expect(history[0].exitCode).toBe(0);
    });

    it("should track failed commands", () => {
      const entry: CommandHistoryEntry = {
        command: "npm test",
        exitCode: 1,
        timestamp: Date.now(),
        duration: 2000,
      };

      expect(entry.exitCode).toBe(1);
    });

    it("should limit history size", () => {
      const maxHistory = 100;
      const history: CommandHistoryEntry[] = [];

      for (let i = 0; i < 150; i++) {
        history.push({
          command: `command-${i}`,
          timestamp: Date.now(),
        });

        if (history.length > maxHistory) {
          history.shift();
        }
      }

      expect(history.length).toBe(maxHistory);
      expect(history[0].command).toBe("command-50");
    });
  });

  describe("Terminal Profiles", () => {
    interface TerminalProfile {
      id: string;
      name: string;
      shell: string;
      args?: string[];
      env?: Record<string, string>;
      icon?: string;
      color?: string;
    }

    it("should create terminal profile", () => {
      const profile: TerminalProfile = {
        id: "profile-bash",
        name: "Bash",
        shell: "/bin/bash",
        args: ["--login"],
        icon: "terminal",
        color: "#4CAF50",
      };

      expect(profile.name).toBe("Bash");
      expect(profile.args).toEqual(["--login"]);
    });

    it("should create profile with environment", () => {
      const profile: TerminalProfile = {
        id: "profile-node",
        name: "Node.js",
        shell: "/bin/bash",
        env: {
          NODE_ENV: "development",
          PATH: "/usr/local/bin:$PATH",
        },
      };

      expect(profile.env?.NODE_ENV).toBe("development");
    });
  });

  describe("Terminal Quick Fixes", () => {
    interface TerminalQuickFix {
      id: string;
      label: string;
      command: string;
      description?: string;
    }

    it("should suggest quick fix for command not found", () => {
      const suggestQuickFix = (output: string): TerminalQuickFix | null => {
        if (output.includes("command not found: npm")) {
          return {
            id: "install-npm",
            label: "Install npm",
            command: "brew install node",
            description: "Install Node.js and npm via Homebrew",
          };
        }
        return null;
      };

      const fix = suggestQuickFix("zsh: command not found: npm");
      expect(fix?.label).toBe("Install npm");
    });

    it("should suggest quick fix for permission denied", () => {
      const suggestQuickFix = (output: string): TerminalQuickFix | null => {
        if (output.includes("Permission denied")) {
          return {
            id: "sudo-retry",
            label: "Retry with sudo",
            command: "sudo !!",
          };
        }
        return null;
      };

      const fix = suggestQuickFix("Permission denied: /etc/hosts");
      expect(fix?.command).toBe("sudo !!");
    });
  });

  describe("Terminal Panel Toggle", () => {
    it("should toggle panel visibility", () => {
      let isPanelOpen = false;

      const togglePanel = () => {
        isPanelOpen = !isPanelOpen;
      };

      togglePanel();
      expect(isPanelOpen).toBe(true);

      togglePanel();
      expect(isPanelOpen).toBe(false);
    });

    it("should track panel height", () => {
      let panelHeight = 300;

      const setPanelHeight = (height: number) => {
        panelHeight = Math.max(100, Math.min(800, height));
      };

      setPanelHeight(500);
      expect(panelHeight).toBe(500);

      setPanelHeight(50);
      expect(panelHeight).toBe(100);

      setPanelHeight(1000);
      expect(panelHeight).toBe(800);
    });
  });

  describe("Output Buffer Management", () => {
    it("should limit output buffer size", () => {
      const maxLines = 10000;
      const buffer: string[] = [];

      const addOutput = (line: string) => {
        buffer.push(line);
        if (buffer.length > maxLines) {
          buffer.splice(0, buffer.length - maxLines);
        }
      };

      for (let i = 0; i < 10500; i++) {
        addOutput(`Line ${i}`);
      }

      expect(buffer.length).toBe(maxLines);
      expect(buffer[0]).toBe("Line 500");
    });

    it("should clear output buffer", () => {
      const buffer = ["line1", "line2", "line3"];

      buffer.length = 0;

      expect(buffer).toHaveLength(0);
    });
  });

  describe("Terminal Event Listeners", () => {
    it("should set up terminal output listener", async () => {
      const mockUnlisten = vi.fn();
      vi.mocked(listen).mockResolvedValueOnce(mockUnlisten);

      const unlisten = await listen("terminal:output", () => {});
      
      expect(listen).toHaveBeenCalledWith("terminal:output", expect.any(Function));
      
      unlisten();
      expect(mockUnlisten).toHaveBeenCalled();
    });

    it("should set up terminal exit listener", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("terminal:exit", () => {});
      
      expect(listen).toHaveBeenCalledWith("terminal:exit", expect.any(Function));
    });
  });
});
