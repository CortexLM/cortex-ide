/**
 * AIThreadContext - Manages AI conversation threads
 * 
 * Handles:
 * - Thread CRUD operations
 * - Active thread selection
 * - Thread persistence
 */

import {
  createContext,
  useContext,
  onMount,
  ParentProps,
  Accessor,
  batch,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

import type { Thread, Message } from "../../types";

const STORAGE_KEY_ACTIVE_THREAD = "cortex_ai_active_thread";

interface AIThreadState {
  threads: Thread[];
  activeThreadId: string | null;
}

export interface AIThreadContextValue {
  threads: Accessor<Thread[]>;
  activeThreadId: Accessor<string | null>;
  activeThread: Accessor<Thread | null>;
  createThread: (modelId: string, provider: string) => Promise<Thread>;
  selectThread: (id: string) => void;
  deleteThread: (id: string) => Promise<void>;
  clearAllThreads: () => Promise<void>;
  addMessageToThread: (threadId: string, message: Message) => void;
  updateThreadMessage: (threadId: string, messageId: string, updates: Partial<Message>) => void;
  fetchThreads: () => Promise<void>;
  _state: AIThreadState;
  _setState: typeof setState;
}

let setState: ReturnType<typeof createStore<AIThreadState>>[1];

const AIThreadContext = createContext<AIThreadContextValue>();

export function AIThreadProvider(props: ParentProps) {
  const [state, setStateLocal] = createStore<AIThreadState>({
    threads: [],
    activeThreadId: null,
  });
  setState = setStateLocal;

  const loadFromStorage = () => {
    try {
      const savedThreadId = localStorage.getItem(STORAGE_KEY_ACTIVE_THREAD);
      if (savedThreadId) {
        setState("activeThreadId", savedThreadId);
      }
    } catch (e) {
      console.warn("[AIThreadContext] Failed to load from storage:", e);
    }
  };

  const saveToStorage = () => {
    try {
      if (state.activeThreadId) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_THREAD, state.activeThreadId);
      }
    } catch (e) {
      console.warn("[AIThreadContext] Failed to save to storage:", e);
    }
  };

  const fetchThreads = async () => {
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
      console.error("[AIThreadContext] Failed to fetch threads:", e);
    }
  };

  const createThread = async (modelId: string, provider: string): Promise<Thread> => {
    const thread = await invoke<Thread>("ai_create_thread", {
      modelId,
      provider,
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
  };

  const selectThread = (id: string) => {
    const thread = state.threads.find((t) => t.id === id);
    if (thread) {
      setState("activeThreadId", id);
      saveToStorage();
    }
  };

  const deleteThread = async (id: string): Promise<void> => {
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
  };

  const clearAllThreads = async (): Promise<void> => {
    const threadIds = state.threads.map((t) => t.id);
    await Promise.all(threadIds.map((id) => invoke("ai_delete_thread", { threadId: id })));

    batch(() => {
      setState("threads", []);
      setState("activeThreadId", null);
    });
    saveToStorage();
  };

  const addMessageToThread = (threadId: string, message: Message) => {
    setState(
      produce((s) => {
        const thread = s.threads.find((t) => t.id === threadId);
        if (thread) {
          thread.messages.push(message);
          thread.updatedAt = Date.now();
        }
      })
    );
  };

  const updateThreadMessage = (threadId: string, messageId: string, updates: Partial<Message>) => {
    setState(
      produce((s) => {
        const thread = s.threads.find((t) => t.id === threadId);
        if (thread) {
          const message = thread.messages.find((m) => m.id === messageId);
          if (message) {
            Object.assign(message, updates);
          }
          thread.updatedAt = Date.now();
        }
      })
    );
  };

  const threads: Accessor<Thread[]> = () => state.threads;
  const activeThreadId: Accessor<string | null> = () => state.activeThreadId;
  const activeThread: Accessor<Thread | null> = () => {
    if (!state.activeThreadId) return null;
    return state.threads.find((t) => t.id === state.activeThreadId) ?? null;
  };

  onMount(() => {
    loadFromStorage();
  });

  const value: AIThreadContextValue = {
    threads,
    activeThreadId,
    activeThread,
    createThread,
    selectThread,
    deleteThread,
    clearAllThreads,
    addMessageToThread,
    updateThreadMessage,
    fetchThreads,
    _state: state,
    _setState: setState,
  };

  return (
    <AIThreadContext.Provider value={value}>
      {props.children}
    </AIThreadContext.Provider>
  );
}

export function useAIThread() {
  const context = useContext(AIThreadContext);
  if (!context) {
    throw new Error("useAIThread must be used within AIThreadProvider");
  }
  return context;
}
