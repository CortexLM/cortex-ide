/**
 * useAnimatedList - High-Performance Animated List Hook
 *
 * Provides smooth 60 FPS list animations for entering/leaving items with
 * GPU-accelerated transforms. Supports virtual scrolling for large lists.
 *
 * Features:
 * - Smooth enter/exit animations with staggering
 * - GPU-accelerated CSS transforms (translate, scale, opacity)
 * - Virtual scrolling for lists with 1000+ items
 * - Configurable animation timing and easing
 * - Reduced motion support for accessibility
 * - Memoized calculations to prevent layout thrashing
 *
 * Performance characteristics:
 * - O(1) item add/remove operations
 * - Virtual scrolling renders only visible items + buffer
 * - Uses CSS containment for layout optimization
 * - Batches DOM reads/writes to prevent layout thrashing
 *
 * @example
 * ```tsx
 * function MessageList() {
 *   const { items, containerRef, getItemStyle, addItem, removeItem } =
 *     useAnimatedList<Message>({
 *       initialItems: messages,
 *       getKey: (msg) => msg.id,
 *       animationDuration: 200,
 *       staggerDelay: 50,
 *     });
 *
 *   return (
 *     <div ref={containerRef} class="message-list">
 *       <For each={items()}>
 *         {(item, index) => (
 *           <div style={getItemStyle(item.id, index())}>
 *             <MessageItem message={item} />
 *           </div>
 *         )}
 *       </For>
 *     </div>
 *   );
 * }
 * ```
 */

import {
  createSignal,
  createMemo,
  createEffect,
  onMount,
  onCleanup,
  batch,
  type Accessor,
} from "solid-js";

// ============================================================================
// Types
// ============================================================================

/** Animation states for list items */
export type AnimationState = "entering" | "entered" | "exiting" | "exited";

/** Item wrapper with animation metadata */
export interface AnimatedItem<T> {
  /** The actual data item */
  data: T;
  /** Unique key for the item */
  key: string;
  /** Current animation state */
  state: AnimationState;
  /** Animation start timestamp */
  animationStartTime: number;
  /** Index when animation started (for stagger calculation) */
  staggerIndex: number;
}

/** Configuration options for useAnimatedList */
export interface UseAnimatedListOptions<T> {
  /** Initial items in the list */
  initialItems?: T[];
  /** Function to extract unique key from item */
  getKey: (item: T) => string;
  /** Animation duration in milliseconds */
  animationDuration?: number;
  /** Delay between staggered animations in milliseconds */
  staggerDelay?: number;
  /** Maximum stagger delay (caps total stagger time) */
  maxStaggerDelay?: number;
  /** Whether to use virtual scrolling */
  enableVirtualScrolling?: boolean;
  /** Number of items to render outside visible area */
  overscan?: number;
  /** Estimated item height for virtual scrolling */
  estimatedItemHeight?: number;
  /** Whether to respect reduced motion preferences */
  respectReducedMotion?: boolean;
  /** Custom easing function name */
  easing?: string;
  /** Direction of enter animation */
  enterDirection?: "top" | "bottom" | "left" | "right" | "none";
  /** Direction of exit animation */
  exitDirection?: "top" | "bottom" | "left" | "right" | "none";
  /** Scale factor for enter animation (0-1) */
  enterScale?: number;
  /** Scale factor for exit animation (0-1) */
  exitScale?: number;
}

/** Style object for animated items */
export interface ItemStyle {
  transform: string;
  opacity: string;
  transition: string;
  willChange: string;
  contain: string;
}

/** Virtual scroll state */
interface VirtualScrollState {
  scrollTop: number;
  containerHeight: number;
  startIndex: number;
  endIndex: number;
  offsetY: number;
  totalHeight: number;
}

/** Return type of useAnimatedList hook */
export interface UseAnimatedListReturn<T> {
  /** Reactive accessor for animated items */
  items: Accessor<AnimatedItem<T>[]>;
  /** Visible items (for virtual scrolling) */
  visibleItems: Accessor<AnimatedItem<T>[]>;
  /** Ref to attach to container element */
  containerRef: (el: HTMLElement) => void;
  /** Get inline styles for an item */
  getItemStyle: (key: string, index: number) => ItemStyle;
  /** Get class names for an item */
  getItemClass: (key: string) => string;
  /** Add a single item */
  addItem: (item: T, index?: number) => void;
  /** Add multiple items */
  addItems: (items: T[], startIndex?: number) => void;
  /** Remove item by key */
  removeItem: (key: string) => void;
  /** Remove multiple items by keys */
  removeItems: (keys: string[]) => void;
  /** Update an existing item */
  updateItem: (key: string, updater: (item: T) => T) => void;
  /** Replace all items */
  setItems: (items: T[]) => void;
  /** Clear all items with exit animation */
  clearItems: () => void;
  /** Virtual scroll total height (for container sizing) */
  virtualHeight: Accessor<number>;
  /** Virtual scroll offset transform */
  virtualOffset: Accessor<number>;
  /** Whether reduced motion is active */
  isReducedMotion: Accessor<boolean>;
  /** Force animation state refresh */
  refresh: () => void;
}

