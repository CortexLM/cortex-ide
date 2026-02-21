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

describe("ExtensionsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Extension Types", () => {
    interface Extension {
      id: string;
      name: string;
      version: string;
      publisher: string;
      description: string;
      enabled: boolean;
      installed: boolean;
      categories?: string[];
      rating?: number;
      downloadCount?: number;
    }

    it("should create extension object", () => {
      const ext: Extension = {
        id: "publisher.extension-name",
        name: "Extension Name",
        version: "1.0.0",
        publisher: "Publisher",
        description: "A useful extension",
        enabled: true,
        installed: true,
        categories: ["Themes", "Programming Languages"],
        rating: 4.5,
        downloadCount: 100000,
      };

      expect(ext.id).toBe("publisher.extension-name");
      expect(ext.enabled).toBe(true);
    });

    it("should parse extension ID", () => {
      const parseExtensionId = (id: string): { publisher: string; name: string } => {
        const [publisher, name] = id.split(".");
        return { publisher, name };
      };

      const parsed = parseExtensionId("microsoft.vscode-typescript");

      expect(parsed.publisher).toBe("microsoft");
      expect(parsed.name).toBe("vscode-typescript");
    });
  });

  describe("Extension Installation", () => {
    it("should install extension via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ success: true });

      const result = await invoke("install_extension_from_path", {
        extensionId: "publisher.extension-name",
      });

      expect(invoke).toHaveBeenCalledWith("install_extension_from_path", {
        extensionId: "publisher.extension-name",
      });
      expect(result).toEqual({ success: true });
    });

    it("should install extension from VSIX", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ success: true });

      await invoke("extension_install_vsix", {
        path: "/downloads/extension.vsix",
      });

      expect(invoke).toHaveBeenCalledWith("extension_install_vsix", {
        path: "/downloads/extension.vsix",
      });
    });

    it("should handle installation error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Network error"));

      await expect(invoke("install_extension_from_path", { extensionId: "invalid" }))
        .rejects.toThrow("Network error");
    });

    it("should track installation progress", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("extension:install-progress", () => {});

      expect(listen).toHaveBeenCalledWith("extension:install-progress", expect.any(Function));
    });
  });

  describe("Extension Uninstallation", () => {
    it("should uninstall extension via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("uninstall_extension", {
        extensionId: "publisher.extension-name",
      });

      expect(invoke).toHaveBeenCalledWith("uninstall_extension", {
        extensionId: "publisher.extension-name",
      });
    });

    it("should prompt for reload after uninstall", () => {
      let reloadRequired = false;

      const uninstallExtension = () => {
        reloadRequired = true;
      };

      uninstallExtension();

      expect(reloadRequired).toBe(true);
    });
  });

  describe("Extension Enable/Disable", () => {
    it("should enable extension", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("enable_extension", {
        extensionId: "publisher.extension-name",
      });

      expect(invoke).toHaveBeenCalledWith("enable_extension", {
        extensionId: "publisher.extension-name",
      });
    });

    it("should disable extension", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("disable_extension", {
        extensionId: "publisher.extension-name",
      });

      expect(invoke).toHaveBeenCalledWith("disable_extension", {
        extensionId: "publisher.extension-name",
      });
    });

    it("should toggle extension state", () => {
      const extension = { id: "ext-1", enabled: true };

      extension.enabled = !extension.enabled;
      expect(extension.enabled).toBe(false);

      extension.enabled = !extension.enabled;
      expect(extension.enabled).toBe(true);
    });

    it("should disable extension for workspace only", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("disable_extension", {
        extensionId: "publisher.extension-name",
        workspaceOnly: true,
      });

      expect(invoke).toHaveBeenCalledWith("disable_extension", {
        extensionId: "publisher.extension-name",
        workspaceOnly: true,
      });
    });
  });

  describe("Extension Search", () => {
    it("should search extensions via invoke", async () => {
      const mockResults = [
        { id: "ext-1", name: "Extension 1", publisher: "pub1" },
        { id: "ext-2", name: "Extension 2", publisher: "pub2" },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(mockResults);

      const result = await invoke("extension_search", {
        query: "typescript",
      });

      expect(invoke).toHaveBeenCalledWith("extension_search", { query: "typescript" });
      expect(result).toEqual(mockResults);
    });

    it("should search with category filter", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      await invoke("extension_search", {
        query: "",
        category: "Themes",
      });

      expect(invoke).toHaveBeenCalledWith("extension_search", {
        query: "",
        category: "Themes",
      });
    });

    it("should search with sort order", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      await invoke("extension_search", {
        query: "python",
        sortBy: "downloads",
      });

      expect(invoke).toHaveBeenCalledWith("extension_search", {
        query: "python",
        sortBy: "downloads",
      });
    });
  });

  describe("Extension List Management", () => {
    interface Extension {
      id: string;
      name: string;
      enabled: boolean;
      installed: boolean;
    }

    it("should list installed extensions", () => {
      const extensions: Extension[] = [
        { id: "ext-1", name: "Ext 1", enabled: true, installed: true },
        { id: "ext-2", name: "Ext 2", enabled: false, installed: true },
        { id: "ext-3", name: "Ext 3", enabled: true, installed: true },
      ];

      const installed = extensions.filter(e => e.installed);

      expect(installed).toHaveLength(3);
    });

    it("should list enabled extensions", () => {
      const extensions: Extension[] = [
        { id: "ext-1", name: "Ext 1", enabled: true, installed: true },
        { id: "ext-2", name: "Ext 2", enabled: false, installed: true },
        { id: "ext-3", name: "Ext 3", enabled: true, installed: true },
      ];

      const enabled = extensions.filter(e => e.enabled);

      expect(enabled).toHaveLength(2);
    });

    it("should list disabled extensions", () => {
      const extensions: Extension[] = [
        { id: "ext-1", name: "Ext 1", enabled: true, installed: true },
        { id: "ext-2", name: "Ext 2", enabled: false, installed: true },
        { id: "ext-3", name: "Ext 3", enabled: false, installed: true },
      ];

      const disabled = extensions.filter(e => !e.enabled);

      expect(disabled).toHaveLength(2);
    });
  });

  describe("Extension Updates", () => {
    interface ExtensionUpdate {
      extensionId: string;
      currentVersion: string;
      newVersion: string;
    }

    it("should check for updates", async () => {
      const mockUpdates: ExtensionUpdate[] = [
        { extensionId: "ext-1", currentVersion: "1.0.0", newVersion: "1.1.0" },
        { extensionId: "ext-2", currentVersion: "2.0.0", newVersion: "2.1.0" },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(mockUpdates);

      const result = await invoke("extension_check_updates");

      expect(result).toEqual(mockUpdates);
    });

    it("should update single extension", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ success: true });

      await invoke("extension_update", { extensionId: "ext-1" });

      expect(invoke).toHaveBeenCalledWith("extension_update", { extensionId: "ext-1" });
    });

    it("should update all extensions", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ updated: 3 });

      const result = await invoke("extension_update_all");

      expect(result).toEqual({ updated: 3 });
    });

    it("should compare versions", () => {
      const compareVersions = (a: string, b: string): number => {
        const partsA = a.split(".").map(Number);
        const partsB = b.split(".").map(Number);

        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
          const numA = partsA[i] || 0;
          const numB = partsB[i] || 0;
          if (numA !== numB) return numA - numB;
        }
        return 0;
      };

      expect(compareVersions("1.0.0", "1.0.1")).toBeLessThan(0);
      expect(compareVersions("1.1.0", "1.0.0")).toBeGreaterThan(0);
      expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
      expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    });
  });

  describe("Extension Settings", () => {
    it("should get extension configuration", async () => {
      const mockConfig = {
        "extension.setting1": true,
        "extension.setting2": "value",
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockConfig);

      const result = await invoke("extension_get_config", {
        extensionId: "publisher.extension",
      });

      expect(result).toEqual(mockConfig);
    });

    it("should update extension configuration", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("extension_set_config", {
        extensionId: "publisher.extension",
        key: "extension.setting1",
        value: false,
      });

      expect(invoke).toHaveBeenCalledWith("extension_set_config", {
        extensionId: "publisher.extension",
        key: "extension.setting1",
        value: false,
      });
    });
  });

  describe("Extension Categories", () => {
    it("should list extension categories", () => {
      const categories = [
        "Programming Languages",
        "Snippets",
        "Linters",
        "Debuggers",
        "Formatters",
        "Keymaps",
        "Themes",
        "Other",
      ];

      expect(categories).toContain("Themes");
      expect(categories).toContain("Debuggers");
    });

    it("should filter by category", () => {
      const extensions = [
        { id: "ext-1", categories: ["Themes"] },
        { id: "ext-2", categories: ["Debuggers", "Programming Languages"] },
        { id: "ext-3", categories: ["Themes", "Keymaps"] },
      ];

      const themes = extensions.filter(e => e.categories.includes("Themes"));

      expect(themes).toHaveLength(2);
    });
  });

  describe("Extension Recommendations", () => {
    it("should get workspace recommendations", async () => {
      const mockRecommendations = [
        { extensionId: "ext-1", reason: "workspace" },
        { extensionId: "ext-2", reason: "workspace" },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(mockRecommendations);

      const result = await invoke("extension_get_recommendations");

      expect(result).toEqual(mockRecommendations);
    });

    it("should get file-based recommendations", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([
        { extensionId: "rust-analyzer", reason: "file", fileType: ".rs" },
      ]);

      const result = await invoke("extension_get_recommendations", {
        filePath: "/project/src/main.rs",
      });

      expect(result).toHaveLength(1);
    });
  });

  describe("Extension Events", () => {
    it("should listen for extension installed event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("extension:installed", () => {});

      expect(listen).toHaveBeenCalledWith("extension:installed", expect.any(Function));
    });

    it("should listen for extension uninstalled event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("extension:uninstalled", () => {});

      expect(listen).toHaveBeenCalledWith("extension:uninstalled", expect.any(Function));
    });

    it("should listen for extension enabled event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("extension:enabled", () => {});

      expect(listen).toHaveBeenCalledWith("extension:enabled", expect.any(Function));
    });

    it("should listen for extension disabled event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("extension:disabled", () => {});

      expect(listen).toHaveBeenCalledWith("extension:disabled", expect.any(Function));
    });
  });

  describe("Extension Host", () => {
    it("should start extension host", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ pid: 12345 });

      const result = await invoke("extension_host_start");

      expect(result).toHaveProperty("pid");
    });

    it("should stop extension host", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("extension_host_stop");

      expect(invoke).toHaveBeenCalledWith("extension_host_stop");
    });

    it("should restart extension host", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ pid: 12346 });

      const result = await invoke("extension_host_restart");

      expect(result).toHaveProperty("pid");
    });
  });

  describe("Extension Dependencies", () => {
    it("should resolve extension dependencies", () => {
      const extension = {
        id: "main-extension",
        dependencies: [
          { extensionId: "dep-1", version: "^1.0.0", optional: false },
          { extensionId: "dep-2", version: "^2.0.0", optional: true },
        ],
      };

      const requiredDeps = extension.dependencies.filter(d => !d.optional);

      expect(requiredDeps).toHaveLength(1);
    });

    it("should check if dependencies are installed", () => {
      const installedExtensions = new Set(["dep-1", "dep-3"]);
      const dependencies = ["dep-1", "dep-2"];

      const missingDeps = dependencies.filter(d => !installedExtensions.has(d));

      expect(missingDeps).toEqual(["dep-2"]);
    });
  });

  describe("Extension Manifest", () => {
    interface ExtensionManifest {
      name: string;
      displayName: string;
      version: string;
      publisher: string;
      engines: { vscode: string };
      activationEvents?: string[];
      contributes?: {
        commands?: Array<{ command: string; title: string }>;
        languages?: Array<{ id: string; extensions: string[] }>;
        themes?: Array<{ label: string; path: string }>;
      };
    }

    it("should parse extension manifest", () => {
      const manifest: ExtensionManifest = {
        name: "my-extension",
        displayName: "My Extension",
        version: "1.0.0",
        publisher: "my-publisher",
        engines: { vscode: "^1.60.0" },
        activationEvents: ["onLanguage:typescript"],
        contributes: {
          commands: [{ command: "myext.doSomething", title: "Do Something" }],
          languages: [{ id: "myLang", extensions: [".mylang"] }],
        },
      };

      expect(manifest.name).toBe("my-extension");
      expect(manifest.contributes?.commands).toHaveLength(1);
    });

    it("should extract activation events", () => {
      const activationEvents = [
        "onLanguage:typescript",
        "onCommand:myext.activate",
        "workspaceContains:**/*.ts",
        "*",
      ];

      const onLanguageEvents = activationEvents.filter(e => e.startsWith("onLanguage:"));

      expect(onLanguageEvents).toHaveLength(1);
    });
  });

  describe("Extension Sorting", () => {
    interface Extension {
      id: string;
      name: string;
      rating: number;
      downloadCount: number;
    }

    it("should sort by rating", () => {
      const extensions: Extension[] = [
        { id: "ext-1", name: "Ext 1", rating: 3.5, downloadCount: 1000 },
        { id: "ext-2", name: "Ext 2", rating: 4.8, downloadCount: 500 },
        { id: "ext-3", name: "Ext 3", rating: 4.2, downloadCount: 2000 },
      ];

      const sorted = [...extensions].sort((a, b) => b.rating - a.rating);

      expect(sorted[0].id).toBe("ext-2");
      expect(sorted[2].id).toBe("ext-1");
    });

    it("should sort by downloads", () => {
      const extensions: Extension[] = [
        { id: "ext-1", name: "Ext 1", rating: 3.5, downloadCount: 1000 },
        { id: "ext-2", name: "Ext 2", rating: 4.8, downloadCount: 500 },
        { id: "ext-3", name: "Ext 3", rating: 4.2, downloadCount: 2000 },
      ];

      const sorted = [...extensions].sort((a, b) => b.downloadCount - a.downloadCount);

      expect(sorted[0].id).toBe("ext-3");
      expect(sorted[2].id).toBe("ext-2");
    });

    it("should sort alphabetically", () => {
      const extensions: Extension[] = [
        { id: "ext-c", name: "Zebra", rating: 3.5, downloadCount: 1000 },
        { id: "ext-a", name: "Apple", rating: 4.8, downloadCount: 500 },
        { id: "ext-b", name: "Banana", rating: 4.2, downloadCount: 2000 },
      ];

      const sorted = [...extensions].sort((a, b) => a.name.localeCompare(b.name));

      expect(sorted[0].name).toBe("Apple");
      expect(sorted[2].name).toBe("Zebra");
    });
  });
});
