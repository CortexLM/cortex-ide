import { Show, For, createSignal, createMemo, createEffect, onMount, onCleanup } from "solid-js";
import { Icon } from "../ui/Icon";
import {
  useChannels,
  type Channel,
  type ChatMessage,
  type ChannelMember,
  type ChannelVisibility,
} from "@/context/ChannelsContext";
import { Card, Button, IconButton, Input, Badge, Text, EmptyState, Textarea, Avatar } from "@/components/ui";

// ============================================================================
// Main Panel Component
// ============================================================================

interface ChannelsPanelProps {
  class?: string;
  onClose?: () => void;
}

export function ChannelsPanel(props: ChannelsPanelProps) {
  const {
    state,
    setActiveChannel,
    getFilteredChannels,
    setSearchQuery,
    toggleChannelPin,
    toggleChannelMute,
    leaveChannel,
    deleteChannel,
  } = useChannels();

  const [showCreateDialog, setShowCreateDialog] = createSignal(false);
  const [showJoinDialog, setShowJoinDialog] = createSignal(false);
  const [expandedSections, setExpandedSections] = createSignal({
    pinned: true,
    channels: true,
    invitations: true,
  });
  const [contextMenu, setContextMenu] = createSignal<{
    channel: Channel;
    x: number;
    y: number;
  } | null>(null);

  const pinnedChannels = createMemo(() =>
    getFilteredChannels().filter((c) => c.isPinned)
  );

  const unpinnedChannels = createMemo(() =>
    getFilteredChannels().filter((c) => !c.isPinned)
  );

  const toggleSection = (section: "pinned" | "channels" | "invitations") => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleContextMenu = (e: MouseEvent, channel: Channel) => {
    e.preventDefault();
    setContextMenu({ channel, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  // Close context menu on click outside
  onMount(() => {
    document.addEventListener("click", closeContextMenu);
    onCleanup(() => document.removeEventListener("click", closeContextMenu));
  });

  return (
    <div
      class={`flex h-full ${props.class || ""}`}
      style={{
        background: "var(--ui-panel-bg)",
        "border-right": "1px solid var(--jb-border-default)",
      }}
    >
      {/* Channel List Sidebar */}
      <div
        class="w-64 flex flex-col h-full"
        style={{ "border-right": "1px solid var(--jb-border-default)" }}
      >
        {/* Header */}
        <div
          class="flex items-center justify-between px-4 py-3"
          style={{ "border-bottom": "1px solid var(--jb-border-default)" }}
        >
<div class="flex items-center gap-2">
            <Icon name="hashtag" class="w-5 h-5" style={{ color: "var(--jb-border-focus)" }} />
            <Text weight="medium">Channels</Text>
          </div>
          <IconButton
            onClick={() => setShowCreateDialog(true)}
            tooltip="Create channel"
            size="sm"
          >
            <Icon name="plus" class="w-4 h-4" />
          </IconButton>
        </div>

        {/* Search */}
        <div class="px-3 py-2">
<Input
            icon={<Icon name="magnifying-glass" class="w-4 h-4" />}
            placeholder="Search channels..."
            value={state.searchQuery}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </div>

        {/* Channel List */}
        <div class="flex-1 overflow-y-auto">
          {/* Invitations */}
          <Show when={state.pendingInvitations.length > 0}>
            <ChannelSection
              title="Invitations"
              count={state.pendingInvitations.length}
              expanded={expandedSections().invitations}
              onToggle={() => toggleSection("invitations")}
              badge
            >
              <For each={state.pendingInvitations}>
                {(invitation) => (
                  <InvitationItem invitation={invitation} />
                )}
              </For>
            </ChannelSection>
          </Show>

          {/* Pinned Channels */}
          <Show when={pinnedChannels().length > 0}>
            <ChannelSection
              title="Pinned"
              count={pinnedChannels().length}
              expanded={expandedSections().pinned}
              onToggle={() => toggleSection("pinned")}
            >
              <For each={pinnedChannels()}>
                {(channel) => (
                  <ChannelItem
                    channel={channel}
                    isActive={state.activeChannelId === channel.id}
                    onClick={() => setActiveChannel(channel.id)}
                    onContextMenu={(e) => handleContextMenu(e, channel)}
                  />
                )}
              </For>
            </ChannelSection>
          </Show>

          {/* All Channels */}
          <ChannelSection
            title="Channels"
            count={unpinnedChannels().length}
            expanded={expandedSections().channels}
            onToggle={() => toggleSection("channels")}
          >
            <Show
              when={unpinnedChannels().length > 0}
              fallback={
                <EmptyState
                  description="No channels yet"
                  style={{ padding: "16px" }}
                />
              }
            >
              <For each={unpinnedChannels()}>
                {(channel) => (
                  <ChannelItem
                    channel={channel}
                    isActive={state.activeChannelId === channel.id}
                    onClick={() => setActiveChannel(channel.id)}
                    onContextMenu={(e) => handleContextMenu(e, channel)}
                  />
                )}
              </For>
            </Show>
          </ChannelSection>
        </div>

        {/* Actions */}
        <div
          class="px-3 py-2"
          style={{ "border-top": "1px solid var(--jb-border-default)" }}
        >
<Button
            variant="ghost"
            onClick={() => setShowJoinDialog(true)}
            icon={<Icon name="arrow-up-right-from-square" class="w-4 h-4" />}
            style={{ width: "100%" }}
          >
            Join Channel
          </Button>
        </div>
      </div>

      {/* Channel Content Area */}
      <div class="flex-1 flex flex-col">
        <Show
          when={state.activeChannelId}
          fallback={<EmptyChannelState onCreateChannel={() => setShowCreateDialog(true)} />}
        >
          <ChannelContent />
        </Show>
      </div>

      {/* Context Menu */}
      <Show when={contextMenu()}>
        {(menu) => (
          <ChannelContextMenu
            channel={menu().channel}
            x={menu().x}
            y={menu().y}
            onClose={closeContextMenu}
            onTogglePin={() => toggleChannelPin(menu().channel.id)}
            onToggleMute={() => toggleChannelMute(menu().channel.id)}
            onLeave={() => leaveChannel(menu().channel.id)}
            onDelete={() => deleteChannel(menu().channel.id)}
          />
        )}
      </Show>

      {/* Create Channel Dialog */}
      <Show when={showCreateDialog()}>
        <CreateChannelDialog onClose={() => setShowCreateDialog(false)} />
      </Show>

      {/* Join Channel Dialog */}
      <Show when={showJoinDialog()}>
        <JoinChannelDialog onClose={() => setShowJoinDialog(false)} />
      </Show>
    </div>
  );
}

// ============================================================================
// Channel Section Component
// ============================================================================

interface ChannelSectionProps {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  badge?: boolean;
  children: any;
}

function ChannelSection(props: ChannelSectionProps) {
  return (
    <div>
      <button
        onClick={props.onToggle}
        class="w-full flex items-center gap-2 px-4 py-2 transition-colors"
        style={{ background: "transparent" }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
<Show
          when={props.expanded}
          fallback={<Icon name="chevron-right" class="w-3 h-3" style={{ color: "var(--jb-text-muted-color)" }} />}
        >
          <Icon name="chevron-down" class="w-3 h-3" style={{ color: "var(--jb-text-muted-color)" }} />
        </Show>
        <Text variant="header" size="xs">{props.title}</Text>
        <Badge 
          variant={props.badge ? "accent" : "default"}
          size="sm"
          style={{ "margin-left": "auto" }}
        >
          {props.count}
        </Badge>
      </button>
      <Show when={props.expanded}>
        <div class="pb-2">{props.children}</div>
      </Show>
    </div>
  );
}

// ============================================================================
// Channel Item Component
// ============================================================================

interface ChannelItemProps {
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
  onContextMenu: (e: MouseEvent) => void;
}

function ChannelItem(props: ChannelItemProps) {
  return (
    <button
      onClick={props.onClick}
      onContextMenu={props.onContextMenu}
      class="w-full flex items-center gap-2 px-4 py-1.5 text-sm transition-colors"
      style={{
        background: props.isActive ? "var(--jb-surface-selected)" : "transparent",
        color: props.isActive ? "var(--jb-text-body-color)" : "var(--jb-text-muted-color)",
        "border-left": props.isActive ? "2px solid var(--jb-border-focus)" : "2px solid transparent",
      }}
      onMouseEnter={(e) => !props.isActive && (e.currentTarget.style.background = "var(--jb-surface-hover)")}
      onMouseLeave={(e) => !props.isActive && (e.currentTarget.style.background = "transparent")}
    >
<Show when={props.channel.visibility === "private"} fallback={<Icon name="hashtag" class="w-4 h-4 flex-shrink-0" />}>
        <Icon name="lock" class="w-4 h-4 flex-shrink-0" />
      </Show>
      <Text size="sm" truncate>{props.channel.name}</Text>
<Show when={props.channel.isMuted}>
        <Icon name="bell-slash" class="w-3 h-3 flex-shrink-0" style={{ color: "var(--jb-text-muted-color)" }} />
      </Show>
      <Show when={props.channel.unreadCount > 0 && !props.channel.isMuted}>
        <Badge 
          variant="accent"
          size="sm"
          style={{ "margin-left": "auto", "border-radius": "var(--cortex-radius-full)" }}
        >
          {props.channel.unreadCount > 99 ? "99+" : props.channel.unreadCount}
        </Badge>
      </Show>
    </button>
  );
}

// ============================================================================
// Invitation Item Component
// ============================================================================

interface InvitationItemProps {
  invitation: {
    id: string;
    channelId: string;
    channelName: string;
    inviterName: string;
  };
}

function InvitationItem(props: InvitationItemProps) {
  const { respondToInvitation } = useChannels();

  return (
    <Card
      variant="outlined"
      padding="sm"
      class="mx-2"
      style={{ background: "rgba(53, 116, 240, 0.1)" }}
    >
<div class="flex items-center gap-2 mb-2">
        <Icon name="hashtag" class="w-4 h-4" style={{ color: "var(--jb-border-focus)" }} />
        <Text size="sm" weight="medium">{props.invitation.channelName}</Text>
      </div>
      <Text variant="muted" size="xs" style={{ display: "block", "margin-bottom": "8px" }}>
        Invited by {props.invitation.inviterName}
      </Text>
      <div class="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => respondToInvitation(props.invitation.id, true)}
          style={{ flex: "1", background: "var(--cortex-success)" }}
        >
          Accept
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => respondToInvitation(props.invitation.id, false)}
          style={{ flex: "1" }}
        >
          Decline
        </Button>
      </div>
    </Card>
  );
}

// ============================================================================
// Channel Context Menu
// ============================================================================

interface ChannelContextMenuProps {
  channel: Channel;
  x: number;
  y: number;
  onClose: () => void;
  onTogglePin: () => void;
  onToggleMute: () => void;
  onLeave: () => void;
  onDelete: () => void;
}

function ChannelContextMenu(props: ChannelContextMenuProps) {
  const { state } = useChannels();
  const isCreator = () => props.channel.creatorId === state.currentUserId;

  return (
    <div onClick={(e) => e.stopPropagation()}>
    <Card
      variant="elevated"
      padding="sm"
      class="fixed z-50"
      style={{
        left: `${props.x}px`,
        top: `${props.y}px`,
        "min-width": "160px",
      }}
    >
<button
        onClick={() => {
          props.onTogglePin();
          props.onClose();
        }}
        class="w-full flex items-center gap-2 px-3 py-1.5 rounded transition-colors"
        style={{ background: "transparent" }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        <Icon name="star" class="w-4 h-4" />
        <Text size="sm">{props.channel.isPinned ? "Unpin" : "Pin"}</Text>
      </button>
      <button
        onClick={() => {
          props.onToggleMute();
          props.onClose();
        }}
        class="w-full flex items-center gap-2 px-3 py-1.5 rounded transition-colors"
        style={{ background: "transparent" }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        <Show when={props.channel.isMuted} fallback={<Icon name="bell-slash" class="w-4 h-4" />}>
          <Icon name="bell" class="w-4 h-4" />
        </Show>
        <Text size="sm">{props.channel.isMuted ? "Unmute" : "Mute"}</Text>
      </button>
      <div class="h-px my-1" style={{ background: "var(--jb-border-default)" }} />
      <button
        onClick={() => {
          props.onLeave();
          props.onClose();
        }}
        class="w-full flex items-center gap-2 px-3 py-1.5 rounded transition-colors"
        style={{ background: "transparent" }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        <Icon name="right-from-bracket" class="w-4 h-4" style={{ color: "var(--cortex-warning)" }} />
        <Text size="sm" style={{ color: "var(--cortex-warning)" }}>Leave Channel</Text>
      </button>
      <Show when={isCreator()}>
        <button
          onClick={() => {
            props.onDelete();
            props.onClose();
          }}
          class="w-full flex items-center gap-2 px-3 py-1.5 rounded transition-colors"
          style={{ background: "transparent" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <Icon name="trash" class="w-4 h-4" style={{ color: "var(--cortex-error)" }} />
          <Text size="sm" style={{ color: "var(--cortex-error)" }}>Delete Channel</Text>
        </button>
      </Show>
    </Card>
    </div>
  );
}

// ============================================================================
// Empty Channel State
// ============================================================================

interface EmptyChannelStateProps {
  onCreateChannel: () => void;
}

function EmptyChannelState(props: EmptyChannelStateProps) {
  return (
<EmptyState
      icon={<Icon name="hashtag" class="w-8 h-8" style={{ color: "var(--jb-border-focus)" }} />}
      title="Select a Channel"
      description="Choose a channel from the sidebar or create a new one to start collaborating."
      action={
        <Button
          variant="primary"
          onClick={props.onCreateChannel}
        >
          Create Channel
        </Button>
      }
      style={{ flex: "1" }}
    />
  );
}

// ============================================================================
// Channel Content Component
// ============================================================================

function ChannelContent() {
  const { getActiveChannel, getActiveChannelState } = useChannels();
  const [activeTab, setActiveTab] = createSignal<"chat" | "notes" | "members">("chat");

  const channel = createMemo(() => getActiveChannel());
  const channelState = createMemo(() => getActiveChannelState());

  return (
    <>
      {/* Channel Header */}
      <div
        class="flex items-center justify-between px-4 py-3"
        style={{ "border-bottom": "1px solid var(--jb-border-default)" }}
      >
        <div class="flex items-center gap-3 min-w-0">
<Show when={channel()?.visibility === "private"} fallback={<Icon name="hashtag" class="w-5 h-5" style={{ color: "var(--jb-border-focus)" }} />}>
            <Icon name="lock" class="w-5 h-5" style={{ color: "var(--jb-border-focus)" }} />
          </Show>
          <div class="min-w-0">
            <Text weight="medium" truncate style={{ display: "block" }}>
              {channel()?.name}
            </Text>
            <Show when={channel()?.topic}>
              <Text variant="muted" size="xs" truncate>
                {channel()?.topic}
              </Text>
            </Show>
          </div>
        </div>

        {/* Tab Navigation */}
        <div class="flex items-center gap-1">
<TabButton
            icon="message"
            label="Chat"
            isActive={activeTab() === "chat"}
            onClick={() => setActiveTab("chat")}
          />
          <TabButton
            icon="file-lines"
            label="Notes"
            isActive={activeTab() === "notes"}
            onClick={() => setActiveTab("notes")}
            count={channelState()?.notes.length}
          />
          <TabButton
            icon="users"
            label="Members"
            isActive={activeTab() === "members"}
            onClick={() => setActiveTab("members")}
            count={channelState()?.members.length}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div class="flex-1 overflow-hidden">
        <Show when={activeTab() === "chat"}>
          <ChatView />
        </Show>
        <Show when={activeTab() === "notes"}>
          <NotesView />
        </Show>
        <Show when={activeTab() === "members"}>
          <MembersView />
        </Show>
      </div>
    </>
  );
}

// ============================================================================
// Tab Button
// ============================================================================

interface TabButtonProps {
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  count?: number;
}

function TabButton(props: TabButtonProps) {
  return (
    <Button
      variant={props.isActive ? "secondary" : "ghost"}
      size="sm"
      onClick={props.onClick}
      icon={<Icon name={props.icon} class="w-4 h-4" />}
    >
      <span class="hidden sm:inline">{props.label}</span>
      <Show when={props.count !== undefined && props.count > 0}>
        <Badge size="sm">{props.count}</Badge>
      </Show>
    </Button>
  );
}

// ============================================================================
// Chat View
// ============================================================================

function ChatView() {
  const {
    state,
    getActiveChannelState,
    sendMessage,
    editMessage,
    setMessageInput,
    setReplyingTo,
    setEditingMessage,
    loadMoreMessages,
    addReaction,
    deleteMessage,
    getMentionSuggestions,
  } = useChannels();

  let messagesContainer: HTMLDivElement | undefined;
  let inputRef: HTMLTextAreaElement | undefined;

  const channelState = createMemo(() => getActiveChannelState());
  const messages = createMemo(() => channelState()?.messages.filter((m) => !m.isDeleted) || []);
  const typingUsers = createMemo(() => channelState()?.typingUsers || []);

  const [showMentions, setShowMentions] = createSignal(false);
  const [mentionQuery, setMentionQuery] = createSignal("");
  const mentionSuggestions = createMemo(() => getMentionSuggestions(mentionQuery()));

  // Virtualization state
  const MESSAGE_ITEM_HEIGHT = 60; // Estimated height of a message item
  const OVERSCAN = 5; // Number of extra items to render above/below viewport

  const [scrollTop, setScrollTop] = createSignal(0);
  const [containerHeight, setContainerHeight] = createSignal(400);

  const visibleRange = createMemo(() => {
    const msgs = messages();
    const start = Math.max(0, Math.floor(scrollTop() / MESSAGE_ITEM_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(containerHeight() / MESSAGE_ITEM_HEIGHT) + 2 * OVERSCAN;
    const end = Math.min(msgs.length, start + visibleCount);
    return { start, end };
  });

  const visibleMessages = createMemo(() => {
    const msgs = messages();
    const { start, end } = visibleRange();
    return msgs.slice(start, end).map((msg, i) => ({ 
      ...msg, 
      virtualIndex: start + i,
      isFirstInGroup: (start + i) === 0 ||
        msgs[start + i - 1].authorId !== msg.authorId ||
        msg.timestamp - msgs[start + i - 1].timestamp > 300000
    }));
  });

  const totalHeight = createMemo(() => messages().length * MESSAGE_ITEM_HEIGHT);

  // Setup container height observer
  onMount(() => {
    if (messagesContainer) {
      setContainerHeight(messagesContainer.clientHeight);
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerHeight(entry.contentRect.height);
        }
      });
      resizeObserver.observe(messagesContainer);
      onCleanup(() => resizeObserver.disconnect());
    }
  });

  // Auto-scroll to bottom on new messages
  createEffect(() => {
    const msgCount = messages().length;
    if (msgCount > 0 && messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      setReplyingTo(null);
      setEditingMessage(null);
    }
  };

  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    const value = target.value;
    setMessageInput(value);

    // Check for @mention
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const textAfterAt = value.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(" ")) {
        setMentionQuery(textAfterAt);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const handleMentionSelect = (member: ChannelMember) => {
    const currentInput = state.messageInput;
    const lastAtIndex = currentInput.lastIndexOf("@");
    const newInput = currentInput.slice(0, lastAtIndex + 1) + member.name + " ";
    setMessageInput(newInput);
    setShowMentions(false);
    inputRef?.focus();
  };

  const handleSend = () => {
    if (!state.messageInput.trim()) return;

    if (state.editingMessage) {
      editMessage(state.editingMessage.id, state.messageInput);
    } else {
      sendMessage(state.messageInput);
    }
  };

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
    if (target.scrollTop === 0 && state.activeChannelId) {
      loadMoreMessages(state.activeChannelId);
    }
  };

  return (
    <div class="flex flex-col h-full">
      {/* Messages List */}
      <div
        ref={messagesContainer}
        onScroll={handleScroll}
        class="flex-1 overflow-y-auto px-4 py-3"
      >
        <Show when={channelState()?.isLoadingMessages}>
          <div class="text-center py-4">
            <div
              class="inline-block w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
              style={{ "border-color": "var(--jb-border-focus)", "border-top-color": "transparent" }}
            />
          </div>
        </Show>

<Show
          when={messages().length > 0}
          fallback={
            <EmptyState
              icon={<Icon name="message" class="w-12 h-12" />}
              description="No messages yet. Start the conversation!"
              style={{ padding: "32px" }}
            />
          }
        >
          {/* Virtualized messages list */}
          <div style={{ height: `${totalHeight()}px`, position: "relative" }}>
            <For each={visibleMessages()}>
              {(message) => (
                <div
                  style={{
                    position: "absolute",
                    top: `${message.virtualIndex * MESSAGE_ITEM_HEIGHT}px`,
                    width: "100%",
                    "min-height": `${MESSAGE_ITEM_HEIGHT}px`,
                  }}
                >
                  <MessageItem
                    message={message}
                    isFirstInGroup={message.isFirstInGroup}
                    onReply={() => setReplyingTo(message)}
                    onEdit={() => setEditingMessage(message)}
                    onDelete={() => deleteMessage(message.id)}
                    onReact={(emoji) => addReaction(message.id, emoji)}
                  />
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Typing Indicator */}
        <Show when={typingUsers().length > 0}>
          <div class="flex items-center gap-2 py-2">
            <div class="flex gap-1">
              <div class="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--jb-border-focus)", "animation-delay": "0ms" }} />
              <div class="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--jb-border-focus)", "animation-delay": "150ms" }} />
              <div class="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--jb-border-focus)", "animation-delay": "300ms" }} />
            </div>
            <Text variant="muted" size="xs">
              {typingUsers().length === 1 ? "Someone is typing..." : `${typingUsers().length} people are typing...`}
            </Text>
          </div>
        </Show>
      </div>

      {/* Reply/Edit Banner */}
      <Show when={state.replyingTo || state.editingMessage}>
        <Card
          variant="outlined"
          padding="sm"
          class="mx-4 flex items-center gap-2"
        >
<Show when={state.replyingTo}>
            <Icon name="reply" class="w-4 h-4" style={{ color: "var(--jb-border-focus)" }} />
            <Text variant="muted" size="xs" truncate style={{ flex: "1" }}>
              Replying to <strong>{state.replyingTo?.authorName}</strong>
            </Text>
          </Show>
          <Show when={state.editingMessage}>
            <Icon name="pen" class="w-4 h-4" style={{ color: "var(--cortex-warning)" }} />
            <Text variant="muted" size="xs" truncate style={{ flex: "1" }}>
              Editing message
            </Text>
          </Show>
          <IconButton
            size="sm"
            onClick={() => {
              setReplyingTo(null);
              setEditingMessage(null);
            }}
          >
            <Icon name="xmark" class="w-4 h-4" />
          </IconButton>
        </Card>
      </Show>

      {/* Input Area */}
      <div class="relative px-4 py-3" style={{ "border-top": "1px solid var(--jb-border-default)" }}>
        {/* Mention Suggestions */}
        <Show when={showMentions() && mentionSuggestions().length > 0}>
          <Card
            variant="elevated"
            padding="sm"
            class="absolute bottom-full left-4 right-4 mb-2"
          >
            <For each={mentionSuggestions()}>
              {(member) => (
                <button
                  onClick={() => handleMentionSelect(member)}
                  class="w-full flex items-center gap-2 px-3 py-1.5 rounded transition-colors"
                  style={{ background: "transparent" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <Avatar name={member.name} size="xs" />
                  <Text size="sm">{member.name}</Text>
                </button>
              )}
            </For>
          </Card>
        </Show>

        <Card variant="outlined" padding="sm" class="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={state.messageInput}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (@ to mention)"
            rows={1}
            class="flex-1 bg-transparent text-sm outline-none resize-none"
            style={{
              color: "var(--jb-input-color)",
              "max-height": "120px",
              border: "none",
            }}
          />
<div class="flex items-center gap-1">
            <IconButton size="sm" tooltip="Add attachment">
              <Icon name="paperclip" class="w-4 h-4" />
            </IconButton>
            <IconButton size="sm" tooltip="Add emoji">
              <Icon name="face-smile" class="w-4 h-4" />
            </IconButton>
            <IconButton
              size="sm"
              onClick={handleSend}
              disabled={!state.messageInput.trim()}
              tooltip="Send message"
              style={{
                background: state.messageInput.trim() ? "var(--jb-border-focus)" : "transparent",
                color: state.messageInput.trim() ? "white" : "var(--jb-text-muted-color)",
              }}
            >
              <Icon name="paper-plane" class="w-4 h-4" />
            </IconButton>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Message Item Component
// ============================================================================

interface MessageItemProps {
  message: ChatMessage;
  isFirstInGroup: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
}

function MessageItem(props: MessageItemProps) {
  const { state } = useChannels();
  const [showActions, setShowActions] = createSignal(false);

  const isOwn = () => props.message.authorId === state.currentUserId;
  const timestamp = () => {
    const date = new Date(props.message.timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderContent = () => {
    // Simple @mention highlighting
    const content = props.message.content;
    const parts = content.split(/(@\w+)/g);
    return parts.map((part) => {
      if (part.startsWith("@")) {
        return (
          <span
            class="px-1 rounded"
            style={{ background: "rgba(53, 116, 240, 0.2)", color: "var(--jb-border-focus)" }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div
      class={`group relative ${props.isFirstInGroup ? "mt-4" : "mt-0.5"}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div class="flex gap-3">
        {/* Avatar - only show for first in group */}
        <Show
          when={props.isFirstInGroup}
          fallback={<div class="w-8" />}
        >
          <Avatar name={props.message.authorName} size="sm" />
        </Show>

        <div class="flex-1 min-w-0">
          {/* Author & timestamp - only show for first in group */}
          <Show when={props.isFirstInGroup}>
            <div class="flex items-center gap-2 mb-0.5">
              <Text size="sm" weight="medium" style={{ color: props.message.authorColor }}>
                {props.message.authorName}
              </Text>
              <Text variant="muted" size="xs">{timestamp()}</Text>
              <Show when={props.message.editedAt}>
                <Text variant="muted" size="xs">(edited)</Text>
              </Show>
<Show when={props.message.isPinned}>
                <Icon name="star" class="w-3 h-3" style={{ color: "var(--cortex-warning)" }} />
              </Show>
            </div>
          </Show>

          {/* Reply reference */}
<Show when={props.message.replyTo}>
            <div
              class="flex items-center gap-1 mb-1 pl-2"
              style={{ "border-left": "2px solid var(--jb-border-default)" }}
            >
              <Icon name="reply" class="w-3 h-3" style={{ color: "var(--jb-text-muted-color)" }} />
              <Text variant="muted" size="xs">Replying to a message</Text>
            </div>
          </Show>

          {/* Message content */}
          <Text size="sm" style={{ "white-space": "pre-wrap", "word-break": "break-word" }}>
            {renderContent()}
          </Text>

          {/* Reactions */}
          <Show when={Object.keys(props.message.reactions).length > 0}>
            <div class="flex flex-wrap gap-1 mt-1">
              <For each={Object.entries(props.message.reactions)}>
                {([emoji, users]) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => props.onReact(emoji)}
                    style={{
                      background: users.includes(state.currentUserId || "") ? "rgba(53, 116, 240, 0.2)" : "var(--jb-surface-active)",
                      border: users.includes(state.currentUserId || "") ? "1px solid rgba(53, 116, 240, 0.3)" : "1px solid transparent",
                      padding: "2px 6px",
                    }}
                  >
                    <span>{emoji}</span>
                    <Text variant="muted" size="xs">{users.length}</Text>
                  </Button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>

      {/* Action buttons */}
      <Show when={showActions()}>
        <Card
          variant="elevated"
          padding="none"
          class="absolute -top-3 right-0 flex items-center gap-0.5 px-1 py-0.5"
        >
<IconButton size="sm" onClick={() => props.onReact("👍")} tooltip="React">
            <Icon name="face-smile" class="w-3.5 h-3.5" />
          </IconButton>
          <IconButton size="sm" onClick={props.onReply} tooltip="Reply">
            <Icon name="reply" class="w-3.5 h-3.5" />
          </IconButton>
          <Show when={isOwn()}>
            <IconButton size="sm" onClick={props.onEdit} tooltip="Edit">
              <Icon name="pen" class="w-3.5 h-3.5" />
            </IconButton>
            <IconButton size="sm" onClick={props.onDelete} tooltip="Delete">
              <Icon name="trash" class="w-3.5 h-3.5" style={{ color: "var(--cortex-error)" }} />
            </IconButton>
          </Show>
        </Card>
      </Show>
    </div>
  );
}

// ============================================================================
// Notes View
// ============================================================================

function NotesView() {
  const { state, getActiveChannelState, createNote, updateNote, deleteNote } = useChannels();
  const [showCreateNote, setShowCreateNote] = createSignal(false);
  const [activeNoteId, setActiveNoteId] = createSignal<string | null>(null);
  const [noteTitle, setNoteTitle] = createSignal("");
  const [noteContent, setNoteContent] = createSignal("");

  const channelState = createMemo(() => getActiveChannelState());
  const notes = createMemo(() => channelState()?.notes || []);
  const activeNote = createMemo(() => notes().find((n) => n.id === activeNoteId()));

  const handleCreateNote = async () => {
    if (!state.activeChannelId || !noteTitle().trim()) return;

    const noteId = await createNote(state.activeChannelId, noteTitle(), noteContent());
    setActiveNoteId(noteId);
    setShowCreateNote(false);
    setNoteTitle("");
    setNoteContent("");
  };

  const handleSaveNote = async () => {
    if (!activeNoteId()) return;
    await updateNote(activeNoteId()!, { title: noteTitle(), content: noteContent() });
  };

  createEffect(() => {
    if (activeNote()) {
      setNoteTitle(activeNote()!.title);
      setNoteContent(activeNote()!.content);
    }
  });

  return (
    <div class="flex h-full">
      {/* Notes List */}
      <div
        class="w-56 flex flex-col"
        style={{ "border-right": "1px solid var(--jb-border-default)" }}
      >
<div class="flex items-center justify-between px-3 py-2" style={{ "border-bottom": "1px solid var(--jb-border-default)" }}>
          <Text variant="header" size="xs">Notes</Text>
          <IconButton
            size="sm"
            onClick={() => {
              setShowCreateNote(true);
              setActiveNoteId(null);
              setNoteTitle("");
              setNoteContent("");
            }}
          >
            <Icon name="plus" class="w-4 h-4" />
          </IconButton>
        </div>

        <div class="flex-1 overflow-y-auto">
<Show
            when={notes().length > 0 || showCreateNote()}
            fallback={
              <EmptyState
                icon={<Icon name="file-lines" class="w-8 h-8" />}
                description="No notes yet"
                style={{ padding: "16px" }}
              />
            }
          >
            <For each={notes()}>
              {(note) => (
                <button
                  onClick={() => {
                    setActiveNoteId(note.id);
                    setShowCreateNote(false);
                  }}
                  class="w-full text-left px-3 py-2 transition-colors"
                  style={{ 
                    background: activeNoteId() === note.id ? "var(--jb-surface-selected)" : "transparent",
                    "border-left": activeNoteId() === note.id ? "2px solid var(--jb-border-focus)" : "2px solid transparent" 
                  }}
                  onMouseEnter={(e) => activeNoteId() !== note.id && (e.currentTarget.style.background = "var(--jb-surface-hover)")}
                  onMouseLeave={(e) => activeNoteId() !== note.id && (e.currentTarget.style.background = "transparent")}
                >
                  <Text size="sm" weight="medium" truncate style={{ display: "block" }}>
                    {note.title || "Untitled"}
                  </Text>
                  <Text variant="muted" size="xs" truncate>
                    {note.authorName} · {new Date(note.updatedAt).toLocaleDateString()}
                  </Text>
                </button>
              )}
            </For>
          </Show>
        </div>
      </div>

      {/* Note Editor */}
      <div class="flex-1 flex flex-col">
<Show
          when={activeNote() || showCreateNote()}
          fallback={
            <EmptyState
              icon={<Icon name="file-lines" class="w-12 h-12" />}
              description="Select or create a note"
              style={{ flex: "1" }}
            />
          }
        >
          <div class="flex items-center gap-2 px-4 py-2" style={{ "border-bottom": "1px solid var(--jb-border-default)" }}>
            <input
              type="text"
              value={noteTitle()}
              onInput={(e) => setNoteTitle(e.currentTarget.value)}
              placeholder="Note title..."
              class="flex-1 bg-transparent text-base font-medium outline-none"
              style={{ color: "var(--jb-text-body-color)", border: "none" }}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={showCreateNote() ? handleCreateNote : handleSaveNote}
            >
              {showCreateNote() ? "Create" : "Save"}
            </Button>
<Show when={activeNote()}>
              <IconButton
                size="sm"
                onClick={() => {
                  deleteNote(activeNoteId()!);
                  setActiveNoteId(null);
                }}
              >
                <Icon name="trash" class="w-4 h-4" style={{ color: "var(--cortex-error)" }} />
              </IconButton>
            </Show>
          </div>

          <textarea
            value={noteContent()}
            onInput={(e) => setNoteContent(e.currentTarget.value)}
            placeholder="Start writing..."
            class="flex-1 p-4 bg-transparent text-sm outline-none resize-none"
            style={{ color: "var(--jb-text-body-color)", border: "none" }}
          />

          <Show when={activeNote()}>
            <div
              class="px-4 py-2 flex items-center gap-4"
              style={{ "border-top": "1px solid var(--jb-border-default)" }}
            >
              <Text variant="muted" size="xs">Last updated: {new Date(activeNote()!.updatedAt).toLocaleString()}</Text>
              <Text variant="muted" size="xs">Version: {activeNote()!.version}</Text>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// Members View
// ============================================================================

function MembersView() {
  const { state, getActiveChannelState, inviteMember, removeMember, updateMemberRole } = useChannels();
  const [showInviteDialog, setShowInviteDialog] = createSignal(false);
  const [inviteUserId, setInviteUserId] = createSignal("");

  const channelState = createMemo(() => getActiveChannelState());
  const members = createMemo(() => {
    const m = channelState()?.members || [];
    // Sort: admins first, then by name
    return [...m].sort((a, b) => {
      if (a.role === "admin" && b.role !== "admin") return -1;
      if (b.role === "admin" && a.role !== "admin") return 1;
      return a.name.localeCompare(b.name);
    });
  });

  const isCurrentUserAdmin = createMemo(() => {
    const currentMember = members().find((m) => m.id === state.currentUserId);
    return currentMember?.role === "admin";
  });

  const handleInvite = async () => {
    if (!inviteUserId().trim()) return;
    await inviteMember(state.activeChannelId!, inviteUserId());
    setInviteUserId("");
    setShowInviteDialog(false);
  };

  const getStatusVariant = (status: string): "online" | "away" | "busy" | "offline" => {
    switch (status) {
      case "online": return "online";
      case "away": return "away";
      case "busy": return "busy";
      default: return "offline";
    }
  };

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div
        class="flex items-center justify-between px-4 py-2"
        style={{ "border-bottom": "1px solid var(--jb-border-default)" }}
      >
        <Text size="sm" weight="medium">
          {members().length} member{members().length !== 1 ? "s" : ""}
        </Text>
<Show when={isCurrentUserAdmin()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInviteDialog(true)}
            icon={<Icon name="user-plus" class="w-3.5 h-3.5" />}
            style={{ color: "var(--jb-border-focus)" }}
          >
            Invite
          </Button>
        </Show>
      </div>

      {/* Members List */}
      <div class="flex-1 overflow-y-auto">
        <For each={members()}>
          {(member) => (
            <div
              class="flex items-center gap-3 px-4 py-2 transition-colors"
              style={{ background: "transparent" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <Avatar 
                name={member.name} 
                size="sm" 
                status={getStatusVariant(member.status)}
              />

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <Text size="sm" weight="medium" truncate>{member.name}</Text>
                  <Show when={member.id === state.currentUserId}>
                    <Badge size="sm">You</Badge>
                  </Show>
                  <Show when={member.role === "admin"}>
                    <Badge variant="warning" size="sm">Admin</Badge>
                  </Show>
                </div>
                <Text variant="muted" size="xs" style={{ "text-transform": "capitalize" }}>
                  {member.status}
                </Text>
              </div>

              <Show when={isCurrentUserAdmin() && member.id !== state.currentUserId}>
                <div class="flex items-center gap-1">
                  <select
                    value={member.role}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      if (value === "admin" || value === "member" || value === "guest") {
                        updateMemberRole(state.activeChannelId!, member.id, value);
                      }
                    }}
                    class="text-xs px-2 py-1 rounded outline-none"
                    style={{ 
                      background: "var(--jb-surface-active)", 
                      color: "var(--jb-text-body-color)", 
                      border: "1px solid var(--jb-border-default)" 
                    }}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="guest">Guest</option>
                  </select>
<IconButton
                    size="sm"
                    onClick={() => removeMember(state.activeChannelId!, member.id)}
                    tooltip="Remove member"
                  >
                    <Icon name="xmark" class="w-4 h-4" style={{ color: "var(--cortex-error)" }} />
                  </IconButton>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>

      {/* Invite Dialog */}
      <Show when={showInviteDialog()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0, 0, 0, 0.5)" }}>
          <Card variant="elevated" padding="lg" class="w-96">
<div class="flex items-center justify-between mb-4">
              <Text weight="medium">Invite Member</Text>
              <IconButton size="sm" onClick={() => setShowInviteDialog(false)}>
                <Icon name="xmark" class="w-4 h-4" />
              </IconButton>
            </div>
            <div class="space-y-4">
              <Input
                value={inviteUserId()}
                onInput={(e) => setInviteUserId(e.currentTarget.value)}
                placeholder="User ID or email"
              />
              <div class="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowInviteDialog(false)}
                  style={{ flex: "1" }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleInvite}
                  style={{ flex: "1" }}
                >
                  Send Invite
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Create Channel Dialog
// ============================================================================

interface CreateChannelDialogProps {
  onClose: () => void;
}

function CreateChannelDialog(props: CreateChannelDialogProps) {
  const { createChannel } = useChannels();
  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [visibility, setVisibility] = createSignal<ChannelVisibility>("public");
  const [isCreating, setIsCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleCreate = async () => {
    if (!name().trim()) {
      setError("Channel name is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await createChannel(name(), description(), visibility());
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0, 0, 0, 0.5)" }}>
      <Card variant="elevated" padding="lg" class="w-[420px]">
<div class="flex items-center justify-between mb-4">
          <Text weight="medium">Create Channel</Text>
          <IconButton size="sm" onClick={props.onClose}>
            <Icon name="xmark" class="w-4 h-4" />
          </IconButton>
        </div>

        <div class="space-y-4">
          {/* Channel Name */}
<Input
            label="Channel Name"
            icon={<Icon name="hashtag" class="w-4 h-4" />}
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="e.g., general, design, engineering"
          />

          {/* Description */}
          <Textarea
            label="Description (optional)"
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            placeholder="What's this channel about?"
            rows={2}
          />

          {/* Visibility */}
          <div>
            <Text variant="muted" size="sm" weight="medium" style={{ display: "block", "margin-bottom": "8px" }}>
              Visibility
            </Text>
            <div class="flex gap-2">
<Card
                variant={visibility() === "public" ? "elevated" : "outlined"}
                padding="sm"
                onClick={() => setVisibility("public")}
                hoverable
                class="flex-1 cursor-pointer"
                style={visibility() === "public" ? { border: "2px solid var(--jb-border-focus)" } : {}}
              >
                <div class="flex items-center gap-2">
                  <Icon name="hashtag" class="w-4 h-4" style={{ color: visibility() === "public" ? "var(--jb-border-focus)" : "var(--jb-text-muted-color)" }} />
                  <div>
                    <Text size="sm">Public</Text>
                    <Text variant="muted" size="xs">Anyone can join</Text>
                  </div>
                </div>
              </Card>
              <Card
                variant={visibility() === "private" ? "elevated" : "outlined"}
                padding="sm"
                onClick={() => setVisibility("private")}
                hoverable
                class="flex-1 cursor-pointer"
                style={visibility() === "private" ? { border: "2px solid var(--jb-border-focus)" } : {}}
              >
                <div class="flex items-center gap-2">
                  <Icon name="lock" class="w-4 h-4" style={{ color: visibility() === "private" ? "var(--jb-border-focus)" : "var(--jb-text-muted-color)" }} />
                  <div>
                    <Text size="sm">Private</Text>
                    <Text variant="muted" size="xs">Invite only</Text>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Error */}
          <Show when={error()}>
            <Card 
              variant="outlined" 
              padding="sm"
              style={{ background: "rgba(247, 84, 100, 0.1)", "border-color": "var(--cortex-error)" }}
            >
              <Text color="error" size="sm">{error()}</Text>
            </Card>
          </Show>

          {/* Actions */}
          <div class="flex gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={props.onClose}
              style={{ flex: "1" }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={isCreating()}
              loading={isCreating()}
              style={{ flex: "1" }}
            >
              {isCreating() ? "Creating..." : "Create Channel"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Join Channel Dialog
// ============================================================================

interface JoinChannelDialogProps {
  onClose: () => void;
}

function JoinChannelDialog(props: JoinChannelDialogProps) {
  const { joinChannel } = useChannels();
  const [channelId, setChannelId] = createSignal("");
  const [isJoining, setIsJoining] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleJoin = async () => {
    if (!channelId().trim()) {
      setError("Channel ID or link is required");
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      // Extract channel ID from link if necessary
      const id = channelId().includes("/")
        ? channelId().split("/").pop() || channelId()
        : channelId();

      await joinChannel(id);
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join channel");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0, 0, 0, 0.5)" }}>
      <Card variant="elevated" padding="lg" class="w-[400px]">
<div class="flex items-center justify-between mb-4">
          <Text weight="medium">Join Channel</Text>
          <IconButton size="sm" onClick={props.onClose}>
            <Icon name="xmark" class="w-4 h-4" />
          </IconButton>
        </div>

        <div class="space-y-4">
          <Input
            label="Channel ID or Invite Link"
            value={channelId()}
            onInput={(e) => setChannelId(e.currentTarget.value)}
            placeholder="Enter channel ID or paste invite link"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoin();
            }}
          />

          <Show when={error()}>
            <Card 
              variant="outlined" 
              padding="sm"
              style={{ background: "rgba(247, 84, 100, 0.1)", "border-color": "var(--cortex-error)" }}
            >
              <Text color="error" size="sm">{error()}</Text>
            </Card>
          </Show>

          <div class="flex gap-2">
            <Button
              variant="ghost"
              onClick={props.onClose}
              style={{ flex: "1" }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleJoin}
              disabled={isJoining()}
              loading={isJoining()}
              style={{ flex: "1", background: "var(--cortex-success)" }}
            >
              {isJoining() ? "Joining..." : "Join Channel"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Compact Channels Status for header/status bar
// ============================================================================

interface ChannelsStatusProps {
  onClick?: () => void;
}

export function ChannelsStatus(props: ChannelsStatusProps) {
  const { state } = useChannels();

  const totalUnread = () =>
    state.channels.reduce((sum, ch) => sum + (ch.isMuted ? 0 : ch.unreadCount), 0);

  return (
    <button
      onClick={props.onClick}
      class="flex items-center gap-2 px-2 py-1 rounded-md transition-colors"
      style={{ background: "transparent" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      title={state.channels.length > 0 ? `${state.channels.length} channels` : "Open channels"}
    >
      <Icon name="hashtag" class="w-4 h-4" style={{ color: totalUnread() > 0 ? "var(--jb-border-focus)" : "var(--jb-text-muted-color)" }} />
      <Show when={totalUnread() > 0}>
        <Badge variant="accent" size="sm" style={{ "border-radius": "var(--cortex-radius-full)" }}>
          {totalUnread() > 99 ? "99+" : totalUnread()}
        </Badge>
      </Show>
    </button>
  );
}

