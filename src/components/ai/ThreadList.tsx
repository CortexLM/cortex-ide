import { createSignal, createMemo, For, Show } from "solid-js";
import { Icon } from "../ui/Icon";

// ============================================================================
// Types
// ============================================================================

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Thread {
  id: string;
  title: string;
  messages?: Message[];
  lastMessage?: string;
  createdAt?: number;
  updatedAt?: number;
  timestamp?: number;
  messageCount?: number;
}

export interface ThreadListProps {
  threads: Thread[];
  activeThreadId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

interface ThreadItemProps {
  thread: Thread;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

type TimeGroup = "today" | "yesterday" | "thisWeek" | "thisMonth" | "older";

// ============================================================================
// Constants
// ============================================================================

const GROUP_LABELS: Record<TimeGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This Week",
  thisMonth: "This Month",
  older: "Older",
};

const GROUP_ORDER: TimeGroup[] = ["today", "yesterday", "thisWeek", "thisMonth", "older"];

// ============================================================================
// Helper Functions
// ============================================================================

function getThreadTimestamp(thread: Thread): number {
  return thread.updatedAt ?? thread.timestamp ?? thread.createdAt ?? Date.now();
}

function getTimeGroup(timestamp: number): TimeGroup {
  const now = new Date();
  const date = new Date(timestamp);
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  if (date >= today) {
    return "today";
  } else if (date >= yesterday) {
    return "yesterday";
  } else if (date >= weekAgo) {
    return "thisWeek";
  } else if (date >= monthAgo) {
    return "thisMonth";
  }
  return "older";
}

function formatGroupLabel(group: TimeGroup): string {
  return GROUP_LABELS[group];
}

function getPreview(thread: Thread): string {
  // Support both messages array and lastMessage string
  if (thread.lastMessage !== undefined) {
    const content = thread.lastMessage.trim();
    if (content.length === 0) {
      return "No messages";
    }
    if (content.length <= 60) {
      return content;
    }
    return content.substring(0, 57) + "...";
  }
  
  if (!thread.messages || thread.messages.length === 0) {
    return "No messages";
  }
  
  const lastMessage = thread.messages[thread.messages.length - 1];
  const content = lastMessage.content.trim();
  
  if (content.length <= 60) {
    return content;
  }
  
  return content.substring(0, 57) + "...";
}

function formatDate(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  
  if (date >= today) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (date >= yesterday) {
    return "Yesterday";
  } else if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

// ============================================================================
// ThreadItem Component
// ============================================================================

function ThreadItem(props: ThreadItemProps) {
  const [isHovered, setIsHovered] = createSignal(false);

  return (
    <div
      class="thread-item"
      style={{
        display: "flex",
        "flex-direction": "column",
        "justify-content": "center",
        height: "48px",
        "min-height": "48px",
        "max-height": "48px",
        padding: "0 12px",
        cursor: "pointer",
        "border-radius": "var(--cortex-radius-sm)",
        "border-left": props.isActive ? "2px solid var(--accent-primary)" : "2px solid transparent",
        background: props.isActive
          ? "var(--surface-raised)"
          : isHovered()
            ? "var(--surface-active)"
            : "transparent",
        transition: "background 150ms ease, border-color 150ms ease",
        position: "relative",
        "box-sizing": "border-box",
      }}
      onClick={props.onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top row: Title + Timestamp */}
      <div
        class="thread-header"
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          gap: "8px",
          "min-width": "0",
        }}
      >
        <div
          class="thread-title"
          style={{
            "font-size": "13px",
            "font-weight": "500",
            color: props.isActive ? "var(--text-strong)" : "var(--text-base)",
            "white-space": "nowrap",
            overflow: "hidden",
            "text-overflow": "ellipsis",
            flex: "1",
            "min-width": "0",
          }}
        >
          {props.thread.title}
        </div>
        
        <span
          class="thread-date"
          style={{
            "font-size": "11px",
            color: "var(--text-weak)",
            "flex-shrink": "0",
            "white-space": "nowrap",
          }}
        >
          {formatDate(getThreadTimestamp(props.thread))}
        </span>
      </div>
      
      {/* Bottom row: Preview + Delete button */}
      <div
        class="thread-content"
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          gap: "8px",
          "margin-top": "2px",
          "min-width": "0",
        }}
      >
        <div
          class="thread-preview"
          style={{
            "font-size": "12px",
            color: "var(--text-weak)",
            "white-space": "nowrap",
            overflow: "hidden",
            "text-overflow": "ellipsis",
            flex: "1",
            "min-width": "0",
            "line-height": "1.3",
          }}
        >
          {getPreview(props.thread)}
        </div>
        
        <Show when={isHovered()}>
          <button
            class="thread-delete"
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "20px",
              height: "20px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-weak)",
              "border-radius": "var(--cortex-radius-sm)",
              padding: "0",
              "flex-shrink": "0",
              transition: "background 150ms ease, color 150ms ease",
            }}
            onClick={(e) => {
              e.stopPropagation();
              props.onDelete();
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-raised)";
              e.currentTarget.style.color = "var(--error)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-weak)";
            }}
            title="Delete thread"
          >
            <Icon name="trash" style={{ width: "14px", height: "14px" }} />
          </button>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// ThreadList Component
// ============================================================================

