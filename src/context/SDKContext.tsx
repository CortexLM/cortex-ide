import { createContext, useContext, ParentProps, onCleanup, onMount, batch } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { useTauriListen } from "../hooks";
import { type ServerInfo } from "@/utils/tauri";
import { API_BASE_URL } from "../utils/config";
import { getWindowLabel } from "@/utils/windowStorage";
import { getProjectPath } from "../utils/workspace";
import { showWarningNotification } from "@/utils/notifications";
// Define CortexEvent locally since it's not exported from events
interface CortexEvent {
  type: string;
  [key: string]: unknown;
}
import { cortexLogger, createLogger } from "../utils/logger";

const sdkLogger = createLogger("SDK");

// ============================================================================
// Types matching cortex-protocol/Tauri IPC
// ============================================================================

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: "pending" | "running" | "completed" | "error";
  durationMs?: number;
  metadata?: any;
}

export interface Attachment {
  id: string;
  name: string;
  type: "file" | "image";
  path: string;
  content?: string; // Base64 for images or snippet for files
}

export type MessagePart = 
  | { type: "text"; content: string }
  | { type: "tool"; tool: ToolCall }
  | { type: "attachment"; attachment: Attachment };

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
  timestamp: number;
  reasoning?: string;
  metadata?: {
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface Session {
  id: string;
  title: string;
  model: string;
  cwd: string;
  createdAt: number;
}

export interface ApprovalRequest {
  callId: string;
  command: string[];
  cwd: string;
}

export interface Config {
  model: string;
  cwd: string;
  sandboxMode: string;
  approvalMode: string;
}

interface SDKState {
  connected: boolean;
  isConnecting: boolean;
  serverUrl: string;
  serverInfo: ServerInfo | null;
  currentSession: Session | null;
  sessions: Session[]; // All stored sessions
  messages: Message[];
  config: Config;
  isStreaming: boolean;
  pendingApproval: ApprovalRequest | null;
  reasoning: string;
  error: string | null;
}

interface SDKContextValue {
  state: SDKState;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>;
  createSession: (model?: string) => Promise<void>;
  destroySession: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  approve: (callId: string, approved: boolean) => Promise<void>;
  interrupt: () => Promise<void>;
  updateConfig: (config: Partial<Config>) => void;
  updateCwd: (cwd: string) => Promise<void>;
  submitDesignSystem: (callId: string, config: object) => Promise<void>;
  invoke: <T>(cmd: string, args?: any) => Promise<T>;
  pendingContextUpdates: () => string[];
  clearContextUpdates: () => void;
  addContextUpdate: (update: string) => void;
}

// Check if OpenRouter is configured and prefer it as default provider
const getPreferredModel = (): string => {
  if (typeof window !== "undefined") {
    try {
      const savedProvider = localStorage.getItem("cortex_llm_active_provider");
      if (savedProvider === "openrouter") {
        const savedModel = localStorage.getItem("cortex_llm_active_model");
        if (savedModel) return savedModel;
        return "openai/gpt-4o";
      }
    } catch {
      // Ignore storage errors
    }
  }
  return "anthropic/claude-opus-4.5";
};

// Get initial project path from localStorage or URL
const getInitialCwd = (): string => {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const urlProject = params.get("project");
    if (urlProject) return urlProject;

    const label = getWindowLabel();
    return localStorage.getItem(`cortex_current_project_${label}`) ||
           getProjectPath() || 
           ".";
  }
  return ".";
};

const defaultConfig: Config = {
  model: getPreferredModel(),
  cwd: getInitialCwd(),
  sandboxMode: "workspace-write",
  approvalMode: "on-request",
};

const SDKContext = createContext<SDKContextValue>();

