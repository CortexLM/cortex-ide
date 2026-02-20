import { Show, createSignal, createEffect, onCleanup } from "solid-js";
import { Icon } from "../ui/Icon";
import { useCollab, type CollabPermission } from "@/context/CollabContext";
import { Card, Button, IconButton, Badge, Text } from "@/components/ui";

interface CollabInviteProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * CollabInvite provides a modal UI for generating and sharing
 * room invite links with selectable permission levels.
 */
export function CollabInvite(props: CollabInviteProps) {
  const {
    state,
    generateShareLink,
    createInviteLink,
    isHost,
  } = useCollab();

  const [copied, setCopied] = createSignal(false);
  const [selectedPermission, setSelectedPermission] = createSignal<CollabPermission>("editor");
  const [showPermissionDropdown, setShowPermissionDropdown] = createSignal(false);
  const [generatedLink, setGeneratedLink] = createSignal<string | null>(null);
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const getPermissionLabel = (permission: CollabPermission): string => {
    switch (permission) {
      case "owner": return "Owner";
      case "editor": return "Can Edit";
      case "viewer": return "View Only";
    }
  };

  const getPermissionIcon = (permission: CollabPermission): string => {
    switch (permission) {
      case "owner": return "lock";
      case "editor": return "pen";
      case "viewer": return "eye";
    }
  };

  const getPermissionColor = (permission: CollabPermission): string => {
    switch (permission) {
      case "owner": return "var(--cortex-warning)";
      case "editor": return "var(--cortex-success)";
      case "viewer": return "var(--jb-border-focus)";
    }
  };

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      if (isHost()) {
        const link = await createInviteLink(selectedPermission());
        setGeneratedLink(link);
      } else {
        setGeneratedLink(generateShareLink());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate link");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    const link = generatedLink() || generateShareLink();
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

  createEffect(() => {
    if (props.isOpen) {
      setGeneratedLink(null);
      setError(null);
      setCopied(false);

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") props.onClose();
      };
      window.addEventListener("keydown", onKeyDown);
      onCleanup(() => window.removeEventListener("keydown", onKeyDown));
    }
  });

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0, 0, 0, 0.5)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <Card
          variant="elevated"
          padding="lg"
          class="w-full max-w-md"
          style={{ "box-shadow": "var(--jb-shadow-popup)" }}
        >
          {/* Header */}
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(53, 116, 240, 0.2)" }}
              >
                <Icon name="user-plus" class="w-5 h-5" style={{ color: "var(--jb-border-focus)" }} />
              </div>
              <div>
                <Text size="lg" weight="semibold">Invite to Collaborate</Text>
                <Text variant="muted" size="sm">
                  {state.currentRoom?.name || "Collaboration Room"}
                </Text>
              </div>
            </div>
            <IconButton onClick={props.onClose}>
              <Icon name="xmark" class="w-5 h-5" />
            </IconButton>
          </div>

          {/* Permission selector */}
          <Show when={isHost()}>
            <div class="mb-4">
              <Text variant="muted" size="sm" weight="medium" style={{ "margin-bottom": "8px", display: "block" }}>
                Permission Level
              </Text>
              <div class="relative">
                <Button
                  variant="secondary"
                  onClick={() => setShowPermissionDropdown(!showPermissionDropdown())}
                  icon={
                    <Icon
                      name={getPermissionIcon(selectedPermission())}
                      class="w-4 h-4"
                      style={{ color: getPermissionColor(selectedPermission()) }}
                    />
                  }
                  iconRight={<Icon name="chevron-down" class="w-3 h-3" />}
                  style={{ width: "100%", "justify-content": "space-between" }}
                >
                  {getPermissionLabel(selectedPermission())}
                </Button>

                <Show when={showPermissionDropdown()}>
                  <Card
                    variant="elevated"
                    padding="sm"
                    class="absolute top-full left-0 right-0 mt-1 z-10"
                  >
                    <button
                      onClick={() => { setSelectedPermission("editor"); setShowPermissionDropdown(false); }}
                      class="w-full flex items-center gap-2 px-3 py-2 rounded"
                      style={{ background: "transparent" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <Icon name="pen" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
                      <div class="text-left">
                        <Text size="sm" weight="medium">Can Edit</Text>
                        <Text variant="muted" size="xs">Full editing access</Text>
                      </div>
                    </button>
                    <button
                      onClick={() => { setSelectedPermission("viewer"); setShowPermissionDropdown(false); }}
                      class="w-full flex items-center gap-2 px-3 py-2 rounded"
                      style={{ background: "transparent" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <Icon name="eye" class="w-4 h-4" style={{ color: "var(--jb-border-focus)" }} />
                      <div class="text-left">
                        <Text size="sm" weight="medium">View Only</Text>
                        <Text variant="muted" size="xs">Read-only access</Text>
                      </div>
                    </button>
                  </Card>
                </Show>
              </div>
            </div>
          </Show>

          {/* Generate / Copy link */}
          <div class="space-y-3">
            <Show when={!generatedLink()}>
              <Button
                variant="primary"
                onClick={handleGenerateLink}
                disabled={isGenerating()}
                loading={isGenerating()}
                icon={<Icon name="link" class="w-4 h-4" />}
                style={{ width: "100%" }}
              >
                {isGenerating() ? "Generating..." : "Generate Invite Link"}
              </Button>
            </Show>

            <Show when={generatedLink()}>
              <div class="flex gap-2">
                <Card
                  variant="outlined"
                  padding="sm"
                  class="flex-1 flex items-center gap-2 truncate"
                >
                  <Icon name="link" class="w-4 h-4 flex-shrink-0" style={{ color: "var(--jb-text-muted-color)" }} />
                  <Text variant="muted" size="sm" truncate>{generatedLink()}</Text>
                </Card>
                <Button
                  variant={copied() ? "primary" : "secondary"}
                  onClick={handleCopy}
                  icon={copied() ? <Icon name="check" class="w-4 h-4" /> : <Icon name="copy" class="w-4 h-4" />}
                  style={copied() ? { background: "var(--cortex-success)" } : {}}
                />
              </div>

              <Show when={copied()}>
                <Badge variant="success" style={{ width: "100%", "justify-content": "center", padding: "6px" }}>
                  <Icon name="check" class="w-3 h-3 mr-1" />
                  Link copied to clipboard
                </Badge>
              </Show>
            </Show>

            <Show when={error()}>
              <Card
                variant="outlined"
                padding="sm"
                style={{ background: "rgba(247, 84, 100, 0.1)", "border-color": "var(--cortex-error)" }}
              >
                <Text color="error" size="sm">{error()}</Text>
              </Card>
            </Show>
          </div>

          {/* Info */}
          <Card variant="outlined" padding="md" class="mt-4">
            <Text variant="muted" size="sm">
              Share this link with others to invite them to your collaboration session.
              All participants will see each other's cursors and edits in real-time.
            </Text>
          </Card>

          {/* Participants count */}
          <Show when={state.participants.length > 0}>
            <div class="mt-4 flex items-center gap-2">
              <div class="flex -space-x-2">
                {state.participants.slice(0, 5).map((p) => (
                  <div
                    class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                    style={{
                      background: p.color,
                      border: "2px solid var(--jb-surface-default)",
                    }}
                    title={p.name}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              <Text variant="muted" size="xs">
                {state.participants.length} participant{state.participants.length !== 1 ? "s" : ""} in session
              </Text>
            </div>
          </Show>
        </Card>
      </div>
    </Show>
  );
}
