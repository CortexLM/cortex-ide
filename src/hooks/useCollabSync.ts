import { createSignal, createEffect, onCleanup, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type * as Monaco from "monaco-editor";
import { useCollab } from "@/context/CollabContext";

interface CollabServerInfo {
  port: number;
  running: boolean;
  session_count: number;
}

interface CollabSessionInfo {
  id: string;
  name: string;
  host_id: string;
  session_code: string;
  created_at: number;
  participants: CollabPeerInfo[];
}

interface CollabPeerInfo {
  id: string;
  name: string;
  color: string;
  joined_at: number;
}

interface UseCollabSyncOptions {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  fileId: string | null;
}

export function useCollabSync(options: UseCollabSyncOptions) {
  const { applyTextOperation } = useCollab();

  const [serverRunning, setServerRunning] = createSignal(false);
  const [sessionCode, setSessionCode] = createSignal<string | null>(null);
  const [crdtConnected, setCrdtConnected] = createSignal(false);
  const [syncStatus, setSyncStatus] = createSignal<"idle" | "syncing" | "synced" | "error">("idle");

  let ws: WebSocket | null = null;
  let contentChangeDisposable: Monaco.IDisposable | null = null;
  let isApplyingRemote = false;

  const startServer = async (): Promise<CollabServerInfo> => {
    const info = await invoke<CollabServerInfo>("start_collab_server");
    setServerRunning(info.running);
    return info;
  };

  const stopServer = async (): Promise<void> => {
    await invoke("stop_collab_server");
    setServerRunning(false);
  };

  const createSession = async (name: string, userName: string): Promise<CollabSessionInfo> => {
    const session = await invoke<CollabSessionInfo>("create_collab_session", {
      name,
      userName,
    });
    setSessionCode(session.session_code);
    return session;
  };

  const joinSession = async (code: string, userName: string): Promise<CollabSessionInfo> => {
    const session = await invoke<CollabSessionInfo>("join_collab_session", {
      sessionCode: code,
      userName,
    });
    setSessionCode(session.session_code);
    return session;
  };

  const connectWebSocket = (port: number, roomId: string, user: { id: string; name: string; color: string }) => {
    if (ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const url = `ws://127.0.0.1:${port}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      setCrdtConnected(true);
      setSyncStatus("syncing");

      const joinMsg = {
        type: "join_room",
        payload: {
          room_id: roomId,
          user: {
            id: user.id,
            name: user.name,
            color: user.color,
            cursor: null,
            selection: null,
            joined_at: Date.now(),
          },
        },
      };
      ws?.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = (event) => {
      handleWsMessage(event.data as string);
    };

    ws.onclose = () => {
      setCrdtConnected(false);
      setSyncStatus("idle");
    };

    ws.onerror = () => {
      setSyncStatus("error");
    };
  };

  const handleWsMessage = (data: string) => {
    try {
      const msg = JSON.parse(data);

      switch (msg.type) {
        case "sync_step2":
        case "update":
          handleCrdtUpdate(msg.payload.update);
          break;
        case "sync_step1":
          handleSyncRequest(msg.payload.state_vector);
          break;
        case "room_state":
          setSyncStatus("synced");
          break;
        case "cursor_update":
        case "selection_update":
        case "user_joined":
        case "user_left":
        case "awareness":
        case "chat_message":
          break;
        case "pong":
          break;
        case "error":
          setSyncStatus("error");
          break;
      }
    } catch {
      // Ignore parse errors for binary messages
    }
  };

  const handleCrdtUpdate = (update: number[]) => {
    const editor = options.editor;
    if (!editor || !options.fileId) return;

    isApplyingRemote = true;
    try {
      applyTextOperation({
        type: "insert",
        fileId: options.fileId,
        data: { crdtUpdate: update },
      });
    } finally {
      isApplyingRemote = false;
    }
    setSyncStatus("synced");
  };

  const handleSyncRequest = (_stateVector: number[]) => {
    setSyncStatus("synced");
  };

  const sendCrdtUpdate = (update: number[]) => {
    if (ws?.readyState === WebSocket.OPEN) {
      const msg = {
        type: "update",
        payload: { update },
      };
      ws.send(JSON.stringify(msg));
    }
  };

  const sendCursorUpdate = (userId: string, fileId: string, line: number, column: number) => {
    if (ws?.readyState === WebSocket.OPEN) {
      const msg = {
        type: "cursor_update",
        payload: {
          user_id: userId,
          cursor: {
            file_id: fileId,
            line,
            column,
            timestamp: Date.now(),
          },
        },
      };
      ws.send(JSON.stringify(msg));
    }
  };

  const sendSelectionUpdate = (
    userId: string,
    fileId: string,
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number,
  ) => {
    if (ws?.readyState === WebSocket.OPEN) {
      const msg = {
        type: "selection_update",
        payload: {
          user_id: userId,
          selection: {
            file_id: fileId,
            start_line: startLine,
            start_column: startColumn,
            end_line: endLine,
            end_column: endColumn,
            timestamp: Date.now(),
          },
        },
      };
      ws.send(JSON.stringify(msg));
    }
  };

  createEffect(() => {
    const editor = options.editor;
    const fileId = options.fileId;

    if (!editor || !fileId || !crdtConnected()) {
      contentChangeDisposable?.dispose();
      contentChangeDisposable = null;
      return;
    }

    contentChangeDisposable = editor.onDidChangeModelContent((e) => {
      if (isApplyingRemote) return;

      const changes = e.changes.map((change) => ({
        rangeOffset: change.rangeOffset,
        rangeLength: change.rangeLength,
        text: change.text,
      }));

      const updateData = changes.map((c) => c.rangeOffset);
      sendCrdtUpdate(updateData);
    });

    onCleanup(() => {
      contentChangeDisposable?.dispose();
      contentChangeDisposable = null;
    });
  });

  const disconnectWebSocket = () => {
    if (ws) {
      ws.close(1000, "User disconnected");
      ws = null;
    }
    setCrdtConnected(false);
    setSyncStatus("idle");
  };

  onMount(() => {
    onCleanup(() => {
      disconnectWebSocket();
      contentChangeDisposable?.dispose();
    });
  });

  return {
    serverRunning,
    sessionCode,
    crdtConnected,
    syncStatus,
    startServer,
    stopServer,
    createSession,
    joinSession,
    connectWebSocket,
    disconnectWebSocket,
    sendCrdtUpdate,
    sendCursorUpdate,
    sendSelectionUpdate,
  };
}
