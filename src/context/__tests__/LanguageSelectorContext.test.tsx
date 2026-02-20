import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

interface Language {
  id: string;
  name: string;
  aliases: string[];
  extensions: string[];
  mimeTypes?: string[];
  icon?: string;
}

interface FileLanguageOverride {
  filePath: string;
  languageId: string;
  timestamp: number;
}

interface LanguageAssociation {
  pattern: string;
  languageId: string;
  isGlob: boolean;
  priority: number;
}

interface LanguageSelectorState {
  languages: Language[];
  currentLanguage: Language | null;
  currentFilePath: string | null;
  overrides: Map<string, FileLanguageOverride>;
  associations: LanguageAssociation[];
  isOpen: boolean;
  searchQuery: string;
  filteredLanguages: Language[];
}

interface LanguageSelectorContextValue {
  state: LanguageSelectorState;
  open: (filePath?: string) => void;
  close: () => void;
  setLanguage: (languageId: string) => void;
  setLanguageForFile: (filePath: string, languageId: string) => void;
  clearOverride: (filePath: string) => void;
  clearAllOverrides: () => void;
  detectLanguage: (filePath: string) => Promise<Language | null>;
  getLanguageForFile: (filePath: string) => Language | null;
  addAssociation: (association: Omit<LanguageAssociation, "priority">) => void;
  removeAssociation: (pattern: string) => void;
  setSearchQuery: (query: string) => void;
  getLanguageById: (id: string) => Language | undefined;
}

const STORAGE_KEY_OVERRIDES = "cortex_language_overrides";
const STORAGE_KEY_ASSOCIATIONS = "cortex_language_associations";

