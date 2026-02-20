import {
  createSignal,
  createEffect,
  createMemo,
  Show,
  For,
  onMount,
  onCleanup,
  batch,
  untrack,
} from "solid-js";
import { Icon } from "../ui/Icon";
import { aiLogger } from "../../utils/logger";
import { useLLM } from "@/context/LLMContext";
import { useCommands } from "@/context/CommandContext";
import { useAgentFollow } from "@/context/AgentFollowContext";
import { useSDK } from "@/context/SDKContext";
import { Markdown } from "@/components/Markdown";
import { SubagentsDialog } from "./SubagentsDialog";
import { ThreadList, type Thread as ThreadListThread } from "./ThreadList";
import { AgentActivityFeed } from "./AgentActivityFeed";
import { AgentSkeleton } from "../ui/AgentSkeleton";
import { Button, IconButton, Card, ListItem, Badge, Text, LoadingSpinner } from "@/components/ui";
import { tokens } from "@/design-system/tokens";



// ============================================================================
// Types
// ============================================================================

interface Thread {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: number;
  messageCount: number;
}

interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  attachments?: FileAttachment[];
}

interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
}

interface SubAgent {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "error";
  progress?: number;
  task: string;
  startedAt: number;
}

interface SlashCommand {
  id: string;
  name: string;
  description: string;
  action: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_THREADS = "cortex_agent_threads";
const STORAGE_KEY_ACTIVE = "cortex_agent_active_thread";

// Virtualization constants
const MESSAGE_HEIGHT_ESTIMATE = 120; // Average estimated height per message
const OVERSCAN_COUNT = 5; // Number of items to render outside visible area
const VIRTUALIZATION_THRESHOLD = 30; // Only virtualize when message count exceeds this
const SCROLL_THROTTLE_MS = 16; // ~60fps scroll updates

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a debounced version of a function.
 * The debounced function delays invoking fn until after delay ms have elapsed
 * since the last time the debounced function was invoked.
 */
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T & { flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  
  const debounced = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
      lastArgs = null;
    }, delay);
  }) as T & { flush: () => void };
  
  // Allow immediate execution of pending call
  debounced.flush = () => {
    if (timeoutId !== null && lastArgs !== null) {
      clearTimeout(timeoutId);
      fn(...lastArgs);
      timeoutId = null;
      lastArgs = null;
    }
  };
  
  return debounced;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// ============================================================================
// AgentPanelHeader Component
// ============================================================================

interface AgentPanelHeaderProps {
  showThreadList: boolean;
  onToggleThreadList: () => void;
  onNewThread: () => void;
  onOpenSettings: () => void;
}

function AgentPanelHeader(props: AgentPanelHeaderProps) {
  const llm = useLLM();
  
  // Try to use AgentFollow context - it may not be available yet
  let agentFollow: ReturnType<typeof useAgentFollow> | null = null;
  try {
    agentFollow = useAgentFollow();
  } catch {
    // AgentFollowProvider not available yet, that's ok
  }
  
  const [showModelDropdown, setShowModelDropdown] = createSignal(false);

  const activeModel = createMemo(() => llm.getActiveModel());
  const isFollowing = createMemo(() => agentFollow?.state.isFollowing ?? false);

  const handleModelSelect = (modelId: string, provider: string) => {
    // Provider type is validated by setActiveModel internally
    // Cast to the expected type - the provider string comes from the model list
    llm.setActiveModel(modelId, provider as Parameters<typeof llm.setActiveModel>[1]);
    setShowModelDropdown(false);
  };

  return (
    <Card
      variant="flat"
      padding="none"
      class="flex items-center justify-between h-12 px-3 border-b flex-shrink-0"
      style={{
        background: tokens.colors.surface.panel,
        "border-color": tokens.colors.border.divider,
        "border-radius": "0",
      }}
    >
      {/* Left: Thread toggle + Model selector */}
      <div class="flex items-center gap-2">
        <IconButton
          onClick={props.onToggleThreadList}
          active={props.showThreadList}
          tooltip="Toggle thread history"
        >
          <Icon name="bars" class="w-4 h-4" />
        </IconButton>

        {/* Model Selector Dropdown */}
        <div class="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowModelDropdown(!showModelDropdown())}
            style={{
              background: showModelDropdown()
                ? tokens.colors.interactive.hover
                : "transparent",
              color: tokens.colors.text.primary,
              "font-size": "var(--jb-text-body-size)",
            }}
            icon={<Icon name="microchip" class="w-3.5 h-3.5" style={{ color: tokens.colors.semantic.primary }} />}
iconRight={
              <Icon
                name="chevron-down"
                class="w-3.5 h-3.5 transition-transform"
                style={{
                  transform: showModelDropdown() ? "rotate(180deg)" : "none",
                  color: tokens.colors.text.muted,
                }}
              />
            }
          >
            <span class="max-w-[120px] truncate">
              {activeModel()?.name || "Select Model"}
            </span>
          </Button>

          <Show when={showModelDropdown()}>
            <Card
              variant="elevated"
              padding="none"
              class="absolute left-0 top-full mt-1 z-50 w-56"
              style={{
                border: `1px solid ${tokens.colors.border.default}`,
              }}
            >
              <div class="max-h-64 overflow-y-auto py-1">
                <For each={llm.getAllModels()}>
                  {(model) => {
                    const isSelected = () =>
                      model.id === activeModel()?.id &&
                      model.provider === llm.state.activeProviderType;
                    return (
                      <ListItem
                        onClick={() =>
                          handleModelSelect(model.id, model.provider)
                        }
                        selected={isSelected()}
                        label={model.name}
iconRight={isSelected() ? (
                          <Icon
                            name="check"
                            class="w-4 h-4 flex-shrink-0"
                            style={{ color: tokens.colors.semantic.primary }}
                          />
                        ) : undefined}
                        style={{
                          "font-size": "var(--jb-text-body-size)",
                        }}
                      />
                    );
                  }}
                </For>
              </div>
            </Card>

            {/* Click outside to close */}
            <div
              class="fixed inset-0 z-40"
              onClick={() => setShowModelDropdown(false)}
            />
          </Show>
        </div>
      </div>

      {/* Right: Follow toggle + New thread + Settings */}
      <div class="flex items-center gap-1">
        {/* Follow Agent Toggle */}
        <Show when={agentFollow}>
          <div class="relative">
            <IconButton
              onClick={() => agentFollow?.toggleFollowing()}
              active={isFollowing()}
              tooltip={isFollowing() 
                ? "Following agent (Ctrl+Shift+F to disable)" 
                : "Follow agent navigation (Ctrl+Shift+F)"
              }
            >
<Show when={isFollowing()} fallback={<Icon name="eye-slash" class="w-4 h-4" />}>
                <Icon name="eye" class="w-4 h-4" />
              </Show>
            </IconButton>
            {/* Pulsing indicator when following */}
            <Show when={isFollowing()}>
              <span 
                class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                style={{
                  background: tokens.colors.semantic.primary,
                  animation: "pulse 2s infinite",
                }}
              />
            </Show>
          </div>
        </Show>

        <IconButton
          onClick={props.onNewThread}
          tooltip="New thread (Ctrl+N)"
        >
          <Icon name="plus" class="w-4 h-4" />
        </IconButton>

        <IconButton
          onClick={props.onOpenSettings}
          tooltip="Settings"
        >
          <Icon name="gear" class="w-4 h-4" />
        </IconButton>
      </div>
    </Card>
  );
}

