/**
 * AIStreamContext - Manages AI streaming state (Legacy Pipeline)
 *
 * This context listens to the **legacy AI event pipeline** (`"ai:*"` events)
 * emitted by the `ai_stream` Tauri command in `src-tauri/src/ai/mod.rs`.
 *
 * **Events consumed:**
 * - `"ai:stream_chunk"` → `{ threadId, content, done }` — streaming content deltas
 * - `"ai:tool_call"` → `{ threadId, callId, name, arguments }` — tool call notifications
 * - `"ai:tool_result"` → `{ threadId, callId, output, success, durationMs? }` — tool results
 * - `"ai:error"` → `{ code, message }` — error notifications
 *
 * **Note:** The primary AI pipeline uses `"cortex-event"` via `SDKContext.tsx` instead.
 * This context is used by `InlineAssistant.tsx` and direct model streaming features.
 *
 * Handles:
 * - Streaming content accumulation
 * - Stream cancellation
 */

import {
  createContext,
  useContext,
  onCleanup,
  ParentProps,
  Accessor,
  batch,
} from "solid-js";
import { createStore } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

import type { ToolCall, ToolResult, ToolDefinition } from "../../types";
export type { MessageContext } from "../../types";

interface AIStreamState {
  isStreaming: boolean;
  streamingContent: string;
  currentStreamAbortController: AbortController | null;
  tools: ToolDefinition[];
  pendingToolCalls: ToolCall[];
  toolResults: ToolResult[];
}

export interface AIStreamContextValue {
  isStreaming: Accessor<boolean>;
  streamingContent: Accessor<string>;
  availableTools: Accessor<ToolDefinition[]>;
  pendingToolCalls: Accessor<ToolCall[]>;
  toolResults: Accessor<ToolResult[]>;
  startStream: (
    threadId: string,
    messages: unknown[],
    model: string,
    provider: string
  ) => Promise<void>;
  cancelStream: () => void;
  fetchTools: () => Promise<void>;
  _state: AIStreamState;
}

const AIStreamContext = createContext<AIStreamContextValue>();

export function AIStreamProvider(props: ParentProps) {
  const [state, setState] = createStore<AIStreamState>({
    isStreaming: false,
    streamingContent: "",
    currentStreamAbortController: null,
    tools: [],
    pendingToolCalls: [],
    toolResults: [],
  });

  const fetchTools = async () => {
    try {
      const tools = await invoke<ToolDefinition[]>("tools_list");
      setState("tools", tools);
    } catch (e) {
      console.error("[AIStreamContext] Failed to fetch tools:", e);
    }
  };

  const startStream = async (
    threadId: string,
    messages: unknown[],
    model: string,
    provider: string
  ): Promise<void> => {
    if (state.isStreaming) {
      throw new Error("Stream already in progress");
    }

    const abortController = new AbortController();

    batch(() => {
      setState("isStreaming", true);
      setState("streamingContent", "");
      setState("currentStreamAbortController", abortController);
      setState("pendingToolCalls", []);
      setState("toolResults", []);
    });

    try {
      await invoke("ai_stream", {
        messages,
        model,
        provider,
        threadId,
      });
    } catch (e) {
      if (!abortController.signal.aborted) {
        batch(() => {
          setState("isStreaming", false);
          setState("streamingContent", "");
          setState("currentStreamAbortController", null);
        });
        throw e;
      }
    }
  };

  const cancelStream = () => {
    if (!state.isStreaming) return;

    const abortController = state.currentStreamAbortController;
    if (abortController) {
      abortController.abort();
    }

    batch(() => {
      setState("isStreaming", false);
      setState("streamingContent", "");
      setState("currentStreamAbortController", null);
    });
  };

  const isStreaming: Accessor<boolean> = () => state.isStreaming;
  const streamingContent: Accessor<string> = () => state.streamingContent;
  const availableTools: Accessor<ToolDefinition[]> = () => state.tools;
  const pendingToolCalls: Accessor<ToolCall[]> = () => state.pendingToolCalls;
  const toolResults: Accessor<ToolResult[]> = () => state.toolResults;

  onCleanup(() => {
    if (state.isStreaming) {
      cancelStream();
    }
  });

  const value: AIStreamContextValue = {
    isStreaming,
    streamingContent,
    availableTools,
    pendingToolCalls,
    toolResults,
    startStream,
    cancelStream,
    fetchTools,
    _state: state,
  };

  return (
    <AIStreamContext.Provider value={value}>
      {props.children}
    </AIStreamContext.Provider>
  );
}

export function useAIStream() {
  const context = useContext(AIStreamContext);
  if (!context) {
    throw new Error("useAIStream must be used within AIStreamProvider");
  }
  return context;
}
