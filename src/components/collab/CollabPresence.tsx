import { For, Show, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { useCollab, type CollabUser, type CollabPermission } from "@/context/CollabContext";
import { Avatar, Badge, Text, IconButton, EmptyState } from "@/components/ui";

interface CollabPresenceProps {
  compact?: boolean;
  onFollowUser?: (userId: string) => void;
}

/**
 * CollabPresence displays the list of users currently in the
 * collaboration session with their avatars, activity status,
 * permission badges, and follow controls.
 */
export function CollabPresence(props: CollabPresenceProps) {
  const { state, followUser, unfollowUser, isHost } = useCollab();

  const sortedParticipants = createMemo(() => {
    if (!state.currentRoom) return [];
    return [...state.participants].sort((a, b) => {
      if (a.id === state.currentRoom?.hostId) return -1;
      if (b.id === state.currentRoom?.hostId) return 1;
      return a.name.localeCompare(b.name);
    });
  });

  const isCurrentUser = (userId: string): boolean =>
    state.currentUser?.id === userId;

  const isHostUser = (userId: string): boolean =>
    state.currentRoom?.hostId === userId;

  const isFollowing = (userId: string): boolean =>
    state.followingUser === userId;

  const handleFollowClick = (userId: string) => {
    if (isFollowing(userId)) {
      unfollowUser();
    } else {
      followUser(userId);
      props.onFollowUser?.(userId);
    }
  };

  const getActivityStatus = (user: CollabUser): "online" | "away" | "offline" => {
    if (!user.cursor) return "offline";
    const elapsed = Date.now() - user.cursor.timestamp;
    if (elapsed < 5000) return "online";
    if (elapsed < 30000) return "away";
    return "offline";
  };

  const permBadge = (perm: CollabPermission) => {
    switch (perm) {
      case "owner": return { icon: "lock", label: "Owner", variant: "warning" as const };
      case "editor": return { icon: "pen", label: "Editor", variant: "success" as const };
      case "viewer": return { icon: "eye", label: "Viewer", variant: "accent" as const };
    }
  };

  if (props.compact) {
    return (
      <div class="flex items-center gap-1">
        <For each={sortedParticipants()}>
          {(p) => (
            <div
              class="relative"
              title={`${p.name}${isCurrentUser(p.id) ? " (You)" : ""}`}
            >
              <Avatar name={p.name} src={p.avatar} size="sm" status={getActivityStatus(p)} />
              <Show when={isHostUser(p.id)}>
                <div
                  class="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center"
                  style={{ background: "var(--cortex-warning)" }}
                >
                  <Icon name="star" class="w-2 h-2 text-white" />
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    );
  }

  return (
    <div class="flex flex-col gap-1">
      <div class="px-3 py-2 flex items-center justify-between">
        <Text variant="header" size="xs">
          Online ({sortedParticipants().length})
        </Text>
        <Show when={isHost()}>
          <Badge variant="warning" size="sm">Host</Badge>
        </Show>
      </div>

      <Show
        when={sortedParticipants().length > 0}
        fallback={
          <EmptyState description="No participants yet" style={{ padding: "24px" }} />
        }
      >
        <For each={sortedParticipants()}>
          {(participant) => {
            const badge = permBadge(participant.permission);
            return (
              <div
                class="flex items-center gap-3 px-3 py-2 rounded-md mx-2 transition-colors"
                style={{
                  background: isFollowing(participant.id) ? `${participant.color}15` : "transparent",
                  "border-left": isFollowing(participant.id)
                    ? `2px solid ${participant.color}`
                    : "2px solid transparent",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  if (!isFollowing(participant.id))
                    e.currentTarget.style.background = "var(--jb-surface-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isFollowing(participant.id))
                    e.currentTarget.style.background = "transparent";
                }}
              >
                <Avatar
                  name={participant.name}
                  src={participant.avatar}
                  size="md"
                  status={getActivityStatus(participant)}
                />

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <Text size="sm" weight="medium" truncate>
                      {participant.name}
                    </Text>
                    <Show when={isCurrentUser(participant.id)}>
                      <Badge size="sm">You</Badge>
                    </Show>
                    <Show when={isHostUser(participant.id)}>
                      <Icon name="star" class="w-3 h-3" style={{ color: "var(--cortex-warning)" }} />
                    </Show>
                    <Badge
                      variant={badge.variant}
                      size="sm"
                      style={{ "font-size": "10px", padding: "0 4px" }}
                    >
                      <Icon name={badge.icon} class="w-2.5 h-2.5" />
                    </Badge>
                  </div>

                  <div class="flex items-center gap-2">
                    <Show when={participant.cursor}>
                      <Text variant="muted" size="xs" truncate>
                        Line {participant.cursor!.line + 1}
                      </Text>
                    </Show>
                    <Show when={participant.isAudioEnabled !== undefined}>
                      <span
                        style={{
                          color: participant.isAudioEnabled
                            ? "var(--cortex-success)"
                            : "var(--jb-text-muted-color)",
                        }}
                      >
                        <Show
                          when={participant.isAudioEnabled}
                          fallback={<Icon name="microphone-slash" class="w-3 h-3" />}
                        >
                          <Icon
                            name="microphone"
                            class={`w-3 h-3 ${participant.isSpeaking ? "animate-pulse" : ""}`}
                          />
                        </Show>
                      </span>
                    </Show>
                    <Show when={participant.isVideoEnabled !== undefined}>
                      <span
                        style={{
                          color: participant.isVideoEnabled
                            ? "var(--cortex-success)"
                            : "var(--jb-text-muted-color)",
                        }}
                      >
                        <Show
                          when={participant.isVideoEnabled}
                          fallback={<Icon name="video-slash" class="w-3 h-3" />}
                        >
                          <Icon name="video" class="w-3 h-3" />
                        </Show>
                      </span>
                    </Show>
                  </div>
                </div>

                <Show when={!isCurrentUser(participant.id)}>
                  <IconButton
                    onClick={() => handleFollowClick(participant.id)}
                    size="sm"
                    tooltip={isFollowing(participant.id) ? "Stop following" : "Follow user"}
                    style={{
                      background: isFollowing(participant.id) ? participant.color : "transparent",
                      color: isFollowing(participant.id) ? "white" : "var(--jb-text-muted-color)",
                    }}
                  >
                    <Show
                      when={isFollowing(participant.id)}
                      fallback={<Icon name="eye" class="w-4 h-4" />}
                    >
                      <Icon name="user-check" class="w-4 h-4" />
                    </Show>
                  </IconButton>
                </Show>
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
}
