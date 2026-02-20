import { Show, createSignal, For, createEffect } from "solid-js";
import { Icon } from "../ui/Icon";
import { useCollab, type CollabPermission } from "@/context/CollabContext";
import { useCollabSync } from "@/context/CollabSyncContext";
import { ParticipantsList } from "./ParticipantsList";
import { Card, Button, IconButton, Input, Badge, Text, EmptyState } from "@/components/ui";

interface CollabPanelProps {
  class?: string;
  onClose?: () => void;
}

export function CollabPanel(props: CollabPanelProps) {
  const { 
    state, 
    connect, 
    createRoom, 
    joinRoom, 
    leaveRoom, 
    generateShareLink,
    isHost,
    sendChatMessage,
    markChatAsRead,
    startAudioCall,
    stopAudioCall,
    toggleAudio,
    startVideoCall,
    stopVideoCall,
    toggleVideo,
    createInviteLink,
  } = useCollab();

  const collabSync = useCollabSync();

  const [showJoinDialog, setShowJoinDialog] = createSignal(false);
  const [userName, setUserName] = createSignal("");
  const [roomIdInput, setRoomIdInput] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  const [isJoining, setIsJoining] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [sectionsExpanded, setSectionsExpanded] = createSignal({
    participants: true,
    sharedFiles: true,
    chat: true,
    terminals: false,
  });
  const [chatInput, setChatInput] = createSignal("");
  const [showPermissionSelect, setShowPermissionSelect] = createSignal(false);
  let chatContainerRef: HTMLDivElement | undefined;

  const isInSession = () => state.currentRoom !== null;

  const connectionStatusText = (): string => {
    switch (state.connectionState) {
      case "connected": return "Connected";
      case "connecting": return "Connecting...";
      case "reconnecting": return "Reconnecting...";
      case "error": return "Connection Error";
      default: return "Disconnected";
    }
  };

  const connectionStatusVariant = (): "success" | "warning" | "error" | "default" => {
    switch (state.connectionState) {
      case "connected": return "success";
      case "connecting":
      case "reconnecting": return "warning";
      case "error": return "error";
      default: return "default";
    }
  };

  const handleCreateSession = async () => {
    if (!userName().trim()) {
      setError("Please enter your name");
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const sessionInfo = await collabSync.createSession(
        `${userName().trim()}'s Room`,
        userName().trim(),
      );
      const serverUrl = `ws://127.0.0.1:${sessionInfo.serverPort}/collab`;
      await connect(serverUrl);
      await createRoom(userName().trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinSession = async () => {
    if (!userName().trim()) {
      setError("Please enter your name");
      return;
    }
    if (!roomIdInput().trim()) {
      setError("Please enter a session code");
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const sessionInfo = await collabSync.joinSession(
        roomIdInput().trim(),
        userName().trim(),
      );
      const serverUrl = `ws://127.0.0.1:${sessionInfo.serverPort}/collab`;
      await connect(serverUrl);
      await joinRoom(roomIdInput().trim(), userName().trim());
      setShowJoinDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join session");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCopyLink = async () => {
    const link = generateShareLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = link;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLeaveSession = () => {
    collabSync.leaveSession();
    leaveRoom();
  };

  const toggleSection = (section: "participants" | "sharedFiles" | "chat" | "terminals") => {
    setSectionsExpanded((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleSendChat = () => {
    const msg = chatInput().trim();
    if (!msg) return;
    sendChatMessage(msg);
    setChatInput("");
  };

  const handleCopyInviteLink = async (permission: CollabPermission) => {
    try {
      const link = await createInviteLink(permission);
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setShowPermissionSelect(false);
    } catch {
      setError("Failed to create invite link");
    }
  };

  // Scroll chat to bottom when new messages arrive
  createEffect(() => {
    const messageCount = state.chatMessages.length;
    if (messageCount > 0 && chatContainerRef) {
      chatContainerRef.scrollTop = chatContainerRef.scrollHeight;
    }
  });

  // Mark chat as read when chat section is expanded
  createEffect(() => {
    if (sectionsExpanded().chat && state.unreadChatCount > 0) {
      markChatAsRead();
    }
  });

  return (
    <Card 
      variant="default"
      padding="none"
      class={`flex flex-col h-full ${props.class || ""}`}
      style={{ 
        "border-right": "1px solid var(--jb-border-default)",
      }}
    >
      {/* Header */}
      <div 
        class="flex items-center justify-between px-4 py-3"
        style={{ "border-bottom": "1px solid var(--jb-border-default)" }}
      >
<div class="flex items-center gap-2">
          <Icon name="users" class="w-5 h-5" style={{ color: "var(--jb-border-focus)" }} />
          <Text weight="medium">Collaboration</Text>
        </div>
        
        <div class="flex items-center gap-2">
          <Show when={state.connectionState === "connected"}>
            <Badge variant="success">Synced</Badge>
          </Show>
          <Show when={state.connectionState === "connecting" || state.connectionState === "reconnecting"}>
            <Badge variant="warning">Syncing</Badge>
          </Show>
          {/* Connection status indicator */}
          <Badge variant={connectionStatusVariant()}>
            {connectionStatusText()}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto">
        <Show when={!isInSession()}>
          {/* Not in a session - show create/join options */}
          <div class="p-4 space-y-4">
            {/* Create Session */}
            <Card variant="elevated" padding="md">
<div class="flex items-center gap-2 mb-4">
                <Icon name="share-nodes" class="w-5 h-5" style={{ color: "var(--jb-border-focus)" }} />
                <Text weight="medium">Start Session</Text>
              </div>
              
              <Text variant="muted" style={{ "margin-bottom": "16px", display: "block" }}>
                Create a new collaboration session and invite others to join.
              </Text>

              <div class="space-y-3">
                <Input
                  value={userName()}
                  onInput={(e) => setUserName(e.currentTarget.value)}
                  placeholder="Your display name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateSession();
                  }}
                />

                <Show when={error() && !showJoinDialog()}>
                  <Card 
                    variant="outlined" 
                    padding="sm"
                    style={{ background: "rgba(247, 84, 100, 0.1)", "border-color": "var(--cortex-error)" }}
                  >
                    <Text color="error" size="sm">{error()}</Text>
                  </Card>
                </Show>

<Button
                  variant="primary"
                  onClick={handleCreateSession}
                  disabled={isJoining()}
                  loading={isJoining()}
                  icon={<Icon name="share-nodes" class="w-4 h-4" />}
                  style={{ width: "100%" }}
                >
                  {isJoining() ? "Creating..." : "Create Session"}
                </Button>
              </div>
            </Card>

            {/* Divider */}
            <div class="flex items-center gap-3">
              <div class="flex-1 h-px" style={{ background: "var(--jb-border-default)" }} />
              <Text variant="muted" size="xs">or</Text>
              <div class="flex-1 h-px" style={{ background: "var(--jb-border-default)" }} />
            </div>

            {/* Join Session */}
<Show when={!showJoinDialog()}>
              <Button
                variant="secondary"
                onClick={() => setShowJoinDialog(true)}
                icon={<Icon name="user-plus" class="w-4 h-4" />}
                style={{ width: "100%" }}
              >
                Join Existing Session
              </Button>
            </Show>

            <Show when={showJoinDialog()}>
              <Card variant="elevated" padding="md">
<div class="flex items-center gap-2 mb-4">
                  <Icon name="user-plus" class="w-5 h-5" style={{ color: "var(--cortex-success)" }} />
                  <Text weight="medium">Join Session</Text>
                </div>

                <div class="space-y-3">
                  <Input
                    value={userName()}
                    onInput={(e) => setUserName(e.currentTarget.value)}
                    placeholder="Your display name"
                  />
                  
                  <Input
                    value={roomIdInput()}
                    onInput={(e) => setRoomIdInput(e.currentTarget.value)}
                    placeholder="Session code or invite link"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJoinSession();
                    }}
                  />

                  <Show when={error() && showJoinDialog()}>
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
                      onClick={() => {
                        setShowJoinDialog(false);
                        setError(null);
                      }}
                      style={{ flex: "1" }}
                    >
                      Cancel
                    </Button>
<Button
                      variant="primary"
                      onClick={handleJoinSession}
                      disabled={isJoining()}
                      loading={isJoining()}
                      icon={<Icon name="user-plus" class="w-4 h-4" />}
                      style={{ flex: "1", background: "var(--cortex-success)" }}
                    >
                      {isJoining() ? "Joining..." : "Join"}
                    </Button>
                  </div>
                </div>
              </Card>
            </Show>
          </div>
        </Show>

        <Show when={isInSession()}>
          {/* In a session - show participants and options */}
          <div class="flex flex-col">
            {/* Session info banner */}
            <div 
              class="px-4 py-3 flex items-center gap-3"
              style={{ 
                background: "rgba(89, 168, 105, 0.1)", 
                "border-bottom": "1px solid rgba(89, 168, 105, 0.3)" 
              }}
            >
<div 
                class="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(89, 168, 105, 0.2)" }}
              >
                <Icon name="users" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
              </div>
              <div class="flex-1 min-w-0">
                <Text weight="medium" truncate style={{ display: "block" }}>
                  {state.currentRoom?.name}
                </Text>
                <Text variant="muted" size="xs">
                  {state.participants.length} participant{state.participants.length !== 1 ? "s" : ""}
                  <Show when={state.sessionToken}>
                    {" · Connected"}</Show>
                </Text>
              </div>
              <Show when={isHost()}>
                <Badge variant="warning">Host</Badge>
              </Show>
            </div>

            {/* Share link */}
            <div class="px-4 py-3" style={{ "border-bottom": "1px solid var(--jb-border-default)" }}>
              <div class="flex gap-2">
<Card 
                  variant="outlined" 
                  padding="sm"
                  class="flex-1 flex items-center gap-2 truncate"
                  style={{ "font-size": "12px" }}
                >
                  <Icon name="link" class="w-3 h-3 flex-shrink-0" style={{ color: "var(--jb-text-muted-color)" }} />
                  <Text variant="muted" size="xs" truncate>{generateShareLink()}</Text>
                </Card>
                <IconButton
                  onClick={handleCopyLink}
                  tooltip="Copy invite link"
                  style={{
                    background: copied() ? "var(--cortex-success)" : "var(--jb-surface-active)",
                    color: copied() ? "white" : "var(--jb-text-body-color)",
                  }}
                >
                  <Show when={copied()} fallback={<Icon name="copy" class="w-3.5 h-3.5" />}>
                    <Icon name="check" class="w-3.5 h-3.5" />
                  </Show>
                </IconButton>
              </div>
            </div>

            {/* Participants section */}
            <div>
<button
                onClick={() => toggleSection("participants")}
                class="w-full flex items-center gap-2 px-4 py-2 transition-colors"
                style={{ background: "transparent" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <Show 
                  when={sectionsExpanded().participants} 
                  fallback={<Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />}
                >
                  <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />
                </Show>
                <Text size="sm" weight="medium">Participants</Text>
                <Badge style={{ "margin-left": "auto" }}>{state.participants.length}</Badge>
              </button>
              
              <Show when={sectionsExpanded().participants}>
                <div class="pb-2">
                  <ParticipantsList />
                </div>
              </Show>
            </div>

            {/* Shared files section */}
            <div style={{ "border-top": "1px solid var(--jb-border-default)" }}>
<button
                onClick={() => toggleSection("sharedFiles")}
                class="w-full flex items-center gap-2 px-4 py-2 transition-colors"
                style={{ background: "transparent" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <Show 
                  when={sectionsExpanded().sharedFiles} 
                  fallback={<Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />}
                >
                  <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />
                </Show>
                <Text size="sm" weight="medium">Shared Files</Text>
                <Badge style={{ "margin-left": "auto" }}>{state.currentRoom?.sharedFiles.length || 0}</Badge>
              </button>
              
              <Show when={sectionsExpanded().sharedFiles}>
                <div class="px-4 py-2">
                  <Show 
                    when={state.currentRoom?.sharedFiles.length}
                    fallback={
                      <EmptyState 
                        description="No files shared yet"
                        style={{ padding: "16px 0" }}
                      />
                    }
                  >
                    <For each={state.currentRoom?.sharedFiles}>
                      {(file) => (
                        <div class="px-2 py-1.5 rounded">
                          <Text size="sm" truncate>{file}</Text>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              </Show>
            </div>

            {/* Shared terminals section */}
            <div style={{ "border-top": "1px solid var(--jb-border-default)" }}>
<button
                onClick={() => toggleSection("terminals")}
                class="w-full flex items-center gap-2 px-4 py-2 transition-colors"
                style={{ background: "transparent" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <Show 
                  when={sectionsExpanded().terminals} 
                  fallback={<Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />}
                >
                  <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />
                </Show>
                <Icon name="terminal" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />
                <Text size="sm" weight="medium">Shared Terminals</Text>
                <Badge style={{ "margin-left": "auto" }}>{state.sharedTerminals.length}</Badge>
              </button>
              
              <Show when={sectionsExpanded().terminals}>
                <div class="px-4 py-2">
                  <Show 
                    when={state.sharedTerminals.length > 0}
                    fallback={
                      <EmptyState 
                        description="No terminals shared yet"
                        style={{ padding: "16px 0" }}
                      />
                    }
                  >
<For each={state.sharedTerminals}>
                      {(terminal) => (
                        <div 
                          class="flex items-center gap-2 px-2 py-1.5 rounded"
                          style={{ cursor: "pointer" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          <Icon name="terminal" class="w-3.5 h-3.5" style={{ color: "var(--jb-text-muted-color)" }} />
                          <Text size="sm" truncate style={{ flex: "1" }}>{terminal.name}</Text>
                          <Show when={terminal.isReadOnly}>
                            <span title="Read-only">
                              <Icon name="eye" class="w-3 h-3" style={{ color: "var(--jb-text-muted-color)" }} />
                            </span>
                          </Show>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              </Show>
            </div>

            {/* Chat section */}
            <div style={{ "border-top": "1px solid var(--jb-border-default)" }}>
<button
                onClick={() => toggleSection("chat")}
                class="w-full flex items-center gap-2 px-4 py-2 transition-colors"
                style={{ background: "transparent" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <Show 
                  when={sectionsExpanded().chat} 
                  fallback={<Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />}
                >
                  <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />
                </Show>
                <Icon name="message" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />
                <Text size="sm" weight="medium">Chat</Text>
                <Show when={state.unreadChatCount > 0}>
                  <Badge variant="accent" style={{ "margin-left": "auto", "border-radius": "var(--cortex-radius-full)" }}>
                    {state.unreadChatCount}
                  </Badge>
                </Show>
              </button>
              
              <Show when={sectionsExpanded().chat}>
                <div class="flex flex-col" style={{ height: "200px" }}>
                  {/* Chat messages */}
                  <div 
                    ref={chatContainerRef}
                    class="flex-1 overflow-y-auto px-4 py-2 space-y-2"
                  >
                    <Show 
                      when={state.chatMessages.length > 0}
                      fallback={
                        <EmptyState 
                          description="No messages yet"
                          style={{ padding: "16px 0" }}
                        />
                      }
                    >
                      <For each={state.chatMessages}>
                        {(message) => (
                          <div 
                            class={`${message.isSystem ? "text-center py-1" : ""}`}
                            style={{ "font-size": "12px" }}
                          >
                            <Show when={!message.isSystem}>
                              <Text 
                                weight="medium" 
                                size="xs"
                                style={{ color: message.userColor }}
                              >
                                {message.userName}:{" "}
                              </Text>
                            </Show>
                            <Text 
                              size="xs"
                              variant={message.isSystem ? "muted" : "body"}
                            >
                              {message.content}
                            </Text>
                          </div>
                        )}
                      </For>
                    </Show>
                  </div>
                  
                  {/* Chat input */}
                  <div class="px-4 py-2" style={{ "border-top": "1px solid var(--jb-border-default)" }}>
                    <Card 
                      variant="outlined" 
                      padding="sm"
                      class="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={chatInput()}
                        onInput={(e) => setChatInput(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendChat();
                          }
                        }}
                        placeholder="Type a message..."
                        class="flex-1 bg-transparent outline-none"
                        style={{ 
                          color: "var(--jb-input-color)", 
                          "font-size": "12px",
                          border: "none"
                        }}
                      />
<IconButton
                        onClick={handleSendChat}
                        disabled={!chatInput().trim()}
                        size="sm"
                        style={{
                          color: chatInput().trim() ? "var(--jb-border-focus)" : "var(--jb-text-muted-color)",
                        }}
                      >
                        <Icon name="paper-plane" class="w-3.5 h-3.5" />
                      </IconButton>
                    </Card>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>

      {/* Footer actions */}
      <Show when={isInSession()}>
        <div 
          class="px-4 py-3 space-y-2"
          style={{ "border-top": "1px solid var(--jb-border-default)" }}
        >
          {/* Audio/Video call controls */}
          <div class="flex items-center justify-center gap-2">
<Button
              variant={state.isAudioCallActive ? "primary" : "secondary"}
              size="sm"
              onClick={state.isAudioCallActive ? stopAudioCall : startAudioCall}
              icon={state.isAudioCallActive ? <Icon name="phone-slash" class="w-3.5 h-3.5" /> : <Icon name="phone" class="w-3.5 h-3.5" />}
              style={state.isAudioCallActive ? { background: "var(--cortex-success)" } : {}}
            >
              {state.isAudioCallActive ? "End" : "Audio"}
            </Button>
            
<Show when={state.isAudioCallActive}>
              <IconButton
                onClick={toggleAudio}
                style={{
                  background: state.currentUser?.isAudioEnabled ? "var(--jb-surface-active)" : "var(--cortex-error)",
                  color: state.currentUser?.isAudioEnabled ? "var(--jb-text-body-color)" : "white",
                }}
                tooltip={state.currentUser?.isAudioEnabled ? "Mute" : "Unmute"}
              >
                <Show when={state.currentUser?.isAudioEnabled} fallback={<Icon name="microphone-slash" class="w-3.5 h-3.5" />}>
                  <Icon name="microphone" class="w-3.5 h-3.5" />
                </Show>
              </IconButton>
            </Show>
            
<Button
              variant={state.isVideoCallActive ? "primary" : "secondary"}
              size="sm"
              onClick={state.isVideoCallActive ? stopVideoCall : startVideoCall}
              icon={state.isVideoCallActive ? <Icon name="video-slash" class="w-3.5 h-3.5" /> : <Icon name="video" class="w-3.5 h-3.5" />}
              style={state.isVideoCallActive ? { background: "var(--cortex-success)" } : {}}
            >
              {state.isVideoCallActive ? "End" : "Video"}
            </Button>
            
<Show when={state.isVideoCallActive}>
              <IconButton
                onClick={toggleVideo}
                style={{
                  background: state.currentUser?.isVideoEnabled ? "var(--jb-surface-active)" : "var(--cortex-error)",
                  color: state.currentUser?.isVideoEnabled ? "var(--jb-text-body-color)" : "white",
                }}
                tooltip={state.currentUser?.isVideoEnabled ? "Turn off camera" : "Turn on camera"}
              >
                <Show when={state.currentUser?.isVideoEnabled} fallback={<Icon name="video-slash" class="w-3.5 h-3.5" />}>
                  <Icon name="video" class="w-3.5 h-3.5" />
                </Show>
              </IconButton>
            </Show>
          </div>
          
          {/* Permission-aware invite link */}
          <Show when={isHost()}>
            <div class="relative">
<Button
                variant="secondary"
                onClick={() => setShowPermissionSelect(!showPermissionSelect())}
                icon={<Icon name="user-plus" class="w-4 h-4" />}
                iconRight={<Icon name="chevron-down" class="w-3 h-3" />}
                style={{ width: "100%" }}
              >
                Create Invite Link
              </Button>
              
              <Show when={showPermissionSelect()}>
                <Card 
                  variant="elevated"
                  padding="sm"
                  class="absolute bottom-full left-0 right-0 mb-1 z-10"
                >
<button
                    onClick={() => handleCopyInviteLink("editor")}
                    class="w-full flex items-center gap-2 px-3 py-2 rounded"
                    style={{ background: "transparent" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <Icon name="pen" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
                    <Text size="sm">Can Edit</Text>
                  </button>
                  <button
                    onClick={() => handleCopyInviteLink("viewer")}
                    class="w-full flex items-center gap-2 px-3 py-2 rounded"
                    style={{ background: "transparent" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <Icon name="eye" class="w-4 h-4" style={{ color: "var(--jb-border-focus)" }} />
                    <Text size="sm">View Only</Text>
                  </button>
                </Card>
              </Show>
            </div>
          </Show>
          
<Button
            variant="danger"
            onClick={handleLeaveSession}
            icon={<Icon name="right-from-bracket" class="w-4 h-4" />}
            style={{ width: "100%" }}
          >
            Leave Session
          </Button>
        </div>
      </Show>
    </Card>
  );
}

// ============================================================================
// Compact Collab Status for header/status bar
// ============================================================================

interface CollabStatusProps {
  onClick?: () => void;
}

export function CollabStatus(props: CollabStatusProps) {
  const { state } = useCollab();

  const isInSession = () => state.currentRoom !== null;
  const participantCount = () => state.participants.length;

  return (
    <button
      onClick={props.onClick}
      class="flex items-center gap-2 px-2 py-1 rounded-md transition-colors"
      style={{ background: "transparent" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      title={isInSession() ? "Collaboration active" : "Start collaboration"}
    >
<Show 
        when={isInSession()} 
        fallback={
          <>
            <Icon name="users" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />
            <Text variant="muted" size="xs">Collaborate</Text>
          </>
        }
      >
        <div class="flex items-center gap-1.5">
          <div 
            class="w-2 h-2 rounded-full animate-pulse" 
            style={{ background: "var(--cortex-success)" }}
          />
          <Icon name="users" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
          <Text size="xs" weight="medium" style={{ color: "var(--cortex-success)" }}>
            {participantCount()}
          </Text>
        </div>
      </Show>
    </button>
  );
}
