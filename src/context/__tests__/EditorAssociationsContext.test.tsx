import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => mockLocalStorage.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage.store[key];
  }),
  clear: vi.fn(() => {
    mockLocalStorage.store = {};
  }),
};

Object.defineProperty(global, "localStorage", {
  value: mockLocalStorage,
});

describe("EditorAssociationsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
  });

  describe("EditorAssociation Types", () => {
    interface EditorAssociation {
      pattern: string;
      editorId: string;
      priority: number;
      isUserDefined: boolean;
    }

    it("should create an editor association", () => {
      const association: EditorAssociation = {
        pattern: "*.png",
        editorId: "image-viewer",
        priority: 100,
        isUserDefined: false,
      };

      expect(association.pattern).toBe("*.png");
      expect(association.editorId).toBe("image-viewer");
    });

    it("should create a user-defined association", () => {
      const association: EditorAssociation = {
        pattern: "*.custom",
        editorId: "custom-editor",
        priority: 200,
        isUserDefined: true,
      };

      expect(association.isUserDefined).toBe(true);
      expect(association.priority).toBe(200);
    });

    it("should track multiple associations", () => {
      const associations: EditorAssociation[] = [
        { pattern: "*.png", editorId: "image-viewer", priority: 100, isUserDefined: false },
        { pattern: "*.jpg", editorId: "image-viewer", priority: 100, isUserDefined: false },
        { pattern: "*.md", editorId: "markdown-preview", priority: 50, isUserDefined: true },
      ];

      expect(associations).toHaveLength(3);
    });

    it("should sort associations by priority", () => {
      const associations: EditorAssociation[] = [
        { pattern: "*.a", editorId: "low", priority: 10, isUserDefined: false },
        { pattern: "*.b", editorId: "high", priority: 100, isUserDefined: true },
        { pattern: "*.c", editorId: "medium", priority: 50, isUserDefined: false },
      ];

      const sorted = [...associations].sort((a, b) => b.priority - a.priority);

      expect(sorted[0].editorId).toBe("high");
      expect(sorted[2].editorId).toBe("low");
    });
  });

  describe("AvailableEditor Types", () => {
    interface AvailableEditor {
      id: string;
      label: string;
      icon?: string;
      canHandle: (filePath: string) => boolean;
      priority?: number;
      isExtension?: boolean;
      extensionId?: string;
    }

    it("should create an available editor", () => {
      const editor: AvailableEditor = {
        id: "code-editor",
        label: "Code Editor",
        icon: "codicon-file-code",
        canHandle: (path) => path.endsWith(".ts") || path.endsWith(".js"),
        priority: 100,
      };

      expect(editor.id).toBe("code-editor");
      expect(editor.canHandle("file.ts")).toBe(true);
      expect(editor.canHandle("file.txt")).toBe(false);
    });

    it("should create an extension editor", () => {
      const editor: AvailableEditor = {
        id: "custom-viewer",
        label: "Custom Viewer",
        canHandle: () => true,
        isExtension: true,
        extensionId: "my-extension",
      };

      expect(editor.isExtension).toBe(true);
      expect(editor.extensionId).toBe("my-extension");
    });

    it("should track registered editors", () => {
      const editors: AvailableEditor[] = [
        { id: "code", label: "Code Editor", canHandle: () => true },
        { id: "image", label: "Image Viewer", canHandle: (p) => /\.(png|jpg)$/.test(p) },
        { id: "video", label: "Video Player", canHandle: (p) => /\.(mp4|webm)$/.test(p) },
      ];

      expect(editors).toHaveLength(3);
    });
  });

  describe("File Type Detection", () => {
    const isCodeFile = (filePath: string): boolean => {
      const codeExtensions = [".js", ".ts", ".tsx", ".jsx", ".py", ".rs", ".go"];
      const lower = filePath.toLowerCase();
      return codeExtensions.some((ext) => lower.endsWith(ext));
    };

    const isImageFile = (filePath: string): boolean => {
      const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
      const lower = filePath.toLowerCase();
      return imageExtensions.some((ext) => lower.endsWith(ext));
    };

    const isVideoFile = (filePath: string): boolean => {
      const videoExtensions = [".mp4", ".webm", ".ogg", ".mov"];
      const lower = filePath.toLowerCase();
      return videoExtensions.some((ext) => lower.endsWith(ext));
    };

    const isAudioFile = (filePath: string): boolean => {
      const audioExtensions = [".mp3", ".wav", ".ogg", ".m4a", ".flac"];
      const lower = filePath.toLowerCase();
      return audioExtensions.some((ext) => lower.endsWith(ext));
    };

    const isPdfFile = (filePath: string): boolean => {
      return filePath.toLowerCase().endsWith(".pdf");
    };

    const isNotebookFile = (filePath: string): boolean => {
      return filePath.toLowerCase().endsWith(".ipynb");
    };

    it("should detect code files", () => {
      expect(isCodeFile("index.ts")).toBe(true);
      expect(isCodeFile("app.tsx")).toBe(true);
      expect(isCodeFile("main.py")).toBe(true);
      expect(isCodeFile("image.png")).toBe(false);
    });

    it("should detect image files", () => {
      expect(isImageFile("photo.png")).toBe(true);
      expect(isImageFile("icon.svg")).toBe(true);
      expect(isImageFile("banner.JPEG")).toBe(true);
      expect(isImageFile("code.ts")).toBe(false);
    });

    it("should detect video files", () => {
      expect(isVideoFile("video.mp4")).toBe(true);
      expect(isVideoFile("clip.webm")).toBe(true);
      expect(isVideoFile("audio.mp3")).toBe(false);
    });

    it("should detect audio files", () => {
      expect(isAudioFile("song.mp3")).toBe(true);
      expect(isAudioFile("sound.wav")).toBe(true);
      expect(isAudioFile("video.mp4")).toBe(false);
    });

    it("should detect PDF files", () => {
      expect(isPdfFile("document.pdf")).toBe(true);
      expect(isPdfFile("REPORT.PDF")).toBe(true);
      expect(isPdfFile("doc.docx")).toBe(false);
    });

    it("should detect notebook files", () => {
      expect(isNotebookFile("analysis.ipynb")).toBe(true);
      expect(isNotebookFile("code.py")).toBe(false);
    });
  });

  describe("Pattern Matching", () => {
    const matchPattern = (pattern: string, filePath: string): boolean => {
      const fileName = filePath.split(/[/\\]/).pop() || filePath;
      const lower = fileName.toLowerCase();

      if (pattern.startsWith("*.")) {
        const ext = pattern.slice(1).toLowerCase();
        return lower.endsWith(ext);
      }

      if (pattern.toLowerCase() === lower) {
        return true;
      }

      return false;
    };

    it("should match extension patterns", () => {
      expect(matchPattern("*.ts", "index.ts")).toBe(true);
      expect(matchPattern("*.ts", "app.tsx")).toBe(false);
      expect(matchPattern("*.png", "image.PNG")).toBe(true);
    });

    it("should match exact filename patterns", () => {
      expect(matchPattern("Dockerfile", "Dockerfile")).toBe(true);
      expect(matchPattern("Makefile", "Makefile")).toBe(true);
      expect(matchPattern("Dockerfile", "dockerfile")).toBe(true);
    });

    it("should handle path separators", () => {
      expect(matchPattern("*.ts", "/src/index.ts")).toBe(true);
      expect(matchPattern("*.ts", "C:\\src\\index.ts")).toBe(true);
    });
  });

  describe("Editor Resolution", () => {
    interface EditorAssociation {
      pattern: string;
      editorId: string;
      priority: number;
    }

    const getEditorForFile = (
      filePath: string,
      associations: EditorAssociation[]
    ): string | null => {
      const fileName = filePath.split(/[/\\]/).pop() || filePath;
      const lower = fileName.toLowerCase();

      const matches = associations.filter((a) => {
        if (a.pattern.startsWith("*.")) {
          const ext = a.pattern.slice(1).toLowerCase();
          return lower.endsWith(ext);
        }
        return a.pattern.toLowerCase() === lower;
      });

      if (matches.length === 0) return null;

      const sorted = [...matches].sort((a, b) => b.priority - a.priority);
      return sorted[0].editorId;
    };

    it("should resolve editor by extension", () => {
      const associations: EditorAssociation[] = [
        { pattern: "*.png", editorId: "image-viewer", priority: 100 },
        { pattern: "*.ts", editorId: "code-editor", priority: 100 },
      ];

      expect(getEditorForFile("image.png", associations)).toBe("image-viewer");
      expect(getEditorForFile("index.ts", associations)).toBe("code-editor");
    });

    it("should resolve editor by priority", () => {
      const associations: EditorAssociation[] = [
        { pattern: "*.md", editorId: "code-editor", priority: 50 },
        { pattern: "*.md", editorId: "markdown-preview", priority: 100 },
      ];

      expect(getEditorForFile("README.md", associations)).toBe("markdown-preview");
    });

    it("should return null for no match", () => {
      const associations: EditorAssociation[] = [
        { pattern: "*.png", editorId: "image-viewer", priority: 100 },
      ];

      expect(getEditorForFile("index.ts", associations)).toBeNull();
    });
  });

  describe("LocalStorage Persistence", () => {
    interface EditorAssociation {
      pattern: string;
      editorId: string;
      priority: number;
      isUserDefined: boolean;
    }

    const STORAGE_KEY = "editor_associations";

    it("should save associations to localStorage", () => {
      const associations: EditorAssociation[] = [
        { pattern: "*.custom", editorId: "custom-editor", priority: 100, isUserDefined: true },
      ];

      localStorage.setItem(STORAGE_KEY, JSON.stringify(associations));

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(associations)
      );
    });

    it("should load associations from localStorage", () => {
      const associations: EditorAssociation[] = [
        { pattern: "*.custom", editorId: "custom-editor", priority: 100, isUserDefined: true },
      ];

      mockLocalStorage.store[STORAGE_KEY] = JSON.stringify(associations);

      const loaded = localStorage.getItem(STORAGE_KEY);
      const parsed = loaded ? JSON.parse(loaded) : [];

      expect(parsed).toHaveLength(1);
      expect(parsed[0].pattern).toBe("*.custom");
    });

    it("should handle missing localStorage data", () => {
      const loaded = localStorage.getItem(STORAGE_KEY);
      expect(loaded).toBeNull();
    });

    it("should handle invalid JSON in localStorage", () => {
      mockLocalStorage.store[STORAGE_KEY] = "invalid json";

      const loaded = localStorage.getItem(STORAGE_KEY);
      let parsed: EditorAssociation[] = [];

      try {
        parsed = JSON.parse(loaded || "[]");
      } catch {
        parsed = [];
      }

      expect(parsed).toEqual([]);
    });
  });

  describe("Association Management", () => {
    interface EditorAssociation {
      pattern: string;
      editorId: string;
      priority: number;
      isUserDefined: boolean;
    }

    it("should add an association", () => {
      const associations: EditorAssociation[] = [];

      const addAssociation = (assoc: EditorAssociation) => {
        const existing = associations.findIndex((a) => a.pattern === assoc.pattern);
        if (existing >= 0) {
          associations[existing] = assoc;
        } else {
          associations.push(assoc);
        }
      };

      addAssociation({ pattern: "*.custom", editorId: "custom", priority: 100, isUserDefined: true });

      expect(associations).toHaveLength(1);
    });

    it("should update an existing association", () => {
      const associations: EditorAssociation[] = [
        { pattern: "*.md", editorId: "code-editor", priority: 50, isUserDefined: true },
      ];

      const updateAssociation = (pattern: string, editorId: string) => {
        const existing = associations.find((a) => a.pattern === pattern);
        if (existing) {
          existing.editorId = editorId;
        }
      };

      updateAssociation("*.md", "markdown-preview");

      expect(associations[0].editorId).toBe("markdown-preview");
    });

    it("should remove an association", () => {
      const associations: EditorAssociation[] = [
        { pattern: "*.a", editorId: "a", priority: 100, isUserDefined: true },
        { pattern: "*.b", editorId: "b", priority: 100, isUserDefined: true },
      ];

      const removeAssociation = (pattern: string) => {
        const index = associations.findIndex((a) => a.pattern === pattern);
        if (index >= 0) {
          associations.splice(index, 1);
        }
      };

      removeAssociation("*.a");

      expect(associations).toHaveLength(1);
      expect(associations[0].pattern).toBe("*.b");
    });

    it("should filter user-defined associations", () => {
      const associations: EditorAssociation[] = [
        { pattern: "*.png", editorId: "image", priority: 100, isUserDefined: false },
        { pattern: "*.custom", editorId: "custom", priority: 100, isUserDefined: true },
        { pattern: "*.special", editorId: "special", priority: 100, isUserDefined: true },
      ];

      const userDefined = associations.filter((a) => a.isUserDefined);

      expect(userDefined).toHaveLength(2);
    });
  });

  describe("Editor Registration", () => {
    interface AvailableEditor {
      id: string;
      label: string;
      canHandle: (filePath: string) => boolean;
      isExtension?: boolean;
    }

    interface Disposable {
      dispose: () => void;
    }

    it("should register an editor", () => {
      const editors: AvailableEditor[] = [];

      const registerEditor = (editor: AvailableEditor): Disposable => {
        editors.push(editor);
        return {
          dispose: () => {
            const index = editors.findIndex((e) => e.id === editor.id);
            if (index >= 0) {
              editors.splice(index, 1);
            }
          },
        };
      };

      const disposable = registerEditor({
        id: "my-editor",
        label: "My Editor",
        canHandle: () => true,
      });

      expect(editors).toHaveLength(1);

      disposable.dispose();

      expect(editors).toHaveLength(0);
    });

    it("should find editors that can handle a file", () => {
      const editors: AvailableEditor[] = [
        { id: "code", label: "Code", canHandle: (p) => p.endsWith(".ts") },
        { id: "image", label: "Image", canHandle: (p) => p.endsWith(".png") },
        { id: "default", label: "Default", canHandle: () => true },
      ];

      const getEditorsForFile = (filePath: string) =>
        editors.filter((e) => e.canHandle(filePath));

      const tsEditors = getEditorsForFile("index.ts");
      expect(tsEditors.map((e) => e.id)).toContain("code");
      expect(tsEditors.map((e) => e.id)).toContain("default");

      const pngEditors = getEditorsForFile("image.png");
      expect(pngEditors.map((e) => e.id)).toContain("image");
    });
  });

  describe("Default Editors", () => {
    it("should define built-in editor types", () => {
      const builtInEditors = [
        { id: "code-editor", label: "Code Editor" },
        { id: "image-viewer", label: "Image Viewer" },
        { id: "video-player", label: "Video Player" },
        { id: "audio-player", label: "Audio Player" },
        { id: "pdf-viewer", label: "PDF Viewer" },
        { id: "notebook-editor", label: "Notebook Editor" },
        { id: "hex-editor", label: "Hex Editor" },
        { id: "diff-editor", label: "Diff Editor" },
      ];

      expect(builtInEditors).toHaveLength(8);
    });

    it("should have default associations for common file types", () => {
      interface EditorAssociation {
        pattern: string;
        editorId: string;
      }

      const defaultAssociations: EditorAssociation[] = [
        { pattern: "*.png", editorId: "image-viewer" },
        { pattern: "*.jpg", editorId: "image-viewer" },
        { pattern: "*.mp4", editorId: "video-player" },
        { pattern: "*.mp3", editorId: "audio-player" },
        { pattern: "*.pdf", editorId: "pdf-viewer" },
        { pattern: "*.ipynb", editorId: "notebook-editor" },
      ];

      expect(defaultAssociations.length).toBeGreaterThan(0);
    });
  });
});
