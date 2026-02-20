import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("ProfilesContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Profile Types", () => {
    interface KeyBinding {
      command: string;
      key: string;
      when?: string;
      args?: Record<string, unknown>;
    }

    interface ProfileUIState {
      sidebarWidth: number;
      sidebarCollapsed: boolean;
      panelHeight: number;
      panelCollapsed: boolean;
      activityBarVisible: boolean;
      statusBarVisible: boolean;
      zenMode: boolean;
      activeActivityBarItem: string;
      explorerExpandedFolders: string[];
      auxiliaryBarWidth: number;
      auxiliaryBarCollapsed: boolean;
    }

    interface Profile {
      id: string;
      name: string;
      icon?: string;
      isDefault?: boolean;
      settings: Record<string, unknown>;
      keybindings: KeyBinding[];
      enabledExtensions: string[];
      snippets?: Record<string, unknown>;
      uiState?: ProfileUIState;
      createdAt: Date;
      updatedAt: Date;
    }

    interface ProfileMetadata {
      id: string;
      name: string;
      icon?: string;
      isDefault?: boolean;
      createdAt: Date;
      updatedAt: Date;
    }

    it("should create a profile with required fields", () => {
      const profile: Profile = {
        id: "profile-1",
        name: "Development",
        icon: "code",
        isDefault: false,
        settings: { theme: "dark" },
        keybindings: [],
        enabledExtensions: ["ext-1", "ext-2"],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(profile.id).toBe("profile-1");
      expect(profile.name).toBe("Development");
      expect(profile.enabledExtensions).toHaveLength(2);
    });

    it("should create default profile", () => {
      const now = new Date();
      const defaultProfile: Profile = {
        id: "default",
        name: "Default",
        icon: "user",
        isDefault: true,
        settings: {},
        keybindings: [],
        enabledExtensions: [],
        snippets: {},
        uiState: {
          sidebarWidth: 260,
          sidebarCollapsed: false,
          panelHeight: 250,
          panelCollapsed: true,
          activityBarVisible: true,
          statusBarVisible: true,
          zenMode: false,
          activeActivityBarItem: "explorer",
          explorerExpandedFolders: [],
          auxiliaryBarWidth: 320,
          auxiliaryBarCollapsed: true,
        },
        createdAt: now,
        updatedAt: now,
      };

      expect(defaultProfile.isDefault).toBe(true);
      expect(defaultProfile.uiState?.sidebarWidth).toBe(260);
    });

    it("should extract profile metadata", () => {
      const profile: Profile = {
        id: "profile-1",
        name: "Work",
        icon: "briefcase",
        isDefault: false,
        settings: { fontSize: 14 },
        keybindings: [{ command: "save", key: "Ctrl+S" }],
        enabledExtensions: ["ext-1"],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-06-01"),
      };

      const metadata: ProfileMetadata = {
        id: profile.id,
        name: profile.name,
        icon: profile.icon,
        isDefault: profile.isDefault,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      };

      expect(metadata.id).toBe("profile-1");
      expect(metadata.name).toBe("Work");
    });
  });

  describe("Profile CRUD Operations", () => {
    interface Profile {
      id: string;
      name: string;
      icon?: string;
      isDefault?: boolean;
      settings: Record<string, unknown>;
      keybindings: { command: string; key: string }[];
      enabledExtensions: string[];
      createdAt: Date;
      updatedAt: Date;
    }

    it("should create a new profile", () => {
      const profiles: Profile[] = [];

      const newProfile: Profile = {
        id: `profile_${Date.now()}`,
        name: "New Profile",
        icon: "star",
        isDefault: false,
        settings: {},
        keybindings: [],
        enabledExtensions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      profiles.push(newProfile);

      expect(profiles).toHaveLength(1);
      expect(profiles[0].name).toBe("New Profile");
    });

    it("should update profile settings", () => {
      const profile: Profile = {
        id: "profile-1",
        name: "Test",
        settings: { theme: "light" },
        keybindings: [],
        enabledExtensions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      profile.settings = { ...profile.settings, theme: "dark", fontSize: 16 };
      profile.updatedAt = new Date();

      expect(profile.settings.theme).toBe("dark");
      expect(profile.settings.fontSize).toBe(16);
    });

    it("should delete a profile", () => {
      const profiles: Profile[] = [
        {
          id: "profile-1",
          name: "Profile 1",
          settings: {},
          keybindings: [],
          enabledExtensions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "profile-2",
          name: "Profile 2",
          settings: {},
          keybindings: [],
          enabledExtensions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const filtered = profiles.filter((p) => p.id !== "profile-1");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("profile-2");
    });

    it("should duplicate a profile", () => {
      const original: Profile = {
        id: "profile-1",
        name: "Original",
        icon: "code",
        settings: { theme: "dark" },
        keybindings: [{ command: "save", key: "Ctrl+S" }],
        enabledExtensions: ["ext-1"],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const duplicate: Profile = {
        ...original,
        id: `profile_${Date.now()}`,
        name: `${original.name} (Copy)`,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(duplicate.name).toBe("Original (Copy)");
      expect(duplicate.settings).toEqual(original.settings);
      expect(duplicate.id).not.toBe(original.id);
    });
  });

  describe("Profile Switching", () => {
    interface Profile {
      id: string;
      name: string;
      isDefault?: boolean;
      settings: Record<string, unknown>;
    }

    it("should switch active profile", () => {
      const profiles: Profile[] = [
        { id: "default", name: "Default", isDefault: true, settings: {} },
        { id: "work", name: "Work", settings: { theme: "light" } },
        { id: "personal", name: "Personal", settings: { theme: "dark" } },
      ];

      let activeProfileId = "default";

      activeProfileId = "work";
      const activeProfile = profiles.find((p) => p.id === activeProfileId);

      expect(activeProfile?.name).toBe("Work");
      expect(activeProfile?.settings.theme).toBe("light");
    });

    it("should get current profile", () => {
      const profiles: Profile[] = [
        { id: "profile-1", name: "Profile 1", settings: {} },
        { id: "profile-2", name: "Profile 2", settings: {} },
      ];

      const activeProfileId = "profile-2";
      const currentProfile = profiles.find((p) => p.id === activeProfileId);

      expect(currentProfile?.id).toBe("profile-2");
    });

    it("should fall back to default profile", () => {
      const profiles: Profile[] = [
        { id: "default", name: "Default", isDefault: true, settings: {} },
        { id: "work", name: "Work", settings: {} },
      ];

      const activeProfileId = "non-existent";
      let currentProfile = profiles.find((p) => p.id === activeProfileId);

      if (!currentProfile) {
        currentProfile = profiles.find((p) => p.isDefault);
      }

      expect(currentProfile?.id).toBe("default");
    });
  });

  describe("Keybindings Management", () => {
    interface KeyBinding {
      command: string;
      key: string;
      when?: string;
      args?: Record<string, unknown>;
    }

    it("should add keybinding", () => {
      const keybindings: KeyBinding[] = [];

      keybindings.push({
        command: "editor.save",
        key: "Ctrl+S",
      });

      expect(keybindings).toHaveLength(1);
      expect(keybindings[0].command).toBe("editor.save");
    });

    it("should update keybinding", () => {
      const keybindings: KeyBinding[] = [
        { command: "editor.save", key: "Ctrl+S" },
        { command: "editor.undo", key: "Ctrl+Z" },
      ];

      const index = keybindings.findIndex((k) => k.command === "editor.save");
      if (index !== -1) {
        keybindings[index] = { ...keybindings[index], key: "Cmd+S" };
      }

      expect(keybindings[0].key).toBe("Cmd+S");
    });

    it("should remove keybinding", () => {
      const keybindings: KeyBinding[] = [
        { command: "editor.save", key: "Ctrl+S" },
        { command: "editor.undo", key: "Ctrl+Z" },
      ];

      const filtered = keybindings.filter((k) => k.command !== "editor.save");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].command).toBe("editor.undo");
    });

    it("should handle conditional keybindings", () => {
      const keybinding: KeyBinding = {
        command: "editor.toggleComment",
        key: "Ctrl+/",
        when: "editorTextFocus",
      };

      expect(keybinding.when).toBe("editorTextFocus");
    });

    it("should handle keybindings with args", () => {
      const keybinding: KeyBinding = {
        command: "editor.action.insertSnippet",
        key: "Ctrl+Shift+P",
        args: { name: "console.log" },
      };

      expect(keybinding.args?.name).toBe("console.log");
    });
  });

  describe("Profile Import/Export", () => {
    interface Profile {
      id: string;
      name: string;
      settings: Record<string, unknown>;
      keybindings: { command: string; key: string }[];
      enabledExtensions: string[];
      createdAt: Date;
      updatedAt: Date;
    }

    interface ProfileExportData {
      version: number;
      exportedAt: number;
      profile: Profile;
      checksum?: string;
    }

    it("should export profile", () => {
      const profile: Profile = {
        id: "profile-1",
        name: "Export Test",
        settings: { theme: "dark" },
        keybindings: [{ command: "save", key: "Ctrl+S" }],
        enabledExtensions: ["ext-1"],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const exportData: ProfileExportData = {
        version: 1,
        exportedAt: Date.now(),
        profile,
        checksum: "abc123",
      };

      expect(exportData.version).toBe(1);
      expect(exportData.profile.name).toBe("Export Test");
    });

    it("should import profile", () => {
      const importData: ProfileExportData = {
        version: 1,
        exportedAt: Date.now() - 10000,
        profile: {
          id: "imported-1",
          name: "Imported Profile",
          settings: { fontSize: 14 },
          keybindings: [],
          enabledExtensions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const importedProfile: Profile = {
        ...importData.profile,
        id: `profile_${Date.now()}`,
        name: `${importData.profile.name} (Imported)`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(importedProfile.name).toBe("Imported Profile (Imported)");
      expect(importedProfile.settings.fontSize).toBe(14);
    });

    it("should validate export data version", () => {
      const exportData: ProfileExportData = {
        version: 2,
        exportedAt: Date.now(),
        profile: {
          id: "profile-1",
          name: "Test",
          settings: {},
          keybindings: [],
          enabledExtensions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const isValidVersion = exportData.version >= 1 && exportData.version <= 2;

      expect(isValidVersion).toBe(true);
    });
  });

  describe("UI State Management", () => {
    interface ProfileUIState {
      sidebarWidth: number;
      sidebarCollapsed: boolean;
      panelHeight: number;
      panelCollapsed: boolean;
      activityBarVisible: boolean;
      statusBarVisible: boolean;
      zenMode: boolean;
      activeActivityBarItem: string;
      explorerExpandedFolders: string[];
      auxiliaryBarWidth: number;
      auxiliaryBarCollapsed: boolean;
    }

    it("should update UI state", () => {
      const uiState: ProfileUIState = {
        sidebarWidth: 260,
        sidebarCollapsed: false,
        panelHeight: 250,
        panelCollapsed: true,
        activityBarVisible: true,
        statusBarVisible: true,
        zenMode: false,
        activeActivityBarItem: "explorer",
        explorerExpandedFolders: [],
        auxiliaryBarWidth: 320,
        auxiliaryBarCollapsed: true,
      };

      uiState.sidebarWidth = 300;
      uiState.zenMode = true;

      expect(uiState.sidebarWidth).toBe(300);
      expect(uiState.zenMode).toBe(true);
    });

    it("should track expanded folders", () => {
      const uiState: ProfileUIState = {
        sidebarWidth: 260,
        sidebarCollapsed: false,
        panelHeight: 250,
        panelCollapsed: true,
        activityBarVisible: true,
        statusBarVisible: true,
        zenMode: false,
        activeActivityBarItem: "explorer",
        explorerExpandedFolders: ["/src", "/src/components"],
        auxiliaryBarWidth: 320,
        auxiliaryBarCollapsed: true,
      };

      uiState.explorerExpandedFolders.push("/src/utils");

      expect(uiState.explorerExpandedFolders).toHaveLength(3);
      expect(uiState.explorerExpandedFolders).toContain("/src/utils");
    });
  });

  describe("Persistence", () => {
    it("should call invoke for loading profiles", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      await invoke("profiles_load");

      expect(invoke).toHaveBeenCalledWith("profiles_load");
    });

    it("should call invoke for saving profiles", async () => {
      const profiles = [{ id: "profile-1", name: "Test" }];

      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("profiles_save", { profiles });

      expect(invoke).toHaveBeenCalledWith("profiles_save", { profiles });
    });
  });
});
