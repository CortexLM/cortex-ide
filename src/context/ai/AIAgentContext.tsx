/**
 * AIAgentContext - Manages AI sub-agents, inline completions, and codebase indexing
 * 
 * Handles:
 * - Agent spawning and lifecycle
 * - Agent task execution
 * - Agent status tracking
 * - Inline completion state
 * - Codebase semantic indexing state
 * - RAG context retrieval
 */

import {
  createContext,
  useContext,
  onMount,
  onCleanup,
  ParentProps,
  Accessor,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

import type { SubAgent } from "../../types";

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

export interface AIAgentContextValue {
  agents: Accessor<SubAgent[]>;
  spawnAgent: (name: string, systemPrompt: string) => Promise<string>;
  runAgentTask: (agentId: string, prompt: string, context: string[]) => Promise<void>;
  cancelAgentTask: (taskId: string) => Promise<void>;
  fetchAgents: () => Promise<void>;
  getAgentById: (agentId: string) => SubAgent | undefined;
  isCompletionActive: Accessor<boolean>;
  completionProvider: Accessor<string | null>;
  isIndexing: Accessor<boolean>;
  indexProgress: Accessor<number>;
  indexedFileCount: Accessor<number>;
  indexedChunkCount: Accessor<number>;
  indexWorkspace: (workspacePath: string) => Promise<void>;
  searchCodebase: (query: string, topK?: number, language?: string) => Promise<SearchResult[]>;
  getAIContext: (request: {
    query?: string;
    filePath?: string;
    fileContent?: string;
    line?: number;
    column?: number;
    language?: string;
    topK?: number;
  }) => Promise<AIContext>;
  _state: AIAgentState;
}

const AIAgentContext = createContext<AIAgentContextValue>();

export function AIAgentProvider(props: ParentProps) {
  const [state, setState] = createStore<AIAgentState>({
    agents: [],
    isCompletionActive: false,
    completionProvider: null,
    isIndexing: false,
    indexProgress: 0,
    indexedFileCount: 0,
    indexedChunkCount: 0,
    indexWorkspacePath: null,
  });

  const unlistenFns: UnlistenFn[] = [];

  const setupEventListeners = async () => {
    try {
      const unlistenIndexProgress = await listen<IndexProgressEvent>(
        "ai:index-progress",
        (event) => {
          const { totalFiles, indexedFiles, totalChunks, done } = event.payload;
          const progress = totalFiles > 0 ? (indexedFiles / totalFiles) * 100 : 0;

          setState(
            produce((s) => {
              s.isIndexing = !done;
              s.indexProgress = progress;
              s.indexedFileCount = indexedFiles;
              s.indexedChunkCount = totalChunks;
            })
          );
        }
      );
      unlistenFns.push(unlistenIndexProgress);
    } catch (e) {
      console.error("[AIAgentContext] Failed to setup event listeners:", e);
    }
  };

  const fetchAgents = async () => {
    try {
      const agents = await invoke<SubAgent[]>("agent_list");
      setState("agents", agents);
    } catch (e) {
      console.error("[AIAgentContext] Failed to fetch agents:", e);
    }
  };

  const spawnAgent = async (name: string, systemPrompt: string): Promise<string> => {
    const agentId = await invoke<string>("agent_spawn", {
      name,
      systemPrompt,
      parentId: null,
    });

    await fetchAgents();

    return agentId;
  };

  const runAgentTask = async (agentId: string, prompt: string, context: string[]): Promise<void> => {
    setState(
      produce((s) => {
        const agent = s.agents.find((a) => a.id === agentId);
        if (agent) {
          agent.status = "running";
        }
      })
    );

    try {
      await invoke("agent_run_task", {
        agentId,
        prompt,
        context,
      });
    } catch (e) {
      setState(
        produce((s) => {
          const agent = s.agents.find((a) => a.id === agentId);
          if (agent) {
            agent.status = "failed";
          }
        })
      );
      throw e;
    }
  };

  const cancelAgentTask = async (taskId: string): Promise<void> => {
    await invoke("agent_cancel_task", { taskId });
  };

  const getAgentById = (agentId: string): SubAgent | undefined => {
    return state.agents.find((a) => a.id === agentId);
  };

  const indexWorkspace = async (workspacePath: string): Promise<void> => {
    setState(
      produce((s) => {
        s.isIndexing = true;
        s.indexProgress = 0;
        s.indexWorkspacePath = workspacePath;
      })
    );

    try {
      const result = await invoke<{
        isIndexing: boolean;
        indexedFiles: number;
        totalChunks: number;
        workspacePath: string | null;
      }>("index_workspace", { workspacePath });

      setState(
        produce((s) => {
          s.isIndexing = false;
          s.indexedFileCount = result.indexedFiles;
          s.indexedChunkCount = result.totalChunks;
          s.indexProgress = 100;
        })
      );
    } catch (e) {
      setState(
        produce((s) => {
          s.isIndexing = false;
        })
      );
      console.error("[AIAgentContext] Failed to index workspace:", e);
      throw e;
    }
  };

  const searchCodebase = async (
    query: string,
    topK?: number,
    language?: string
  ): Promise<SearchResult[]> => {
    try {
      return await invoke<SearchResult[]>("search_codebase", {
        query,
        topK: topK ?? 10,
        language: language ?? null,
      });
    } catch (e) {
      console.error("[AIAgentContext] Failed to search codebase:", e);
      return [];
    }
  };

  const getAIContext = async (request: {
    query?: string;
    filePath?: string;
    fileContent?: string;
    line?: number;
    column?: number;
    language?: string;
    topK?: number;
  }): Promise<AIContext> => {
    try {
      return await invoke<AIContext>("get_ai_context", { request });
    } catch (e) {
      console.error("[AIAgentContext] Failed to get AI context:", e);
      return {
        chunks: [],
        query: request.query ?? "",
        totalIndexed: 0,
        formattedContext: "",
      };
    }
  };

  const agents: Accessor<SubAgent[]> = () => state.agents;
  const isCompletionActive: Accessor<boolean> = () => state.isCompletionActive;
  const completionProvider: Accessor<string | null> = () => state.completionProvider;
  const isIndexing: Accessor<boolean> = () => state.isIndexing;
  const indexProgress: Accessor<number> = () => state.indexProgress;
  const indexedFileCount: Accessor<number> = () => state.indexedFileCount;
  const indexedChunkCount: Accessor<number> = () => state.indexedChunkCount;

  onMount(async () => {
    await setupEventListeners();
  });

  onCleanup(() => {
    for (const unlisten of unlistenFns) {
      unlisten();
    }
    unlistenFns.length = 0;
  });

  const value: AIAgentContextValue = {
    agents,
    spawnAgent,
    runAgentTask,
    cancelAgentTask,
    fetchAgents,
    getAgentById,
    isCompletionActive,
    completionProvider,
    isIndexing,
    indexProgress,
    indexedFileCount,
    indexedChunkCount,
    indexWorkspace,
    searchCodebase,
    getAIContext,
    _state: state,
  };

  return (
    <AIAgentContext.Provider value={value}>
      {props.children}
    </AIAgentContext.Provider>
  );
}

export function useAIAgent() {
  const context = useContext(AIAgentContext);
  if (!context) {
    throw new Error("useAIAgent must be used within AIAgentProvider");
  }
  return context;
}
