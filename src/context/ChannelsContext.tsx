import { createContext, useContext, ParentProps, onCleanup, createEffect, onMount } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useCollab } from "./CollabContext";

// ============================================================================
// Types
// ============================================================================

export type ChannelVisibility = "public" | "private";

export type ChannelRole = "admin" | "member" | "guest";

export type MemberStatus = "online" | "offline" | "away" | "busy";

export interface ChannelMember {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  role: ChannelRole;
  status: MemberStatus;
  joinedAt: number;
  lastSeenAt: number;
}

export interface ChannelInvitation {
  id: string;
  channelId: string;
  channelName: string;
  inviterId: string;
  inviterName: string;
  inviteeId: string;
  createdAt: number;
  expiresAt?: number;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorColor: string;
  content: string;
  mentions: string[]; // User IDs mentioned
  timestamp: number;
  editedAt?: number;
  replyTo?: string; // Message ID being replied to
  reactions: Record<string, string[]>; // emoji -> user IDs
  attachments: MessageAttachment[];
  isPinned: boolean;
  isDeleted: boolean;
}

export interface MessageAttachment {
  id: string;
  type: "file" | "image" | "code";
  name: string;
  url?: string;
  content?: string;
  language?: string; // For code attachments
  size?: number;
}

export interface ChannelNote {
  id: string;
  channelId: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  collaborators: string[]; // User IDs currently editing
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  visibility: ChannelVisibility;
  parentId?: string; // For nested channels
  creatorId: string;
  createdAt: number;
  updatedAt: number;
  memberCount: number;
  unreadCount: number;
  lastMessageAt?: number;
  lastMessagePreview?: string;
  iconEmoji?: string;
  isPinned: boolean;
  isMuted: boolean;
  topic?: string;
}

export interface ChannelState {
  members: ChannelMember[];
  messages: ChatMessage[];
  notes: ChannelNote[];
  typingUsers: string[]; // User IDs currently typing
  hasMoreMessages: boolean;
  isLoadingMessages: boolean;
  oldestMessageId?: string;
  newestMessageId?: string;
}

interface ChannelsStoreState {
  channels: Channel[];
  channelStates: Record<string, ChannelState>;
  activeChannelId: string | null;
  pendingInvitations: ChannelInvitation[];
  outgoingInvitations: ChannelInvitation[];
  currentUserId: string | null;
  currentUserName: string;
  currentUserColor: string;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  messageInput: string;
  replyingTo: ChatMessage | null;
  editingMessage: ChatMessage | null;
}

// WebSocket message types for channels
type ChannelWSMessageType =
  | "channel_list"
  | "channel_created"
  | "channel_updated"
  | "channel_deleted"
  | "channel_joined"
  | "channel_left"
  | "member_joined"
  | "member_left"
  | "member_updated"
  | "message_sent"
  | "message_edited"
  | "message_deleted"
  | "message_reaction"
  | "messages_history"
  | "typing_start"
  | "typing_stop"
  | "note_created"
  | "note_updated"
  | "note_deleted"
  | "invitation_sent"
  | "invitation_received"
  | "invitation_accepted"
  | "invitation_declined"
  | "channel_error";

interface ChannelWSMessage {
  type: ChannelWSMessageType;
  payload: Record<string, unknown>;
  timestamp: number;
}

// ============================================================================
// Context Value Interface
// ============================================================================

interface ChannelsContextValue {
  state: ChannelsStoreState;

  // Channel management
  createChannel: (
    name: string,
    description: string,
    visibility: ChannelVisibility,
    parentId?: string
  ) => Promise<string>;
  updateChannel: (
    channelId: string,
    updates: Partial<Pick<Channel, "name" | "description" | "visibility" | "topic" | "iconEmoji">>
  ) => Promise<void>;
  deleteChannel: (channelId: string) => Promise<void>;
  joinChannel: (channelId: string) => Promise<void>;
  leaveChannel: (channelId: string) => Promise<void>;

  // Channel selection
  setActiveChannel: (channelId: string | null) => void;
  getActiveChannel: () => Channel | undefined;
  getActiveChannelState: () => ChannelState | undefined;

  // Members
  getChannelMembers: (channelId: string) => ChannelMember[];
  inviteMember: (channelId: string, userId: string, role?: ChannelRole) => Promise<void>;
  removeMember: (channelId: string, userId: string) => Promise<void>;
  updateMemberRole: (channelId: string, userId: string, role: ChannelRole) => Promise<void>;

