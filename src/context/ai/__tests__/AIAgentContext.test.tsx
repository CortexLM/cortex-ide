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

type SubAgentStatus = "idle" | "running" | "completed" | "failed";

interface SubAgent {
  id: string;
  name: string;
  description: string;
  status: SubAgentStatus;
  parentId?: string;
  systemPrompt?: string;
  createdAt?: number;
}

interface IndexProgressEvent {
  totalFiles: number;
  indexedFiles: number;
  totalChunks: number;
  done: boolean;
  currentFile: string | null;
}

interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  chunkType: string;
  startLine: number;
  endLine: number;
  language: string;
  score: number;
}

interface SearchResult {
  chunk: CodeChunk;
  score: number;
}

interface AIContext {
  chunks: CodeChunk[];
  query: string;
  totalIndexed: number;
  formattedContext: string;
}

interface AIAgentState {
  agents: SubAgent[];
  isCompletionActive: boolean;
  completionProvider: string | null;
  isIndexing: boolean;
  indexProgress: number;
  indexedFileCount: number;
  indexedChunkCount: number;
  indexWorkspacePath: string | null;
}

describe("AIAgentContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SubAgent interface", () => {
    it("should create a sub-agent with required fields", () => {
      const agent: SubAgent = {
        id: "agent-1",
        name: "Code Reviewer",
        description: "Reviews code for best practices",
        status: "idle",
      };

      expect(agent.id).toBe("agent-1");
      expect(agent.name).toBe("Code Reviewer");
      expect(agent.status).toBe("idle");
    });

    it("should support all status types", () => {
      const statuses: SubAgentStatus[] = ["idle", "running", "completed", "failed"];

      statuses.forEach((status) => {
        const agent: SubAgent = {
          id: "agent-1",
          name: "Test Agent",
          description: "Test",
          status,
        };
        expect(agent.status).toBe(status);
      });
    });

    it("should support optional fields", () => {
      const agent: SubAgent = {
        id: "agent-2",
        name: "Sub Agent",
        description: "A child agent",
        status: "running",
        parentId: "agent-1",
        systemPrompt: "You are a helpful assistant",
        createdAt: Date.now(),
      };

      expect(agent.parentId).toBe("agent-1");
      expect(agent.systemPrompt).toBeDefined();
      expect(agent.createdAt).toBeDefined();
    });

    it("should allow agents without optional fields", () => {
      const agent: SubAgent = {
        id: "agent-3",
        name: "Minimal Agent",
        description: "Minimal",
        status: "idle",
      };

      expect(agent.parentId).toBeUndefined();
      expect(agent.systemPrompt).toBeUndefined();
      expect(agent.createdAt).toBeUndefined();
    });
  });

  describe("AIAgentState interface", () => {
    it("should have correct initial state", () => {
      const state: AIAgentState = {
        agents: [],
        isCompletionActive: false,
        completionProvider: null,
        isIndexing: false,
        indexProgress: 0,
        indexedFileCount: 0,
        indexedChunkCount: 0,
        indexWorkspacePath: null,
      };

      expect(state.agents).toEqual([]);
      expect(state.isCompletionActive).toBe(false);
      expect(state.completionProvider).toBeNull();
      expect(state.isIndexing).toBe(false);
      expect(state.indexProgress).toBe(0);
    });

    it("should represent indexing state", () => {
      const state: AIAgentState = {
        agents: [],
        isCompletionActive: false,
        completionProvider: null,
        isIndexing: true,
        indexProgress: 45,
        indexedFileCount: 90,
        indexedChunkCount: 450,
        indexWorkspacePath: "/workspace/project",
      };

      expect(state.isIndexing).toBe(true);
      expect(state.indexProgress).toBe(45);
      expect(state.indexedFileCount).toBe(90);
      expect(state.indexWorkspacePath).toBe("/workspace/project");
    });

    it("should represent state with active agents", () => {
      const state: AIAgentState = {
        agents: [
          {
            id: "agent-1",
            name: "Coder",
            description: "Coding assistant",
            status: "running",
          },
          {
            id: "agent-2",
            name: "Reviewer",
            description: "Code reviewer",
            status: "idle",
          },
        ],
        isCompletionActive: true,
        completionProvider: "openai",
        isIndexing: false,
        indexProgress: 100,
        indexedFileCount: 200,
        indexedChunkCount: 1000,
        indexWorkspacePath: "/workspace/project",
      };

      expect(state.agents).toHaveLength(2);
      expect(state.isCompletionActive).toBe(true);
      expect(state.completionProvider).toBe("openai");
    });
  });

  describe("IndexProgressEvent interface", () => {
    it("should represent progress event", () => {
      const event: IndexProgressEvent = {
        totalFiles: 200,
        indexedFiles: 100,
        totalChunks: 500,
        done: false,
        currentFile: "src/app.ts",
      };

      expect(event.totalFiles).toBe(200);
      expect(event.indexedFiles).toBe(100);
      expect(event.done).toBe(false);
      expect(event.currentFile).toBe("src/app.ts");
    });

    it("should calculate progress percentage", () => {
      const event: IndexProgressEvent = {
        totalFiles: 200,
        indexedFiles: 100,
        totalChunks: 500,
        done: false,
        currentFile: "src/app.ts",
      };

      const progress = event.totalFiles > 0
        ? (event.indexedFiles / event.totalFiles) * 100
        : 0;

      expect(progress).toBe(50);
    });

    it("should represent completed indexing", () => {
      const event: IndexProgressEvent = {
        totalFiles: 200,
        indexedFiles: 200,
        totalChunks: 1000,
        done: true,
        currentFile: null,
      };

      expect(event.done).toBe(true);
      expect(event.currentFile).toBeNull();
    });

    it("should handle zero files", () => {
      const event: IndexProgressEvent = {
        totalFiles: 0,
        indexedFiles: 0,
        totalChunks: 0,
        done: true,
        currentFile: null,
      };

      const progress = event.totalFiles > 0
        ? (event.indexedFiles / event.totalFiles) * 100
        : 0;

      expect(progress).toBe(0);
    });
  });

  describe("CodeChunk and SearchResult interfaces", () => {
    it("should represent a code chunk", () => {
      const chunk: CodeChunk = {
        id: "chunk-1",
        filePath: "src/utils/helpers.ts",
        content: "export function add(a: number, b: number) { return a + b; }",
        chunkType: "function",
        startLine: 10,
        endLine: 12,
        language: "typescript",
        score: 0.95,
      };

      expect(chunk.filePath).toBe("src/utils/helpers.ts");
      expect(chunk.chunkType).toBe("function");
      expect(chunk.language).toBe("typescript");
    });

    it("should represent a search result with score", () => {
      const result: SearchResult = {
        chunk: {
          id: "chunk-1",
          filePath: "src/app.ts",
          content: "const app = createApp();",
          chunkType: "statement",
          startLine: 1,
          endLine: 1,
          language: "typescript",
          score: 0.88,
        },
        score: 0.88,
      };

      expect(result.score).toBe(0.88);
      expect(result.chunk.filePath).toBe("src/app.ts");
    });
  });

  describe("AIContext interface", () => {
    it("should represent AI context response", () => {
      const context: AIContext = {
        chunks: [
          {
            id: "chunk-1",
            filePath: "src/app.ts",
            content: "const app = createApp();",
            chunkType: "statement",
            startLine: 1,
            endLine: 1,
            language: "typescript",
            score: 0.9,
          },
        ],
        query: "create app",
        totalIndexed: 500,
        formattedContext: "File: src/app.ts\nconst app = createApp();",
      };

      expect(context.chunks).toHaveLength(1);
      expect(context.query).toBe("create app");
      expect(context.totalIndexed).toBe(500);
      expect(context.formattedContext).toContain("src/app.ts");
    });

    it("should represent empty context", () => {
      const context: AIContext = {
        chunks: [],
        query: "",
        totalIndexed: 0,
        formattedContext: "",
      };

      expect(context.chunks).toEqual([]);
      expect(context.totalIndexed).toBe(0);
    });
  });

  describe("IPC operations", () => {
    it("should call invoke for agent_list", async () => {
      const mockAgents: SubAgent[] = [
        {
          id: "agent-1",
          name: "Coder",
          description: "Coding assistant",
          status: "idle",
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockAgents);

      const result = await invoke("agent_list");

      expect(invoke).toHaveBeenCalledWith("agent_list");
      expect(result).toHaveLength(1);
    });

    it("should call invoke for agent_spawn", async () => {
      vi.mocked(invoke).mockResolvedValue("agent-new-123");

      const result = await invoke("agent_spawn", {
        name: "Code Reviewer",
        systemPrompt: "Review code for issues",
        parentId: null,
      });

      expect(invoke).toHaveBeenCalledWith("agent_spawn", {
        name: "Code Reviewer",
        systemPrompt: "Review code for issues",
        parentId: null,
      });
      expect(result).toBe("agent-new-123");
    });

    it("should call invoke for agent_run_task", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("agent_run_task", {
        agentId: "agent-1",
        prompt: "Fix the bug in app.ts",
        context: ["src/app.ts"],
      });

      expect(invoke).toHaveBeenCalledWith("agent_run_task", {
        agentId: "agent-1",
        prompt: "Fix the bug in app.ts",
        context: ["src/app.ts"],
      });
    });

    it("should call invoke for agent_cancel_task", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("agent_cancel_task", { taskId: "task-123" });

      expect(invoke).toHaveBeenCalledWith("agent_cancel_task", { taskId: "task-123" });
    });

    it("should call invoke for index_workspace", async () => {
      const mockResult = {
        isIndexing: false,
        indexedFiles: 150,
        totalChunks: 750,
        workspacePath: "/workspace/project",
      };

      vi.mocked(invoke).mockResolvedValue(mockResult);

      const result = await invoke("index_workspace", {
        workspacePath: "/workspace/project",
      });

      expect(invoke).toHaveBeenCalledWith("index_workspace", {
        workspacePath: "/workspace/project",
      });
      expect(result).toEqual(mockResult);
    });

    it("should call invoke for search_codebase", async () => {
      const mockResults: SearchResult[] = [
        {
          chunk: {
            id: "chunk-1",
            filePath: "src/app.ts",
            content: "createApp()",
            chunkType: "function",
            startLine: 1,
            endLine: 5,
            language: "typescript",
            score: 0.95,
          },
          score: 0.95,
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockResults);

      const result = await invoke("search_codebase", {
        query: "create app",
        topK: 10,
        language: null,
      });

      expect(invoke).toHaveBeenCalledWith("search_codebase", {
        query: "create app",
        topK: 10,
        language: null,
      });
      expect(result).toHaveLength(1);
    });

    it("should call invoke for search_codebase with language filter", async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      await invoke("search_codebase", {
        query: "handler",
        topK: 5,
        language: "rust",
      });

      expect(invoke).toHaveBeenCalledWith("search_codebase", {
        query: "handler",
        topK: 5,
        language: "rust",
      });
    });

    it("should call invoke for get_ai_context", async () => {
      const mockContext: AIContext = {
        chunks: [],
        query: "explain function",
        totalIndexed: 500,
        formattedContext: "",
      };

      vi.mocked(invoke).mockResolvedValue(mockContext);

      const result = await invoke("get_ai_context", {
        request: {
          query: "explain function",
          filePath: "src/app.ts",
          line: 10,
          column: 5,
          language: "typescript",
          topK: 10,
        },
      });

      expect(invoke).toHaveBeenCalledWith("get_ai_context", {
        request: {
          query: "explain function",
          filePath: "src/app.ts",
          line: 10,
          column: 5,
          language: "typescript",
          topK: 10,
        },
      });
      expect(result).toEqual(mockContext);
    });

    it("should handle agent_spawn failure", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Failed to spawn agent"));

      await expect(
        invoke("agent_spawn", { name: "Test", systemPrompt: "Test", parentId: null })
      ).rejects.toThrow("Failed to spawn agent");
    });

    it("should handle agent_run_task failure", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Task execution failed"));

      await expect(
        invoke("agent_run_task", { agentId: "agent-1", prompt: "test", context: [] })
      ).rejects.toThrow("Task execution failed");
    });

    it("should handle index_workspace failure", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Indexing failed"));

      await expect(
        invoke("index_workspace", { workspacePath: "/project" })
      ).rejects.toThrow("Indexing failed");
    });
  });

  describe("Event listeners", () => {
    it("should set up ai:index-progress listener", async () => {
      await listen("ai:index-progress", () => {});

      expect(listen).toHaveBeenCalledWith("ai:index-progress", expect.any(Function));
    });

    it("should process index progress events", () => {
      const event: IndexProgressEvent = {
        totalFiles: 100,
        indexedFiles: 50,
        totalChunks: 250,
        done: false,
        currentFile: "src/main.ts",
      };

      const progress = event.totalFiles > 0
        ? (event.indexedFiles / event.totalFiles) * 100
        : 0;

      const state: AIAgentState = {
        agents: [],
        isCompletionActive: false,
        completionProvider: null,
        isIndexing: !event.done,
        indexProgress: progress,
        indexedFileCount: event.indexedFiles,
        indexedChunkCount: event.totalChunks,
        indexWorkspacePath: "/project",
      };

      expect(state.isIndexing).toBe(true);
      expect(state.indexProgress).toBe(50);
      expect(state.indexedFileCount).toBe(50);
      expect(state.indexedChunkCount).toBe(250);
    });

    it("should mark indexing complete on done event", () => {
      const event: IndexProgressEvent = {
        totalFiles: 100,
        indexedFiles: 100,
        totalChunks: 500,
        done: true,
        currentFile: null,
      };

      const state: AIAgentState = {
        agents: [],
        isCompletionActive: false,
        completionProvider: null,
        isIndexing: !event.done,
        indexProgress: 100,
        indexedFileCount: event.indexedFiles,
        indexedChunkCount: event.totalChunks,
        indexWorkspacePath: "/project",
      };

      expect(state.isIndexing).toBe(false);
      expect(state.indexProgress).toBe(100);
    });
  });

  describe("Agent status management", () => {
    it("should update agent status to running", () => {
      const agents: SubAgent[] = [
        { id: "agent-1", name: "Coder", description: "Test", status: "idle" },
        { id: "agent-2", name: "Reviewer", description: "Test", status: "idle" },
      ];

      const updated = agents.map((a) =>
        a.id === "agent-1" ? { ...a, status: "running" as SubAgentStatus } : a
      );

      expect(updated[0].status).toBe("running");
      expect(updated[1].status).toBe("idle");
    });

    it("should update agent status to failed on error", () => {
      const agents: SubAgent[] = [
        { id: "agent-1", name: "Coder", description: "Test", status: "running" },
      ];

      const updated = agents.map((a) =>
        a.id === "agent-1" ? { ...a, status: "failed" as SubAgentStatus } : a
      );

      expect(updated[0].status).toBe("failed");
    });

    it("should find agent by id", () => {
      const agents: SubAgent[] = [
        { id: "agent-1", name: "Coder", description: "Test", status: "idle" },
        { id: "agent-2", name: "Reviewer", description: "Test", status: "running" },
      ];

      const found = agents.find((a) => a.id === "agent-2");
      expect(found).toBeDefined();
      expect(found!.name).toBe("Reviewer");
    });

    it("should return undefined for unknown agent id", () => {
      const agents: SubAgent[] = [
        { id: "agent-1", name: "Coder", description: "Test", status: "idle" },
      ];

      const found = agents.find((a) => a.id === "agent-999");
      expect(found).toBeUndefined();
    });
  });

  describe("Workspace indexing workflow", () => {
    it("should transition through indexing states", () => {
      const state: AIAgentState = {
        agents: [],
        isCompletionActive: false,
        completionProvider: null,
        isIndexing: false,
        indexProgress: 0,
        indexedFileCount: 0,
        indexedChunkCount: 0,
        indexWorkspacePath: null,
      };

      state.isIndexing = true;
      state.indexProgress = 0;
      state.indexWorkspacePath = "/workspace/project";
      expect(state.isIndexing).toBe(true);

      state.indexProgress = 50;
      state.indexedFileCount = 100;
      state.indexedChunkCount = 500;
      expect(state.indexProgress).toBe(50);

      state.isIndexing = false;
      state.indexProgress = 100;
      state.indexedFileCount = 200;
      state.indexedChunkCount = 1000;
      expect(state.isIndexing).toBe(false);
      expect(state.indexProgress).toBe(100);
    });

    it("should reset indexing state on failure", () => {
      const state: AIAgentState = {
        agents: [],
        isCompletionActive: false,
        completionProvider: null,
        isIndexing: true,
        indexProgress: 30,
        indexedFileCount: 60,
        indexedChunkCount: 300,
        indexWorkspacePath: "/workspace/project",
      };

      state.isIndexing = false;
      expect(state.isIndexing).toBe(false);
    });
  });
});
