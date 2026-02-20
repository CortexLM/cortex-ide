/**
 * AI Context Provider
 * Manages AI model interactions, threads, streaming, and sub-agents via Tauri IPC
 * 
 * This is a composition layer that combines the split sub-contexts:
 * - AIProviderContext: Model and provider state
 * - AIThreadContext: Thread management
 * - AIStreamContext: Streaming state
 * - AIAgentContext: Sub-agent management
 * 
 * The unified AIContext is maintained for backward compatibility.
 */

import {
  createContext,
  useContext,
  onMount,
  onCleanup,
  batch,
  ParentProps,
  Accessor,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { aiLogger } from "../utils/logger";

// Re-export sub-contexts for granular access
export {
  AIProviderProvider,
  useAIProvider,
} from "./ai/AIProviderContext";

export {
  AIThreadProvider,
  useAIThread,
} from "./ai/AIThreadContext";

export {
  AIStreamProvider,
  useAIStream,
} from "./ai/AIStreamContext";

export {
  AIAgentProvider,
  useAIAgent,
} from "./ai/AIAgentContext";

const STORAGE_KEY_SELECTED_MODEL = "cortex_ai_selected_model";
const STORAGE_KEY_ACTIVE_THREAD = "cortex_ai_active_thread";

import type {
  AIModel,
  ToolCall,
  ToolResult,
  Message,
  AIMessage,
  Thread,
  SubAgent,
  StreamChunk,
  ToolParameter,
  ToolDefinition,
  FileContext,
  MessageContext,
} from "../types";

export type {
  AIModel,
  ToolCall,
  ToolResult,
  Message,
  AIMessage,
  Thread,
  SubAgent,
  StreamChunk,
  ToolParameter,
  ToolDefinition,
  FileContext,
  MessageContext,
};

export interface AIContextValue {
  models: Accessor<AIModel[]>;
  selectedModel: Accessor<string>;
  setSelectedModel: (model: string) => void;

  threads: Accessor<Thread[]>;
  activeThread: Accessor<Thread | null>;
  createThread: () => Promise<Thread>;
  selectThread: (id: string) => void;
  deleteThread: (id: string) => Promise<void>;
  clearAllThreads: () => Promise<void>;

  sendMessage: (content: string, context?: MessageContext) => Promise<void>;
  isStreaming: Accessor<boolean>;
  streamingContent: Accessor<string>;
  cancelStream: () => void;

  agents: Accessor<SubAgent[]>;
  spawnAgent: (name: string, systemPrompt: string) => Promise<string>;
  runAgentTask: (agentId: string, prompt: string, context: string[]) => Promise<void>;
  cancelAgentTask: (taskId: string) => Promise<void>;

  availableTools: Accessor<ToolDefinition[]>;
}

interface AIState {
  models: AIModel[];
  selectedModel: string;
  threads: Thread[];
  activeThreadId: string | null;
  agents: SubAgent[];
  tools: ToolDefinition[];
  isStreaming: boolean;
  streamingContent: string;
  currentStreamAbortController: AbortController | null;
}

const AIContext = createContext<AIContextValue>();

export function AIProvider(props: ParentProps) {
  const [state, setState] = createStore<AIState>({
    models: [],
    selectedModel: "",
    threads: [],
    activeThreadId: null,
    agents: [],
    tools: [],
    isStreaming: false,
    streamingContent: "",
    currentStreamAbortController: null,
  });

  let showToast: ((message: string, variant: "success" | "error" | "warning" | "info") => void) | null = null;

  const initToast = () => {
    if (!showToast) {
      try {
        const toastModule = (window as unknown as { __toastContext?: { error: (msg: string) => void; success: (msg: string) => void; warning: (msg: string) => void; info: (msg: string) => void } }).__toastContext;
        if (toastModule) {
          showToast = (message, variant) => {
            toastModule[variant]?.(message);
          };
        }
      } catch (err) {
        console.debug("[AI] Toast module import failed:", err);
      }
    }
  };

  const notifyError = (message: string) => {
    initToast();
    if (showToast) {
      showToast(message, "error");
    } else {
      console.error("[AIContext]", message);
    }
  };

  const notifySuccess = (message: string) => {
    initToast();
    if (showToast) {
      showToast(message, "success");
    } else {
      aiLogger.debug(message);
    }
  };

  const loadFromStorage = () => {
    try {
      const savedModel = localStorage.getItem(STORAGE_KEY_SELECTED_MODEL);
      if (savedModel) {
        setState("selectedModel", savedModel);
      }

      const savedThreadId = localStorage.getItem(STORAGE_KEY_ACTIVE_THREAD);
      if (savedThreadId) {
        setState("activeThreadId", savedThreadId);
      }
    } catch (e) {
      console.warn("[AIContext] Failed to load from storage:", e);
    }
  };

  const saveToStorage = () => {
    try {
      if (state.selectedModel) {
        localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, state.selectedModel);
      }
      if (state.activeThreadId) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_THREAD, state.activeThreadId);
      }
    } catch (e) {
      console.warn("[AIContext] Failed to save to storage:", e);
    }
  };

  const _fetchModels = async (): Promise<void> => {
    try {
      const models = await invoke<AIModel[]>("ai_list_models");
      setState("models", models);

      if (!state.selectedModel && models.length > 0) {
        setState("selectedModel", models[0].id);
      }
    } catch (e) {
      console.error("[AIContext] Failed to fetch models:", e);
      notifyError("Failed to load AI models");
    }
  };

  const _fetchThreads = async () => {
    try {
      const threads = await invoke<Thread[]>("ai_list_threads");
      setState("threads", threads);

      if (state.activeThreadId) {
        const exists = threads.some((t) => t.id === state.activeThreadId);
        if (!exists) {
          setState("activeThreadId", null);
        }
      }
    } catch (e) {
      console.error("[AIContext] Failed to fetch threads:", e);
      notifyError("Failed to load chat threads");
    }
  };

  const _fetchTools = async () => {
    try {
      const tools = await invoke<ToolDefinition[]>("tools_list");
      setState("tools", tools);
    } catch (e) {
      console.error("[AIContext] Failed to fetch tools:", e);
    }
  };

  const fetchAgents = async () => {
    try {
      const agents = await invoke<SubAgent[]>("agent_list");
      setState("agents", agents);
    } catch (e) {
      console.error("[AIContext] Failed to fetch agents:", e);
    }
  };

  const setSelectedModel = (model: string) => {
    setState("selectedModel", model);
    saveToStorage();
  };

  const createThread = async (): Promise<Thread> => {
    try {
      const selectedModelInfo = state.models.find(m => m.id === state.selectedModel);
      const thread = await invoke<Thread>("ai_create_thread", {
        modelId: state.selectedModel,
        provider: selectedModelInfo?.provider || "openai",
        title: "New Chat",
        systemPrompt: "You are a helpful coding assistant.",
      });

      setState(
        produce((s) => {
          s.threads.unshift(thread);
          s.activeThreadId = thread.id;
        })
      );
      saveToStorage();

      return thread;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create thread";
      notifyError(message);
      throw e;
    }
  };

  const selectThread = (id: string) => {
    const thread = state.threads.find((t) => t.id === id);
    if (thread) {
      setState("activeThreadId", id);
      saveToStorage();
    }
  };

  const deleteThread = async (id: string): Promise<void> => {
    try {
      await invoke("ai_delete_thread", { threadId: id });

      setState(
        produce((s) => {
          s.threads = s.threads.filter((t) => t.id !== id);
          if (s.activeThreadId === id) {
            s.activeThreadId = s.threads.length > 0 ? s.threads[0].id : null;
          }
        })
      );
      saveToStorage();

      notifySuccess("Thread deleted");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete thread";
      notifyError(message);
      throw e;
    }
  };

  const clearAllThreads = async (): Promise<void> => {
    try {
      const threadIds = state.threads.map((t) => t.id);
      await Promise.all(threadIds.map((id) => invoke("ai_delete_thread", { threadId: id })));

      batch(() => {
        setState("threads", []);
        setState("activeThreadId", null);
      });
      saveToStorage();

      notifySuccess("All threads cleared");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to clear threads";
      notifyError(message);
      throw e;
    }
  };

  const sendMessage = async (content: string, _context?: MessageContext): Promise<void> => {
    if (state.isStreaming) {
      notifyError("Please wait for the current response to complete");
      return;
    }

    let threadId = state.activeThreadId;

    if (!threadId) {
      const thread = await createThread();
      threadId = thread.id;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: Date.now(),
    };

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    batch(() => {
      setState(
        produce((s) => {
          const thread = s.threads.find((t) => t.id === threadId);
          if (thread) {
            thread.messages.push(userMessage);
            thread.messages.push(assistantMessage);
            thread.updatedAt = Date.now();
          }
        })
      );
      setState("isStreaming", true);
      setState("streamingContent", "");
    });

    const abortController = new AbortController();
    setState("currentStreamAbortController", abortController);

    try {
      const thread = state.threads.find(t => t.id === threadId);
      const selectedModelInfo = state.models.find(m => m.id === state.selectedModel);
      
      if (!thread) throw new Error("Thread not found");

      const messagesForBackend = thread.messages
        .filter(m => m.id !== assistantMessage.id)
        .map(m => ({
          id: m.id,
          role: m.role,
          content: [{ type: 'text', text: m.content }],
          timestamp: new Date(m.timestamp).toISOString(),
          metadata: {}
        }));

      await invoke("ai_add_message", {
        threadId,
        message: messagesForBackend[messagesForBackend.length - 1]
      });

      await invoke("ai_stream", {
        messages: messagesForBackend,
        model: state.selectedModel,
        provider: selectedModelInfo?.provider || "openai",
        threadId: threadId,
      });
    } catch (e) {
      if (abortController.signal.aborted) {
        return;
      }

      const message = e instanceof Error ? e.message : "Failed to send message";
      notifyError(message);

      setState(
        produce((s) => {
          const thread = s.threads.find((t) => t.id === threadId);
          if (thread) {
            thread.messages = thread.messages.filter((m) => m.id !== assistantMessage.id);
          }
        })
      );

      batch(() => {
        setState("isStreaming", false);
        setState("streamingContent", "");
        setState("currentStreamAbortController", null);
      });

      throw e;
    }
  };

  const cancelStream = () => {
    if (!state.isStreaming) return;

    const abortController = state.currentStreamAbortController;
    if (abortController) {
      abortController.abort();
    }

    batch(() => {
      if (state.streamingContent) {
        setState(
          produce((s) => {
            const thread = s.threads.find((t) => t.id === s.activeThreadId);
            if (thread && thread.messages.length > 0) {
              const lastMsg = thread.messages[thread.messages.length - 1];
              if (lastMsg.role === "assistant") {
                lastMsg.content = s.streamingContent + " [cancelled]";
              }
            }
          })
        );
      }
      setState("isStreaming", false);
      setState("streamingContent", "");
      setState("currentStreamAbortController", null);
    });
  };

  const spawnAgent = async (name: string, systemPrompt: string): Promise<string> => {
    try {
      const agentId = await invoke<string>("agent_spawn", {
        name,
        systemPrompt,
        parentId: null,
      });

      await fetchAgents();

      return agentId;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to spawn agent";
      notifyError(message);
      throw e;
    }
  };

  const runAgentTask = async (agentId: string, prompt: string, context: string[]): Promise<void> => {
    try {
      setState(
        produce((s) => {
          const agent = s.agents.find((a) => a.id === agentId);
          if (agent) {
            agent.status = "running";
          }
        })
      );

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

      const message = e instanceof Error ? e.message : "Agent task failed";
      notifyError(message);
      throw e;
    }
  };

  const cancelAgentTask = async (taskId: string): Promise<void> => {
    try {
      await invoke("agent_cancel_task", { taskId });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to cancel agent task";
      notifyError(message);
      throw e;
    }
  };

  const models: Accessor<AIModel[]> = () => state.models;
  const selectedModel: Accessor<string> = () => state.selectedModel;
  const threads: Accessor<Thread[]> = () => state.threads;
  const activeThread: Accessor<Thread | null> = () => {
    if (!state.activeThreadId) return null;
    return state.threads.find((t) => t.id === state.activeThreadId) ?? null;
  };
  const isStreaming: Accessor<boolean> = () => state.isStreaming;
  const streamingContent: Accessor<string> = () => state.streamingContent;
  const agents: Accessor<SubAgent[]> = () => state.agents;
  const availableTools: Accessor<ToolDefinition[]> = () => state.tools;

  const contextValue: AIContextValue = {
    models,
    selectedModel,
    setSelectedModel,

    threads,
    activeThread,
    createThread,
    selectThread,
    deleteThread,
    clearAllThreads,

    sendMessage,
    isStreaming,
    streamingContent,
    cancelStream,

    agents,
    spawnAgent,
    runAgentTask,
    cancelAgentTask,

    availableTools,
  };

  onMount(async () => {
    loadFromStorage();

    void _fetchModels();
    void _fetchThreads();
    void _fetchTools();
  });

  onCleanup(() => {
    if (state.isStreaming) {
      cancelStream();
    }
  });

  return <AIContext.Provider value={contextValue}>{props.children}</AIContext.Provider>;
}

export function useAI(): AIContextValue {
  const ctx = useContext(AIContext);
  if (!ctx) {
    throw new Error("useAI must be used within AIProvider");
  }
  return ctx;
}
