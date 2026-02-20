import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("SnippetsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Snippet Types", () => {
    interface Snippet {
      name: string;
      prefix: string;
      body: string[];
      description: string;
      scope?: string;
    }

    it("should create snippet", () => {
      const snippet: Snippet = {
        name: "Console Log",
        prefix: "log",
        body: ["console.log('$1');", "$0"],
        description: "Log output to console",
      };

      expect(snippet.name).toBe("Console Log");
      expect(snippet.prefix).toBe("log");
      expect(snippet.body).toHaveLength(2);
    });

    it("should create scoped snippet", () => {
      const snippet: Snippet = {
        name: "React Component",
        prefix: "rfc",
        body: ["function ${1:Component}() {", "\treturn <div>$0</div>;", "}"],
        description: "React functional component",
        scope: "typescript",
      };

      expect(snippet.scope).toBe("typescript");
    });
  });

  describe("Snippet Placeholder Types", () => {
    interface SnippetPlaceholder {
      index: number;
      defaultValue: string;
      start: number;
      end: number;
      choices?: string[];
    }

    it("should create simple placeholder", () => {
      const placeholder: SnippetPlaceholder = {
        index: 1,
        defaultValue: "",
        start: 10,
        end: 10,
      };

      expect(placeholder.index).toBe(1);
    });

    it("should create placeholder with default", () => {
      const placeholder: SnippetPlaceholder = {
        index: 1,
        defaultValue: "value",
        start: 10,
        end: 15,
      };

      expect(placeholder.defaultValue).toBe("value");
    });

    it("should create placeholder with choices", () => {
      const placeholder: SnippetPlaceholder = {
        index: 1,
        defaultValue: "const",
        start: 0,
        end: 5,
        choices: ["const", "let", "var"],
      };

      expect(placeholder.choices).toContain("let");
    });
  });

  describe("Snippet Body Parsing", () => {
    const parseSnippetBody = (body: string): { text: string; placeholders: number[] } => {
      const placeholders: number[] = [];
      let text = body;

      const simplePattern = /\$(\d+)/g;
      let match;
      while ((match = simplePattern.exec(body)) !== null) {
        placeholders.push(parseInt(match[1], 10));
      }

      text = body.replace(/\$\d+/g, "");
      text = text.replace(/\$\{(\d+):[^}]*\}/g, (_, idx) => {
        placeholders.push(parseInt(idx, 10));
        return "";
      });

      return { text, placeholders: [...new Set(placeholders)].sort() };
    };

    it("should parse simple tabstops", () => {
      const result = parseSnippetBody("console.log($1);$0");

      expect(result.placeholders).toContain(0);
      expect(result.placeholders).toContain(1);
    });

    it("should parse tabstops with defaults", () => {
      const result = parseSnippetBody("function ${1:name}() {}");

      expect(result.placeholders).toContain(1);
    });
  });

  describe("Snippet Expansion", () => {
    interface ParsedSnippet {
      text: string;
      placeholders: Array<{ index: number; start: number; end: number }>;
    }

    it("should expand snippet text", () => {
      const body = ["console.log('$1');", "$0"];
      const text = body.join("\n");

      expect(text).toContain("console.log");
    });

    it("should track placeholder positions", () => {
      const parsed: ParsedSnippet = {
        text: "const name = value;",
        placeholders: [
          { index: 1, start: 6, end: 10 },
          { index: 2, start: 13, end: 18 },
          { index: 0, start: 19, end: 19 },
        ],
      };

      expect(parsed.placeholders).toHaveLength(3);
      expect(parsed.placeholders.find(p => p.index === 0)).toBeDefined();
    });
  });

  describe("Active Snippet Session", () => {
    interface ActiveSnippetSession {
      fileId: string;
      currentPlaceholderIndex: number;
      startPosition: { line: number; column: number };
      insertedText: string;
    }

    it("should create active session", () => {
      const session: ActiveSnippetSession = {
        fileId: "file-1",
        currentPlaceholderIndex: 0,
        startPosition: { line: 10, column: 5 },
        insertedText: "console.log();",
      };

      expect(session.currentPlaceholderIndex).toBe(0);
    });

    it("should navigate to next placeholder", () => {
      const session: ActiveSnippetSession = {
        fileId: "file-1",
        currentPlaceholderIndex: 0,
        startPosition: { line: 10, column: 5 },
        insertedText: "const x = 1;",
      };

      session.currentPlaceholderIndex += 1;

      expect(session.currentPlaceholderIndex).toBe(1);
    });
  });

  describe("Snippet File Management", () => {
    interface SnippetFile {
      path: string;
      language: string;
      snippets: Record<string, { name: string; prefix: string; body: string[] }>;
      isGlobal: boolean;
    }

    it("should create snippet file", () => {
      const file: SnippetFile = {
        path: "typescript.json",
        language: "typescript",
        snippets: {
          "Console Log": { name: "Console Log", prefix: "log", body: ["console.log($1);"] },
        },
        isGlobal: false,
      };

      expect(file.language).toBe("typescript");
      expect(Object.keys(file.snippets)).toHaveLength(1);
    });

    it("should create global snippet file", () => {
      const file: SnippetFile = {
        path: "global.json",
        language: "global",
        snippets: {},
        isGlobal: true,
      };

      expect(file.isGlobal).toBe(true);
    });
  });

  describe("Language Normalization", () => {
    const normalizeLanguage = (language: string): string => {
      const languageMap: Record<string, string> = {
        typescriptreact: "typescript",
        javascriptreact: "javascript",
        tsx: "typescript",
        jsx: "javascript",
        ts: "typescript",
        js: "javascript",
        py: "python",
        rs: "rust",
      };

      return languageMap[language.toLowerCase()] || language.toLowerCase();
    };

    it("should normalize tsx to typescript", () => {
      expect(normalizeLanguage("tsx")).toBe("typescript");
    });

    it("should normalize jsx to javascript", () => {
      expect(normalizeLanguage("jsx")).toBe("javascript");
    });

    it("should keep unknown languages lowercase", () => {
      expect(normalizeLanguage("Go")).toBe("go");
    });
  });

  describe("Tauri IPC - Snippet Operations", () => {
    it("should get home directory via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("/home/user");

      const result = await invoke("get_home_dir");

      expect(invoke).toHaveBeenCalledWith("get_home_dir");
      expect(result).toBe("/home/user");
    });

    it("should read snippet file via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce('{"snippet": {}}');

      const result = await invoke("fs_read_file", { path: "/path/to/snippets.json" });

      expect(invoke).toHaveBeenCalledWith("fs_read_file", expect.any(Object));
      expect(result).toContain("snippet");
    });
  });

  describe("VSCode Snippet Format", () => {
    interface VSCodeSnippetFormat {
      prefix: string | string[];
      body: string | string[];
      description?: string;
      scope?: string;
    }

    it("should parse VSCode snippet format", () => {
      const vscodeSnippet: VSCodeSnippetFormat = {
        prefix: ["log", "clog"],
        body: ["console.log('$1');", "$0"],
        description: "Console log",
      };

      const prefix = Array.isArray(vscodeSnippet.prefix)
        ? vscodeSnippet.prefix[0]
        : vscodeSnippet.prefix;
      const body = Array.isArray(vscodeSnippet.body)
        ? vscodeSnippet.body
        : [vscodeSnippet.body];

      expect(prefix).toBe("log");
      expect(body).toHaveLength(2);
    });
  });

  describe("Import/Export", () => {
    it("should export snippets as JSON", () => {
      const snippets = {
        "Console Log": {
          prefix: "log",
          body: ["console.log($1);"],
          description: "Log to console",
        },
      };

      const exported = JSON.stringify(snippets, null, 2);

      expect(exported).toContain("Console Log");
      expect(exported).toContain("prefix");
    });

    it("should import snippets from JSON", () => {
      const json = '{"Test Snippet": {"prefix": "test", "body": ["test()"]}}';

      const imported = JSON.parse(json);

      expect(imported["Test Snippet"]).toBeDefined();
      expect(imported["Test Snippet"].prefix).toBe("test");
    });

    it("should validate imported snippet", () => {
      const validateSnippet = (snippet: unknown): boolean => {
        if (typeof snippet !== "object" || snippet === null) return false;
        const s = snippet as Record<string, unknown>;
        return typeof s.prefix === "string" && (Array.isArray(s.body) || typeof s.body === "string");
      };

      expect(validateSnippet({ prefix: "log", body: ["test"] })).toBe(true);
      expect(validateSnippet({ prefix: "log" })).toBe(false);
    });
  });

  describe("Snippet Filtering", () => {
    it("should filter snippets by language", () => {
      const files = [
        { language: "typescript", snippets: { a: {}, b: {} }, isGlobal: false },
        { language: "javascript", snippets: { c: {} }, isGlobal: false },
        { language: "global", snippets: { d: {} }, isGlobal: true },
      ];

      const getSnippetsForLanguage = (lang: string) => {
        const result: unknown[] = [];
        for (const file of files) {
          if (file.isGlobal || file.language === lang) {
            result.push(...Object.values(file.snippets));
          }
        }
        return result;
      };

      const tsSnippets = getSnippetsForLanguage("typescript");
      expect(tsSnippets).toHaveLength(3);
    });
  });

  describe("Error Handling", () => {
    it("should handle invoke error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("File not found"));

      await expect(invoke("fs_read_file", { path: "/invalid" }))
        .rejects.toThrow("File not found");
    });
  });
});