export function SDKProvider(props: ParentProps) {
  let currentMessageId = "";
  
  // Pending context updates to include in next user message
  let pendingUpdates: string[] = [];

  const [state, setState] = createStore<SDKState>({
    connected: false,
    isConnecting: false,
    serverUrl: API_BASE_URL,
    serverInfo: null,
    currentSession: null,
    sessions: [],
    messages: [],
    config: defaultConfig,
    isStreaming: false,
    pendingApproval: null,
    reasoning: "",
    error: null,
  });
  
  // Context update management
  const pendingContextUpdates = () => [...pendingUpdates];
  const clearContextUpdates = () => { pendingUpdates = []; };
  const addContextUpdate = (update: string) => { pendingUpdates.push(update); };

  // Watch for project path changes via events (more efficient than polling)
  let projectWatchCleanup: (() => void) | null = null;
  const startProjectWatch = () => {
    if (projectWatchCleanup) return;
    const label = getWindowLabel();
    
    const handleProjectChange = (e: CustomEvent<{ path: string }>) => {
      const newCwd = e.detail?.path || ".";
      if (newCwd !== state.config.cwd) {
        setState("config", "cwd", newCwd);
        sdkLogger.debug(`Project path updated for window ${label}:`, newCwd);
        if (state.currentSession) {
          updateCwd(newCwd).catch((err) => {
            showWarningNotification('Working directory update failed', `Could not sync working directory: ${err}`);
          });
        }
      }
    };
    
    // Listen for storage events (cross-tab changes)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.includes('cortex_current_project')) {
        const newCwd = e.newValue || ".";
        if (newCwd !== state.config.cwd) {
          setState("config", "cwd", newCwd);
          sdkLogger.debug(`Project path updated via storage for window ${label}:`, newCwd);
        }
      }
    };
    
    window.addEventListener("workspace:open-folder", handleProjectChange as EventListener);
    window.addEventListener("storage", handleStorageChange);
    
    projectWatchCleanup = () => {
      window.removeEventListener("workspace:open-folder", handleProjectChange as EventListener);
      window.removeEventListener("storage", handleStorageChange);
    };
  };
  startProjectWatch();

  const appendText = (msg: Message, text: string) => {
    const lastPart = msg.parts[msg.parts.length - 1];
    if (lastPart && lastPart.type === "text") {
      lastPart.content += text;
    } else {
      msg.parts.push({ type: "text", content: text });
    }
  };

  const findToolInMessage = (msg: Message, callId: string): ToolCall | undefined => {
    for (const part of msg.parts) {
      if (part.type === "tool" && part.tool.id === callId) {
        return part.tool;
      }
    }
    return undefined;
  };

  const processMessage = (data: CortexEvent) => {
    cortexLogger.debug("Event:", data.type, data);
    switch (data.type) {
      case "joined_session":
        const newSession: Session = {
          id: data.session_id as string,
          title: "New Session",
          model: state.config.model,
          cwd: state.config.cwd,
          createdAt: Date.now(),
        };
        setState("currentSession", newSession);
        setState(produce((s) => {
          if (!s.sessions.find(sess => sess.id === newSession.id)) {
            s.sessions.unshift(newSession);
          }
        }));
        break;

      case "session_configured":
        const configuredSession: Session = {
          id: data.session_id as string,
          title: state.currentSession?.title || "Session",
          model: data.model as string,
          cwd: data.cwd as string,
          createdAt: state.currentSession?.createdAt || Date.now(),
        };
        setState("currentSession", configuredSession);
        break;

      case "model_updated":
        if (state.currentSession) {
          setState("currentSession", {
            ...state.currentSession,
            model: data.model as string,
          });
          setState("config", { ...state.config, model: data.model as string });
        }
        break;

      case "message_received":
        // Handle user messages from backend (e.g., design system submission)
        // NOTE: Don't add user messages here - they're already added in sendMessage()
        // This was causing duplicate message display
        cortexLogger.debug("message_received (ignored to avoid duplicate):", data);
        break;

      case "task_started":
        cortexLogger.debug("task_started - creating new assistant message");
        batch(() => {
          setState("isStreaming", true);
          setState("reasoning", "");
          setState("error", null); // Clear any previous error
        });
        currentMessageId = crypto.randomUUID();
        setState(produce((s) => {
          s.messages.push({
            id: currentMessageId,
            role: "assistant",
            parts: [],
            timestamp: Date.now(),
            metadata: {},
          });
        }));
        break;

      case "stream_chunk":
        setState(produce((s) => {
          const msg = s.messages.find(m => m.id === currentMessageId);
          if (msg && msg.role === "assistant") {
            appendText(msg, data.content as string);
          }
        }));
        break;

      case "agent_message":
        setState(produce((s) => {
          const msg = s.messages.find(m => m.id === currentMessageId);
          if (msg && msg.role === "assistant") {
            msg.parts = msg.parts.filter(p => p.type !== "text");
            msg.parts.push({ type: "text", content: data.content as string });
          }
        }));
        break;

      case "reasoning_delta":
        setState("reasoning", state.reasoning + (data.delta as string));
        setState(produce((s) => {
          const msg = s.messages.find(m => m.id === currentMessageId);
          if (msg) {
            msg.reasoning = (msg.reasoning || "") + (data.delta as string);
          }
        }));
        break;

      case "tool_call_begin":
        cortexLogger.debug("tool_call_begin - currentMessageId:", currentMessageId, "tool:", data.tool_name);
        setState(produce((s) => {
          const msg = s.messages.find(m => m.id === currentMessageId);
          cortexLogger.debug("Adding tool to message:", msg?.id);
          if (msg) {
            msg.parts.push({
              type: "tool",
              tool: {
                id: data.call_id as string,
                name: data.tool_name as string,
                input: data.arguments as Record<string, unknown>,
                status: "running",
              }
            });
          } else {
            cortexLogger.warn("No message found for tool_call_begin! Creating one.");
            // Create a message if none exists
            currentMessageId = crypto.randomUUID();
            s.messages.push({
              id: currentMessageId,
              role: "assistant",
              parts: [{
                type: "tool",
                tool: {
                  id: data.call_id as string,
                  name: data.tool_name as string,
                  input: data.arguments as Record<string, unknown>,
                  status: "running",
                }
              }],
              timestamp: Date.now(),
              metadata: {},
            });
          }
        }));
        break;

      case "tool_call_output_delta":
        setState(produce((s) => {
          const msg = s.messages.find(m => m.id === currentMessageId);
          if (msg) {
            const tool = findToolInMessage(msg, data.call_id as string);
            if (tool) {
              try {
                const chunk = atob(data.chunk as string);
                tool.output = (tool.output || "") + chunk;
              } catch {
                tool.output = (tool.output || "") + (data.chunk as string);
              }
            }
          }
        }));
        break;

      case "tool_call_end":
        cortexLogger.debug("tool_call_end - currentMessageId:", currentMessageId, "data:", data);
        setState(produce((s) => {
          const msg = s.messages.find(m => m.id === currentMessageId);
          cortexLogger.debug("Found message:", msg?.id, "parts:", msg?.parts.length);
          if (msg) {
            const tool = findToolInMessage(msg, data.call_id as string);
            cortexLogger.debug("Found tool:", tool?.name, tool?.id);
            if (tool) {
              tool.status = (data.success as boolean) ? "completed" : "error";
              if (data.output) {
                tool.output = data.output as string;
              }
              // Also check metadata for structured tool output (Plan, Questions, etc.)
              if (data.metadata) {
                tool.output = JSON.stringify(data.metadata);
              }
              tool.durationMs = data.duration_ms as number;
            }
          }
        }));
        break;

      case "approval_request":
        setState("pendingApproval", {
          callId: data.call_id as string,
          command: data.command as string[],
          cwd: data.cwd as string,
        });
        break;

      case "task_complete":
        setState("isStreaming", false);
        setState("reasoning", "");
        break;

      case "token_usage":
        setState(produce((s) => {
          const msg = s.messages.find(m => m.id === currentMessageId);
          if (msg) {
            msg.metadata = msg.metadata || {};
            msg.metadata.inputTokens = data.input_tokens as number;
            msg.metadata.outputTokens = data.output_tokens as number;
          }
        }));
        break;

      case "cancelled":
        setState("isStreaming", false);
        break;

      case "session_closed":
        // Don't clear - session is still in storage
        break;

      case "warning":
        cortexLogger.warn(data.message);
        break;

      case "error":
        cortexLogger.error("Error:", data.code, data.message);
        batch(() => {
          setState("isStreaming", false);
          setState("error", (data.message as string) || "An error occurred");
        });
        break;

      case "status":
        setState("connected", data.connected as boolean);
        break;

      // Terminal events - handled by TerminalsContext via custom events
      case "terminal_created":
        window.dispatchEvent(new CustomEvent("cortex:terminal-created", { detail: data }));
        break;

      case "terminal_output":
        window.dispatchEvent(new CustomEvent("cortex:terminal-output", { detail: data }));
        break;

      case "terminal_status":
        window.dispatchEvent(new CustomEvent("cortex:terminal-status", { detail: data }));
        break;

      case "terminal_list":
        window.dispatchEvent(new CustomEvent("cortex:terminal-list", { detail: data }));
        break;
    }
  };

  const connect = async () => {
    if (state.connected || state.isConnecting) return;
    
    cortexLogger.debug("Initializing SDK via Direct IPC");
    setState("isConnecting", true);
    
    /** Stored session data from Tauri backend */
    interface StoredSessionData {
      id: string;
      title?: string;
      model: string;
      cwd: string;
      created_at: number;
    }

    try {
      // List stored sessions from Tauri backend
      const storedSessions = await invoke<StoredSessionData[]>("cortex_list_stored_sessions");
      const sessions: Session[] = storedSessions.map((s) => ({
        id: s.id,
        title: s.title || "Session",
        model: s.model,
        cwd: s.cwd,
        createdAt: s.created_at * 1000,
      }));
      
      setState("sessions", sessions);
      setState("connected", true);
    } catch (e) {
      cortexLogger.error("Failed to initialize session list:", e);
      throw e;
    } finally {
      setState("isConnecting", false);
    }
  };

  const disconnect = () => {
    setState("connected", false);
  };

  const createSession = async (model?: string) => {
    try {
      // Get home directory if cwd is "." (no project open)
      let effectiveCwd = state.config.cwd;
      if (effectiveCwd === "." || !effectiveCwd) {
        try {
          effectiveCwd = await invoke<string>("get_home_dir");
        } catch {
          effectiveCwd = ".";
        }
      }
      
      /** Session info returned from Tauri backend */
      interface SessionCreateResponse {
        id: string;
        model: string;
        cwd: string;
      }

      const sessionInfo = await invoke<SessionCreateResponse>("cortex_create_session", {
        model: model || state.config.model,
        cwd: effectiveCwd,
      });
      
      const newSession: Session = {
        id: sessionInfo.id,
        title: "New Session",
        model: sessionInfo.model,
        cwd: sessionInfo.cwd,
        createdAt: Date.now(),
      };
      
      // Clear previous state and set new session
      batch(() => {
        setState("messages", []);
        setState("isStreaming", false);
        setState("reasoning", "");
        setState("pendingApproval", null);
        setState("error", null);
        setState("currentSession", newSession);
        setState(produce((s) => {
          if (!s.sessions.find(sess => sess.id === newSession.id)) {
            s.sessions.unshift(newSession);
          }
        }));
      });
      
      cortexLogger.debug("Created new session:", newSession.id);
    } catch (e) {
      cortexLogger.error("Failed to create session:", e);
      setState("error", `Failed to create session: ${e}`);
      throw e;
    }
  };

  const sendMessage = async (content: string, attachments?: Attachment[]) => {
    // Note: Project open check is done in InputArea.tsx before calling sendMessage
    // This ensures we have access to WorkspaceContext for accurate folder detection

    if (!state.currentSession) {
      await createSession();
    }

    // Prepend pending context updates to the message
    let finalContent = content;
    if (pendingUpdates.length > 0) {
      const contextPrefix = `[Context Update]\n${pendingUpdates.join("\n")}\n\n[User Message]\n`;
      finalContent = contextPrefix + content;
      pendingUpdates = []; // Clear after use
    }

    try {
      await invoke("cortex_send_message", {
        sessionId: state.currentSession!.id,
        content: finalContent,
        attachments: attachments || [],
      });
      
      // Update local state for immediate feedback (show original content to user)
      if (state.connected) {
        setState(produce((s) => {
          s.messages.push({
            id: crypto.randomUUID(),
            role: "user",
            parts: [
              { type: "text", content }, // Show original content, not with context
              ...(attachments || []).map(a => ({ type: "attachment" as const, attachment: a }))
            ],
            timestamp: Date.now(),
          });
        }));
      }
    } catch (e) {
      cortexLogger.error("Failed to send message:", e);
      setState("error", `Failed to send message: ${e}`);
      setState("isStreaming", false);
      throw e;
    }
  };

  const destroySession = async () => {
    if (state.currentSession) {
      try {
        await invoke("cortex_destroy_session", {
          sessionId: state.currentSession.id,
        });
      } catch (e) {
        cortexLogger.warn("Failed to destroy session:", e);
      }
    }
    // Batch state resets to avoid multiple re-renders
    batch(() => {
      setState("currentSession", null);
      setState("messages", []);
      setState("isStreaming", false);
      setState("reasoning", "");
      setState("pendingApproval", null);
    });
  };

  const loadSession = async (sessionId: string) => {
    const session = state.sessions.find(s => s.id === sessionId);
    if (!session) {
      cortexLogger.warn("Session not found:", sessionId);
      return;
    }
    
    // Clear current state first before loading new session
    batch(() => {
      setState("messages", []);
      setState("isStreaming", false);
      setState("reasoning", "");
      setState("pendingApproval", null);
      setState("error", null);
      setState("currentSession", session);
    });
    
    cortexLogger.debug("Loading session:", sessionId);
    
    // Fetch message history and status from Tauri backend
    try {
      const [history, status] = await Promise.all([
        invoke("cortex_get_history", { sessionId }) as Promise<any[]>,
        invoke("cortex_get_status", { sessionId }) as Promise<any>
      ]);

      const messages: Message[] = (history || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        parts: [
          { type: "text" as const, content: m.content },
          ...(m.tool_calls || []).map((tc: any) => ({
            type: "tool" as const,
            tool: {
              id: tc.id,
              name: tc.name,
              input: tc.input,
              output: tc.output,
              status: tc.success ? "completed" : "error",
              durationMs: tc.duration_ms,
            } as ToolCall,
          })),
        ],
        timestamp: m.timestamp * 1000,
      }));
      
      batch(() => {
        setState("messages", messages);
        
        // Update session info if it changed
        if (status) {
          setState("currentSession", {
            ...session,
            model: status.model,
            cwd: status.cwd,
          });
        }
      });
      
      cortexLogger.debug("Loaded session with", messages.length, "messages");
    } catch (e) {
      cortexLogger.error("Failed to load session details:", e);
      setState("error", `Failed to load session: ${e}`);
      // Keep messages empty on error
    }
  };

  const deleteSession = async (sessionId: string) => {
    // Delete from Tauri backend
    try {
      await invoke("cortex_delete_session", { sessionId });
    } catch (e) {
      cortexLogger.error("Failed to delete session:", e);
    }
    setState(produce((s) => {
      s.sessions = s.sessions.filter(sess => sess.id !== sessionId);
    }));
    if (state.currentSession?.id === sessionId) {
      setState("currentSession", null);
      setState("messages", []);
    }
  };

  const approve = async (callId: string, approved: boolean) => {
    if (!state.currentSession) return;
    
    try {
      await invoke("cortex_approve_exec", {
        sessionId: state.currentSession.id,
        callId,
        approved,
      });
      setState("pendingApproval", null);
    } catch (e) {
      cortexLogger.error("Failed to approve:", e);
    }
  };

  const submitDesignSystem = async (callId: string, config: object) => {
    if (!state.currentSession) return;

    try {
      await invoke("cortex_submit_system", {
        sessionId: state.currentSession.id,
        callId,
        config,
      });
    } catch (e) {
      cortexLogger.error("Failed to submit design system:", e);
    }
  };

  const interrupt = async () => {
    if (!state.currentSession) return;

    try {
      await invoke("cortex_cancel", {
        sessionId: state.currentSession.id,
      });
      setState("isStreaming", false);
    } catch (e) {
      cortexLogger.error("Failed to interrupt:", e);
    }
  };

  const updateCwd = async (cwd: string) => {
    if (state.currentSession) {
      try {
        await invoke("cortex_update_cwd", { 
          sessionId: state.currentSession.id, 
          cwd 
        });
        setState("currentSession", "cwd", cwd);
      } catch (err) {
        cortexLogger.error("Failed to update CWD:", err);
      }
    }
  };

  const updateConfig = (config: Partial<Config>) => {
    const oldModel = state.config.model;
    setState("config", { ...state.config, ...config });
    
    // If model changed and we have an active session, send update to server
    if (config.model && config.model !== oldModel && state.currentSession) {
      invoke("cortex_update_model", { 
        sessionId: state.currentSession.id, 
        model: config.model 
      }).catch((err) => {
        showWarningNotification('Model update failed', `Could not switch model: ${err}`);
      });
    }
  };

  // Cleanup on unmount
  onCleanup(() => {
    disconnect();
    if (projectWatchCleanup) {
      projectWatchCleanup();
      projectWatchCleanup = null;
    }
  });

  // Listen for Tauri cortex events (Primary AI Pipeline)
  // Event: "cortex:event" — emitted by session.rs via convert_event_to_ws()
  // Payload: WsMessage (see src-tauri/src/ai/protocol.rs) with { type: "...", ...fields }
  // Handles: stream_chunk, agent_message, tool_call_begin/end, task_started/complete,
  //          approval_request, token_usage, error, reasoning_delta, terminal events, etc.
  useTauriListen<CortexEvent>("cortex:event", (payload) => {
    processMessage(payload);
  });

  // Clear error event handler
  let clearErrorHandler: (() => void) | null = null;
  
  onMount(() => {
    // Listen for clear error event
    clearErrorHandler = () => {
      setState("error", null);
    };
    window.addEventListener("cortex:clear-error", clearErrorHandler);
  });
  
  onCleanup(() => {
    if (clearErrorHandler) {
      window.removeEventListener("cortex:clear-error", clearErrorHandler);
    }
  });

  return (
    <SDKContext.Provider
      value={{
        state,
        connect,
        disconnect,
        sendMessage,
        createSession,
        destroySession,
        loadSession,
        deleteSession,
        approve,
        interrupt,
        updateConfig,
        updateCwd,
        submitDesignSystem,
        invoke: (cmd, args) => invoke(cmd, args),
        pendingContextUpdates,
        clearContextUpdates,
        addContextUpdate,
      }}
    >
      {props.children}
    </SDKContext.Provider>
  );
}

export function useSDK() {
  const ctx = useContext(SDKContext);
  if (!ctx) throw new Error("useSDK must be used within SDKProvider");
  return ctx;
}