// ============================================================================
// MessageList Component (Virtualized for performance)
// ============================================================================

interface MessageListProps {
  messages: AgentMessage[];
  isLoading: boolean;
  streamingContent: string;
}

// Memoized message heights store - persists across re-renders with LRU eviction
const messageHeightsStore = new Map<string, number>();

/**
 * Clears the message heights store.
 * Call this when switching threads or when memory needs to be freed.
 */
export function clearMessageHeightsStore(): void {
  messageHeightsStore.clear();
}



function MessageList(props: MessageListProps) {
  let containerRef: HTMLDivElement | undefined;
  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const [scrollTop, setScrollTop] = createSignal(0);
  const [containerHeight, setContainerHeight] = createSignal(500);
  let scrollRAF: number | null = null;
  let lastScrollTime = 0;
  
  // Determine if we should use virtualization - memoized to prevent recalculation
  const shouldVirtualize = createMemo(() => props.messages.length > VIRTUALIZATION_THRESHOLD);
  
  // Memoize message count to avoid recalculating in effects
  const messageCount = createMemo(() => props.messages.length);
  
  // Calculate cumulative heights for efficient offset calculation
  const cumulativeHeights = createMemo(() => {
    const messages = props.messages;
    const heights: number[] = [];
    let cumulative = 0;
    
    for (let i = 0; i < messages.length; i++) {
      heights.push(cumulative);
      cumulative += messageHeightsStore.get(messages[i].id) || MESSAGE_HEIGHT_ESTIMATE;
    }
    heights.push(cumulative); // Total height at end
    
    return heights;
  });
  
  // Calculate visible range for virtualization using binary search
  const visibleRange = createMemo(() => {
    const msgCount = messageCount();
    if (!shouldVirtualize() || msgCount === 0) {
      return { start: 0, end: msgCount };
    }
    
    const scrollPosition = scrollTop();
    const height = containerHeight();
    const heights = cumulativeHeights();
    
    // Binary search for start index
    let low = 0;
    let high = msgCount - 1;
    let startIndex = 0;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (heights[mid] < scrollPosition) {
        startIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    
    // Binary search for end index
    const endScrollPosition = scrollPosition + height;
    low = startIndex;
    high = msgCount;
    let endIndex = msgCount;
    
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (heights[mid] <= endScrollPosition) {
        low = mid + 1;
      } else {
        endIndex = mid;
        high = mid;
      }
    }
    
    // Apply overscan
    startIndex = Math.max(0, startIndex - OVERSCAN_COUNT);
    endIndex = Math.min(msgCount, endIndex + OVERSCAN_COUNT);
    
    return { start: startIndex, end: endIndex };
  });
  
  // Get visible messages subset - memoized slice
  const visibleMessages = createMemo(() => {
    const range = visibleRange();
    return props.messages.slice(range.start, range.end);
  });
  
  // Calculate total height for scroll container
  const totalHeight = createMemo(() => {
    if (!shouldVirtualize()) return "auto";
    const heights = cumulativeHeights();
    return `${heights[heights.length - 1] || 0}px`;
  });
  
  // Calculate offset for virtualized content
  const offsetTop = createMemo(() => {
    if (!shouldVirtualize()) return 0;
    const heights = cumulativeHeights();
    return heights[visibleRange().start] || 0;
  });

  // Throttled scroll handler using RAF
  const handleScroll = () => {
    const now = performance.now();
    if (scrollRAF || now - lastScrollTime < SCROLL_THROTTLE_MS) return;
    
    scrollRAF = requestAnimationFrame(() => {
      if (containerRef) {
        setScrollTop(containerRef.scrollTop);
        lastScrollTime = performance.now();
      }
      scrollRAF = null;
    });
  };
  
  // Track container size with ResizeObserver
  onMount(() => {
    if (!containerRef) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    
    resizeObserver.observe(containerRef);
    onCleanup(() => {
      resizeObserver.disconnect();
      if (scrollRAF) cancelAnimationFrame(scrollRAF);
    });
  });

  // Auto-scroll to bottom - optimized with untracked access
  let userScrolledUp = false;
  let lastMsgCount = 0;
  
  createEffect(() => {
    const currentCount = messageCount();
    
    // Determine if we should auto-scroll
    const shouldAutoScroll = !userScrolledUp || currentCount > lastMsgCount;
    lastMsgCount = currentCount;
    
    if (containerRef && shouldAutoScroll) {
      untrack(() => {
        requestAnimationFrame(() => {
          if (containerRef) {
            containerRef.scrollTop = containerRef.scrollHeight;
          }
        });
      });
    }
  });
  
  // Track user scroll position to determine if they scrolled up
  const handleUserScroll = () => {
    handleScroll();
    if (containerRef) {
      const isAtBottom = containerRef.scrollHeight - containerRef.scrollTop - containerRef.clientHeight < 50;
      userScrolledUp = !isAtBottom;
    }
  };

  const handleCopy = async (message: AgentMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = message.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div
      ref={containerRef}
      class="flex-1 overflow-y-auto"
      style={{ 
        background: "inherit",
        padding: "16px 20px 16px 16px",
        "will-change": shouldVirtualize() ? "scroll-position" : "auto",
        "contain": shouldVirtualize() ? "strict" : "none",
      }}
      onScroll={handleUserScroll}
    >
      <Show
        when={messageCount() > 0 || props.streamingContent}
        fallback={
          <div class="flex flex-col items-center justify-center h-full">
<Icon
              name="message"
              class="w-12 h-12 mb-3"
              style={{ color: tokens.colors.text.muted, opacity: 0.3 }}
            />
            <Text variant="body" style={{ "margin-bottom": "4px" }}>
              Start a conversation
            </Text>
            <Text variant="muted" align="center">
              Ask questions, get code help, or explore ideas
            </Text>
          </div>
        }
      >
        {/* Virtualized container */}
        <div 
          class="space-y-6"
          style={{
            ...(shouldVirtualize() ? {
              height: totalHeight(),
              position: "relative",
              contain: "layout style",
            } : {}),
          }}
        >
          {/* Virtualization offset spacer */}
          <Show when={shouldVirtualize() && offsetTop() > 0}>
            <div style={{ height: `${offsetTop()}px`, "flex-shrink": "0" }} aria-hidden="true" />
          </Show>
          
          {/* Use For with keyed items for optimal updates */}
          <For each={visibleMessages()}>
            {(msg) => (
              <MessageBubble
                message={msg}
                isCopied={copiedId() === msg.id}
                onCopy={() => handleCopy(msg)}
              />
            )}
          </For>

          {/* Streaming response - isolated from message list */}
          <StreamingMessage
            isLoading={props.isLoading}
            content={props.streamingContent}
          />
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// StreamingMessage Component (Isolated for performance)
// ============================================================================

interface StreamingMessageProps {
  isLoading: boolean;
  content: string;
}

function StreamingMessage(props: StreamingMessageProps) {
  // Memoize the streaming indicator to prevent re-renders when content changes
  const showStreaming = createMemo(() => props.isLoading && props.content);
  const showThinking = createMemo(() => props.isLoading && !props.content);
  
  return (
    <>
      {/* Streaming response - JetBrains styling */}
      <Show when={showStreaming()}>
        <div class="interactive-item-container interactive-response chat-response-loading flex gap-3">
          <div
            class="message-avatar message-avatar-assistant flex-shrink-0 rounded-full flex items-center justify-center"
            style={{
              width: "24px",
              height: "24px",
              background: tokens.colors.semantic.primary,
              outline: `1px solid ${tokens.colors.border.default}`,
            }}
          >
            <Icon name="microchip" class="w-3.5 h-3.5" style={{ color: tokens.colors.surface.panel }} />
          </div>
          <div class="flex-1 min-w-0">
            <div class="message-header flex items-center gap-2 mb-2">
              <Text variant="body" weight="semibold" style={{ color: tokens.colors.semantic.primary }}>
                Assistant
              </Text>
              <span
                class="flex items-center gap-1"
                style={{ color: tokens.colors.text.muted, "font-size": "var(--jb-text-muted-size)" }}
              >
                <LoadingSpinner size="sm" />
                <span class="chat-animated-ellipsis">generating</span>
              </span>
            </div>
            <Card
              variant="outlined"
              padding="md"
              style={{
                background: tokens.colors.surface.canvas,
                "border-color": tokens.colors.border.default,
                "border-radius": tokens.radius.sm,
                "max-width": "calc(100% - 16px)",
                "margin-right": tokens.spacing.md,
              }}
            >
              <div class="markdown-content" style={{ color: tokens.colors.text.primary, "padding-right": tokens.spacing.md }}>
                <StreamingMarkdown content={props.content} />
              </div>
            </Card>
          </div>
        </div>
      </Show>

      {/* Loading indicator without content - JetBrains pulse animation */}
      <Show when={showThinking()}>
        <div class="interactive-item-container interactive-response chat-response-loading flex gap-3">
          <div
            class="message-avatar message-avatar-assistant flex-shrink-0 rounded-full flex items-center justify-center"
            style={{
              width: "24px",
              height: "24px",
              background: tokens.colors.semantic.primary,
              outline: `1px solid ${tokens.colors.border.default}`,
            }}
          >
            <Icon name="microchip" class="w-3.5 h-3.5" style={{ color: tokens.colors.surface.panel }} />
          </div>
          <div class="flex-1 min-w-0">
            <div class="message-header flex items-center gap-2 mb-2">
              <Text variant="body" weight="semibold" style={{ color: tokens.colors.semantic.primary }}>
                Assistant
              </Text>
            </div>
            <Card
              variant="outlined"
              padding="md"
              style={{
                background: tokens.colors.surface.canvas,
                "border-color": tokens.colors.border.default,
                "border-radius": tokens.radius.sm,
                "max-width": "calc(100% - 16px)",
                "margin-right": tokens.spacing.md,
              }}
            >
              <div class="progress-container flex items-center gap-2">
                <div class="flex gap-1">
                  <span
                    class="w-1.5 h-1.5 rounded-full pulse-opacity"
                    style={{
                      background: tokens.colors.text.muted,
                      "animation-delay": "0ms",
                    }}
                  />
                  <span
                    class="w-1.5 h-1.5 rounded-full pulse-opacity"
                    style={{
                      background: tokens.colors.text.muted,
                      "animation-delay": "150ms",
                    }}
                  />
                  <span
                    class="w-1.5 h-1.5 rounded-full pulse-opacity"
                    style={{
                      background: tokens.colors.text.muted,
                      "animation-delay": "300ms",
                    }}
                  />
                </div>
                <Text variant="muted">
                  thinking<span class="chat-animated-ellipsis"></span>
                </Text>
              </div>
            </Card>
          </div>
        </div>
      </Show>
    </>
  );
}

// ============================================================================
// StreamingMarkdown Component (Throttled updates for performance)
// ============================================================================

interface StreamingMarkdownProps {
  content: string;
}

function StreamingMarkdown(props: StreamingMarkdownProps) {
  const [throttledContent, setThrottledContent] = createSignal(props.content);
  let lastUpdate = 0;
  let pendingUpdate: number | null = null;
  
  // Throttle markdown updates during streaming to reduce rendering load
  // Update at most every 50ms (20 fps) during active streaming
  createEffect(() => {
    const content = props.content;
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdate;
    
    if (timeSinceLastUpdate >= 50) {
      // Enough time has passed, update immediately
      setThrottledContent(content);
      lastUpdate = now;
    } else if (!pendingUpdate) {
      // Schedule an update for later
      pendingUpdate = window.setTimeout(() => {
        setThrottledContent(props.content);
        lastUpdate = Date.now();
        pendingUpdate = null;
      }, 50 - timeSinceLastUpdate);
    }
  });
  
  onCleanup(() => {
    if (pendingUpdate) {
      clearTimeout(pendingUpdate);
    }
  });
  
  return <Markdown content={throttledContent()} />;
}

// ============================================================================
// MessageBubble Component
// ============================================================================

interface MessageBubbleProps {
  message: AgentMessage;
  isCopied: boolean;
  onCopy: () => void;
}

function MessageBubble(props: MessageBubbleProps) {
  const [hovered, setHovered] = createSignal(false);
  const isUser = () => props.message.role === "user";

  return (
    <div
      class="interactive-item-container flex gap-3"
      classList={{
        "interactive-request": isUser(),
        "interactive-response": !isUser(),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar - JetBrains 24px standard */}
      <div
        class="message-avatar flex-shrink-0 rounded-full flex items-center justify-center"
        classList={{
          "message-avatar-user": isUser(),
          "message-avatar-assistant": !isUser(),
        }}
        style={{
          width: "24px",
          height: "24px",
          background: isUser()
            ? "transparent"
            : tokens.colors.semantic.primary,
          outline: `1px solid ${tokens.colors.border.default}`,
        }}
      >
        <Show when={isUser()} fallback={<Icon name="microchip" class="w-3.5 h-3.5" style={{ color: tokens.colors.surface.panel }} />}>
          <Icon name="user" class="w-3.5 h-3.5" style={{ color: tokens.colors.text.muted }} />
        </Show>
      </div>

      {/* Content */}
      <div class="flex-1 min-w-0">
        {/* Header - JetBrains message header styling */}
        <div class="message-header flex items-center gap-2 mb-2">
          <Text
            variant="body"
            weight="semibold"
            style={{ 
              color: isUser() ? tokens.colors.text.primary : tokens.colors.semantic.primary,
            }}
          >
            {isUser() ? "You" : "Assistant"}
          </Text>
          <Text variant="muted">
            {formatTime(props.message.timestamp)}
          </Text>

          {/* Copy button */}
          <div
            class="ml-auto transition-opacity duration-150"
            style={{ opacity: hovered() ? 1 : 0 }}
          >
            <IconButton
              onClick={props.onCopy}
              size="sm"
              tooltip={props.isCopied ? "Copied!" : "Copy message"}
              style={{
                color: props.isCopied ? tokens.colors.semantic.success : tokens.colors.text.muted,
              }}
            >
<Show
                when={props.isCopied}
                fallback={<Icon name="copy" class="w-3.5 h-3.5" />}
              >
                <Icon name="check" class="w-3.5 h-3.5" />
              </Show>
            </IconButton>
          </div>
        </div>

        {/* Message bubble - JetBrains request/response bubble styling */}
        <Card
          variant="outlined"
          padding="md"
          style={{
            background: isUser() ? tokens.colors.interactive.hover : tokens.colors.surface.canvas,
            "border-color": tokens.colors.border.default,
            "border-radius": isUser() ? tokens.radius.md : tokens.radius.sm,
            "max-width": isUser() ? "85%" : "calc(100% - 16px)", /* Leave space on right */
            "margin-left": isUser() ? "auto" : "0",
            "margin-right": isUser() ? "0" : tokens.spacing.md, /* Extra right margin for assistant messages */
          }}
        >
          {/* Attachments */}
          <Show when={props.message.attachments?.length}>
            <div class="flex flex-wrap gap-2 mb-2">
              <For each={props.message.attachments}>
                {(attachment) => (
                  <Badge variant="default">
                    <span class="inline-flex items-center gap-1">
                      <Icon name="paperclip" class="w-3 h-3" />
                      {attachment.name}
                    </span>
                  </Badge>
                )}
              </For>
            </div>
          </Show>

          {/* Content */}
          <div class="prose" style={{ color: tokens.colors.text.primary }}>
            <Markdown content={props.message.content} />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// SubAgentStatus Component
// ============================================================================

interface SubAgentStatusProps {
  agents: SubAgent[];
  onCancel: (id: string) => void;
}

function SubAgentStatus(props: SubAgentStatusProps) {
  const [expanded, setExpanded] = createSignal(true);

  const activeCount = createMemo(
    () => props.agents.filter((a) => a.status === "running").length
  );
  const completedCount = createMemo(
    () => props.agents.filter((a) => a.status === "completed").length
  );

  const getStatusIcon = (status: SubAgent["status"]) => {
    switch (status) {
      case "pending":
        return (
          <Icon name="circle" class="w-3 h-3" style={{ color: tokens.colors.text.muted }} />
        );
      case "running":
        return (
          <LoadingSpinner size="sm" color={tokens.colors.semantic.warning} />
        );
      case "completed":
        return (
          <Icon name="circle-check" class="w-3 h-3" style={{ color: tokens.colors.semantic.success }} />
        );
      case "error":
        return (
          <Icon name="circle-exclamation" class="w-3 h-3" style={{ color: tokens.colors.semantic.error }} />
        );
    }
  };

  return (
    <div
      class="border-t mx-4 mb-2"
      style={{ "border-color": tokens.colors.border.divider }}
    >
      {/* Header */}
      <Button
        variant="ghost"
        onClick={() => setExpanded(!expanded())}
        class="flex items-center justify-between w-full py-2"
        style={{ 
          color: tokens.colors.text.primary,
          background: "transparent",
          "border-radius": tokens.radius.sm,
        }}
iconRight={
          expanded() ? (
            <Icon name="chevron-down" class="w-4 h-4" style={{ color: tokens.colors.text.muted }} />
          ) : (
            <Icon name="chevron-right" class="w-4 h-4" style={{ color: tokens.colors.text.muted }} />
          )
        }
      >
        <div class="flex items-center gap-2">
          <Icon name="wave-pulse" class="w-4 h-4" style={{ color: tokens.colors.semantic.primary }} />
          <Text variant="body" weight="medium" size="sm">Sub-agents</Text>
          <Badge variant="default">
            {activeCount()} running, {completedCount()} done
          </Badge>
        </div>
      </Button>

      {/* Agent list */}
      <Show when={expanded()}>
        <div class="pb-2 space-y-1">
          <For each={props.agents}>
            {(agent) => (
              <div
                class="flex items-center gap-2 px-2 py-1.5 rounded"
                style={{ 
                  background: tokens.colors.surface.panel,
                  "font-size": "var(--jb-text-muted-size)",
                }}
              >
                {getStatusIcon(agent.status)}
                <Text variant="body" weight="medium" style={{ "flex-shrink": "0" }}>
                  {agent.name}
                </Text>
                <Text variant="muted" truncate style={{ flex: "1" }}>
                  {agent.task}
                </Text>
                <Show when={agent.status === "running"}>
                  <IconButton
                    size="sm"
                    onClick={() => props.onCancel(agent.id)}
                    tooltip="Cancel"
                    style={{ color: tokens.colors.text.muted }}
                  >
                    <Icon name="xmark" class="w-3 h-3" />
                  </IconButton>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// MessageInput Component
// ============================================================================

interface MessageInputProps {
  onSend: (message: string, attachments?: File[]) => void;
  onSlashCommand: (command: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

function MessageInput(props: MessageInputProps) {
  const [input, setInput] = createSignal("");
  const [attachments, setAttachments] = createSignal<File[]>([]);
  const [showSlashMenu, setShowSlashMenu] = createSignal(false);
  const [slashFilter, setSlashFilter] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [isDragging, setIsDragging] = createSignal(false);
  let textareaRef: HTMLTextAreaElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  const slashCommands: SlashCommand[] = [
    {
      id: "plan",
      name: "/plan",
      description: "Create a comprehensive plan",
      action: () => props.onSlashCommand("plan"),
    },
    {
      id: "code",
      name: "/code",
      description: "Generate code implementation",
      action: () => props.onSlashCommand("code"),
    },
    {
      id: "explain",
      name: "/explain",
      description: "Explain code or concept",
      action: () => props.onSlashCommand("explain"),
    },
    {
      id: "fix",
      name: "/fix",
      description: "Fix bugs or issues",
      action: () => props.onSlashCommand("fix"),
    },
    {
      id: "test",
      name: "/test",
      description: "Generate tests",
      action: () => props.onSlashCommand("test"),
    },
    {
      id: "subagents",
      name: "/subagents",
      description: "Manage and spawn sub-agents",
      action: () => props.onSlashCommand("subagents"),
    },
    {
      id: "fork",
      name: "/fork",
      description: "Fork the conversation",
      action: () => props.onSlashCommand("fork"),
    },
    {
      id: "clear",
      name: "/clear",
      description: "Clear conversation",
      action: () => props.onSlashCommand("clear"),
    },
    {
      id: "new",
      name: "/new",
      description: "Start a new thread",
      action: () => props.onSlashCommand("new"),
    },
    {
      id: "search",
      name: "/search",
      description: "Search code in workspace",
      action: () => props.onSlashCommand("search"),
    },
  ];

  const filteredCommands = createMemo(() => {
    const filter = slashFilter().toLowerCase();
    if (!filter) return slashCommands;
    return slashCommands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(filter) ||
        cmd.description.toLowerCase().includes(filter)
    );
  });

  createEffect(() => {
    filteredCommands();
    setSelectedIndex(0);
  });

  const adjustTextareaHeight = () => {
    if (textareaRef) {
      textareaRef.style.height = "auto";
      textareaRef.style.height = Math.min(textareaRef.scrollHeight, 160) + "px";
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    adjustTextareaHeight();

    // Check for slash command
    if (value.startsWith("/")) {
      const match = value.match(/^\/(\S*)$/);
      if (match) {
        setSlashFilter(match[1]);
        setShowSlashMenu(true);
      } else {
        setShowSlashMenu(false);
      }
    } else {
      setShowSlashMenu(false);
      setSlashFilter("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (showSlashMenu()) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands().length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const cmd = filteredCommands()[selectedIndex()];
        if (cmd) {
          cmd.action();
          setInput("");
          setShowSlashMenu(false);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSlashMenu(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const text = input().trim();
    if (!text || props.isLoading) return;

    props.onSend(text, attachments().length > 0 ? attachments() : undefined);
    setInput("");
    setAttachments([]);
    if (textareaRef) {
      textareaRef.style.height = "auto";
    }
  };

  const handleFileSelect = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      setAttachments((prev) => [...prev, ...Array.from(target.files!)]);
    }
    target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const selectCommand = (cmd: SlashCommand) => {
    cmd.action();
    setInput("");
    setShowSlashMenu(false);
    textareaRef?.focus();
  };

  // Drag and drop handlers for file attachments
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const relatedTarget = e.relatedTarget as Node | null;
    if (!containerRef?.contains(relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer!.dropEffect = "copy";
    setIsDragging(true);
  };

  /** Extended File interface that includes path from Tauri/FileExplorer */
  interface FileWithPath extends File {
    path?: string;
  }

  /** Creates a File object with an attached path property */
  const createFileWithPath = (name: string, filePath: string): FileWithPath => {
    const file = new File([], name, { type: "application/octet-stream" }) as FileWithPath;
    file.path = filePath;
    return file;
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // 1. Try specialized Cortex paths first (from FileExplorer)
    const cortexData = e.dataTransfer?.getData("application/x-cortex-paths");
    if (cortexData) {
      try {
        const parsed = JSON.parse(cortexData);
        if (Array.isArray(parsed)) {
          for (const path of parsed) {
            if (typeof path === "string") {
              const name = path.split(/[\\/]/).pop() || "file";
              setAttachments((prev) => [...prev, createFileWithPath(name, path)]);
            }
          }
          return;
        }
      } catch {
        // Failed to parse, continue to next method
      }
    }

    // 2. Try text/plain JSON (fallback for FileExplorer)
    const textData = e.dataTransfer?.getData("text/plain");
    if (textData) {
      try {
        const parsed = JSON.parse(textData);
        if (Array.isArray(parsed)) {
          for (const path of parsed) {
            if (typeof path === "string") {
              const name = path.split(/[\\/]/).pop() || "file";
              setAttachments((prev) => [...prev, createFileWithPath(name, path)]);
            }
          }
          return;
        }
      } catch {
        // Not JSON, might be a single path
        if (textData.includes("/") || textData.includes("\\")) {
          const name = textData.split(/[\\/]/).pop() || "file";
          setAttachments((prev) => [...prev, createFileWithPath(name, textData)]);
          return;
        }
      }
    }

    // 3. Handle external files from OS
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      setAttachments((prev) => [...prev, ...Array.from(e.dataTransfer!.files)]);
    }
  };

  return (
    <div
      ref={containerRef}
      class="border-t px-4 py-3 relative"
      style={{
        background: isDragging() ? tokens.colors.interactive.hover : tokens.colors.surface.panel,
        "border-color": isDragging() ? tokens.colors.semantic.primary : tokens.colors.border.divider,
        transition: "background 0.15s, border-color 0.15s",
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <Show when={isDragging()}>
        <div
          class="absolute inset-0 z-40 rounded-lg flex items-center justify-center pointer-events-none"
          style={{
            background: `color-mix(in srgb, ${tokens.colors.semantic.primary} 10%, transparent)`,
            border: `2px dashed ${tokens.colors.semantic.primary}`,
          }}
        >
          <div class="flex flex-col items-center gap-2">
            <Icon name="paperclip" class="w-6 h-6" style={{ color: tokens.colors.semantic.primary }} />
            <Text variant="body" weight="medium" style={{ color: tokens.colors.semantic.primary }}>
              Drop files to attach
            </Text>
          </div>
        </div>
      </Show>

      {/* Slash command menu */}
      <Show when={showSlashMenu() && filteredCommands().length > 0}>
        <Card
          variant="elevated"
          padding="none"
          class="mb-2"
          style={{
            border: `1px solid ${tokens.colors.border.default}`,
          }}
        >
          <div class="py-1">
            <For each={filteredCommands()}>
              {(cmd, index) => (
                <ListItem
                  onClick={() => selectCommand(cmd)}
                  selected={index() === selectedIndex()}
                  icon={
<Icon
                      name="slash"
                      class="w-4 h-4 flex-shrink-0"
                      style={{ color: tokens.colors.semantic.primary }}
                    />
                  }
                  label={cmd.name}
                  description={cmd.description}
                  style={{
                    "font-size": "var(--jb-text-body-size)",
                  }}
                />
              )}
            </For>
          </div>
        </Card>
      </Show>

      {/* Attachments preview */}
      <Show when={attachments().length > 0}>
        <div class="flex flex-wrap gap-2 mb-2">
          <For each={attachments()}>
            {(file, index) => (
              <Badge variant="default">
                <span class="flex items-center gap-1.5">
                  <Icon name="paperclip" class="w-3 h-3" />
                  <span class="max-w-[120px] truncate">{file.name}</span>
                  <IconButton
                    size="sm"
                    onClick={() => removeAttachment(index())}
                    style={{ 
                      color: tokens.colors.text.muted,
                      width: "14px",
                      height: "14px",
                    }}
                  >
                    <Icon name="xmark" class="w-3 h-3" />
                  </IconButton>
                </span>
              </Badge>
            )}
          </For>
        </div>
      </Show>

      {/* Input area */}
      <div
        class="flex items-end gap-2 rounded-lg px-3 py-2"
        style={{ background: tokens.colors.interactive.hover }}
      >
        {/* File attachment */}
        <IconButton
          onClick={() => fileInputRef?.click()}
          tooltip="Attach file"
          disabled={props.disabled}
        >
          <Icon name="paperclip" class="w-4 h-4" />
        </IconButton>
        <input
          ref={fileInputRef}
          type="file"
          class="hidden"
          multiple
          onChange={handleFileSelect}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          placeholder="Ask anything... (/ for commands)"
          class="flex-1 bg-transparent outline-none resize-none"
          style={{
            color: tokens.colors.text.primary,
            "font-size": "var(--jb-text-body-size)",
            "min-height": "24px",
            "max-height": "160px",
          }}
          value={input()}
          onInput={(e) => handleInputChange(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          disabled={props.isLoading || props.disabled}
          rows={1}
        />

        {/* Send button */}
        <Button
          variant="primary"
          size="sm"
          onClick={handleSend}
          disabled={props.isLoading || !input().trim()}
          loading={props.isLoading}
          icon={!props.isLoading ? <Icon name="paper-plane" class="w-3.5 h-3.5" /> : undefined}
          style={{
            padding: "6px",
            "min-width": "28px",
          }}
        />
      </div>

      {/* Keyboard hint */}
      <div
        class="flex items-center justify-between mt-2"
        style={{ "font-size": "var(--jb-text-muted-size)", color: tokens.colors.text.muted }}
      >
        <span>
          <kbd
            class="px-1 py-0.5 rounded"
            style={{ background: tokens.colors.interactive.hover }}
          >
            /
          </kbd>{" "}
          commands
        </span>
        <span>
          <kbd
            class="px-1 py-0.5 rounded"
            style={{ background: tokens.colors.interactive.hover }}
          >
            Enter
          </kbd>{" "}
          send ·{" "}
          <kbd
            class="px-1 py-0.5 rounded"
            style={{ background: tokens.colors.interactive.hover }}
          >
            Shift+Enter
          </kbd>{" "}
          new line
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Main AgentPanel Component
// ============================================================================

export function AgentPanel() {
  const commands = useCommands();
  const sdk = useSDK();

  // State
  const [showThreadList, setShowThreadList] = createSignal(true);
  const [threads, setThreads] = createSignal<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = createSignal<string | null>(null);
  const [messages, setMessages] = createSignal<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isInitialLoading, setIsInitialLoading] = createSignal(true);
  const [streamingContent, setStreamingContent] = createSignal("");
  const [activeAgents, setActiveAgents] = createSignal<SubAgent[]>([]);
  const [showSubagentsDialog, setShowSubagentsDialog] = createSignal(false);

  // Load persisted data
  onMount(() => {
    const storedThreads = localStorage.getItem(STORAGE_KEY_THREADS);
    if (storedThreads) {
      try {
        setThreads(JSON.parse(storedThreads));
      } catch {
        // Ignore parse errors
      }
    }

    const storedActive = localStorage.getItem(STORAGE_KEY_ACTIVE);
    if (storedActive) {
      setActiveThreadId(storedActive);
      loadThreadMessages(storedActive);
    }
    
    // Simulate initial loading
    setTimeout(() => setIsInitialLoading(false), 600);

    // Listen for subagents dialog event
    const handleSubagentsEvent = () => {
      setShowSubagentsDialog(true);
    };
    window.addEventListener("ai:subagents", handleSubagentsEvent);
    onCleanup(() => window.removeEventListener("ai:subagents", handleSubagentsEvent));
  });

  // Debounced thread persistence to avoid expensive JSON.stringify on every change
  const persistThreadsDebounced = debounce((threadsToSave: Thread[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(threadsToSave));
    } catch (e) {
      console.error("Failed to persist threads:", e);
    }
  }, 1000); // 1 second debounce

  // Persist threads with debounce
  createEffect(() => {
    const currentThreads = threads();
    if (currentThreads.length > 0) {
      persistThreadsDebounced(currentThreads);
    }
  });

  // Force persist on unmount to avoid data loss
  onCleanup(() => {
    persistThreadsDebounced.flush();
  });

  // Persist active thread
  createEffect(() => {
    const active = activeThreadId();
    if (active) {
      localStorage.setItem(STORAGE_KEY_ACTIVE, active);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE);
    }
  });

  // Sync with SDK state for streaming and messages
  createEffect(() => {
    // Update loading state from SDK
    setIsLoading(sdk.state.isStreaming);
  });

  createEffect(() => {
    // Update streaming content from SDK
    // Note: streamingContent is handled via the isStreaming flag and messages
    // The streaming text is assembled from message parts in real-time
  });

  createEffect(() => {
    // Sync messages from SDK when a new message arrives
    const sdkMessages = sdk.state.messages;
    if (sdkMessages.length > 0) {
      const lastMsg = sdkMessages[sdkMessages.length - 1];
      // Convert SDK message to AgentMessage format
      if (lastMsg.role === "assistant" && !sdk.state.isStreaming) {
        // Extract text content from message parts
        const textContent = lastMsg.parts
          .filter((p): p is { type: "text"; content: string } => p.type === "text")
          .map(p => p.content)
          .join("");
        
        const assistantMessage: AgentMessage = {
          id: lastMsg.id || generateId(),
          role: "assistant",
          content: textContent,
          timestamp: lastMsg.timestamp || Date.now(),
        };
        
        // Check if we already have this message
        const existingIds = messages().map(m => m.id);
        if (!existingIds.includes(assistantMessage.id)) {
          setMessages((prev) => [...prev, assistantMessage]);
          
          // Save messages
          const threadId = activeThreadId();
          if (threadId) {
            const currentMessages = [...messages(), assistantMessage];
            saveThreadMessages(threadId, currentMessages.slice(-100));
          }
        }
      }
    }
  });

  // Register keyboard shortcuts
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N for new thread
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewThread();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  // Register commands
  onMount(() => {
    commands.registerCommand({
      id: "agent-panel:new-thread",
      label: "Agent: New Thread",
      shortcut: "Ctrl+N",
      category: "AI",
      action: handleNewThread,
    });

    onCleanup(() => commands.unregisterCommand("agent-panel:new-thread"));
  });

  // ============================================================================
  // Actions
  // ============================================================================

  const loadThreadMessages = (threadId: string) => {
    const key = `cortex_agent_thread_${threadId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch {
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  };

  const saveThreadMessages = (threadId: string, msgs: AgentMessage[]) => {
    const key = `cortex_agent_thread_${threadId}`;
    localStorage.setItem(key, JSON.stringify(msgs));
  };

  const handleNewThread = () => {
    const newThread: Thread = {
      id: generateId(),
      title: "New conversation",
      lastMessage: "",
      timestamp: Date.now(),
      messageCount: 0,
    };

    batch(() => {
      setThreads((prev) => [newThread, ...prev]);
      setActiveThreadId(newThread.id);
      setMessages([]);
    });
  };

  const handleSelectThread = (id: string) => {
    setActiveThreadId(id);
    loadThreadMessages(id);
  };

  const handleDeleteThread = (id: string) => {
    batch(() => {
      setThreads((prev) => prev.filter((t) => t.id !== id));
      if (activeThreadId() === id) {
        const remaining = threads().filter((t) => t.id !== id);
        if (remaining.length > 0) {
          setActiveThreadId(remaining[0].id);
          loadThreadMessages(remaining[0].id);
        } else {
          setActiveThreadId(null);
          setMessages([]);
        }
      }
    });

    // Clean up stored messages
    localStorage.removeItem(`cortex_agent_thread_${id}`);
  };

  const handleSendMessage = async (content: string, attachments?: File[]) => {
    // Ensure we have an active thread
    let threadId = activeThreadId();
    if (!threadId) {
      handleNewThread();
      threadId = activeThreadId()!;
    }

    const userMessage: AgentMessage = {
      id: generateId(),
      role: "user",
      content,
      timestamp: Date.now(),
      attachments: attachments?.map((f) => ({
        id: generateId(),
        name: f.name,
        type: f.type,
        size: f.size,
      })),
    };

    batch(() => {
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setStreamingContent("");
    });

    // Update thread metadata
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? {
              ...t,
              lastMessage: truncateText(content, 50),
              timestamp: Date.now(),
              messageCount: t.messageCount + 1,
              title:
                t.messageCount === 0 ? truncateText(content, 30) : t.title,
            }
          : t
      )
    );

    try {
      // Use SDK to send message via cortex-core (Tauri IPC)
      await sdk.sendMessage(content);
      
      // The SDK handles streaming via Tauri events (cortex-event)
      // We'll sync with SDK state for the response
      // Note: The actual response comes through SDK's message stream
      
    } catch (error) {
      const errorMessage: AgentMessage = {
        id: generateId(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      batch(() => {
        setIsLoading(false);
        setStreamingContent("");
      });
    }
  };

  const handleSlashCommand = (command: string) => {
    // Handle slash commands
    const prefixes: Record<string, string> = {
      plan: "Create a comprehensive plan for: ",
      code: "Please implement: ",
      explain: "Please explain: ",
      fix: "Please fix the following issue: ",
      test: "Generate tests for: ",
    };

    const prefix = prefixes[command];
    if (prefix) {
      // Focus the input with the prefix
      aiLogger.debug(`Slash command: ${command}`);
    }
    
    // Handle special commands
    switch (command) {
      case "subagents":
        // Dispatch event to open subagents dialog
        window.dispatchEvent(new CustomEvent("ai:subagents", { detail: { action: "list" } }));
        break;
      case "fork":
        // Fork current conversation
        window.dispatchEvent(new CustomEvent("ai:fork"));
        break;
      case "clear":
        // Clear conversation
        setMessages([]);
        break;
      case "new":
        // Start new thread
        handleNewThread();
        break;
      case "search":
        // Open search
        window.dispatchEvent(new CustomEvent("ai:search", { detail: {} }));
        break;
    }
  };

  const handleCancelAgent = (id: string) => {
    setActiveAgents((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: "error" as const } : a
      )
    );
  };

  const handleOpenSettings = () => {
    window.dispatchEvent(new CustomEvent("settings:open-tab"));
  };

  // Convert local Thread to ThreadList's expected format
  const threadsForList = createMemo((): ThreadListThread[] => {
    return threads().map((t) => ({
      id: t.id,
      title: t.title,
      lastMessage: t.lastMessage,
      timestamp: t.timestamp,
      messageCount: t.messageCount,
    }));
  });

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      class="interactive-session flex flex-col h-full overflow-hidden card-surface"
      style={{
        width: "100%",
        height: "100%",
        "min-width": "0",
      }}
    >
      {/* Header */}
      <AgentPanelHeader
        showThreadList={showThreadList()}
        onToggleThreadList={() => setShowThreadList(!showThreadList())}
        onNewThread={handleNewThread}
        onOpenSettings={handleOpenSettings}
      />

      {/* Main content area */}
      <div class="flex flex-1 overflow-hidden">
        <Show when={!isInitialLoading()} fallback={<AgentSkeleton />}>
          {/* Thread sidebar - now using external ThreadList */}
          <Show when={showThreadList()}>
            <ThreadList
              threads={threadsForList()}
              activeThreadId={activeThreadId()}
              onSelect={handleSelectThread}
              onDelete={handleDeleteThread}
              onNew={handleNewThread}
            />
          </Show>

          {/* Conversation area */}
          <div class="flex flex-col flex-1 min-w-0">
            {/* Messages */}
            <MessageList
              messages={messages()}
              isLoading={isLoading()}
              streamingContent={streamingContent()}
            />

            {/* Sub-agents status */}
            <Show when={activeAgents().length > 0}>
              <SubAgentStatus
                agents={activeAgents()}
                onCancel={handleCancelAgent}
              />
            </Show>

            {/* Input */}
            <MessageInput
              onSend={handleSendMessage}
              onSlashCommand={handleSlashCommand}
              isLoading={isLoading()}
            />
          </div>
          
          {/* Agent Activity Feed - Real-time visualization */}
          <AgentActivityFeed
            compact={true}
            maxActions={200}
            autoScroll={true}
            showSummary={true}
            class="w-80 border-l"
          />
        </Show>
      </div>
      
      {/* Subagents Dialog */}
      <SubagentsDialog
        open={showSubagentsDialog()}
        onClose={() => setShowSubagentsDialog(false)}
        model="claude-3-5-sonnet-20241022"
      />
    </div>
  );
}

// ============================================================================
// Export hook for external usage
// ============================================================================

export function useAgentPanel() {
  const openNewThread = () => {
    window.dispatchEvent(new CustomEvent("agent-panel:new-thread"));
  };

  return { openNewThread };
}
