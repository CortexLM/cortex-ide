import { Show, createSignal, createEffect, onCleanup } from "solid-js";
import { Icon } from "../ui/Icon";
import { useCollab, type CollabPermission } from "@/context/CollabContext";
import { Card, Button, IconButton, Input, Badge, Text } from "@/components/ui";

interface ShareButtonProps {
  variant?: "icon" | "button";
  onSessionCreated?: (roomId: string) => void;
}

export function ShareButton(props: ShareButtonProps) {
  const { 
    state, 
    connect, 
    createRoom, 
    leaveRoom, 
    generateShareLink,
    createInviteLink,
    isHost,
  } = useCollab();
  
  const [showModal, setShowModal] = createSignal(false);
  const [userName, setUserName] = createSignal("");
  const [isCreating, setIsCreating] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedPermission, setSelectedPermission] = createSignal<CollabPermission>("editor");
  const [showPermissionDropdown, setShowPermissionDropdown] = createSignal(false);

  const isInSession = () => state.currentRoom !== null;
  const participantCount = () => state.participants.length;

  const handleShare = () => {
    if (isInSession()) {
      // Show share modal with link
      setShowModal(true);
    } else {
      // Show create session modal
      setShowModal(true);
    }
  };

  const handleCreateSession = async () => {
    if (!userName().trim()) {
      setError("Please enter your name");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Connect to collaboration server
      // In production, this would be a real WebSocket server URL
      const serverUrl = "ws://127.0.0.1:4097/collab";
      await connect(serverUrl);
      
      // Create a new room
      const roomId = await createRoom(userName().trim());
      props.onSessionCreated?.(roomId);
      
      // Keep modal open to show share link
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setIsCreating(false);
    }
  };

  const handleEndSession = () => {
    leaveRoom();
    setShowModal(false);
  };

  const handleCopyLink = async () => {
    try {
      let link: string;
      // If host, create invite link with selected permission
      if (isHost()) {
        link = await createInviteLink(selectedPermission());
      } else {
        link = generateShareLink();
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const link = generateShareLink();
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

  const getPermissionLabel = (permission: CollabPermission): string => {
    switch (permission) {
      case "owner": return "Owner";
      case "editor": return "Can Edit";
      case "viewer": return "View Only";
    }
  };

  // Close modal on escape
  createEffect(() => {
    if (showModal()) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setShowModal(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
    }
  });

  const buttonContent = () => {
    if (props.variant === "icon") {
      return (
<IconButton
          onClick={handleShare}
          tooltip={isInSession() ? "Sharing session" : "Share session"}
          style={{ 
            position: "relative",
            color: isInSession() ? "var(--cortex-success)" : "var(--jb-text-muted-color)" 
          }}
        >
          <Icon name="share-nodes" class="w-4 h-4" />
          <Show when={isInSession()}>
            <Badge 
              variant="success"
              size="sm"
              style={{ 
                position: "absolute",
                top: "-2px",
                right: "-2px",
                "min-width": "16px",
                height: "16px",
                "border-radius": "var(--cortex-radius-full)",
                "font-size": "10px"
              }}
            >
              {participantCount()}
            </Badge>
          </Show>
        </IconButton>
      );
    }

    return (
<Button
        variant="primary"
        onClick={handleShare}
        icon={<Icon name="share-nodes" class="w-4 h-4" />}
        style={{
          background: isInSession() ? "var(--cortex-success)" : "var(--jb-btn-primary-bg)",
        }}
      >
        {isInSession() ? `Sharing (${participantCount()})` : "Share"}
      </Button>
    );
  };

  return (
    <>
      {buttonContent()}

      {/* Modal */}
      <Show when={showModal()}>
        <div 
          class="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <Card 
            variant="elevated"
            padding="lg"
            class="w-full max-w-md"
            style={{ 
              "box-shadow": "var(--jb-shadow-popup)"
            }}
          >
            {/* Header */}
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-3">
<div 
                  class="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ 
                    background: isInSession() 
                      ? "rgba(89, 168, 105, 0.2)" 
                      : "rgba(53, 116, 240, 0.2)" 
                  }}
                >
                  <Icon 
                    name="users"
                    class="w-5 h-5" 
                    style={{ color: isInSession() ? "var(--cortex-success)" : "var(--jb-border-focus)" }}
                  />
                </div>
                <div>
                  <Text size="lg" weight="semibold">
                    {isInSession() ? "Collaboration Active" : "Start Collaboration"}
                  </Text>
                  <Text variant="muted" size="sm">
                    {isInSession() 
                      ? `${participantCount()} participant${participantCount() !== 1 ? "s" : ""}`
                      : "Invite others to edit together"}
                  </Text>
                </div>
              </div>
<IconButton
                onClick={() => setShowModal(false)}
              >
                <Icon name="xmark" class="w-5 h-5" />
              </IconButton>
            </div>

            {/* Content */}
            <Show when={!isInSession()}>
              {/* Create session form */}
              <div class="space-y-4">
                <Input
                  label="Your Name"
                  value={userName()}
                  onInput={(e) => setUserName(e.currentTarget.value)}
                  placeholder="Enter your display name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateSession();
                  }}
                />

                <Show when={error()}>
                  <Card 
                    variant="outlined"
                    padding="sm"
                    style={{ 
                      background: "rgba(247, 84, 100, 0.1)", 
                      "border-color": "var(--cortex-error)" 
                    }}
                  >
                    <Text color="error" size="sm">{error()}</Text>
                  </Card>
                </Show>

