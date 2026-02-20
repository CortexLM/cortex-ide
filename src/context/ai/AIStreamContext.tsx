/**
 * AIStreamContext - Manages AI streaming state
 * 
 * Handles:
 * - Streaming content accumulation
 * - Stream cancellation
 * - Tool call/result events
 */

import {
  createContext,
  useContext,
  onMount,
  onCleanup,
  ParentProps,
  Accessor,
  batch,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

import type { ToolCall, ToolResult, ToolDefinition } from "../../types";
export type { MessageContext } from "../../types";

interface StreamChunkEvent {
  threadId: string;
  content: string;
  done: boolean;
}

interface ToolCallEvent {
  threadId: string;
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResultEvent {
  threadId: string;
  callId: string;
  output: string;
  success: boolean;
  durationMs?: number;
}

interface ErrorEvent {
  code: string;
  message: string;
}

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
    provider: string,
    onChunk?: (content: string, done: boolean) => void,
    onToolCall?: (toolCall: ToolCallEvent) => void,
    onToolResult?: (toolResult: ToolResultEvent) => void
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

  const unlistenFns: UnlistenFn[] = [];
  let currentOnChunk: ((content: string, done: boolean) => void) | undefined;
  let currentOnToolCall: ((toolCall: ToolCallEvent) => void) | undefined;
  let currentOnToolResult: ((toolResult: ToolResultEvent) => void) | undefined;
  let currentThreadId: string | null = null;

  const setupEventListeners = async () => {
    try {
      const unlistenStreamChunk = await listen<StreamChunkEvent>("ai:stream_chunk", (event) => {
        const { threadId, content, done } = event.payload;

        if (threadId !== currentThreadId) return;

        if (done) {
          batch(() => {
            setState("isStreaming", false);
            setState("streamingContent", "");
            setState("currentStreamAbortController", null);
          });
          currentOnChunk?.(state.streamingContent, true);
        } else {
          setState("streamingContent", (prev) => prev + content);
          currentOnChunk?.(content, false);
        }
      });
      unlistenFns.push(unlistenStreamChunk);

      const unlistenToolCall = await listen<ToolCallEvent>("ai:tool_call", (event) => {
        const toolCall = event.payload;
        if (toolCall.threadId !== currentThreadId) return;

        setState(
          produce((s) => {
            s.pendingToolCalls.push({
              id: toolCall.callId,
              name: toolCall.name,
              arguments: toolCall.arguments,
              status: "running",
            });
          })
        );
        currentOnToolCall?.(toolCall);
      });
      unlistenFns.push(unlistenToolCall);

      const unlistenToolResult = await listen<ToolResultEvent>("ai:tool_result", (event) => {
        const result = event.payload;
        if (result.threadId !== currentThreadId) return;

        setState(
          produce((s) => {
            const toolCall = s.pendingToolCalls.find((tc) => tc.id === result.callId);
            if (toolCall) {
              toolCall.status = result.success ? "completed" : "failed";
            }
            s.toolResults.push({
              callId: result.callId,
              output: result.output,
              success: result.success,
              durationMs: result.durationMs,
            });
          })
        );
        currentOnToolResult?.(result);
      });
      unlistenFns.push(unlistenToolResult);

      const unlistenError = await listen<ErrorEvent>("ai:error", (event) => {
        console.error("[AIStreamContext] Error:", event.payload.message);

        if (state.isStreaming) {
          batch(() => {
            setState("isStreaming", false);
            setState("streamingContent", "");
            setState("currentStreamAbortController", null);
          });
        }
      });
      unlistenFns.push(unlistenError);
    } catch (e) {
      console.error("[AIStreamContext] Failed to setup event listeners:", e);
    }
  };

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
    provider: string,
    onChunk?: (content: string, done: boolean) => void,
    onToolCall?: (toolCall: ToolCallEvent) => void,
    onToolResult?: (toolResult: ToolResultEvent) => void
  ): Promise<void> => {
    if (state.isStreaming) {
      throw new Error("Stream already in progress");
    }

    currentThreadId = threadId;
    currentOnChunk = onChunk;
    currentOnToolCall = onToolCall;
    currentOnToolResult = onToolResult;

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

    currentThreadId = null;
    currentOnChunk = undefined;
    currentOnToolCall = undefined;
    currentOnToolResult = undefined;
  };

  const isStreaming: Accessor<boolean> = () => state.isStreaming;
  const streamingContent: Accessor<string> = () => state.streamingContent;
  const availableTools: Accessor<ToolDefinition[]> = () => state.tools;
  const pendingToolCalls: Accessor<ToolCall[]> = () => state.pendingToolCalls;
  const toolResults: Accessor<ToolResult[]> = () => state.toolResults;

  onMount(async () => {
    await setupEventListeners();
  });

  onCleanup(() => {
    if (state.isStreaming) {
      cancelStream();
    }

    for (const unlisten of unlistenFns) {
      unlisten();
    }
    unlistenFns.length = 0;
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
