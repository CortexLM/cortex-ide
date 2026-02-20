import { createSignal, For, Show, createMemo, onMount, onCleanup } from "solid-js";
import { Icon } from "../ui/Icon";
import {
  useComments,
  type CommentFilter,
  type CommentThread as CommentThreadType,
} from "@/context/CommentsContext";
import { CommentThread } from "./CommentThread";

// ============================================================================
// Constants
// ============================================================================

const FILTER_OPTIONS: { value: CommentFilter; label: string; icon: string }[] = [
  { value: "all", label: "All Comments", icon: "message" },
  { value: "unresolved", label: "Unresolved", icon: "circle-exclamation" },
  { value: "resolved", label: "Resolved", icon: "check" },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getFileIcon(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, string> = {
    ts: "📘",
    tsx: "⚛️",
    js: "📒",
    jsx: "⚛️",
    css: "🎨",
    scss: "🎨",
    html: "🌐",
    json: "📋",
    md: "📝",
    py: "🐍",
    rs: "🦀",
    go: "🐹",
    java: "☕",
    rb: "💎",
    php: "🐘",
  };
  return iconMap[ext] || "📄";
}

function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1];
}

function getDirectoryPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  parts.pop();
  return parts.length > 2 ? `.../${parts.slice(-2).join("/")}` : parts.join("/");
}

// ============================================================================
// Sub-Components
// ============================================================================

interface FileGroupProps {
  filePath: string;
  threads: CommentThreadType[];
  onNavigate: (filePath: string, lineNumber: number) => void;
  expandedThreads: Set<string>;
  onToggleThread: (threadId: string) => void;
}

function FileGroup(props: FileGroupProps) {
  const [isExpanded, setIsExpanded] = createSignal(true);

  const unresolvedCount = createMemo(() =>
    props.threads.filter((t) => !t.isResolved).length
  );

  return (
    <div class="mb-3">
      {/* File Header */}
      <button
        class="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--surface-raised)] transition-colors"
        onClick={() => setIsExpanded(!isExpanded())}
      >
        <Show
          when={isExpanded()}
          fallback={<Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--text-weaker)" }} />}
        >
          <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weaker)" }} />
        </Show>

        <span class="text-sm">{getFileIcon(props.filePath)}</span>

        <div class="flex-1 min-w-0 text-left">
          <div class="flex items-center gap-2">
            <span
              class="text-sm font-medium truncate"
              style={{ color: "var(--text-strong)" }}
            >
              {getFileName(props.filePath)}
            </span>
            <Show when={unresolvedCount() > 0}>
              <span
                class="px-1.5 py-0.5 text-[10px] rounded-full"
                style={{
                  background: "var(--warning)",
                  color: "white",
                }}
              >
                {unresolvedCount()}
              </span>
            </Show>
          </div>
          <span
            class="text-[10px] truncate block"
            style={{ color: "var(--text-weaker)" }}
          >
            {getDirectoryPath(props.filePath)}
          </span>
        </div>

        <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
          {props.threads.length} {props.threads.length === 1 ? "thread" : "threads"}
        </span>
      </button>

      {/* Thread List */}
      <Show when={isExpanded()}>
        <div class="pl-4 pr-1 py-2 space-y-2">
          <For each={props.threads}>
            {(thread) => (
              <CommentThread
                thread={thread}
                onNavigate={props.onNavigate}
                isExpanded={props.expandedThreads.has(thread.id)}
                onToggleExpand={() => props.onToggleThread(thread.id)}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

interface FilterDropdownProps {
  value: CommentFilter;
  onChange: (filter: CommentFilter) => void;
  isOpen: boolean;
  onToggle: () => void;
}

function FilterDropdown(props: FilterDropdownProps) {
  const currentOption = createMemo(() =>
    FILTER_OPTIONS.find((o) => o.value === props.value) || FILTER_OPTIONS[0]
  );

  return (
    <div class="relative">
      <button
        class="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)] transition-colors"
        style={{ color: "var(--text-weak)" }}
        onClick={props.onToggle}
      >
        <Icon name="filter" class="w-3.5 h-3.5" />
        <span>{currentOption().label}</span>
        <Icon name="chevron-down" class="w-3 h-3" />
      </button>

      <Show when={props.isOpen}>
        <div
          class="absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg z-20 min-w-[140px]"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-weak)",
          }}
        >
          <For each={FILTER_OPTIONS}>
            {(option) => {
              return (
                <button
                  class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--surface-active)] transition-colors"
                  style={{
                    color:
                      props.value === option.value
                        ? "var(--accent)"
                        : "var(--text-base)",
                  }}
                  onClick={() => {
                    props.onChange(option.value);
                    props.onToggle();
                  }}
                >
                  <Icon name={option.icon} class="w-3.5 h-3.5" />
                  <span>{option.label}</span>
                  <Show when={props.value === option.value}>
                    <Icon name="check" class="w-3 h-3 ml-auto" />
                  </Show>
                </button>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}

interface FileFilterDropdownProps {
  files: string[];
  value: string | null;
  onChange: (filePath: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}

function FileFilterDropdown(props: FileFilterDropdownProps) {
  return (
    <div class="relative">
      <button
        class="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)] transition-colors max-w-[150px]"
        style={{
          color: props.value ? "var(--accent)" : "var(--text-weak)",
        }}
        onClick={props.onToggle}
      >
        <Icon name="file" class="w-3.5 h-3.5 flex-shrink-0" />
        <span class="truncate">
          {props.value ? getFileName(props.value) : "All files"}
        </span>
        <Icon name="chevron-down" class="w-3 h-3 flex-shrink-0" />
      </button>

      <Show when={props.isOpen}>
        <div
          class="absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg z-20 min-w-[200px] max-w-[300px] max-h-[300px] overflow-y-auto"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-weak)",
          }}
        >
          <button
            class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--surface-active)] transition-colors"
            style={{
              color: !props.value ? "var(--accent)" : "var(--text-base)",
            }}
            onClick={() => {
              props.onChange(null);
              props.onToggle();
            }}
          >
            <Icon name="file" class="w-3.5 h-3.5" />
            <span>All files</span>
            <Show when={!props.value}>
              <Icon name="check" class="w-3 h-3 ml-auto" />
            </Show>
          </button>

          <div
            class="my-1 border-t"
            style={{ "border-color": "var(--border-weak)" }}
          />

          <For each={props.files}>
            {(filePath) => (
              <button
                class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--surface-active)] transition-colors"
                style={{
                  color:
                    props.value === filePath
                      ? "var(--accent)"
                      : "var(--text-base)",
                }}
                onClick={() => {
                  props.onChange(filePath);
                  props.onToggle();
                }}
              >
                <span>{getFileIcon(filePath)}</span>
                <span class="truncate flex-1 text-left" title={filePath}>
                  {getFileName(filePath)}
                </span>
                <Show when={props.value === filePath}>
                  <Icon name="check" class="w-3 h-3" />
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface CommentsPanelProps {
  onNavigate?: (filePath: string, lineNumber: number) => void;
  onClose?: () => void;
}

