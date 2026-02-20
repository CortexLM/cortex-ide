import { createContext, useContext, ParentProps, createEffect, onCleanup, onMount } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createLogger } from "../utils/logger";

const collabLogger = createLogger("Collab");

// ============================================================================
// Types
// ============================================================================

export type CollabPermission = "owner" | "editor" | "viewer";

export interface CollabUser {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  cursor?: CursorPosition;
  selection?: SelectionRange;
  isFollowing?: string;
  permission: CollabPermission;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
  isSpeaking?: boolean;
}

export interface CursorPosition {
  fileId: string;
  line: number;
  column: number;
  timestamp: number;
}

export interface SelectionRange {
  fileId: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  timestamp: number;
}

export interface CollabRoom {
  id: string;
  name: string;
  hostId: string;
  createdAt: number;
  participants: CollabUser[];
  sharedFiles: string[];
  defaultPermission: CollabPermission;
  sharedTerminals: SharedTerminal[];
  chatMessages: CollabChatMessage[];
}

export interface SharedTerminal {
  id: string;
  terminalId: string;
  name: string;
  ownerId: string;
  allowedUsers: string[];
  isReadOnly: boolean;
  createdAt: number;
}

export interface CollabChatMessage {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  content: string;
  timestamp: number;
  isSystem?: boolean;
  replyToId?: string;
}

export interface CollabInviteLink {
  id: string;
  roomId: string;
  permission: CollabPermission;
  expiresAt?: number;
  maxUses?: number;
  usedCount: number;
  createdAt: number;
}

export type CollabConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

interface CollabState {
  connectionState: CollabConnectionState;
  currentUser: CollabUser | null;
  currentRoom: CollabRoom | null;
  participants: CollabUser[];
  pendingOperations: CollabOperation[];
  followingUser: string | null;
  error: string | null;
  inviteLinks: CollabInviteLink[];
  sharedTerminals: SharedTerminal[];
  chatMessages: CollabChatMessage[];
  unreadChatCount: number;
  isAudioCallActive: boolean;
  isVideoCallActive: boolean;
  serverRunning: boolean;
  sessionToken: string | null;
  wsUrl: string | null;
}

export type CollabOperationType =
  | "insert"
  | "delete"
  | "cursor_move"
  | "selection_change"
  | "file_open"
  | "file_close";

