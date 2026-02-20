/**
 * CollabSyncContext - Real-time CRDT Sync Layer
 *
 * Manages WebSocket connection to the collaboration backend,
 * CRDT document state, and conflict resolution. Integrates
 * with the existing CollabContext to provide the sync backbone.
 */

import {
  createContext,
  useContext,
  ParentProps,
  onMount,
  onCleanup,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { listen } from "@tauri-apps/api/event";
import {
  collabCreateSession,
  collabJoinSession,
  collabLeaveSession,
  collabBroadcastCursor,
  collabSyncDocument,
  type CollabSessionInfo,
  type CollabParticipant,
} from "@/sdk/collab";
import { createLogger } from "@/utils/logger";

const syncLogger = createLogger("CollabSync");

export type SyncConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

interface CollabSyncState {
  connectionState: SyncConnectionState;
  session: CollabSessionInfo | null;
  localUserId: string | null;
  serverPort: number | null;
  wsConnected: boolean;
  error: string | null;
  remoteCursors: Record<
    string,
    { fileId: string; line: number; column: number; timestamp: number }
  >;
  remoteSelections: Record<
    string,
    {
      fileId: string;
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
      timestamp: number;
    }
  >;
}

interface CollabSyncContextValue {
  state: CollabSyncState;

  createSession: (
    name: string,
    userName: string,
  ) => Promise<CollabSessionInfo>;
  joinSession: (
    sessionId: string,
    userName: string,
  ) => Promise<CollabSessionInfo>;
  leaveSession: () => Promise<void>;

  broadcastCursor: (
    fileId: string,
    line: number,
    column: number,
  ) => Promise<void>;
  syncDocument: (fileId: string, update: number[]) => Promise<number[]>;

  connectWebSocket: (port: number, sessionId: string) => void;
  disconnectWebSocket: () => void;
}

const CollabSyncContext = createContext<CollabSyncContextValue>();

export function CollabSyncProvider(props: ParentProps) {
  const [state, setState] = createStore<CollabSyncState>({
    connectionState: "disconnected",
    session: null,
    localUserId: null,
    serverPort: null,
    wsConnected: false,
    error: null,
    remoteCursors: {},
    remoteSelections: {},
  });

  let ws: WebSocket | null = null;
  let pingInterval: number | null = null;
  let reconnectTimer: number | null = null;

  const connectWebSocket = (port: number, sessionId: string) => {
    if (ws?.readyState === WebSocket.OPEN) return;

    setState("connectionState", "connecting");
    const url = `ws://127.0.0.1:${port}/collab`;

    try {
      ws = new WebSocket(url);

      ws.onopen = () => {
        setState("connectionState", "connected");
        setState("wsConnected", true);
        setState("error", null);
        syncLogger.debug(`WebSocket connected to ${url}`);

        pingInterval = window.setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      ws.onclose = (event) => {
        setState("wsConnected", false);
        stopPing();

        if (!event.wasClean && state.session) {
          setState("connectionState", "connecting");
          reconnectTimer = window.setTimeout(() => {
            connectWebSocket(port, sessionId);
          }, 3000);
        } else {
          setState("connectionState", "disconnected");
        }
      };

      ws.onerror = () => {
        setState("connectionState", "error");
        setState("error", "WebSocket connection failed");
      };

      ws.onmessage = (event) => {
        handleWsMessage(event.data);
      };
    } catch (err) {
      setState("connectionState", "error");
      setState(
        "error",
        err instanceof Error ? err.message : "Connection failed",
      );
    }
  };

  const disconnectWebSocket = () => {
    stopPing();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close(1000, "User disconnected");
      ws = null;
    }
    setState(
      produce((s) => {
        s.connectionState = "disconnected";
        s.wsConnected = false;
        s.remoteCursors = {};
        s.remoteSelections = {};
      }),
    );
  };

  const stopPing = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  };

  const handleWsMessage = (data: string) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case "cursor_update": {
          const { user_id, cursor } = message.payload;
          if (user_id !== state.localUserId) {
            setState("remoteCursors", user_id, {
              fileId: cursor.file_id,
              line: cursor.line,
              column: cursor.column,
              timestamp: cursor.timestamp,
            });
          }
          break;
        }

        case "selection_update": {
          const { user_id: selUserId, selection } = message.payload;
          if (selUserId !== state.localUserId) {
            setState("remoteSelections", selUserId, {
              fileId: selection.file_id,
              startLine: selection.start_line,
              startColumn: selection.start_column,
              endLine: selection.end_line,
              endColumn: selection.end_column,
              timestamp: selection.timestamp,
            });
          }
          break;
        }

        case "user_joined": {
          const { user } = message.payload;
          if (state.session) {
            setState("session", "participants", (participants) => [
              ...participants,
              user,
            ]);
          }
          break;
        }

        case "user_left": {
          const { user_id: leftUserId } = message.payload;
          if (state.session) {
            setState("session", "participants", (participants) =>
              participants.filter(
                (p: CollabParticipant) => p.id !== leftUserId,
              ),
            );
          }
          setState(
            produce((s) => {
              delete s.remoteCursors[leftUserId];
              delete s.remoteSelections[leftUserId];
            }),
          );
          break;
        }

        case "pong":
          break;

        case "error": {
          setState("error", message.payload.message);
          break;
        }
      }
    } catch {
      syncLogger.debug("Failed to parse WebSocket message");
    }
  };

  const createSession = async (
    name: string,
    userName: string,
  ): Promise<CollabSessionInfo> => {
    try {
      const sessionInfo = await collabCreateSession(name, userName);
      const userId =
        sessionInfo.participants.length > 0
          ? sessionInfo.participants[0].id
          : null;

      setState(
        produce((s) => {
          s.session = sessionInfo;
          s.localUserId = userId;
          s.serverPort = sessionInfo.serverPort;
          s.error = null;
        }),
      );

      connectWebSocket(sessionInfo.serverPort, sessionInfo.id);

      return sessionInfo;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to create session";
      setState("error", msg);
      throw new Error(msg);
    }
  };

  const joinSession = async (
    sessionId: string,
    userName: string,
  ): Promise<CollabSessionInfo> => {
    try {
      const sessionInfo = await collabJoinSession(sessionId, userName);
      const userId =
        sessionInfo.participants.find((p) => p.name === userName)?.id ?? null;

      setState(
        produce((s) => {
          s.session = sessionInfo;
          s.localUserId = userId;
          s.serverPort = sessionInfo.serverPort;
          s.error = null;
        }),
      );

      connectWebSocket(sessionInfo.serverPort, sessionInfo.id);

      return sessionInfo;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to join session";
      setState("error", msg);
      throw new Error(msg);
    }
  };

  const leaveSession = async (): Promise<void> => {
    if (!state.session || !state.localUserId) return;

    try {
      await collabLeaveSession(state.session.id, state.localUserId);
    } catch {
      syncLogger.debug("Error leaving session via IPC");
    }

    disconnectWebSocket();

    setState(
      produce((s) => {
        s.session = null;
        s.localUserId = null;
        s.serverPort = null;
        s.remoteCursors = {};
        s.remoteSelections = {};
      }),
    );
  };

  const broadcastCursor = async (
    fileId: string,
    line: number,
    column: number,
  ): Promise<void> => {
    if (!state.session || !state.localUserId) return;

    try {
      await collabBroadcastCursor(
        state.session.id,
        state.localUserId,
        fileId,
        line,
        column,
      );
    } catch {
      // Cursor updates are best-effort
    }

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "cursor_update",
          payload: {
            user_id: state.localUserId,
            cursor: {
              file_id: fileId,
              line,
              column,
              timestamp: Date.now(),
            },
          },
        }),
      );
    }
  };

  const syncDocument = async (
    fileId: string,
    update: number[],
  ): Promise<number[]> => {
    if (!state.session) throw new Error("Not in a session");
    return collabSyncDocument(state.session.id, fileId, update);
  };

  onMount(() => {
    const unlisten = listen("collab:user_left", (event) => {
      const payload = event.payload as {
        sessionId: string;
        userId: string;
        sessionRemoved: boolean;
      };
      if (payload.sessionRemoved && payload.sessionId === state.session?.id) {
        disconnectWebSocket();
        setState(
          produce((s) => {
            s.session = null;
            s.localUserId = null;
            s.serverPort = null;
          }),
        );
      }
    });

    onCleanup(() => {
      unlisten.then((fn) => fn());
      disconnectWebSocket();
    });
  });

  const contextValue: CollabSyncContextValue = {
    state,
    createSession,
    joinSession,
    leaveSession,
    broadcastCursor,
    syncDocument,
    connectWebSocket,
    disconnectWebSocket,
  };

  return (
    <CollabSyncContext.Provider value={contextValue}>
      {props.children}
    </CollabSyncContext.Provider>
  );
}

export function useCollabSync(): CollabSyncContextValue {
  const context = useContext(CollabSyncContext);
  if (!context) {
    throw new Error("useCollabSync must be used within CollabSyncProvider");
  }
  return context;
}