  // Chat messages
  sendMessage: (content: string, attachments?: MessageAttachment[]) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => void;
  removeReaction: (messageId: string, emoji: string) => void;
  pinMessage: (messageId: string) => Promise<void>;
  unpinMessage: (messageId: string) => Promise<void>;
  loadMoreMessages: (channelId: string) => Promise<void>;
  setReplyingTo: (message: ChatMessage | null) => void;
  setEditingMessage: (message: ChatMessage | null) => void;

  // Typing indicators
  startTyping: () => void;
  stopTyping: () => void;

  // Notes (shared docs)
  createNote: (channelId: string, title: string, content: string) => Promise<string>;
  updateNote: (noteId: string, updates: Partial<Pick<ChannelNote, "title" | "content">>) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  getNotes: (channelId: string) => ChannelNote[];

  // Invitations
  respondToInvitation: (invitationId: string, accept: boolean) => Promise<void>;
  cancelInvitation: (invitationId: string) => Promise<void>;

  // Search & filtering
  setSearchQuery: (query: string) => void;
  getFilteredChannels: () => Channel[];
  searchMessages: (query: string, channelId?: string) => ChatMessage[];

  // Input management
  setMessageInput: (input: string) => void;

  // UI helpers
  toggleChannelPin: (channelId: string) => void;
  toggleChannelMute: (channelId: string) => void;
  markChannelAsRead: (channelId: string) => void;

  // Mentions
  parseMentions: (content: string) => { text: string; mentions: string[] };
  getMentionSuggestions: (query: string) => ChannelMember[];
}

// ============================================================================
// Context
// ============================================================================

const ChannelsContext = createContext<ChannelsContextValue>();

// User colors for members
const MEMBER_COLORS = [
  "#f97316", // orange
  "#22c55e", // green
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#8b5cf6", // violet
];

// ============================================================================
// Provider
// ============================================================================