export interface CollabOperation {
  id: string;
  type: CollabOperationType;
  userId: string;
  fileId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

type WSMessageType =
  | "join_room"
  | "leave_room"
  | "room_state"
  | "user_joined"
  | "user_left"
  | "cursor_update"
  | "selection_update"
  | "text_operation"
  | "follow_user"
  | "unfollow_user"
  | "ping"
  | "pong"
  | "error"
  | "update_permission"
  | "permission_updated"
  | "create_invite"
  | "invite_created"
  | "revoke_invite"
  | "share_terminal"
  | "terminal_shared"
  | "unshare_terminal"
  | "terminal_unshared"
  | "terminal_input"
  | "terminal_output"
  | "chat_message"
  | "chat_received"
  | "audio_toggle"
  | "video_toggle"
  | "call_start"
  | "call_end"
  | "user_media_state"
  | "sync_step1"
  | "sync_step2"
  | "sync_update"
  | "awareness_update";

interface WSMessage {
  type: WSMessageType;
  payload: Record<string, unknown>;
  timestamp: number;
}

const USER_COLORS = [
  "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899",
  "#14b8a6", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6",
];

// ============================================================================
// Backend types (from Rust)
// ============================================================================

interface CollabRoomResult {
  room: { id: string; name: string; host_id: string; participant_count: number; created_at: number };
  user_id: string;
  session_token: string;
  ws_url: string;
}

interface CollabServerStatus {
  running: boolean;
  address: string | null;
  port: number | null;
}

// ============================================================================
// Context Value Interface
// ============================================================================

interface CollabContextValue {
  state: CollabState;
  connect: (serverUrl: string) => Promise<void>;
  disconnect: () => void;
  createRoom: (name: string, defaultPermission?: CollabPermission) => Promise<string>;
  joinRoom: (roomId: string, userName: string) => Promise<void>;
  joinRoomWithLink: (inviteLinkId: string, userName: string) => Promise<void>;
  leaveRoom: () => void;
  updateCursor: (position: Omit<CursorPosition, "timestamp">) => void;
  updateSelection: (selection: Omit<SelectionRange, "timestamp">) => void;
  applyTextOperation: (operation: Omit<CollabOperation, "id" | "userId" | "timestamp">) => void;
  followUser: (userId: string) => void;
  unfollowUser: () => void;
  updateUserPermission: (userId: string, permission: CollabPermission) => void;
  canEdit: () => boolean;
  createInviteLink: (permission: CollabPermission, options?: { expiresIn?: number; maxUses?: number }) => Promise<string>;
  revokeInviteLink: (linkId: string) => void;
  shareTerminal: (terminalId: string, name: string, isReadOnly?: boolean) => Promise<string>;
  unshareTerminal: (sharedTerminalId: string) => void;
  sendTerminalInput: (sharedTerminalId: string, data: string) => void;
  sendChatMessage: (content: string, replyToId?: string) => void;
  markChatAsRead: () => void;
  startAudioCall: () => Promise<void>;
  stopAudioCall: () => void;
  toggleAudio: () => void;
  startVideoCall: () => Promise<void>;
  stopVideoCall: () => void;
  toggleVideo: () => void;
  getParticipant: (userId: string) => CollabUser | undefined;
  isHost: () => boolean;
  generateShareLink: (permission?: CollabPermission) => string;
  parseShareLink: (link: string) => { roomId?: string; inviteLinkId?: string } | null;
  syncDocument: (fileId: string, update: Uint8Array) => Promise<Uint8Array>;
  initDocument: (fileId: string, content: string) => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const CollabContext = createContext<CollabContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function CollabProvider(props: ParentProps) {
  const [state, setState] = createStore<CollabState>({
    connectionState: "disconnected",
    currentUser: null,
    currentRoom: null,
    participants: [],
    pendingOperations: [],
    followingUser: null,
    error: null,
    inviteLinks: [],
    sharedTerminals: [],
    chatMessages: [],
    unreadChatCount: 0,
    isAudioCallActive: false,
    isVideoCallActive: false,
    serverRunning: false,
    sessionToken: null,
    wsUrl: null,
  });

  let ws: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let pingInterval: number | null = null;
  let serverUrl: string = "";

  const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  const getColorForUser = (userIndex: number): string => {
    return USER_COLORS[userIndex % USER_COLORS.length];
  };

  // ============================================================================
  // Backend Server Management
  // ============================================================================

  const ensureServerRunning = async (): Promise<void> => {
    if (state.serverRunning) return;

    try {
      const status = await invoke<CollabServerStatus>("collab_get_server_status");
      if (status.running) {
        setState("serverRunning", true);
        return;
      }
    } catch {
      // Server not running, start it
    }

    try {
      await invoke<CollabServerStatus>("collab_start_server");
      setState("serverRunning", true);
      collabLogger.debug("Collab server started");
    } catch (err) {
      collabLogger.debug("Failed to start collab server:", err);
    }
  };

  // ============================================================================
  // WebSocket Management
  // ============================================================================

  const connect = async (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      serverUrl = url;
      setState("connectionState", "connecting");
      setState("error", null);

      try {
        ws = new WebSocket(url);

        ws.onopen = () => {
          setState("connectionState", "connected");
          startPingInterval();
          resolve();
        };

        ws.onclose = (event) => {
          setState("connectionState", "disconnected");
          stopPingInterval();

          if (!event.wasClean && state.currentRoom) {
            scheduleReconnect();
          }
        };

        ws.onerror = () => {
          setState("connectionState", "error");
          setState("error", "WebSocket connection failed");
          reject(new Error("WebSocket connection failed"));
        };

        ws.onmessage = (event) => {
          handleMessage(event.data);
        };
      } catch (err) {
        setState("connectionState", "error");
        setState("error", err instanceof Error ? err.message : "Connection failed");
        reject(err);
      }
    });
  };

  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopPingInterval();

    if (ws) {
      ws.close(1000, "User disconnected");
      ws = null;
    }