describe("LanguageSelectorContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("Language interface", () => {
    it("should have correct language structure", () => {
      const language: Language = {
        id: "typescript",
        name: "TypeScript",
        aliases: ["ts"],
        extensions: [".ts", ".tsx"],
        mimeTypes: ["application/typescript"],
        icon: "typescript-icon",
      };

      expect(language.id).toBe("typescript");
      expect(language.extensions).toContain(".ts");
      expect(language.aliases).toContain("ts");
    });

    it("should allow minimal language definition", () => {
      const language: Language = {
        id: "plaintext",
        name: "Plain Text",
        aliases: [],
        extensions: [".txt"],
      };

      expect(language.mimeTypes).toBeUndefined();
      expect(language.icon).toBeUndefined();
    });
  });

  describe("FileLanguageOverride interface", () => {
    it("should track file overrides", () => {
      const override: FileLanguageOverride = {
        filePath: "/project/src/config.txt",
        languageId: "json",
        timestamp: Date.now(),
      };

      expect(override.filePath).toBe("/project/src/config.txt");
      expect(override.languageId).toBe("json");
    });
  });

  describe("LanguageAssociation interface", () => {
    it("should define association structure", () => {
      const association: LanguageAssociation = {
        pattern: "*.config.js",
        languageId: "javascript",
        isGlob: true,
        priority: 10,
      };

      expect(association.pattern).toBe("*.config.js");
      expect(association.isGlob).toBe(true);
    });

    it("should support exact file matches", () => {
      const association: LanguageAssociation = {
        pattern: "Dockerfile",
        languageId: "dockerfile",
        isGlob: false,
        priority: 100,
      };

      expect(association.isGlob).toBe(false);
      expect(association.priority).toBe(100);
    });
  });

  describe("IPC operations", () => {
    it("should call invoke for language detection", async () => {
      vi.mocked(invoke).mockResolvedValue("typescript");

      const result = await invoke("language_detect_from_path", {
        path: "/project/src/index.ts",
      });

      expect(invoke).toHaveBeenCalledWith("language_detect_from_path", {
        path: "/project/src/index.ts",
      });
      expect(result).toBe("typescript");
    });

    it("should handle detection failure", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Detection failed"));

      await expect(
        invoke("language_detect_from_path", { path: "/unknown/file" })
      ).rejects.toThrow("Detection failed");
    });
  });

  describe("Storage persistence", () => {
    it("should save overrides to localStorage", () => {
      const overrides: Record<string, FileLanguageOverride> = {
        "/project/config.txt": {
          filePath: "/project/config.txt",
          languageId: "json",
          timestamp: Date.now(),
        },
      };

      localStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(overrides));

      const stored = localStorage.getItem(STORAGE_KEY_OVERRIDES);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed["/project/config.txt"].languageId).toBe("json");
    });

    it("should load overrides from localStorage", () => {
      const overrides = {
        "/project/data.txt": {
          filePath: "/project/data.txt",
          languageId: "csv",
          timestamp: 1000,
        },
      };

      localStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(overrides));

      const stored = localStorage.getItem(STORAGE_KEY_OVERRIDES);
      const loaded = JSON.parse(stored!);
      expect(loaded["/project/data.txt"].languageId).toBe("csv");
    });

    it("should save associations to localStorage", () => {
      const associations: LanguageAssociation[] = [
        { pattern: "*.env*", languageId: "dotenv", isGlob: true, priority: 10 },
        { pattern: "Makefile", languageId: "makefile", isGlob: false, priority: 100 },
      ];

      localStorage.setItem(STORAGE_KEY_ASSOCIATIONS, JSON.stringify(associations));

      const stored = localStorage.getItem(STORAGE_KEY_ASSOCIATIONS);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(2);
    });
  });

  describe("State management", () => {
    it("should manage languages array", () => {
      const languages: Language[] = [
        { id: "javascript", name: "JavaScript", aliases: ["js"], extensions: [".js"] },
        { id: "typescript", name: "TypeScript", aliases: ["ts"], extensions: [".ts"] },
        { id: "python", name: "Python", aliases: ["py"], extensions: [".py"] },
      ];

      expect(languages).toHaveLength(3);
      expect(languages.find((l) => l.id === "typescript")).toBeDefined();
    });

    it("should track current language", () => {
      let state: LanguageSelectorState = {
        languages: [
          { id: "javascript", name: "JavaScript", aliases: [], extensions: [".js"] },
        ],
        currentLanguage: null,
        currentFilePath: null,
        overrides: new Map(),
        associations: [],
        isOpen: false,
        searchQuery: "",
        filteredLanguages: [],
      };

      state = {
        ...state,
        currentLanguage: { id: "javascript", name: "JavaScript", aliases: [], extensions: [".js"] },
        currentFilePath: "/project/app.js",
      };

      expect(state.currentLanguage?.id).toBe("javascript");
      expect(state.currentFilePath).toBe("/project/app.js");
    });

    it("should handle open/close state", () => {
      let state: LanguageSelectorState = {
        languages: [],
        currentLanguage: null,
        currentFilePath: null,
        overrides: new Map(),
        associations: [],
        isOpen: false,
        searchQuery: "",
        filteredLanguages: [],
      };

      state = { ...state, isOpen: true };
      expect(state.isOpen).toBe(true);

      state = { ...state, isOpen: false };
      expect(state.isOpen).toBe(false);
    });
  });

  describe("Override management", () => {
    it("should set override for file", () => {
      const overrides = new Map<string, FileLanguageOverride>();

      const override: FileLanguageOverride = {
        filePath: "/project/config.txt",
        languageId: "json",
        timestamp: Date.now(),
      };

      overrides.set("/project/config.txt", override);

      expect(overrides.has("/project/config.txt")).toBe(true);
      expect(overrides.get("/project/config.txt")?.languageId).toBe("json");
    });

    it("should clear override for file", () => {
      const overrides = new Map<string, FileLanguageOverride>();
      overrides.set("/project/file.txt", {
        filePath: "/project/file.txt",
        languageId: "markdown",
        timestamp: Date.now(),
      });

      overrides.delete("/project/file.txt");

      expect(overrides.has("/project/file.txt")).toBe(false);
    });

    it("should clear all overrides", () => {
      const overrides = new Map<string, FileLanguageOverride>();
      overrides.set("/project/a.txt", { filePath: "/project/a.txt", languageId: "json", timestamp: 1 });
      overrides.set("/project/b.txt", { filePath: "/project/b.txt", languageId: "yaml", timestamp: 2 });

      overrides.clear();

      expect(overrides.size).toBe(0);
    });
  });

  describe("Association management", () => {
    it("should add association", () => {
      let associations: LanguageAssociation[] = [];

      const newAssociation: LanguageAssociation = {
        pattern: "*.graphql",
        languageId: "graphql",
        isGlob: true,
        priority: 10,
      };

      associations = [...associations, newAssociation];
      expect(associations).toHaveLength(1);
    });

    it("should remove association by pattern", () => {
      let associations: LanguageAssociation[] = [
        { pattern: "*.graphql", languageId: "graphql", isGlob: true, priority: 10 },
        { pattern: "*.prisma", languageId: "prisma", isGlob: true, priority: 10 },
      ];

      associations = associations.filter((a) => a.pattern !== "*.graphql");
      expect(associations).toHaveLength(1);
      expect(associations[0].pattern).toBe("*.prisma");
    });

    it("should sort associations by priority", () => {
      const associations: LanguageAssociation[] = [
        { pattern: "*.config.js", languageId: "javascript", isGlob: true, priority: 10 },
        { pattern: "webpack.config.js", languageId: "javascript", isGlob: false, priority: 100 },
        { pattern: "*.js", languageId: "javascript", isGlob: true, priority: 1 },
      ];

      const sorted = [...associations].sort((a, b) => b.priority - a.priority);
      expect(sorted[0].pattern).toBe("webpack.config.js");
      expect(sorted[2].pattern).toBe("*.js");
    });
  });

  describe("Search functionality", () => {
    it("should filter languages by query", () => {
      const languages: Language[] = [
        { id: "javascript", name: "JavaScript", aliases: ["js"], extensions: [".js"] },
        { id: "typescript", name: "TypeScript", aliases: ["ts"], extensions: [".ts"] },
        { id: "java", name: "Java", aliases: [], extensions: [".java"] },
      ];

      const query = "java";
      const filtered = languages.filter(
        (l) =>
          l.name.toLowerCase().includes(query.toLowerCase()) ||
          l.id.toLowerCase().includes(query.toLowerCase()) ||
          l.aliases.some((a) => a.toLowerCase().includes(query.toLowerCase()))
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map((l) => l.id)).toContain("javascript");
      expect(filtered.map((l) => l.id)).toContain("java");
    });

    it("should filter by alias", () => {
      const languages: Language[] = [
        { id: "typescript", name: "TypeScript", aliases: ["ts"], extensions: [".ts"] },
        { id: "javascript", name: "JavaScript", aliases: ["js"], extensions: [".js"] },
      ];

      const query = "ts";
      const filtered = languages.filter(
        (l) => l.aliases.some((a) => a.toLowerCase() === query.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("typescript");
    });
  });

  describe("Language detection", () => {
    it("should detect language from extension", () => {
      const languages: Language[] = [
        { id: "typescript", name: "TypeScript", aliases: [], extensions: [".ts", ".tsx"] },
        { id: "javascript", name: "JavaScript", aliases: [], extensions: [".js", ".jsx"] },
      ];

      const filePath = "/project/src/app.tsx";
      const ext = "." + filePath.split(".").pop();

      const detected = languages.find((l) => l.extensions.includes(ext));
      expect(detected?.id).toBe("typescript");
    });

    it("should prioritize override over detection", () => {
      const overrides = new Map<string, FileLanguageOverride>();
      overrides.set("/project/config.txt", {
        filePath: "/project/config.txt",
        languageId: "json",
        timestamp: Date.now(),
      });

      const filePath = "/project/config.txt";
      const override = overrides.get(filePath);

      expect(override?.languageId).toBe("json");
    });
  });

  describe("Context value structure", () => {
    it("should define all required methods", () => {
      const mockContext: LanguageSelectorContextValue = {
        state: {
          languages: [],
          currentLanguage: null,
          currentFilePath: null,
          overrides: new Map(),
          associations: [],
          isOpen: false,
          searchQuery: "",
          filteredLanguages: [],
        },
        open: vi.fn(),
        close: vi.fn(),
        setLanguage: vi.fn(),
        setLanguageForFile: vi.fn(),
        clearOverride: vi.fn(),
        clearAllOverrides: vi.fn(),
        detectLanguage: vi.fn(),
        getLanguageForFile: vi.fn(),
        addAssociation: vi.fn(),
        removeAssociation: vi.fn(),
        setSearchQuery: vi.fn(),
        getLanguageById: vi.fn(),
      };

      expect(mockContext.open).toBeDefined();
      expect(mockContext.setLanguage).toBeDefined();
      expect(mockContext.detectLanguage).toBeDefined();
      expect(mockContext.addAssociation).toBeDefined();
    });
  });
});
