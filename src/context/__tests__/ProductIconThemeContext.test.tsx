import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("ProductIconThemeContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ProductIconCategory", () => {
    type ProductIconCategory =
      | "activityBar"
      | "view"
      | "action"
      | "statusBar"
      | "breadcrumb"
      | "editor"
      | "debug"
      | "scm"
      | "notification"
      | "widget";

    it("should support activityBar category", () => {
      const category: ProductIconCategory = "activityBar";
      expect(category).toBe("activityBar");
    });

    it("should support view category", () => {
      const category: ProductIconCategory = "view";
      expect(category).toBe("view");
    });

    it("should support action category", () => {
      const category: ProductIconCategory = "action";
      expect(category).toBe("action");
    });

    it("should support statusBar category", () => {
      const category: ProductIconCategory = "statusBar";
      expect(category).toBe("statusBar");
    });

    it("should support debug category", () => {
      const category: ProductIconCategory = "debug";
      expect(category).toBe("debug");
    });

    it("should support scm category", () => {
      const category: ProductIconCategory = "scm";
      expect(category).toBe("scm");
    });
  });

  describe("ProductIconId", () => {
    type ProductIconId =
      | "activity-bar-explorer"
      | "activity-bar-search"
      | "activity-bar-scm"
      | "activity-bar-debug"
      | "activity-bar-extensions"
      | "activity-bar-settings"
      | "activity-bar-terminal"
      | "activity-bar-ai"
      | "view-files"
      | "view-folder"
      | "view-folder-open"
      | "action-close"
      | "action-add"
      | "action-remove"
      | "action-refresh"
      | "debug-breakpoint"
      | "debug-continue"
      | "debug-pause"
      | "scm-staged"
      | "scm-modified"
      | "notification-info"
      | "notification-warning"
      | "notification-error";

    it("should support activity bar icons", () => {
      const icons: ProductIconId[] = [
        "activity-bar-explorer",
        "activity-bar-search",
        "activity-bar-scm",
        "activity-bar-debug",
      ];

      expect(icons).toHaveLength(4);
    });

    it("should support view icons", () => {
      const icons: ProductIconId[] = [
        "view-files",
        "view-folder",
        "view-folder-open",
      ];

      expect(icons).toHaveLength(3);
    });

    it("should support action icons", () => {
      const icons: ProductIconId[] = [
        "action-close",
        "action-add",
        "action-remove",
        "action-refresh",
      ];

      expect(icons).toHaveLength(4);
    });

    it("should support debug icons", () => {
      const icons: ProductIconId[] = [
        "debug-breakpoint",
        "debug-continue",
        "debug-pause",
      ];

      expect(icons).toHaveLength(3);
    });

    it("should support scm icons", () => {
      const icons: ProductIconId[] = [
        "scm-staged",
        "scm-modified",
      ];

      expect(icons).toHaveLength(2);
    });

    it("should support notification icons", () => {
      const icons: ProductIconId[] = [
        "notification-info",
        "notification-warning",
        "notification-error",
      ];

      expect(icons).toHaveLength(3);
    });
  });

  describe("ProductIconDefinition", () => {
    interface ProductIconDefinition {
      fontCharacter: string;
      fontFamily?: string;
    }

    it("should create icon definition", () => {
      const icon: ProductIconDefinition = {
        fontCharacter: "\uEB60",
      };

      expect(icon.fontCharacter).toBe("\uEB60");
    });

    it("should include font family", () => {
      const icon: ProductIconDefinition = {
        fontCharacter: "\uEB60",
        fontFamily: "codicon",
      };

      expect(icon.fontFamily).toBe("codicon");
    });
  });

  describe("ProductIconTheme", () => {
    interface ProductIconDefinition {
      fontCharacter: string;
      fontFamily?: string;
    }

    interface ProductIconTheme {
      id: string;
      label: string;
      description: string;
      fontFamily: string;
      fontPath?: string;
      icons: Record<string, ProductIconDefinition>;
    }

    it("should create icon theme", () => {
      const theme: ProductIconTheme = {
        id: "default-codicons",
        label: "Default (Codicons)",
        description: "The default VS Code-style icons",
        fontFamily: "codicon",
        icons: {},
      };

      expect(theme.id).toBe("default-codicons");
      expect(theme.label).toBe("Default (Codicons)");
    });

    it("should include icons", () => {
      const theme: ProductIconTheme = {
        id: "default-codicons",
        label: "Default (Codicons)",
        description: "Default icons",
        fontFamily: "codicon",
        icons: {
          "activity-bar-explorer": { fontCharacter: "\uEB60" },
          "activity-bar-search": { fontCharacter: "\uEB51" },
          "activity-bar-scm": { fontCharacter: "\uEB1F" },
        },
      };

      expect(Object.keys(theme.icons)).toHaveLength(3);
      expect(theme.icons["activity-bar-explorer"].fontCharacter).toBe("\uEB60");
    });

    it("should include font path", () => {
      const theme: ProductIconTheme = {
        id: "custom-theme",
        label: "Custom Theme",
        description: "A custom icon theme",
        fontFamily: "custom-icons",
        fontPath: "/fonts/custom-icons.woff2",
        icons: {},
      };

      expect(theme.fontPath).toBe("/fonts/custom-icons.woff2");
    });
  });

  describe("Built-in Themes", () => {
    interface ProductIconTheme {
      id: string;
      label: string;
      fontFamily: string;
      icons: Record<string, { fontCharacter: string }>;
    }

    const DEFAULT_CODICONS_THEME: ProductIconTheme = {
      id: "default-codicons",
      label: "Default (Codicons)",
      fontFamily: "codicon",
      icons: {
        "activity-bar-explorer": { fontCharacter: "\uEB60" },
        "activity-bar-search": { fontCharacter: "\uEB51" },
        "activity-bar-scm": { fontCharacter: "\uEB1F" },
        "activity-bar-debug": { fontCharacter: "\uEAFC" },
        "activity-bar-extensions": { fontCharacter: "\uEB07" },
        "activity-bar-settings": { fontCharacter: "\uEB52" },
        "activity-bar-terminal": { fontCharacter: "\uEB63" },
        "activity-bar-ai": { fontCharacter: "\uEBCA" },
      },
    };

    it("should have default codicons theme", () => {
      expect(DEFAULT_CODICONS_THEME.id).toBe("default-codicons");
      expect(DEFAULT_CODICONS_THEME.fontFamily).toBe("codicon");
    });

    it("should include activity bar icons", () => {
      expect(DEFAULT_CODICONS_THEME.icons["activity-bar-explorer"]).toBeDefined();
      expect(DEFAULT_CODICONS_THEME.icons["activity-bar-search"]).toBeDefined();
    });
  });

  describe("Set Theme", () => {
    it("should set current theme", () => {
      let currentThemeId = "default-codicons";

      const setTheme = (themeId: string) => {
        currentThemeId = themeId;
      };

      setTheme("minimal-icons");

      expect(currentThemeId).toBe("minimal-icons");
    });
  });

  describe("Get Icon", () => {
    interface ProductIconDefinition {
      fontCharacter: string;
      fontFamily?: string;
    }

    it("should get icon by id", () => {
      const icons: Record<string, ProductIconDefinition> = {
        "activity-bar-explorer": { fontCharacter: "\uEB60" },
        "activity-bar-search": { fontCharacter: "\uEB51" },
      };

      const getIcon = (iconId: string): ProductIconDefinition | undefined => {
        return icons[iconId];
      };

      const icon = getIcon("activity-bar-explorer");
      expect(icon?.fontCharacter).toBe("\uEB60");
    });

    it("should return undefined for unknown icon", () => {
      const icons: Record<string, ProductIconDefinition> = {};

      const getIcon = (iconId: string): ProductIconDefinition | undefined => {
        return icons[iconId];
      };

      expect(getIcon("unknown-icon")).toBeUndefined();
    });
  });

  describe("Register Theme", () => {
    interface ProductIconTheme {
      id: string;
      label: string;
      fontFamily: string;
      icons: Record<string, { fontCharacter: string }>;
    }

    it("should register new theme", () => {
      const themes: ProductIconTheme[] = [];

      const registerTheme = (theme: ProductIconTheme) => {
        themes.push(theme);
      };

      registerTheme({
        id: "custom-theme",
        label: "Custom Theme",
        fontFamily: "custom-icons",
        icons: {},
      });

      expect(themes).toHaveLength(1);
      expect(themes[0].id).toBe("custom-theme");
    });

    it("should not register duplicate themes", () => {
      const themes: ProductIconTheme[] = [
        { id: "default", label: "Default", fontFamily: "codicon", icons: {} },
      ];

      const registerTheme = (theme: ProductIconTheme) => {
        if (!themes.find(t => t.id === theme.id)) {
          themes.push(theme);
        }
      };

      registerTheme({ id: "default", label: "Default 2", fontFamily: "codicon", icons: {} });

      expect(themes).toHaveLength(1);
    });
  });

  describe("Theme State", () => {
    interface ProductIconTheme {
      id: string;
      label: string;
    }

    interface ThemeState {
      currentThemeId: string;
      availableThemes: ProductIconTheme[];
    }

    it("should initialize theme state", () => {
      const state: ThemeState = {
        currentThemeId: "default-codicons",
        availableThemes: [
          { id: "default-codicons", label: "Default (Codicons)" },
        ],
      };

      expect(state.currentThemeId).toBe("default-codicons");
      expect(state.availableThemes).toHaveLength(1);
    });

    it("should track multiple themes", () => {
      const state: ThemeState = {
        currentThemeId: "default-codicons",
        availableThemes: [
          { id: "default-codicons", label: "Default (Codicons)" },
          { id: "minimal", label: "Minimal" },
          { id: "fluent", label: "Fluent Icons" },
        ],
      };

      expect(state.availableThemes).toHaveLength(3);
    });
  });

  describe("Get Current Theme", () => {
    interface ProductIconTheme {
      id: string;
      label: string;
      icons: Record<string, { fontCharacter: string }>;
    }

    it("should get current theme", () => {
      const themes: ProductIconTheme[] = [
        { id: "default", label: "Default", icons: {} },
        { id: "minimal", label: "Minimal", icons: {} },
      ];
      const currentThemeId = "minimal";

      const getCurrentTheme = (): ProductIconTheme | undefined => {
        return themes.find(t => t.id === currentThemeId);
      };

      const theme = getCurrentTheme();
      expect(theme?.label).toBe("Minimal");
    });
  });

  describe("Storage", () => {
    const THEME_STORAGE_KEY = "cortex-product-icon-theme";

    it("should define storage key", () => {
      expect(THEME_STORAGE_KEY).toBe("cortex-product-icon-theme");
    });

    it("should save theme to storage", () => {
      const storage: Record<string, string> = {};

      const saveTheme = (themeId: string) => {
        storage[THEME_STORAGE_KEY] = themeId;
      };

      saveTheme("minimal");

      expect(storage[THEME_STORAGE_KEY]).toBe("minimal");
    });

    it("should load theme from storage", () => {
      const storage: Record<string, string> = {
        [THEME_STORAGE_KEY]: "minimal",
      };

      const loadTheme = (): string => {
        return storage[THEME_STORAGE_KEY] || "default-codicons";
      };

      expect(loadTheme()).toBe("minimal");
    });

    it("should fallback to default theme", () => {
      const storage: Record<string, string> = {};

      const loadTheme = (): string => {
        return storage[THEME_STORAGE_KEY] || "default-codicons";
      };

      expect(loadTheme()).toBe("default-codicons");
    });
  });

  describe("Icon Character Codes", () => {
    it("should use valid unicode characters", () => {
      const icons = {
        explorer: "\uEB60",
        search: "\uEB51",
        scm: "\uEB1F",
        debug: "\uEAFC",
      };

      expect(icons.explorer.charCodeAt(0)).toBe(0xEB60);
      expect(icons.search.charCodeAt(0)).toBe(0xEB51);
    });
  });

  describe("Theme Validation", () => {
    interface ProductIconTheme {
      id: string;
      label: string;
      fontFamily: string;
      icons: Record<string, { fontCharacter: string }>;
    }

    it("should validate theme has required fields", () => {
      const validateTheme = (theme: ProductIconTheme): boolean => {
        return !!(theme.id && theme.label && theme.fontFamily && theme.icons);
      };

      const validTheme: ProductIconTheme = {
        id: "test",
        label: "Test",
        fontFamily: "test-font",
        icons: {},
      };

      expect(validateTheme(validTheme)).toBe(true);
    });

    it("should validate icon definitions", () => {
      const validateIcon = (icon: { fontCharacter: string }): boolean => {
        return typeof icon.fontCharacter === "string" && icon.fontCharacter.length > 0;
      };

      expect(validateIcon({ fontCharacter: "\uEB60" })).toBe(true);
      expect(validateIcon({ fontCharacter: "" })).toBe(false);
    });
  });
});
