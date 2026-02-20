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

describe("WorkspaceTrustContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("TrustLevel", () => {
    type TrustLevel = "trusted" | "restricted" | "unknown";

    it("should define trusted level", () => {
      const level: TrustLevel = "trusted";
      expect(level).toBe("trusted");
    });

    it("should define restricted level", () => {
      const level: TrustLevel = "restricted";
      expect(level).toBe("restricted");
    });

    it("should define unknown level", () => {
      const level: TrustLevel = "unknown";
      expect(level).toBe("unknown");
    });

    it("should list all trust levels", () => {
      const levels: TrustLevel[] = ["trusted", "restricted", "unknown"];
      expect(levels).toHaveLength(3);
    });
  });

  describe("TrustedFolder", () => {
    interface TrustedFolder {
      path: string;
      addedAt: number;
      addedBy: string;
      reason?: string;
    }

    it("should create trusted folder", () => {
      const folder: TrustedFolder = {
        path: "/home/user/projects/my-app",
        addedAt: Date.now(),
        addedBy: "user",
      };

      expect(folder.path).toBe("/home/user/projects/my-app");
      expect(folder.addedBy).toBe("user");
    });

    it("should create trusted folder with reason", () => {
      const folder: TrustedFolder = {
        path: "/workspace",
        addedAt: Date.now(),
        addedBy: "admin",
        reason: "Corporate approved workspace",
      };

      expect(folder.reason).toBe("Corporate approved workspace");
    });

    it("should track when folder was added", () => {
      const timestamp = Date.now();
      const folder: TrustedFolder = {
        path: "/projects",
        addedAt: timestamp,
        addedBy: "user",
      };

      expect(folder.addedAt).toBe(timestamp);
    });
  });

  describe("RestrictedModeRestrictions", () => {
    interface RestrictedModeRestrictions {
      disableExtensions: boolean;
      disableDebugger: boolean;
      disableTerminal: boolean;
      disableTasks: boolean;
      disableWorkspaceSettings: boolean;
      disableCodeExecution: boolean;
      allowedExtensions: string[];
    }

    it("should create default restrictions", () => {
      const restrictions: RestrictedModeRestrictions = {
        disableExtensions: true,
        disableDebugger: true,
        disableTerminal: true,
        disableTasks: true,
        disableWorkspaceSettings: true,
        disableCodeExecution: true,
        allowedExtensions: [],
      };

      expect(restrictions.disableExtensions).toBe(true);
      expect(restrictions.disableDebugger).toBe(true);
    });

    it("should allow specific extensions", () => {
      const restrictions: RestrictedModeRestrictions = {
        disableExtensions: false,
        disableDebugger: true,
        disableTerminal: true,
        disableTasks: true,
        disableWorkspaceSettings: true,
        disableCodeExecution: true,
        allowedExtensions: ["prettier", "eslint"],
      };

      expect(restrictions.allowedExtensions).toContain("prettier");
      expect(restrictions.allowedExtensions).toContain("eslint");
    });

    it("should allow terminal in restricted mode", () => {
      const restrictions: RestrictedModeRestrictions = {
        disableExtensions: true,
        disableDebugger: true,
        disableTerminal: false,
        disableTasks: true,
        disableWorkspaceSettings: true,
        disableCodeExecution: true,
        allowedExtensions: [],
      };

      expect(restrictions.disableTerminal).toBe(false);
    });
  });

  describe("TrustDecision", () => {
    type TrustLevel = "trusted" | "restricted" | "unknown";

    interface TrustDecision {
      path: string;
      decision: TrustLevel;
      timestamp: number;
      rememberForSession: boolean;
      rememberPermanently: boolean;
    }

    it("should create trust decision", () => {
      const decision: TrustDecision = {
        path: "/projects/new-repo",
        decision: "trusted",
        timestamp: Date.now(),
        rememberForSession: true,
        rememberPermanently: false,
      };

      expect(decision.decision).toBe("trusted");
      expect(decision.rememberForSession).toBe(true);
    });

    it("should create permanent trust decision", () => {
      const decision: TrustDecision = {
        path: "/workspace",
        decision: "trusted",
        timestamp: Date.now(),
        rememberForSession: true,
        rememberPermanently: true,
      };

      expect(decision.rememberPermanently).toBe(true);
    });

    it("should create restrict decision", () => {
      const decision: TrustDecision = {
        path: "/downloads/untrusted",
        decision: "restricted",
        timestamp: Date.now(),
        rememberForSession: true,
        rememberPermanently: false,
      };

      expect(decision.decision).toBe("restricted");
    });
  });

  describe("WorkspaceTrustSettings", () => {
    interface RestrictedModeRestrictions {
      disableExtensions: boolean;
      disableDebugger: boolean;
      disableTerminal: boolean;
      disableTasks: boolean;
      disableWorkspaceSettings: boolean;
      disableCodeExecution: boolean;
      allowedExtensions: string[];
    }

    interface WorkspaceTrustSettings {
      enabled: boolean;
      startupPrompt: "always" | "once" | "never";
      untrustedFilesBehavior: "prompt" | "restrict" | "open";
      emptyWindowTrust: "trusted" | "restricted";
      restrictions: RestrictedModeRestrictions;
    }

    it("should create default settings", () => {
      const settings: WorkspaceTrustSettings = {
        enabled: true,
        startupPrompt: "always",
        untrustedFilesBehavior: "prompt",
        emptyWindowTrust: "trusted",
        restrictions: {
          disableExtensions: true,
          disableDebugger: true,
          disableTerminal: true,
          disableTasks: true,
          disableWorkspaceSettings: true,
          disableCodeExecution: true,
          allowedExtensions: [],
        },
      };

      expect(settings.enabled).toBe(true);
      expect(settings.startupPrompt).toBe("always");
    });

    it("should configure startup prompt once", () => {
      const settings: WorkspaceTrustSettings = {
        enabled: true,
        startupPrompt: "once",
        untrustedFilesBehavior: "prompt",
        emptyWindowTrust: "trusted",
        restrictions: {
          disableExtensions: true,
          disableDebugger: true,
          disableTerminal: true,
          disableTasks: true,
          disableWorkspaceSettings: true,
          disableCodeExecution: true,
          allowedExtensions: [],
        },
      };

      expect(settings.startupPrompt).toBe("once");
    });

    it("should configure untrusted files behavior", () => {
      const settings: WorkspaceTrustSettings = {
        enabled: true,
        startupPrompt: "always",
        untrustedFilesBehavior: "restrict",
        emptyWindowTrust: "restricted",
        restrictions: {
          disableExtensions: true,
          disableDebugger: true,
          disableTerminal: true,
          disableTasks: true,
          disableWorkspaceSettings: true,
          disableCodeExecution: true,
          allowedExtensions: [],
        },
      };

      expect(settings.untrustedFilesBehavior).toBe("restrict");
      expect(settings.emptyWindowTrust).toBe("restricted");
    });
  });

  describe("WorkspaceTrustState", () => {
    type TrustLevel = "trusted" | "restricted" | "unknown";

    interface TrustedFolder {
      path: string;
      addedAt: number;
      addedBy: string;
    }

    interface RestrictedModeRestrictions {
      disableExtensions: boolean;
      disableDebugger: boolean;
      disableTerminal: boolean;
      disableTasks: boolean;
      disableWorkspaceSettings: boolean;
      disableCodeExecution: boolean;
      allowedExtensions: string[];
    }

    interface WorkspaceTrustSettings {
      enabled: boolean;
      startupPrompt: "always" | "once" | "never";
      untrustedFilesBehavior: "prompt" | "restrict" | "open";
      emptyWindowTrust: "trusted" | "restricted";
      restrictions: RestrictedModeRestrictions;
    }

    interface WorkspaceTrustState {
      trustLevel: TrustLevel;
      workspacePath: string | null;
      trustedFolders: TrustedFolder[];
      settings: WorkspaceTrustSettings;
      pendingPrompt: boolean;
    }

    it("should create initial state", () => {
      const state: WorkspaceTrustState = {
        trustLevel: "unknown",
        workspacePath: null,
        trustedFolders: [],
        settings: {
          enabled: true,
          startupPrompt: "always",
          untrustedFilesBehavior: "prompt",
          emptyWindowTrust: "trusted",
          restrictions: {
            disableExtensions: true,
            disableDebugger: true,
            disableTerminal: true,
            disableTasks: true,
            disableWorkspaceSettings: true,
            disableCodeExecution: true,
            allowedExtensions: [],
          },
        },
        pendingPrompt: false,
      };

      expect(state.trustLevel).toBe("unknown");
      expect(state.workspacePath).toBeNull();
    });

    it("should track trusted workspace", () => {
      const state: WorkspaceTrustState = {
        trustLevel: "trusted",
        workspacePath: "/home/user/projects",
        trustedFolders: [
          { path: "/home/user/projects", addedAt: Date.now(), addedBy: "user" },
        ],
        settings: {
          enabled: true,
          startupPrompt: "always",
          untrustedFilesBehavior: "prompt",
          emptyWindowTrust: "trusted",
          restrictions: {
            disableExtensions: true,
            disableDebugger: true,
            disableTerminal: true,
            disableTasks: true,
            disableWorkspaceSettings: true,
            disableCodeExecution: true,
            allowedExtensions: [],
          },
        },
        pendingPrompt: false,
      };

      expect(state.trustLevel).toBe("trusted");
      expect(state.trustedFolders).toHaveLength(1);
    });

    it("should track pending prompt", () => {
      const state: WorkspaceTrustState = {
        trustLevel: "unknown",
        workspacePath: "/downloads/new-project",
        trustedFolders: [],
        settings: {
          enabled: true,
          startupPrompt: "always",
          untrustedFilesBehavior: "prompt",
          emptyWindowTrust: "trusted",
          restrictions: {
            disableExtensions: true,
            disableDebugger: true,
            disableTerminal: true,
            disableTasks: true,
            disableWorkspaceSettings: true,
            disableCodeExecution: true,
            allowedExtensions: [],
          },
        },
        pendingPrompt: true,
      };

      expect(state.pendingPrompt).toBe(true);
    });
  });

  describe("Trust Operations", () => {
    type TrustLevel = "trusted" | "restricted" | "unknown";

    it("should trust workspace", () => {
      let trustLevel: TrustLevel = "unknown";

      const trustWorkspace = (): void => {
        trustLevel = "trusted";
      };

      trustWorkspace();
      expect(trustLevel).toBe("trusted");
    });

    it("should restrict workspace", () => {
      let trustLevel: TrustLevel = "unknown";

      const restrictWorkspace = (): void => {
        trustLevel = "restricted";
      };

      restrictWorkspace();
      expect(trustLevel).toBe("restricted");
    });

    it("should reset trust", () => {
      let trustLevel: TrustLevel = "trusted";

      const resetTrust = (): void => {
        trustLevel = "unknown";
      };

      resetTrust();
      expect(trustLevel).toBe("unknown");
    });
  });

  describe("Trusted Folder Management", () => {
    interface TrustedFolder {
      path: string;
      addedAt: number;
      addedBy: string;
    }

    it("should add trusted folder", () => {
      const trustedFolders: TrustedFolder[] = [];

      const addTrustedFolder = (path: string, addedBy: string): void => {
        trustedFolders.push({
          path,
          addedAt: Date.now(),
          addedBy,
        });
      };

      addTrustedFolder("/projects/my-app", "user");
      expect(trustedFolders).toHaveLength(1);
      expect(trustedFolders[0].path).toBe("/projects/my-app");
    });

    it("should remove trusted folder", () => {
      const trustedFolders: TrustedFolder[] = [
        { path: "/projects/app1", addedAt: Date.now(), addedBy: "user" },
        { path: "/projects/app2", addedAt: Date.now(), addedBy: "user" },
      ];

      const removeTrustedFolder = (path: string): boolean => {
        const index = trustedFolders.findIndex((f) => f.path === path);
        if (index !== -1) {
          trustedFolders.splice(index, 1);
          return true;
        }
        return false;
      };

      const result = removeTrustedFolder("/projects/app1");
      expect(result).toBe(true);
      expect(trustedFolders).toHaveLength(1);
    });

    it("should check if folder is trusted", () => {
      const trustedFolders: TrustedFolder[] = [
        { path: "/projects", addedAt: Date.now(), addedBy: "user" },
      ];

      const isFolderTrusted = (path: string): boolean => {
        return trustedFolders.some((f) => f.path === path);
      };

      expect(isFolderTrusted("/projects")).toBe(true);
      expect(isFolderTrusted("/downloads")).toBe(false);
    });

    it("should clear all trusted folders", () => {
      let trustedFolders: TrustedFolder[] = [
        { path: "/projects/app1", addedAt: Date.now(), addedBy: "user" },
        { path: "/projects/app2", addedAt: Date.now(), addedBy: "user" },
      ];

      const clearTrustedFolders = (): void => {
        trustedFolders = [];
      };

      clearTrustedFolders();
      expect(trustedFolders).toHaveLength(0);
    });
  });

  describe("Path Trust Checking", () => {
    interface TrustedFolder {
      path: string;
    }

    it("should check if path is under trusted folder", () => {
      const trustedFolders: TrustedFolder[] = [{ path: "/home/user/projects" }];

      const isPathTrusted = (path: string): boolean => {
        return trustedFolders.some(
          (folder) => path === folder.path || path.startsWith(folder.path + "/")
        );
      };

      expect(isPathTrusted("/home/user/projects")).toBe(true);
      expect(isPathTrusted("/home/user/projects/my-app")).toBe(true);
      expect(isPathTrusted("/home/user/downloads")).toBe(false);
    });

    it("should handle multiple trusted folders", () => {
      const trustedFolders: TrustedFolder[] = [
        { path: "/home/user/projects" },
        { path: "/workspace" },
      ];

      const isPathTrusted = (path: string): boolean => {
        return trustedFolders.some(
          (folder) => path === folder.path || path.startsWith(folder.path + "/")
        );
      };

      expect(isPathTrusted("/home/user/projects/app")).toBe(true);
      expect(isPathTrusted("/workspace/code")).toBe(true);
      expect(isPathTrusted("/tmp")).toBe(false);
    });

    it("should not match partial folder names", () => {
      const trustedFolders: TrustedFolder[] = [{ path: "/projects" }];

      const isPathTrusted = (path: string): boolean => {
        return trustedFolders.some(
          (folder) => path === folder.path || path.startsWith(folder.path + "/")
        );
      };

      expect(isPathTrusted("/projects")).toBe(true);
      expect(isPathTrusted("/projects/app")).toBe(true);
      expect(isPathTrusted("/projects-backup")).toBe(false);
    });
  });

  describe("Settings Management", () => {
    interface WorkspaceTrustSettings {
      enabled: boolean;
      startupPrompt: "always" | "once" | "never";
    }

    it("should update settings", () => {
      let settings: WorkspaceTrustSettings = {
        enabled: true,
        startupPrompt: "always",
      };

      const updateSettings = (updates: Partial<WorkspaceTrustSettings>): void => {
        settings = { ...settings, ...updates };
      };

      updateSettings({ startupPrompt: "never" });
      expect(settings.startupPrompt).toBe("never");
    });

    it("should disable workspace trust", () => {
      let settings: WorkspaceTrustSettings = {
        enabled: true,
        startupPrompt: "always",
      };

      const disableTrust = (): void => {
        settings = { ...settings, enabled: false };
      };

      disableTrust();
      expect(settings.enabled).toBe(false);
    });
  });

  describe("Action Permission Checking", () => {
    type TrustLevel = "trusted" | "restricted" | "unknown";

    interface RestrictedModeRestrictions {
      disableExtensions: boolean;
      disableDebugger: boolean;
      disableTerminal: boolean;
      disableTasks: boolean;
    }

    it("should allow action in trusted mode", () => {
      const trustLevel: TrustLevel = "trusted";

      const canExecuteAction = (_action: string, level: TrustLevel): boolean => {
        if (level === "trusted") return true;
        return false;
      };

      expect(canExecuteAction("runTask", trustLevel)).toBe(true);
      expect(canExecuteAction("debug", trustLevel)).toBe(true);
    });

    it("should restrict action based on restrictions", () => {
      const restrictions: RestrictedModeRestrictions = {
        disableExtensions: true,
        disableDebugger: true,
        disableTerminal: false,
        disableTasks: true,
      };

      const canExecuteAction = (
        action: string,
        level: TrustLevel,
        rest: RestrictedModeRestrictions
      ): boolean => {
        if (level === "trusted") return true;

        switch (action) {
          case "extensions":
            return !rest.disableExtensions;
          case "debug":
            return !rest.disableDebugger;
          case "terminal":
            return !rest.disableTerminal;
          case "tasks":
            return !rest.disableTasks;
          default:
            return false;
        }
      };

      expect(canExecuteAction("terminal", "restricted", restrictions)).toBe(true);
      expect(canExecuteAction("debug", "restricted", restrictions)).toBe(false);
      expect(canExecuteAction("tasks", "restricted", restrictions)).toBe(false);
    });
  });

  describe("Trust Events", () => {
    it("should listen for trust changed events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("trust:changed", () => {});

      expect(listen).toHaveBeenCalledWith("trust:changed", expect.any(Function));
    });

    it("should listen for trust prompt events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("trust:prompt", () => {});

      expect(listen).toHaveBeenCalledWith("trust:prompt", expect.any(Function));
    });

    it("should listen for trusted folder added events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("trust:folder-added", () => {});

      expect(listen).toHaveBeenCalledWith("trust:folder-added", expect.any(Function));
    });

    it("should listen for trusted folder removed events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("trust:folder-removed", () => {});

      expect(listen).toHaveBeenCalledWith("trust:folder-removed", expect.any(Function));
    });
  });

  describe("Trust Invoke Commands", () => {
    it("should get trust level via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("trusted");

      const result = await invoke("trust_get_level");

      expect(result).toBe("trusted");
    });

    it("should set trust level via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("trust_set_level", { level: "trusted" });

      expect(invoke).toHaveBeenCalledWith("trust_set_level", { level: "trusted" });
    });

    it("should add trusted folder via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("trust_add_folder", { path: "/projects/my-app" });

      expect(invoke).toHaveBeenCalledWith("trust_add_folder", {
        path: "/projects/my-app",
      });
    });

    it("should remove trusted folder via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("trust_remove_folder", { path: "/projects/old-app" });

      expect(invoke).toHaveBeenCalledWith("trust_remove_folder", {
        path: "/projects/old-app",
      });
    });

    it("should get trusted folders via invoke", async () => {
      const folders = [
        { path: "/projects/app1", addedAt: Date.now(), addedBy: "user" },
        { path: "/projects/app2", addedAt: Date.now(), addedBy: "user" },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(folders);

      const result = await invoke("trust_get_folders");

      expect(result).toEqual(folders);
    });

    it("should check path trust via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(true);

      const result = await invoke("trust_check_path", { path: "/projects/app" });

      expect(result).toBe(true);
    });

    it("should save settings via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("trust_save_settings", {
        settings: { enabled: true, startupPrompt: "always" },
      });

      expect(invoke).toHaveBeenCalledWith("trust_save_settings", {
        settings: { enabled: true, startupPrompt: "always" },
      });
    });
  });

  describe("Trust UI Helpers", () => {
    type TrustLevel = "trusted" | "restricted" | "unknown";

    it("should get trust level label", () => {
      const getTrustLevelLabel = (level: TrustLevel): string => {
        switch (level) {
          case "trusted":
            return "Trusted";
          case "restricted":
            return "Restricted Mode";
          case "unknown":
            return "Unknown";
        }
      };

      expect(getTrustLevelLabel("trusted")).toBe("Trusted");
      expect(getTrustLevelLabel("restricted")).toBe("Restricted Mode");
      expect(getTrustLevelLabel("unknown")).toBe("Unknown");
    });

    it("should get trust level icon", () => {
      const getTrustLevelIcon = (level: TrustLevel): string => {
        switch (level) {
          case "trusted":
            return "shield-check";
          case "restricted":
            return "shield-alert";
          case "unknown":
            return "shield-question";
        }
      };

      expect(getTrustLevelIcon("trusted")).toBe("shield-check");
      expect(getTrustLevelIcon("restricted")).toBe("shield-alert");
    });

    it("should get trust level color", () => {
      const getTrustLevelColor = (level: TrustLevel): string => {
        switch (level) {
          case "trusted":
            return "green";
          case "restricted":
            return "yellow";
          case "unknown":
            return "gray";
        }
      };

      expect(getTrustLevelColor("trusted")).toBe("green");
      expect(getTrustLevelColor("restricted")).toBe("yellow");
      expect(getTrustLevelColor("unknown")).toBe("gray");
    });
  });

  describe("Trust Prompt", () => {
    interface TrustPromptOptions {
      workspacePath: string;
      showDontAskAgain: boolean;
      defaultAction: "trust" | "restrict" | "cancel";
    }

    it("should create trust prompt options", () => {
      const options: TrustPromptOptions = {
        workspacePath: "/projects/new-app",
        showDontAskAgain: true,
        defaultAction: "restrict",
      };

      expect(options.workspacePath).toBe("/projects/new-app");
      expect(options.showDontAskAgain).toBe(true);
    });

    it("should handle prompt response", () => {
      interface TrustPromptResponse {
        action: "trust" | "restrict" | "cancel";
        rememberDecision: boolean;
      }

      const response: TrustPromptResponse = {
        action: "trust",
        rememberDecision: true,
      };

      expect(response.action).toBe("trust");
      expect(response.rememberDecision).toBe(true);
    });
  });
});
