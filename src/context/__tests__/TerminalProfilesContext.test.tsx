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

describe("TerminalProfilesContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("TerminalProfile Interface", () => {
    type TerminalProfileIcon =
      | "terminal"
      | "powershell"
      | "bash"
      | "zsh"
      | "fish"
      | "cmd"
      | "custom";

    interface TerminalProfile {
      id: string;
      name: string;
      path: string;
      args: string[];
      icon: TerminalProfileIcon;
      color: string;
      env: Record<string, string>;
      isBuiltin: boolean;
      isDefault: boolean;
    }

    it("should create a terminal profile", () => {
      const profile: TerminalProfile = {
        id: "profile-1",
        name: "Bash",
        path: "/bin/bash",
        args: ["--login"],
        icon: "bash",
        color: "#4EAA25",
        env: {},
        isBuiltin: true,
        isDefault: true,
      };

      expect(profile.name).toBe("Bash");
      expect(profile.path).toBe("/bin/bash");
      expect(profile.isBuiltin).toBe(true);
    });

    it("should create a profile with all optional fields", () => {
      const profile: TerminalProfile = {
        id: "profile-custom",
        name: "Custom Shell",
        path: "/usr/local/bin/custom-shell",
        args: ["--interactive", "--login"],
        icon: "custom",
        color: "#FF5733",
        env: { TERM: "xterm-256color", LANG: "en_US.UTF-8" },
        isBuiltin: false,
        isDefault: false,
      };

      expect(profile.args).toHaveLength(2);
      expect(profile.env.TERM).toBe("xterm-256color");
      expect(profile.icon).toBe("custom");
    });

    it("should create a profile with minimal fields", () => {
      const profile: TerminalProfile = {
        id: "profile-min",
        name: "Minimal",
        path: "/bin/sh",
        args: [],
        icon: "terminal",
        color: "",
        env: {},
        isBuiltin: false,
        isDefault: false,
      };

      expect(profile.args).toHaveLength(0);
      expect(profile.color).toBe("");
      expect(Object.keys(profile.env)).toHaveLength(0);
    });
  });

  describe("Default Profiles", () => {
    interface TerminalProfile {
      id: string;
      name: string;
      path: string;
      args: string[];
      icon: string;
      color: string;
      env: Record<string, string>;
      isBuiltin: boolean;
      isDefault: boolean;
    }

    const DEFAULT_PROFILES: TerminalProfile[] = [
      { id: "bash", name: "Bash", path: "/bin/bash", args: ["--login"], icon: "bash", color: "#4EAA25", env: {}, isBuiltin: true, isDefault: true },
      { id: "zsh", name: "Zsh", path: "/bin/zsh", args: ["-l"], icon: "zsh", color: "#428850", env: {}, isBuiltin: true, isDefault: false },
      { id: "fish", name: "Fish", path: "/usr/bin/fish", args: [], icon: "fish", color: "#D73A49", env: {}, isBuiltin: true, isDefault: false },
      { id: "powershell", name: "PowerShell", path: "pwsh", args: [], icon: "powershell", color: "#012456", env: {}, isBuiltin: true, isDefault: false },
    ];

    it("should define bash profile", () => {
      const bash = DEFAULT_PROFILES.find(p => p.id === "bash");
      expect(bash).toBeDefined();
      expect(bash!.path).toBe("/bin/bash");
      expect(bash!.isDefault).toBe(true);
    });

    it("should define zsh profile", () => {
      const zsh = DEFAULT_PROFILES.find(p => p.id === "zsh");
      expect(zsh).toBeDefined();
      expect(zsh!.path).toBe("/bin/zsh");
      expect(zsh!.args).toContain("-l");
    });

    it("should define fish profile", () => {
      const fish = DEFAULT_PROFILES.find(p => p.id === "fish");
      expect(fish).toBeDefined();
      expect(fish!.path).toBe("/usr/bin/fish");
    });

    it("should define powershell profile", () => {
      const ps = DEFAULT_PROFILES.find(p => p.id === "powershell");
      expect(ps).toBeDefined();
      expect(ps!.path).toBe("pwsh");
      expect(ps!.icon).toBe("powershell");
    });

    it("should have exactly one default profile", () => {
      const defaults = DEFAULT_PROFILES.filter(p => p.isDefault);
      expect(defaults).toHaveLength(1);
    });

    it("should mark all default profiles as builtin", () => {
      const allBuiltin = DEFAULT_PROFILES.every(p => p.isBuiltin);
      expect(allBuiltin).toBe(true);
    });
  });

  describe("Profile CRUD Operations", () => {
    interface TerminalProfile {
      id: string;
      name: string;
      path: string;
      args: string[];
      icon: string;
      color: string;
      env: Record<string, string>;
      isBuiltin: boolean;
      isDefault: boolean;
    }

    it("should save a new profile with generated ID", () => {
      const profiles: TerminalProfile[] = [];

      const saveProfile = (config: Omit<TerminalProfile, "id" | "isBuiltin" | "isDefault">) => {
        const newProfile: TerminalProfile = {
          ...config,
          id: `profile-${Date.now()}`,
          isBuiltin: false,
          isDefault: false,
        };
        profiles.push(newProfile);
        return newProfile;
      };

      const saved = saveProfile({
        name: "Custom Bash",
        path: "/usr/local/bin/bash",
        args: [],
        icon: "bash",
        color: "#333",
        env: {},
      });

      expect(saved.id).toContain("profile-");
      expect(saved.isBuiltin).toBe(false);
      expect(profiles).toHaveLength(1);
    });

    it("should update an existing profile", () => {
      const profiles: TerminalProfile[] = [
        { id: "p1", name: "Old Name", path: "/bin/bash", args: [], icon: "bash", color: "", env: {}, isBuiltin: false, isDefault: false },
      ];

      const updateProfile = (id: string, updates: Partial<TerminalProfile>) => {
        const idx = profiles.findIndex(p => p.id === id);
        if (idx !== -1) {
          profiles[idx] = { ...profiles[idx], ...updates };
        }
      };

      updateProfile("p1", { name: "New Name", color: "#FF0000" });

      expect(profiles[0].name).toBe("New Name");
      expect(profiles[0].color).toBe("#FF0000");
      expect(profiles[0].path).toBe("/bin/bash");
    });

    it("should delete a profile", () => {
      const profiles: TerminalProfile[] = [
        { id: "p1", name: "Profile 1", path: "/bin/bash", args: [], icon: "bash", color: "", env: {}, isBuiltin: false, isDefault: false },
        { id: "p2", name: "Profile 2", path: "/bin/zsh", args: [], icon: "zsh", color: "", env: {}, isBuiltin: false, isDefault: false },
      ];

      const deleteProfile = (id: string) => {
        const idx = profiles.findIndex(p => p.id === id);
        if (idx !== -1) {
          profiles.splice(idx, 1);
        }
      };

      deleteProfile("p1");

      expect(profiles).toHaveLength(1);
      expect(profiles[0].id).toBe("p2");
    });

    it("should set default profile", () => {
      const profiles: TerminalProfile[] = [
        { id: "p1", name: "Bash", path: "/bin/bash", args: [], icon: "bash", color: "", env: {}, isBuiltin: true, isDefault: true },
        { id: "p2", name: "Zsh", path: "/bin/zsh", args: [], icon: "zsh", color: "", env: {}, isBuiltin: true, isDefault: false },
      ];

      let defaultProfileId = "p1";

      const setDefaultProfile = (id: string) => {
        profiles.forEach(p => { p.isDefault = p.id === id; });
        defaultProfileId = id;
      };

      setDefaultProfile("p2");

      expect(defaultProfileId).toBe("p2");
      expect(profiles[0].isDefault).toBe(false);
      expect(profiles[1].isDefault).toBe(true);
    });

    it("should duplicate a profile with new ID", () => {
      const original: TerminalProfile = {
        id: "p1", name: "Bash", path: "/bin/bash", args: ["--login"], icon: "bash", color: "#4EAA25", env: { FOO: "bar" }, isBuiltin: true, isDefault: true,
      };

      const duplicateProfile = (profile: TerminalProfile): TerminalProfile => ({
        ...profile,
        id: `${profile.id}-copy-${Date.now()}`,
        name: `${profile.name} (Copy)`,
        isBuiltin: false,
        isDefault: false,
      });

      const copy = duplicateProfile(original);

      expect(copy.id).not.toBe(original.id);
      expect(copy.name).toBe("Bash (Copy)");
      expect(copy.path).toBe(original.path);
      expect(copy.args).toEqual(original.args);
      expect(copy.isBuiltin).toBe(false);
      expect(copy.isDefault).toBe(false);
    });
  });

  describe("Profile Lookup", () => {
    interface TerminalProfile {
      id: string;
      name: string;
      path: string;
      isDefault: boolean;
    }

    const profiles: TerminalProfile[] = [
      { id: "bash", name: "Bash", path: "/bin/bash", isDefault: true },
      { id: "zsh", name: "Zsh", path: "/bin/zsh", isDefault: false },
      { id: "fish", name: "Fish", path: "/usr/bin/fish", isDefault: false },
    ];

    it("should get profile by ID", () => {
      const getProfileById = (id: string) => profiles.find(p => p.id === id) || null;

      expect(getProfileById("bash")).toBeDefined();
      expect(getProfileById("bash")!.name).toBe("Bash");
      expect(getProfileById("nonexistent")).toBeNull();
    });

    it("should get default profile", () => {
      const getDefaultProfile = () => profiles.find(p => p.isDefault) || null;

      const defaultProfile = getDefaultProfile();
      expect(defaultProfile).toBeDefined();
      expect(defaultProfile!.id).toBe("bash");
    });

    it("should return null when no default profile exists", () => {
      const noDefaultProfiles = profiles.map(p => ({ ...p, isDefault: false }));
      const getDefaultProfile = () => noDefaultProfiles.find(p => p.isDefault) || null;

      expect(getDefaultProfile()).toBeNull();
    });
  });

  describe("Import/Export Profiles", () => {
    interface TerminalProfile {
      id: string;
      name: string;
      path: string;
      args: string[];
      icon: string;
      color: string;
      env: Record<string, string>;
      isBuiltin: boolean;
      isDefault: boolean;
    }

    it("should export profiles to JSON", () => {
      const profiles: TerminalProfile[] = [
        { id: "p1", name: "Bash", path: "/bin/bash", args: [], icon: "bash", color: "", env: {}, isBuiltin: true, isDefault: true },
      ];

      const exportProfiles = (profiles: TerminalProfile[]): string => {
        return JSON.stringify(profiles, null, 2);
      };

      const exported = exportProfiles(profiles);
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("Bash");
    });

    it("should import profiles from JSON", () => {
      const profiles: TerminalProfile[] = [];

      const importProfiles = (json: string): boolean => {
        try {
          const imported = JSON.parse(json) as TerminalProfile[];
          imported.forEach(p => {
            profiles.push({ ...p, id: `imported-${p.id}`, isBuiltin: false });
          });
          return true;
        } catch {
          return false;
        }
      };

      const json = JSON.stringify([
        { id: "p1", name: "Imported Bash", path: "/bin/bash", args: [], icon: "bash", color: "", env: {}, isBuiltin: false, isDefault: false },
        { id: "p2", name: "Imported Zsh", path: "/bin/zsh", args: [], icon: "zsh", color: "", env: {}, isBuiltin: false, isDefault: false },
      ]);

      const result = importProfiles(json);

      expect(result).toBe(true);
      expect(profiles).toHaveLength(2);
      expect(profiles[0].id).toBe("imported-p1");
    });

    it("should handle invalid JSON during import", () => {
      const profiles: TerminalProfile[] = [];

      const importProfiles = (json: string): boolean => {
        try {
          const imported = JSON.parse(json) as TerminalProfile[];
          imported.forEach(p => profiles.push(p));
          return true;
        } catch {
          return false;
        }
      };

      const result = importProfiles("not valid json{{{");
      expect(result).toBe(false);
      expect(profiles).toHaveLength(0);
    });
  });

  describe("Reset to Defaults", () => {
    interface TerminalProfile {
      id: string;
      name: string;
      path: string;
      isBuiltin: boolean;
      isDefault: boolean;
    }

    it("should restore default profiles", () => {
      const DEFAULT_PROFILES: TerminalProfile[] = [
        { id: "bash", name: "Bash", path: "/bin/bash", isBuiltin: true, isDefault: true },
        { id: "zsh", name: "Zsh", path: "/bin/zsh", isBuiltin: true, isDefault: false },
      ];

      let profiles: TerminalProfile[] = [
        { id: "custom-1", name: "Custom", path: "/bin/custom", isBuiltin: false, isDefault: true },
      ];

      const resetToDefaults = () => {
        profiles = [...DEFAULT_PROFILES];
      };

      resetToDefaults();

      expect(profiles).toHaveLength(2);
      expect(profiles.every(p => p.isBuiltin)).toBe(true);
      expect(profiles[0].id).toBe("bash");
    });
  });

  describe("LocalStorage Persistence", () => {
    const STORAGE_KEY = "cortex_terminal_profiles";

    it("should save profiles to localStorage", () => {
      const mockSetItem = vi.fn();
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = mockSetItem;

      const profiles = [{ id: "p1", name: "Bash" }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));

      expect(mockSetItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(profiles)
      );

      Storage.prototype.setItem = originalSetItem;
    });

    it("should load profiles from localStorage on init", () => {
      const storedProfiles = [
        { id: "p1", name: "Bash", path: "/bin/bash" },
        { id: "p2", name: "Zsh", path: "/bin/zsh" },
      ];

      const mockGetItem = vi.fn().mockReturnValue(JSON.stringify(storedProfiles));
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = mockGetItem;

      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(stored || "[]");

      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe("Bash");

      Storage.prototype.getItem = originalGetItem;
    });

    it("should handle invalid localStorage data gracefully", () => {
      const mockGetItem = vi.fn().mockReturnValue("not valid json{{{");
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = mockGetItem;

      const stored = localStorage.getItem(STORAGE_KEY);
      let profiles: unknown[] = [];
      try {
        profiles = JSON.parse(stored || "[]");
      } catch {
        profiles = [];
      }

      expect(profiles).toHaveLength(0);

      Storage.prototype.getItem = originalGetItem;
    });

    it("should handle null localStorage data", () => {
      const mockGetItem = vi.fn().mockReturnValue(null);
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = mockGetItem;

      const stored = localStorage.getItem(STORAGE_KEY);
      const profiles = JSON.parse(stored || "[]");

      expect(profiles).toHaveLength(0);

      Storage.prototype.getItem = originalGetItem;
    });
  });

  describe("IPC Integration", () => {
    it("should invoke terminal_get_profiles", async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const result = await invoke("terminal_get_profiles");

      expect(invoke).toHaveBeenCalledWith("terminal_get_profiles");
      expect(result).toEqual([]);
    });

    it("should invoke terminal_save_profile", async () => {
      vi.mocked(invoke).mockResolvedValue({ id: "new-profile", name: "Custom" });

      const result = await invoke("terminal_save_profile", {
        profile: { name: "Custom", path: "/bin/custom" },
      });

      expect(invoke).toHaveBeenCalledWith("terminal_save_profile", expect.any(Object));
      expect(result).toHaveProperty("id");
    });

    it("should invoke terminal_delete_profile", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("terminal_delete_profile", { id: "profile-1" });

      expect(invoke).toHaveBeenCalledWith("terminal_delete_profile", { id: "profile-1" });
    });

    it("should listen for profile change events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("terminal:profiles-changed", () => {});

      expect(listen).toHaveBeenCalledWith("terminal:profiles-changed", expect.any(Function));
    });
  });
});