export function ChannelsProvider(props: ParentProps) {
  const collab = useCollab();

  const [state, setState] = createStore<ChannelsStoreState>({
    channels: [],
    channelStates: {},
    activeChannelId: null,
    pendingInvitations: [],
    outgoingInvitations: [],
    currentUserId: null,
    currentUserName: "User",
    currentUserColor: MEMBER_COLORS[0],
    isConnected: false,
    isLoading: false,
    error: null,
    searchQuery: "",
    messageInput: "",
    replyingTo: null,
    editingMessage: null,
  });

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  const serverUrl = "ws://127.0.0.1:4097/channels";

  // Generate unique ID
  const generateId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  // Get color for member based on index
  const getColorForMember = (index: number): string => {
    return MEMBER_COLORS[index % MEMBER_COLORS.length];
  };

  // ============================================================================
  // Sync with CollabContext
  // ============================================================================

  createEffect(() => {
    const collabUser = collab.state.currentUser;
    if (collabUser) {
      setState(produce((s) => {
        s.currentUserId = collabUser.id;
        s.currentUserName = collabUser.name;
        s.currentUserColor = collabUser.color;
      }));
    }
  });

  createEffect(() => {
    if (collab.state.connectionState === "connected" && !state.isConnected) {
      connectToChannels();
    } else if (collab.state.connectionState === "disconnected" && state.isConnected) {
      disconnectFromChannels();
    }
  });

  // ============================================================================
  // WebSocket Management
  // ============================================================================

  const connectToChannels = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      setState("isLoading", true);
      setState("error", null);

      try {
        ws = new WebSocket(serverUrl);

        ws.onopen = () => {
          setState("isConnected", true);
          setState("isLoading", false);
          startPingInterval();
          requestChannelList();
          resolve();
        };

        ws.onclose = (event) => {
          setState("isConnected", false);
          stopPingInterval();

          if (!event.wasClean) {
            scheduleReconnect();
          }
        };

        ws.onerror = () => {
          setState("isLoading", false);
          setState("error", "Failed to connect to channels server");
          reject(new Error("WebSocket connection failed"));
        };

        ws.onmessage = (event) => {
          handleMessage(event.data);
        };
      } catch (err) {
        setState("isLoading", false);
        setState("error", err instanceof Error ? err.message : "Connection failed");
        reject(err);
      }
    });
  };

  const disconnectFromChannels = (): void => {
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
      s.isConnected = false;
      s.activeChannelId = null;
    }));
  };

  const scheduleReconnect = (): void => {
    reconnectTimer = setTimeout(async () => {
      try {
        await connectToChannels();
      } catch (err) {
        console.debug("[Channels] Reconnect failed:", err);
        scheduleReconnect();
      }
    }, 3000);
  };

  const startPingInterval = (): void => {
    pingInterval = setInterval(() => {
      sendMessage({ type: "channel_list", payload: { ping: true }, timestamp: Date.now() });
    }, 30000);
  };

  const stopPingInterval = (): void => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  };

  // ============================================================================
  // Message Handling
  // ============================================================================

  const sendMessage = (message: ChannelWSMessage): void => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  const handleMessage = (data: string): void => {
    try {
      const message: ChannelWSMessage = JSON.parse(data);

      switch (message.type) {
        case "channel_list":
          handleChannelList(message.payload);
          break;
        case "channel_created":
          handleChannelCreated(message.payload);
          break;
        case "channel_updated":
          handleChannelUpdated(message.payload);
          break;
        case "channel_deleted":
          handleChannelDeleted(message.payload);
          break;
        case "member_joined":
          handleMemberJoined(message.payload);
          break;
        case "member_left":
          handleMemberLeft(message.payload);
          break;
        case "member_updated":
          handleMemberUpdated(message.payload);
          break;
        case "message_sent":
          handleMessageSent(message.payload);
          break;
        case "message_edited":
          handleMessageEdited(message.payload);
          break;
        case "message_deleted":
          handleMessageDeleted(message.payload);
          break;
        case "message_reaction":
          handleMessageReaction(message.payload);
          break;
        case "messages_history":
          handleMessagesHistory(message.payload);
          break;
        case "typing_start":
          handleTypingStart(message.payload);
          break;
        case "typing_stop":
          handleTypingStop(message.payload);
          break;
        case "note_created":
          handleNoteCreated(message.payload);
          break;
        case "note_updated":
          handleNoteUpdated(message.payload);
          break;
        case "note_deleted":
          handleNoteDeleted(message.payload);
          break;
        case "invitation_received":
          handleInvitationReceived(message.payload);
          break;
        case "invitation_accepted":
        case "invitation_declined":
          handleInvitationResponse(message.payload);
          break;
        case "channel_error":
          setState("error", message.payload.message as string);
          break;
      }
    } catch (err) {
      console.error("Failed to parse channel WebSocket message:", err);
    }
  };

  const requestChannelList = (): void => {
    sendMessage({
      type: "channel_list",
      payload: { userId: state.currentUserId },
      timestamp: Date.now(),
    });
  };

  const handleChannelList = (payload: Record<string, unknown>): void => {
    const channels = payload.channels as Channel[];
    const invitations = payload.invitations as ChannelInvitation[];

    setState(produce((s) => {
      s.channels = channels || [];
      s.pendingInvitations = invitations || [];
    }));
  };

  const handleChannelCreated = (payload: Record<string, unknown>): void => {
    const channel = payload.channel as Channel;
    setState("channels", (channels) => [...channels, channel]);

    // Initialize channel state
    setState("channelStates", channel.id, {
      members: [],
      messages: [],
      notes: [],
      typingUsers: [],
      hasMoreMessages: true,
      isLoadingMessages: false,
    });
  };

  const handleChannelUpdated = (payload: Record<string, unknown>): void => {
    const channel = payload.channel as Channel;
    setState("channels", (ch) => ch.id === channel.id, channel);
  };

  const handleChannelDeleted = (payload: Record<string, unknown>): void => {
    const channelId = payload.channelId as string;
    setState("channels", (channels) => channels.filter((c) => c.id !== channelId));

    if (state.activeChannelId === channelId) {
      setState("activeChannelId", null);
    }
  };

  const handleMemberJoined = (payload: Record<string, unknown>): void => {
    const channelId = payload.channelId as string;
    const member = payload.member as ChannelMember;

    const currentState = state.channelStates[channelId];
    if (currentState) {
      const coloredMember = {
        ...member,
        color: member.color || getColorForMember(currentState.members.length),
      };
      setState("channelStates", channelId, "members", (members) => [...members, coloredMember]);
    }

    // Update member count
    setState("channels", (ch) => ch.id === channelId, "memberCount", (c) => c + 1);
  };

  const handleMemberLeft = (payload: Record<string, unknown>): void => {
    const channelId = payload.channelId as string;
    const userId = payload.userId as string;

    setState("channelStates", channelId, "members", (members) =>
      members.filter((m) => m.id !== userId)
    );

    // Update member count
    setState("channels", (ch) => ch.id === channelId, "memberCount", (c) => Math.max(0, c - 1));
  };

  const handleMemberUpdated = (payload: Record<string, unknown>): void => {
    const channelId = payload.channelId as string;
    const member = payload.member as ChannelMember;

    setState("channelStates", channelId, "members", (m) => m.id === member.id, member);
  };

  const handleMessageSent = (payload: Record<string, unknown>): void => {
    const message = payload.message as ChatMessage;
    const channelId = message.channelId;

    setState("channelStates", channelId, "messages", (messages) => [...messages, message]);

    // Update channel's last message info
    setState("channels", (ch) => ch.id === channelId, produce((channel) => {
      channel.lastMessageAt = message.timestamp;
      channel.lastMessagePreview = message.content.slice(0, 50);
      if (state.activeChannelId !== channelId) {
        channel.unreadCount = (channel.unreadCount || 0) + 1;
      }
    }));
  };

  const handleMessageEdited = (payload: Record<string, unknown>): void => {
    const messageId = payload.messageId as string;
    const channelId = payload.channelId as string;
    const newContent = payload.content as string;
    const editedAt = payload.editedAt as number;

    setState("channelStates", channelId, "messages", (m) => m.id === messageId, produce((msg) => {
      msg.content = newContent;
      msg.editedAt = editedAt;
    }));
  };

  const handleMessageDeleted = (payload: Record<string, unknown>): void => {
    const messageId = payload.messageId as string;
    const channelId = payload.channelId as string;

    setState("channelStates", channelId, "messages", (m) => m.id === messageId, "isDeleted", true);
  };

  const handleMessageReaction = (payload: Record<string, unknown>): void => {
    const messageId = payload.messageId as string;
    const channelId = payload.channelId as string;
    const emoji = payload.emoji as string;
    const userId = payload.userId as string;
    const action = payload.action as "add" | "remove";

    setState("channelStates", channelId, "messages", (m) => m.id === messageId, "reactions", produce((reactions) => {
      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }

      if (action === "add" && !reactions[emoji].includes(userId)) {
        reactions[emoji].push(userId);
      } else if (action === "remove") {
        reactions[emoji] = reactions[emoji].filter((id) => id !== userId);
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      }
    }));
  };

  const handleMessagesHistory = (payload: Record<string, unknown>): void => {
    const channelId = payload.channelId as string;
    const messages = payload.messages as ChatMessage[];
    const hasMore = payload.hasMore as boolean;

    setState("channelStates", channelId, produce((channelState) => {
      // Prepend older messages
      channelState.messages = [...messages, ...channelState.messages];
      channelState.hasMoreMessages = hasMore;
      channelState.isLoadingMessages = false;
      if (messages.length > 0) {
        channelState.oldestMessageId = messages[0].id;
      }
    }));
  };

  const handleTypingStart = (payload: Record<string, unknown>): void => {
    const channelId = payload.channelId as string;
    const userId = payload.userId as string;

    const channelState = state.channelStates[channelId];
    if (channelState && !channelState.typingUsers.includes(userId) && userId !== state.currentUserId) {
      setState("channelStates", channelId, "typingUsers", (users) => [...users, userId]);
    }
  };

  const handleTypingStop = (payload: Record<string, unknown>): void => {
    const channelId = payload.channelId as string;
    const userId = payload.userId as string;

    setState("channelStates", channelId, "typingUsers", (users) =>
      users.filter((id) => id !== userId)
    );
  };

  const handleNoteCreated = (payload: Record<string, unknown>): void => {
    const note = payload.note as ChannelNote;
    setState("channelStates", note.channelId, "notes", (notes) => [...notes, note]);
  };

  const handleNoteUpdated = (payload: Record<string, unknown>): void => {
    const note = payload.note as ChannelNote;
    setState("channelStates", note.channelId, "notes", (n) => n.id === note.id, note);
  };

  const handleNoteDeleted = (payload: Record<string, unknown>): void => {
    const noteId = payload.noteId as string;
    const channelId = payload.channelId as string;
    setState("channelStates", channelId, "notes", (notes) => notes.filter((n) => n.id !== noteId));
  };

  const handleInvitationReceived = (payload: Record<string, unknown>): void => {
    const invitation = payload.invitation as ChannelInvitation;
    setState("pendingInvitations", (invitations) => [...invitations, invitation]);
  };

  const handleInvitationResponse = (payload: Record<string, unknown>): void => {
    const invitationId = payload.invitationId as string;
    setState("pendingInvitations", (invitations) =>
      invitations.filter((i) => i.id !== invitationId)
    );
    setState("outgoingInvitations", (invitations) =>
      invitations.filter((i) => i.id !== invitationId)
    );
  };

  // ============================================================================
  // Channel Management
  // ============================================================================

  const createChannel = async (
    name: string,
    description: string,
    visibility: ChannelVisibility,
    parentId?: string
  ): Promise<string> => {
    const channelId = generateId();
    const now = Date.now();

    const channel: Channel = {
      id: channelId,
      name: name.trim().replace(/^#/, ""),
      description: description.trim(),
      visibility,
      parentId,
      creatorId: state.currentUserId || "",
      createdAt: now,
      updatedAt: now,
      memberCount: 1,
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
    };

    // Add locally first
    setState("channels", (channels) => [...channels, channel]);
    setState("channelStates", channelId, {
      members: [
        {
          id: state.currentUserId || "",
          name: state.currentUserName,
          color: state.currentUserColor,
          role: "admin",
          status: "online",
          joinedAt: now,
          lastSeenAt: now,
        },
      ],
      messages: [],
      notes: [],
      typingUsers: [],
      hasMoreMessages: false,
      isLoadingMessages: false,
    });

    sendMessage({
      type: "channel_created",
      payload: { channel },
      timestamp: now,
    });

    return channelId;
  };

  const updateChannel = async (
    channelId: string,
    updates: Partial<Pick<Channel, "name" | "description" | "visibility" | "topic" | "iconEmoji">>
  ): Promise<void> => {
    const now = Date.now();

    setState("channels", (ch) => ch.id === channelId, produce((channel) => {
      Object.assign(channel, updates, { updatedAt: now });
    }));

    sendMessage({
      type: "channel_updated",
      payload: { channelId, updates },
      timestamp: now,
    });
  };

  const deleteChannel = async (channelId: string): Promise<void> => {
    setState("channels", (channels) => channels.filter((c) => c.id !== channelId));

    if (state.activeChannelId === channelId) {
      setState("activeChannelId", null);
    }

    sendMessage({
      type: "channel_deleted",
      payload: { channelId },
      timestamp: Date.now(),
    });
  };

  const joinChannel = async (channelId: string): Promise<void> => {
    const now = Date.now();
    const member: ChannelMember = {
      id: state.currentUserId || "",
      name: state.currentUserName,
      color: state.currentUserColor,
      role: "member",
      status: "online",
      joinedAt: now,
      lastSeenAt: now,
    };

    const channelState = state.channelStates[channelId];
    if (channelState) {
      setState("channelStates", channelId, "members", (members) => [...members, member]);
    } else {
      setState("channelStates", channelId, {
        members: [member],
        messages: [],
        notes: [],
        typingUsers: [],
        hasMoreMessages: true,
        isLoadingMessages: false,
      });
    }

    setState("channels", (ch) => ch.id === channelId, "memberCount", (c) => c + 1);

    sendMessage({
      type: "channel_joined",
      payload: { channelId, member },
      timestamp: now,
    });
  };

  const leaveChannel = async (channelId: string): Promise<void> => {
    const userId = state.currentUserId;

    setState("channelStates", channelId, "members", (members) =>
      members.filter((m) => m.id !== userId)
    );
    setState("channels", (ch) => ch.id === channelId, "memberCount", (c) => Math.max(0, c - 1));

    if (state.activeChannelId === channelId) {
      setState("activeChannelId", null);
    }

    sendMessage({
      type: "channel_left",
      payload: { channelId, userId },
      timestamp: Date.now(),
    });
  };

  // ============================================================================
  // Channel Selection
  // ============================================================================

  const setActiveChannel = (channelId: string | null): void => {
    setState("activeChannelId", channelId);
    setState("messageInput", "");
    setState("replyingTo", null);
    setState("editingMessage", null);

    if (channelId) {
      // Mark as read
      setState("channels", (ch) => ch.id === channelId, "unreadCount", 0);

      // Load messages if needed
      const channelState = state.channelStates[channelId];
      if (!channelState || channelState.messages.length === 0) {
        requestMessagesHistory(channelId);
      }

      // Load members and notes
      requestChannelDetails(channelId);
    }
  };

  const requestMessagesHistory = (channelId: string, beforeMessageId?: string): void => {
    setState("channelStates", channelId, "isLoadingMessages", true);

    sendMessage({
      type: "messages_history",
      payload: { channelId, beforeMessageId, limit: 50 },
      timestamp: Date.now(),
    });
  };

  const requestChannelDetails = (channelId: string): void => {
    sendMessage({
      type: "channel_joined",
      payload: { channelId, userId: state.currentUserId },
      timestamp: Date.now(),
    });
  };

  const getActiveChannel = (): Channel | undefined => {
    return state.channels.find((c) => c.id === state.activeChannelId);
  };

  const getActiveChannelState = (): ChannelState | undefined => {
    if (!state.activeChannelId) return undefined;
    return state.channelStates[state.activeChannelId];
  };

  // ============================================================================
  // Members
  // ============================================================================

  const getChannelMembers = (channelId: string): ChannelMember[] => {
    return state.channelStates[channelId]?.members || [];
  };

  const inviteMember = async (
    channelId: string,
    userId: string,
    role: ChannelRole = "member"
  ): Promise<void> => {
    const now = Date.now();
    const channel = state.channels.find((c) => c.id === channelId);

    const invitation: ChannelInvitation = {
      id: generateId(),
      channelId,
      channelName: channel?.name || "",
      inviterId: state.currentUserId || "",
      inviterName: state.currentUserName,
      inviteeId: userId,
      createdAt: now,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    setState("outgoingInvitations", (invitations) => [...invitations, invitation]);

    sendMessage({
      type: "invitation_sent",
      payload: { invitation, role },
      timestamp: now,
    });
  };

  const removeMember = async (channelId: string, userId: string): Promise<void> => {
    setState("channelStates", channelId, "members", (members) =>
      members.filter((m) => m.id !== userId)
    );
    setState("channels", (ch) => ch.id === channelId, "memberCount", (c) => Math.max(0, c - 1));

    sendMessage({
      type: "member_left",
      payload: { channelId, userId, removed: true },
      timestamp: Date.now(),
    });
  };

  const updateMemberRole = async (
    channelId: string,
    userId: string,
    role: ChannelRole
  ): Promise<void> => {
    setState("channelStates", channelId, "members", (m) => m.id === userId, "role", role);

    sendMessage({
      type: "member_updated",
      payload: { channelId, userId, role },
      timestamp: Date.now(),
    });
  };

  // ============================================================================
  // Chat Messages
  // ============================================================================

  const sendChatMessage = async (content: string, attachments: MessageAttachment[] = []): Promise<void> => {
    if (!state.activeChannelId || !content.trim()) return;

    const { text, mentions } = parseMentions(content);
    const now = Date.now();

    const message: ChatMessage = {
      id: generateId(),
      channelId: state.activeChannelId,
      authorId: state.currentUserId || "",
      authorName: state.currentUserName,
      authorColor: state.currentUserColor,
      content: text,
      mentions,
      timestamp: now,
      replyTo: state.replyingTo?.id,
      reactions: {},
      attachments,
      isPinned: false,
      isDeleted: false,
    };

    // Add locally first
    setState("channelStates", state.activeChannelId, "messages", (messages) => [...messages, message]);

    // Clear input state
    setState("messageInput", "");
    setState("replyingTo", null);
    setState("editingMessage", null);

    // Stop typing indicator
    stopTyping();

    sendMessage({
      type: "message_sent",
      payload: { message },
      timestamp: now,
    });
  };

  const editMessage = async (messageId: string, newContent: string): Promise<void> => {
    if (!state.activeChannelId) return;

    const now = Date.now();

    setState("channelStates", state.activeChannelId, "messages", (m) => m.id === messageId, produce((msg) => {
      msg.content = newContent;
      msg.editedAt = now;
    }));

    setState("editingMessage", null);

    sendMessage({
      type: "message_edited",
      payload: { channelId: state.activeChannelId, messageId, content: newContent, editedAt: now },
      timestamp: now,
    });
  };

  const deleteMessageFn = async (messageId: string): Promise<void> => {
    if (!state.activeChannelId) return;

    setState("channelStates", state.activeChannelId, "messages", (m) => m.id === messageId, "isDeleted", true);

    sendMessage({
      type: "message_deleted",
      payload: { channelId: state.activeChannelId, messageId },
      timestamp: Date.now(),
    });
  };

  const addReaction = (messageId: string, emoji: string): void => {
    if (!state.activeChannelId || !state.currentUserId) return;

    setState("channelStates", state.activeChannelId, "messages", (m) => m.id === messageId, "reactions", produce((reactions) => {
      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }
      if (!reactions[emoji].includes(state.currentUserId!)) {
        reactions[emoji].push(state.currentUserId!);
      }
    }));

    sendMessage({
      type: "message_reaction",
      payload: {
        channelId: state.activeChannelId,
        messageId,
        emoji,
        userId: state.currentUserId,
        action: "add",
      },
      timestamp: Date.now(),
    });
  };

  const removeReaction = (messageId: string, emoji: string): void => {
    if (!state.activeChannelId || !state.currentUserId) return;

    setState("channelStates", state.activeChannelId, "messages", (m) => m.id === messageId, "reactions", produce((reactions) => {
      if (reactions[emoji]) {
        reactions[emoji] = reactions[emoji].filter((id) => id !== state.currentUserId);
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      }
    }));

    sendMessage({
      type: "message_reaction",
      payload: {
        channelId: state.activeChannelId,
        messageId,
        emoji,
        userId: state.currentUserId,
        action: "remove",
      },
      timestamp: Date.now(),
    });
  };

  const pinMessage = async (messageId: string): Promise<void> => {
    if (!state.activeChannelId) return;

    setState("channelStates", state.activeChannelId, "messages", (m) => m.id === messageId, "isPinned", true);

    sendMessage({
      type: "message_edited",
      payload: { channelId: state.activeChannelId, messageId, isPinned: true },
      timestamp: Date.now(),
    });
  };

  const unpinMessage = async (messageId: string): Promise<void> => {
    if (!state.activeChannelId) return;

    setState("channelStates", state.activeChannelId, "messages", (m) => m.id === messageId, "isPinned", false);

    sendMessage({
      type: "message_edited",
      payload: { channelId: state.activeChannelId, messageId, isPinned: false },
      timestamp: Date.now(),
    });
  };

  const loadMoreMessages = async (channelId: string): Promise<void> => {
    const channelState = state.channelStates[channelId];
    if (!channelState || channelState.isLoadingMessages || !channelState.hasMoreMessages) {
      return;
    }

    requestMessagesHistory(channelId, channelState.oldestMessageId);
  };

  const setReplyingTo = (message: ChatMessage | null): void => {
    setState("replyingTo", message);
    setState("editingMessage", null);
  };

  const setEditingMessage = (message: ChatMessage | null): void => {
    setState("editingMessage", message);
    setState("replyingTo", null);
    if (message) {
      setState("messageInput", message.content);
    }
  };

  // ============================================================================
  // Typing Indicators
  // ============================================================================

  const startTyping = (): void => {
    if (!state.activeChannelId) return;

    sendMessage({
      type: "typing_start",
      payload: { channelId: state.activeChannelId, userId: state.currentUserId },
      timestamp: Date.now(),
    });

    // Auto-stop typing after 3 seconds of inactivity
    if (typingTimer) {
      clearTimeout(typingTimer);
    }
    typingTimer = setTimeout(() => {
      stopTyping();
    }, 3000);
  };

  const stopTyping = (): void => {
    if (!state.activeChannelId) return;

    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }

    sendMessage({
      type: "typing_stop",
      payload: { channelId: state.activeChannelId, userId: state.currentUserId },
      timestamp: Date.now(),
    });
  };

  // ============================================================================
  // Notes (Shared Docs)
  // ============================================================================

  const createNote = async (channelId: string, title: string, content: string): Promise<string> => {
    const noteId = generateId();
    const now = Date.now();

    const note: ChannelNote = {
      id: noteId,
      channelId,
      title: title.trim(),
      content,
      authorId: state.currentUserId || "",
      authorName: state.currentUserName,
      createdAt: now,
      updatedAt: now,
      version: 1,
      collaborators: [],
    };

    setState("channelStates", channelId, "notes", (notes) => [...notes, note]);

    sendMessage({
      type: "note_created",
      payload: { note },
      timestamp: now,
    });

    return noteId;
  };

  const updateNote = async (
    noteId: string,
    updates: Partial<Pick<ChannelNote, "title" | "content">>
  ): Promise<void> => {
    if (!state.activeChannelId) return;

    const now = Date.now();

    setState("channelStates", state.activeChannelId, "notes", (n) => n.id === noteId, produce((note) => {
      Object.assign(note, updates);
      note.updatedAt = now;
      note.version++;
    }));

    sendMessage({
      type: "note_updated",
      payload: { channelId: state.activeChannelId, noteId, updates },
      timestamp: now,
    });
  };

  const deleteNote = async (noteId: string): Promise<void> => {
    if (!state.activeChannelId) return;

    setState("channelStates", state.activeChannelId, "notes", (notes) =>
      notes.filter((n) => n.id !== noteId)
    );

    sendMessage({
      type: "note_deleted",
      payload: { channelId: state.activeChannelId, noteId },
      timestamp: Date.now(),
    });
  };

  const getNotes = (channelId: string): ChannelNote[] => {
    return state.channelStates[channelId]?.notes || [];
  };

  // ============================================================================
  // Invitations
  // ============================================================================

  const respondToInvitation = async (invitationId: string, accept: boolean): Promise<void> => {
    const invitation = state.pendingInvitations.find((i) => i.id === invitationId);
    if (!invitation) return;

    setState("pendingInvitations", (invitations) =>
      invitations.filter((i) => i.id !== invitationId)
    );

    if (accept) {
      await joinChannel(invitation.channelId);
    }

    sendMessage({
      type: accept ? "invitation_accepted" : "invitation_declined",
      payload: { invitationId, channelId: invitation.channelId },
      timestamp: Date.now(),
    });
  };

  const cancelInvitation = async (invitationId: string): Promise<void> => {
    setState("outgoingInvitations", (invitations) =>
      invitations.filter((i) => i.id !== invitationId)
    );

    sendMessage({
      type: "invitation_declined",
      payload: { invitationId, cancelled: true },
      timestamp: Date.now(),
    });
  };

  // ============================================================================
  // Search & Filtering
  // ============================================================================

  const setSearchQuery = (query: string): void => {
    setState("searchQuery", query);
  };

  const getFilteredChannels = (): Channel[] => {
    const query = state.searchQuery.toLowerCase();
    if (!query) {
      return state.channels;
    }

    return state.channels.filter(
      (channel) =>
        channel.name.toLowerCase().includes(query) ||
        channel.description.toLowerCase().includes(query) ||
        channel.topic?.toLowerCase().includes(query)
    );
  };

  const searchMessages = (query: string, channelId?: string): ChatMessage[] => {
    const searchTerm = query.toLowerCase();
    const results: ChatMessage[] = [];

    const channelsToSearch = channelId
      ? [channelId]
      : Object.keys(state.channelStates);

    for (const chId of channelsToSearch) {
      const channelState = state.channelStates[chId];
      if (channelState) {
        const matches = channelState.messages.filter(
          (msg) =>
            !msg.isDeleted &&
            (msg.content.toLowerCase().includes(searchTerm) ||
              msg.authorName.toLowerCase().includes(searchTerm))
        );
        results.push(...matches);
      }
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  };

  // ============================================================================
  // Input Management
  // ============================================================================

  const setMessageInput = (input: string): void => {
    setState("messageInput", input);

    // Trigger typing indicator
    if (input.length > 0) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  // ============================================================================
  // UI Helpers
  // ============================================================================

  const toggleChannelPin = (channelId: string): void => {
    setState("channels", (ch) => ch.id === channelId, "isPinned", (pinned) => !pinned);
  };

  const toggleChannelMute = (channelId: string): void => {
    setState("channels", (ch) => ch.id === channelId, "isMuted", (muted) => !muted);
  };

  const markChannelAsRead = (channelId: string): void => {
    setState("channels", (ch) => ch.id === channelId, "unreadCount", 0);
  };

  // ============================================================================
  // Mentions
  // ============================================================================

  const parseMentions = (content: string): { text: string; mentions: string[] } => {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      const username = match[1];
      const member = getActiveChannelState()?.members.find(
        (m) => m.name.toLowerCase() === username.toLowerCase()
      );
      if (member) {
        mentions.push(member.id);
      }
    }

    return { text: content, mentions: [...new Set(mentions)] };
  };

  const getMentionSuggestions = (query: string): ChannelMember[] => {
    const channelState = getActiveChannelState();
    if (!channelState || !query) return [];

    const searchTerm = query.toLowerCase();
    return channelState.members.filter(
      (member) =>
        member.id !== state.currentUserId &&
        member.name.toLowerCase().includes(searchTerm)
    );
  };

  // Cleanup on unmount - wrap in onMount for proper reactive context
  onMount(() => {
    onCleanup(() => {
      disconnectFromChannels();
    });
  });

  const contextValue: ChannelsContextValue = {
    state,
    createChannel,
    updateChannel,
    deleteChannel,
    joinChannel,
    leaveChannel,
    setActiveChannel,
    getActiveChannel,
    getActiveChannelState,
    getChannelMembers,
    inviteMember,
    removeMember,
    updateMemberRole,
    sendMessage: sendChatMessage,
    editMessage,
    deleteMessage: deleteMessageFn,
    addReaction,
    removeReaction,
    pinMessage,
    unpinMessage,
    loadMoreMessages,
    setReplyingTo,
    setEditingMessage,
    startTyping,
    stopTyping,
    createNote,
    updateNote,
    deleteNote,
    getNotes,
    respondToInvitation,
    cancelInvitation,
    setSearchQuery,
    getFilteredChannels,
    searchMessages,
    setMessageInput,
    toggleChannelPin,
    toggleChannelMute,
    markChannelAsRead,
    parseMentions,
    getMentionSuggestions,
  };

  return (
    <ChannelsContext.Provider value={contextValue}>
      {props.children}
    </ChannelsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useChannels(): ChannelsContextValue {
  const context = useContext(ChannelsContext);
  if (!context) {
    throw new Error("useChannels must be used within ChannelsProvider");
  }
  return context;
}