export function CommentsPanel(props: CommentsPanelProps) {
  const comments = useComments();
  const [showFilterDropdown, setShowFilterDropdown] = createSignal(false);
  const [showFileDropdown, setShowFileDropdown] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [expandedThreads, setExpandedThreads] = createSignal<Set<string>>(new Set());

  let panelRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (showFilterDropdown() || showFileDropdown()) {
      const target = e.target as HTMLElement;
      if (!target.closest(".relative")) {
        setShowFilterDropdown(false);
        setShowFileDropdown(false);
      }
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  const allFiles = createMemo(() => {
    const files = new Set<string>();
    for (const thread of comments.state.threads) {
      files.add(thread.filePath);
    }
    return Array.from(files).sort();
  });

  const filteredAndSearchedThreads = createMemo(() => {
    const threads = comments.filteredThreads();
    const query = searchQuery().toLowerCase().trim();

    if (!query) return threads;

    return threads.filter((thread) => {
      // Search in file path
      if (thread.filePath.toLowerCase().includes(query)) return true;

      // Search in comments content
      for (const comment of thread.comments) {
        if (comment.content.toLowerCase().includes(query)) return true;
        if (comment.author.name.toLowerCase().includes(query)) return true;
      }

      // Search in line content
      if (thread.lineContent.toLowerCase().includes(query)) return true;

      return false;
    });
  });

  const groupedThreads = createMemo(() => {
    const threads = filteredAndSearchedThreads();
    const result = new Map<string, CommentThreadType[]>();

    for (const thread of threads) {
      const existing = result.get(thread.filePath);
      if (existing) {
        existing.push(thread);
      } else {
        result.set(thread.filePath, [thread]);
      }
    }

    // Sort threads within each file by line number
    for (const threads of result.values()) {
      threads.sort((a, b) => a.lineNumber - b.lineNumber);
    }

    return result;
  });

  const handleNavigate = (filePath: string, lineNumber: number) => {
    props.onNavigate?.(filePath, lineNumber);
  };

  const handleToggleThread = (threadId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const allThreadIds = filteredAndSearchedThreads().map((t) => t.id);
    setExpandedThreads(new Set(allThreadIds));
  };

  const handleCollapseAll = () => {
    setExpandedThreads(new Set<string>());
  };

  return (
    <div
      ref={panelRef}
      class="h-full flex flex-col overflow-hidden"
      style={{
        background: "var(--background-stronger)",
      }}
    >
      {/* Header */}
      <div
        class="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-center gap-2">
          <Icon name="message" class="w-4 h-4" style={{ color: "var(--accent)" }} />
          <h3 class="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
            Comments
          </h3>
          <Show when={comments.totalCount() > 0}>
            <span
              class="px-1.5 py-0.5 text-[10px] rounded-full"
              style={{
                background: "var(--surface-active)",
                color: "var(--text-base)",
              }}
            >
              {comments.unresolvedCount()}/{comments.totalCount()}
            </span>
          </Show>
        </div>

        <Show when={props.onClose}>
          <button
            class="p-1 rounded hover:bg-[var(--surface-hover)] transition-colors"
            style={{ color: "var(--text-weak)" }}
            onClick={props.onClose}
            title="Close"
          >
            <Icon name="xmark" class="w-4 h-4" />
          </button>
        </Show>
      </div>

      {/* Toolbar */}
      <div
        class="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0"
        style={{ "border-color": "var(--border-weak)" }}
      >
        {/* Search */}
        <div
          class="flex items-center gap-1 flex-1 px-2 py-1 rounded"
          style={{
            background: "var(--surface-base)",
            border: "1px solid var(--border-weak)",
          }}
        >
          <Icon name="magnifying-glass" class="w-3.5 h-3.5" style={{ color: "var(--text-weaker)" }} />
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search comments..."
            class="flex-1 bg-transparent border-none outline-none text-xs"
            style={{ color: "var(--text-base)" }}
          />
          <Show when={searchQuery()}>
            <button
              class="p-0.5 rounded hover:bg-[var(--surface-raised)] transition-colors"
              style={{ color: "var(--text-weaker)" }}
              onClick={() => setSearchQuery("")}
            >
              <Icon name="xmark" class="w-3 h-3" />
            </button>
          </Show>
        </div>

        {/* Filters */}
        <FilterDropdown
          value={comments.state.filter}
          onChange={comments.setFilter}
          isOpen={showFilterDropdown()}
          onToggle={() => setShowFilterDropdown(!showFilterDropdown())}
        />

        <FileFilterDropdown
          files={allFiles()}
          value={comments.state.fileFilter}
          onChange={comments.setFileFilter}
          isOpen={showFileDropdown()}
          onToggle={() => setShowFileDropdown(!showFileDropdown())}
        />
      </div>

      {/* Expand/Collapse Controls */}
      <Show when={filteredAndSearchedThreads().length > 0}>
        <div
          class="flex items-center justify-between px-3 py-1 border-b flex-shrink-0"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <span class="text-[10px]" style={{ color: "var(--text-weaker)" }}>
            {filteredAndSearchedThreads().length} {filteredAndSearchedThreads().length === 1 ? "thread" : "threads"}
            <Show when={searchQuery()}>
              {" "}matching "{searchQuery()}"
            </Show>
          </span>
          <div class="flex items-center gap-2">
            <button
              class="text-[10px] hover:underline"
              style={{ color: "var(--text-weak)" }}
              onClick={handleExpandAll}
            >
              Expand all
            </button>
            <span style={{ color: "var(--text-weaker)" }}>·</span>
            <button
              class="text-[10px] hover:underline"
              style={{ color: "var(--text-weak)" }}
              onClick={handleCollapseAll}
            >
              Collapse all
            </button>
          </div>
        </div>
      </Show>

      {/* Content */}
      <div class="flex-1 overflow-y-auto px-2 py-2">
        <Show
          when={filteredAndSearchedThreads().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center h-full py-12 px-4">
              <Icon
                name="message"
                class="w-12 h-12 mb-4"
                style={{ color: "var(--text-weaker)" }}
              />
              <p
                class="text-sm text-center"
                style={{ color: "var(--text-weak)" }}
              >
                <Show
                  when={comments.totalCount() === 0}
                  fallback={
                    searchQuery()
                      ? `No comments matching "${searchQuery()}"`
                      : comments.state.filter === "resolved"
                        ? "No resolved comments"
                        : comments.state.filter === "unresolved"
                          ? "No unresolved comments"
                          : "No comments in this file"
                  }
                >
                  No comments yet
                </Show>
              </p>
              <p
                class="text-xs text-center mt-1"
                style={{ color: "var(--text-weaker)" }}
              >
                <Show when={comments.totalCount() === 0}>
                  Click on a line in the editor to add a comment
                </Show>
              </p>
            </div>
          }
        >
          <For each={Array.from(groupedThreads().entries())}>
            {([filePath, threads]) => (
              <FileGroup
                filePath={filePath}
                threads={threads}
                onNavigate={handleNavigate}
                expandedThreads={expandedThreads()}
                onToggleThread={handleToggleThread}
              />
            )}
          </For>
        </Show>
      </div>

      {/* Footer Stats */}
      <Show when={comments.totalCount() > 0}>
        <div
          class="flex items-center justify-between px-3 py-2 border-t flex-shrink-0"
          style={{
            "border-color": "var(--border-weak)",
            background: "var(--surface-base)",
          }}
        >
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-weaker)" }}>
              <Icon name="circle-exclamation" class="w-3 h-3" style={{ color: "var(--warning)" }} />
              {comments.unresolvedCount()} unresolved
            </span>
            <span class="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-weaker)" }}>
              <Icon name="check" class="w-3 h-3" style={{ color: "var(--success)" }} />
              {comments.totalCount() - comments.unresolvedCount()} resolved
            </span>
          </div>
          <span class="text-[10px]" style={{ color: "var(--text-weaker)" }}>
            {allFiles().length} {allFiles().length === 1 ? "file" : "files"}
          </span>
        </div>
      </Show>
    </div>
  );
}
