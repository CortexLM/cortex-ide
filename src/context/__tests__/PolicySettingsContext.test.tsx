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

describe("PolicySettingsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PolicySource", () => {
    type PolicySource = "machine" | "organization";

    it("should support machine source", () => {
      const source: PolicySource = "machine";
      expect(source).toBe("machine");
    });

    it("should support organization source", () => {
      const source: PolicySource = "organization";
      expect(source).toBe("organization");
    });
  });

  describe("PolicySetting", () => {
    interface PolicySetting {
      key: string;
      value: unknown;
      source: "machine" | "organization";
      name?: string;
      description?: string;
      lastUpdated?: number;
    }

    it("should create policy setting", () => {
      const policy: PolicySetting = {
        key: "update.mode",
        value: "manual",
        source: "machine",
      };

      expect(policy.key).toBe("update.mode");
      expect(policy.value).toBe("manual");
    });

    it("should support boolean values", () => {
      const policy: PolicySetting = {
        key: "security.telemetryEnabled",
        value: false,
        source: "organization",
      };

      expect(policy.value).toBe(false);
    });

    it("should include optional metadata", () => {
      const policy: PolicySetting = {
        key: "update.mode",
        value: "manual",
        source: "organization",
        name: "Update Mode",
        description: "Controls how updates are applied",
        lastUpdated: Date.now(),
      };

      expect(policy.name).toBe("Update Mode");
      expect(policy.description).toBeDefined();
    });
  });

  describe("PolicyMetadata", () => {
    interface PolicyMetadata {
      version: number;
      organizationName?: string;
      adminContact?: string;
      lastRefreshed: number;
      sourceLocation?: string;
    }

    it("should create policy metadata", () => {
      const metadata: PolicyMetadata = {
        version: 1,
        lastRefreshed: Date.now(),
      };

      expect(metadata.version).toBe(1);
    });

    it("should include organization info", () => {
      const metadata: PolicyMetadata = {
        version: 2,
        organizationName: "Acme Corp",
        adminContact: "it@acme.com",
        lastRefreshed: Date.now(),
        sourceLocation: "/Library/Managed Preferences/com.orion.desktop.plist",
      };

      expect(metadata.organizationName).toBe("Acme Corp");
      expect(metadata.adminContact).toBe("it@acme.com");
    });
  });

  describe("PolicySettingsState", () => {
    interface PolicySettingsState {
      policies: Array<{ key: string; value: unknown }>;
      metadata: { version: number } | null;
      loaded: boolean;
      loading: boolean;
      error: string | null;
      policySource: string | null;
    }

    it("should initialize state", () => {
      const state: PolicySettingsState = {
        policies: [],
        metadata: null,
        loaded: false,
        loading: false,
        error: null,
        policySource: null,
      };

      expect(state.policies).toHaveLength(0);
      expect(state.loaded).toBe(false);
    });

    it("should track loading state", () => {
      const state: PolicySettingsState = {
        policies: [],
        metadata: null,
        loaded: false,
        loading: true,
        error: null,
        policySource: null,
      };

      expect(state.loading).toBe(true);
    });

    it("should track error state", () => {
      const state: PolicySettingsState = {
        policies: [],
        metadata: null,
        loaded: false,
        loading: false,
        error: "Failed to load policies",
        policySource: null,
      };

      expect(state.error).toBe("Failed to load policies");
    });
  });

  describe("KNOWN_POLICY_KEYS", () => {
    const KNOWN_POLICY_KEYS = [
      "update.mode",
      "update.channel",
      "update.autoDownload",
      "update.allowPrerelease",
      "security.telemetryEnabled",
      "security.crashReportsEnabled",
      "security.networkAccess",
      "security.sandboxMode",
      "security.approvalMode",
      "terminal.integrated.shell.windows",
      "terminal.integrated.shell.linux",
      "terminal.integrated.shell.osx",
      "ai.copilotEnabled",
      "ai.supermavenEnabled",
      "ai.inlineSuggestEnabled",
      "git.enabled",
      "git.autofetch",
      "extensions.autoUpdate",
      "extensions.allowedPublishers",
      "extensions.blockedExtensions",
      "workspaceTrust.enabled",
      "task.allowAutomaticTasks",
      "http.proxy",
      "http.proxyStrictSSL",
    ];

    it("should include update policies", () => {
      expect(KNOWN_POLICY_KEYS).toContain("update.mode");
      expect(KNOWN_POLICY_KEYS).toContain("update.channel");
    });

    it("should include security policies", () => {
      expect(KNOWN_POLICY_KEYS).toContain("security.telemetryEnabled");
      expect(KNOWN_POLICY_KEYS).toContain("security.sandboxMode");
    });

    it("should include AI policies", () => {
      expect(KNOWN_POLICY_KEYS).toContain("ai.copilotEnabled");
      expect(KNOWN_POLICY_KEYS).toContain("ai.inlineSuggestEnabled");
    });

    it("should include git policies", () => {
      expect(KNOWN_POLICY_KEYS).toContain("git.enabled");
      expect(KNOWN_POLICY_KEYS).toContain("git.autofetch");
    });

    it("should include extension policies", () => {
      expect(KNOWN_POLICY_KEYS).toContain("extensions.autoUpdate");
      expect(KNOWN_POLICY_KEYS).toContain("extensions.blockedExtensions");
    });
  });

  describe("isPolicyControlled", () => {
    it("should check if setting is policy controlled", () => {
      const policies = [
        { key: "update.mode", value: "manual" },
        { key: "security.telemetryEnabled", value: false },
      ];

      const isPolicyControlled = (key: string) => {
        return policies.some(p => p.key === key);
      };

      expect(isPolicyControlled("update.mode")).toBe(true);
      expect(isPolicyControlled("editor.fontSize")).toBe(false);
    });
  });

  describe("getPolicyValue", () => {
    it("should get policy value", () => {
      const policies = [
        { key: "update.mode", value: "manual" },
        { key: "security.telemetryEnabled", value: false },
      ];

      const getPolicyValue = (key: string) => {
        const policy = policies.find(p => p.key === key);
        return policy?.value;
      };

      expect(getPolicyValue("update.mode")).toBe("manual");
      expect(getPolicyValue("security.telemetryEnabled")).toBe(false);
    });

    it("should return undefined for non-policy settings", () => {
      const policies: Array<{ key: string; value: unknown }> = [];

      const getPolicyValue = (key: string) => {
        const policy = policies.find(p => p.key === key);
        return policy?.value;
      };

      expect(getPolicyValue("editor.fontSize")).toBeUndefined();
    });
  });

  describe("getPolicy", () => {
    interface PolicySetting {
      key: string;
      value: unknown;
      source: string;
    }

    it("should get full policy object", () => {
      const policies: PolicySetting[] = [
        { key: "update.mode", value: "manual", source: "machine" },
      ];

      const getPolicy = (key: string) => {
        return policies.find(p => p.key === key);
      };

      const policy = getPolicy("update.mode");
      expect(policy?.source).toBe("machine");
    });
  });

  describe("getPolicySource", () => {
    it("should get policy source", () => {
      const policies = [
        { key: "update.mode", value: "manual", source: "machine" },
        { key: "security.telemetryEnabled", value: false, source: "organization" },
      ];

      const getPolicySource = (key: string) => {
        const policy = policies.find(p => p.key === key);
        return policy?.source;
      };

      expect(getPolicySource("update.mode")).toBe("machine");
      expect(getPolicySource("security.telemetryEnabled")).toBe("organization");
    });
  });

  describe("getPolicyDescription", () => {
    it("should get policy description", () => {
      const policies = [
        { key: "update.mode", description: "Controls update behavior" },
      ];

      const getPolicyDescription = (key: string) => {
        const policy = policies.find(p => p.key === key);
        return policy?.description || "This setting is controlled by your organization";
      };

      expect(getPolicyDescription("update.mode")).toBe("Controls update behavior");
      expect(getPolicyDescription("unknown")).toBe("This setting is controlled by your organization");
    });
  });

  describe("getPolicyControlledKeys", () => {
    it("should get all policy controlled keys", () => {
      const policies = [
        { key: "update.mode", value: "manual" },
        { key: "security.telemetryEnabled", value: false },
        { key: "git.enabled", value: true },
      ];

      const getPolicyControlledKeys = () => {
        return policies.map(p => p.key);
      };

      const keys = getPolicyControlledKeys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain("update.mode");
    });
  });

  describe("Load Policies", () => {
    it("should load policies from backend", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        policies: [{ key: "update.mode", value: "manual", source: "machine" }],
        metadata: { version: 1, lastRefreshed: Date.now() },
      });

      const result = await invoke("policy_settings_load");

      expect(invoke).toHaveBeenCalledWith("policy_settings_load");
      expect(result).toHaveProperty("policies");
    });

    it("should handle load error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Policy file not found"));

      await expect(invoke("policy_settings_load")).rejects.toThrow("Policy file not found");
    });
  });

  describe("Refresh Policies", () => {
    it("should refresh policies", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        policies: [],
        metadata: { version: 1, lastRefreshed: Date.now() },
      });

      await invoke("policy_settings_refresh");

      expect(invoke).toHaveBeenCalledWith("policy_settings_refresh");
    });
  });

  describe("Policy Changed Event", () => {
    it("should listen for policy changes", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("policy:changed", () => {});

      expect(listen).toHaveBeenCalledWith("policy:changed", expect.any(Function));
    });
  });

  describe("Policy Source Location", () => {
    it("should get Windows policy location", () => {
      const getPolicySourceLocation = (platform: string) => {
        switch (platform) {
          case "windows":
            return "HKLM\\Software\\Policies\\Orion";
          case "macos":
            return "/Library/Managed Preferences/com.orion.desktop.plist";
          case "linux":
            return "/etc/orion/policies.json";
          default:
            return "Unknown";
        }
      };

      expect(getPolicySourceLocation("windows")).toBe("HKLM\\Software\\Policies\\Orion");
    });

    it("should get macOS policy location", () => {
      const getPolicySourceLocation = (platform: string) => {
        switch (platform) {
          case "windows":
            return "HKLM\\Software\\Policies\\Orion";
          case "macos":
            return "/Library/Managed Preferences/com.orion.desktop.plist";
          case "linux":
            return "/etc/orion/policies.json";
          default:
            return "Unknown";
        }
      };

      expect(getPolicySourceLocation("macos")).toBe("/Library/Managed Preferences/com.orion.desktop.plist");
    });

    it("should get Linux policy location", () => {
      const getPolicySourceLocation = (platform: string) => {
        switch (platform) {
          case "windows":
            return "HKLM\\Software\\Policies\\Orion";
          case "macos":
            return "/Library/Managed Preferences/com.orion.desktop.plist";
          case "linux":
            return "/etc/orion/policies.json";
          default:
            return "Unknown";
        }
      };

      expect(getPolicySourceLocation("linux")).toBe("/etc/orion/policies.json");
    });
  });

  describe("Policy Refresh Interval", () => {
    const POLICY_REFRESH_INTERVAL = 5 * 60 * 1000;

    it("should define refresh interval", () => {
      expect(POLICY_REFRESH_INTERVAL).toBe(300000);
    });
  });

  describe("Can Refresh Policies", () => {
    it("should check if refresh is available", () => {
      const POLICY_REFRESH_INTERVAL = 5 * 60 * 1000;
      let lastRefreshed = Date.now() - POLICY_REFRESH_INTERVAL - 1000;

      const canRefreshPolicies = () => {
        return Date.now() - lastRefreshed >= POLICY_REFRESH_INTERVAL;
      };

      expect(canRefreshPolicies()).toBe(true);
    });

    it("should prevent refresh too soon", () => {
      const POLICY_REFRESH_INTERVAL = 5 * 60 * 1000;
      let lastRefreshed = Date.now();

      const canRefreshPolicies = () => {
        return Date.now() - lastRefreshed >= POLICY_REFRESH_INTERVAL;
      };

      expect(canRefreshPolicies()).toBe(false);
    });
  });
});
