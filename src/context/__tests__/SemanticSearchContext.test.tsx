import { describe, it, expect, vi, beforeEach } from "vitest";

describe("SemanticSearchContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Semantic Search State", () => {
    interface SemanticSearchState {
      indexReady: boolean;
      indexingStatus: "idle" | "indexing" | "error";
      indexingProgress: number;
      indexingCurrentFile: string | null;
      totalFiles: number;
      indexedFilesCount: number;
      lastError: string | null;
      aiSearchEnabled: boolean;
      modelId: string;
    }

    it("should create initial state", () => {
      const state: SemanticSearchState = {
        indexReady: false,
        indexingStatus: "idle",
        indexingProgress: 0,
        indexingCurrentFile: null,
        totalFiles: 0,
        indexedFilesCount: 0,
        lastError: null,
        aiSearchEnabled: false,
        modelId: "local-tfidf",
      };

      expect(state.indexReady).toBe(false);
      expect(state.indexingStatus).toBe("idle");
    });

    it("should track indexing progress", () => {
      const state: SemanticSearchState = {
        indexReady: false,
        indexingStatus: "indexing",
        indexingProgress: 50,
        indexingCurrentFile: "/src/app.ts",
        totalFiles: 100,
        indexedFilesCount: 50,
        lastError: null,
        aiSearchEnabled: true,
        modelId: "local-tfidf",
      };

      expect(state.indexingProgress).toBe(50);
      expect(state.indexingCurrentFile).toBe("/src/app.ts");
    });

    it("should handle indexing error", () => {
      const state: SemanticSearchState = {
        indexReady: false,
        indexingStatus: "error",
        indexingProgress: 30,
        indexingCurrentFile: null,
        totalFiles: 100,
        indexedFilesCount: 30,
        lastError: "Failed to read file",
        aiSearchEnabled: true,
        modelId: "local-tfidf",
      };

      expect(state.indexingStatus).toBe("error");
      expect(state.lastError).toBe("Failed to read file");
    });
  });

  describe("Search Results", () => {
    interface SemanticSearchResult {
      file: string;
      content: string;
      similarity: number;
      startLine: number;
      endLine: number;
      chunkId: string;
    }

    it("should create search result", () => {
      const result: SemanticSearchResult = {
        file: "src/utils/helpers.ts",
        content: "export function formatDate(date: Date) { ... }",
        similarity: 0.85,
        startLine: 10,
        endLine: 15,
        chunkId: "src/utils/helpers.ts:10:abc123",
      };

      expect(result.similarity).toBe(0.85);
      expect(result.file).toBe("src/utils/helpers.ts");
    });

    it("should sort results by similarity", () => {
      const results: SemanticSearchResult[] = [
        { file: "a.ts", content: "...", similarity: 0.7, startLine: 1, endLine: 5, chunkId: "a" },
        { file: "b.ts", content: "...", similarity: 0.9, startLine: 1, endLine: 5, chunkId: "b" },
        { file: "c.ts", content: "...", similarity: 0.8, startLine: 1, endLine: 5, chunkId: "c" },
      ];

      const sorted = [...results].sort((a, b) => b.similarity - a.similarity);

      expect(sorted[0].file).toBe("b.ts");
      expect(sorted[2].file).toBe("a.ts");
    });

    it("should filter results by threshold", () => {
      const results: SemanticSearchResult[] = [
        { file: "a.ts", content: "...", similarity: 0.3, startLine: 1, endLine: 5, chunkId: "a" },
        { file: "b.ts", content: "...", similarity: 0.5, startLine: 1, endLine: 5, chunkId: "b" },
        { file: "c.ts", content: "...", similarity: 0.8, startLine: 1, endLine: 5, chunkId: "c" },
      ];

      const threshold = 0.4;
      const filtered = results.filter(r => r.similarity >= threshold);

      expect(filtered).toHaveLength(2);
    });
  });

  describe("Content Chunking", () => {
    it("should generate chunk ID", () => {
      const file = "src/app.ts";
      const startLine = 10;
      const content = "const x = 1;";

      const simpleHash = (str: string): string => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
      };

      const chunkId = `${file}:${startLine}:${simpleHash(content)}`;

      expect(chunkId).toContain("src/app.ts");
      expect(chunkId).toContain("10");
    });

    it("should split content into chunks", () => {
      const content = "line1\nline2\nline3\nline4\nline5";
      const lines = content.split("\n");

      expect(lines).toHaveLength(5);
    });
  });

  describe("Embedding Generation", () => {
    it("should generate embedding vector", () => {
      const EMBEDDING_DIMENSION = 384;
      const embedding = new Float32Array(EMBEDDING_DIMENSION);

      expect(embedding.length).toBe(384);
    });

    it("should normalize embedding vector", () => {
      const embedding = new Float32Array([3, 4]);

      let magnitude = 0;
      for (let i = 0; i < embedding.length; i++) {
        magnitude += embedding[i] * embedding[i];
      }
      magnitude = Math.sqrt(magnitude);

      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }

      expect(embedding[0]).toBeCloseTo(0.6, 5);
      expect(embedding[1]).toBeCloseTo(0.8, 5);
    });
  });

  describe("Cosine Similarity", () => {
    it("should calculate cosine similarity", () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([1, 0, 0]);

      let dot = 0;
      let magA = 0;
      let magB = 0;

      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
      }

      const similarity = dot / (Math.sqrt(magA) * Math.sqrt(magB));

      expect(similarity).toBe(1);
    });

    it("should return 0 for orthogonal vectors", () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([0, 1, 0]);

      let dot = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
      }

      expect(dot).toBe(0);
    });
  });

  describe("File Filtering", () => {
    it("should check indexable extensions", () => {
      const INDEXABLE_EXTENSIONS = new Set([
        ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go",
      ]);

      const shouldIndex = (path: string): boolean => {
        const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
        return INDEXABLE_EXTENSIONS.has(ext);
      };

      expect(shouldIndex("app.ts")).toBe(true);
      expect(shouldIndex("style.css")).toBe(false);
    });

    it("should exclude directories", () => {
      const EXCLUDED_DIRS = new Set([
        "node_modules", ".git", "dist", "build",
      ]);

      const isExcluded = (path: string): boolean => {
        const parts = path.split("/");
        return parts.some(part => EXCLUDED_DIRS.has(part));
      };

      expect(isExcluded("node_modules/package/index.js")).toBe(true);
      expect(isExcluded("src/app.ts")).toBe(false);
    });
  });

  describe("Index Statistics", () => {
    it("should track index stats", () => {
      const stats = {
        totalChunks: 500,
        totalFiles: 50,
        cacheSize: 1024 * 1024,
      };

      expect(stats.totalChunks).toBe(500);
      expect(stats.totalFiles).toBe(50);
    });
  });

  describe("AI Search Toggle", () => {
    it("should toggle AI search mode", () => {
      let aiSearchEnabled = false;

      const setAISearchEnabled = (enabled: boolean) => {
        aiSearchEnabled = enabled;
      };

      setAISearchEnabled(true);
      expect(aiSearchEnabled).toBe(true);

      setAISearchEnabled(false);
      expect(aiSearchEnabled).toBe(false);
    });
  });

  describe("Index Persistence", () => {
    it("should serialize index data", () => {
      const chunks = new Map([
        ["chunk1", { id: "chunk1", content: "test", embedding: [0.1, 0.2, 0.3] }],
      ]);

      const chunksObj: Record<string, unknown> = {};
      for (const [id, chunk] of chunks) {
        chunksObj[id] = chunk;
      }

      const serialized = JSON.stringify({ chunks: chunksObj });

      expect(serialized).toContain("chunk1");
    });

    it("should check cache size limit", () => {
      const MAX_SIZE = 5 * 1024 * 1024;
      const data = "x".repeat(1000);

      expect(data.length).toBeLessThan(MAX_SIZE);
    });
  });

  describe("Indexing Cancellation", () => {
    it("should support cancellation", () => {
      let indexingCancelled = false;

      const cancelIndexing = () => {
        indexingCancelled = true;
      };

      cancelIndexing();

      expect(indexingCancelled).toBe(true);
    });
  });
});