// ============================================================================
// Configuration Defaults
// ============================================================================

const DEFAULT_ANIMATION_DURATION = 200;
const DEFAULT_STAGGER_DELAY = 30;
const DEFAULT_MAX_STAGGER_DELAY = 300;
const DEFAULT_OVERSCAN = 5;
const DEFAULT_ESTIMATED_ITEM_HEIGHT = 48;
const DEFAULT_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const DEFAULT_ENTER_DIRECTION = "bottom";
const DEFAULT_EXIT_DIRECTION = "top";
const DEFAULT_ENTER_SCALE = 0.95;
const DEFAULT_EXIT_SCALE = 0.95;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get transform offset based on direction
 */
function getDirectionOffset(
  direction: "top" | "bottom" | "left" | "right" | "none",
  distance: number = 20
): { x: number; y: number } {
  switch (direction) {
    case "top":
      return { x: 0, y: -distance };
    case "bottom":
      return { x: 0, y: distance };
    case "left":
      return { x: -distance, y: 0 };
    case "right":
      return { x: distance, y: 0 };
    case "none":
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Calculate stagger delay with cap
 */
function calculateStaggerDelay(
  index: number,
  staggerDelay: number,
  maxStaggerDelay: number
): number {
  return Math.min(index * staggerDelay, maxStaggerDelay);
}

/**
 * Check if user prefers reduced motion
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ============================================================================
// useAnimatedList Hook
// ============================================================================

/**
 * Hook for managing animated lists with smooth enter/exit animations
 * and optional virtual scrolling.
 */
export function useAnimatedList<T>(
  options: UseAnimatedListOptions<T>
): UseAnimatedListReturn<T> {
  const {
    initialItems = [],
    getKey,
    animationDuration = DEFAULT_ANIMATION_DURATION,
    staggerDelay = DEFAULT_STAGGER_DELAY,
    maxStaggerDelay = DEFAULT_MAX_STAGGER_DELAY,
    enableVirtualScrolling = false,
    overscan = DEFAULT_OVERSCAN,
    estimatedItemHeight = DEFAULT_ESTIMATED_ITEM_HEIGHT,
    respectReducedMotion = true,
    easing = DEFAULT_EASING,
    enterDirection = DEFAULT_ENTER_DIRECTION,
    exitDirection = DEFAULT_EXIT_DIRECTION,
    enterScale = DEFAULT_ENTER_SCALE,
    exitScale = DEFAULT_EXIT_SCALE,
  } = options;

  // ============================================================================
  // State
  // ============================================================================

  const [items, setItems] = createSignal<AnimatedItem<T>[]>(
    initialItems.map((data, index) => ({
      data,
      key: getKey(data),
      state: "entered" as AnimationState,
      animationStartTime: 0,
      staggerIndex: index,
    }))
  );

  const [reducedMotion, setReducedMotion] = createSignal(
    respectReducedMotion && prefersReducedMotion()
  );

  const [virtualState, setVirtualState] = createSignal<VirtualScrollState>({
    scrollTop: 0,
    containerHeight: 0,
    startIndex: 0,
    endIndex: 0,
    offsetY: 0,
    totalHeight: 0,
  });

  let containerElement: HTMLElement | null = null;
  let scrollRAFId: number | null = null;
  let animationTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // ============================================================================
  // Virtual Scrolling
  // ============================================================================

  const calculateVirtualState = (
    scrollTop: number,
    containerHeight: number,
    itemCount: number
  ): VirtualScrollState => {
    const totalHeight = itemCount * estimatedItemHeight;
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / estimatedItemHeight) - overscan
    );
    const visibleCount = Math.ceil(containerHeight / estimatedItemHeight);
    const endIndex = Math.min(
      itemCount,
      startIndex + visibleCount + overscan * 2
    );
    const offsetY = startIndex * estimatedItemHeight;

    return {
      scrollTop,
      containerHeight,
      startIndex,
      endIndex,
      offsetY,
      totalHeight,
    };
  };

  const handleScroll = () => {
    if (!containerElement || !enableVirtualScrolling) return;

    // Cancel any pending RAF
    if (scrollRAFId !== null) {
      cancelAnimationFrame(scrollRAFId);
    }

    // Batch scroll updates in RAF
    scrollRAFId = requestAnimationFrame(() => {
      if (!containerElement) return;

      const newState = calculateVirtualState(
        containerElement.scrollTop,
        containerElement.clientHeight,
        items().length
      );

      setVirtualState(newState);
      scrollRAFId = null;
    });
  };

  // ============================================================================
  // Computed Values
  // ============================================================================

  const visibleItems = createMemo(() => {
    const allItems = items();
    if (!enableVirtualScrolling) {
      return allItems;
    }

    const { startIndex, endIndex } = virtualState();
    return allItems.slice(startIndex, endIndex);
  });

  const virtualHeight = createMemo(() => {
    if (!enableVirtualScrolling) return 0;
    return items().length * estimatedItemHeight;
  });

  const virtualOffset = createMemo(() => {
    if (!enableVirtualScrolling) return 0;
    return virtualState().offsetY;
  });

  // ============================================================================
  // Animation Management
  // ============================================================================

  const scheduleStateTransition = (
    key: string,
    fromState: AnimationState,
    toState: AnimationState,
    delay: number
  ) => {
    // Clear any existing timeout for this key
    const existingTimeout = animationTimeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      setItems((prev) =>
        prev.map((item) =>
          item.key === key && item.state === fromState
            ? { ...item, state: toState }
            : item
        )
      );
      animationTimeouts.delete(key);

      // Remove exited items
      if (toState === "exited") {
        setItems((prev) => prev.filter((item) => item.key !== key));
      }
    }, delay);

    animationTimeouts.set(key, timeout);
  };

  // ============================================================================
  // Item Style Calculation
  // ============================================================================

  const getItemStyle = (key: string, _index: number): ItemStyle => {
    const item = items().find((i) => i.key === key);
    const isReduced = reducedMotion();
    const duration = isReduced ? 0 : animationDuration;

    // Default entered state
    const baseStyle: ItemStyle = {
      transform: "translate3d(0, 0, 0) scale(1)",
      opacity: "1",
      transition: `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`,
      willChange: "transform, opacity",
      contain: "layout style paint",
    };

    if (!item) return baseStyle;

    const staggerTime = isReduced
      ? 0
      : calculateStaggerDelay(item.staggerIndex, staggerDelay, maxStaggerDelay);

    switch (item.state) {
      case "entering": {
        const offset = getDirectionOffset(enterDirection);
        return {
          ...baseStyle,
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${enterScale})`,
          opacity: "0",
          transition: "none", // No transition for initial state
        };
      }
      case "entered": {
        return {
          ...baseStyle,
          transition: `transform ${duration}ms ${easing} ${staggerTime}ms, opacity ${duration}ms ${easing} ${staggerTime}ms`,
        };
      }
      case "exiting": {
        const offset = getDirectionOffset(exitDirection);
        return {
          ...baseStyle,
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${exitScale})`,
          opacity: "0",
          transition: `transform ${duration}ms ${easing} ${staggerTime}ms, opacity ${duration}ms ${easing} ${staggerTime}ms`,
        };
      }
      case "exited": {
        return {
          ...baseStyle,
          transform: "translate3d(0, -100%, 0) scale(0)",
          opacity: "0",
          transition: "none",
        };
      }
      default:
        return baseStyle;
    }
  };

  const getItemClass = (key: string): string => {
    const item = items().find((i) => i.key === key);
    if (!item) return "animated-list-item";

    return `animated-list-item animated-list-item--${item.state}`;
  };

  // ============================================================================
  // Item Operations
  // ============================================================================

  const addItem = (data: T, index?: number) => {
    const key = getKey(data);
    const now = Date.now();
    const insertIndex = index ?? items().length;

    batch(() => {
      setItems((prev) => {
        // Check for duplicates
        if (prev.some((item) => item.key === key)) {
          console.warn(`[useAnimatedList] Duplicate key: ${key}`);
          return prev;
        }

        const newItem: AnimatedItem<T> = {
          data,
          key,
          state: "entering",
          animationStartTime: now,
          staggerIndex: 0, // Will be recalculated
        };

        const updated = [...prev];
        updated.splice(insertIndex, 0, newItem);
        return updated;
      });
    });

    // Schedule transition to entered
    const effectiveDuration = reducedMotion() ? 0 : animationDuration;
    requestAnimationFrame(() => {
      scheduleStateTransition(key, "entering", "entered", effectiveDuration);
    });
  };

  const addItems = (newItems: T[], startIndex?: number) => {
    const now = Date.now();
    const insertIndex = startIndex ?? items().length;

    batch(() => {
      setItems((prev) => {
        const existingKeys = new Set(prev.map((item) => item.key));
        const itemsToAdd = newItems
          .filter((data) => {
            const key = getKey(data);
            if (existingKeys.has(key)) {
              console.warn(`[useAnimatedList] Duplicate key: ${key}`);
              return false;
            }
            existingKeys.add(key);
            return true;
          })
          .map((data, idx) => ({
            data,
            key: getKey(data),
            state: "entering" as AnimationState,
            animationStartTime: now,
            staggerIndex: idx,
          }));

        const updated = [...prev];
        updated.splice(insertIndex, 0, ...itemsToAdd);
        return updated;
      });
    });

    // Schedule transitions
    const effectiveDuration = reducedMotion() ? 0 : animationDuration;
    requestAnimationFrame(() => {
      newItems.forEach((data, idx) => {
        const key = getKey(data);
        const totalDelay =
          effectiveDuration +
          calculateStaggerDelay(idx, staggerDelay, maxStaggerDelay);
        scheduleStateTransition(key, "entering", "entered", totalDelay);
      });
    });
  };

  const removeItem = (key: string) => {
    batch(() => {
      setItems((prev) =>
        prev.map((item) =>
          item.key === key
            ? { ...item, state: "exiting" as AnimationState, staggerIndex: 0 }
            : item
        )
      );
    });

    // Schedule removal
    const effectiveDuration = reducedMotion() ? 0 : animationDuration;
    scheduleStateTransition(key, "exiting", "exited", effectiveDuration);
  };

  const removeItems = (keys: string[]) => {
    const keySet = new Set(keys);

    batch(() => {
      setItems((prev) =>
        prev.map((item, idx) =>
          keySet.has(item.key)
            ? {
                ...item,
                state: "exiting" as AnimationState,
                staggerIndex: idx,
              }
            : item
        )
      );
    });

    // Schedule removals with stagger
    const effectiveDuration = reducedMotion() ? 0 : animationDuration;
    keys.forEach((key, idx) => {
      const totalDelay =
        effectiveDuration +
        calculateStaggerDelay(idx, staggerDelay, maxStaggerDelay);
      scheduleStateTransition(key, "exiting", "exited", totalDelay);
    });
  };

  const updateItem = (key: string, updater: (item: T) => T) => {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, data: updater(item.data) } : item
      )
    );
  };

  const replaceItems = (newItems: T[]) => {
    // Clear existing and add new
    const now = Date.now();

    batch(() => {
      setItems(
        newItems.map((data, index) => ({
          data,
          key: getKey(data),
          state: "entered" as AnimationState,
          animationStartTime: now,
          staggerIndex: index,
        }))
      );
    });
  };

  const clearItems = () => {
    const allKeys = items().map((item) => item.key);
    removeItems(allKeys);
  };

  const refresh = () => {
    // Force re-render by updating timestamps
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        animationStartTime: Date.now(),
      }))
    );
  };

  // ============================================================================
  // Container Ref
  // ============================================================================

  const containerRef = (el: HTMLElement) => {
    containerElement = el;

    if (enableVirtualScrolling && el) {
      el.addEventListener("scroll", handleScroll, { passive: true });

      // Initial calculation
      const initialState = calculateVirtualState(
        el.scrollTop,
        el.clientHeight,
        items().length
      );
      setVirtualState(initialState);
    }
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(() => {
    // Listen for reduced motion preference changes
    if (respectReducedMotion && typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mediaQuery.addEventListener("change", handler);

      onCleanup(() => {
        mediaQuery.removeEventListener("change", handler);
      });
    }
  });

  onCleanup(() => {
    // Cancel any pending RAFs
    if (scrollRAFId !== null) {
      cancelAnimationFrame(scrollRAFId);
    }

    // Clear all animation timeouts
    const timeoutValues = Array.from(animationTimeouts.values());
    for (const timeout of timeoutValues) {
      clearTimeout(timeout);
    }
    animationTimeouts.clear();

    // Remove scroll listener
    if (containerElement && enableVirtualScrolling) {
      containerElement.removeEventListener("scroll", handleScroll);
    }
  });

  // Update virtual state when items change
  createEffect(() => {
    const itemCount = items().length;
    if (enableVirtualScrolling && containerElement) {
      const newState = calculateVirtualState(
        containerElement.scrollTop,
        containerElement.clientHeight,
        itemCount
      );
      setVirtualState(newState);
    }
  });

  // ============================================================================
  // Return
  // ============================================================================

  return {
    items,
    visibleItems,
    containerRef,
    getItemStyle,
    getItemClass,
    addItem,
    addItems,
    removeItem,
    removeItems,
    updateItem,
    setItems: replaceItems,
    clearItems,
    virtualHeight,
    virtualOffset,
    isReducedMotion: reducedMotion,
    refresh,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default useAnimatedList;
