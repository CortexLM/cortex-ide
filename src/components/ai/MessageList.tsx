import {
  For,
  Show,
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
  type Accessor,
} from "solid-js";
import { Message } from "@/context/SDKContext";
import { MessageView, DateSeparator } from "./MessageView";


// ============================================================================
// Types
// ============================================================================

export interface MessageListProps {
  messages: Message[];
  isStreaming?: boolean;
  onScrollToMessage?: (scrollFn: (messageId: string) => void) => void;
}

interface VirtualItem {
  index: number;
  start: number;
  size: number;
}

interface MessageGroup {
  type: "message" | "date-separator";
  message?: Message;
  timestamp?: number;
  key: string;
}

// ============================================================================
// Constants
// ============================================================================

const ESTIMATED_MESSAGE_HEIGHT = 120;
const OVERSCAN_COUNT = 3;
const SCROLL_THRESHOLD = 100;

// ============================================================================
// Utilities
// ============================================================================

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function groupMessagesWithDates(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let lastDate: Date | null = null;

  for (const message of messages) {
    const messageDate = new Date(message.timestamp);

    if (!lastDate || !isSameDay(lastDate, messageDate)) {
      groups.push({
        type: "date-separator",
        timestamp: message.timestamp,
        key: `date-${message.timestamp}`,
      });
      lastDate = messageDate;
    }

    groups.push({
      type: "message",
      message,
      key: message.id,
    });
  }

  return groups;
}

// ============================================================================
// Virtual Scroll Hook
// ============================================================================

function createVirtualScroll(
  containerRef: Accessor<HTMLElement | undefined>,
  itemCount: Accessor<number>,
  estimatedItemSize: number
) {
  const [scrollTop, setScrollTop] = createSignal(0);
  const [containerHeight, setContainerHeight] = createSignal(0);
  const [itemSizes, setItemSizes] = createSignal<Map<number, number>>(new Map());

  // Calculate total size
  const totalSize = createMemo(() => {
    const sizes = itemSizes();
    let total = 0;
    for (let i = 0; i < itemCount(); i++) {
      total += sizes.get(i) ?? estimatedItemSize;
    }
    return total;
  });

  // Calculate visible range
  const visibleRange = createMemo(() => {
    const height = containerHeight();
    const top = scrollTop();
    const sizes = itemSizes();
    const count = itemCount();

    let start = 0;
    let offset = 0;

    // Find start index
    for (let i = 0; i < count; i++) {
      const size = sizes.get(i) ?? estimatedItemSize;
      if (offset + size > top) {
        start = i;
        break;
      }
      offset += size;
      if (i === count - 1) {
        start = count;
      }
    }

    // Find end index
    let end = start;
    let visibleHeight = 0;
    for (let i = start; i < count; i++) {
      const size = sizes.get(i) ?? estimatedItemSize;
      visibleHeight += size;
      end = i + 1;
      if (visibleHeight >= height) {
        break;
      }
    }

    // Apply overscan
    const overscanStart = Math.max(0, start - OVERSCAN_COUNT);
    const overscanEnd = Math.min(count, end + OVERSCAN_COUNT);

    return { start: overscanStart, end: overscanEnd };
  });

  // Calculate virtual items
  const virtualItems = createMemo<VirtualItem[]>(() => {
    const { start, end } = visibleRange();
    const sizes = itemSizes();
    const items: VirtualItem[] = [];

    let offset = 0;
    for (let i = 0; i < start; i++) {
      offset += sizes.get(i) ?? estimatedItemSize;
    }

    for (let i = start; i < end; i++) {
      const size = sizes.get(i) ?? estimatedItemSize;
      items.push({
        index: i,
        start: offset,
        size,
      });
      offset += size;
    }

    return items;
  });

  // Update item size
  const measureItem = (index: number, size: number) => {
    setItemSizes((prev) => {
      const next = new Map(prev);
      if (next.get(index) !== size) {
        next.set(index, size);
        return next;
      }
      return prev;
    });
  };

  // Scroll handler
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    setScrollTop(target.scrollTop);
  };

  // Resize observer
  let resizeObserver: ResizeObserver | null = null;

  onMount(() => {
    const container = containerRef();
    if (container) {
      setContainerHeight(container.clientHeight);

      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerHeight(entry.contentRect.height);
        }
      });
      resizeObserver.observe(container);
    }
  });

  onCleanup(() => {
    resizeObserver?.disconnect();
  });

  return {
    scrollTop,
    containerHeight,
    totalSize,
    virtualItems,
    measureItem,
    handleScroll,
  };
}

// ============================================================================
// MessageList Component
// ============================================================================

