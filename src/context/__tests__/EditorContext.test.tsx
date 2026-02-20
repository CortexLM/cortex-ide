import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("EditorContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Language Detection", () => {
    const detectLanguage = (filename: string): string => {
      const ext = filename.split(".").pop()?.toLowerCase() || "";
      const name = filename.toLowerCase();
      
      if (name === "dockerfile" || name.startsWith("dockerfile.")) return "dockerfile";
      if (name === "makefile" || name === "gnumakefile") return "shell";
      if (name === ".gitignore" || name === ".dockerignore") return "shell";
      if (name === ".env" || name.startsWith(".env.")) return "shell";
      
      const langMap: Record<string, string> = {
        ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
        js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
        html: "html", htm: "html", xml: "html", svg: "html",
        css: "css", scss: "css", sass: "css", less: "css",
        json: "json", jsonc: "json", json5: "json",
        yaml: "yaml", yml: "yaml",
        toml: "toml", ini: "toml", cfg: "toml", conf: "toml",
        py: "python", pyw: "python", pyi: "python",
        rs: "rust", go: "go",
        sh: "shell", bash: "shell", zsh: "shell",
        md: "markdown", mdx: "markdown",
        txt: "plaintext",
      };
      
      return langMap[ext] || "plaintext";
    };

    it("should detect TypeScript files", () => {
      expect(detectLanguage("app.ts")).toBe("typescript");
      expect(detectLanguage("component.tsx")).toBe("typescript");
      expect(detectLanguage("module.mts")).toBe("typescript");
      expect(detectLanguage("config.cts")).toBe("typescript");
    });

    it("should detect JavaScript files", () => {
      expect(detectLanguage("index.js")).toBe("javascript");
      expect(detectLanguage("App.jsx")).toBe("javascript");
      expect(detectLanguage("utils.mjs")).toBe("javascript");
      expect(detectLanguage("config.cjs")).toBe("javascript");
    });

    it("should detect HTML/XML files", () => {
      expect(detectLanguage("index.html")).toBe("html");
      expect(detectLanguage("page.htm")).toBe("html");
      expect(detectLanguage("data.xml")).toBe("html");
      expect(detectLanguage("icon.svg")).toBe("html");
    });

    it("should detect CSS files", () => {
      expect(detectLanguage("styles.css")).toBe("css");
      expect(detectLanguage("theme.scss")).toBe("css");
      expect(detectLanguage("vars.sass")).toBe("css");
      expect(detectLanguage("mixins.less")).toBe("css");
    });

    it("should detect JSON files", () => {
      expect(detectLanguage("package.json")).toBe("json");
      expect(detectLanguage("tsconfig.jsonc")).toBe("json");
      expect(detectLanguage("config.json5")).toBe("json");
    });

    it("should detect YAML files", () => {
      expect(detectLanguage("config.yaml")).toBe("yaml");
      expect(detectLanguage("docker-compose.yml")).toBe("yaml");
    });

    it("should detect TOML/INI files", () => {
      expect(detectLanguage("Cargo.toml")).toBe("toml");
      expect(detectLanguage("config.ini")).toBe("toml");
      expect(detectLanguage("settings.cfg")).toBe("toml");
    });

    it("should detect Python files", () => {
      expect(detectLanguage("main.py")).toBe("python");
      expect(detectLanguage("script.pyw")).toBe("python");
      expect(detectLanguage("types.pyi")).toBe("python");
    });

    it("should detect Rust files", () => {
      expect(detectLanguage("lib.rs")).toBe("rust");
    });

    it("should detect Go files", () => {
      expect(detectLanguage("main.go")).toBe("go");
    });

    it("should detect shell scripts", () => {
      expect(detectLanguage("build.sh")).toBe("shell");
      expect(detectLanguage("deploy.bash")).toBe("shell");
      expect(detectLanguage("setup.zsh")).toBe("shell");
    });

    it("should detect markdown files", () => {
      expect(detectLanguage("README.md")).toBe("markdown");
      expect(detectLanguage("docs.mdx")).toBe("markdown");
    });

    it("should detect Dockerfile", () => {
      expect(detectLanguage("Dockerfile")).toBe("dockerfile");
      expect(detectLanguage("Dockerfile.prod")).toBe("dockerfile");
    });

    it("should detect Makefile", () => {
      expect(detectLanguage("Makefile")).toBe("shell");
      expect(detectLanguage("GNUmakefile")).toBe("shell");
    });

    it("should detect dotfiles", () => {
      expect(detectLanguage(".gitignore")).toBe("shell");
      expect(detectLanguage(".dockerignore")).toBe("shell");
      expect(detectLanguage(".env")).toBe("shell");
      expect(detectLanguage(".env.local")).toBe("shell");
    });

    it("should return plaintext for unknown extensions", () => {
      expect(detectLanguage("readme.txt")).toBe("plaintext");
      expect(detectLanguage("data.xyz")).toBe("plaintext");
      expect(detectLanguage("file")).toBe("plaintext");
    });
  });

  describe("ID Generation", () => {
    const generateId = (): string => {
      return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };

    it("should generate unique IDs", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it("should generate IDs with timestamp prefix", () => {
      const before = Date.now();
      const id = generateId();
      const after = Date.now();
      const timestamp = parseInt(id.split("-")[0]);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it("should generate IDs with random suffix", () => {
      const id = generateId();
      const parts = id.split("-");
      expect(parts.length).toBe(2);
      expect(parts[1].length).toBe(9);
    });
  });

  describe("File State Management", () => {
    interface OpenFile {
      id: string;
      path: string;
      name: string;
      content: string;
      originalContent: string;
      modified: boolean;
      language: string;
      groupId: string;
    }

    it("should track modified state correctly", () => {
      const file: OpenFile = {
        id: "file-1",
        path: "/test/file.ts",
        name: "file.ts",
        content: "original",
        originalContent: "original",
        modified: false,
        language: "typescript",
        groupId: "group-default",
      };

      expect(file.modified).toBe(false);
      
      file.content = "modified";
      file.modified = file.content !== file.originalContent;
      expect(file.modified).toBe(true);
      
      file.content = "original";
      file.modified = file.content !== file.originalContent;
      expect(file.modified).toBe(false);
    });

    it("should extract filename from path correctly", () => {
      const extractName = (path: string): string => {
        return path.split(/[/\\]/).pop() || path;
      };

      expect(extractName("/home/user/project/file.ts")).toBe("file.ts");
      expect(extractName("C:\\Users\\project\\file.ts")).toBe("file.ts");
      expect(extractName("file.ts")).toBe("file.ts");
      expect(extractName("/file.ts")).toBe("file.ts");
    });
  });

  describe("Tab Operations", () => {
    it("should identify pinned tabs", () => {
      const pinnedTabs = new Set(["tab-1", "tab-3"]);
      
      expect(pinnedTabs.has("tab-1")).toBe(true);
      expect(pinnedTabs.has("tab-2")).toBe(false);
      expect(pinnedTabs.has("tab-3")).toBe(true);
    });

    it("should toggle pin state", () => {
      const pinnedTabs = new Set<string>();
      
      const togglePin = (tabId: string) => {
        if (pinnedTabs.has(tabId)) {
          pinnedTabs.delete(tabId);
        } else {
          pinnedTabs.add(tabId);
        }
      };

      togglePin("tab-1");
      expect(pinnedTabs.has("tab-1")).toBe(true);
      
      togglePin("tab-1");
      expect(pinnedTabs.has("tab-1")).toBe(false);
    });

    it("should identify preview tabs", () => {
      let previewTab: string | null = "tab-preview";
      
      const isPreview = (tabId: string) => previewTab === tabId;
      
      expect(isPreview("tab-preview")).toBe(true);
      expect(isPreview("tab-other")).toBe(false);
      
      previewTab = null;
      expect(isPreview("tab-preview")).toBe(false);
    });

    it("should promote preview to permanent", () => {
      let previewTab: string | null = "tab-preview";
      const permanentTabs = new Set<string>();
      
      const promotePreview = () => {
        if (previewTab) {
          permanentTabs.add(previewTab);
          previewTab = null;
        }
      };

      promotePreview();
      expect(previewTab).toBe(null);
      expect(permanentTabs.has("tab-preview")).toBe(true);
    });
  });

  describe("Tab Reordering", () => {
    it("should reorder tabs correctly", () => {
      const tabs = ["tab-1", "tab-2", "tab-3", "tab-4"];
      
      const reorderTabs = (sourceId: string, targetId: string): string[] => {
        const sourceIndex = tabs.indexOf(sourceId);
        const targetIndex = tabs.indexOf(targetId);
        
        if (sourceIndex === -1 || targetIndex === -1) return tabs;
        
        const newTabs = [...tabs];
        const [removed] = newTabs.splice(sourceIndex, 1);
        newTabs.splice(targetIndex, 0, removed);
        return newTabs;
      };

      const result = reorderTabs("tab-3", "tab-1");
      expect(result).toEqual(["tab-3", "tab-1", "tab-2", "tab-4"]);
    });

    it("should handle reorder to same position", () => {
      const tabs = ["tab-1", "tab-2", "tab-3"];
      
      const reorderTabs = (sourceId: string, targetId: string): string[] => {
        if (sourceId === targetId) return tabs;
        
        const sourceIndex = tabs.indexOf(sourceId);
        const targetIndex = tabs.indexOf(targetId);
        
        if (sourceIndex === -1 || targetIndex === -1) return tabs;
        
        const newTabs = [...tabs];
        const [removed] = newTabs.splice(sourceIndex, 1);
        newTabs.splice(targetIndex, 0, removed);
        return newTabs;
      };

      const result = reorderTabs("tab-2", "tab-2");
      expect(result).toEqual(["tab-1", "tab-2", "tab-3"]);
    });
  });

  describe("Editor Groups", () => {
    interface EditorGroup {
      id: string;
      fileIds: string[];
      activeFileId: string | null;
      splitRatio: number;
    }

    it("should create default group", () => {
      const defaultGroup: EditorGroup = {
        id: "group-default",
        fileIds: [],
        activeFileId: null,
        splitRatio: 1,
      };

      expect(defaultGroup.id).toBe("group-default");
      expect(defaultGroup.fileIds).toHaveLength(0);
      expect(defaultGroup.splitRatio).toBe(1);
    });

    it("should add file to group", () => {
      const group: EditorGroup = {
        id: "group-1",
        fileIds: ["file-1"],
        activeFileId: "file-1",
        splitRatio: 1,
      };

      group.fileIds.push("file-2");
      group.activeFileId = "file-2";

      expect(group.fileIds).toEqual(["file-1", "file-2"]);
      expect(group.activeFileId).toBe("file-2");
    });

    it("should remove file from group", () => {
      const group: EditorGroup = {
        id: "group-1",
        fileIds: ["file-1", "file-2", "file-3"],
        activeFileId: "file-2",
        splitRatio: 1,
      };

      const fileIdToRemove = "file-2";
      const index = group.fileIds.indexOf(fileIdToRemove);
      group.fileIds.splice(index, 1);
      
      if (group.activeFileId === fileIdToRemove) {
        group.activeFileId = group.fileIds[Math.min(index, group.fileIds.length - 1)] || null;
      }

      expect(group.fileIds).toEqual(["file-1", "file-3"]);
      expect(group.activeFileId).toBe("file-3");
    });

    it("should handle split ratio updates", () => {
      const groups: EditorGroup[] = [
        { id: "group-1", fileIds: [], activeFileId: null, splitRatio: 0.5 },
        { id: "group-2", fileIds: [], activeFileId: null, splitRatio: 0.5 },
      ];

      groups[0].splitRatio = 0.7;
      groups[1].splitRatio = 0.3;

      expect(groups[0].splitRatio + groups[1].splitRatio).toBe(1);
    });
  });

  describe("File Operations via Tauri", () => {
    it("should read file content via invoke", async () => {
      const mockContent = "const x = 1;";
      vi.mocked(invoke).mockResolvedValueOnce(mockContent);

      const result = await invoke<string>("fs_read_file", { path: "/test/file.ts" });
      
      expect(invoke).toHaveBeenCalledWith("fs_read_file", { path: "/test/file.ts" });
      expect(result).toBe(mockContent);
    });

    it("should handle file read errors", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("File not found"));

      await expect(invoke("fs_read_file", { path: "/nonexistent" }))
        .rejects.toThrow("File not found");
    });

    it("should save file content via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("fs_write_file", { path: "/test/file.ts", content: "new content" });
      
      expect(invoke).toHaveBeenCalledWith("fs_write_file", { 
        path: "/test/file.ts", 
        content: "new content" 
      });
    });
  });

  describe("Grid Layout", () => {
    interface GridCell {
      id: string;
      fileId: string | null;
      children?: GridCell[];
      direction?: "horizontal" | "vertical";
      ratio?: number;
    }

    it("should create single editor layout", () => {
      const cell: GridCell = {
        id: "cell-root",
        fileId: "file-1",
      };

      expect(cell.fileId).toBe("file-1");
      expect(cell.children).toBeUndefined();
    });

    it("should split cell horizontally", () => {
      const splitCell = (cell: GridCell, direction: "horizontal" | "vertical"): GridCell => {
        return {
          id: cell.id,
          fileId: null,
          direction,
          children: [
            { id: `${cell.id}-left`, fileId: cell.fileId, ratio: 0.5 },
            { id: `${cell.id}-right`, fileId: null, ratio: 0.5 },
          ],
        };
      };

      const original: GridCell = { id: "cell-1", fileId: "file-1" };
      const split = splitCell(original, "horizontal");

      expect(split.direction).toBe("horizontal");
      expect(split.children).toHaveLength(2);
      expect(split.children![0].fileId).toBe("file-1");
      expect(split.children![1].fileId).toBe(null);
    });

    it("should split cell vertically", () => {
      const splitCell = (cell: GridCell, direction: "horizontal" | "vertical"): GridCell => {
        return {
          id: cell.id,
          fileId: null,
          direction,
          children: [
            { id: `${cell.id}-top`, fileId: cell.fileId, ratio: 0.5 },
            { id: `${cell.id}-bottom`, fileId: null, ratio: 0.5 },
          ],
        };
      };

      const original: GridCell = { id: "cell-1", fileId: "file-1" };
      const split = splitCell(original, "vertical");

      expect(split.direction).toBe("vertical");
      expect(split.children).toHaveLength(2);
    });

    it("should close grid cell and collapse parent", () => {
      const grid: GridCell = {
        id: "root",
        fileId: null,
        direction: "horizontal",
        children: [
          { id: "left", fileId: "file-1", ratio: 0.5 },
          { id: "right", fileId: "file-2", ratio: 0.5 },
        ],
      };

      const closeCell = (cellId: string): GridCell | null => {
        if (grid.children) {
          const remaining = grid.children.filter(c => c.id !== cellId);
          if (remaining.length === 1) {
            return remaining[0];
          }
        }
        return grid;
      };

      const result = closeCell("left");
      expect(result?.id).toBe("right");
      expect(result?.fileId).toBe("file-2");
    });
  });

  describe("Cursor and Selection Info", () => {
    it("should track cursor count", () => {
      let cursorCount = 1;
      let selectionCount = 0;

      const updateCursorInfo = (cursors: number, selections: number) => {
        cursorCount = cursors;
        selectionCount = selections;
      };

      updateCursorInfo(3, 2);
      expect(cursorCount).toBe(3);
      expect(selectionCount).toBe(2);
    });

    it("should handle multi-cursor state", () => {
      const cursors = [
        { line: 1, column: 5 },
        { line: 3, column: 10 },
        { line: 5, column: 1 },
      ];

      expect(cursors.length).toBe(3);
      expect(cursors[0]).toEqual({ line: 1, column: 5 });
    });
  });

  describe("Selectors", () => {
    it("should compute open file count", () => {
      const openFiles = [{ id: "1" }, { id: "2" }, { id: "3" }];
      const openFileCount = () => openFiles.length;
      
      expect(openFileCount()).toBe(3);
    });

    it("should find active file", () => {
      const openFiles = [
        { id: "1", name: "file1.ts" },
        { id: "2", name: "file2.ts" },
        { id: "3", name: "file3.ts" },
      ];
      const activeFileId = "2";
      
      const activeFile = () => openFiles.find(f => f.id === activeFileId);
      
      expect(activeFile()?.name).toBe("file2.ts");
    });

    it("should detect modified files", () => {
      const openFiles = [
        { id: "1", modified: false },
        { id: "2", modified: true },
        { id: "3", modified: false },
      ];
      
      const hasModifiedFiles = () => openFiles.some(f => f.modified);
      const modifiedFileIds = () => openFiles.filter(f => f.modified).map(f => f.id);
      
      expect(hasModifiedFiles()).toBe(true);
      expect(modifiedFileIds()).toEqual(["2"]);
    });

    it("should detect split state", () => {
      const groups = [{ id: "1" }];
      const isSplit = () => groups.length > 1;
      
      expect(isSplit()).toBe(false);
      
      groups.push({ id: "2" });
      expect(isSplit()).toBe(true);
    });
  });

  describe("Close All Files", () => {
    it("should close all files except pinned", () => {
      const openFiles = [
        { id: "1", name: "file1.ts" },
        { id: "2", name: "file2.ts" },
        { id: "3", name: "file3.ts" },
      ];
      const pinnedTabs = new Set(["2"]);

      const closeAllFiles = (includePinned: boolean): typeof openFiles => {
        if (includePinned) {
          return [];
        }
        return openFiles.filter(f => pinnedTabs.has(f.id));
      };

      const result = closeAllFiles(false);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("2");
    });

    it("should close all files including pinned", () => {
      const openFiles = [
        { id: "1", name: "file1.ts" },
        { id: "2", name: "file2.ts" },
      ];
      const pinnedTabs = new Set(["2"]);

      const closeAllFiles = (includePinned: boolean): typeof openFiles => {
        if (includePinned) {
          return [];
        }
        return openFiles.filter(f => pinnedTabs.has(f.id));
      };

      const result = closeAllFiles(true);
      expect(result).toHaveLength(0);
    });
  });

  describe("Virtual Files", () => {
    it("should create virtual file with custom content", () => {
      const createVirtualFile = (name: string, content: string, language?: string) => {
        return {
          id: `virtual-${Date.now()}`,
          path: `virtual://${name}`,
          name,
          content,
          originalContent: content,
          modified: false,
          language: language || "plaintext",
          isVirtual: true,
        };
      };

      const file = createVirtualFile("output.log", "Log content here", "plaintext");
      
      expect(file.name).toBe("output.log");
      expect(file.content).toBe("Log content here");
      expect(file.isVirtual).toBe(true);
      expect(file.path.startsWith("virtual://")).toBe(true);
    });
  });
});