export function ThreadList(props: ThreadListProps) {
  const [searchQuery, setSearchQuery] = createSignal("");

  const filteredThreads = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return props.threads;
    
    return props.threads.filter((t) =>
      t.title.toLowerCase().includes(query) ||
      (t.lastMessage && t.lastMessage.toLowerCase().includes(query)) ||
      (t.messages && t.messages.some((m) => m.content.toLowerCase().includes(query)))
    );
  });

  const groupedThreads = createMemo(() => {
    const groups: Record<TimeGroup, Thread[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: [],
    };

    const threads = filteredThreads();
    
    for (const thread of threads) {
      const group = getTimeGroup(getThreadTimestamp(thread));
      groups[group].push(thread);
    }

    // Sort threads within each group by timestamp (most recent first)
    for (const group of GROUP_ORDER) {
      groups[group].sort((a, b) => getThreadTimestamp(b) - getThreadTimestamp(a));
    }

    return groups;
  });

  const hasNoThreads = createMemo(() => props.threads.length === 0);
  const hasNoResults = createMemo(() => filteredThreads().length === 0 && searchQuery().trim() !== "");

  return (
    <div
      class="thread-list"
      style={{
        display: "flex",
        "flex-direction": "column",
        width: "240px",
        height: "100%",
        background: "var(--background-stronger)",
        "border-right": "1px solid var(--border-weak)",
      }}
    >
      {/* Search */}
      <div
        class="thread-list-search"
        style={{
          position: "sticky",
          top: "0",
          "z-index": "10",
          padding: "8px",
          background: "var(--background-stronger)",
          "border-bottom": "1px solid var(--border-weak)",
        }}
      >
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
            padding: "6px 10px",
            background: "var(--surface-base)",
            "border-radius": "var(--cortex-radius-md)",
            border: "1px solid var(--border-weak)",
          }}
        >
<Icon
            name="magnifying-glass"
            class="search-icon"
            style={{
              width: "14px",
              height: "14px",
              color: "var(--text-weaker)",
              "flex-shrink": "0",
            }}
          />
          <input
            type="text"
            placeholder="Search threads..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            style={{
              flex: "1",
              background: "transparent",
              border: "none",
              outline: "none",
              "font-size": "12px",
              color: "var(--text-base)",
            }}
          />
        </div>
      </div>

      {/* New thread button */}
      <div style={{ padding: "8px" }}>
        <button
          class="new-thread-btn"
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            gap: "6px",
            width: "100%",
            padding: "8px 12px",
            background: "var(--accent-primary)",
            color: "var(--text-on-accent, white)",
            border: "none",
            "border-radius": "var(--cortex-radius-md)",
            cursor: "pointer",
            "font-size": "12px",
            "font-weight": "500",
            transition: "opacity 150ms ease",
          }}
          onClick={props.onNew}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.9";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          <Icon name="plus" style={{ width: "14px", height: "14px" }} />
          <span>New Thread</span>
        </button>
      </div>

      {/* Thread groups */}
      <div
        class="thread-groups"
        style={{
          flex: "1",
          "overflow-y": "auto",
          "overflow-x": "hidden",
          padding: "0 8px 8px 8px",
        }}
      >
        <Show when={hasNoThreads()}>
          <div
            style={{
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              "justify-content": "center",
              "text-align": "center",
              padding: "32px 16px",
              gap: "12px",
            }}
          >
<Icon
              name="message"
              style={{
                width: "32px",
                height: "32px",
                color: "var(--text-weaker)",
              }}
            />
            <div style={{ "font-size": "13px", color: "var(--text-weak)" }}>
              No conversations yet
            </div>
            <div style={{ "font-size": "11px", color: "var(--text-weaker)" }}>
              Start a new thread to begin
            </div>
          </div>
        </Show>

        <Show when={hasNoResults()}>
          <div
            style={{
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              "justify-content": "center",
              "text-align": "center",
              padding: "32px 16px",
              gap: "8px",
            }}
          >
<Icon
              name="magnifying-glass"
              style={{
                width: "24px",
                height: "24px",
                color: "var(--text-weaker)",
              }}
            />
            <div style={{ "font-size": "13px", color: "var(--text-weak)" }}>
              No results found
            </div>
            <div style={{ "font-size": "11px", color: "var(--text-weaker)" }}>
              Try a different search term
            </div>
          </div>
        </Show>

        <Show when={!hasNoThreads() && !hasNoResults()}>
          <For each={GROUP_ORDER}>
            {(group) => (
              <Show when={groupedThreads()[group].length > 0}>
                <div class="thread-group" style={{ "margin-bottom": "16px" }}>
                  <div
                    class="thread-group-label"
                    style={{
                      "font-size": "10px",
                      "font-weight": "600",
                      "text-transform": "uppercase",
                      "letter-spacing": "0.5px",
                      color: "var(--text-weaker)",
                      padding: "8px 12px 4px 12px",
                    }}
                  >
                    {formatGroupLabel(group)}
                  </div>
                  <For each={groupedThreads()[group]}>
                    {(thread) => (
                      <ThreadItem
                        thread={thread}
                        isActive={props.activeThreadId === thread.id}
                        onSelect={() => props.onSelect(thread.id)}
                        onDelete={() => props.onDelete(thread.id)}
                      />
                    )}
                  </For>
                </div>
              </Show>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}

export default ThreadList;

