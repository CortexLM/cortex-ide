import { createSignal, For, Show, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import {
  useComments,
  type CommentThread as CommentThreadType,
  type Comment,
  type ReactionType,
} from "@/context/CommentsContext";

// ============================================================================
// Constants
// ============================================================================

const AVAILABLE_REACTIONS: ReactionType[] = [
  "👍",
  "👎",
  "❤️",
  "🎉",
  "😄",
  "😕",
  "🚀",
  "👀",
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months}mo ago`;
  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(userId: string): string {
  const colors = [
    "var(--cortex-warning)",
    "var(--cortex-success)",
    "var(--cortex-info)",
    "var(--cortex-info)",
    "var(--cortex-error)",
    "var(--cortex-info)",
    "var(--cortex-warning)",
    "var(--cortex-error)",
    "var(--cortex-info)",
    "var(--cortex-info)",
  ];
  const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// ============================================================================
// Sub-Components
// ============================================================================

interface CommentAvatarProps {
  author: { id: string; name: string; avatar?: string };
  size?: "sm" | "md";
}

function CommentAvatar(props: CommentAvatarProps) {
  const size = props.size || "md";
  const sizeClass = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";

  return (
    <Show
      when={props.author.avatar}
      fallback={
        <div
          class={`${sizeClass} rounded-full flex items-center justify-center font-medium flex-shrink-0`}
          style={{
            background: getAvatarColor(props.author.id),
            color: "white",
          }}
        >
          {getInitials(props.author.name)}
        </div>
      }
    >
      <img
        src={props.author.avatar}
        alt={props.author.name}
        class={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    </Show>
  );
}

interface ReactionButtonProps {
  emoji: ReactionType;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

function ReactionButton(props: ReactionButtonProps) {
  return (
    <button
      class="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors"
      style={{
        background: props.isActive
          ? "var(--accent-muted)"
          : "var(--surface-raised)",
        color: props.isActive ? "var(--accent)" : "var(--text-weak)",
        border: `1px solid ${props.isActive ? "var(--accent)" : "var(--border-weak)"}`,
      }}
      onClick={props.onClick}
    >
      <span>{props.emoji}</span>
      <span>{props.count}</span>
    </button>
  );
}

interface ReactionPickerProps {
  onSelect: (emoji: ReactionType) => void;
  onClose: () => void;
}

function ReactionPicker(props: ReactionPickerProps) {
  return (
    <div
      class="absolute top-full left-0 mt-1 p-1 rounded-lg shadow-lg z-20 flex gap-0.5"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border-weak)",
      }}
    >
      <For each={AVAILABLE_REACTIONS}>
        {(emoji) => (
          <button
            class="w-7 h-7 rounded hover:bg-[var(--surface-active)] transition-colors text-sm"
            onClick={() => {
              props.onSelect(emoji);
              props.onClose();
            }}
          >
            {emoji}
          </button>
        )}
      </For>
    </div>
  );
}

interface SingleCommentProps {
  comment: Comment;
  threadId: string;
  isFirst: boolean;
  currentUserId: string;
}

function SingleComment(props: SingleCommentProps) {
  const comments = useComments();
  const [isEditing, setIsEditing] = createSignal(false);
  const [editContent, setEditContent] = createSignal(props.comment.content);
  const [showMenu, setShowMenu] = createSignal(false);
  const [showReactionPicker, setShowReactionPicker] = createSignal(false);

  const isOwnComment = createMemo(() => props.comment.author.id === props.currentUserId);

  const handleSaveEdit = () => {
    if (editContent().trim()) {
      comments.editComment(props.threadId, props.comment.id, editContent().trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(props.comment.content);
    setIsEditing(false);
  };

  const handleDelete = () => {
    comments.deleteComment(props.threadId, props.comment.id);
    setShowMenu(false);
  };

  const handleReaction = (emoji: ReactionType) => {
    comments.toggleReaction(props.threadId, props.comment.id, emoji);
  };

  const hasUserReacted = (emoji: ReactionType): boolean => {
    const reaction = props.comment.reactions.find((r) => r.emoji === emoji);
    return reaction?.userIds.includes(props.currentUserId) || false;
  };

  return (
    <div class="group flex gap-2">
      <Show
        when={!props.isFirst}
        fallback={<CommentAvatar author={props.comment.author} />}
      >
        <div class="w-8 flex justify-center">
          <Icon
            name="corner-down-right"
            class="w-3 h-3 mt-2"
            style={{ color: "var(--text-weaker)" }}
          />
        </div>
      </Show>

      <div class="flex-1 min-w-0">
        {/* Header */}
        <div class="flex items-center gap-2 mb-1">
          <Show when={!props.isFirst}>
            <CommentAvatar author={props.comment.author} size="sm" />
          </Show>
          <span class="text-xs font-medium" style={{ color: "var(--text-strong)" }}>
            {props.comment.author.name}
          </span>
          <span class="text-[10px]" style={{ color: "var(--text-weaker)" }}>
            {formatRelativeTime(props.comment.createdAt)}
          </span>
          <Show when={props.comment.isEdited}>
            <span
              class="text-[10px] italic"
              style={{ color: "var(--text-weaker)" }}
            >
              (edited)
            </span>
          </Show>
        </div>

        {/* Content */}
        <Show
          when={!isEditing()}
          fallback={
            <div class="space-y-2">
              <textarea
                value={editContent()}
                onInput={(e) => setEditContent(e.currentTarget.value)}
                class="w-full px-2 py-1.5 text-sm rounded resize-none"
                style={{
                  background: "var(--surface-base)",
                  color: "var(--text-strong)",
                  border: "1px solid var(--border-base)",
                  outline: "none",
                }}
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    handleSaveEdit();
                  }
                  if (e.key === "Escape") {
                    handleCancelEdit();
                  }
                }}
              />
              <div class="flex items-center gap-2">
                <button
                  class="px-2 py-1 text-xs rounded transition-colors"
                  style={{
                    background: "var(--accent)",
                    color: "white",
                  }}
                  onClick={handleSaveEdit}
                >
                  Save
                </button>
                <button
                  class="px-2 py-1 text-xs rounded transition-colors"
                  style={{
                    background: "var(--surface-raised)",
                    color: "var(--text-base)",
                    border: "1px solid var(--border-weak)",
                  }}
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              </div>
            </div>
          }
        >
          <p
            class="text-sm whitespace-pre-wrap break-words"
            style={{ color: "var(--text-base)" }}
          >
            {props.comment.content}
          </p>
        </Show>

        {/* Reactions */}
        <Show when={props.comment.reactions.length > 0 || !isEditing()}>
          <div class="flex items-center gap-1 mt-2 flex-wrap">
            <For each={props.comment.reactions}>
              {(reaction) => (
                <ReactionButton
                  emoji={reaction.emoji}
                  count={reaction.userIds.length}
                  isActive={hasUserReacted(reaction.emoji)}
                  onClick={() => handleReaction(reaction.emoji)}
                />
              )}
            </For>

            {/* Add reaction button */}
            <Show when={!isEditing()}>
              <div class="relative">
                <button
                  class="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--surface-raised)] transition-colors opacity-0 group-hover:opacity-100"
                  style={{ color: "var(--text-weaker)" }}
                  onClick={() => setShowReactionPicker(!showReactionPicker())}
                  title="Add reaction"
                >
                  <span class="text-sm">😀</span>
                </button>
                <Show when={showReactionPicker()}>
                  <ReactionPicker
                    onSelect={handleReaction}
                    onClose={() => setShowReactionPicker(false)}
                  />
                </Show>
              </div>
            </Show>
          </div>
        </Show>

        {/* Actions (only for own comments) */}
        <Show when={isOwnComment() && !isEditing()}>
          <div class="relative">
            <button
              class="absolute -top-6 right-0 p-1 rounded hover:bg-[var(--surface-raised)] transition-colors opacity-0 group-hover:opacity-100"
              style={{ color: "var(--text-weaker)" }}
              onClick={() => setShowMenu(!showMenu())}
            >
              <Icon name="ellipsis" class="w-4 h-4" />
            </button>

            <Show when={showMenu()}>
              <div
                class="absolute -top-6 right-6 rounded-lg shadow-lg z-20 py-1 min-w-[100px]"
                style={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border-weak)",
                }}
              >
                <button
                  class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--surface-active)] transition-colors"
                  style={{ color: "var(--text-base)" }}
                  onClick={() => {
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                >
                  <Icon name="pen" class="w-3 h-3" />
                  Edit
                </button>
                <button
                  class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--surface-active)] transition-colors"
                  style={{ color: "var(--error)" }}
                  onClick={handleDelete}
                >
                  <Icon name="trash" class="w-3 h-3" />
                  Delete
                </button>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface CommentThreadProps {
  thread: CommentThreadType;
  onNavigate?: (filePath: string, lineNumber: number) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function CommentThread(props: CommentThreadProps) {
  const comments = useComments();
  const [replyContent, setReplyContent] = createSignal("");
  const [showReplyInput, setShowReplyInput] = createSignal(false);

  const handleResolve = () => {
    if (props.thread.isResolved) {
      comments.unresolveThread(props.thread.id);
    } else {
      comments.resolveThread(props.thread.id);
    }
  };

  const handleNavigate = () => {
    props.onNavigate?.(props.thread.filePath, props.thread.lineNumber);
  };

  const handleAddReply = () => {
    if (replyContent().trim()) {
      comments.addComment(props.thread.id, replyContent().trim());
      setReplyContent("");
      setShowReplyInput(false);
    }
  };

  const fileName = createMemo(() => {
    const parts = props.thread.filePath.split(/[/\\]/);
    return parts[parts.length - 1];
  });

  const expanded = props.isExpanded ?? true;

  return (
    <div
      class="rounded-lg overflow-hidden"
      style={{
        background: "var(--surface-base)",
        border: `1px solid ${props.thread.isResolved ? "var(--success)" : "var(--border-weak)"}`,
        opacity: props.thread.isResolved ? 0.7 : 1,
      }}
    >
      {/* Thread Header */}
      <div
        class="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[var(--surface-raised)] transition-colors"
        style={{
          background: props.thread.isResolved
            ? "rgba(170, 216, 76, 0.1)"
            : "var(--surface-raised)",
          "border-bottom": expanded ? "1px solid var(--border-weak)" : "none",
        }}
        onClick={props.onToggleExpand}
      >
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <button
            class="flex items-center gap-1 text-xs hover:underline truncate"
            style={{ color: "var(--accent)" }}
            onClick={(e) => {
              e.stopPropagation();
              handleNavigate();
            }}
            title={`${props.thread.filePath}:${props.thread.lineNumber}`}
          >
            <span class="truncate">{fileName()}</span>
            <span style={{ color: "var(--text-weaker)" }}>
              :{props.thread.lineNumber}
            </span>
          </button>

          <Show when={props.thread.isResolved}>
            <span
              class="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: "var(--success)",
                color: "white",
              }}
            >
              <Icon name="check" class="w-3 h-3" />
              Resolved
            </span>
          </Show>
        </div>

        <div class="flex items-center gap-1">
          <span class="text-[10px]" style={{ color: "var(--text-weaker)" }}>
            <Icon name="clock" class="w-3 h-3 inline mr-1" />
            {formatRelativeTime(props.thread.updatedAt)}
          </span>
          <span class="text-[10px]" style={{ color: "var(--text-weaker)" }}>
            · {props.thread.comments.length} {props.thread.comments.length === 1 ? "comment" : "comments"}
          </span>
        </div>
      </div>

      {/* Thread Content (when expanded) */}
      <Show when={expanded}>
        <div class="p-3 space-y-3">
          {/* Line preview */}
          <Show when={props.thread.lineContent}>
            <div
              class="px-2 py-1 rounded text-xs font-mono truncate"
              style={{
                background: "var(--background-base)",
                color: "var(--text-weak)",
                "border-left": "2px solid var(--accent)",
              }}
            >
              {props.thread.lineContent}
            </div>
          </Show>

          {/* Comments */}
          <div class="space-y-3">
            <For each={props.thread.comments}>
              {(comment, index) => (
                <SingleComment
                  comment={comment}
                  threadId={props.thread.id}
                  isFirst={index() === 0}
                  currentUserId={comments.state.currentUser.id}
                />
              )}
            </For>
          </div>

          {/* Reply section */}
          <Show
            when={showReplyInput()}
            fallback={
              <div class="flex items-center gap-2 pt-2 border-t" style={{ "border-color": "var(--border-weak)" }}>
                <button
                  class="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--surface-raised)] transition-colors"
                  style={{ color: "var(--text-weak)" }}
                  onClick={() => setShowReplyInput(true)}
                >
                  <Icon name="message-circle" class="w-3 h-3" />
                  Reply
                </button>

                <button
                  class="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--surface-raised)] transition-colors"
                  style={{
                    color: props.thread.isResolved
                      ? "var(--warning)"
                      : "var(--success)",
                  }}
                  onClick={handleResolve}
                >
                  <Show
                    when={props.thread.isResolved}
                    fallback={
                      <>
                        <Icon name="check" class="w-3 h-3" />
                        Resolve
                      </>
                    }
                  >
                    <Icon name="rotate" class="w-3 h-3" />
                    Reopen
                  </Show>
                </button>
              </div>
            }
          >
            <div
              class="pt-2 border-t space-y-2"
              style={{ "border-color": "var(--border-weak)" }}
            >
              <textarea
                value={replyContent()}
                onInput={(e) => setReplyContent(e.currentTarget.value)}
                placeholder="Write a reply..."
                class="w-full px-2 py-1.5 text-sm rounded resize-none"
                style={{
                  background: "var(--surface-raised)",
                  color: "var(--text-strong)",
                  border: "1px solid var(--border-base)",
                  outline: "none",
                }}
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    handleAddReply();
                  }
                  if (e.key === "Escape") {
                    setShowReplyInput(false);
                  }
                }}
              />
              <div class="flex items-center gap-2">
                <button
                  class="px-2 py-1 text-xs rounded transition-colors disabled:opacity-50"
                  style={{
                    background: "var(--accent)",
                    color: "white",
                  }}
                  onClick={handleAddReply}
                  disabled={!replyContent().trim()}
                >
                  Reply
                </button>
                <button
                  class="px-2 py-1 text-xs rounded transition-colors"
                  style={{
                    background: "var(--surface-raised)",
                    color: "var(--text-base)",
                    border: "1px solid var(--border-weak)",
                  }}
                  onClick={() => {
                    setShowReplyInput(false);
                    setReplyContent("");
                  }}
                >
                  Cancel
                </button>
                <span
                  class="text-[10px] ml-auto"
                  style={{ color: "var(--text-weaker)" }}
                >
                  Ctrl+Enter to submit
                </span>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