    setState(produce((s) => {
      s.connectionState = "disconnected";
      s.currentRoom = null;
      s.participants = [];
      s.currentUser = null;
      s.followingUser = null;
      s.sessionToken = null;
      s.wsUrl = null;
    }));
  };

  const scheduleReconnect = () => {
    setState("connectionState", "reconnecting");
    reconnectTimer = window.setTimeout(async () => {
      try {
        await connect(serverUrl);
        if (state.currentRoom && state.currentUser) {
          await joinRoom(state.currentRoom.id, state.currentUser.name);
        }
      } catch {
        scheduleReconnect();
      }
    }, 3000);
  };

  const startPingInterval = () => {
    pingInterval = window.setInterval(() => {
      sendMessage({ type: "ping", payload: {}, timestamp: Date.now() });
    }, 30000);
  };

  const stopPingInterval = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  };

  // ============================================================================
  // Message Handling
  // ============================================================================

  const sendMessage = (message: WSMessage) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  const handleMessage = (data: string) => {
    try {
      const message: WSMessage = JSON.parse(data);

      switch (message.type) {
        case "room_state": handleRoomState(message.payload); break;
        case "user_joined": handleUserJoined(message.payload); break;
        case "user_left": handleUserLeft(message.payload); break;
        case "cursor_update": handleCursorUpdate(message.payload); break;
        case "selection_update": handleSelectionUpdate(message.payload); break;
        case "text_operation": handleTextOperation(message.payload); break;
        case "follow_user": handleFollowUser(message.payload); break;
        case "permission_updated": handlePermissionUpdated(message.payload); break;
        case "invite_created": handleInviteCreated(message.payload); break;
        case "terminal_shared": handleTerminalShared(message.payload); break;
        case "terminal_unshared": handleTerminalUnshared(message.payload); break;
        case "terminal_output": handleTerminalOutput(message.payload); break;
        case "chat_received": handleChatReceived(message.payload); break;
        case "user_media_state": handleUserMediaState(message.payload); break;
        case "call_start": handleCallStart(message.payload); break;
        case "call_end": handleCallEnd(message.payload); break;
        case "sync_update": handleSyncUpdate(message.payload); break;
        case "pong": break;
        case "error":
          setState("error", message.payload.message as string);
          break;
      }
    } catch (err) {
      collabLogger.debug("Failed to parse WebSocket message:", err);
    }
  };

  const handleRoomState = (payload: Record<string, unknown>) => {
    const room = payload.room as CollabRoom;
    const participants = payload.participants as CollabUser[];

    setState(produce((s) => {
      s.currentRoom = room;
      s.participants = participants;
    }));
  };

  const handleUserJoined = (payload: Record<string, unknown>) => {
    const user = payload.user as CollabUser;

    const coloredUser = {
      ...user,
      color: getColorForUser(state.participants.length),
    };

    setState("participants", (participants) => [...participants, coloredUser]);
  };

  const handleUserLeft = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;

    setState("participants", (participants) =>
      participants.filter((p) => p.id !== userId)
    );

    if (state.followingUser === userId) {
      setState("followingUser", null);
    }
  };

  const handleCursorUpdate = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;
    const cursor = payload.cursor as CursorPosition;

    setState("participants", (p) => p.id === userId, "cursor", cursor);
  };

  const handleSelectionUpdate = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;
    const selection = payload.selection as SelectionRange;

    setState("participants", (p) => p.id === userId, "selection", selection);
  };

  const handleTextOperation = (payload: Record<string, unknown>) => {
    const operation = payload.operation as CollabOperation;
    setState("pendingOperations", (ops) => [...ops, operation]);
  };

  const handleSyncUpdate = (_payload: Record<string, unknown>) => {
    // CRDT sync updates are handled via the sync protocol
    // The frontend applies these through the syncDocument API
  };

  const handleFollowUser = (payload: Record<string, unknown>) => {
    const followerId = payload.followerId as string;
    const targetId = payload.targetId as string;

    setState("participants", (p) => p.id === followerId, "isFollowing", targetId);
  };

  const handlePermissionUpdated = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;
    const permission = payload.permission as CollabPermission;

    setState("participants", (p) => p.id === userId, "permission", permission);

    if (state.currentUser?.id === userId) {
      setState("currentUser", "permission", permission);
    }
  };

  const handleInviteCreated = (payload: Record<string, unknown>) => {
    const link = payload.link as CollabInviteLink;
    setState("inviteLinks", (links) => [...links, link]);
  };

  const handleTerminalShared = (payload: Record<string, unknown>) => {
    const terminal = payload.terminal as SharedTerminal;
    setState("sharedTerminals", (terminals) => {
      if (terminals.some(t => t.id === terminal.id)) return terminals;
      return [...terminals, terminal];
    });
  };

  const handleTerminalUnshared = (payload: Record<string, unknown>) => {
    const terminalId = payload.terminalId as string;
    setState("sharedTerminals", (terminals) =>
      terminals.filter((t) => t.id !== terminalId)
    );
  };

  const handleTerminalOutput = (payload: Record<string, unknown>) => {
    const terminalId = payload.terminalId as string;
    const data = payload.data as string;
    const userId = payload.userId as string;

    window.dispatchEvent(new CustomEvent("collab:terminal_output", {
      detail: { terminalId, data, userId }
    }));
  };

  const handleChatReceived = (payload: Record<string, unknown>) => {
    const message = payload.message as CollabChatMessage;

    if (message.userId === state.currentUser?.id) return;

    setState("chatMessages", (messages) => [...messages, message]);
    setState("unreadChatCount", (count) => count + 1);
  };

  const handleUserMediaState = (payload: Record<string, unknown>) => {
    const userId = payload.userId as string;
    const isAudioEnabled = payload.isAudioEnabled as boolean | undefined;
    const isVideoEnabled = payload.isVideoEnabled as boolean | undefined;
    const isSpeaking = payload.isSpeaking as boolean | undefined;

    setState(produce((s) => {
      const participant = s.participants.find((p) => p.id === userId);
      if (participant) {
        if (isAudioEnabled !== undefined) participant.isAudioEnabled = isAudioEnabled;
        if (isVideoEnabled !== undefined) participant.isVideoEnabled = isVideoEnabled;
        if (isSpeaking !== undefined) participant.isSpeaking = isSpeaking;
      }
    }));
  };

  const handleCallStart = (payload: Record<string, unknown>) => {
    const type = payload.type as "audio" | "video";
    const userId = payload.userId as string;

    if (type === "audio") {
      setState("isAudioCallActive", true);
    } else {
      setState("isVideoCallActive", true);
    }

    const participant = state.participants.find(p => p.id === userId);
    if (participant) {
      const systemMessage: CollabChatMessage = {
        id: generateId(),
        userId: "system",
        userName: "System",
        userColor: "#6366f1",
        content: `${participant.name} started a ${type} call`,
        timestamp: Date.now(),
        isSystem: true,
      };
      setState("chatMessages", (messages) => [...messages, systemMessage]);
    }
  };

  const handleCallEnd = (payload: Record<string, unknown>) => {
    const type = payload.type as "audio" | "video";
    const userId = payload.userId as string;

    if (type === "audio") {
      setState("isAudioCallActive", false);
    } else {
      setState("isVideoCallActive", false);
    }

    const participant = state.participants.find(p => p.id === userId);
    if (participant) {
      const systemMessage: CollabChatMessage = {
        id: generateId(),
        userId: "system",
        userName: "System",
        userColor: "#6366f1",
        content: `${participant.name} ended the ${type} call`,
        timestamp: Date.now(),
        isSystem: true,
      };
      setState("chatMessages", (messages) => [...messages, systemMessage]);
    }
  };

  // ============================================================================
  // Room Management (via Tauri backend)
  // ============================================================================

  const createRoom = async (name: string, _defaultPermission: CollabPermission = "editor"): Promise<string> => {
    await ensureServerRunning();

    try {
      const result = await invoke<CollabRoomResult>("collab_create_room", {
        name: `${name}'s Room`,
        userName: name,
      });

      const user: CollabUser = {
        id: result.user_id,
        name: name,
        color: getColorForUser(0),
        permission: "owner",
      };

      const room: CollabRoom = {
        id: result.room.id,
        name: result.room.name,
        hostId: result.room.host_id,
        createdAt: result.room.created_at,
        participants: [user],
        sharedFiles: [],
        defaultPermission: "editor",
        sharedTerminals: [],
        chatMessages: [],
      };

      setState(produce((s) => {
        s.currentUser = user;
        s.currentRoom = room;
        s.participants = [user];
        s.chatMessages = [];
        s.sharedTerminals = [];
        s.inviteLinks = [];
        s.sessionToken = result.session_token;
        s.wsUrl = result.ws_url;
      }));

      try {
        await connect(result.ws_url);
        sendMessage({
          type: "join_room",
          payload: { room, user },
          timestamp: Date.now(),
        });
      } catch {
        collabLogger.debug("WebSocket connection deferred");
      }

      return result.room.id;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setState("error", errorMsg);
      throw new Error(errorMsg);
    }
  };

  const joinRoom = async (roomId: string, userName: string): Promise<void> => {
    await ensureServerRunning();

    try {
      const result = await invoke<CollabRoomResult>("collab_join_room", {
        roomId,
        userName,
      });

      const user: CollabUser = {
        id: result.user_id,
        name: userName,
        color: getColorForUser(0),
        permission: "editor",
      };

      setState(produce((s) => {
        s.currentUser = user;
        s.sessionToken = result.session_token;
        s.wsUrl = result.ws_url;
      }));

      try {
        await connect(result.ws_url);
        sendMessage({
          type: "join_room",
          payload: { roomId, user },
          timestamp: Date.now(),
        });
      } catch {
        collabLogger.debug("WebSocket connection deferred");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setState("error", errorMsg);
      throw new Error(errorMsg);
    }
  };

  const joinRoomWithLink = async (inviteLinkId: string, userName: string): Promise<void> => {
    const userId = generateId();

    const user: CollabUser = {
      id: userId,
      name: userName,
      color: getColorForUser(0),
      permission: "viewer",
    };

    setState("currentUser", user);

    sendMessage({
      type: "join_room",
      payload: { inviteLinkId, user },
      timestamp: Date.now(),
    });
  };

  const leaveRoom = () => {
    if (state.currentRoom && state.currentUser) {
      invoke("collab_leave_room", {
        roomId: state.currentRoom.id,
        userId: state.currentUser.id,
      }).catch(() => {});

      sendMessage({
        type: "leave_room",
        payload: {
          roomId: state.currentRoom.id,
          userId: state.currentUser.id
        },
        timestamp: Date.now(),
      });
    }

    setState(produce((s) => {
      s.currentRoom = null;
      s.participants = [];
      s.currentUser = null;
      s.followingUser = null;
      s.sessionToken = null;
      s.wsUrl = null;
    }));
  };

  // ============================================================================
  // CRDT Document Sync (via Tauri backend)
  // ============================================================================

  const syncDocument = async (fileId: string, update: Uint8Array): Promise<Uint8Array> => {
    if (!state.currentRoom) throw new Error("Not in a room");

    const result = await invoke<number[]>("collab_sync_document", {
      roomId: state.currentRoom.id,
      fileId,
      update: Array.from(update),
    });

    return new Uint8Array(result);
  };

  const initDocument = async (fileId: string, content: string): Promise<void> => {
    if (!state.currentRoom) throw new Error("Not in a room");

    await invoke("collab_init_document", {
      roomId: state.currentRoom.id,
      fileId,
      content,
    });
  };

  // ============================================================================
  // Cursor & Selection
  // ============================================================================

  const updateCursor = (position: Omit<CursorPosition, "timestamp">) => {
    if (!state.currentUser || !state.currentRoom) return;

    const cursor: CursorPosition = {
      ...position,
      timestamp: Date.now(),
    };

    setState("currentUser", "cursor", cursor);

    sendMessage({
      type: "cursor_update",
      payload: {
        userId: state.currentUser.id,
        cursor,
      },
      timestamp: Date.now(),
    });

    invoke("collab_update_cursor", {
      roomId: state.currentRoom.id,
      userId: state.currentUser.id,
      fileId: position.fileId,
      line: position.line,
      column: position.column,
    }).catch(() => {});
  };

  const updateSelection = (selection: Omit<SelectionRange, "timestamp">) => {
    if (!state.currentUser || !state.currentRoom) return;

    const fullSelection: SelectionRange = {
      ...selection,
      timestamp: Date.now(),
    };

    setState("currentUser", "selection", fullSelection);

    sendMessage({
      type: "selection_update",
      payload: {
        userId: state.currentUser.id,
        selection: fullSelection,
      },
      timestamp: Date.now(),
    });

    invoke("collab_update_selection", {
      roomId: state.currentRoom.id,
      userId: state.currentUser.id,
      fileId: selection.fileId,
      startLine: selection.startLine,
      startColumn: selection.startColumn,
      endLine: selection.endLine,
      endColumn: selection.endColumn,
    }).catch(() => {});
  };

  // ============================================================================
  // Text Operations
  // ============================================================================

  const applyTextOperation = (operation: Omit<CollabOperation, "id" | "userId" | "timestamp">) => {
    if (!state.currentUser || !state.currentRoom) return;

    const fullOperation: CollabOperation = {
      ...operation,
      id: generateId(),
      userId: state.currentUser.id,
      timestamp: Date.now(),
    };

    sendMessage({
      type: "text_operation",
      payload: { operation: fullOperation },
      timestamp: Date.now(),
    });
  };

  // ============================================================================
  // Follow Mode
  // ============================================================================

  const followUser = (userId: string) => {
    if (!state.currentUser || !state.currentRoom) return;

    setState("followingUser", userId);

    sendMessage({
      type: "follow_user",
      payload: {
        followerId: state.currentUser.id,
        targetId: userId,
      },
      timestamp: Date.now(),
    });
  };

  const unfollowUser = () => {
    if (!state.currentUser) return;

    sendMessage({
      type: "unfollow_user",
      payload: {
        followerId: state.currentUser.id,
      },
      timestamp: Date.now(),
    });

    setState("followingUser", null);
  };

  // ============================================================================
  // Permission Management
  // ============================================================================

  const updateUserPermission = (userId: string, permission: CollabPermission) => {
    if (!state.currentUser || !state.currentRoom) return;
    if (!isHost() && state.currentUser.permission !== "owner") return;

    sendMessage({
      type: "update_permission",
      payload: { userId, permission },
      timestamp: Date.now(),
    });

    setState("participants", (p) => p.id === userId, "permission", permission);
  };

  const canEdit = (): boolean => {
    if (!state.currentUser) return false;
    return state.currentUser.permission === "owner" || state.currentUser.permission === "editor";
  };

  // ============================================================================
  // Invite Link Management (via Tauri backend)
  // ============================================================================

  const createInviteLink = async (
    permission: CollabPermission,
    options?: { expiresIn?: number; maxUses?: number }
  ): Promise<string> => {
    if (!state.currentRoom) throw new Error("Not in a room");
    if (!isHost() && state.currentUser?.permission !== "owner") {
      throw new Error("Only the host can create invite links");
    }

    try {
      const token = await invoke<string>("collab_create_invite", {
        roomId: state.currentRoom.id,
        permission,
        expiresInMs: options?.expiresIn ?? null,
        maxUses: options?.maxUses ?? null,
      });

      const linkId = token;
      const link: CollabInviteLink = {
        id: linkId,
        roomId: state.currentRoom.id,
        permission,
        expiresAt: options?.expiresIn ? Date.now() + options.expiresIn : undefined,
        maxUses: options?.maxUses,
        usedCount: 0,
        createdAt: Date.now(),
      };

      setState("inviteLinks", (links) => [...links, link]);

      return `cortex://collab/invite/${linkId}`;
    } catch (err) {
      const linkId = generateId();
      return `cortex://collab/invite/${linkId}`;
    }
  };

  const revokeInviteLink = (linkId: string) => {
    if (!state.currentRoom) return;
    if (!isHost() && state.currentUser?.permission !== "owner") return;

    setState("inviteLinks", (links) => links.filter((l) => l.id !== linkId));

    sendMessage({
      type: "revoke_invite",
      payload: { linkId },
      timestamp: Date.now(),
    });
  };

  // ============================================================================
  // Shared Terminals
  // ============================================================================

  const shareTerminal = async (
    terminalId: string,
    name: string,
    isReadOnly: boolean = false
  ): Promise<string> => {
    if (!state.currentUser || !state.currentRoom) {
      throw new Error("Not in a collaboration session");
    }

    const sharedTerminal: SharedTerminal = {
      id: generateId(),
      terminalId,
      name,
      ownerId: state.currentUser.id,
      allowedUsers: [],
      isReadOnly,
      createdAt: Date.now(),
    };

    setState("sharedTerminals", (terminals) => [...terminals, sharedTerminal]);

    sendMessage({
      type: "share_terminal",
      payload: { terminal: sharedTerminal },
      timestamp: Date.now(),
    });

    return sharedTerminal.id;
  };

  const unshareTerminal = (sharedTerminalId: string) => {
    if (!state.currentUser || !state.currentRoom) return;

    const terminal = state.sharedTerminals.find((t) => t.id === sharedTerminalId);
    if (!terminal) return;
    if (terminal.ownerId !== state.currentUser.id && !isHost()) return;

    setState("sharedTerminals", (terminals) =>
      terminals.filter((t) => t.id !== sharedTerminalId)
    );

    sendMessage({
      type: "unshare_terminal",
      payload: { terminalId: sharedTerminalId },
      timestamp: Date.now(),
    });
  };

  const sendTerminalInput = (sharedTerminalId: string, data: string) => {
    if (!state.currentUser || !state.currentRoom) return;

    const terminal = state.sharedTerminals.find((t) => t.id === sharedTerminalId);
    if (!terminal) return;
    if (terminal.isReadOnly && terminal.ownerId !== state.currentUser.id) return;

    sendMessage({
      type: "terminal_input",
      payload: {
        terminalId: sharedTerminalId,
        data,
        userId: state.currentUser.id,
      },
      timestamp: Date.now(),
    });
  };

  // ============================================================================
  // Chat
  // ============================================================================

  const sendChatMessage = (content: string, replyToId?: string) => {
    if (!state.currentUser || !state.currentRoom) return;
    if (!content.trim()) return;

    const message: CollabChatMessage = {
      id: generateId(),
      userId: state.currentUser.id,
      userName: state.currentUser.name,
      userColor: state.currentUser.color,
      content: content.trim(),
      timestamp: Date.now(),
      replyToId,
    };

    setState("chatMessages", (messages) => [...messages, message]);

    sendMessage({
      type: "chat_message",
      payload: { message },
      timestamp: Date.now(),
    });
  };

  const markChatAsRead = () => {
    setState("unreadChatCount", 0);
  };

  // ============================================================================
  // Audio/Video Calls (Placeholder APIs)
  // ============================================================================

  const startAudioCall = async (): Promise<void> => {
    if (!state.currentUser || !state.currentRoom) return;

    collabLogger.debug("Audio call starting - placeholder implementation");

    setState("isAudioCallActive", true);
    setState("currentUser", "isAudioEnabled", true);

    sendMessage({
      type: "call_start",
      payload: { type: "audio", userId: state.currentUser.id },
      timestamp: Date.now(),
    });
  };

  const stopAudioCall = () => {
    if (!state.currentUser) return;

    setState("isAudioCallActive", false);
    setState("currentUser", "isAudioEnabled", false);

    sendMessage({
      type: "call_end",
      payload: { type: "audio", userId: state.currentUser.id },
      timestamp: Date.now(),
    });
  };

  const toggleAudio = () => {
    if (!state.currentUser) return;

    const newState = !state.currentUser.isAudioEnabled;
    setState("currentUser", "isAudioEnabled", newState);

    sendMessage({
      type: "audio_toggle",
      payload: { userId: state.currentUser.id, enabled: newState },
      timestamp: Date.now(),
    });
  };

  const startVideoCall = async (): Promise<void> => {
    if (!state.currentUser || !state.currentRoom) return;

    collabLogger.debug("Video call starting - placeholder implementation");

    setState("isVideoCallActive", true);
    setState("currentUser", "isVideoEnabled", true);

    sendMessage({
      type: "call_start",
      payload: { type: "video", userId: state.currentUser.id },
      timestamp: Date.now(),
    });
  };

  const stopVideoCall = () => {
    if (!state.currentUser) return;

    setState("isVideoCallActive", false);
    setState("currentUser", "isVideoEnabled", false);

    sendMessage({
      type: "call_end",
      payload: { type: "video", userId: state.currentUser.id },
      timestamp: Date.now(),
    });
  };

  const toggleVideo = () => {
    if (!state.currentUser) return;

    const newState = !state.currentUser.isVideoEnabled;
    setState("currentUser", "isVideoEnabled", newState);

    sendMessage({
      type: "video_toggle",
      payload: { userId: state.currentUser.id, enabled: newState },
      timestamp: Date.now(),
    });
  };

  // ============================================================================
  // Helpers
  // ============================================================================

  const getParticipant = (userId: string): CollabUser | undefined => {
    return state.participants.find((p) => p.id === userId);
  };

  const isHost = (): boolean => {
    return state.currentRoom?.hostId === state.currentUser?.id;
  };

  const generateShareLink = (permission?: CollabPermission): string => {
    if (!state.currentRoom) return "";
    if (permission) {
      const linkId = generateId();
      return `cortex://collab/invite/${state.currentRoom.id}/${linkId}?permission=${permission}`;
    }
    return `cortex://collab/${state.currentRoom.id}`;
  };

  const parseShareLink = (link: string): { roomId?: string; inviteLinkId?: string } | null => {
    try {
      if (link.startsWith("cortex://collab/")) {
        const path = link.replace("cortex://collab/", "");

        if (path.startsWith("invite/")) {
          const parts = path.replace("invite/", "").split("/");
          return { roomId: parts[0], inviteLinkId: parts[1]?.split("?")[0] };
        }

        return { roomId: path.split("?")[0] };
      }

      const url = new URL(link);
      const pathParts = url.pathname.split("/").filter(Boolean);

      if (pathParts[0] === "collab") {
        if (pathParts[1] === "invite") {
          return { roomId: pathParts[2], inviteLinkId: pathParts[3] };
        }
        return { roomId: pathParts[1] };
      }

      return null;
    } catch {
      return null;
    }
  };

  // Listen for Tauri events from backend
  onMount(() => {
    let unlistenJoined: (() => void) | undefined;
    let unlistenLeft: (() => void) | undefined;
    let unlistenSessionCreated: (() => void) | undefined;

    listen<{ roomId: string; userId: string; userName: string }>("collab:user_joined", (event) => {
      collabLogger.debug("User joined via backend event:", event.payload);
    }).then(u => { unlistenJoined = u; });

    listen<{ roomId: string; userId: string }>("collab:user_left", (event) => {
      collabLogger.debug("User left via backend event:", event.payload);
    }).then(u => { unlistenLeft = u; });

    listen<{ id: string; name: string; hostId: string; createdAt: number; participants: unknown[]; documentIds: string[]; serverPort: number }>("collab:session_created", (event) => {
      collabLogger.debug("Session created via backend event:", event.payload);
    }).then(u => { unlistenSessionCreated = u; });

    onCleanup(() => {
      disconnect();
      unlistenJoined?.();
      unlistenLeft?.();
      unlistenSessionCreated?.();
    });
  });

  createEffect(() => {
    if (state.pendingOperations.length > 0) {
      const timer = setTimeout(() => {
        setState("pendingOperations", []);
      }, 100);
      onCleanup(() => clearTimeout(timer));
    }
  });

  const contextValue: CollabContextValue = {
    state,
    connect,
    disconnect,
    createRoom,
    joinRoom,
    joinRoomWithLink,
    leaveRoom,
    updateCursor,
    updateSelection,
    applyTextOperation,
    followUser,
    unfollowUser,
    updateUserPermission,
    canEdit,
    createInviteLink,
    revokeInviteLink,
    shareTerminal,
    unshareTerminal,
    sendTerminalInput,
    sendChatMessage,
    markChatAsRead,
    startAudioCall,
    stopAudioCall,
    toggleAudio,
    startVideoCall,
    stopVideoCall,
    toggleVideo,
    getParticipant,
    isHost,
    generateShareLink,
    parseShareLink,
    syncDocument,
    initDocument,
  };

  return (
    <CollabContext.Provider value={contextValue}>
      {props.children}
    </CollabContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useCollab(): CollabContextValue {
  const context = useContext(CollabContext);
  if (!context) {
    throw new Error("useCollab must be used within CollabProvider");
  }
  return context;
}
