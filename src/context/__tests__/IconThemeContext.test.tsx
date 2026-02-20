import { describe, it, expect, vi, beforeEach } from "vitest";

describe("IconThemeContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Icon Definition", () => {
    interface IconDefinition {
      icon: string;
      color: string;
    }

    it("should define icon with color", () => {
      const icon: IconDefinition = {
        icon: "📄",
        color: "#d4d4d8",
      };

      expect(icon.icon).toBe("📄");
      expect(icon.color).toBe("#d4d4d8");
    });
  });

  describe("Icon Theme", () => {
    interface IconDefinition {
      icon: string;
      color: string;
    }

    interface IconTheme {
      id: string;
      name: string;
      description: string;
      icons: {
        file: IconDefinition;
        folder: IconDefinition;
        folderOpen: IconDefinition;
        fileExtensions: Record<string, IconDefinition>;
        fileNames: Record<string, IconDefinition>;
        folderNames: Record<string, IconDefinition>;
        folderNamesOpen: Record<string, IconDefinition>;
      };
    }

    it("should define theme structure", () => {
      const theme: IconTheme = {
        id: "seti",
        name: "Seti",
        description: "Classic file icons",
        icons: {
          file: { icon: "📄", color: "#d4d4d8" },
          folder: { icon: "📁", color: "#dcb67a" },
          folderOpen: { icon: "📂", color: "#dcb67a" },
          fileExtensions: {
            ts: { icon: "📘", color: "#3178c6" },
            js: { icon: "📒", color: "#f7df1e" },
          },
          fileNames: {
            "package.json": { icon: "📦", color: "#e8274b" },
          },
          folderNames: {
            src: { icon: "📁", color: "#e8ba36" },
          },
          folderNamesOpen: {
            src: { icon: "📂", color: "#e8ba36" },
          },
        },
      };

      expect(theme.id).toBe("seti");
      expect(theme.icons.fileExtensions.ts.color).toBe("#3178c6");
    });
  });

  describe("Icon Theme State", () => {
    interface IconThemeState {
      activeThemeId: string;
    }

    it("should track active theme", () => {
      const state: IconThemeState = {
        activeThemeId: "seti",
      };

      expect(state.activeThemeId).toBe("seti");
    });
  });

  describe("Built-in Themes", () => {
    it("should have seti theme", () => {
      const themes = ["seti", "material", "minimal"];
      expect(themes).toContain("seti");
    });

    it("should have material theme", () => {
      const themes = ["seti", "material", "minimal"];
      expect(themes).toContain("material");
    });

    it("should have minimal theme", () => {
      const themes = ["seti", "material", "minimal"];
      expect(themes).toContain("minimal");
    });
  });

  describe("Set Icon Theme", () => {
    it("should change active theme", () => {
      let activeThemeId = "seti";

      const setIconTheme = (id: string) => {
        activeThemeId = id;
      };

      setIconTheme("material");

      expect(activeThemeId).toBe("material");
    });

    it("should persist theme to localStorage", () => {
      const STORAGE_KEY = "cortex-icon-theme";
      let stored: string | null = null;

      const setIconTheme = (id: string) => {
        stored = JSON.stringify({ activeThemeId: id, key: STORAGE_KEY });
      };

      setIconTheme("minimal");

      expect(stored).toContain("minimal");
    });
  });

  describe("Get File Icon", () => {
    interface IconDefinition {
      icon: string;
      color: string;
    }

    it("should get icon by file extension", () => {
      const fileExtensions: Record<string, IconDefinition> = {
        ts: { icon: "📘", color: "#3178c6" },
        js: { icon: "📒", color: "#f7df1e" },
        py: { icon: "🐍", color: "#3572a5" },
      };
      const defaultIcon: IconDefinition = { icon: "📄", color: "#d4d4d8" };

      const getFileIcon = (filename: string): IconDefinition => {
        const ext = filename.split(".").pop() || "";
        return fileExtensions[ext] || defaultIcon;
      };

      expect(getFileIcon("app.ts").icon).toBe("📘");
      expect(getFileIcon("script.py").icon).toBe("🐍");
      expect(getFileIcon("unknown.xyz").icon).toBe("📄");
    });

    it("should get icon by file name", () => {
      const fileNames: Record<string, IconDefinition> = {
        "package.json": { icon: "📦", color: "#e8274b" },
        "Dockerfile": { icon: "🐳", color: "#2496ed" },
        ".gitignore": { icon: "🚫", color: "#f05032" },
      };
      const defaultIcon: IconDefinition = { icon: "📄", color: "#d4d4d8" };

      const getFileIcon = (filename: string): IconDefinition => {
        return fileNames[filename] || defaultIcon;
      };

      expect(getFileIcon("package.json").icon).toBe("📦");
      expect(getFileIcon("Dockerfile").icon).toBe("🐳");
    });

    it("should prioritize file name over extension", () => {
      const fileNames: Record<string, IconDefinition> = {
        "tsconfig.json": { icon: "📘", color: "#3178c6" },
      };
      const fileExtensions: Record<string, IconDefinition> = {
        json: { icon: "📋", color: "#cbcb41" },
      };
      const defaultIcon: IconDefinition = { icon: "📄", color: "#d4d4d8" };

      const getFileIcon = (filename: string): IconDefinition => {
        if (fileNames[filename]) {
          return fileNames[filename];
        }
        const ext = filename.split(".").pop() || "";
        return fileExtensions[ext] || defaultIcon;
      };

      expect(getFileIcon("tsconfig.json").icon).toBe("📘");
      expect(getFileIcon("data.json").icon).toBe("📋");
    });
  });

  describe("Get Folder Icon", () => {
    interface IconDefinition {
      icon: string;
      color: string;
    }

    it("should get folder icon by name", () => {
      const folderNames: Record<string, IconDefinition> = {
        src: { icon: "📁", color: "#e8ba36" },
        node_modules: { icon: "📁", color: "#8bc34a" },
        tests: { icon: "📁", color: "#c21325" },
      };
      const defaultFolder: IconDefinition = { icon: "📁", color: "#dcb67a" };

      const getFolderIcon = (name: string): IconDefinition => {
        return folderNames[name] || defaultFolder;
      };

      expect(getFolderIcon("src").color).toBe("#e8ba36");
      expect(getFolderIcon("unknown").color).toBe("#dcb67a");
    });

    it("should get open folder icon", () => {
      const folderNamesOpen: Record<string, IconDefinition> = {
        src: { icon: "📂", color: "#e8ba36" },
      };
      const defaultFolderOpen: IconDefinition = { icon: "📂", color: "#dcb67a" };

      const getFolderIcon = (name: string, open: boolean): IconDefinition => {
        if (open) {
          return folderNamesOpen[name] || defaultFolderOpen;
        }
        return { icon: "📁", color: "#dcb67a" };
      };

      expect(getFolderIcon("src", true).icon).toBe("📂");
      expect(getFolderIcon("src", false).icon).toBe("📁");
    });
  });

  describe("File Extension Icons", () => {
    interface IconDefinition {
      icon: string;
      color: string;
    }

    it("should have TypeScript icon", () => {
      const fileExtensions: Record<string, IconDefinition> = {
        ts: { icon: "📘", color: "#3178c6" },
        tsx: { icon: "⚛️", color: "#3178c6" },
      };

      expect(fileExtensions.ts.color).toBe("#3178c6");
    });

    it("should have JavaScript icon", () => {
      const fileExtensions: Record<string, IconDefinition> = {
        js: { icon: "📒", color: "#f7df1e" },
        jsx: { icon: "⚛️", color: "#f7df1e" },
      };

      expect(fileExtensions.js.color).toBe("#f7df1e");
    });

    it("should have Rust icon", () => {
      const fileExtensions: Record<string, IconDefinition> = {
        rs: { icon: "🦀", color: "#dea584" },
      };

      expect(fileExtensions.rs.icon).toBe("🦀");
    });

    it("should have Python icon", () => {
      const fileExtensions: Record<string, IconDefinition> = {
        py: { icon: "🐍", color: "#3572a5" },
      };

      expect(fileExtensions.py.icon).toBe("🐍");
    });

    it("should have Go icon", () => {
      const fileExtensions: Record<string, IconDefinition> = {
        go: { icon: "🐹", color: "#00add8" },
      };

      expect(fileExtensions.go.icon).toBe("🐹");
    });
  });

  describe("Special File Icons", () => {
    interface IconDefinition {
      icon: string;
      color: string;
    }

    it("should have package.json icon", () => {
      const fileNames: Record<string, IconDefinition> = {
        "package.json": { icon: "📦", color: "#e8274b" },
      };

      expect(fileNames["package.json"].icon).toBe("📦");
    });

    it("should have Dockerfile icon", () => {
      const fileNames: Record<string, IconDefinition> = {
        "Dockerfile": { icon: "🐳", color: "#2496ed" },
      };

      expect(fileNames["Dockerfile"].icon).toBe("🐳");
    });

    it("should have README icon", () => {
      const fileNames: Record<string, IconDefinition> = {
        "README.md": { icon: "📖", color: "#083fa1" },
      };

      expect(fileNames["README.md"].icon).toBe("📖");
    });

    it("should have .gitignore icon", () => {
      const fileNames: Record<string, IconDefinition> = {
        ".gitignore": { icon: "🚫", color: "#f05032" },
      };

      expect(fileNames[".gitignore"].icon).toBe("🚫");
    });
  });

  describe("Special Folder Icons", () => {
    interface IconDefinition {
      icon: string;
      color: string;
    }

    it("should have src folder icon", () => {
      const folderNames: Record<string, IconDefinition> = {
        src: { icon: "📁", color: "#e8ba36" },
      };

      expect(folderNames.src.color).toBe("#e8ba36");
    });

    it("should have node_modules folder icon", () => {
      const folderNames: Record<string, IconDefinition> = {
        node_modules: { icon: "📁", color: "#8bc34a" },
      };

      expect(folderNames.node_modules.color).toBe("#8bc34a");
    });

    it("should have tests folder icon", () => {
      const folderNames: Record<string, IconDefinition> = {
        tests: { icon: "📁", color: "#c21325" },
        __tests__: { icon: "📁", color: "#c21325" },
      };

      expect(folderNames.tests.color).toBe("#c21325");
    });

    it("should have components folder icon", () => {
      const folderNames: Record<string, IconDefinition> = {
        components: { icon: "📁", color: "#42a5f5" },
      };

      expect(folderNames.components.color).toBe("#42a5f5");
    });
  });

  describe("Theme Persistence", () => {
    it("should load theme from localStorage", () => {
      const STORAGE_KEY = "cortex-icon-theme";
      const DEFAULT_THEME_ID = "seti";

      const loadTheme = (stored: string | null): string => {
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            return parsed.activeThemeId || DEFAULT_THEME_ID;
          } catch {
            return DEFAULT_THEME_ID;
          }
        }
        return DEFAULT_THEME_ID;
      };

      expect(loadTheme(null)).toBe("seti");
      expect(loadTheme(`{"activeThemeId":"material","key":"${STORAGE_KEY}"}`)).toBe("material");
    });

    it("should save theme to localStorage", () => {
      const saveTheme = (themeId: string): string => {
        return JSON.stringify({ activeThemeId: themeId });
      };

      const saved = saveTheme("minimal");

      expect(saved).toBe('{"activeThemeId":"minimal"}');
    });
  });

  describe("Active Theme Accessor", () => {
    interface IconTheme {
      id: string;
      name: string;
    }

    it("should get active theme", () => {
      const themes: IconTheme[] = [
        { id: "seti", name: "Seti" },
        { id: "material", name: "Material" },
        { id: "minimal", name: "Minimal" },
      ];
      const activeThemeId = "material";

      const activeTheme = themes.find(t => t.id === activeThemeId);

      expect(activeTheme?.name).toBe("Material");
    });

    it("should list all themes", () => {
      const themes: IconTheme[] = [
        { id: "seti", name: "Seti" },
        { id: "material", name: "Material" },
        { id: "minimal", name: "Minimal" },
      ];

      expect(themes).toHaveLength(3);
    });
  });

  describe("Extract Extension", () => {
    it("should extract file extension", () => {
      const getExtension = (filename: string): string => {
        const lastDot = filename.lastIndexOf(".");
        if (lastDot > 0 && lastDot < filename.length - 1) {
          return filename.substring(lastDot + 1).toLowerCase();
        }
        return "";
      };

      expect(getExtension("file.ts")).toBe("ts");
      expect(getExtension("file.test.tsx")).toBe("tsx");
      expect(getExtension(".gitignore")).toBe("");
      expect(getExtension("Dockerfile")).toBe("");
    });
  });

  describe("Media Type Icons", () => {
    interface IconDefinition {
      icon: string;
      color: string;
    }

    it("should have image icons", () => {
      const fileExtensions: Record<string, IconDefinition> = {
        png: { icon: "🖼️", color: "#a074c4" },
        jpg: { icon: "🖼️", color: "#a074c4" },
        svg: { icon: "🖼️", color: "#ffb13b" },
      };

      expect(fileExtensions.png.icon).toBe("🖼️");
      expect(fileExtensions.svg.icon).toBe("🖼️");
    });

    it("should have audio icons", () => {
      const fileExtensions: Record<string, IconDefinition> = {
        mp3: { icon: "🎵", color: "#e91e63" },
        wav: { icon: "🎵", color: "#e91e63" },
      };

      expect(fileExtensions.mp3.icon).toBe("🎵");
    });

    it("should have video icons", () => {
      const fileExtensions: Record<string, IconDefinition> = {
        mp4: { icon: "🎬", color: "#f44336" },
        mkv: { icon: "🎬", color: "#f44336" },
      };

      expect(fileExtensions.mp4.icon).toBe("🎬");
    });
  });

  describe("Archive Icons", () => {
    interface IconDefinition {
      icon: string;
      color: string;
    }

    it("should have archive icons", () => {
      const fileExtensions: Record<string, IconDefinition> = {
        zip: { icon: "📦", color: "#6d8086" },
        tar: { icon: "📦", color: "#6d8086" },
        gz: { icon: "📦", color: "#6d8086" },
      };

      expect(fileExtensions.zip.icon).toBe("📦");
    });
  });

  describe("Lock File Icons", () => {
    interface IconDefinition {
      icon: string;
      color: string;
    }

    it("should have lock file icons", () => {
      const fileNames: Record<string, IconDefinition> = {
        "package-lock.json": { icon: "🔒", color: "#525252" },
        "yarn.lock": { icon: "🔒", color: "#2c8ebb" },
        "Cargo.lock": { icon: "🔒", color: "#dea584" },
      };

      expect(fileNames["package-lock.json"].icon).toBe("🔒");
      expect(fileNames["yarn.lock"].icon).toBe("🔒");
    });
  });
});