<Button
                  variant="primary"
                  onClick={handleCreateSession}
                  disabled={isCreating()}
                  loading={isCreating()}
                  icon={<Icon name="share-nodes" class="w-4 h-4" />}
                  style={{ width: "100%" }}
                >
                  {isCreating() ? "Creating..." : "Start Session"}
                </Button>
              </div>
            </Show>

            <Show when={isInSession()}>
              {/* Share link */}
              <div class="space-y-4">
                <div>
                  <Text variant="muted" size="sm" weight="medium" style={{ "margin-bottom": "8px", display: "block" }}>
                    Share Link
                  </Text>
                  
                  {/* Permission selector for hosts */}
                  <Show when={isHost()}>
                    <div class="mb-2">
                      <div class="relative">
<Button
                          variant="secondary"
                          onClick={() => setShowPermissionDropdown(!showPermissionDropdown())}
                          icon={selectedPermission() === "editor" 
                            ? <Icon name="pen" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
                            : <Icon name="eye" class="w-4 h-4" style={{ color: "var(--jb-border-focus)" }} />
                          }
                          iconRight={<Icon name="chevron-down" class="w-4 h-4" />}
                          style={{ width: "100%", "justify-content": "space-between" }}
                        >
                          Invite as: {getPermissionLabel(selectedPermission())}
                        </Button>
                        
                        <Show when={showPermissionDropdown()}>
                          <Card 
                            variant="elevated"
                            padding="sm"
                            class="absolute top-full left-0 right-0 mt-1 z-10"
                          >
<button
                              onClick={() => {
                                setSelectedPermission("editor");
                                setShowPermissionDropdown(false);
                              }}
                              class="w-full flex items-center gap-2 px-3 py-2 rounded"
                              style={{ background: "transparent" }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                            >
                              <Icon name="pen" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
                              <Text size="sm">Can Edit</Text>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPermission("viewer");
                                setShowPermissionDropdown(false);
                              }}
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
                    </div>
                  </Show>
                  
                  <div class="flex gap-2">
<Card 
                      variant="outlined"
                      padding="sm"
                      class="flex-1 flex items-center gap-2 truncate"
                    >
                      <Icon name="link" class="w-4 h-4 flex-shrink-0" style={{ color: "var(--jb-text-muted-color)" }} />
                      <Text variant="muted" size="sm" truncate>{generateShareLink()}</Text>
                    </Card>
                    <Button
                      variant={copied() ? "primary" : "secondary"}
                      onClick={handleCopyLink}
                      icon={copied() ? <Icon name="check" class="w-4 h-4" /> : <Icon name="copy" class="w-4 h-4" />}
                      style={copied() ? { background: "var(--cortex-success)" } : {}}
                    />
                  </div>
                </div>

                <Card variant="outlined" padding="md">
                  <Text variant="muted" size="sm">
                    Share this link with others to invite them to collaborate in real-time. 
                    All participants will see each other's cursors and edits instantly.
                  </Text>
                </Card>

<Button
                  variant="danger"
                  onClick={handleEndSession}
                  icon={<Icon name="xmark" class="w-4 h-4" />}
                  style={{ width: "100%" }}
                >
                  End Session
                </Button>
              </div>
            </Show>
          </Card>
        </div>
      </Show>
    </>
  );
}