export function MessageList(props: MessageListProps) {
  let containerRef: HTMLDivElement | undefined;
  let contentRef: HTMLDivElement | undefined;

  const [shouldAutoScroll, setShouldAutoScroll] = createSignal(true);
  const [isUserScrolling, setIsUserScrolling] = createSignal(false);

  // Group messages with date separators
  const groups = createMemo(() => groupMessagesWithDates(props.messages));

  // Virtual scroll setup
  const {
    totalSize,
    virtualItems,
    measureItem,
    handleScroll: onVirtualScroll,
  } = createVirtualScroll(
    () => containerRef,
    () => groups().length,
    ESTIMATED_MESSAGE_HEIGHT
  );

  // Track scroll position to determine auto-scroll behavior
  const handleScroll = (e: Event) => {
    onVirtualScroll(e);

    const target = e.target as HTMLElement;
    const isNearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < SCROLL_THRESHOLD;

    setShouldAutoScroll(isNearBottom);
  };

  // Detect user-initiated scrolling
  const handleWheel = () => {
    setIsUserScrolling(true);
    setTimeout(() => setIsUserScrolling(false), 150);
  };

  // Auto-scroll to bottom on new messages
  createEffect(() => {
    // Track message count and streaming status to trigger effect
    const hasMessages = props.messages.length > 0;
    const streaming = props.isStreaming;

    // Trigger scroll when streaming or new messages arrive
    if ((shouldAutoScroll() || streaming) && !isUserScrolling() && containerRef && hasMessages) {
      requestAnimationFrame(() => {
        if (containerRef) {
          containerRef.scrollTop = containerRef.scrollHeight;
        }
      });
    }
  });

  // Scroll to specific message
  const scrollToMessage = (messageId: string) => {
    const index = groups().findIndex(
      (g) => g.type === "message" && g.message?.id === messageId
    );
    if (index !== -1 && containerRef) {
      // Find the element and scroll to it
      const element = containerRef.querySelector(`[data-message-id="${messageId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  // Expose scroll function to parent
  onMount(() => {
    props.onScrollToMessage?.(scrollToMessage);
  });

  // Measure item heights after render
  const measureElement = (el: HTMLElement, index: number) => {
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        measureItem(index, entry.contentRect.height);
      }
    });
    observer.observe(el);

    onCleanup(() => observer.disconnect());
  };

  return (
    <div
      ref={containerRef}
      class="message-list"
      onScroll={handleScroll}
      onWheel={handleWheel}
    >
      <div
        ref={contentRef}
        class="message-list-content"
        style={{
          height: `${totalSize()}px`,
          position: "relative",
        }}
      >
        <For each={virtualItems()}>
          {(virtualItem) => {
            const group = () => groups()[virtualItem.index];

            return (
              <div
                ref={(el) => measureElement(el, virtualItem.index)}
                class="message-list-item"
                style={{
                  position: "absolute",
                  top: `${virtualItem.start}px`,
                  left: "0",
                  right: "0",
                }}
                data-message-id={group().type === "message" ? group().message?.id : undefined}
              >
                <Show
                  when={group().type === "message"}
                  fallback={<DateSeparator timestamp={group().timestamp!} />}
                >
                  <MessageView
                    message={group().message!}
                    isStreaming={
                      props.isStreaming &&
                      virtualItem.index === groups().length - 1 &&
                      group().message?.role === "assistant"
                    }
                  />
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      {/* Empty state */}
      <Show when={props.messages.length === 0}>
        <div class="message-list-empty">
          <p>No messages yet. Start a conversation!</p>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Simple MessageList (non-virtualized, for smaller lists)
// ============================================================================

export interface SimpleMessageListProps {
  messages: Message[];
  isStreaming?: boolean;
}

export function SimpleMessageList(props: SimpleMessageListProps) {
  let containerRef: HTMLDivElement | undefined;
  const [shouldAutoScroll, setShouldAutoScroll] = createSignal(true);

  const groups = createMemo(() => groupMessagesWithDates(props.messages));

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    const isNearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < SCROLL_THRESHOLD;
    setShouldAutoScroll(isNearBottom);
  };

  // Auto-scroll to bottom
  createEffect(() => {
    // Track message count and streaming status to trigger effect
    const hasMessages = props.messages.length > 0;
    const streaming = props.isStreaming;

    if ((shouldAutoScroll() || streaming) && containerRef && hasMessages) {
      requestAnimationFrame(() => {
        if (containerRef) {
          containerRef.scrollTop = containerRef.scrollHeight;
        }
      });
    }
  });

  return (
    <div ref={containerRef} class="message-list" onScroll={handleScroll}>
      <div class="message-list-simple-content">
        <For each={groups()}>
          {(group, index) => (
            <Show
              when={group.type === "message"}
              fallback={<DateSeparator timestamp={group.timestamp!} />}
            >
              <MessageView
                message={group.message!}
                isStreaming={
                  props.isStreaming &&
                  index() === groups().length - 1 &&
                  group.message?.role === "assistant"
                }
              />
            </Show>
          )}
        </For>

        <Show when={props.messages.length === 0}>
          <div class="message-list-empty">
            <p>No messages yet. Start a conversation!</p>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default MessageList;
